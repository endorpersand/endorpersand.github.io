import { Complex } from "complex.js";
export { Complex };

export interface CanvasData {
    width: number,
    height: number,
    scale: number,
}

export interface Evaluator {
    f: ComplexFunction,
    // signifies whether or not to use the reciprocal optimization (bfunc(1/fz) = 1 - bfunc(fz))
    inverse: boolean
}

export type ComplexFunction = (z: Complex) => Complex | number;