import { IPointData, Resource, Texture } from "pixi.js";

export enum Color {
    // primaries
    Red    = 0b0001, 
    Yellow = 0b0010, 
    Blue   = 0b0100, 

    // secondaries
    Orange = 0b1011, 
    Green  = 0b1110,
    Purple = 0b1101, 
    Brown  = 0b1111
}

export namespace Color {
    /**
     * Get the result of mixing two train colors together
     * @param a color 1
     * @param b color 2
     * @returns the resultant color
     */
    export function mix(a: Color, b: Color) {
        a &= 0b1111;
        b &= 0b1111;

        // C + C = C (for any color C)
        if (a === b) return a;
    
        // S + C = Brown (for any color C, any secondary color S)
        if ((a & 0b1000) || (b & 0b1000)) return Color.Brown;
    
        return (0b1000 | a | b) as Color;
    }

    /**
     * Get the result of mixing an array of colors together
     * @param clrs the colors
     */
    export function mixMany(clrs: Color[]) {
        switch (clrs.length) {
            case 0: throw new Error("Mix colors called with no arguments");
            case 1: return clrs[0];
            case 2: return mix(clrs[0], clrs[1]);
            default:
                // If the colors are all the same, return that color.
                // Otherwise, return Brown.
                let mixes = new Set(clrs);
                if (mixes.size === 1) {
                    return [...mixes][0];
                }
                return Color.Brown;
        }
    }

    export function split(a: Color): [Color, Color] {
        switch (a) {
            case Color.Purple: return [Color.Blue,   Color.Red]
            case Color.Green:  return [Color.Blue,   Color.Yellow]
            case Color.Orange: return [Color.Yellow, Color.Red]
            default: return [a, a]
        }
    }

    /**
     * Convert a string name into a Color
     * @param name the string name
     * @returns color (or error if not valid color)
     */
    export function parse(name: string): Color {
        // @ts-ignore
        let clr: unknown = Color[name];

        if (typeof clr === "number") return clr;
        throw new TypeError(`Invalid color ${name}`);
    }
}

export enum Dir {
    Right, Up, Left, Down
}

export namespace Dir {
    /**
     * Rotate a direction some number of 90 degree turns counterclockwise
     * @param d initial direction
     * @param n number of 90 degree turns
     * @returns new direction
     */
    export function rotate(d: Dir, n: number = 1): Dir {
        return (d + n) % 4;
    }
    
    /**
     * Flip direction 180 degrees
     * @param d initial direction
     * @returns new direction
     */
    export function flip(d: Dir): Dir {
        return rotate(d, 2);
    }

    export function shift(
        [x, y]: readonly [number, number], 
        d: Dir, n = 1
    ): readonly [number, number] {
        switch (d) {
            case Dir.Right: return [x + n, y]
            case Dir.Up:    return [x, y - n]
            case Dir.Left:  return [x - n, y]
            case Dir.Down:  return [x, y + n]
        }
    }

    export function difference(
        [x1, y1]: readonly [number, number], 
        [x2, y2]: readonly [number, number]
    ): Dir | undefined {
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx > 0 && dy == 0) return Dir.Right;
        if (dx == 0 && dy < 0) return Dir.Up;
        if (dx < 0 && dy == 0) return Dir.Left;
        if (dx == 0 && dy > 0) return Dir.Down;

        return undefined;
    }

    export function edge(d: Dir, size = 1): readonly [number, number] {
        return shift([size / 2, size / 2], d, size / 2);
    }

    /**
     * Verify that a given number is a direction
     * @param index number
     * @returns the same number, if it is a valid direction
     */
    export function parse(index: number): Dir {
        let d: string | undefined = Dir[index];

        if (typeof d === "string") return index;
        throw new TypeError(`Invalid direction ${index}`);
    }
}

export class DirFlags {
    #flags: number;
    static #MAX_BITS: number = 4;

