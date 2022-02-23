type Coord = [number, number];
type RGB = [number, number, number];

let wrapper = document.querySelector('.wrapper')!;
let squares = [...document.querySelectorAll('.wrapper a')] as HTMLElement[];

let cols = +getComputedStyle(wrapper).getPropertyValue('--cols');
let rows = 3; // add more placeholder project boxes by changing this

if (squares.length > cols * rows) rows = Math.ceil(squares.length / cols);

for (let i = squares.length; i < (cols * rows); i++) {
    createPlaceholderSquare();
}

for (let s of squares) {
    let span = document.createElement('span');
    span.classList.add('colhex');
    s.appendChild(span);
}

regenColors();

function createPlaceholderSquare() {
    let a = document.createElement('a');
    let title = document.createElement('div');
    let desc = document.createElement('div');

    title.classList.add('title');
    desc.classList.add('desc');

    a.appendChild(title);
    a.appendChild(desc);
    a.onclick = regenColors;

    wrapper.appendChild(a);
    squares.push(a);
}

function regenColors() {
    let cornerClrs = Array.from({length: 4}, () => randRGB(0x50)) as [RGB, RGB, RGB, RGB];
    setColors(cornerClrs);
}

function setColors(cornerClrs: [RGB, RGB, RGB, RGB]) {
    squares.forEach((s, i) => {
        let [pr, pc] = asCoord(i);
        let normPos = [pr / (rows - 1), pc / (cols - 1)] as [number, number];
        let clr = interpolate(cornerClrs, normPos);

        s.style.backgroundColor = hex(clr);

        let hexText = s.querySelector('.colhex')!;
        hexText.textContent = hex(clr);
    });
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min)) + min;
}
function randRGB(min = 0, max = 256): RGB {
    // [min, max)
    return Array.from({length: 3}, () => randInt(min, max)) as RGB;
}
function hex(arr: RGB) {
    // converts rgb array => hex notation
    return `#${arr.map(x => Math.round(x).toString(16).padStart(2, "0")).join('')}`
}
function asCoord(i: number): Coord {
    // takes an index in the array, maps it to its [row, col] value
    return [Math.floor(i / cols), i % cols];
}

function zip<A extends any[]>(...v: {[I in keyof A]: A[I][]}): A[] {
    let length = v[0].length;
    return Array.from({length}, (_, i) => v.map(a => a[i]) as A);
}

function lerp<T extends number[]>(pts: [T, T], dist: number): T {
    let [p, q] = pts;
    let length = p.length;
    return Array.from({length}, (_, i) => {
        let a = p[i], b = q[i];
        return a + dist * (b - a);
    }) as T;
}

function bilerp<T extends number[]>(pts: [T, T, T, T], dist: [number, number]): T {
    type ArrPair = [T, T];
    let [px, py] = dist;
    let [top, bottom] = [pts.slice(0, 2) as ArrPair, pts.slice(2, 4) as ArrPair]
    return lerp([lerp(top, px), lerp(bottom, px)], py);
}

function calcWeights(dist: [number, number]) {
    return bilerp<[number, number, number, number]>([
        [1,0,0,0],
        [0,1,0,0],
        [0,0,1,0],
        [0,0,0,1]
    ], dist);
}

function interpolate(clrs: [RGB, RGB, RGB, RGB], dist: [number, number]) {
    let weights = calcWeights(dist);
    return Array.from({length: 3}, (_, i) => {
        let channels = clrs.map(clr => clr[i]);

        let sqsum = zip(channels, weights)
            .map(([c, w]) => w * c * c)
            .reduce((acc, cv) => acc + cv);
        
        return Math.round(Math.sqrt(sqsum));
    }) as RGB;
}

export {}; // recognize as module