import { create, all } from "mathjs";
import { Complex, ComplexFunction, InitIn, InitOut, LoaderOut, MainIn, MainOut, PartialEvaluator } from "./types";
const math = create(all);

const wrapper        = document.querySelector<HTMLDivElement>('div#wrapper')!,
      controls       = document.querySelector<HTMLDivElement>('div#controls')!,
      funcInput      = document.querySelector<HTMLInputElement>('input#func-input')!,
      graphButton    = document.querySelector<HTMLButtonElement>('#graph-button')!,
      graphStatus    = document.querySelector<HTMLDivElement>('div#graph-status')!,
      zWrapperItems  = document.querySelectorAll<HTMLElement>('div#z-wrapper code')!,
      zoomButtons    = document.querySelectorAll<HTMLButtonElement>('button.zoom'),
      zoomInput      = document.querySelector<HTMLInputElement>('input#zoom-input')!,
      centerInputs   = document.querySelectorAll<HTMLInputElement>("input.center-input"),
      recenterButton = document.querySelector<HTMLButtonElement>("button#recenter-button")!,
      homeButton     = document.querySelector<HTMLButtonElement>("button#home-button")!,
      domain         = document.querySelectorAll<HTMLElement>('.domain');

const canvas = document.createElement("canvas");
const ctx = canvas.getContext('2d', {alpha: false})!;

wrapper.appendChild(canvas);

async function updateCanvasDims() {
    await waitPageUpdate();
    const { width, height } = canvas.getBoundingClientRect();
    setProperty(canvas, "width", width);
    setProperty(canvas, "height", height);
    ctx.globalCompositeOperation = "copy";

    updateDomain();
}
updateCanvasDims();

let center = Complex.ZERO;

function setCenter(c: Complex) {
    center = c;

    centerInputs[0].value = `${c.re}`;
    centerInputs[1].value = `${c.im}`;
    recenterButton.classList.toggle("hidden", c.equals(0, 0));
    homeButton.classList.toggle("hidden", c.equals(0, 0) && scale === 2);
}
{
    document.querySelectorAll<HTMLFormElement>("#center-controls form").forEach(f => {
        f.addEventListener("submit", e => {
            const re = +centerInputs[0].value;
            const im = +centerInputs[1].value;
            setCenter(Complex(re, im));
        });
    });
    recenterButton.addEventListener("click", e => {
        setCenter(Complex.ZERO);
    });
}

/**
 * The scale of the graph represents the distance (in complex units) 
 * from the center of the screen to the top.
 */
let scale = 2;

function setScale(n: number, render = true) {
    cancelWorker();
    n = Math.max(n, 0);
    const scaleRatio = n / scale;

    scale = n;
    
    // dirty zoom
    if (render) renderDirtyZoom(scaleRatio);

    zoomInput.value = `${2 / scale}`;
    zoomInput.style.width = `${zoomInput.value.length}ch`;

    zoomButtons[1].disabled = scale === 2;
    homeButton.classList.toggle("hidden", center.equals(0, 0) && scale === 2);
}

/**
 * Create a rough zoom to display before regraphing.
 * @param scaleRatio Ratio of new scale to old scale
 *    < 1 is zoom in
 *    > 1 is zoom out
 * @param zoomCenter Center to zoom around
 */
function renderDirtyZoom(scaleRatio: number, zoomCenter?: [x: number, y: number]) {
    const {width, height} = canvas;
    const [zcX, zcY] = zoomCenter ?? [(width - 1) / 2, (height - 1) / 2];

    if (scaleRatio < 1) { // ZOOM IN
        // The top left position of the source.
        
        // The source canvas' dims are scaled down by scaleRatio.
        // All distances are scaled by scaleRatio.
        const [sx, sy] = [
            zcX - zcX * scaleRatio, 
            zcY - zcY * scaleRatio,
        ];

        ctx.drawImage(
            canvas, 

            sx, sy,
            width * scaleRatio, height * scaleRatio,

            0, 0,
            width, height,
        );
    } else if (scaleRatio > 1) { // ZOOM OUT
        // The top left position of the destination.
        const [dx, dy] = [
            zcX - zcX / scaleRatio, 
            zcY - zcY / scaleRatio,
        ];

        ctx.drawImage(
            canvas, 

            0, 0,
            width, height,

            dx, dy,
            width / scaleRatio, height / scaleRatio,
        );
    }
}

