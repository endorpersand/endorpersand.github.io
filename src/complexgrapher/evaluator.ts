import { all, create } from "mathjs";
import { Complex, ComplexFunction, Evaluator } from "./types";
const math = create(all);

type Numeric = Complex | number;
type ComplexMethod<R = Numeric> = (this: Complex, ...args: any[]) => R;

/**
 * A mapping of names to constants which they represent:
 */
const constants = {
    pi: Complex.PI,
    e: Complex.E,
    i: Complex.I,
    inf: Complex.INFINITY,
    infinity: Complex.INFINITY,
    epsilon: Complex.EPSILON,
    nan: Complex.NAN
} as const;

/**
 * A mapping of names to functions (C -> C) which they represent.
 */
const functions: { readonly [s: string]: ComplexMethod<any> } = {
    gamma() { return math.gamma(this as any); }, // slower than pure Complex.js, but oh well
    ln: Complex.prototype.log,
} as const;

/**
 * A mapping of operators to their respective functions.
 */
const operators: { [s: string]: ComplexMethod } = {
    add:        Complex.prototype.add,
    unaryPlus() { return this; },
    subtract:   Complex.prototype.sub,
    unaryMinus: Complex.prototype.neg,
    multiply:   Complex.prototype.mul,
    divide:     Complex.prototype.div,
    pow:        Complex.prototype.pow,
    factorial() { return math.gamma<any>(this.add(1)); },
} as const;

namespace Results {
    export interface Z {
        type: "z"
    }

    export interface Constant {
        type: "constant",
        value: Numeric
    }

    export interface Method {
        type: "method",
        f: ComplexMethod<any>
    }
    
    export interface Function {
        type: "function",
        f: ComplexFunction
    }
}

type LookupResult = Results.Z | Results.Method | Results.Constant;
type FoldResult   = Results.Z | Results.Function | Results.Constant;

namespace ComplexMethod {
    /**
     * Checks if this is a valid method on Complex
     * @param k the method to check
     * @returns if it is
     */
    export function isMethod(k: string): k is keyof Complex {
        return k in Complex.prototype;
    }

    /**
     * Gets a complex method from the given key.
     * @param k key
     * @returns a complex method (this will be the prototype method if already a method or a wrapper method if not)
     */
    export function get(k: keyof Complex): ComplexMethod<any> {
        const m = Complex.prototype[k];
    
        if (m instanceof Function) return m;
        return function() { return this[k]; }
    }

    export function wrap(f: ComplexFunction): ComplexMethod {
        return function() { return f(this); }
    }
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

    if (ComplexMethod.isMethod(name)) return { type: "method", f: ComplexMethod.get(name) }
    if (name in constants) return {
        type: "constant", 
        value: constants[name as keyof typeof constants]
    }
    if (name in functions) return {
        type: "method",
        f: functions[name]
    }

    throw new Error(`Unrecognized symbol [${name}]`)
}

/**
 * Take a `FoldResult` object and evaluate it with the specified z-value
 * @param val the `FoldResult`
 * @param z value z should be set to
 * @returns the resulting value
 */
function unwrap(val: FoldResult, z: Complex): Numeric {
    if (val.type === "constant") return val.value;
    if (val.type === "function") return val.f(z);
    if (val.type === "z") return z;

    let _: never = val;
    throw new Error(`Unrecognized fold result ${(val as any).type}`);
}

function createFunction(
    f: ComplexMethod<any>, 
    args: math.MathNode[]
): FoldResult {
    let fargs = args.map(node => fold(node));

    // if all constants, this can be computed as a constant
    if (fargs.every((a): a is Results.Constant => a.type === "constant")) {
        const [self, ...rest] = fargs.map(c => c.value);

        const cself = Complex(self);
        return { type: "constant", value: f.apply(cself, rest) };
    }

    const [self, ...rest] = fargs;
    
    return {
        type: "function",
        f: z => {
            let a = Complex(unwrap(self, z));
            let b = rest.map(arg => unwrap(arg, z));

            return f.apply(a, b);
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
                return createFunction(lk.f, n.args);
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
            const f = op ? createFunction(op, n.args) : undefined;

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