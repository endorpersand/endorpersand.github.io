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

export interface Evaluator {
    f: ComplexFunction,
    // signifies whether or not to use the reciprocal optimization (bfunc(1/fz) = 1 - bfunc(fz))
    inverse: boolean
}

export type ComplexFunction = (z: Complex) => Complex | number;

export type MainIn = {
    fstr: string,
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
    fstr: string
    cd: CanvasData,
    chunk: ChunkData,
};
export type LoaderOut = {
    chunk: ChunkData,
    buf: ArrayBuffer
};