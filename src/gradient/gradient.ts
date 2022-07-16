declare var OffscreenCanvas: any;

type IpolType = "lin" | "rms";

const linCanvas = document.querySelector<HTMLCanvasElement>('#lin-result canvas')!;
const lctx = linCanvas.getContext('2d', {alpha: false})!;
const rmsCanvas = document.querySelector<HTMLCanvasElement>('#rms-result canvas')!;
const rctx = rmsCanvas.getContext('2d', {alpha: false})!;
const cssCanvas = document.querySelector<HTMLDivElement>("#css-result div#css-gradient")!;

const coloradd = document.querySelector<HTMLButtonElement>('button#coloradd')!;
const colorsWrapper = document.querySelector<HTMLDivElement>('div#colors')!;
type RGB = [r: number, g: number, b: number];

updateAll();
document.querySelectorAll('input[type=color]').forEach(x => x.addEventListener('change', updateAll));

function addColorInput(update = true) {
    let div = makeColorDiv();
    colorsWrapper.insertBefore(div, coloradd);

    let buts = colorRMButtons();
    if (buts.length > 2) {
        for (let b of buts) {
            b.disabled = false;
        }
    }
    if (update) updateAll();
    return div;
}
coloradd.addEventListener('click', () => {
    addColorInput(true);
})

document.querySelectorAll('.colorrm').forEach(e => e.addEventListener('click', () => {
    colorsWrapper.removeChild(e.parentElement!);
    let buts = colorRMButtons();
    if (buts.length < 3) {
        for (let b of buts) b.disabled = true;
    }
    updateAll();
}))

/**
 * @returns the input colors as hex strings
 */
function getColors() {
    let cinputs =  document.querySelectorAll<HTMLInputElement>('input[type=color]');
    return Array.from(cinputs, e => e.value);
}

/**
 * Takes a hex string and converts it into an RGB array
 * @param hex hex string
 * @returns RGB array
 */
function rgb(hex: string): RGB {
    return [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)].map(x => parseInt(x, 16)) as RGB;
}

/**
 * @returns every color input <div>
 */
 function colorInput() {
    return colorsWrapper.querySelectorAll('div');
}
/**
 * @returns every color "remove" button
 */
function colorRMButtons() {
    return document.querySelectorAll<HTMLButtonElement>('button.colorrm');
}

/**
 * Creates a color input div
 * @param hex Initial color of the div
 * @returns the div
 */
function makeColorDiv(hex = '#000000') {
    let div = document.createElement('div');

    let clr = document.createElement('input');
    clr.type = 'color';
    clr.value = hex;
    clr.addEventListener('change', updateAll);

    let button = document.createElement('button');
    button.classList.add('colorrm');
    button.textContent = 'x';
    button.addEventListener('click', () => {
        colorsWrapper.removeChild(div);

        let buts = colorRMButtons();
        if (buts.length < 3) {
            for (let b of buts) {
                b.disabled = true;
            }
        }

        updateAll();
    });
        
    div.append(clr, button);
    return div;
}

/**
 * Interpolates from one number to another using root-mean-square (the end points are squared, averaged, then the mean is rooted).
 * @param a endpoint
 * @param b endpoint
 * @param prog [0, 1)
 * @returns interpolated value
 */
function rmsInterpolate(a: number, b: number, prog: number) {
    return Math.hypot(a * Math.sqrt(1 - prog), b * Math.sqrt(prog));
}

/**
 * Update all result canvases
 */
function updateAll() {
    const clrs = getColors();

    cssCanvas.style.background = `linear-gradient(0.25turn, ${clrs.join(", ")})`;
    updateCanvas(lctx, "lin", clrs);
    updateCanvas(rctx, "rms", clrs);
}

/**
 * Update a canvas using a specified interpolation type and array of colors
 * @param ctx the canvas's rendering context
 * @param ipol interpolation type
 * @param clrs array of colors to update the canvas with
 */
function updateCanvas(ctx: CanvasRenderingContext2D, ipol: IpolType, clrs: string[]) {
    const lastIndex = clrs.length - 1;
    const canvas = ctx.canvas;

    if (ipol === "lin") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);

        for (var [i, c] of clrs.entries()) {
            grad.addColorStop(i / lastIndex, c);
        }
        ctx.fillStyle = grad;
    } else if (ipol === "rms") {
        let ocanvas: HTMLCanvasElement;
        if ("OffscreenCanvas" in globalThis) {
            ocanvas = new OffscreenCanvas(canvas.width, 1);
        } else {
            ocanvas = document.createElement('canvas');
            [ocanvas.width, ocanvas.height] = [canvas.width, 1];
        }
        const octx = ocanvas.getContext('2d')!;
    
        const dat = octx.createImageData(ocanvas.width, 1);
        const arr32 = new Uint32Array(dat.data.buffer);
        const arr32LastIndex = arr32.length - 1;
        for (var i = 0; i < arr32.length; i++) {
            const pos = (i / arr32LastIndex) * lastIndex;
            const [j, prog] = [Math.floor(pos), pos % 1];
            const [a, b] = [clrs[j], clrs[j + 1] ?? '#000000'].map(x => rgb(x));
            const c = Array.from({length: 3}, (_, i) => rmsInterpolate(a[i], b[i], prog));
            arr32[i] = 0xFF << 24
                     | c[2] << 16
                     | c[1] <<  8
                     | c[0] <<  0;
        }
        octx.putImageData(dat, 0, 0);
        const pat = ctx.createPattern(ocanvas, 'repeat-y')!;
        ctx.fillStyle = pat;
    } else {
        let _: never = ipol;
    }

    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

declare global {
    interface Window {
        setColors(...clrs: string[]): void;
        gay(): void;
    }
}

function setColors(...clrs: string[]) {
    let inputs = [...colorInput()];

    if (clrs.length < 2) throw new Error("Two colors are required for a gradient");

    while (clrs.length < inputs.length) {
        inputs.pop()?.remove();
    }
    while (inputs.length < clrs.length) {
        inputs.push(addColorInput(false));
    }

    inputs.forEach((div, i) => {
        const input = div.querySelector<HTMLInputElement>("input[type=color]")!;
        const clr = clrs[i];

        input.value = clr;
    });

    updateAll();
}
window.setColors = setColors;

function gay() {
    setColors(
        "#FF0000",
        "#FFFF00",
        "#00FF00",
        "#00FFFF",
        "#0000FF",
        "#FF00FF",
        "#FF0000"
    );
}
window.gay = gay;

export {};