import { Complex } from "complex.js";
export { Complex };

/**
 * Canvas dimension data (width and height), as well as the current zoom level
 */
export interface CanvasData {
    width: number,
    height: number,
    scale: number,
}

/**
 * Chunk data designating the size of the chunk and its offset from (0, 0) in canvas
 */
export interface ChunkData {
    width: number,
    height: number,
    offx: number,
    offy: number
}

/**
 * A partially evaluated function string.
 * The string here is already simplified, and the reciprocal optimization has already been applied,
 * but the is not fully computed to allow it to be passed as a Worker message.
 */
export interface PartialEvaluator {
    fstr: string,
    inverse: boolean
}

/**
 * A fully evaluated function.
 * This has the sufficient knowledge to compute an output color from an input complex number.
 */
export interface Evaluator {
    f: ComplexFunction,

    /**
     * Signifies whether to use the reciprocal optimization: bfunc(1 / fz) = 1 - bfunc(fz)
     */
    inverse: boolean
}

/**
 * A function that takes a complex number to another complex number
 */
export type ComplexFunction = (z: Complex) => Complex | number;

namespace Messages {
    /**
     * A request to compute the function across an entire canvas
     */
    export type MainRequest = {
        action: "mainRequest",
        pev: PartialEvaluator,
        cd: CanvasData
    };
    
    /**
     * Designation that the canvas is fully computed
     */
    export type GraphDone = {
        action: "done",
        time: number
    };

    /**
     * A request to compute the function across a chunk
     */
    export type ChunkRequest = {
        action: "chunkRequest",
        pev: PartialEvaluator
        cd: CanvasData,
        chunk: ChunkData,
    };

    /**
     * Designation that the chunk is fully computed (with the computed data from the chunk)
     */
    export type ChunkDone = {
        action: "chunkDone",
        chunk: ChunkData,
        buf: ArrayBuffer
    };

    /**
     * Call to initialize
     */
    export type Init = {
        action: "init"
    };

    /**
     * Return call to designate initialization completed
     */
    export type Ready = {
        action: "ready"
    }
}
export type InitIn = Messages.Init;
export type InitOut = Messages.Ready;

export type MainIn = Messages.MainRequest;
export type MainOut = Messages.ChunkDone | Messages.GraphDone;

export type LoaderIn = Messages.ChunkRequest;
export type LoaderOut = Messages.ChunkDone;