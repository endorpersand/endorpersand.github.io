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

            let fullCoeff: number | math.Fraction = math.fraction(math.multiply(c, e), f) as math.Fraction;
            approxComponents.push([fullCoeff, i - j, j]);
        }
    }

    return [a, b, approxComponents];
}

function buildTerm(variable: string, shift: number, exp: number) {
    if (exp != 0) {
        let p = math.simplify(`${variable} - ${shift}`).toString();
        if (p.length != variable.length) p = `(${p})`;

        return math.simplify(`a ^ ${exp}`).toString().replace("a", p);
    }
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
        let segs: string[] = [];
        if (c == 0) return;
        
        let unitCoeff = c == 1 || c == -1;
        if (!unitCoeff) {
            segs.push(stringify(c));
        }
        let xt = buildTerm("x", a, xe);
        let yt = buildTerm("y", b, ye);
        if (typeof xt === "string") {
            segs.push(xt);
        }
        if (typeof yt === "string") {
            if (xt?.length == 1) segs.push("*");
            segs.push(yt);
        }
    
        if (unitCoeff) {
            // if coeff is 1 or -1, then the sign should be displayed in the first term
            // if this term is actually a x^0y^0 term, display -1 or 1
    
            let first;
            if (segs.length == 0) {
                first = "1";
            } else {
                first = segs[0];
            }
    
            if (c == -1) first = "-" + first;
    
            segs[0] = first;
        }
        return segs.join("");
    }).filter(x => typeof x != "undefined") as string[];

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