import { MainIn, MainOut, LoaderIn, LoaderOut, CanvasData, PartialEvaluator, InitIn, InitOut } from "../types";

const CHUNK_SIZE = 50;
const N_WORKERS = 4;

let free: Worker[] = [];

type Ticket = [LoaderIn, Symbol, number];

/**
 * Map that links a worker to the task they've been assigned
 */
let labor: Map<Worker, [Symbol, number]> = new Map();

/**
 * The queue to pull work from
 */
let workQueue: Generator<Ticket>;

/**
 * The current task to be working on
 */
let currentTask: Symbol;

onmessage = async function (e: MessageEvent<InitIn | MainIn>) {
    let data = e.data;

    if (data.action === "init") {
        await initLoaders();
        self.postMessage({action: "ready"});
    } else if (data.action === "mainRequest") {
        let start = this.performance.now();
        let {pev, cd} = data;

        // on a request, start up the queue and assign work to all currently free workers
        workQueue = queue(start, pev, cd);
    
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
                let [sym, start] = ticket;
                if (currentTask == sym) {
                    self.postMessage(out, [out.buf] as any);
                }
        
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
                    if (typeof start !== "undefined" && labor.size == 0) {
                        let done: MainOut = { action: "done", time: Math.trunc(performance.now() - start) };
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

/**
 * Generator that breaks up the canvas into computable chunks, which can be sent to chunkLoaders to compute them
 * @param start Time queue started
 * @param pev Partial evaluator that needs to be evaluated
 * @param cd The dimension data of the canvas to chunk
 */
function* queue(start: number, pev: PartialEvaluator, cd: CanvasData): Generator<Ticket> {
    let {width, height} = cd;
    currentTask = Symbol("task");

    for (let i = 0; i < width; i += CHUNK_SIZE) {
        for (let j = 0; j < height; j += CHUNK_SIZE) {
            let cw = clamp(0, CHUNK_SIZE, width - i);
            let ch = clamp(0, CHUNK_SIZE, height - j);

            yield [{
                action: "chunkRequest",
                pev, cd,
                chunk: {
                    width: cw, height: ch, offx: i, offy: j
                }
            }, currentTask, start];
        }
    }
}

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
function assignWorkToWorker(w: Worker, [job, sym, start]: Ticket) {
    w.postMessage(job);
    labor.set(w, [sym, start]);
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(v, max));
}