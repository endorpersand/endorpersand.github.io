import { Complex } from "complex.js";
export { Complex };

export interface CanvasData {
    width: number,
    height: number,
    scale: number,
}

export interface ChunkData {
    width: number,
    height: number,
    offx: number,
    offy: number
}

// like an evaluator, but the fstr is not evaluated into a function.
// this can be passed across postMessage
export interface PartialEvaluator {
    fstr: string,
    inverse: boolean
}

export interface Evaluator {
    f: ComplexFunction,
    // signifies whether or not to use the reciprocal optimization (bfunc(1/fz) = 1 - bfunc(fz))
    inverse: boolean
}

export type ComplexFunction = (z: Complex) => Complex | number;

namespace Messages {
    export type MainRequest = {
        action: "mainRequest",
        pev: PartialEvaluator,
        cd: CanvasData
    };

    export type DisplayChunk = {
        action: "displayChunk",
        chunk: ChunkData,
        buf: ArrayBuffer
    };

    export type GraphDone = {
        action: "done",
        time: number
    };

    export type ChunkRequest = {
        action: "chunkRequest",
        pev: PartialEvaluator
        cd: CanvasData,
        chunk: ChunkData,
    };

    export type ChunkDone = {
        action: "chunkDone",
        chunk: ChunkData,
        buf: ArrayBuffer
    };

    export type Init = {
        action: "init"
    };

    export type Ready = {
        action: "ready"
    }
}
export type InitIn = Messages.Init;
export type InitOut = Messages.Ready;

export type MainIn = Messages.MainRequest;
export type MainOut = Messages.DisplayChunk | Messages.GraphDone;

export type LoaderIn = Messages.ChunkRequest;
export type LoaderOut = Messages.ChunkDone;