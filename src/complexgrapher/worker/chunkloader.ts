import { Complex, CanvasData, ChunkData, PartialEvaluator, Evaluator, LoaderIn, LoaderOut, MainIn, InitIn, ComplexFunction } from "../types";
import * as evaluator from "../evaluator";

let running = true;

onmessage = function (e: MessageEvent<InitIn | MainIn | LoaderIn>) {
    let data = e.data;

    if (data.action === "init") {
        self.postMessage({action: "ready"});
        return;
    }

    running = true;
    let { pev, cd, graphID } = data;
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

    let msg: LoaderOut = { action: "chunkDone", buf, chunk, graphID };
    postMessage(msg, [buf] as any);
}

/**
 * Take a partially computed evaluator and fully evaluate it.
 * @param pev partially computed evaluator
 * @returns the full evaluator
 */
function buildEvaluator(pev: PartialEvaluator): Evaluator {
    let {fstr, inverse} = pev;
    return {evaluator: evaluator.compile(fstr), inverse}
}

/**
 * Compute the ArrayBuffer for the chunk
 * @param ev The function evaluator
 * @param cd Canvas dimension data
 * @param chunk Chunk position and size
 * @returns the computed chunk
 */
function computeBuffer(ev: Evaluator, cd: CanvasData, chunk: ChunkData): ArrayBuffer {
    let {evaluator, inverse} = ev;
    let {width, height} = chunk;

    let buf = new ArrayBuffer(4 * width * height);
    let arr32 = new Uint32Array(buf);

    if (evaluator.type === "constant") {
        const fz = Complex(evaluator.f);
        arr32.fill( polarToColor(fz.abs(), fz.arg(), inverse) );
    } else {
        const { f } = evaluator;
        
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                if (!running) return buf;
                let k = width * j + i;
                // compute value
                let fz = Complex(f( convPlanes(i, j, cd, chunk) ));

                let r = fz.abs();
                let phi = fz.arg();
                arr32[k] = polarToColor(r, phi, inverse);
            }
        }
    }

    return buf;
}

/**
  * Converts xy canvas pixels to values in the complex plane
 * @param x x coord
 * @param y y coord
 * @param cd canvas data
 * @param chunk chunk offset data
 * @returns the complex value associated
 */
function convPlanes(x: number, y: number, cd: CanvasData, chunk: ChunkData) {
    const { width, height, scale, center: [cx, cy] } = cd;
    const { offx, offy } = chunk;
    const scaleX = scale * width / height;
    const scaleY = scale;

    // distance of each radius
    let [rx, ry] = [
        (width  - 1) / 2,
        (height - 1) / 2
    ];

    // normalized distance from center (This means the center is at 0, the edges are at ±1).
    // the center is also (rx, ry)
    let [nx, ny] = [
         (x + offx - rx) / rx, 
        -(y + offy - ry) / ry
    ];
    
    return Complex(cx + nx * scaleX, cy + ny * scaleY);
}

/**
 * Takes a polar coordinate and maps it to a color
 * @param rad Radius
 * @param theta Angle
 * @param inverse Whether to invert the brightness
 * @returns the associated color in RGB
 */
function polarToColor(rad: number, theta: number, inverse: boolean) {
    let hue = mod(theta * 3 / Math.PI, 6); // hue [0,6)
    if (inverse) hue = 6 - hue;

    return hsl2rgb(
        hue,
        1,
        bfunc(rad, inverse),
    );
}

/**
 * Converts HSL to RGBA
 * @param h hue [0, 6]
 * @param s saturation [0, 1]
 * @param l lightness [0, 1]
 * @returns 4-byte RGBA number ([0, 255], alpha is always 255)
 */
function hsl2rgb(h: number, s: number, l: number) {
    let c, x, m, r, g, b;
    c = (1 - Math.abs(2 * l - 1)) * s;
    x = c * (1 - Math.abs(mod(h, 2) - 1));
    m = l - c / 2;
    if (0 <= h && h < 1) [r, g, b] = [c, x, 0];
    else if (1 <= h && h < 2) [r, g, b] = [x, c, 0];
    else if (2 <= h && h < 3) [r, g, b] = [0, c, x];
    else if (3 <= h && h < 4) [r, g, b] = [0, x, c];
    else if (4 <= h && h < 5) [r, g, b] = [x, 0, c];
    else if (5 <= h && h < 6) [r, g, b] = [c, 0, x];
    else [r, g, b] = [c, x, 0];

    return (    0xFF  << 24) | 
    (((b + m) * 0xFF) << 16) |
    (((g + m) * 0xFF) <<  8) |
     ((r + m) * 0xFF);
}

/**
 * Brightness computation
 * @param r Radius
 * @param inv Whether to invert the brightness
 * @returns the brightness as float
 */
function bfunc(r: number, inv: boolean) {
    // bfunc needs to match the identities:
    // b(1/x) = 1 - b(x)
    // b(0) = 0

    // the current impl uses b(x) = 1 - 1/(x^n + 1)
    // another possible impl: b(x) = 2 * atan(x) / pi

    let b = 1 / (Math.sqrt(r) + 1);

    return inv ? 1 - b : b;
}

function mod(x: number, y: number) {
    return ((x % y) + y) % y;
}