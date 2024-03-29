import { AbstractRenderer, IPointData, Resource, Texture } from "pixi.js";

export enum Color {
    // primaries
    Red    = 0b001, 
    Yellow = 0b010, 
    Blue   = 0b100, 

    // secondaries
    Orange = 0b011, 
    Green  = 0b110,
    Purple = 0b101, 
    Brown  = 0b111
}

export namespace Color {
    function isSecondary(c: Color) {
        // https://stackoverflow.com/a/600306
        return !!(c & (c - 1));
    }

    /**
     * Get the result of mixing two train colors together
     * @param a color 1
     * @param b color 2
     * @returns the resultant color
     */
    export function mix(a: Color, b: Color) {
        a &= 0b111;
        b &= 0b111;

        // C + C = C (for any color C)
        if (a === b) return a;
    
        // S + C = Brown (for any color C, any secondary color S)
        if (isSecondary(a) || isSecondary(b)) return Color.Brown;
    
        return (a | b) as Color;
    }

    /**
     * Get the result of mixing an array of colors together
     * @param clrs the colors
     * @returns the mixed color, or undefined if an array was given with no colors
     */
    export function mixMany(clrs: Color[]) {
        switch (clrs.length) {
            case 0: return undefined;
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
    export class Flags {
        private _flags: number;
        private static _MAX_BITS: number = 4;
    
        constructor(dirs: Dir[] | Flags | number = []) {
            if (dirs instanceof Flags) {
                this._flags = dirs._flags;
            } else if (typeof dirs === "number") {
                this._flags = dirs;
            } else {
                this._flags = dirs.reduce(((acc, cv) => acc | (1 << cv)), 0b0000);
            }
    
            let f = this._flags;
            if (f < 0 || f >= (1 << Flags._MAX_BITS)) {
                throw new Error("Invalid direction entered");
            }
        }
    
        get bits() { return this._flags; }
    
        get ones() { return Array.from(this, () => 1).reduce((acc, cv) => acc + cv, 0); }
    
        has(dir: Dir) {
            return !!(this._flags & (1 << dir));
        }
    
        // only works given all inputs are valid and flags only has 2 dirs in it
        dirExcluding(dir: Dir): Dir {
            let bits = this._flags ^ (1 << dir);
            return 31 - Math.clz32(bits);
        }
    
        equals(df: Flags) {
            return this._flags === df._flags;
        }
    
        or(df: Flags) {
            let out = new Flags();
            out._flags = this._flags | df._flags;
            return out;
        }
        and(df: Flags) {
            let out = new Flags();
            out._flags = this._flags & df._flags;
            return out;
        }
    
        *[Symbol.iterator](): Generator<Dir> {
            let f = this._flags;
            let i = 0;
    
            while (f > 0) {
                if (f & 0b1) yield i;
                i++;
                f >>= 1;
            }
        }
    }

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

    export function shifts(
        pos: readonly [number, number], 
        n = 1, ...d: Dir[]
    ): readonly [number, number] {
        return d.reduce(((acc, cv) => shift(acc, cv, n)), pos);
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

    /**
     * Get the edge of the cell.
     * @param d Direction of the edge (or undefined if center)
     * @param size Size of the cell (not radius)
     * @returns the position that marks the edge of the cell
     */
    export function edge(d: Dir | undefined, size = 1): readonly [number, number] {
        const mid = size / 2;
        const center = [mid, mid] as const;
        return typeof d === "number" ? shift(center, d, mid) : center;
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
        BG: 0x1C1D22, //, 0x1E2929, or average, 0x1D2426
        Line: 0x3D4E4D,
    },
    Shadow: 0x7F7F7F,
    Hover: 0xD7FFE7,
    Box: {
        BG: 0x252525,
        Outline: {
            Default: 0xB8B8B8,
            Goal: 0xDDDDDD
        },
    },
    Rail: {
        Inner: 0xB3B3B3,
        Outer: 0xB3B3B3,
    }
} as const;

export type CellPos  = readonly [cx: number, cy: number];
export type PixelPos = readonly [px: number, py: number];

/**
 * Edge or center.
 */
export namespace Focus {
    export type Relative = readonly [c1: CellPos, d?: Dir];
    export type Absolute = readonly [c1: CellPos, c2?: CellPos];

    /**
     * Converts a relative focus into an absolute one.
     * Note that this doesn't check if a focus is valid.
     * @param f relative focus
     * @returns absolute focus
     */
    export function intoAbsolute(f: Relative): Absolute {
        const [c1, d] = f;

        if (typeof d === "undefined") return [c1, d] as const;
        return [c1, Dir.shift(c1, d)] as const;
    }

    /**
     * Converts an absolute focus into the possible relative focuses it could represent.
     * @param f relative focus
     * @returns list of absolute focuses
     */
    export function intoRelative(f: Absolute): Relative[] {
        const [c1, c2] = f;

        if (typeof c2 === "undefined") return [[c1, c2] as const];

        // if d is Left, c2 is left of c1
        const d = Dir.difference(c1, c2);

        const relatives = [[c1, d] as const];
        if (typeof d !== "undefined") relatives.push([c2, Dir.flip(d)]);
        return relatives;
    }

    function isRelative(f: Relative | Absolute): f is Relative {
        return typeof f[1] === "number";
    }

    /**
     * Checks if two focuses are equal.
     * @param f1 focus 1
     * @param f2 focus 2
     * @returns true if they represent the same edge
     */
    export function equals(f1: Relative | Absolute, f2: Relative | Absolute) {
        if (isRelative(f1)) { f1 = intoAbsolute(f1); }
        if (isRelative(f2)) { f2 = intoAbsolute(f2); }

        const [f1a, f1b] = f1;
        const [f2a, f2b] = f2;

        return (f1a === f2a && f1b === f2b)
            || (f1a === f2b && f2a === f1b);
    }

    type FMK = `${number}_${number | undefined}`;
    export class FocusMap<V> implements Map<Absolute | Relative, V> {
        private _grid: Grids.Grid;
        private _map = new Map<FMK, [Absolute, V]>();

        constructor(grid: Grids.Grid) {

            this._grid = grid;
        }

        private _realKey(k: Absolute | Relative): FMK {
            if (isRelative(k)) k = intoAbsolute(k);
            const [c1, c2] = k;

            const i1 = Grids.cellToIndex(this._grid, c1);
            if (typeof c2 === "undefined") return `${i1}_${undefined}`;

            const i2 = Grids.cellToIndex(this._grid, c2);
            if (i1 > i2) return `${i2}_${i1}`;
            return `${i1}_${i2}`;
        }

        get(key: Absolute | Relative): V | undefined {
            return this._map.get(this._realKey(key))?.[1];
        }

        has(key: Absolute | Relative): boolean {
            return this._map.has(this._realKey(key));
        }

        set(key: Absolute | Relative, value: V): this {
            if (isRelative(key)) key = intoAbsolute(key);
            
            this._map.set(this._realKey(key), [key, value]);
            return this;
        }

        clear(): void {
            this._map.clear();
        }

        delete(key: Relative | Absolute): boolean {
            return this._map.delete(this._realKey(key));
        }

        forEach(callbackfn: (value: V, key: Absolute, map: Map<Relative | Absolute, V>) => void // primaries
            , thisArg?: any): void {
                this._map.forEach(v => callbackfn(v[1], v[0], this), thisArg);
        }

        get size() {
            return this._map.size;
        }

        entries(): IterableIterator<[Absolute, V]> {
            return this._map.values();
        }

        *keys(): IterableIterator<Absolute> {
            for (let [k] of this._map.values()) {
                yield k;
            }
        }

        *values(): IterableIterator<V> {
            for (let [_, v] of this._map.values()) {
                yield v;
            }
        }

        popItem(k: Relative | Absolute): V | undefined {
            return this._map.popItem(this._realKey(k))?.[1];
        }
        
        setDefault(k: Relative | Absolute, def: () => V): V {
            const key = isRelative(k) ? intoAbsolute(k) : k;

            return this._map.setDefault(this._realKey(key), () => [key, def()])[1];
        }

        [Symbol.iterator](): IterableIterator<[Relative | Absolute, V]> {
            return this.entries();
        }

        get [Symbol.toStringTag]() {
            return "FocusMap";
        }
    }
}

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

/**
 * Elements to use in edit modals
 */
export namespace Modal {
    const Templates = {
        activesGrid: document.querySelector<HTMLTemplateElement>("template#modal-actives-grid")!,
        hexGrid: document.querySelector<HTMLTemplateElement>("template#modal-hex-color-grid")!,
        trainList: document.querySelector<HTMLTemplateElement>("template#modal-train-list")!,
        tlSlot: document.querySelector<HTMLTemplateElement>("template#modal-tl-slot")!,
    } as const;

    /**
     * Clones a template.
     * @param template Template ID to clone
     * @param fillSlot Method to determine how <slot> elements should be changed
     * @returns the cloned template
     */
    function cloneTemplate(
        template: keyof typeof Templates, 
        fillSlot?: (name: string, i: number, slot: HTMLSlotElement) => Node | void
    ) {
        const frag: DocumentFragment = Templates[template].content.cloneNode(true) as any;

        fillSlot ??= () => {};
        const slots = frag.querySelectorAll("slot");
        const slotCounter = new Map<string, number>();

        for (let s of slots) {
            const name = s.name;
            const count = slotCounter.setDefault(name, () => 0);
            
            const ns = fillSlot(name, count, s);
            if (ns) {
                s.replaceWith(ns);
            } else {
                s.remove();
            }
            slotCounter.set(name, count + 1);
        }
        
        return frag;
    }

    /**
     * Create a label with a custom display (rather than the regular input button)
     * @param options properties for the input element
     * @param innerLabel the custom display
     * @returns this label
     */
    function label(
        options: {inputType: "radio" | "checkbox", name: string, checked?: boolean }, 
        innerLabel: () => Node
    ): HTMLLabelElement {
        const {inputType, name, checked} = options;

        const label = document.createElement("label");
        label.classList.add("radio-label");

        const input = document.createElement("input");
        input.name = name;
        input.type = inputType;
        if (checked) input.checked = checked;

        label.append(input, innerLabel());
        return label;
    };

    type _1234 = 1 | 2 | 3 | 4;
    type Range1234 = {
        min: 0 | _1234,
        max: _1234
    };
    type DirEditorAllow = _1234 | Range1234;

    /**
     * UI element that helps user configure the active/passive directions on the tile
     * @param allow number of directions that can be enabled at once.
     * @param data The directions that are enabled on the dir editor
     * @returns the dir editor
     */
    export function dirEditor(allow: DirEditorAllow, data?: {actives: Iterable<Dir>}) {
        if (typeof allow === "number") {
            allow = { min: allow, max: allow };
        }
        const { min, max } = allow;

        if (allow.min > allow.max) {
            throw new Error(`Invalid argument for allow: {min: ${allow.min}, max: ${allow.max}}`);
        }
        const useRadio = allow.min === 1 && allow.max === 1;

        const actives = Array.from(data?.actives ?? []);
        const nodes = cloneTemplate("activesGrid", (name, i) => {
            return label({
                inputType: useRadio ? "radio" : "checkbox",
                name,
                checked: actives.includes(i)
            }, () => {
                // TODO, map to user's keyboard
                const key = element("div", ["key"], "DWAS"[i]);
                const div = element("div", ["keyed", "btn"], `${i + 1}`, key);
                return div;
            });
        });

        if (useRadio) return nodes;
        if (allow.min === 0 && allow.max === 4) return nodes;

        const btns = nodes.querySelectorAll<HTMLInputElement>("input");
        const checked = Array.from(btns)
            .filter(b => b.checked);

        btns.forEach(el => el.addEventListener("click", e => {
            if (el.checked) {
                if (!checked.includes(el)) checked.push(el);
            } else {
                if (checked.length === min) {
                    e.preventDefault();
                } else {
                    const i = checked.indexOf(el);
                    if (i !== -1) checked.splice(i, 1);
                }
            }
            
            if (checked.length > max) checked.shift()!.checked = false;
        }));

        return nodes;
    }

    /**
     * Fast element util.
     * @param element Element tag to create
     * @param classes Classes on the div
     * @param children Children of the div.
     * @returns `<div>`
     */
    function element<E extends keyof HTMLElementTagNameMap>(element: E, classes: string[], ...children: (string | Node)[]) {
        const el = document.createElement(element);
        el.classList.add(...classes);
        el.append(...children);

        return el;
    }

    /**
     * Creates a box. This box automatically centers internal elements and expands throughout the column.
     * @param children Children of the box
     * @returns the box
     */
    export function box(...children: (string | Node)[]) {
        return element("div", ["modal-box"], ...children);
    }
    
    /**
     * BOX. Use it with trainList, dirEditor, hexGrid. in that order.
     * @param children trainList, dirEditor, hexGrid
     * @returns the box.
     */
    export function trioBox(...children: (string | Node)[]) {
        return element("div", ["modal-trio"], ...children);
    }

    function hexStr(n: number): `#${string}` {
        return `#${n.toString(16).padStart(6, "0")}`;
    }

    /**
     * Mapping of positions to Colors
     */
    export const HexOrder = [
        Color.Red, 
        Color.Purple, Color.Orange, 
        Color.Brown,
        Color.Blue, Color.Yellow,
        Color.Green
    ] as const;

    /**
     * Takes a button key (though, zero-indexed) and converts it to the index of the hexagon in DOM
     */
    export const HexMapping = [0, 2, 5, 6, 4, 1, 3] as const;

    /**
     * Takes the index of the hexagon in DOM and converts it to a button key (zero-indexed)
     */
    export const HMInverse = new Map<number, number>(Array.from(HexMapping, (v, k) => [v, k] as const));
    /**
     * UI element that allows the user configure the colors of the tile. 
     * If in button mode, this can be paired with `trainList` to configure trains.
     * @param type Type of the input boxes
     * @param data the colors that are toggled on on the hex grid. this will not work for "button"-type hex grids.
     * @returns hex grid
     */
    export function hexGrid(type: "checkbox" | "radio" | "button", data?: {colors: Iterable<Color>}) {
        const enabled = Array.from(data?.colors ?? [], c => HexOrder.indexOf(c));
        return cloneTemplate("hexGrid", (name, i) => {
            const hex = hexStr(Palette.Train[HexOrder[i]]);

            const key = element("div", ["key"]);
            key.textContent = "" + (HMInverse.get(i)! + 1);
            const hexagon = element("div", ["hexagon"]);
            hexagon.style.backgroundColor = hex;
            const wrapper = new DocumentFragment(); 
            wrapper.append(hexagon, key);

            let tile;
            if (type === "button") {
                tile = document.createElement("button");
                tile.appendChild(wrapper);
            } else {
                tile = label({
                    inputType: type,
                    name,
                    checked: enabled.includes(i)
                }, () => wrapper);
            }

            tile.classList.add("keyed");
            return tile;
        });
    }
    
    /**
     * A train slot. Fits a train.
     * @param train The train color (or empty if no train)
     * @returns the slot.
     */
    function tlSlot(train: Color | undefined) {
        const slot = cloneTemplate("tlSlot");

        if (train) {
            const inner = slot.querySelector<HTMLDivElement>("div.tl-slot-inner")!;
            inner.style.backgroundColor = hexStr(Palette.Train[train]);
            inner.classList.remove("empty");
        } else {
            slot.querySelector("button")!.disabled = true;
        }

        return slot;
    }

    /**
     * Creates a list of train slots.
     * @param data The color of the trains in the slots
     * @returns the train slots (in a box)
     */
    function trainList(data?: {trains?: Iterable<Color>}) {
        const iterator = (data?.trains ?? [])[Symbol.iterator]();

        const frag = cloneTemplate("trainList", name => {
            if (name === "tl-slot") {
                const c = iterator.next();

                return tlSlot(!c.done ? c.value : undefined);
            }
        });

        return element("div", ["keyed"], frag, element("div", ["key"], "Backspace"));
    }

    /**
     * Create a train list and a hex grid that are bound to a list 
     * and add the listeners to allow the train list/hex grid to modify the list.
     * @param data trains of the train list
     * @returns the hex grid, train list, and array that are paired together
     */
    export function pairedTrainList(
        data?: { trains: Iterable<Color> }
    ): readonly [
        hexGrid: ReturnType<typeof hexGrid>, 
        trainList: ReturnType<typeof trainList>, 
        clrs: Color[]
    ] {
        const trains = Array.from(data?.trains ?? []);

        const hg = hexGrid("button");
        const tl = trainList({trains});

        function push(c: Color) {
            trains.push(c);

            const slots = document.querySelectorAll<HTMLDivElement>("div.tl-slot");
            const nextEmpty = Array.from(slots)
                .find(d => d.querySelector("div.tl-slot-inner.empty"));

            if (nextEmpty) {
                const inner = nextEmpty.querySelector<HTMLDivElement>("div.tl-slot-inner")!;
                inner.style.backgroundColor = hexStr(Palette.Train[c]);
                inner.classList.remove("empty");

                nextEmpty.querySelector("button")!.disabled = false;
            } else {
                const list = document.querySelector<HTMLDivElement>("div.train-list")!;
                const slot = tlSlot(c);

                const i = slots.length;
                slot.querySelector("button")!.addEventListener("click", () => {
                    remove(i);
                })
                list.append(slot);
            }

            const but = document.querySelector<HTMLButtonElement>("button#edit-modal-ok")!
            but.disabled = !trains.length;
        }

        function remove(i: number) {
            trains.splice(i, 1);

            const slots = document.querySelectorAll<HTMLDivElement>("div.tl-slot");
            const filledSlots = Array.from(slots)
                .filter(d => d.querySelector("div.tl-slot-inner:not(.empty)"));

            // replace each filledSlot with the next color
            for (let j = i; j < trains.length; j++) {
                const inner = filledSlots[j].querySelector<HTMLDivElement>("div.tl-slot-inner")!;
                const clr = trains[j];
                inner.style.backgroundColor = hexStr(Palette.Train[clr]);
            }

            // remove last filledSlot
            if (filledSlots.length > trains.length) {
                const slot = filledSlots[filledSlots.length - 1];
                const inner = slot.querySelector<HTMLDivElement>("div.tl-slot-inner")!;
                inner.removeAttribute("style");
                inner.classList.add("empty");

                slot.querySelector("button")!.disabled = true;
            }

            // there should be 9 slots by default
            if (slots.length > 9) {
                slots[slots.length - 1].remove();
            }

            const but = document.querySelector<HTMLButtonElement>("button#edit-modal-ok")!
            but.disabled = !trains.length;
        }

        hg.querySelectorAll<HTMLButtonElement>(".hex-grid > .hex-row > button")
            .forEach((b, i) => b.addEventListener("click", () => {
                push(HexOrder[i]);
            }));
        tl.querySelectorAll<HTMLButtonElement>(".tl-slot > button")
            .forEach((b, i) => b.addEventListener("click", () => {
                remove(i);
            }));
        
        return [hg, tl, trains];
    }
}

export type Atlas = {[name: string]: Texture<Resource>};
export interface PIXIResources {
    textures: Atlas,
    renderer: AbstractRenderer
};