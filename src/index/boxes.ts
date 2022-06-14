type Coord = [number, number]; // each cell is 1 unit
type NormCoord = [number, number]; // the entire wrapper 1 unit
type RGB = [number, number, number];

let wrapper = document.querySelector('.wrapper')!;

class SquareTracker {
    static #MIN_ROWS = 3;
    #columns: number;
    readonly projectSquares: HTMLElement[];
    placeholderSquares: HTMLElement[];

    constructor() {
        this.#columns = +getComputedStyle(wrapper).getPropertyValue('--cols');

        this.projectSquares = [...wrapper.querySelectorAll('a')];
        for (let s of this.projectSquares) {
            let span = document.createElement('span');
            span.classList.add('colhex');
            s.appendChild(span);
        }

        this.placeholderSquares = [];
        for (let i = this.squares; i < (this.cols * SquareTracker.#MIN_ROWS); i++) {
            this.#addSquare();
        }
    }

    get squares() {
        return this.projectSquares.length + this.placeholderSquares.length;
    }

    get cols() {
        return this.#columns;
    }
    set cols(value) {
        if (value != this.#columns) {
            this.#columns = value;
            this.#rebalance();
        }
    }

    get rows(): number {
        return this.squares / this.cols;
    }

    #addSquare() {
        let a = document.createElement('a');
        let title = document.createElement('div');
        let desc = document.createElement('div');
        let colhex = document.createElement('span');
        
        title.classList.add('title');
        desc.classList.add('desc');
        colhex.classList.add('colhex');
        
        a.appendChild(title);
        a.appendChild(desc);
        a.appendChild(colhex);
        a.addEventListener("click", this.regenColors.bind(this));
    
        wrapper.appendChild(a);
        this.placeholderSquares.push(a);
    }

    #removeSquare() {
        this.placeholderSquares.pop()?.remove();
    }

    #rebalance() {
        let squares = this.squares;
        // n = number of squares that should be on board
        let n = Math.max(this.#columns * SquareTracker.#MIN_ROWS, this.projectSquares.length);
        n = Math.ceil(n / this.#columns) * this.#columns;

        if (squares == n) return;
        if (squares > n) {
            for (let i = squares; i > n; i--) {
                this.#removeSquare();
            }
        } else if (squares < n) {
            for (let i = squares; i < n; i++) {
                this.#addSquare();
            }
        }

        this.regenColors();
    }

    forEach(callback: (value: HTMLElement, index: number) => void) {
        let i = 0;
        for (let e of this.projectSquares) callback(e, i++);
        for (let e of this.placeholderSquares) callback(e, i++);
    }

    regenColors() {
        if (this.#columns < 3) {
            let corners = Array.from({length: 2}, () => randRGB(0x50)) as [RGB, RGB];
            this.assignColors(i => interpolate2(corners, asCoord(i)));
        } else {
            let corners = Array.from({length: 4}, () => randRGB(0x50)) as [RGB, RGB, RGB, RGB];
            this.assignColors(i => interpolate4(corners, asNormCoord(i)));
        }
    }

    assignColors(callback: (cellIndex: number) => RGB) {
        squares.forEach((s, i) => {
            let clr = callback(i);
            s.style.backgroundColor = hex(clr);
    
            s.querySelector('.colhex')!.textContent = hex(clr);
        });
    }

}
let squares = new SquareTracker();
squares.regenColors();

window.addEventListener("resize", e => {
    squares.cols = +getComputedStyle(wrapper).getPropertyValue('--cols');
})
function asCoord(i: number): Coord {
    // takes an index in the array, maps it to its [row, col] value
    return [Math.floor(i / squares.cols), i % squares.cols];
}
function asNormCoord(i: number): NormCoord {
    // takes an index in the array, maps it to its NormCoord value
    let [r, c] = asCoord(i);
    return [r / (squares.rows - 1), c / (squares.cols - 1)];
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
        manhattan([squares.rows - 1, squares.cols - 1], c),
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