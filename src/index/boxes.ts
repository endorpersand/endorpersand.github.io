type Coord = [number, number]; // each cell is 1 unit
type NormCoord = [number, number]; // the entire wrapper 1 unit
type RGB = [number, number, number];

const boxGridEl = document.querySelector('.box-grid')!;

class SquareTracker {
    private static _MIN_ROWS = 3;
    private _cols: number;
    readonly projectSquares: HTMLElement[];
    placeholderSquares: HTMLElement[];
    corners: [RGB, RGB, RGB, RGB] = [ // top right, bottom right, top left, bottom left
        [0x77, 0x77, 0x77],
        [0x77, 0x77, 0x77],
        [0x77, 0x77, 0x77],
        [0x77, 0x77, 0x77]
    ];

    constructor() {
        this._cols = +getComputedStyle(document.documentElement).getPropertyValue('--cols');

        this.projectSquares = [...boxGridEl.querySelectorAll('a')];
        for (let s of this.projectSquares) {
            let colhex = document.createElement('span');
            colhex.classList.add('colhex');

            // allow ppl to copy if they want
            colhex.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
            });

            s.appendChild(colhex);

            s.classList.add('box');
        }

        this.placeholderSquares = [];
        for (let i = this.squares; i < (this.cols * SquareTracker._MIN_ROWS); i++) {
            this._addSquare();
        }
    }

    get squares() {
        return this.projectSquares.length + this.placeholderSquares.length;
    }

    get cols() {
        return this._cols;
    }
    set cols(value) {
        if (value != this._cols) {
            this._cols = value;
            this._rebalance();
        }
    }

    get rows(): number {
        return this.squares / this.cols;
    }

    private _addSquare() {
        let box = document.createElement('div');
        let title = document.createElement('div');
        let desc = document.createElement('div');
        let colhex = document.createElement('span');
        
        title.classList.add('title');
        desc.classList.add('desc');
        colhex.classList.add('colhex');
        
        box.classList.add('box');
        box.append(title, desc, colhex);
        box.addEventListener("click", this.regenColors.bind(this, false));

        // allow ppl to copy if they want
        colhex.addEventListener("click", e => e.stopPropagation());
    
        boxGridEl.appendChild(box);
        this.placeholderSquares.push(box);
    }

    private _removeSquare() {
        this.placeholderSquares.pop()?.remove();
    }

    private _rebalance() {
        let squares = this.squares;
        // n = number of squares that should be on board
        let n = Math.max(this._cols * SquareTracker._MIN_ROWS, this.projectSquares.length);
        n = Math.ceil(n / this._cols) * this._cols;

        if (squares == n) return;
        if (squares > n) {
            for (let i = squares; i > n; i--) {
                this._removeSquare();
            }
        } else if (squares < n) {
            for (let i = squares; i < n; i++) {
                this._addSquare();
            }
        }

        this.regenColors(true);
    }

    forEach(callback: (value: HTMLElement, index: number) => void) {
        let i = 0;
        for (let e of this.projectSquares) callback(e, i++);
        for (let e of this.placeholderSquares) callback(e, i++);
    }

    regenColors(useCurrentCorners: boolean = false) {
        if (!useCurrentCorners) this.corners = Array.from({length: 4}, () => randRGB(0x50)) as [RGB, RGB, RGB, RGB];
        let corners = this.corners;
        
        if (this._cols < 3) {
            // use TL + BR boxes rather than the corners to make a consistent grid (rather than 2 columns of color)
            let corners2: [RGB, RGB] = [corners[2], corners[1]];
            this.assignColors(i => interpolate2(corners2, asCoord(i)), useCurrentCorners);
        } else {
            this.assignColors(i => interpolate4(corners, asNormCoord(i)), useCurrentCorners);
        }

    }

    assignColors(callback: (cellIndex: number) => RGB, skipTransition = false) {
        squares.forEach((s, i) => {
            let clr = callback(i);
            if (skipTransition) {
                s.classList.add("no-transition");
                s.offsetHeight;
            }
            s.style.backgroundColor = hex(clr);
    
            s.querySelector('.colhex')!.textContent = hex(clr);
        });

        if (skipTransition) {
            // return transition after color change
            requestAnimationFrame(() => { // this is called before update
                requestAnimationFrame(() => { // this is called after update
                    squares.forEach(s => {
                        s.classList.remove("no-transition");
                    });
                });
            });
        }
    }

}
let squares = new SquareTracker();
squares.regenColors();

window.addEventListener("resize", e => {
    squares.cols = +getComputedStyle(boxGridEl).getPropertyValue('--cols');
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