import { create, all } from "mathjs";
import { Complex, ComplexFunction, InitIn, InitOut, LoaderOut, MainIn, MainOut, PartialEvaluator } from "./types";
const math = create(all);

const wrapper     = document.querySelector<HTMLDivElement>('div#wrapper')!,
      funcInput   = document.querySelector<HTMLInputElement>('input#func-input')!,
      graphButton = document.querySelector<HTMLButtonElement>('#graph-button')!,
      zcoord      = document.querySelector<HTMLDivElement>('div#zcoord')!,
      zoomButtons = document.querySelectorAll<HTMLButtonElement>('button.zoom'),
      zoomInput   = document.querySelector<HTMLInputElement>('input#zoom-input')!,
      domain      = document.querySelectorAll<HTMLElement>('.domain');

const canvas = document.createElement("canvas");
const ctx = canvas.getContext('2d', {alpha: false})!;
wrapper.appendChild(canvas);

canvas.width = document.documentElement.clientWidth;
canvas.height = document.documentElement.clientHeight;

/**
 * The scale of the graph represents the distance (in complex units) 
 * from the center of the screen to the top.
 */
let scale = 2;

function xyScale() {
    return [(scale * canvas.width / canvas.height), scale] as const;
}

/**
 * Function that takes the input complex value to the output one
 * This is only used for console.log
 * @param z input
 * @returns output
 */
let d: ComplexFunction = (z => z);

let worker: Worker;
let canNest: boolean;
let time: number; // only used in fallback

// On WebKit (iOS), nested Workers are not supported. So test if they are supported,
// and if not, use the fallback that doesn't use nested Workers.

/**
 * On WebKit (iOS), nested Workers are not supported. So this worker tests if they are supported.
 * The result is then used to determine whether or not to use the full main worker or a fallback.
 */
let webkitTest = new Worker(new URL("./worker/webkitTest", import.meta.url), {type: "module"});
webkitTest.postMessage(undefined);
webkitTest.onmessage = async function (e: MessageEvent<boolean>) {
    zcoord.textContent = "Initializing workers...";
    await waitPageUpdate();
    canNest = e.data;

    worker = canNest 
        ? new Worker(new URL("./worker/main", import.meta.url), {type: "module"}) 
        : new Worker(new URL("./worker/chunkLoader", import.meta.url), {type: "module"});
    
    await initWorker(worker);

    if (canNest) {
        worker.onmessage = function (e: MessageEvent<MainOut>) {
            let msg: MainOut = e.data;
        
            if (msg.action === "chunkDone") {
                displayChunk(msg);
            } else if (msg.action === "done") {
                markDone(msg.time);
            } else {
                let _: never = msg;
            }
        }
    } else {
        worker.onmessage = function (e: MessageEvent<LoaderOut>) {
            displayChunk(e.data);
            markDone(Math.trunc(performance.now() - time));
        }
    }
    
    worker.onerror = onComputeError;
    graphButton.disabled = false;
    graph(); // Don't need to await it. We just want it to happen eventually.
    webkitTest.terminate();
}

/**
 * Event listener that displays the complex coordinate of the mouse's current position.
 */
 function coordinateDisplay(e: MouseEvent) {
    let cx = e.pageX - canvas.offsetLeft;
    let cy = e.pageY - canvas.offsetTop;

    zcoord.classList.remove('error');
    zcoord.textContent = 'z = ';
    
    const code = document.createElement("code");
    code.append("" + convPlanes(cx, cy));
    zcoord.append(code);
};

canvas.addEventListener('click', e => {
    let cx = e.pageX - canvas.offsetLeft;
    let cy = e.pageY - canvas.offsetTop;

    let z = convPlanes(cx, cy);
    console.log(`z = ${z},\nf(z) = ${d(z)}`);
});

// Function input handlers:
funcInput.addEventListener('input', () => {
    funcInput.value = funcInput.value.replace(/[^a-zA-Z0-9+\-*/^., ()]/g, '');
});

{
    const [zoomIn, zoomReset, zoomOut] = zoomButtons;

    zoomIn.addEventListener('click', () => {
        scale /= 2;
    });

    zoomReset.addEventListener('click', () => {
        if (scale !== 2) {
            scale = 2;
            graph();
        }
    });

    zoomOut.addEventListener('click', () => {
        scale *= 2;
    });
}

let resizeCheck: NodeJS.Timer | undefined;
window.addEventListener("resize", e => {
    if (typeof resizeCheck !== "undefined") clearTimeout(resizeCheck);
    // if resize is done then perform recompute
    resizeCheck = setTimeout(async () => await graph(), 200);
});

document.querySelector<HTMLFormElement>("form#zoom-form")!.addEventListener("submit", () => {
    if (zoomInput.checkValidity()) {
        scale = 2 / +zoomInput.value;
    }
});

