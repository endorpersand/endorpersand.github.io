import { create, all } from "mathjs";
import { TaylorMessage } from "./calc";
import katex from 'katex';

const math = create(all);
type MaybeTex = {
    valid: false,
    expr: string,
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

let tex: MaybeTex = {valid: false, expr: ""};
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
 * math.js `toTex` handler that makes multiplication implicit
 */
function mulAsImplicit(node: math.MathNode, options?: object) {
    if (node.type === "OperatorNode" && node.op === "*") {
        let [x, y] = node.args;
        return `${x.toTex(options)}${y.toTex(options)}`;
    }
}

/**
 * Check if the expression is parseable with `math.parse`.
 * @param expr the expression to verify
 * @param explicitMul whether multiplication should be explicitly marked with \cdot
 * @returns whether the expression is parseable
 */
function verifyExpression(expr: string, explicitMul = true): MaybeTex {
    let options = explicitMul ? {} : {handler: mulAsImplicit};

    try {
        let tex = "f(x, y) = " + math.parse(expr).toTex(options);
        return {valid: true, expr, tex};
    } catch {
        return {valid: false, expr};
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

    let display = tex.valid ? tex.tex : String.raw`\color{red}{?}`;
    katex.render(display, funcTex, {
        throwOnError: false
    });
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
    katex.render(String.raw`\color{red}{?}`, resultTex, {
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
    let msg = e.message;
    let index = msg.indexOf("Undefined ");
    let sym = msg.slice(index + "Undefined symbol ".length); // can also be "Undefined function", but not that big of a deal
    if (sym.includes("x") || sym.includes("y")) {
        msg += " (try adding * here?)"
    }
    resultTex.textContent = msg;
    resultTex.classList.add("err");
}
