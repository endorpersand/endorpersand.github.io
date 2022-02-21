type Coord = [number, number];
type RGB = [number, number, number];

let wrapper = document.querySelector('.wrapper')!;
let squares = [...document.querySelectorAll('.wrapper a')] as HTMLElement[];
let cols = +getComputedStyle(wrapper).getPropertyValue('--cols');

let rows = 3; // add more placeholder project boxes by changing this
if (squares.length > cols * rows) rows = Math.ceil(squares.length / cols);

let cornerPositions: Coord[] = [
    [0, 0], 
    [0, cols - 1], 
    [rows - 1, 0], 
    [rows - 1, cols - 1]
];

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
    let corners: [Coord, RGB][] = Array.from({length: 4}, (_, i) => [cornerPositions[i], randRGB(0x50)])

    squares.forEach((s, i) => {
        let pos = asCoord(i);
        let clr: RGB = [0x77, 0x77, 0x77];

        a: {
            // if corner, use that color
            for (let [cornerPos, cornerClr] of corners) {
                if (manhattan(cornerPos, pos) == 0) {
                    clr = cornerClr;
                    break a;
                }
            }

            // find all corners on the same row or col as pos
            // if none, this must be an inner square, so all corners are part of its color calc
            let calculatingCorners = corners.filter(c => {
                let [[qx, qy], _] = c;
                let [px, py] = pos;
                
                return px === qx || py === qy;
            })
            if (calculatingCorners.length === 0) calculatingCorners = corners;

            // then find manhattan for each corner and interpolate
            let clrs = calculatingCorners.map(([_, rgb]) => rgb);
            let dist = calculatingCorners.map(([q, _]) => manhattan(pos, q));

            clr = interpolate(clrs, dist);

        }
        s.style.backgroundColor = rgb(clr);

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
function rgb(arr: RGB) {
    // converts rgb array => rgb(#, #, #) notation in css
    return `rgb(${arr.join(',')})`
}
function hex(arr: RGB) {
    // converts rgb array => hex notation
    return `#${arr.map(x => Math.round(x).toString(16)).join('')}`
}
function asCoord(i: number): Coord {
    // takes an index in the array, maps it to its [row, col] value
    return [Math.floor(i / cols), i % cols];
}
function manhattan(p1: Coord, p2: Coord) {
    let [x1, y1] = p1,
        [x2, y2] = p2;
    return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}
function interpolate(clrs: RGB[], dist: number[]) {
    // does weighted RMS interpolation between two colors
    let totalDist = dist.reduce((acc, cv) => acc + cv, 0);

    let channels: number[] = [];
    for (let c = 0; c < 3; c++) { // iterate through all channels (R, G, B)
        let colorvals = clrs.map(rgb => rgb[c]) // get channel values
        let sum = colorvals.map((x, i) => (x ** 2) * (totalDist - dist[i])) // square each channel value, multiply by weight
                           .reduce((acc, cv) => acc + cv, 0); // sum
        
        let totalWeight = totalDist  * (colorvals.length - 1);
        let normSum = Math.sqrt(sum / totalWeight);
        channels.push(normSum);
    }
    return channels as RGB;
}
