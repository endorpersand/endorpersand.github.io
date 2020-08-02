var canvas = document.querySelector('canvas'),
    input = document.querySelector('input'),
    funcForm = document.querySelector('#funcForm'),
    graphButton = document.querySelector('#graphButton'),
    zcoord = document.querySelector('#zcoord'),
    zoomIn = document.querySelector('#zoomIn'),
    zoomR = document.querySelector('#zoomR'),
    zoomOut = document.querySelector('#zoomOut'),
    zoomInput = document.querySelector('#zoomInput'),
    zoomForm = document.querySelector('#zoomForm'),
    scaleInput = document.querySelector('#scaleInput'),
    scaleForm = document.querySelector('#scaleForm'),
    warning = document.querySelector('#warning'),
    range = document.querySelectorAll('.range');
var ctx = canvas.getContext('2d', {alpha: false});
var scale = 1; // increase = zoom in, decrease = zoom out
var f = (z => z);
var d = (z => z);
var mod = (x, y) => ((x % y) + y) % y;
var ranged = [math.complex('-2-2i'), math.complex('2+2i')];
var canvasHover = e => {
    zcoord.classList.remove('error');
    zcoord.textContent = `z = ${convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop)}`;
};
canvas.width = canvas.height = scaleInput.value * 2 + 1;

canvas.addEventListener('mousemove', canvasHover);
canvas.addEventListener('click', e => {
    console.log(`z = ${convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop)},\nf(z) = ${d(convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop))}`);
})
input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-zA-Z0-9+\-*/^., ()]/g, ''); //removes invalid characters
})
graphButton.addEventListener('click', () => {
    zcoord.classList.remove('error');
    zcoord.onload = () => console.log('a');
    zoomInput.value = scale;
    if (canvas.width !== scaleInput.value * 2 + 1) canvas.width = canvas.height = scaleInput.value * 2 + 1;
    [range[0].textContent, range[1].textContent] = ranged.map(x=>x.div(scale));
    zcoord.textContent = 'Graphing...'
    canvas.removeEventListener('mousemove', canvasHover);
    new Promise((resolve) => loadGraph(input.value, resolve))
        .then(() => {
            zcoord.textContent = 'Done.';
            setTimeout(() => canvas.addEventListener('mousemove', canvasHover), 500);
        })
        .catch(e => {
            zcoord.classList.add('error');
            zcoord.textContent = e;
            setTimeout(() => canvas.addEventListener('mousemove', canvasHover), 500);
            throw e;
        });
});

zoomIn.addEventListener('click', () => {
    scale *= 2;
    graphButton.click();
})
zoomR.addEventListener('click', () => {
    if (scale !== 1) {
        scale = 1;
        graphButton.click();
    }
})
zoomOut.addEventListener('click', () => {
    scale *= .5;
    graphButton.click();
})
zoomInput.addEventListener('input', () => {
    zoomInput.value = zoomInput.value.replace(/[^0-9.]/g, '');
    if ([...zoomInput.value].filter(x => x === '.').length > 1) {
        var ziArray = zoomInput.value.split('.');
        zoomInput.value = ziArray[0] + '.' + ziArray.slice(1).join('');
    }
});
zoomForm.addEventListener('submit', e => {
    e.preventDefault();
    if (scale !== zoomInput.value) {
    scale = +zoomInput.value || 0;
    graphButton.click();
    }
})
scaleInput.addEventListener('input', () => {
    scaleInput.value = scaleInput.value.replace(/[^0-9]/g, '');
    warning.style.display = scaleInput.value > 200 ? 'inline' : 'none';
});
scaleForm.addEventListener('submit', e => {
    e.preventDefault();
    if (canvas.width !== scaleInput.value * 2 + 1) {
    canvas.width = canvas.height = scaleInput.value * 2 + 1;
    graphButton.click();
    }
})
funcForm.addEventListener('submit', e => {
    e.preventDefault();
    graphButton.click();
})

function loadGraph(fstr, resolve) {
    let bfunc = (fz, inv, pow = 1/2) => inv ? 1 / (math.abs(fz) ** pow + 1) : 1 - (1 / (math.abs(fz) ** pow + 1)); // reciprocal root calculation
    //let bfunc = (fz, inv, pow = 1/2) => inv ? 1 - 2 * Math.atan(math.abs(fz)) / Math.PI : 2 * Math.atan(math.abs(fz)) / Math.PI // arctangent calculation
    
    let inverse = false; // signifies if to use the reciprocal optimization (bfunc(1/fz) = 1 - bfunc(fz))
    var node = math.simplify(fstr), constant = 1;
    //d = math.compile('f(z)='+node).eval();
    //while (node.fn == 'unaryMinus' || node.fn == 'divide') {
    //	if (node.fn == 'unaryMinus') {
    //		constant *= -1;
    //		node = node.args[0];
    //	}
    //	if (node.fn == 'divide') {
    //		if (isNaN(node.args[0])) break;
    //	}
    //}
    //f = math.compile('f(z)='+math.simplify(`(${node})/${constant}`))
    if (node.fn == 'divide' && !isNaN(node.args[0])) { // reciprocal func
        d = math.compile('f(z)='+node).eval();
        [constant, node] = [+node.args[0], node.args[1]]
        f = math.compile(`f(z)=(${node})/${constant}`).eval();
        inverse = true;
    } else {
        d = f = math.compile('f(z)=' + node).eval();
    }

    let imageData = ctx.createImageData(canvas.width, canvas.height);
    let arr32 = new Uint32Array(imageData.data.buffer);
    for (var i = 0; i < canvas.width; i++) {
        for (var j = 0; j < canvas.height; j++) {
            let fz = f( convPlanes(i, j) );
            if (typeof fz !== 'number' && fz.type !== 'Complex') throw new TypeError('Input value is not a number');
            if (!Number.isFinite(math.re(fz)) || !Number.isFinite(math.im(fz))) {
                infColor = !inverse * 255;
                arr32[canvas.width * j + i] = (255 << 24) | (infColor << 16) | (infColor << 8) | infColor;
                continue;
            }
            // get color
            let hue, brightness, c, x, m, r, g, b;
            hue = mod((inverse ? -1 : 1) * math.arg(fz) * 3 / Math.PI, 6); // hue [0,6)
            brightness = bfunc(fz, inverse);
            c = 1 - Math.abs(2 * brightness - 1);
            x = c * (1 - Math.abs(mod(hue, 2) - 1));
            m = brightness - c / 2;
            if (0 <= hue && hue < 1) [r, g, b] = [c, x, 0];
            if (1 <= hue && hue < 2) [r, g, b] = [x, c, 0];
            if (2 <= hue && hue < 3) [r, g, b] = [0, c, x];
            if (3 <= hue && hue < 4) [r, g, b] = [0, x, c];
            if (4 <= hue && hue < 5) [r, g, b] = [x, 0, c];
            if (5 <= hue && hue < 6) [r, g, b] = [c, 0, x];
            //
            arr32[canvas.width * j + i] = 
                (           255  << 24) | // alpha
                (((b + m) * 255) << 16) |
                (((g + m) * 255) <<  8) |
                 ((r + m) * 255)
            }
    }
    ctx.putImageData(imageData, 0, 0);
    resolve();
}

function convPlanes(x, y) {
    //converts xy pixel plane to complex plane
    return math.complex((x - (canvas.width + 1) / 2) / ((canvas.width - 1) / 4 * scale), -(y - (canvas.width + 1) / 2) / ((canvas.height - 1) / 4 * scale));
}

graphButton.click();