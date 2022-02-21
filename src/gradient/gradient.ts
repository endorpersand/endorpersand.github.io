const canvas = document.querySelector('canvas')! as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let ipol = 'lin';

let ipolRadios = document.querySelectorAll('input[type=radio]'),
    coloradd = document.querySelector('#coloradd')! as HTMLButtonElement,
    colorsWrapper = document.querySelector('#colors')! as HTMLDivElement;

type RGB = [number, number, number];

document.querySelectorAll('input[type=color]').forEach(x => x.addEventListener('change', update))
ipolRadios.forEach(x => x.addEventListener('change', e => {
    ipol = (x as HTMLInputElement).value;
    update();
}));

coloradd.addEventListener('click', () => {
    let div = colorDiv();
    colorsWrapper.insertBefore(div, coloradd);

    let buts = colorRMButtons();
    if (buts.length > 2) {
        for (let b of buts) {
            b.disabled = false;
        }
    }
    update();
})

document.querySelectorAll('.colorrm').forEach(e => e.addEventListener('click', () => {
    colorsWrapper.removeChild(e.parentElement!);
    let buts = colorRMButtons();
    if (buts.length < 3) {
        for (let b of buts) b.disabled = true;
    }
    update();
}))
update();

function getColors() {
    let cinputs =  document.querySelectorAll('input[type=color]');
    return [...cinputs].map(x => (x as HTMLInputElement).value);
}

function rgb(hex: string): RGB {
    return [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)].map(x => parseInt(x, 16)) as RGB;
}

function colorRMButtons() {
    return document.querySelectorAll('.colorrm') as NodeListOf<HTMLButtonElement>;
}

function interpolate(a: number, b: number, prog: number) {
    return Math.hypot(a * Math.sqrt(1 - prog), b * Math.sqrt(prog));
}
function colorDiv(hex = '#000000') {
    let div = document.createElement('div');

    let clr = document.createElement('input');
    clr.type = 'color';
    clr.value = hex;
    clr.addEventListener('change', update);

    let button = document.createElement('button');
    button.classList.add('colorrm');
    button.textContent = 'x';
    button.addEventListener('click', () => {
        colorsWrapper.removeChild(button.parentElement!);
        let buts = colorRMButtons();
        if (buts.length < 3) {
            for (let b of buts) b.disabled = true;
        }
        update();
    });
        
    div.appendChild(clr);
    div.appendChild(button);
    return div;
}

function update() {
    let clrs = getColors();
    let lind = clrs.length - 1;
    switch (ipol) {
        case 'lin':
            let grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
            for (var [i, c] of clrs.entries()) grad.addColorStop(i / lind, c);
            ctx.fillStyle = grad;
            break;
        case 'rms':
            let ocanvas: HTMLCanvasElement;
            if ("OffscreenCanvas" in globalThis) {
                ocanvas = new OffscreenCanvas(canvas.width, 1);
            } else {
                ocanvas = document.createElement('canvas');
                [ocanvas.width, ocanvas.height] = [canvas.width, 1];
            }
            let octx = ocanvas.getContext('2d')!;

            let dat = octx.createImageData(ocanvas.width, 1);
            let arr32 = new Uint32Array(dat.data.buffer);
            let arrlind = arr32.length - 1;
            for (var i = 0; i < arr32.length; i++) {
                let pos = (i / arrlind) * lind;
                let [j, prog] = [Math.floor(pos), pos % 1];
                let [a, b] = [clrs[j], clrs[j + 1] ?? '#000000'].map(x => rgb(x));
                let c = Array.from({length: 3}, (_, i) => interpolate(a[i], b[i], prog));
                arr32[i] = 0xFF << 24
                         | c[2] << 16
                         | c[1] <<  8
                         | c[0] <<  0;
            }
            octx.putImageData(dat, 0, 0);
            let pat = ctx.createPattern(ocanvas, 'repeat-y')!;
            ctx.fillStyle = pat;
            break;

    }

    ctx.fillRect(0, 0, canvas.width, canvas.height);
}