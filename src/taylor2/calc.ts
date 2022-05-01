import { create, all } from "mathjs";

const math = create(all);

const X = math.parse("x") as math.SymbolNode;
const Y = math.parse("y") as math.SymbolNode;

type TaylorTerm = [number | math.Fraction, number, number]; // coeff, x exp, y exp
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
    let exprNode: math.MathNode = math.parse(expr);
    let approxComponents: TaylorTerm[] = []
    let order: math.MathNode[] = [] // partials. for n = 3: fxxx, fxxy, fxyy, fyyy

    for (let i = 0; i <= n; i++) {
        if (order.length == 0) {
            order = [exprNode];
        } else {
            let first_order = order[0]
            let new_order = [math.derivative(first_order, X)];
            
            for (let e of order) {
                new_order.push(math.derivative(e, Y));
            }

            order = new_order;
        }

        let pascal = pascal_row(i);
        for (var j = 0; j <= i; j++) {
            let p = pascal[j];
            let e = order[j].evaluate({x: a, y: b});
            let f = math.factorial(i);

            let ee = math.fraction(e);
            let coeff: number | math.Fraction = math.multiply(math.fraction(p, f), ee) as math.Fraction;
            // coeff = (pascal) * (derivative) / factorial
            approxComponents.push([coeff, i - j, j]);
        }
    }

    return approxComponents;
}

function stringify(v: number | math.Fraction) {
    if (math.isInteger(v)) {
        v = math.number(v) as number;
    }
    return math.format(v);
}

function displayTaylor(a: number, b: number, tc: TaylorTerm[]): string {
    let taylorStringComponents = tc.map(([c, xe, ye]) => {
        let segs: {h?: math.MathNode, k?: math.MathNode} = {};
        if (c == 0) return "0";

        segs.h = math.parse(`(x - ${a}) ^ ${xe}`);
        segs.k = math.parse(`(y - ${b}) ^ ${ye}`);

        let expr = math.simplify("h * k", segs);

        let es = expr.toString();
        if (es === "1") {
            return stringify(c);
        } else {
            let coeff;
            if (c == 1) coeff = "";
            else if (c == -1) coeff = "-";
            else coeff = stringify(c) + " * ";

            if (expr.type === "OperatorNode" && (expr.op === "+" || expr.op === "-") && coeff !== "") {
                return coeff + `(${es})`;
            }
            return coeff + es;
        }
    }).filter(x => x != "0");

    if (taylorStringComponents.length == 0) return "0";

    return taylorStringComponents.reduce((acc, cv) => {
        let nextTermNeg = cv.startsWith("-");

        if (nextTermNeg) {
            return `${acc} - ${cv.slice(1)}`;
        } else {
            return `${acc} + ${cv}`;
        }
    });
}

function taylor(expr: string, n = 2, a = 0, b = 0): string {
    return displayTaylor(a, b, taylorTerms(expr, n, a, b));
}

export default taylor;
export {TaylorMessage};