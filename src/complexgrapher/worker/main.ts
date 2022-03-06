import { MainIn, MainOut, LoaderIn, LoaderOut, CanvasData } from "../types";

const CHUNK_SIZE = 50;
const N_WORKERS = 1;

let free = Array.from({length: N_WORKERS}, () => {
    let w = new Worker(new URL("./chunkloader", import.meta.url), {type: "module"});

    w.onmessage = function (e) {
        let out: LoaderOut = e.data;

        let ticket = labor.get(w);
        if (typeof ticket === "undefined") return;
        let [sym, start] = ticket;
        // load chunk
        if (currentTask == sym) {
            let msg: MainOut = {action: "loadChunk", ...out};
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

    return w;
});

type Ticket = [LoaderIn, Symbol, number];
let labor: Map<Worker, [Symbol, number]> = new Map();
let workQueue: Generator<Ticket>;
let currentTask: Symbol;

onmessage = function (e) {
    let start = this.performance.now();
    let {fstr, cd}: MainIn = e.data;
    workQueue = queue(start, fstr, cd);

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
}

function* queue(start: number, fstr: string, cd: CanvasData): Generator<Ticket> {
    let {width, height} = cd;
    currentTask = Symbol("task");

    for (let i = 0; i < width; i += CHUNK_SIZE) {
        for (let j = 0; j < height; j += CHUNK_SIZE) {
            let cw = clamp(0, CHUNK_SIZE, width - i);
            let ch = clamp(0, CHUNK_SIZE, height - j);

            yield [{
                fstr, cd,
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