function addZoom(mouseX: number, mouseY: number, deltaY: number) {
    // negative = zoom out
    // positive = zoom in

    const factor = 2 ** (deltaY * 0.005);
    renderDirtyZoom(factor, [mouseX, mouseY]);

    const mousePos = convPlanes(mouseX, mouseY);
    // keep the mousePos stable, but the distance from the original center needs to scale
    const disp = mousePos.sub(center);
    
    setCenter(mousePos.sub(disp.mul(factor)));
    return setScale(scale * factor, false);

}

{
    const [zoomIn, zoomReset, zoomOut] = zoomButtons;

    zoomIn.addEventListener('click',    () => setScale(scale / 2));
    zoomReset.addEventListener('click', () => setScale(2));
    zoomOut.addEventListener('click',   () => setScale(scale * 2));
}

homeButton.addEventListener("click", () => {
    setCenter(Complex.ZERO);
    setScale(2, false);
});

let running = true;

function xyScale() {
    return [
        scale * canvas.width / canvas.height,
        scale,
    ] as const;
}
function updateDomain() {
    const [scaleX, scaleY] = xyScale();

    const range = Complex(scaleX, scaleY);

    const cmL = center.sub(range);
    const cmR = center.add(range);

    // update domain display
    domain[0].textContent = `${cmL}`;
    domain[1].textContent = `${cmR}`;
}

/**
 * Function that takes the input complex value to the output one.
 * This is used in the z-coord display.
 * @param z input
 * @returns output
 */
let d: ComplexFunction | undefined = (z => z);

let worker: Worker;
let canNest: boolean;
let time: number; // only used in fallback

/**
 * On WebKit (iOS), nested Workers are not supported. So this worker tests if they are supported.
 * The result is then used to determine whether or not to use the full main worker or a fallback.
 */
let webkitTest = new Worker(new URL("./worker/webkitTest", import.meta.url), {type: "module"});
webkitTest.postMessage(undefined);
webkitTest.onmessage = async function (e: MessageEvent<boolean>) {
    graphStatus.textContent = "Initializing workers...";
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
    webkitTest.terminate();

    document.querySelectorAll(".initializing").forEach(e => e.classList.remove("initializing"));
    graph(); // Don't need to await it. We just want it to happen eventually.
}

/**
 * Calculate complex coordinates from the current mouse position
 */
function fromMousePosition({pageX, pageY}: {pageX: number, pageY: number}) {
    const x = pageX - canvas.offsetLeft;
    const y = pageY - canvas.offsetTop;

    const { width, height } = canvas.getBoundingClientRect();
    if ( x < 0 || x >= width  ) return;
    if ( y < 0 || y >= height ) return;

    return convPlanes(x, y);
}

{
    let hold = false;
    let initX = 0, initY = 0;
    let lastX = 0, lastY = 0;
    const holdCanvas = document.createElement("canvas");
    const hctx = holdCanvas.getContext("2d", {alpha: false})!;

    canvas.addEventListener('mousedown', e => {
        hold = true;
        lastX = initX = e.clientX;
        lastY = initY = e.clientY;

        holdCanvas.width = canvas.width;
        holdCanvas.height = canvas.height;
        hctx.globalCompositeOperation = "copy";
        hctx.drawImage(canvas, 0, 0);

    });

    document.addEventListener('mouseup', e => {
        if (hold) {
            hold = false;
        
            // if any displacement occurred, then redraw
            const [dx, dy] = [
                e.clientX - initX,
                e.clientY - initY
            ]
            if (dx !== 0 || dy !== 0) graph();
        }
    });

    document.addEventListener('mousemove', e => {
        if (hold) {
            cancelWorker();
            ctx.drawImage(holdCanvas, e.clientX - initX, e.clientY - initY);
            
            const [dx, dy] = [
                e.clientX - lastX,
                e.clientY - lastY
            ]
            setCenter(center.sub(convDisplace(dx, dy)));

            lastX = e.clientX;
            lastY = e.clientY;

            updateDomain();
        }
    });
}

{
    let timeout: NodeJS.Timeout;

    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        cancelWorker();
        clearTimeout(timeout);

        if (e.ctrlKey) {
            addZoom(e.clientX, e.clientY, e.deltaY);
        }
        
        timeout = setTimeout(() => {
            graph();
        }, 500);
    }, false);
}

/**
 * Event listener that displays the complex coordinate of the mouse's current position.
 */
