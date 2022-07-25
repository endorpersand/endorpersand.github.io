import { create, all, number } from "mathjs";
import { Complex, ComplexFunction, InitIn, InitOut, LoaderOut, MainIn, MainOut, PartialEvaluator } from "./types";
import * as evaluator from "./evaluator";
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
    setProperty(canvas, "width",  Math.trunc(width));
    setProperty(canvas, "height", Math.trunc(height));
    ctx.globalCompositeOperation = "copy";

    updateDomain();
}
updateCanvasDims();

const bufCanvas = document.createElement("canvas");
const bctx = bufCanvas.getContext('2d', {alpha: false})!;

namespace Buffer {
    const bufProps = {
        refs: 0,
        mat: math.identity(3) as math.Matrix,
    };

    /**
     * Obtain a reference to the buffer.
     * If this is the first reference, then the canvas is also copied into the buffer.
     */
    export function prepare() {
        if (!bufProps.refs) {
            bufCanvas.width = canvas.width;
            bufCanvas.height = canvas.height;
            bctx.globalCompositeOperation = "copy";
            bctx.imageSmoothingEnabled = false;
            bctx.drawImage(canvas, 0, 0);

            bufProps.mat = math.identity(3) as any;
        }
        bufProps.refs++;
    }

    /**
     * Let go of the reference to the buffer.
     */
    export function release() {
        bufProps.refs = Math.max(bufProps.refs - 1, 0);
    }

    /**
     * Obtain a reference to the buffer, do something with it, then release the reference.
     * @param f Actions to do. 
     * This callback includes an `owner` parameter that specifies 
     * if this was the first reference to the buffer.
     * @param drawIfOwner If the borrower is actually the owner, should the buffer be drawn?
     */
    export function borrow(f: (owner: boolean) => any, drawIfOwner: boolean = true) {
        const owner = bufProps.refs === 0;

        prepare();
        f(owner);
        if (drawIfOwner && owner) draw();
        release();
    }

    /**
     * Draw the buffer onto the main canvas.
     */
    export function draw() {
        if (bufProps.refs) {
            const { mat } = bufProps;

            abortGraph();
            ctx.setTransform(
                mat.get([0, 0]),
                mat.get([1, 0]),
                mat.get([0, 1]),
                mat.get([1, 1]),
                mat.get([0, 2]),
                mat.get([1, 2]),
            )
            ctx.drawImage(bufCanvas, 0, 0);
            ctx.resetTransform();
        }
    }

    /**
     * Add a translation to the buffer.
     * @param dx 
     * @param dy 
     */
    export function translate(dx: number, dy: number) {
        bufProps.mat = math.multiply(
            math.matrix([
                [1, 0, dx],
                [0, 1, dy],
                [0, 0,  1],
            ]),
            bufProps.mat
        );
    }

    /**
     * Add a scale to the buffer.
     * @param scale 
     * @param center Center to scale around
     */
    export function scaleAround(scale: number, center?: [number, number]) {
        const [dx, dy] = center ?? [(canvas.width - 1) / 2, (canvas.height - 1) / 2];

        bufProps.mat = math.chain(
            math.matrix([
                [1, 0, dx],
                [0, 1, dy],
                [0, 0,  1],
            ]),
        ).multiply(
            math.matrix([
                [1 / scale,         0, 0],
                [        0, 1 / scale, 0],
                [        0,         0, 1],
            ]),
        ).multiply(
            math.matrix([
                [1, 0, -dx],
                [0, 1, -dy],
                [0, 0,   1],
            ]),
        ).multiply(
            bufProps.mat
        ).done();
    }
}

let center = Complex.ZERO;

function setCenter(c: Complex, bufSettings?: { updateBuffer: boolean }) {
    if (bufSettings?.updateBuffer ?? true) Buffer.borrow(() => {
        // If the center moves from (a + bi) to (0, 0), the image shifted right.
        // So, actually you need to translate the buffer (a + bi).

        const dz = center.sub(c);
        const displace = Convert.toCanvasDisplace(dz);
        Buffer.translate(...displace);
    });
    center = c;

    centerInputs[0].value = `${c.re}`;
    centerInputs[1].value = `${c.im}`;
    setHiddenState(recenterButton, c.equals(0, 0));
    setHiddenState(homeButton, c.equals(0, 0) && scale === 2);
    
    updateDomain();
}

{
    document.querySelectorAll<HTMLFormElement>("#center-controls form").forEach(f => {
        f.addEventListener("submit", e => {
            const re = +centerInputs[0].value;
            const im = +centerInputs[1].value;
            const z = Complex(re, im);

            setCenter(z);
        });
    });
    recenterButton.addEventListener("click", e => {
        setCenter(Complex.ZERO);
    });
}

/**
 * Identifier designating the current graph.
 * This is a cyclic value, ranging the entire 32-bit range.
 */
let graphID = 0;

/**
 * The scale of the graph represents the distance (in complex units) 
 * from the center of the screen to the top.
 */
