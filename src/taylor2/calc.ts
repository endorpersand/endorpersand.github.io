import { create, all } from "mathjs";

const math = create(all);

const X = math.parse("x") as math.SymbolNode;
const Y = math.parse("y") as math.SymbolNode;

type TaylorTerm = [boolean, math.MathNode, number, number]; // coeff sign: true if +, abs coeff, x exp, y exp
type TaylorMessage = [string, number, number, number]; // expr, n, a, b

onmessage = function(e) {
    let dat = e.data as TaylorMessage;
    postMessage(taylor(...dat));
}

function pascal_row(n: number) {
    // calculate the coefficients of (x + y)^n
    return Array.from({length: n + 1}, (_, i) => math.combinations(n, i))
}

function taylorTerms(expr: string, n = 2, a = 0, b = 0): TaylorTerm[] {

    // compute taylor
    let exprNode: math.MathNode = math.simplify(expr);
    let approxComponents: TaylorTerm[] = []
    let order: math.MathNode[] = [] // partials. for n = 3: fxxx, fxxy, fxyy, fyyy

    for (let i = 0; i <= n; i++) {
        if (order.length == 0) {
            order = [exprNode];
        } else {
            order = [
                math.derivative(order[0], X),
                ...order.map(e => math.derivative(e, Y))
            ];
        }

        let pascal = pascal_row(i);
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
    div(args: math.MathNode[])  { return new math.OperatorNode("/", "divide", args)         },
    imul(args: math.MathNode[]) { return new math.OperatorNode("*", "multiply", args, true) },
    neg(arg: math.MathNode)     { return new math.OperatorNode("-", "unaryMinus", [arg])    },
    add(args: math.MathNode[])  { return new math.OperatorNode("+", "add", args)            },
    sub(args: math.MathNode[])  { return new math.OperatorNode("-", "subtract", args)       },
}

function coeff(pascal: number, deriv: math.MathNode, fact: number): [boolean, math.MathNode] {
    // coeff = (pascal) * (derivative) / factorial
    
    let sign = Math.sign(pascal) * Math.sign(fact) >= 0;
    pascal   = Math.abs(pascal);
    fact     = Math.abs(fact);

    let pf = op.div([new math.ConstantNode(pascal), new math.ConstantNode(fact)]);

    let prod = math.simplify(op.imul([pf, deriv]), [
        ...math.simplify.rules, n => n.transform(node => node.type == "FunctionNode" ? new math.ConstantNode(node.evaluate()) : node)
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
function signed(s: boolean, n: math.MathNode) {
    return s ? n : op.neg(n)
}

function displayTaylor(a: number, b: number, tc: TaylorTerm[]): math.MathNode {
    let taylorStringComponents = tc.map(([s, c, xe, ye]) => {
        c = math.simplify(c);
        if (c.type == "ConstantNode" && c.value == 0) return;
        
        let args = [];

        if (xe != 0) args.push(math.simplify(`(x - ${a}) ^ ${xe}`));
        if (ye != 0) args.push(math.simplify(`(y - ${b}) ^ ${ye}`));

        let expr;
        if (args.length == 0) {
            return [s, c];
        } else if (args.length == 1) {
            expr = args[0];
        } else {
            expr = math.simplify(op.imul(args));
        }
        
        if (c.type != "ConstantNode" || c.value != 1) {
            expr = op.imul([c, expr]);
        }

        return [s, expr];
    }).filter(x => typeof x !== "undefined") as [boolean, math.MathNode][];

    if (taylorStringComponents.length == 0) return new math.ConstantNode(0);

    let first = taylorStringComponents[0];
    return taylorStringComponents.slice(1)
        .reduce((acc, [s, n]) => s ? op.add([acc, n]) : op.sub([acc, n]), signed(...first))
}

function taylor(expr: string, n = 2, a = 0, b = 0): string {
    return displayTaylor(a, b, taylorTerms(expr, n, a, b)).toTex();
}

export default taylor;
export {TaylorMessage};