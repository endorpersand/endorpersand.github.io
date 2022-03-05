import { create, all } from "mathjs";
import { Complex, ComplexFunction, CanvasData } from "./types";
const math = create(all);

const canvas      = document.querySelector('canvas')!       as HTMLCanvasElement,
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
const ctx = canvas.getContext('2d', {alpha: false})!;
let scale = 1; // increase = zoom in, decrease = zoom out
let d: ComplexFunction = (z => z); // actual values of the function

let worker: Worker = new Worker(new URL("./worker/main", import.meta.url), {type: "module"});
worker.onmessage = function (e) {
    let [arr, t]: [Uint8ClampedArray, number] = e.data;
    let dat = new ImageData(arr, canvas.width, canvas.height);
    ctx.putImageData(dat, 0, 0);
    markDone(t);
}
worker.onerror = onComputeError;

var domaind = [math.complex('-2-2i'), math.complex('2+2i')] as [unknown, unknown] as [Complex, Complex];

function canvasHover(e: MouseEvent) {
    zcoord.classList.remove('error');
    zcoord.textContent = `z = ${convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop)}`;
};

canvas.addEventListener('mousemove', canvasHover);
canvas.addEventListener('click', e => {
    let cx = e.pageX - canvas.offsetLeft;
    let cy = e.pageY - canvas.offsetTop;

    let z = convPlanes(cx, cy);
    console.log(`z = ${z},\nf(z) = ${d(z)}`);
})
input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-zA-Z0-9+\-*/^., ()]/g, ''); //removes invalid characters
})
graphButton.addEventListener('click', () => {
    zcoord.classList.remove('error');
    zoomInput.value = scale.toString();

    let size = +scaleInput.value * 2 + 1;
    if (canvas.width !== size) canvas.width = canvas.height = size;
    [domain[0].textContent, domain[1].textContent] = domaind.map(x => x.div(scale).toString());
    zcoord.textContent = 'Graphing...'
    canvas.removeEventListener('mousemove', canvasHover);

    let fstr = input.value;
    try {
        d = math.evaluate(`f(z) = ${fstr}`);
        startWorker(worker, fstr);
    } catch (e) {
        onComputeError(e as any);
        throw e;
    }
});

zoomButtons[0].addEventListener('click', () => {
    scale *= 2;
    graphButton.click();
})
zoomButtons[1].addEventListener('click', () => {
    if (scale !== 1) {
        scale = 1;
        graphButton.click();
    }
})
zoomButtons[2].addEventListener('click', () => {
    scale /= 2;
    graphButton.click();
})
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
    if (scale !== +zoomInput.value) {
    scale = +zoomInput.value || 0;
    graphButton.click();
    }
})
scaleInput.addEventListener('input', () => {
    if (isNaN(+scaleInput.value)) scaleInput.value = "250";
    warning.style.display = +scaleInput.value > 250 ? 'inline' : 'none';
});
scaleForm.addEventListener('submit', e => {
    e.preventDefault();
    let size = +scaleInput.value * 2 + 1;
    if (canvas.width !== size) {
    canvas.width = canvas.height = size;
    graphButton.click();
    }
})
funcForm.addEventListener('submit', e => {
    e.preventDefault();
    graphButton.click();
})

function convPlanes(x: number, y: number) {
    //converts xy pixel plane to complex plane

    // let cmx =  (row - rx) / (rx / 2) / scale,
    //     cmy = -(col - ry) / (ry / 2) / scale;

    // row - rx: distance from center, in canvas pixels
    // / (rx / 2): normalizes that so the edge is 2
    // / scale: scale mult.

    let [rx, ry] = [(canvas.width - 1) / 2, (canvas.height - 1) / 2];
    let cmx =  (x - rx) / (rx / 2) / scale,
        cmy = -(y - ry) / (ry / 2) / scale;
    return math.complex(cmx, cmy) as unknown as Complex;
}

function startWorker(w: Worker, fstr: string) {
    let msg: [string, CanvasData] = [fstr, {
        width: canvas.width,
        height: canvas.height,
        scale
    }];
    w.postMessage(msg);
}

function markDone(t: number) {
    zcoord.textContent = `Done in ${t}ms.`;
    reenableHover();
}

function onComputeError(e: Error | ErrorEvent) {
    let err = e instanceof ErrorEvent ? e.message : e;

    canvas.removeEventListener('mousemove', canvasHover);
    zcoord.classList.add('error');
    zcoord.textContent = String(err);
    reenableHover();
}

function reenableHover() {
    setTimeout(() => canvas.addEventListener('mousemove', canvasHover), 500);
}

graphButton.click();
