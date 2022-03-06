import { create, all } from "mathjs";
import { Complex, CanvasData, ChunkData, Evaluator, LoaderIn, LoaderOut } from "../types";
const math = create(all);

onmessage = function (e) {
    let {fstr, cd, chunk}: LoaderIn = e.data;
    let ev = buildEvaluator(fstr);
    let buf = computeBuffer(ev, cd, chunk);

    let msg: LoaderOut = {buf, chunk};
    postMessage(msg, [buf] as any);
}

function buildEvaluator(fstr: string): Evaluator {
    let node = math.simplify(fstr);
    let fnode = math.parse("f(z) = 0") as math.FunctionAssignmentNode;

    fnode.expr = node;

    if (node.type == "OperatorNode" && node.fn == 'divide' && !isNaN(+node.args[0])) { // reciprocal func
        node.args.reverse();
        return { f: fnode.evaluate(), inverse: true };
    } else {
        return { f: fnode.evaluate(), inverse: false };
    }
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
            if (!Number.isFinite(fz.re) || !Number.isFinite(fz.im)) {
                let infColor = +!inverse * 0xFFFFFF;
                arr32[k] = (0xFF << 24) | infColor;
                continue;
            }

            // get color
            let hue, brightness, c, x, m, r, g, b;
            hue = mod((inverse ? -1 : 1) * fz.arg() * 3 / Math.PI, 6); // hue [0,6)
            brightness = bfunc(fz, inverse);
            c = 1 - Math.abs(2 * brightness - 1);
            x = c * (1 - Math.abs(mod(hue, 2) - 1));
            m = brightness - c / 2;
            if (0 <= hue && hue < 1) [r, g, b] = [c, x, 0];
            else if (1 <= hue && hue < 2) [r, g, b] = [x, c, 0];
            else if (2 <= hue && hue < 3) [r, g, b] = [0, c, x];
            else if (3 <= hue && hue < 4) [r, g, b] = [0, x, c];
            else if (4 <= hue && hue < 5) [r, g, b] = [x, 0, c];
            else if (5 <= hue && hue < 6) [r, g, b] = [c, 0, x];
            else [r, g, b] = [c, 0, x]; // should never happen?
            //
            arr32[k] = 
                (           255  << 24) | // alpha
                (((b + m) * 255) << 16) |
                (((g + m) * 255) <<  8) |
                 ((r + m) * 255)
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
    return math.complex(z as any) as unknown as Complex;
}

function bfunc(z: Complex, inv: boolean) {
    // bfunc needs to match the identities:
    // b(1/x) = 1 - b(x)
    // b(0) = 0

    // the current impl uses b(x) = 1 - 1/(x^n + 1)
    // another possible impl: b(x) = 2 * atan(x) / pi

    let x = z.abs();
    let n = 1/2;
    let b = 1 / (x ** n + 1);

    return inv ? b : 1 - b;
}

function mod(x: number, y: number) {
    return ((x % y) + y) % y;
}