    constructor(dirs: Dir[] | DirFlags | number = []) {
        if (dirs instanceof DirFlags) {
            this.#flags = dirs.#flags;
        } else if (typeof dirs === "number") {
            this.#flags = dirs;
        } else {
            this.#flags = dirs.reduce(((acc, cv) => acc | (1 << cv)), 0b0000);
        }

        let f = this.#flags;
        if (f < 0 || f >= (1 << DirFlags.#MAX_BITS)) {
            throw new Error("Invalid direction entered");
        }
    }

    get bits() { return this.#flags; }

    get ones() { return Array.from(this, () => 1).reduce((acc, cv) => acc + cv, 0); }

    has(dir: Dir) {
        return !!(this.#flags & (1 << dir));
    }

    // only works given all inputs are valid and flags only has 2 dirs in it
    dirExcluding(dir: Dir) {
        let bits = this.#flags ^ (1 << dir);
        return 31 - Math.clz32(bits);
    }

    equals(df: DirFlags) {
        return this.#flags === df.#flags;
    }

    or(df: DirFlags) {
        let out = new DirFlags();
        out.#flags = this.#flags | df.#flags;
        return out;
    }
    and(df: DirFlags) {
        let out = new DirFlags();
        out.#flags = this.#flags & df.#flags;
        return out;
    }

    *[Symbol.iterator]() {
        let f = this.#flags;
        let i = 0;

        while (f > 0) {
            if (f & 0b1) yield i;
            i++;
            f >>= 1;
        }
    }
}

export type Train = {
    readonly color: Color,
    readonly dir: Dir
};

export const Palette = {
    Train: {
        [Color.Red]:    0xEE3030,
        [Color.Orange]: 0xEE8F30,
        [Color.Yellow]: 0xEFEF3F,
        [Color.Green]:  0x36EE30,
        [Color.Blue]:   0x3056EE,
        [Color.Purple]: 0xB530EE,
        [Color.Brown]:  0x9C6D2F,
    },
    BG: 0x2F2F2F,
    Grid: {
        BG: 0x000000,
        Line: 0x7F7F7F,
    },
    Shadow: 0x7F7F7F,
    Hover: 0xD7FFE7,
    Box: {
        BG: 0x000000,
        Outline: 0xAFAFAF,
    }
} as const;

export type CellPos  = readonly [cx: number, cy: number];
export type PixelPos = readonly [px: number, py: number];

export namespace Grids {
    export const TILE_GAP = 1;

    export interface Grid {
        /**
         * Describes the pixel size of each cell in this grid.
         * Each cell is [size x size] pixels big.
         */
        cellSize: number;
        /**
         * Describes the number of cells each dimension spans in this grid.
         * There are [length x length] cells in the grid.
         */
        cellLength: number;
    };

    /**
     * The total size this grid encompasses in pixels. The grid is [gridSize x gridSize] pixels.
     * @param param0 the grid to compute grid size on
     * @returns the grid size
     */
    export function gridSize({cellSize, cellLength}: Grid): number {
        return cellSize * cellLength + TILE_GAP * (cellLength + 1);
    }

    export function optimalCellSize({cellLength}: Grid, gridSize: number) {
        const cellSpace = gridSize - TILE_GAP * (cellLength + 1);
        return Math.floor(cellSpace / cellLength);
    }

    /**
     * Takes a pixel position and converts it into a cell position
     * @param param0 grid to compute coordinates on
     * @param param1 pixel coordinates
     * @returns cell coordinates
     */
    export function positionToCell({cellSize, cellLength}: Grid, {x, y}: IPointData): CellPos {
        const DELTA = cellSize + TILE_GAP;
        let [cx, cy] = [Math.floor(x / DELTA), Math.floor(y / DELTA)];

        return [
            Math.max(0, Math.min(cx, cellLength - 1)),
            Math.max(0, Math.min(cy, cellLength - 1))
        ];
    }

    /**
     * Takes a cell [x, y] pair and converts it into a pixel position.
     * By default, this will point to the top left pixel of the tile, 
     * but a shift parameter can be added to translate the pixel point.
     * @param param0 grid to compute coordinates on
     * @param param1 cell coordinates
     * @param shift a translation factor. note that [cellSize - 1, cellSize - 1] points to the bottom right of the tile.
     * @returns pixel coordinates
     */
    export function cellToPosition({cellSize}: Grid, [x, y]: CellPos, shift: PixelPos = [0, 0]): IPointData {
        const DELTA = cellSize + TILE_GAP;

        const [dx, dy] = shift;
        return {
            x: TILE_GAP + DELTA * x + dx,
            y: TILE_GAP + DELTA * y + dy,
        };
    }

    export function cellToIndex({cellLength}: Grid, [x, y]: CellPos) {
        return y * cellLength + x;
    }

    export function indexToCell({cellLength}: Grid, i: number): CellPos {
        return [i % cellLength, Math.floor(i / cellLength)];
    }

    /**
     * Determine if tile at specified position is in bounds
     * @param param0 grid to compute bounds on
     * @param x cell x
     * @param y cell y
     * @returns true if in bounds
     */
    export function inBounds({cellLength}: Grid, x: number, y: number): boolean {
        return [x, y].every(t => 0 <= t && t < cellLength);
    }

    /**
     * Error if tile at specified position is not in bounds
     * @param grid grid to compute bounds on
     * @param x cell x
     * @param y cell y
     */
    export function assertInBounds(grid: Grid, x: number, y: number) {
        if (!inBounds(grid, x, y)) throw new Error(`Position is not located within tile: (${x}, ${y})`);
    }
}

export type Atlas = {[name: string]: Texture<Resource>};