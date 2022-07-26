import { create, all } from "mathjs";

const math = create(all);

const VARS = ["x", "y"] as const;
const [X, Y] = VARS.map(s => new math.SymbolNode(s));

export namespace Verify {
    const VALID_FUNCTIONS = new Set([
        "cbrt", "sqrt", "nthRoot", "log10", "log", "pow", "exp", "abs",
        "sin",   "cos",   "tan",   "sec",   "csc",   "cot", 
        "asin",  "acos",  "atan",  "asec",  "acsc",  "acot", 
        "sinh",  "cosh",  "tanh",  "sech",  "csch",  "coth", 
        "asinh", "acosh", "atanh", "asech", "acsch", "acoth", 
    ]);

    export function isConstant(n: math.SymbolNode) {
        const { name } = n;
        return VARS.includes(name as any)
            || (name in math && !((math as any)[name] instanceof Function));
    };

    export function isFunction(n: math.SymbolNode) {
        return VALID_FUNCTIONS.has(n.name);
    };

    export function validateTreeSymbols(n: math.MathNode) {
        return n.forEach((node, _, parent) => {
            if (node.type === "SymbolNode") {
                if (parent.type === "FunctionNode" && parent.fn === node) {
                    if (!Verify.isFunction(node)) throw new Error(`Undefined function ${node.name}`);
                } else {
                    if (!Verify.isConstant(node)) throw new Error(`Undefined symbol ${node.name}`);
                }
            }
        });
    }
}

/**
 * Input into this worker.
 * @param expr The expression
 * @param n Degree of approximation
 * @param a center x
 * @param b center y
 */
type TaylorMessage = [expr: string, n: number, a: number, b: number];

/**
 * A term of the Taylor polynomial.
 * @param sign The sign of the term (true if (+) or 0, false if (-))
 * @param coeff The absolute value of the coefficient
 * @param xe The exponent on the x-term
 * @param ye The exponent on the y-term
 */
type TaylorTerm = [sign: boolean, coeff: math.MathNode, xe: number, ye: number];

onmessage = function(e: MessageEvent<TaylorMessage>) {
    postMessage(taylor(...e.data));
}

/**
 * Create a string representing the taylor polynomial expansion
 * @param expr The expression
 * @param n Degree of approximation
 * @param a center x
 * @param b center y
 * @returns the string
 */
function taylor(expr: string, n = 2, a = 0, b = 0): string {
    return displayTaylor(a, b, taylorTerms(expr, n, a, b)).toTex();
}

/**
 * Calculate the coefficients of (x + y)^n
 * @param n 
 * @returns the coefficients
 */
function pascalRow(n: number) {
    return Array.from({length: n + 1}, (_, i) => math.combinations(n, i))
}

/**
 * Calculate a list of each term of the taylor polynomial
 * Each term consists of (pascal) * (coeff) * x^n * y^n / (factorial)
 * @param expr The expression
 * @param n Degree of approximation
 * @param a center x
 * @param b center y
 * @returns a list of terms
 */
function taylorTerms(expr: string, n = 2, a = 0, b = 0): TaylorTerm[] {
    // compute taylor
    let exprNode: math.MathNode = math.simplify(expr);
    Verify.validateTreeSymbols(exprNode);

    let approxComponents: TaylorTerm[] = []
    let order: math.MathNode[] = [] // partials. for n = 3: fxxx, fxxy, fxyy, fyyy

    for (let i = 0; i <= n; i++) {
        if (order.length == 0) {
            order = [exprNode];
        } else {
            if (order.every(n => n.type === "ConstantNode")) break;
            order = [
                math.derivative(order[0], X),
                ...order.map(e => math.derivative(e, Y))
            ];
        }

        let pascal = pascalRow(i);
        for (var j = 0; j <= i; j++) {
            let p = pascal[j];
            let e = math.simplify(order[j], 
                [...math.simplify.rules,
                    "sin(pi / 2) -> 1",
                    "sin(pi) -> 0",
                    "sin(3 * pi / 2) -> -1",
                    "sin(2 * pi) -> 0",

                    "cos(pi / 2) -> 0",
                    "cos(pi) -> -1",
                    "cos(3 * pi / 2) -> 0",
                    "cos(2 * pi) -> 1",
                    n => n.transform(node => {
                        if (node.type == "OperatorNode" && node.op == "*" && !node.implicit) node.implicit = true;
                        return node;
                    })
                ],
                {x: a, y: b}
            );
            let f = math.factorial(i);

            approxComponents.push([...coeff(p, e, f), i - j, j]);
        }
    }

    return approxComponents;
}