async function coordinateDisplay(e: MouseEvent) {
    const pos = fromMousePosition(e);

    if (typeof pos !== "undefined") {
        const [zElem, fzElem] = zWrapperItems;
        
        zElem.textContent  = `${pos}`;
        fzElem.textContent = `${d?.(pos) ?? "?"}`;
    }
};
canvas.addEventListener('mousemove', coordinateDisplay);
controls.addEventListener('mousemove', coordinateDisplay);
document.addEventListener("click", coordinateDisplay);

// Function input handlers:
// funcInput.addEventListener('input', () => {
//     funcInput.value = funcInput.value.replace(/[^a-zA-Z0-9+\-*/^., ()!]/g, '');
// });

let resizeCheck: NodeJS.Timer | undefined;
window.addEventListener("resize", e => {
    if (typeof resizeCheck !== "undefined") clearTimeout(resizeCheck);
    // if resize is done then perform recompute
    resizeCheck = setTimeout(async () => await graph(), 200);
});

document.querySelector<HTMLFormElement>("form#zoom-form")!.addEventListener("submit", () => {
    if (zoomInput.checkValidity()) setScale(2 / +zoomInput.value);
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
    if (graphButton.disabled) return;
    if (!canNest) graphButton.disabled = true;

    graphStatus.classList.remove("hidden", "error");
    graphStatus.textContent = 'Graphing...'

    await updateCanvasDims();
    await waitPageUpdate();

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
    // center point:
    const [canvasCenterX, canvasCenterY] = [
        (canvas.width  - 1) / 2,
        (canvas.height - 1) / 2
    ];

    return center.add(convDisplace(
        x - canvasCenterX,
        y - canvasCenterY
    ));
}

/**
 * Scale a change in displacement in canvas
 * @param dx pixels moved in the x-direction
 * @param dy pixels moved in the y-direction
 * @returns complex displacement
 */
function convDisplace(dx: number, dy: number) {
    const { width, height } = canvas;
    const [scaleX, scaleY] = xyScale();

    // 1 unit of scale
    const [unitX, unitY] = [
         (width  - 1) / 2,
        -(height - 1) / 2
    ];

    return Complex(dx * scaleX / unitX, dy * scaleY / unitY);
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

    running = true;
    let msg: MainIn = {
        action: "mainRequest",
        pev: partialEvaluate(fstr), 
        cd: {
            width: canvas.width,
            height: canvas.height,
            center: [center.re, center.im],
            scale
        }
    };
    w.postMessage(msg);
}

function cancelWorker() {
    running = false;
    worker.postMessage({action: "cancel"});
}

/**
 * Update the canvas with the loaded chunk
 * @param data the data from the worker
 */
 function displayChunk(data: LoaderOut) {
    if (!running) return;
    let {chunk, buf} = data;

    let dat = new ImageData(new Uint8ClampedArray(buf), chunk.width, chunk.height);
    ctx.putImageData(dat, chunk.offx, chunk.offy);
}

/**
 * Take a string and evaluate it for speed. Simplify the string and also apply the reciprocal optimization.
 * This partial evaluation can then be fully evaluated in the workers.
 * @param fstr string to partially evaluate
 * @returns partially evaluated string
 */
function partialEvaluate(fstr: string): PartialEvaluator {
    let node = math.simplify(fstr);

    let inverse = false;
    if (node.type == "OperatorNode" && node.fn == 'divide' && !isNaN(+node.args[0])) { // reciprocal func
        node.args.reverse();
        node = math.simplify(node);
        inverse = true;
    }

    return { fstr: node.toString(), inverse };
}

/**
 * Display a done message with how long it took to complete
 * @param t time (in ms) it took for the operation to complete
 */
function markDone(t: number) {
    graphStatus.textContent = `Done in ${t}ms.`;
    clearStatusAfter();
}

/**
 * Handle errors in computation
 * @param e the error
 */
function onComputeError(e: Error | ErrorEvent) {
    let err = e instanceof ErrorEvent ? e.message : e;

    graphStatus.classList.add('error');
    graphStatus.textContent = String(err);
}

/**
 * Reset the status after a while.
 * @param after how many ms before status should be cleared.
 */
function clearStatusAfter(after = 1000) {
    if (!canNest) graphButton.disabled = false;
    setTimeout(() => graphStatus.classList.add("hidden"), after);
}

function setProperty<P extends string | number | symbol, V>(o: {[I in P]: V}, p: P, v: V) {
    if (o[p] !== v) o[p] = v;
}