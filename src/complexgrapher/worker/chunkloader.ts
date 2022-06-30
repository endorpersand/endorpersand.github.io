import { create, all } from "mathjs";
import { Complex, CanvasData, ChunkData, PartialEvaluator, Evaluator, LoaderIn, LoaderOut, MainIn, InitIn } from "../types";
const math = create(all);

onmessage = function (e: MessageEvent<InitIn | MainIn | LoaderIn>) {
    let data = e.data;

    if (data.action === "init") {
        self.postMessage({action: "ready"});
        return;
    }

    let {pev, cd} = data;
    let chunk;

    if (data.action === "chunkRequest") {
        chunk = data.chunk;
    } else if (data.action === "mainRequest") {
        chunk = {
            width: cd.width, 
            height: cd.height, 
            offx: 0, 
            offy: 0
        };
    } else {
        let _: never = data;
        throw new Error("Unrecognized request into chunkLoader");
    }

    let ev = buildEvaluator(pev);
    let buf = computeBuffer(ev, cd, chunk);

    let msg: LoaderOut = {action: "chunkDone", buf, chunk};
    postMessage(msg, [buf] as any);
}

function buildEvaluator(pev: PartialEvaluator): Evaluator {
    let {fstr, inverse} = pev;
    return {f: math.evaluate(fstr), inverse}
}

function computeBuffer(ev: Evaluator, cd: CanvasData, chunk: ChunkData): ArrayBuffer {
    let {f, inverse} = ev;
    let {width, height} = chunk;

    let buf = new ArrayBuffer(4 * width * height);
    let arr32 = new Uint32Array(buf);
    for (var i = 0; i < width; i++) {
        for (var j = 0; j < height; j++) {
            let k = width * j + i;
            // compute value
            let fz = forceComplex(f( convPlanes(i, j, cd, chunk) ));
            // if (typeof fz !== 'number' && fz.type !== 'Complex') throw new TypeError('Input value is not a number');
            
            // get color
            if (!Number.isFinite(fz.re) || !Number.isFinite(fz.im)) {
                let infColor = +!inverse * 0xFFFFFF;
                arr32[k] = (0xFF << 24) | infColor;
                continue;
            }

            let { r, phi } = fz.toPolar();
            arr32[k] = polarToColor(r, phi, inverse);
        }
    }
    return buf;
}

function convPlanes(x: number, y: number, cd: CanvasData, chunk: ChunkData) {
    //converts xy pixel plane to complex plane

    // let cmx =  (row - rx) / (rx / 2) / scale,
    //     cmy = -(col - ry) / (ry / 2) / scale;

    // row - rx: distance from center, in canvas pixels
    // / (rx / 2): normalizes that so the edge is 2
    // / scale: scale mult.

    let {width, height, scale} = cd;
    let {offx, offy} = chunk;
    let [rx, ry] = [(width - 1) / 2, (height - 1) / 2];
    let cmx =  (x + offx - rx) / (rx / 2) / scale,
        cmy = -(y + offy - ry) / (ry / 2) / scale;
    return math.complex(cmx, cmy) as unknown as Complex;
}

function forceComplex(z: number | Complex) {
    // z as any is ok here
    return math.complex(z as any);
}

function polarToColor(rad: number, theta: number, inverse: boolean) {
    let hue, brightness, c, x, m, r, g, b;
    hue = mod(theta * 3 / Math.PI, 6); // hue [0,6)
    if (inverse) hue = 6 - hue;

    brightness = bfunc(rad, inverse);
    c = 1 - Math.abs(2 * brightness - 1);
    x = c * (1 - Math.abs(mod(hue, 2) - 1));
    m = brightness - c / 2;
    if (0 <= hue && hue < 1) [r, g, b] = [c, x, 0];
    else if (1 <= hue && hue < 2) [r, g, b] = [x, c, 0];
    else if (2 <= hue && hue < 3) [r, g, b] = [0, c, x];
    else if (3 <= hue && hue < 4) [r, g, b] = [0, x, c];
    else if (4 <= hue && hue < 5) [r, g, b] = [x, 0, c];
    else if (5 <= hue && hue < 6) [r, g, b] = [c, 0, x];
    else [r, g, b] = [c, x, 0]; // should never happen?

    return (    0xFF  << 24) | 
    (((b + m) * 0xFF) << 16) |
    (((g + m) * 0xFF) <<  8) |
     ((r + m) * 0xFF);
}

function bfunc(r: number, inv: boolean) {
    // bfunc needs to match the identities:
    // b(1/x) = 1 - b(x)
    // b(0) = 0

    // the current impl uses b(x) = 1 - 1/(x^n + 1)
    // another possible impl: b(x) = 2 * atan(x) / pi

    let b = 1 / (Math.sqrt(r) + 1);

    return inv ? b : 1 - b;
}

function mod(x: number, y: number) {
    return ((x % y) + y) % y;
}