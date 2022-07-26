import { create, all } from "mathjs";
import { TaylorMessage, Verify } from "./calc";
import katex from 'katex';

const math = create(all);
type Symbol = {
    name: string,
    type: "SymbolNode" | "FunctionNode"
};

type MaybeTex = {
    valid: false,
    expr: string,
    errType: {
        type: "not parseable"
    } | {
        type: "not initialized"
    } | {
        type: "invalid symbols",
        tex: string,
        symbols: Symbol[]
    }
} | {
    valid: true,
    expr: string,
    tex: string
};

let centerDiv          = document.querySelector<HTMLDivElement>("#center-div")!,
    [centerX, centerY] = centerDiv.querySelectorAll("input"),
    funcInput          = document.querySelector<HTMLInputElement>("#func-input")!,
    funcTex            = document.querySelector<HTMLDivElement>("#func-tex")!,
    resultTex          = document.querySelector<HTMLDivElement>("#result-tex")!,
    approxNRadio       = document.querySelector<HTMLInputElement>("#appn")!,
    approxNInput       = document.querySelector<HTMLInputElement>("#appninput")!,
    computeButton      = document.querySelector<HTMLButtonElement>("#compute")!;

let tex: MaybeTex = {valid: false, expr: "", errType: { type: "not initialized" }};
let swiftie = new Worker(new URL("./calc", import.meta.url), {type: "module"});

document.querySelectorAll("input").forEach(el => el.addEventListener("input", grayResult));
funcInput.addEventListener("input", updateFuncTex);

document.querySelectorAll("input[name=approx]").forEach(i => i.addEventListener("change", radioUpdate));
computeButton.addEventListener("click", updateResultTex);

document.querySelectorAll("form").forEach(el => el.addEventListener("submit", e => {
    e.preventDefault();
    updateResultTex();
}));
katex.render(`f(x, y) = `, document.querySelector("#lhs")!, {
    throwOnError: false
});

updateFuncTex();
updateResultTex();

/**
 * Mark invalid symbols as red.
 * @param invalidSymbols Place to list symbols as invalid
 */
function redInvalidSymbols(node: math.MathNode, invalidSymbols?: Symbol[], options?: {}) {
    if (node.type === "SymbolNode" && !Verify.isConstant(node)) {
        invalidSymbols?.push(node);
        return String.raw`\textcolor{red}{${node.name}}`;
    } else if (node.type === "FunctionNode" && !Verify.isFunction(node.fn)) {
        const args = node.args.map(n => n.toTex(options)).join(",");

        invalidSymbols?.push({name: node.fn.name, type: node.type});
        return String.raw`\textcolor{red}{\mathrm{${node.fn.name}}}\left(${args}\right)`
    }
}

/**
 * Check if the expression is parseable with `math.parse`.
 * @param expr the expression to verify
 * @returns whether the expression is parseable
 */
function verifyExpression(expr: string): MaybeTex {
    const invalidSymbols: Symbol[] = [];
    let options = {handler: (n: math.MathNode, o: {}) => redInvalidSymbols(n, invalidSymbols, o)};

    try {
        let tex = "f(x, y) = " + math.parse(expr).toTex(options);

        const valid = invalidSymbols.length === 0;
        if (valid) {
            return { valid, expr, tex };
        } else {
            return { valid, expr, errType: {
                type: "invalid symbols",
                tex, 
                symbols: invalidSymbols
            }};
        }
    } catch (e) {
        return {valid: false, expr, errType: { type: "not parseable" }};
    }
}

/**
 * @returns the value of `n` given by the approximation inputs
 */
function findN() {
    let [v] = Array.from<HTMLInputElement>(document.querySelectorAll("input[name=approx]"))
        .filter(e => e.checked)
        .map(e => +e.value);
    
    if (v !== 0) return v;
    // 0 is assigned to input#appninput
    return +approxNInput.value;
}

/**
 * Mark the result tex as gray, indicating that the result has not been computed yet.
 */
function grayResult() {
    resultTex.classList.add("not-current");
}

/**
 * Update the function input tex.
 */
function updateFuncTex() {
    tex = verifyExpression(funcInput.value);

    let display = String.raw`\textcolor{red}{?}`;
    if (tex.valid) { display = tex.tex; }
    else if (tex.errType.type === "invalid symbols") { display = tex.errType.tex; }

    katex.render(display, funcTex, {
        throwOnError: false
    });
    if (!tex.valid && tex.errType.type === "invalid symbols") {
        const div = document.createElement("div");
        div.classList.add("err");

        const [sym] = tex.errType.symbols;

        const type = sym.type === "FunctionNode" ? "function" : "constant";
        const hint = /[xy]/.test(sym.name) ? "(Try adding * here?)" : "";
        div.textContent = `Undefined ${type} ${sym.name} ${hint}`.trim();
        funcTex.append(div);
    }
    grayResult();
}

/**
 * Send a request to compute and update the result tex.
 */
function updateResultTex() {
    if (tex.valid) {
        let dat: TaylorMessage = [tex.expr, findN(), +centerX.value, +centerY.value];
        swiftie.postMessage(dat);
        resultTex.classList.remove("not-current");
        resultTex.innerHTML = "Working...";
    } else {
        invalidResult();
    }
}

/**
 * Mark the result as invalid.
 */
function invalidResult() {
    katex.render(String.raw`\textcolor{red}{?}`, resultTex, {
        throwOnError: false
    });
}

/**
 * Update the arbitrary n input if the option is checked.
 */
function radioUpdate() {
    approxNInput.disabled = !approxNRadio.checked;
    updateResultTex();
}

swiftie.onmessage = function(e: MessageEvent<string>) {
    resultTex.classList.remove("err");

    katex.render(`f(x,y) \\approx ${e.data.replaceAll("~", "")}`, resultTex, {
        throwOnError: false
    });
}

swiftie.onerror = function(e) {
    resultTex.textContent = e.message;
    resultTex.classList.add("err");
}
