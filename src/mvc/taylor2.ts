import { create, all } from "mathjs";

const math = create(all);

let x = math.parse("x") as math.SymbolNode;
let y = math.parse("y") as math.SymbolNode;

type TaylorComponents = [number | math.Fraction, number, number][];
type TaylorInformation = [number, number, TaylorComponents];

function coeffs(n: number) {
    // calculate the coefficients of (x + y)^n
    return Array.from({length: n + 1}, (_, i) => math.combinations(n, i))
}

// def taylor(expr, a = 0, b = 0, h = x, k = y, n = 2):
//     assert n >= 0

//     approx = 0
//     order = []

//     for i in range(n + 1):
//         if len(order) == 0:
//             order = [expr]
//         else:
//             first_order = order[0]
//             new_order = [diff(first_order, x)]
//             new_order.extend(diff(e, y) for e in order)
//             order = new_order
        
//         for j, [c, e] in enumerate(zip(all_coeffs(i), order)):
//             h_term = h ** j if j != 0 else 1
//             k_term = k ** (i - j) if (i - j) != 0 else 1

//             approx += c * h_term * k_term * e.subs(x, a).subs(y, b) / math.factorial(i)
        
//     return approx

function taylorComponents(expr: string, n = 2, a = 0, b = 0): TaylorInformation {

    // compute taylor
    let exprNode: math.MathNode = math.parse(expr);
    let approxComponents: TaylorComponents = [] // coeff, x exp, y exp
    let order: math.MathNode[] = []

    for (let i = 0; i <= n; i++) {
        if (order.length == 0) {
            order.push(exprNode);
        } else {
            let first_order = order[0]
            let new_order = [math.derivative(first_order, x)];
            
            for (let e of order) {
                new_order.push(math.derivative(e, y));
            }

            order = new_order;
        }

        let cs = coeffs(i);
        for (var j = 0; j <= i; j++) {
            let c = cs[j];
            let e = order[j].evaluate({x: a, y: b});
            let f = math.factorial(i);

            let ee = math.fraction(e);
            let fullCoeff: number | math.Fraction = math.multiply(math.fraction(c, f), ee) as math.Fraction;
            approxComponents.push([fullCoeff, i - j, j]);
        }
    }

    return [a, b, approxComponents];
}

function stringify(v: number | math.Fraction) {
    if (math.isInteger(v)) {
        v = math.number(v) as number;
    }
    return math.format(v);
}

function displayTaylor(ti: TaylorInformation): string {
    let [a, b, tc] = ti;
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
    return displayTaylor(taylorComponents(expr, n, a, b));
}

export default taylor;