// For things that unconditionally graph after being pressed:
document.querySelectorAll<HTMLFormElement>("form.graph-submit").forEach(f => {
    f.addEventListener("submit", e => {
        e.preventDefault();
        graph();
    });
});
document.querySelectorAll<HTMLButtonElement>("button.graph-submit").forEach(b => {
    b.addEventListener("click", () => {
        graph();
    });
});

async function graph() {
    if (!canNest) graphButton.disabled = true;

    zcoord.classList.remove('error');
    
    zoomInput.value = `${2 / scale}`;
    zoomInput.style.width = `${zoomInput.value.length}ch`;

    const [cmX, cmY] = xyScale();
    domain[0].textContent = `-${cmX} - ${cmY}i`;
    domain[1].textContent = `${cmX} + ${cmY}i`;
    
    zcoord.textContent = 'Graphing...'
    disableHover();
    await waitPageUpdate();

    setProperty(canvas, "width", document.documentElement.clientWidth);
    setProperty(canvas, "height", document.documentElement.clientHeight);

    let fstr = funcInput.value;
    try {
        d = math.evaluate(`f(z) = ${fstr}`);
        startWorker(worker, fstr);
    } catch (e) {
        onComputeError(e as any);
        throw e;
    }
}

/**
 * @returns a promise that resolves when the DOM updates displaying
 */
async function waitPageUpdate() {
    return new Promise<void>(resolve => {
        requestAnimationFrame(() => { // this is called before update
            requestAnimationFrame(() => resolve()); // this is called after update
        });
    })
}

/**
 * Converts xy canvas pixels to values in the complex plane
 * @param x x coord
 * @param y y coord
 * @returns Complex value
 */
function convPlanes(x: number, y: number) {
    const { width, height } = canvas;
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
         (x - rx) / rx, 
        -(y - ry) / ry
    ];
    return math.complex(nx * scaleX, ny * scaleY) as unknown as Complex;
}

/**
 * Call an "init" action on a worker to prepare it for work.
 * @param w Worker to initialize.
 * @returns promise that resolves once it finishes initialization.
 */
async function initWorker(w: Worker) {
    let init: InitIn = { action: "init" };
    w.postMessage(init);

    return new Promise<void>(resolve => {
        w.onmessage = function(e: MessageEvent<InitOut>) {
            resolve();
        }
    });
}

/**
 * Instruct the worker to begin processing a function.
 * @param w the worker to instruct.
 * @param fstr the function input
 */
function startWorker(w: Worker, fstr: string) {
    if (!canNest) time = performance.now();

    let msg: MainIn = {
        action: "mainRequest",
        pev: partialEvaluate(fstr), 
        cd: {
        width: canvas.width,
        height: canvas.height,
        scale
    }};
    w.postMessage(msg);
}

/**
 * Take a string and evaluate it for speed. Simplify the string and also apply the reciprocal optimization.
 * This partial evaluation can then be fully evaluated in the workers.
 * @param fstr string to partially evaluate
 * @returns partially evaluated string
 */
function partialEvaluate(fstr: string): PartialEvaluator {
    let node = math.simplify(fstr);
    let fnode = math.parse("f(z) = 0") as math.FunctionAssignmentNode;

    let inverse = false;
    if (node.type == "OperatorNode" && node.fn == 'divide' && !isNaN(+node.args[0])) { // reciprocal func
        node.args.reverse();
        node = math.simplify(node);
        inverse = true;
    }

    fnode.expr = node;
    return { fstr: fnode.toString(), inverse };
}

/**
 * Display a done message with how long it took to complete
 * @param t time (in ms) it took for the operation to complete
 */
function markDone(t: number) {
    zcoord.textContent = `Done in ${t}ms.`;
    reenableHover();
}

/**
 * Handle errors in computation
 * @param e the error
 */
function onComputeError(e: Error | ErrorEvent) {
    let err = e instanceof ErrorEvent ? e.message : e;

    disableHover();
    zcoord.classList.add('error');
    zcoord.textContent = String(err);
    reenableHover();
}

/**
 * Disable z-coord display hover.
 */
function disableHover() {
    canvas.removeEventListener('mousemove', coordinateDisplay);
    document.body.removeEventListener('mousemove', coordinateDisplay);
}

/**
 * Reenable interactability after an error
 * @param after how many ms before hover and interactibility should reenable
 */
function reenableHover(after = 500) {
    setTimeout(() => {
        canvas.addEventListener('mousemove', coordinateDisplay);
        document.body.addEventListener('mousemove', coordinateDisplay);
        if (!canNest) graphButton.disabled = false;
    }, after);
}

/**
 * Update the canvas with the loaded chunk
 * @param data the data from the worker
 */
function displayChunk(data: LoaderOut) {
    let {chunk, buf} = data;

    let dat = new ImageData(new Uint8ClampedArray(buf), chunk.width, chunk.height);
    ctx.putImageData(dat, chunk.offx, chunk.offy);
}

function setProperty<P extends string | number | symbol, V>(o: {[I in P]: V}, p: P, v: V) {
    if (o[p] !== v) o[p] = v;
}