let scale = 2;

function setScale(n: number, bufSettings?: { updateBuffer: boolean }) {
    n = Math.max(n, 0);
    if (bufSettings?.updateBuffer ?? true) Buffer.borrow(() => {
        const scaleRatio = n / scale;
        Buffer.scaleAround(scaleRatio);
    });
    scale = n;

    zoomInput.value = `${2 / scale}`;
    zoomInput.style.width = `${zoomInput.value.length}ch`;

    zoomButtons[1].disabled = scale === 2;
    
    setHiddenState(homeButton, center.equals(0, 0) && scale === 2);
    updateDomain();
}

function addZoom(mouseX: number, mouseY: number, deltaY: number) {
    // negative = zoom out
    // positive = zoom in

    const factor = 2 ** (deltaY * 0.005);

    const mousePos = Convert.toComplex(mouseX, mouseY);
    
    // in the scaling, the mousePos stays in the same position, 
    // but the distance from the center scales
    const disp = mousePos.sub(center);
    
    Buffer.borrow(() => {
        setCenter(mousePos.sub(disp.mul(factor)));
        setScale(scale * factor);
    });
    
}

{
    const [zoomIn, zoomReset, zoomOut] = zoomButtons;

    zoomIn.addEventListener('click',    () => setScale(scale / 2));
    zoomReset.addEventListener('click', () => setScale(2));
    zoomOut.addEventListener('click',   () => setScale(scale * 2));
}

homeButton.addEventListener("click", () => {
    Buffer.borrow(() => {
        setCenter(Complex.ZERO);
        setScale(2);
    });
});

function xyScale() {
    return [
        scale * canvas.width / canvas.height,
        scale,
    ] as const;
}
function updateDomain() {
    const limitDomain = !!+getComputedStyle(document.documentElement)
        .getPropertyValue("--limit-domain");
    
    const [scaleX, scaleY] = xyScale();

    const range = Complex(scaleX, scaleY);

    const cmL = center.sub(range);
    const cmR = center.add(range);

    if (!limitDomain) {
        domain[0].textContent = `${cmL}`;
        domain[1].textContent = `${cmR}`;
    } else {
        let { re: lre, im: lim } = cmL;
        let { re: rre, im: rim } = cmR;
        
        const lsign = Math.sign(lim) === -1 ? "-" : "+";
        const rsign = Math.sign(lim) === -1 ? "-" : "+";

        const lreStr = reduceNumber(lre);
        const rreStr = reduceNumber(rre);
        const limStr = reduceNumber(Math.abs(lim));
        const rimStr = reduceNumber(Math.abs(rim));

        domain[0].textContent = `${lreStr} ${lsign} ${limStr}i`;
        domain[1].textContent = `${rreStr} ${rsign} ${rimStr}i`;
    }
}

function reduceNumber(n: number) {
    const s1 = n.toPrecision();
    const s2 = n.toPrecision(5);

    if (s1.length <= s2.length) return s1;
    return s2;
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

    worker.onmessage = function (e: MessageEvent<MainOut>) {
        let msg: MainOut = e.data;
        if (msg.graphID !== graphID) return;
    
        if (msg.action === "chunkDone") {
            displayChunk(msg);
        } else if (msg.action === "done") {
            markDone(msg.time);
        } else {
            let _: never = msg;
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

    return Convert.toComplex(x, y);
}

{
    let holds = new Map<number, {
        initX: number,
        initY: number,
        lastX: number,
        lastY: number
    }>();
    
    canvas.addEventListener('pointerdown', e => {
        console.log("pointerdown", e.pointerId);

        let initX, initY, lastX, lastY;
        lastX = initX = e.clientX;
        lastY = initY = e.clientY;
        holds.set(e.pointerId, {initX, initY, lastX, lastY});

        Buffer.prepare();
    });

    function pointerup(e: PointerEvent) {
        const pos = holds.get(e.pointerId);

        if (holds.delete(e.pointerId)) {
            Buffer.release();
        }

        if (holds.size === 0 && pos) {
            // if any displacement occurred, then redraw
            const [dx, dy] = [
                e.clientX - pos.initX,
                e.clientY - pos.initY
            ]
    
            if (dx !== 0 || dy !== 0) graph();
        }
    }

    document.addEventListener('pointerup', pointerup);
    document.addEventListener('pointercancel', pointerup);

    function distance(pts: (readonly [x: number, y: number])[]): [center: readonly [x: number, y: number], dist: number] {
        const length = pts.length;
        const [scx, scy] = pts.reduce(([ax, ay], [cx, cy]) => [ax + cx, ay + cy] as const);
        
        const center = [scx / length, scy / length] as const;
        const [cx, cy] = center;

        const distances = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
        const totalDistance = distances.reduce((acc, cv) => acc + cv);

        return [center, totalDistance];
    }

    document.addEventListener('pointermove', e => {
        console.log("pointermove", e.pointerId);
        
        const pos = holds.get(e.pointerId);
        if (pos) {
            if (holds.size === 1) {
                const [dx, dy] = [
                    e.clientX - pos.lastX,
                    e.clientY - pos.lastY
                ]
    
                const dz = Convert.toComplexDisplace(dx, dy);
                setCenter(center.sub(dz));
                Buffer.draw();
    
                pos.lastX = e.clientX;
                pos.lastY = e.clientY;
            } else {
                let positions = Array.from(holds.values(), ({lastX, lastY}) => [lastX, lastY] as const);
                const [_, d1] = distance(positions);

                pos.lastX = e.clientX;
                pos.lastY = e.clientY;

                positions = Array.from(holds.values(), ({lastX, lastY}) => [lastX, lastY] as const);
                const [c, d2] = distance(positions);

                addZoom(...c, d1 - d2);
                Buffer.draw();
            }
        }
    });
}

{
    let timeout: NodeJS.Timeout;
    let started = false;

    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        clearTimeout(timeout);

        if (!started) {
            started = true;
            // wheel start

            Buffer.prepare();
        }
        

        // wheel move
        if (e.ctrlKey) {
            addZoom(e.clientX, e.clientY, e.deltaY);
            Buffer.draw();
        } else {
            const dx = e.deltaX * .5;
            const dy = e.deltaY * .5;

            const dz = Convert.toComplexDisplace(dx, dy);
            setCenter(center.sub(dz));
            Buffer.draw();
        }
        
        coordinateDisplay(e);

        timeout = setTimeout(() => {
            // wheel end
            graph();
            Buffer.release();
            started = false;
        }, 500);
    }, false);
}

