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

let centerDiv = document.querySelector("#centerDiv")!    as HTMLDivElement,
    [centerX, centerY] = centerDiv.querySelectorAll("input"),
    funcInput = document.querySelector("#funcInput")!    as HTMLInputElement,
    funcTex = document.querySelector("#funcTex")!        as HTMLDivElement,
    resultTex = document.querySelector("#resultTex")!    as HTMLDivElement,
    approxNRadio = document.querySelector("#appn")!      as HTMLInputElement,
    approxNInput = document.querySelector("#appninput")! as HTMLInputElement,
    computeButton = document.querySelector("#compute")!  as HTMLButtonElement;

let tex: MaybeTex = {valid: false, expr: ""};
let swiftie = new Worker(new URL("./calc", import.meta.url), {type: "module"});

centerX.addEventListener("input", grayResult);
centerY.addEventListener("input", grayResult);
funcInput.addEventListener("input", updateFuncTex);
document.querySelectorAll("input[name=approx]").forEach(i => i.addEventListener("change", radioUpdate));
computeButton.addEventListener("click", updateResultTex);

katex.render(`f(x, y) = `, document.querySelector("#lhs")!, {
    throwOnError: false
});

updateFuncTex();
updateResultTex();

function texHandler(node: math.MathNode, options?: object) {
    if (node.type === "OperatorNode" && node.op === "*") {
        let [x, y] = node.args;
        return `${x.toTex(options)}${y.toTex(options)}`;
    }
}
function verifyExpression(expr: string, replEq = "=", explicitMul = true): MaybeTex {
    let options = explicitMul ? {} : {handler: texHandler};

    try {
        let tex = "f(x, y) = " + math.parse(expr).toTex(options);
        return {valid: true, expr, tex};
    } catch {
        return {valid: false, expr};
    }
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

function updateFuncTex() {
    tex = verifyExpression(funcInput.value);

    let display = tex.valid ? tex.tex : String.raw`\color{red}{?}`;
    katex.render(display, funcTex, {
        throwOnError: false
    });
    grayResult();
}

function updateResultTex() {
    if (tex.valid) {
        let dat: TaylorMessage = [tex.expr, findN(), +centerX.value, +centerY.value];
        swiftie.postMessage(dat);
        resultTex.classList.remove("notCurrentFunc");
        resultTex.innerHTML = "Working...";
    } else {
        invalidResult();
    }
}

function invalidResult() {
    katex.render(String.raw`\color{red}{?}`, resultTex, {
        throwOnError: false
    });
}

swiftie.onmessage = function(e) {
    resultTex.classList.remove("err");
    let rtex = verifyExpression(e.data, "\\approx", false);
    if (rtex.valid) {
        katex.render(rtex.tex, resultTex, {
            throwOnError: false
        });
    } else {
        invalidResult();
    }
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
function radioUpdate() {
    approxNInput.disabled = !approxNRadio.checked;
    grayResult();
}