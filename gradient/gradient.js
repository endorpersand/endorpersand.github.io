const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let ipol = 'lin';

document.querySelectorAll('input[type=color]').forEach(x => x.addEventListener('change', update))
document.querySelectorAll('input[type=radio]').forEach(x => x.addEventListener('change', e => {
    ipol = e.target.value;
    update();
}));
document.querySelector('#coloradd').addEventListener('click', () => {
    let div = colorDiv();
    document.querySelector('#colors').insertBefore(div, document.querySelector('#coloradd'));

    let buts = document.querySelectorAll('.colorrm');
    if (buts.length > 2) {
        for (let b of buts) b.disabled = false;
    }
    update();
})

document.querySelectorAll('.colorrm').forEach(e => e.addEventListener('click', () => {
    document.querySelector('#colors').removeChild(e.parentElement);
    let buts = document.querySelectorAll('.colorrm');
    if (buts.length < 3) {
        for (let b of buts) b.disabled = true;
    }
    update();
}))
update();

function getColors() {
    return [...document.querySelectorAll('input[type=color]')].map(x => x.value);
}

function rgb(hex) {
    return [hex.slice(1,3), hex.slice(3,5), hex.slice(5,7)].map(x => parseInt(x, 16));
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
        document.querySelector('#colors').removeChild(button.parentElement);
        let buts = document.querySelectorAll('.colorrm');
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
            let ocanvas;
            if (typeof OffscreenCanvas !== 'undefined') {
                ocanvas = new OffscreenCanvas(canvas.width, 1);
            } else {
                ocanvas = document.createElement('canvas');
                [ocanvas.width, ocanvas.height] = [canvas.width, 1];
            }
            let octx = ocanvas.getContext('2d');

            let dat = octx.createImageData(ocanvas.width, 1);
            let arr32 = new Uint32Array(dat.data.buffer);
            let arrlind = arr32.length - 1;
            for (var i = 0; i < arr32.length; i++) {
                let pos = (i / arrlind) * lind;
                let [j, prog] = [Math.floor(pos), pos % 1];
                let bet = [clrs[j], clrs[j + 1] ?? '#000000'].map(x => rgb(x));
                let fn = (a, b) => Math.sqrt((a ** 2) * (1 - prog) + (b ** 2) * prog);
                let c = Array.from(Array(3), (_, i) => fn(bet[0][i], bet[1][i]));
                arr32[i] = 0xFF << 24
                         | c[2] << 16
                         | c[1] <<  8
                         | c[0] <<  0;
            }
            octx.putImageData(dat, 0, 0);
            let pat = ctx.createPattern(ocanvas, 'repeat-y');
            ctx.fillStyle = pat;
            break;

    }

    ctx.fillRect(0, 0, canvas.width, canvas.height);
}