/**
 * Event listener that displays the complex coordinate of the mouse's current position.
 */
async function coordinateDisplay(...args: Parameters<typeof fromMousePosition>) {
    const pos = fromMousePosition(...args);

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

    graphStatus.classList.remove("hidden", "error", "done");
    graphStatus.textContent = 'Graphing...'

    await updateCanvasDims();
    await waitPageUpdate();
    
    let fstr = funcInput.value;
    try {
        const eva = evaluator.compile(fstr);
        if (eva.type === "function") d = eva.f;
        else d = () => eva.f;

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

namespace Convert {
    /**
     * Converts a canvas position to a complex position
     * @param x x (in canvas pixels)
     * @param y y (in canvas pixels)
     * @returns the complex position
     */
    export function toComplex(x: number, y: number) {
        const [canvasCenterX, canvasCenterY] = [
            (canvas.width  - 1) / 2,
            (canvas.height - 1) / 2
        ];

        const dz = toComplexDisplace(
            x - canvasCenterX,
            y - canvasCenterY
        );
        return center.add(dz);
    }

    /**
     * Converts canvas displacement to complex displacement
     * @param dx change in x (in canvas pixels)
     * @param dy change in y (in canvas pixels)
     * @returns complex displacement
     */
    export function toComplexDisplace(dx: number, dy: number) {
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
     * Converts a complex position to a canvas position
     * @param z the complex position
     * @returns the canvas position
     */
    export function toCanvas(z: Complex): [x: number, y: number] {
        const [canvasCenterX, canvasCenterY] = [
            (canvas.width  - 1) / 2,
            (canvas.height - 1) / 2
        ];

        const dz = z.sub(center);
        const [dx, dy] = toCanvasDisplace(dz);

        return [canvasCenterX + dx, canvasCenterY + dy];
    }

    /**
     * Converts complex displacement to canvas displacement
     * @param dz complex displacement
     * @returns canvas displacement
     */
    export function toCanvasDisplace(dz: Complex): [dx: number, dy: number] {
        const { width, height } = canvas;
        const [scaleX, scaleY] = xyScale();
    
        // 1 unit of scale
        const [unitX, unitY] = [
             (width  - 1) / 2,
            -(height - 1) / 2
        ];

        return [dz.re * unitX / scaleX, dz.im * unitY / scaleY];
    }
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
    graphID++;
    graphID |= 0;
    
    let msg: MainIn = {
        action: "mainRequest",
        pev: partialEvaluate(fstr), 
        cd: {
            width: canvas.width,
            height: canvas.height,
            center: [center.re, center.im],
            scale,
        },
        graphID
    };
    w.postMessage(msg);
}

function abortGraph() {
    graphID++;
    graphID |= 0;
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
async function markDone(t: number) {
    graphStatus.textContent = `Done in ${t}ms.`;
    graphStatus.classList.add("done");
    
    await waitPageUpdate();
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
    setTimeout(() => {
        if (graphStatus.classList.contains("done")) {
            graphStatus.classList.remove("done");
            graphStatus.classList.add("hidden");
        }
    }, after);
}

function setProperty<P extends string | number | symbol, V>(o: {[I in P]: V}, p: P, v: V) {
    if (o[p] !== v) o[p] = v;
}

function setHiddenState(b: HTMLElement, status: boolean) {
    b.classList.toggle("hidden", status);
    if (b instanceof HTMLButtonElement) b.disabled = status;
}