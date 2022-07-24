import { MainIn, MainOut, LoaderIn, LoaderOut, CanvasData, PartialEvaluator, InitIn, InitOut } from "../types";

const CHUNK_SIZE = 100;
const N_WORKERS = 4;

let free: Worker[] = [];

type LaborData = [time: number];
type Ticket = [LoaderIn, LaborData];
let labor: Map<Worker, LaborData> = new Map();

/**
 * The queue to pull work from
 */
let workQueue: Generator<Ticket>;

onmessage = async function (e: MessageEvent<InitIn | MainIn>) {
    let data = e.data;

    if (data.action === "init") {
        await initLoaders();
        self.postMessage({action: "ready"});
    } else if (data.action === "mainRequest") {
        let start = this.performance.now();
        let { pev, cd, graphID } = data;

        // on a request, start up the queue and assign work to all currently free workers
        workQueue = queue(start, pev, cd, graphID);
    
        let fit = free[Symbol.iterator]();
        for (let w of fit) {
            let t = workQueue.next();
    
            if (!t.done) {
                assignWorkToWorker(w, t.value);
            } else {
                break;
            }
        }
        free = [...fit];
    } else {
        let _: never = data;
        throw new Error("Unexpected request into main worker");
    }
}

/**
 * @returns a promise which resolves once all the chunkLoaders have been created and initialized
 */
async function initLoaders() {
    if (free.length > 0) return;
    
    free = Array.from({length: N_WORKERS}, () => 
        new Worker(new URL("./chunkLoader", import.meta.url), {type: "module"})
    );

    let promises = Array.from(free, w => 
        new Promise<Worker>(resolve => {
            w.onmessage = function (e: MessageEvent<InitOut>) {
                resolve(w);
            }
            w.postMessage({action: "init"});
        })
        .then(w => {
            w.onmessage = function (e: MessageEvent<LoaderOut>) {
                let out = e.data;
        
                let ticket = labor.get(w);
                if (typeof ticket === "undefined") return; // worker wasn't working on a ticket

                // If the current task is the currentTask, post up "loadChunk"
                self.postMessage(out, [out.buf] as any);
                
                // If there's any more work left to do, take it.
                // Otherwise, free the worker and post up "done"
                let t = workQueue.next();
                if (!t.done) {
                    // reassign
                    assignWorkToWorker(w, t.value);
                } else {
                    // no more work to do, free the worker
                    freeWorker(w);
                    
                    // if all chunks finished, send done
                    let [start] = ticket;
                    if (typeof start !== "undefined" && labor.size == 0) {
                        let done: MainOut = { 
                            action: "done", 
                            time: Math.trunc(performance.now() - start),
                            graphID: out.graphID
                        };
                        self.postMessage(done);
                    }
                }
            }
        
            w.onerror = function (e) {
                freeWorker(w);
            }
        })
    );
    
    return await Promise.all(promises);
}

function* spiral(limitX?: number, limitY?: number) {
    limitX = Math.abs(limitX ?? Infinity);
    limitY = Math.abs(limitY ?? Infinity);

    yield [0, 0] as const;
    for (let d = 1; d <= limitX + limitY; d++) {
        // start at [d, 0], or skip forward in the path if there's a limitX
        let x = Math.min(d, limitX), y = d - x;

        // always inclusive to exclusive
        // traverse [ d,  0] => [ 0,  d] || diff: [-1,  1]
        for (; y < d; x--, y++) {
            yield [x, y] as const;

            if (y === limitY) {
                x = -x;
                break;
            }
        }
        // traverse [ 0,  d] => [-d,  0] || diff: [-1, -1]
        for (; y > 0; x--, y--) {
            yield [x, y] as const;

            if (x === -limitX) {
                y = -y;
                break;
            }
        }
        // traverse [-d,  0] => [ 0, -d] || diff: [ 1, -1]
        for (; x < 0; x++, y--) {
            yield [x, y] as const;

            if (y === -limitY) {
                x = -x;
                break;
            }
        }
        // traverse [ 0, -d] => [ d,  0] || diff: [ 1,  1]
        for (; x < d; x++, y++) {
            yield [x, y] as const;

            if (x === limitX) {
                break;
            }
        }
    }
}

/**
 * Generator that breaks up the canvas into computable chunks, which can be sent to chunkLoaders to compute them
 * @param start Time queue started
 * @param pev Partial evaluator that needs to be evaluated
 * @param cd The dimension data of the canvas to chunk
 */
function* queue(start: number, pev: PartialEvaluator, cd: CanvasData, graphID: number): Generator<Ticket> {
    let {width, height} = cd;

    const limitX = Math.ceil(width / 2 / CHUNK_SIZE - 1 / 2);
    const limitY = Math.ceil(height / 2 / CHUNK_SIZE - 1 / 2);

    for (let [i, j] of spiral(limitX, limitY)) {
        let x = width / 2 + (i - 1/2) * CHUNK_SIZE;
        let y = height / 2 + (j - 1/2) * CHUNK_SIZE;
        let cw = clamp(0, x + CHUNK_SIZE, width) - x;
        let ch = clamp(0, y + CHUNK_SIZE, height) - y;

        yield [
            {
                action: "chunkRequest",
                pev, cd,
                chunk: {
                    width: cw, height: ch, offx: x, offy: y
                },
                graphID,
            }, 
            [start]
        ];
    }
}

function* empty() {}

/**
 * Designate a worker as free to work.
 * @param w Worker to mark as free.
 */
function freeWorker(w: Worker) {
    labor.delete(w);
    free.push(w);
}

/**
 * Assign a worker a chunk to compute.
 * @param w Worker to designate.
 * @param param1 Ticket to work on.
 */
function assignWorkToWorker(w: Worker, [job, data]: Ticket) {
    w.postMessage(job);
    labor.set(w, data);
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(v, max));
}