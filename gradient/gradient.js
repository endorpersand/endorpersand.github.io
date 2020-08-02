"use strict";
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let radio = [...document.querySelectorAll('input[type=radio]')];
let celem = [...document.querySelectorAll('input[type=color]')];
let colors = celem.map(x => x.value);
let rgb = colors.map(x => [x.slice(1, 3), x.slice(3, 5), x.slice(5, 7)].map(y => parseInt(y, 16)));
let selectINTP = 'lin';
radio.forEach(x => x.addEventListener('change', (e) => {
    selectINTP = e.target.value;
    update();
}));
celem.forEach((x, i) => x.addEventListener('change', (e) => {
    colors[i] = e.target.value;
    rgb = colors.map(x => [x.slice(1, 3), x.slice(3, 5), x.slice(5, 7)].map(y => parseInt(y, 16)));
    update();
}));
update();
function update() {
    let offcanvas = new OffscreenCanvas(canvas.width, 1);
    let offctx = offcanvas.getContext('2d');
    let grad = offctx.createImageData(canvas.width, 1);
    let buf = grad.data.buffer;
    let arr32 = new Uint32Array(buf);
    switch (selectINTP) {
        case 'lin':
            /*
            for (let i = 0; i < offcanvas.width; i++) {
                let frac = i / offcanvas.width;
                let calcRGB = (index: RGB): number => frac * rgb[1][index] + (1 - frac) * (rgb[0][index]);
                arr32[i] =
                                   255 << 24 | // alpha
                    calcRGB( RGB.blue) << 16 | // blue
                    calcRGB(RGB.green) <<  8 | // green
                    calcRGB(  RGB.red);        // red
            }
            offctx.putImageData(grad, 0, 0);
            let gradPat = <CanvasPattern>ctx.createPattern(offcanvas, 'repeat-y')
            ctx.fillStyle = gradPat
            break;
            */
            let lg = ctx.createLinearGradient(0, 0, canvas.width, 0);
            lg.addColorStop(0, colors[0]);
            lg.addColorStop(1, colors[1]);
            ctx.fillStyle = lg;
            break;
        case 'rms':
            for (let i = 0; i < offcanvas.width; i++) {
                let frac = i / offcanvas.width;
                let calcRGB = (index) => Math.sqrt(frac * (rgb[1][index] ** 2) + (1 - frac) * (rgb[0][index]) ** 2);
                arr32[i] =
                    255 << 24 | // alpha
                        calcRGB(2 /* blue */) << 16 | // blue
                        calcRGB(1 /* green */) << 8 | // green
                        calcRGB(0 /* red */); // red
            }
            offctx.putImageData(grad, 0, 0);
            let gradPat = ctx.createPattern(offcanvas, 'repeat-y');
            ctx.fillStyle = gradPat;
            break;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
