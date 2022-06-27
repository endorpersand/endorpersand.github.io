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
}

export enum Dir {
    Up, Left, Down, Right
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
}

export class DirFlags {
    #flags: number;
    static #MAX_BITS: number = 4;

    constructor(dirs: Dir[] | DirFlags = []) {
        if (dirs instanceof DirFlags) {
            this.#flags = dirs.#flags;
        } else {
            let f = this.#flags = dirs.reduce(((acc, cv) => acc | (1 << cv)), 0b0000);
    
            if (f < 0 || f >= (1 << DirFlags.#MAX_BITS)) {
                throw new Error("Invalid direction entered");
            }
        }
    }

    get bits() { return this.#flags; }

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