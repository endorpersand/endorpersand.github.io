type Coord = [number, number]; // each cell is 1 unit
type NormCoord = [number, number]; // the entire wrapper 1 unit
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
    if (cols < 3) {
        let corners = Array.from({length: 2}, () => randRGB(0x50)) as [RGB, RGB];
        assignColors(i => interpolate2(corners, asCoord(i)));
    } else {
        let corners = Array.from({length: 4}, () => randRGB(0x50)) as [RGB, RGB, RGB, RGB];
        assignColors(i => interpolate4(corners, asNormCoord(i)));
    }
}

function assignColors(callback: (cellIndex: number) => RGB) {
    squares.forEach((s, i) => {
        let clr = callback(i);
        s.style.backgroundColor = hex(clr);

        let hexText = s.querySelector('.colhex')!;
        hexText.textContent = hex(clr);
    });
}
function asCoord(i: number): Coord {
    // takes an index in the array, maps it to its [row, col] value
    return [Math.floor(i / cols), i % cols];
}
function asNormCoord(i: number): NormCoord {
    // takes an index in the array, maps it to its NormCoord value
    let [r, c] = asCoord(i);
    return [r / (rows - 1), c / (cols - 1)];
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

function bilerp<T extends number[]>(pts: [T, T, T, T], c: NormCoord): T {
    type ArrPair = [T, T];
    let [px, py] = c;
    let [top, bottom] = [pts.slice(0, 2) as ArrPair, pts.slice(2, 4) as ArrPair]
    return lerp([lerp(bottom, px), lerp(top, px)], py);
}

// interpolate given that each corner is assigned a color
function interpolate4(clrs: [RGB, RGB, RGB, RGB], c: NormCoord) {
    // weight = how much each of the 4 points are valued based on the distance point c is from the corner
    let weights = bilerp<[number, number, number, number]>([
        [1,0,0,0],
        [0,1,0,0],
        [0,0,1,0],
        [0,0,0,1]
    ], c);

    return Array.from({length: 3}, (_, i) => {
        let channels = clrs.map(clr => clr[i]);

        let sqsum = zip(channels, weights)
            .map(([c, w]) => w * c * c)
            .reduce((acc, cv) => acc + cv);
        
        return Math.round(Math.sqrt(sqsum));
    }) as RGB;
}

function manhattan(p: Coord, q: Coord): number {
    return zip(p, q)
        .map(([px, qx]) => Math.abs(px - qx))
        .reduce((acc, cv) => acc + cv);
}

// interpolate given that the top left and bottom right are assigned colors
function interpolate2(clrs: [RGB, RGB], c: Coord) {
    // weight = how much each of the 2 points are valued based on the distance point c is from the corner
    let [aw, bw] = [
        manhattan([0, 0], c),
        manhattan([rows - 1, cols - 1], c),
    ];
    let weights = [
        bw / (aw + bw), // note, flipped
        aw / (aw + bw)
    ];

    return Array.from({length: 3}, (_, i) => {
        let channels = clrs.map(clr => clr[i]);

        let sqsum = zip(channels, weights)
            .map(([c, w]) => w * c * c)
            .reduce((acc, cv) => acc + cv);
        
        return Math.round(Math.sqrt(sqsum));
    }) as RGB;
}

export {}; // recognize as module