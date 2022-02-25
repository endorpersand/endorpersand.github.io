import { create, all } from "mathjs";
import complex from "complex.js";
const math = create(all);

let canvas      = document.querySelector('canvas')!       as HTMLCanvasElement,
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
let ctx = canvas.getContext('2d', {alpha: false})!;
let scale = 1; // increase = zoom in, decrease = zoom out

type ComplexFunction = (z: complex.Complex) => complex.Complex | number;
let f: ComplexFunction = (z => z); // fn used to compute colors
let d: ComplexFunction = (z => z); // actual values of the function

var domaind = [math.complex('-2-2i'), math.complex('2+2i')] as [unknown, unknown] as [complex.Complex, complex.Complex];

function canvasHover(e: MouseEvent) {
    zcoord.classList.remove('error');
    zcoord.textContent = `z = ${convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop)}`;
};

canvas.addEventListener('mousemove', canvasHover);
canvas.addEventListener('click', e => {
    console.log(`z = ${convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop)},\nf(z) = ${d(convPlanes(e.pageX - canvas.offsetLeft, e.pageY - canvas.offsetTop))}`);
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

    waitUntilNextFrame()
        .then(() => loadGraph(input.value))
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

function loadGraph(fstr: string) {    
    let inverse = false; // signifies if to use the reciprocal optimization (bfunc(1/fz) = 1 - bfunc(fz))
    let node = math.simplify(fstr);
    let fnode = math.parse("f(z) = 0") as math.FunctionAssignmentNode;

    if (node.type == "OperatorNode" && node.fn == 'divide' && !isNaN(+node.args[0])) { // reciprocal func
        fnode.expr = node;
        d = fnode.evaluate();
        
        node.args.reverse();
        f = fnode.evaluate();
        inverse = true;
    } else {
        fnode.expr = node;
        d = f = fnode.evaluate();
    }

    let imageData = ctx.createImageData(canvas.width, canvas.height);
    let arr32 = new Uint32Array(imageData.data.buffer);
    for (var i = 0; i < canvas.width; i++) {
        for (var j = 0; j < canvas.height; j++) {
            let fz = forceComplex(f( convPlanes(i, j) ));
            // if (typeof fz !== 'number' && fz.type !== 'Complex') throw new TypeError('Input value is not a number');
            if (!Number.isFinite(fz.re) || !Number.isFinite(fz.im)) {
                let infColor = +!inverse * 0xFFFFFF;
                arr32[canvas.width * j + i] = (0xFF << 24) | infColor;
                continue;
            }
            // get color
            let hue, brightness, c, x, m, r, g, b;
            hue = mod((inverse ? -1 : 1) * fz.arg() * 3 / Math.PI, 6); // hue [0,6)
            brightness = bfunc(fz, inverse);
            c = 1 - Math.abs(2 * brightness - 1);
            x = c * (1 - Math.abs(mod(hue, 2) - 1));
            m = brightness - c / 2;
            if (0 <= hue && hue < 1) [r, g, b] = [c, x, 0];
            else if (1 <= hue && hue < 2) [r, g, b] = [x, c, 0];
            else if (2 <= hue && hue < 3) [r, g, b] = [0, c, x];
            else if (3 <= hue && hue < 4) [r, g, b] = [0, x, c];
            else if (4 <= hue && hue < 5) [r, g, b] = [x, 0, c];
            else if (5 <= hue && hue < 6) [r, g, b] = [c, 0, x];
            else [r, g, b] = [c, 0, x]; // should never happen?
            //
            arr32[canvas.width * j + i] = 
                (           255  << 24) | // alpha
                (((b + m) * 255) << 16) |
                (((g + m) * 255) <<  8) |
                 ((r + m) * 255)
            }
    }
    ctx.putImageData(imageData, 0, 0);
}

function convPlanes(x: number, y: number) {
    //converts xy pixel plane to complex plane

    let cx =  (x - (canvas.width + 1) / 2) / ((canvas.width - 1) / 4 * scale),
        cy = -(y - (canvas.width + 1) / 2) / ((canvas.height - 1) / 4 * scale);
    return math.complex(cx, cy) as unknown as complex.Complex;
}

function forceComplex(z: number | complex.Complex) {
    // z as any is ok here
    return math.complex(z as any) as unknown as complex.Complex;
}

function bfunc(z: complex.Complex, inv: boolean) {
    // bfunc needs to match the identities:
    // b(1/x) = 1 - b(x)
    // b(0) = 0

    // the current impl uses b(x) = 1 - 1/(x^n + 1)
    // another possible impl: b(x) = 2 * atan(x) / pi

    let x = z.abs();
    let n = 1/2;
    let b = 1 / (x ** n + 1);

    return inv ? b : 1 - b;
}

function mod(x: number, y: number) {
    return ((x % y) + y) % y;
}

function waitUntilNextFrame() {
    return new Promise((resolve, reject) => {
        // this runs before the next repaint
        requestAnimationFrame(() => {

            // this runs before the next next repaint (so, after the next repaint)
            requestAnimationFrame(resolve);
        });
    })
}

graphButton.click();
