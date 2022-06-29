import { Resource, Texture } from "pixi.js";

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
        // C + C = C (for any color C)
        if (a === b) return a;
    
        // S + C = Brown (for any color C, any secondary color S)
        if ((a & 0b1000) || (b & 0b1000)) return Color.Brown;
    
        return (0b1000 | a | b) & 0b1111 as Color;
    }

    /**
     * Get the result of mixing an array of colors together
     * @param clrs the colors
     */
    export function mixMany(clrs: Color[]) {
        // trivial cases
        if (clrs.length === 0) throw new Error("Mix colors called with no arguments");
        else if (clrs.length === 1) return mix(clrs[0], clrs[1]);
    
        // If the colors are all the same, return that color.
        // Otherwise, return Brown.
        let mixes = new Set(clrs);
        if (mixes.size === 1) {
            return [...mixes][0];
        }
        return Color.Brown;
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

    export function shift([x, y]: [number, number], d: Dir, n = 1): [number, number] {
        switch (d) {
            case Dir.Right: return [x + n, y]
            case Dir.Up:    return [x, y - n]
            case Dir.Left:  return [x - n, y]
            case Dir.Down:  return [x, y + n]
        }
    }

    export function difference([x1, y1]: [number, number], [x2, y2]: [number, number]): Dir | undefined {
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx > 0 && dy == 0) return Dir.Right;
        if (dx == 0 && dy < 0) return Dir.Up;
        if (dx < 0 && dy == 0) return Dir.Left;
        if (dx == 0 && dy > 0) return Dir.Down;

        return undefined;
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
        return 32 - Math.clz32(bits);
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
    color: Color,
    dir: Dir
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
    GridBG: 0x000000,
    Line: 0x7F7F7F,
    Shadow: 0x7F7F7F,
    Hover: 0xD7FFE7,
};

export type Atlas = {[name: string]: Texture<Resource>};