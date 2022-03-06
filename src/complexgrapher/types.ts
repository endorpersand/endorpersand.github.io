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

export type MainIn = {
    pev: PartialEvaluator,
    cd: CanvasData
};
export type MainOut = {
    action: "loadChunk",
    chunk: ChunkData,
    buf: ArrayBuffer
} | {
    action: "done",
    time: number
};
export type LoaderIn = {
    pev: PartialEvaluator
    cd: CanvasData,
    chunk: ChunkData,
};
export type LoaderOut = {
    chunk: ChunkData,
    buf: ArrayBuffer
};