const op = {
    div(args: math.MathNode[])  { return new math.OperatorNode("/", "divide", args)          },
    imul(args: math.MathNode[]) { return new math.OperatorNode("*", "multiply", args, true)  },
    emul(args: math.MathNode[]) { return new math.OperatorNode("*", "multiply", args, false) },
    neg(arg: math.MathNode)     { return new math.OperatorNode("-", "unaryMinus", [arg])     },
    add(args: math.MathNode[])  { return new math.OperatorNode("+", "add", args)             },
    sub(args: math.MathNode[])  { return new math.OperatorNode("-", "subtract", args)        },
    pow(args: math.MathNode[])  { return new math.OperatorNode("^", "pow", args)             },
}

/**
 * Utility function to create a node representing the coefficient.
 * @param pascal Pascal component
 * @param deriv The derivative
 * @param fact The factorial component
 * @returns the sign and node of the coefficient
 */
function coeff(pascal: number, deriv: math.MathNode, fact: number): [sign: boolean, coeff: math.MathNode] {
    // coeff = (pascal) * (derivative) / factorial
    
    let sign = Math.sign(pascal) * Math.sign(fact) >= 0;
    pascal   = Math.abs(pascal);
    fact     = Math.abs(fact);

    let pf = op.div([new math.ConstantNode(pascal), new math.ConstantNode(fact)]);

    let prod = math.simplify(op.imul([pf, deriv]), [
        ...math.simplify.rules, 
        n => n.transform(node => node.type == "FunctionNode" ? new math.ConstantNode(node.evaluate()) : node)
    ]);
    prod = prod.transform(n => {
        if (n.type == "OperatorNode" && n.fn == "unaryMinus") {
            sign = !sign;
            return n.args[0];
        }
        return n;
    });

    return [sign, math.simplify(prod)];
}

/**
 * Take the sign boolean and a node and combine it into a new node.
 * @param s sign boolean
 * @param n node
 * @returns the new node
 */
function signed(s: boolean, n: math.MathNode) {
    return s ? n : op.neg(n)
}

/**
 * (x - a)^b
 * @param varNode x
 * @param exp b
 * @param shift a
 * @returns the node
 */
function variableExpNode(varNode: math.SymbolNode, exp: number, shift: number) {
    let node: math.MathNode = varNode;
    
    const shiftNode = new math.ConstantNode(Math.abs(shift));
    if (shift < 0) node = new math.ParenthesisNode(op.add([node, shiftNode]));
    else if (shift > 0) node = new math.ParenthesisNode(op.sub([node, shiftNode]));

    if (exp !== 1) node = op.pow([node, new math.ConstantNode(exp)]);

    return node;
}

/**
 * Convert a list of taylor terms & the center position into a node representing the entire Taylor polynomial
 * @param a center x
 * @param b center y
 * @param tc the taylor terms
 * @returns the tree representing the entire Taylor polynomial
 */
function displayTaylor(a: number, b: number, tc: TaylorTerm[]): math.MathNode {
    let taylorTermNodes = tc.map(([sign, coeff, xe, ye]) => {
        coeff = math.simplify(coeff);
        if (coeff.type == "ConstantNode" && coeff.value == 0) return;
        
        let args = [];

        if (xe != 0) args.push(variableExpNode(X, xe, a));
        if (ye != 0) args.push(variableExpNode(Y, ye, b));

        let expr: math.MathNode;
        if (args.length == 0) {
            return [sign, coeff] as const;
        } else if (args.length == 1) {
            [expr] = args;
        } else {
            expr = op.imul(args);
        }
        
        if (coeff.type !== "ConstantNode" || coeff.value !== 1) {
            expr = op.imul([coeff, expr]);
        }

        return [sign, expr] as const;
    }).filter(<T>(x?: T): x is T => typeof x !== "undefined");

    if (taylorTermNodes.length == 0) return new math.ConstantNode(0);

    let [first, ...rest] = taylorTermNodes;
    return rest.reduce((acc, [s, n]) => s ? op.add([acc, n]) : op.sub([acc, n]), signed(...first))
}

export default taylor;
export {TaylorMessage};