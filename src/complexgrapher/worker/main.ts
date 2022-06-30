import { MainIn, MainOut, LoaderIn, LoaderOut, CanvasData, PartialEvaluator, InitIn, InitOut } from "../types";

const CHUNK_SIZE = 50;
const N_WORKERS = 4;

let free: Worker[] = [];

type Ticket = [LoaderIn, Symbol, number];
let labor: Map<Worker, [Symbol, number]> = new Map();
let workQueue: Generator<Ticket>;
let currentTask: Symbol;

onmessage = async function (e: MessageEvent<InitIn | MainIn>) {
    let data = e.data;

    if (data.action === "init") {
        await initLoaders();
        self.postMessage({action: "ready"});
    } else if (data.action === "mainRequest") {
        let start = this.performance.now();
        let {pev, cd} = data;
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
                if (typeof ticket === "undefined") return;
                let [sym, start] = ticket;
                // load chunk
                if (currentTask == sym) {
                    let msg: MainOut = {...out, action: "displayChunk"};
                    self.postMessage(msg, [out.buf] as any);
                }
        
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

function freeWorker(w: Worker) {
    labor.delete(w);
    free.push(w);
}

function assignWorkToWorker(w: Worker, [job, sym, start]: Ticket) {
    w.postMessage(job);
    labor.set(w, [sym, start]);
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(v, max));
}