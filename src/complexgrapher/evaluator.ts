import { all, create } from "mathjs";
import { Complex, ComplexFunction, Evaluator } from "./types";
const math = create(all);

/**
 * A mapping of names to constants which they represent:
 */
const constants = {
    "pi": Complex.PI,
    "e": Complex.E,
    "i": Complex.I,
    "inf": Complex.INFINITY,
    "infinity": Complex.INFINITY,
    "epsilon": Complex.EPSILON,
    "nan": Complex.NAN
} as const;

/**
 * A mapping of names to functions (C -> C) which they represent.
 */
const functions: { readonly [s: string]: ComplexFunction } = {
    "gamma": math.gamma as any,
} as const;

/**
 * A mapping of operators to their respective functions.
 */
const operators: {[s: string]: (a: Complex) => AcceptableReturn} = {
    "add": (a: Complex) => a.add.bind(a),
    "unaryPlus": (a: Complex) => () => a,
    "subtract": (a: Complex) => a.sub.bind(a),
    "unaryMinus": (a: Complex) => a.neg.bind(a),
    "multiply": (a: Complex) => a.mul.bind(a),
    "divide": (a: Complex) => a.div.bind(a),
    "pow": (a: Complex) => a.pow.bind(a),
    "factorial": (a: Complex) => () => math.gamma(a.add(1) as any),
} as const;

namespace Results {
    export interface Z {
        type: "z"
    }

    export interface Constant {
        type: "constant",
        value: Complex | number
    }

    export interface ComplexMethod {
        type: "method",
        name: keyof Complex
    }
    
    export interface Function {
        type: "function",
        f: ComplexFunction
    }
}

type LookupResult = Results.Z | Results.ComplexMethod | Results.Constant;
type FoldResult   = Results.Z | Results.Function | Results.Constant;

/**
 * Checks if this is a valid method on Complex
 * @param k the method to check
 * @returns if it is
 */
function isComplexMethod(k: string): k is keyof Complex {
    return k in Complex.I;
}
/**
 * Get a value from a specified object or `undefined` if the key is not present.
 * @param o object
 * @param k key to get
 * @returns value (or `undefined` if not present)
 */
function getFrom<O>(o: O, k: string): O[keyof O] | void {
    if (k in o) return (o as any)[k];
}

/**
 * Check if the symbol is in one of the symbol mappings
 * @param n Symbol node to look up
 * @returns the lookup result or an error if not present
 */
function lookup(n: math.SymbolNode): LookupResult {
    let { name } = n;

    name = name.toLowerCase();
    if (name === "z") return { type: "z" };
    if (isComplexMethod(name)) return { type: "method", name }
    if (name in constants) return {
        type: "constant", 
        value: constants[name as keyof typeof constants]
    };
    // if (name in functions) return {
    //     type: "function",
    //     f: functions[name]
    // }

    throw new Error(`Unrecognized symbol [${name}]`)
}

/**
 * Take a `FoldResult` object and evaluate it with the specified z-value
 * @param val the `FoldResult`
 * @param z value z should be set to
 * @returns the resulting value
 */
function unwrap(val: FoldResult, z: Complex): Complex | number {
    if (val.type === "constant") return val.value;
    if (val.type === "function") return val.f(z);
    if (val.type === "z") return z;

    let _: never = val;
    throw new Error(`Unrecognized fold result ${(val as any).type}`);
}

type AcceptableReturn =
    | number
    | ((this: Complex, ...args: any[]) => any)
function makeFunction(
    f: (a: Complex) => AcceptableReturn, 
    args: math.MathNode[]
): FoldResult {
    let fargs = args.map(node => fold(node));

    // if all constants, this can be computed as a constant
    if (fargs.every((a): a is Results.Constant => a.type === "constant")) {
        const [self, ...rest] = fargs.map(c => c.value);

        const cself = Complex(self);
        const met = f(cself);

        if (typeof met === "number") return { type: "constant", value: met };
        return { type: "constant", value: met.bind(cself)(...rest) };
    }

    const [self, ...rest] = fargs;
    
    return {
        type: "function",
        f: z => {
            let a = Complex(unwrap(self, z));
            let b = rest.map(arg => unwrap(arg, z));

            const met = f(a);

            if (typeof met === "number" /* re, im */) return met;
            return met.bind(a)(...b);
        }
    };
}

/**
 * Fold a node into a usable function
 * @param n Node to fold
 * @returns Function representing the tree
 */
function fold(n: math.MathNode): FoldResult {
    switch (n.type) {
        case "ConstantNode":
            return { type: "constant", value: n.value };
        case "FunctionNode": {
            const lk = lookup(n.fn);

            if (lk.type === "method") {
                return makeFunction(a => a[lk.name], n.args);
            } else if (lk.type === "constant") {
                throw new Error(`Expected function, got constant [${n.fn.name} = ${lk.value}]`);
            } else if (lk.type === "z") {
                throw new Error(`Expected function, got [z]`);
            }

            let _: never = lk;
            throw new Error(`Expected function, got [${(lk as any).type}]`);
        }
        case "OperatorNode": {
            const op = getFrom(operators, n.fn);
            const f = op ? makeFunction(op, n.args) : undefined;

            if (typeof f === "undefined") throw new Error(`Unexpected operator [${n.op}]`);
            return f;
        }
        case "ParenthesisNode":
            return fold(n.content);
        case "SymbolNode": {
            const lk = lookup(n);

            // bare symbols cannot evaluate to methods.
            if (lk.type === "method") {
                throw new Error(`Unexpected function [${n.name}]`);
            }

            return lk;
        }
        default:
            throw new Error(`Cannot parse [${n.type}] into complex function`);
    }
}

/**
 * Compile a function string into a usable function
 * @param fstr string to compile
 * @returns the function
 */
export function compile(fstr: string): Evaluator["evaluator"] {
    const fr = fold(math.parse(fstr));

    switch (fr.type) {
        case "constant":
            return {
                type: "constant",
                f: fr.value,
            }
        case "function":
            return fr
        case "z":
            return {
                type: "function",
                f: z => z
            }
        default:
            let _: never = fr;
            throw new Error(`Invalid fold result type ${(fr as any).type}`);
    }
}