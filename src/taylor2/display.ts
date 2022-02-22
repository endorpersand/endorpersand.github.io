import { create, all } from "mathjs";
import taylor from '../mvc/taylor2';

declare var MathJax: any;
const math = create(all);
type MaybeTex = {
    valid: false,
    expr: string,
} | {
    valid: true,
    expr: string,
    tex: string
};

let centerDiv = document.querySelector("#centerDiv")!      as HTMLDivElement,
    [centerX, centerY] = centerDiv.querySelectorAll("input"),
    funcInput = document.querySelector("#func input")!     as HTMLInputElement,
    funcTex = document.querySelector("#funcTex")!          as HTMLDivElement,
    resultTex = document.querySelector("#resultTex")!      as HTMLDivElement,
    approxNRadio = document.querySelector("#appn")!        as HTMLInputElement,
    approxNInput = document.querySelector("#appninput")!   as HTMLInputElement,
    computeButton = document.querySelector("#compute")!    as HTMLButtonElement;

let tex: MaybeTex = {valid: false, expr: ""};

centerX.addEventListener("input", grayResult);
centerY.addEventListener("input", grayResult);
funcInput.addEventListener("input", updateFuncTex);
document.querySelectorAll("input[name=approx]").forEach(i => i.addEventListener("change", radioUpdate));
computeButton.addEventListener("click", updateResultTex);
updateFuncTex();
updateResultTex();

function verifyExpression(expr: string, replEq = "="): MaybeTex {
    let fexpr = "f(x, y) = " + expr;
    let tex;
    try {
        tex = math.parse(fexpr).toTex().replace(":=", replEq);
    } catch {
        return {valid: false, expr}
    }

    return {valid: true, expr, tex};
}

function findN() {
    let rads = [...document.querySelectorAll("input[name=approx]")];
    let v = (rads as HTMLInputElement[])
        .filter(e => e.checked)
        .map(e => e.value)[0];
    
    if (+v != 0) return +v;
    return +approxNInput.value;
}

function grayResult() {
    resultTex.classList.add("notCurrentFunc");
}

function updateTex() {
    if ("typeset" in MathJax) {
        MathJax.typeset();
    }
}

function updateFuncTex() {
    tex = verifyExpression(funcInput.value);

    if (tex.valid) {
        funcTex.innerHTML = `$$${tex.tex}$$`;
    } else {
        funcTex.innerHTML = `$$\\color{red}{?}$$`
    }

    grayResult();
    updateTex();
}

function updateResultTex() {
    let succ = false;
    if (tex.valid) {
        let taytay: string = "";
        resultTex.classList.remove("err");
        resultTex.classList.remove("notCurrentFunc");
        try {
            taytay = taylor(tex.expr, findN(), +centerX.value, +centerY.value);
        } catch (e) {
            console.log(e);
            if (e instanceof Error && e.message.startsWith("Undefined ")) {
                let msg = e.message;
                let sym = msg.slice("Undefined symbol ".length); // can also be "Undefined function", but not that big of a deal
                if (sym.includes("x") || sym.includes("y")) {
                    msg += " (try adding * here?)"
                }
                resultTex.innerHTML = msg;
                resultTex.classList.add("err");
                return;
            }
        }
        let rTex = verifyExpression(taytay, "\\approx");
        if (rTex.valid) {
            resultTex.innerHTML = `$$${rTex.tex}$$`;
            succ = true;
        }
    }
    if (!succ) {
        resultTex.innerHTML = `$$\\color{red}{?}$$`
    }
    updateTex();
}

function radioUpdate() {
    if (approxNRadio.checked) {
        approxNInput.disabled = false;
    } else {
        approxNInput.disabled = true;
    }
    grayResult();
}