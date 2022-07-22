import { all, create } from "mathjs";
import { Complex, ComplexFunction, Evaluator } from "./types";
const math = create(all);

const constants = {
    "pi": Complex.PI,
    "e": Complex.E,
    "i": Complex.I,
    "inf": Complex.INFINITY,
    "infinity": Complex.INFINITY,
    "epsilon": Complex.EPSILON,
    "nan": Complex.NAN
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

function isComplexMethod(n: string): n is keyof Complex {
    return n in Complex.I;
}
function getFrom<O>(o: O, k: string): O[keyof O] | void {
    if (k in o) return (o as any)[k];
}

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

const operatorMapping: {[s: string]: (a: Complex) => AcceptableReturn} = {
    "add": (a: Complex) => a.add.bind(a),
    "unaryPlus": (a: Complex) => () => a,
    "subtract": (a: Complex) => a.sub.bind(a),
    "unaryMinus": (a: Complex) => a.neg.bind(a),
    "multiply": (a: Complex) => a.mul.bind(a),
    "divide": (a: Complex) => a.div.bind(a),
    "pow": (a: Complex) => a.pow.bind(a),
    "factorial": (a: Complex) => () => math.gamma(a.add(1) as any),
} as const;

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
    args: math.MathNode[], 
    allowFunctions: boolean
): FoldResult | undefined {
    // can only accept z OR number | Complex
    // functions should not be allowed.
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
    if (allowFunctions) return {
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

function fold(n: math.MathNode, allowFunctions: false): Results.Z | Results.Constant;
function fold(n: math.MathNode, allowFunctions: true): FoldResult;
function fold(n: math.MathNode): FoldResult;
function fold(n: math.MathNode, allowFunctions: boolean = true): FoldResult {
    switch (n.type) {
        case "ConstantNode":
            return { type: "constant", value: n.value };
        case "FunctionNode": {
            const lk = lookup(n.fn);

            if (lk.type === "method") {
                const f = makeFunction(a => a[lk.name], n.args, allowFunctions);
                if (typeof f === "undefined") throw new Error(`Unexpected function [${lk.name}]`);
                return f;
            } else if (lk.type === "constant") {
                throw new Error(`Expected function, got constant [${n.fn.name} = ${lk.value}]`);
            } else if (lk.type === "z") {
                throw new Error(`Expected function, got [z]`);
            }

            let _: never = lk;
            throw new Error(`Expected function, got [${(lk as any).type}]`);
        }
        case "OperatorNode": {
            const op = getFrom(operatorMapping, n.fn);
            const f = op ? makeFunction(op, n.args, allowFunctions) : undefined;

            if (typeof f === "undefined") throw new Error(`Unexpected operator [${n.op}]`);
            return f;
        }
        case "ParenthesisNode":
            return fold(n.content);
        case "SymbolNode": {
            const lk = lookup(n);
            if (lk.type === "method") {
                throw new Error(`Unexpected function [${n.name}]`);
            }

            return lk;
        }
        default:
            throw new Error(`Cannot parse [${n.type}] into complex function`);
    }
}

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