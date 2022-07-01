import { create, all } from "mathjs";
import { ChunkData, Complex, ComplexFunction, InitIn, InitOut, LoaderOut, MainIn, MainOut, PartialEvaluator } from "./types";
const math = create(all);

const wrapper     = document.querySelector('#wrapper')!     as HTMLDivElement,
      funcForm    = document.querySelector('#funcForm')!    as HTMLFormElement,
      input       = funcForm.querySelector('input')!        as HTMLInputElement,
      graphButton = document.querySelector('#graphButton')! as HTMLButtonElement,
      zcoord      = document.querySelector('#zcoord')!      as HTMLDivElement,
      zoomButtons = document.querySelectorAll('button.zoom'),
      zoomForm    = document.querySelector('#zoomForm')!    as HTMLFormElement,
      zoomInput   = zoomForm.querySelector('input')!        as HTMLInputElement,
      scaleForm   = document.querySelector('#scaleForm')!   as HTMLFormElement,
      scaleInput  = scaleForm.querySelector('input')!       as HTMLInputElement,
      warning     = document.querySelector('#warning')!     as HTMLDivElement,
      domain      = document.querySelectorAll('.domain');

const canvas = document.createElement("canvas");
const ctx = canvas.getContext('2d', {alpha: false})!;
wrapper.appendChild(canvas);

/**
 * The default domain of the image at zoom 1
 */
const defaultDomain: [Complex, Complex] = [
    math.complex('-2-2i'), 
    math.complex('2+2i'),
] as any;

/**
 * The default radius.
 */
const radiusThreshold = 250;
/**
 * The radius the calculator will default to for the image. 
 * 
 * Typically 250 (so 501 x 501), but if window is small enough, this falls back to the window's width.
 */
let defaultRadius = Math.min(
    radiusThreshold, 
    (document.documentElement.clientWidth - 1) / 2 - 8 // size of the window / 2, minus padding
);
scaleInput.value = "" + defaultRadius;

/**
 * The zoom of the image (which affects the domain, but not the dimensions of the image)
 * 
 * Increase: zoom in
 * 
 * Decrease: zoom out
 */
let zoom = 1;

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
    graphButton.click();
    webkitTest.terminate();
}

/**
 * Event listener that displays the complex coordinate of the mouse's current position.
 */
 function coordinateDisplay(e: MouseEvent) {
    let cx = e.pageX - canvas.offsetLeft;
    let cy = e.pageY - canvas.offsetTop;

    zcoord.classList.remove('error');
    zcoord.textContent = `z = ${convPlanes(cx, cy)}`;
};
canvas.addEventListener('mousemove', coordinateDisplay);
canvas.addEventListener('click', e => {
    let cx = e.pageX - canvas.offsetLeft;
    let cy = e.pageY - canvas.offsetTop;

    let z = convPlanes(cx, cy);
    console.log(`z = ${z},\nf(z) = ${d(z)}`);
});


// Function input handlers:
input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-zA-Z0-9+\-*/^., ()]/g, '');
});
funcForm.addEventListener('submit', e => {
    e.preventDefault();
    graphButton.click();
});

// zoom in
zoomButtons[0].addEventListener('click', () => {
    zoom *= 2;
    graphButton.click();
});
// reset zoom
zoomButtons[1].addEventListener('click', () => {
    if (zoom !== 1) {
        zoom = 1;
        graphButton.click();
    }
});
// zoom out
zoomButtons[2].addEventListener('click', () => {
    zoom /= 2;
    graphButton.click();
});

// arbitrary zoom
zoomInput.addEventListener('input', () => {
    zoomInput.value = zoomInput.value.replace(/[^0-9.]/g, '');
    if (isNaN(+scaleInput.value)) zoomInput.value = "1";

    if ([...zoomInput.value].filter(x => x === '.').length > 1) {
        var ziArray = zoomInput.value.split('.');
        zoomInput.value = ziArray[0] + '.' + ziArray.slice(1).join('');
    }
});
zoomForm.addEventListener('submit', e => {
    e.preventDefault();
    if (zoom !== +zoomInput.value) {
    zoom = +zoomInput.value || 0;
    graphButton.click();
    }
});

// scale handler:
scaleInput.addEventListener('input', () => {
    if (isNaN(+scaleInput.value)) scaleInput.value = "" + defaultRadius;
    warning.style.display = +scaleInput.value > radiusThreshold ? 'inline' : 'none';
});
scaleForm.addEventListener('submit', e => {
    e.preventDefault();
    let size = +scaleInput.value * 2 + 1;
    if (canvas.width !== size) {
    canvas.width = canvas.height = size;
    graphButton.click();
    }
});

let resizeCheck: number | undefined;
window.addEventListener("resize", e => {
    if (typeof resizeCheck !== "undefined") clearTimeout(resizeCheck);

    let windowRadius = (document.documentElement.clientWidth - 1) / 2 - 8;

    defaultRadius = Math.min(windowRadius, radiusThreshold);
    scaleInput.value = "" + defaultRadius;

    // if resize is done then perform recompute
    resizeCheck = setTimeout(() => graphButton.click(), 100);
});

graphButton.addEventListener('click', async () => {
    if (!canNest) graphButton.disabled = true;

    zcoord.classList.remove('error');
    zoomInput.value = zoom.toString();

    let size = +scaleInput.value * 2 + 1;
    if (canvas.width !== size) canvas.width = canvas.height = size;
    [domain[0].textContent, domain[1].textContent] = defaultDomain.map(x => x.div(zoom).toString());
    zcoord.textContent = 'Graphing...'
    await waitPageUpdate();
    canvas.removeEventListener('mousemove', coordinateDisplay);

    let fstr = input.value;
    try {
        d = math.evaluate(`f(z) = ${fstr}`);
        startWorker(worker, fstr);
    } catch (e) {
        onComputeError(e as any);
        throw e;
    }
});

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
    //converts xy pixel plane to complex plane

    // let cmx =  (row - rx) / (rx / 2) / scale,
    //     cmy = -(col - ry) / (ry / 2) / scale;

    // row - rx: distance from center, in canvas pixels
    // / (rx / 2): normalizes that so the edge is 2
    // / scale: scale mult.

    let [rx, ry] = [(canvas.width - 1) / 2, (canvas.height - 1) / 2];
    let cmx =  (x - rx) / (rx / 2) / zoom,
        cmy = -(y - ry) / (ry / 2) / zoom;
    return math.complex(cmx, cmy) as unknown as Complex;
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
    if (!canNest) time =performance.now();

    let msg: MainIn = {
        action: "mainRequest",
        pev: partialEvaluate(fstr), 
        cd: {
        width: canvas.width,
        height: canvas.height,
        zoom
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

    canvas.removeEventListener('mousemove', coordinateDisplay);
    zcoord.classList.add('error');
    zcoord.textContent = String(err);
    reenableHover();
}

/**
 * Reenable interactability after an error
 * @param after how many ms before hover and interactibility should reenable
 */
function reenableHover(after = 500) {
    setTimeout(() => {
        canvas.addEventListener('mousemove', coordinateDisplay);
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