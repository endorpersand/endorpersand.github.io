import { Atlas, Color, Dir, DirFlags, Palette, Train } from "./values";
import * as PIXI from "pixi.js";

type Edge   = [c1: [number, number], c2: [number, number]];
type Center = [center: [number, number], _: undefined];
type RailTouch = Edge | Center;

interface Serializable<J = any> {
    toJSON(): J;
    // static fromJSON(o: J): this;
}

/**
 A class which holds a grid of the current tiles on board.
 */
export class TileGrid implements Serializable {
    /**
     * The tiles.
     */
    tiles: (Tile | undefined)[][];
    /**
     * Each cell is [size x size] big.
     */
    cellSize: number;
    /**
     * There are [length x length] cells.
     */
    cellLength: number;

    /**
     * During a step, the cursor indicates which tile the tile grid is currently scanning on.
     */
    #cursor: [number, number] = [-1, -1];

    /**
     * If false, a train crashed.
     */
    passing: boolean = true;

    /**
     * Cache for this.container
     */
    #c_container: PIXI.Container | undefined;
    /**
     * The texture resource
     */
    textures: Atlas;

    constructor(cellSize: number, cellLength: number, textures: Atlas, tiles: (Tile|undefined)[][]) {
        this.cellSize = cellSize;
        let length = this.cellLength = cellLength;
        this.tiles = Array.from({length}, (_, y) => 
            Array.from({length},(_, x) => tiles?.[y]?.[x])
        );

        this.textures = textures;
    }

    static readonly TILE_GAP = 1;

    get container(): PIXI.Container {
        if (!this.#c_container) {
            this.#c_container = this.#createContainer();
        }
        
        return this.#c_container;
    }

    get gridSize(): number {
        return this.cellSize * this.cellLength + TileGrid.TILE_GAP * (this.cellLength + 1);
    }

    tile(x: number, y: number) {
        return this.tiles?.[y]?.[x];
    }

    setTile(x: number, y: number, t: Tile | undefined) {
        this.tiles[y] ??= [];
        this.tiles[y][x] = t;

        if (this.#c_container) {
            const cells = this.container.getChildByName("cells", false) as PIXI.Container;
            const index = y * this.cellLength + x;

            const {x: lx, y: ly} = cells.getChildAt(index).position;
    
            const con: PIXI.Container = this.#renderTile(t, lx, ly);

            // replace child at index:
            cells.addChildAt(con, index);
            cells.removeChildAt(index + 1).destroy();
        }
    }

    replaceTile(x: number, y: number, f: (t: Tile | undefined) => (Tile | undefined)) {
        let t = f(this.tile(x, y));

        this.setTile(x, y, t);
        return t;
    }

    /**
     * Get the neighbor tile in a specific direction
     * @param direction the direction
     * @returns the neighbor tile
     */
    #neighbor(direction: Dir) {
        return this.tile(...Dir.shift(this.#cursor, direction));
    }

    /**
     * Push train into the neighbor that the train is expected to move into.
     * @param train train to move
     */
    intoNeighbor(train: Train) {
        this.#neighbor(train.dir)?.accept(this, train);
    }

    /**
     * Iterate one step through the board.
     */
    step() {
        for (let y = 0; y < this.cellLength; y++) {
            for (let x = 0; x < this.cellLength; x++) {
                let tile = this.tile(x, y);

                if (typeof tile !== "undefined" && tile.trains.length > 0) {
                    this.#cursor = [x, y];
                    tile.step(this);
                }
            }
        }
    }

    fail() {
        this.passing = false;
    }

    positionToCell({x, y}: PIXI.IPointData): [cellX: number, cellY: number] {
        const DELTA = this.cellSize + TileGrid.TILE_GAP;
        let [cx, cy] = [Math.floor(x / DELTA), Math.floor(y / DELTA)];

        return [
            Math.max(0, Math.min(cx, this.cellLength - 1)),
            Math.max(0, Math.min(cy, this.cellLength - 1))
        ];
    }
    
    static canRail(t: Tile | undefined): boolean {
        return typeof t === "undefined" || t instanceof Tile.Rail;
    }

    #renderTile(t: Tile | undefined, x: number, y: number): PIXI.Container {
        let con: PIXI.Container;
        if (t) {
            con = t.render(this.textures, this.cellSize)
        } else {
            con = new PIXI.Container();
            con.visible = false;
        }

        con.position.set(x, y);
        return con;
    }

    #createContainer(): PIXI.Container {
        const TILE_GAP = TileGrid.TILE_GAP;
        const DELTA = this.cellSize + TILE_GAP;
        const GRID_SIZE = this.gridSize;

        return TileGraphics.sized(GRID_SIZE, con => {
            // bg
            const bg = new PIXI.Sprite(PIXI.Texture.WHITE);
            bg.tint = Palette.GridBG;
            bg.width = GRID_SIZE;
            bg.height = GRID_SIZE;
            con.addChild(bg);

            // grid
            const grid = new PIXI.Graphics()
                .beginFill(Palette.Line);

            for (let i = 0; i <= this.cellLength; i++) {
                let x = 0 + DELTA * i;
                grid.drawRect(x, 0, TILE_GAP, GRID_SIZE);
            }
            for (let j = 0; j <= this.cellLength; j++) {
                let y = 0 + DELTA * j;
                grid.drawRect(0, y, GRID_SIZE, TILE_GAP);
            }
            con.addChild(grid);

            // each cell
            const cellCon = new PIXI.Container();
            cellCon.name = "cells";

            for (let y = 0; y < this.cellLength; y++) {
                for (let x = 0; x < this.cellLength; x++) {
                    const [lx, ly] = [
                        TILE_GAP + x * DELTA,
                        TILE_GAP + y * DELTA
                    ];

                    cellCon.addChild(
                        this.#renderTile( this.tile(x, y), lx, ly )
                    );
                }
            }
            con.addChild(cellCon);

            con.interactive = true;

            let pointers = 0;

            // <rail-mode>
            // On pointer down, this can be the center or the edge
            // Once you start moving though, it can only bind to edges
            let cellPointer: RailTouch | undefined = undefined;
            // </rail-mode>

            con.on("pointermove", (e: PIXI.InteractionEvent) => {
                // <rail-mode>
                const pos = e.data.getLocalPosition(con);
                const cellPos = this.positionToCell(pos);
                
                // If pointers != 1, things get funky, so only track if one pointer.
                if (pointers == 1) {
                    // cellPointer can now only bind to edges, so ignore centers.
                    let edge = this.nearestEdge(pos, cellPos);
                    if (typeof edge === "undefined") return;
                    
                    let nCellPointer: Edge = [cellPos, Dir.shift(cellPos, edge)];

                    // If cellPointer has not existed yet, just set it
                    // If it has, then we can try to create a rail
                    if (typeof cellPointer !== "undefined") {
                        // If the cell pointers are in the same cell, we can try to create a rail

                        let result = this.findSharedCell(cellPointer, nCellPointer);

                        if (typeof result !== "undefined") {
                            let [shared, me0, me1] = result;
                            
                            // edge + edge = make connection
                            // center + edge = make straight line
                            let e1 = me1!;
                            let e0 = me0 ?? Dir.flip(e1);

                            if (e0 !== e1) {
                                this.replaceTile(...shared, t => {
                                    if (typeof t === "undefined") {
                                        return new Tile.SingleRail(e0, e1);
                                    } else if (t instanceof Tile.Rail) {
                                        return Tile.Rail.of(new Tile.SingleRail(e0, e1), t.top());
                                    } else {
                                        return t;
                                    }
                                });
                            }
                        }
                    }

                    cellPointer = nCellPointer;
                } else {
                    // Drop stored pointer otherwise, because this information is useless.
                    cellPointer = undefined;
                }
            });

            let dbtTile: [number, number] | undefined;
            let tdtTimeout: NodeJS.Timeout | undefined;
            const DT_TIMEOUT_MS = 1000;

            con.on("pointerdown", (e: PIXI.InteractionEvent) => {
                pointers++;

                const pos = e.data.getLocalPosition(con);
                const cellPos = this.positionToCell(pos);

                let edge = this.nearestEdge(pos, cellPos);
                cellPointer = [
                    cellPos, 
                    typeof edge !== "undefined" ? Dir.shift(cellPos, edge) : undefined
                ];

                // double tap to swap rails (on a double rail)

                // first tap: if tile is dbl rail, store rail information
                if (!dbtTile) {
                    if (this.tile(...cellPos) instanceof Tile.DoubleRail) {
                        dbtTile = cellPos;
                        tdtTimeout = setTimeout(() => dbtTile = undefined, DT_TIMEOUT_MS);
                    }
                } else {
                    // second tap (if done fast enough & same rail tapped), swap the rail
                    if (cellPos[0] == dbtTile[0] && cellPos[1] == dbtTile[1]) {
                        clearTimeout(tdtTimeout);
                        
                        this.replaceTile(...dbtTile, t => {
                            if (t instanceof Tile.DoubleRail) {
                                t.paths.reverse();
                            }
                            return t;
                        });
    
                        dbtTile = undefined;
                    }
                }
            });

            function pointerup(e: PIXI.InteractionEvent) {
                pointers--;
                cellPointer = undefined;
            }
            con.on("pointerup", pointerup);
            con.on("pointerupoutside", pointerup);

            con.on("pointercancel", (e: PIXI.InteractionEvent) => {
                pointers = 0;
                cellPointer = undefined;
            })
            // </rail-mode>

            // on desktop, do hover square
            // (not on mobile cause it looks bad and it doesn't actually work on mobile anyway)
            const hoverSquare = TileGraphics.hoverIndicator(this.textures);
            hoverSquare.width = this.cellSize;
            hoverSquare.height = this.cellSize;
            hoverSquare.tint = Palette.Hover;
            hoverSquare.blendMode = PIXI.BLEND_MODES.SCREEN;
            hoverSquare.visible = false;
            con.addChild(hoverSquare);

            const enum Condition {
                IN_BOUNDS, MOUSE_UP, RAILABLE
            };
            let visibility = [
                true, true, true
            ];
            
            con.on("mousemove", (e: PIXI.InteractionEvent) => {
                const pos = e.data.getLocalPosition(con);
                const cellPos = this.positionToCell(pos);
                const [cellX, cellY] = cellPos;

                let dir = this.nearestEdge(pos, cellPos);

                // center
                if (typeof dir === "undefined") {
                    visibility[Condition.RAILABLE] = false;
                } else {
                    let tile = this.tile(...cellPos);

                    // If you can place a rail on this tile, mark the tile on the nearest edge
                    if (TileGrid.canRail(tile)) {
                        visibility[Condition.RAILABLE] = true;
                        hoverSquare.position.set(
                            TILE_GAP + cellX * DELTA + hoverSquare.width / 2, 
                            TILE_GAP + cellY * DELTA + hoverSquare.height / 2
                        );
                        hoverSquare.angle = -90 * dir;
                    } else {
                        let neighborPos = Dir.shift(cellPos, dir);
                        let neighbor = this.tile(...neighborPos);

                        if (TileGrid.canRail(neighbor)) {
                            visibility[Condition.RAILABLE] = true;

                            const [nx, ny] = neighborPos;
                            hoverSquare.position.set(
                                TILE_GAP + nx * DELTA + hoverSquare.width / 2, 
                                TILE_GAP + ny * DELTA + hoverSquare.height / 2
                            );
                            hoverSquare.angle = -90 * Dir.flip(dir);
                        }
                    }
                }
                hoverSquare.visible = visibility.every(t => t);
            })

            con.on("mousedown", (e: PIXI.InteractionEvent) => {
                visibility[Condition.MOUSE_UP] = false;
                hoverSquare.visible = visibility.every(t => t);
            });
            con.on("mouseup", (e: PIXI.InteractionEvent) => {
                visibility[Condition.MOUSE_UP] = true;
                hoverSquare.visible = visibility.every(t => t);
            });
            con.on("mouseupoutside", (e: PIXI.InteractionEvent) => {
                visibility[Condition.MOUSE_UP] = true;
                hoverSquare.visible = visibility.every(t => t);
            });

            con.on("mouseover", (e: PIXI.InteractionEvent) => {
                visibility[Condition.IN_BOUNDS] = true;
                hoverSquare.visible = visibility.every(t => t);
            });
            con.on("mouseout", (e: PIXI.InteractionEvent) => {
                visibility[Condition.IN_BOUNDS] = false;
                hoverSquare.visible = visibility.every(t => t);
            });
            
        });
    }

    /**
     * What percentage of the tile from an edge you have to be at to be considered near the edge
     */
    static readonly EDGE_THRESHOLD = 0.25;
    
    /**
     * Find the nearest edge to a cell from a given point.
     * @param param0 the point
     * @param param1 the cell to compare the edges to
     * @returns a direction, if near enough to an edge, 
     *     or undefined if close to the center or far away from the cell
     */
    nearestEdge({x, y}: PIXI.IPointData, [cellX, cellY]: [x: number, y: number]): Dir | undefined {
        const TILE_GAP = TileGrid.TILE_GAP;
        const EDGE_THRESHOLD = this.cellSize * TileGrid.EDGE_THRESHOLD;
        const DELTA = this.cellSize + TILE_GAP;

        const [minX, minY] = [ // the left and top edge, 1 pixel before where the cell starts (on the line)
            DELTA * cellX + (TILE_GAP - 1), 
            DELTA * cellY + (TILE_GAP - 1)
        ];
        const [maxX, maxY] = [ // the right and bottom edge, 1 pixel after where the cell ends (on the line)
            minX + this.cellSize + 1,
            minY + this.cellSize + 1,
        ];

        let which = [
            x + EDGE_THRESHOLD >= maxX, // right
            y - EDGE_THRESHOLD <= minY, // up
            x - EDGE_THRESHOLD <= minX, // left
            y + EDGE_THRESHOLD >= maxY, // down
        ]
        // get the near directions
        let near: Dir[] = [];
        for (let i = 0; i < which.length; i++) {
            if (which[i]) near.push(i);
        }

        if (near.length == 1) {
            return near[0];
        } else if (near.length > 1) {
            const [halfX, halfY] = [(minX + maxX) / 2, (minY + maxY) / 2];
            let edges = [
                [halfX, maxY], // right
                [minX, halfY], // up
                [halfX, minY], // left
                [maxX, halfY], // down
            ];

            let [nearestDir] = near.map(i => [i, edges[i]] as [Dir, [number, number]]) // map near into [index: edge] pair
                .map(([i, [ex, ey]]) => [i, Math.hypot(x - ex, y - ey)] as [Dir, number]) // convert points into distances
                .reduce(([ai, ad], [ci, cd]) => { // find minimum distance
                    if (ad > cd) {
                        return [ci, cd];
                    } else {
                        return [ai, ad];
                    }
                });
            
            return nearestDir;
        }

        // if no nears, treat as if direction was the center.
    }

    /**
     * Given two rail points, find if they share a cell. If so, find which direction the edge is located in.
     * @param ptr1 edge or center of a cell
     * @param ptr2 edge or center of a cell
     * @returns a triplet value or undefined (if the two do not share a cell)
     */
    findSharedCell(
        ptr1: RailTouch, 
        ptr2: RailTouch
        ): [shared: [number, number], edge1: Dir | undefined, edge2: Dir | undefined] | undefined {
            // find the shared cell
            let match: [number, number] | undefined;
            let others: [number, number] = [-1, -1]; // indexes of the values that aren't the shared cell
            for (let i = 0; i < 2; i++) {
                const ci = ptr1[i];
                if (typeof ci === "undefined") continue;
                
                for (let j = 0; j < 2; j++) {
                    const cj = ptr2[j];
                    if (typeof cj === "undefined") continue;
                    
                    if (ci[0] == cj[0] && ci[1] == cj[1]) {
                        match = ci;
                        others = [1 - i, 1 - j];
                        break;
                    }
                }
            }
            if (typeof match === "undefined") return; // no shared cell

            // find the edges

            const [oi, oj] = others;
            // the other cell (the ones that aren't the shared cell)
            const nc1 = ptr1[oi];
            const nc2 = ptr2[oj];

            const edge1 = typeof nc1 === "undefined" ? undefined : Dir.difference(match, nc1);
            const edge2 = typeof nc2 === "undefined" ? undefined : Dir.difference(match, nc2);

            return [match, edge1, edge2];
    }

    toJSON() {
        let length = this.cellLength;

        let board = Array.from({length}, () => "");
        let tiles: {[x: number]: Tile & Serializable} = {};

        for (let y = 0; y < length; y++) {
            let row = "";
            for (let x = 0; x < length; x++) {
                let tile = this.tile(x, y);

                row += tile?.serChar ?? " ";

                if (typeof tile !== "undefined" && "toJSON" in tile) {
                    tiles[y * length + x] = tile;
                }
            }

            board[y] = row;
        }

        return {board, tiles};
    }

    static fromJSON(o: {board: string[], tiles: {[x: number]: unknown}}) {
        let {board, tiles} = o;
        let length = board.length;

        let newTiles = Array.from({length}, (_, y) => 
            Array.from<unknown, Tile | undefined>({length}, (_, x) => {
                let index = y * length + x;
                let tileChar = board[y][x];

                type Values<T> = T[keyof T];
                // @ts-ignore
                let TileType: Values<typeof Tile.deserChars> | undefined = Tile.deserChars[tileChar];
                let tileData = tiles[index];

                if (TileType instanceof Tile.Rock) {
                    return new Tile.Rock();
                }
                if (typeof TileType !== "undefined" && typeof tileData !== "undefined") {
                    // @ts-ignore
                    return TileType.fromJSON(tileData);
                }
                return undefined;
            })
        );

        return (size: number, textures: Atlas) => new TileGrid(size, length, textures, newTiles);
    }

    static parse(s: string) {
        return TileGrid.fromJSON(JSON.parse(s));
    }
}

export abstract class Tile {
    /**
     * A list of the trains currently on the tile.
     */
    trains: Train[] = [];
    /**
     * The sides that trains can enter this tile through.
     * Note that if an active left side accepts right-facing trains.
     */
    readonly actives: DirFlags;

    /**
     * Char this is represented with during serialization. If not serialized, serChar is " ".
     */
    readonly serChar: string = " ";

    constructor(...actives: Dir[]) {
        this.actives = new DirFlags(actives);
    }

    /**
     * Adds this train to the tile's train storage (if the train passes through an active side)
     * @param train 
     */
        accept(grid: TileGrid, train: Train): void {
        if (this.actives.has(Dir.flip(train.dir))) {
            this.trains.push(train);
        } else {
            grid.fail();
        }
    }

    /**
     * Indicates what this tile should do during the step (is only called if the tile has a train).
     * @param grid Grid that the tile is on
     */
    abstract step(grid: TileGrid): void;

    /**
     * Create the Container that displays this tile.
     * @param textures The texture atlas that holds all assets
     * @param size Size of the tile
     */
    abstract render(textures: Atlas, size: number): PIXI.Container;
}

namespace TileGraphics {
    export function sized(size: number, f?: (c: PIXI.Container) => void): PIXI.Container {
        const con = new PIXI.Container();
        f?.(con);

        con.width = size;
        con.height = size;
        return con;
    }

    export function box(textures: Atlas): [box: PIXI.Sprite, inner: number] {
        const box = new PIXI.Sprite(textures["t_box.png"]);
        return [
            box, box.width - 10
        ]
    }

    function pivotCenter(sprite: PIXI.Sprite) {
        const [cx, cy] = [sprite.width / 2, sprite.height / 2];

        sprite.pivot.set(cx, cy);
        sprite.position.set(cx, cy);
    }

    export function activeSide(textures: Atlas, d: Dir): PIXI.Sprite {
        const sprite = new PIXI.Sprite(textures["s_active.png"]);

        pivotCenter(sprite);
        sprite.angle = -90 * d;

        return sprite;
    }

    export function passiveSide(textures: Atlas, d: Dir): PIXI.Sprite {
        const sprite = new PIXI.Sprite(textures["s_passive.png"]);

        pivotCenter(sprite);
        sprite.angle = -90 * d;

        return sprite;
    }

    const SYM_GAP = 1;
    export function symbolSet(
        clrs: Color[], 
        bounds: [center: [number, number], size: number], 
        symbol: (cx: number, cy: number, s: number, clr: Color, graphics: PIXI.Graphics) => PIXI.Graphics
    ): PIXI.Graphics {
        const [boundsCenter, boundsSize] = bounds;
        
        const n = clrs.length;
        const rowN = Math.ceil(Math.sqrt(n));

        const [originX, originY] = boundsCenter.map(x => x - boundsSize / 2);
        const cellSize = (boundsSize - (rowN + 1) * SYM_GAP) / rowN;

        const graphics = new PIXI.Graphics();
        

        for (let i = 0; i < n; i++) {
            let [cellX, cellY] = [i % rowN, Math.floor(i / rowN)];
            let [centerX, centerY] = [
                originX + SYM_GAP + cellX * (cellSize + SYM_GAP) /* top left pixel in cell */ + cellSize / 2 /* shift to center */,
                originY + SYM_GAP + cellY * (cellSize + SYM_GAP) /* top left pixel in cell */ + cellSize / 2 /* shift to center */,
            ]
            
            symbol(
                centerX, 
                centerY, 
                cellSize, 
                clrs[i],
                graphics
            );
        }

        return graphics;
    }

    export function painterSymbol(textures: Atlas, c: Color): PIXI.Sprite {
        const sprite = new PIXI.Sprite(textures["t_painter.png"]);
        sprite.tint = Palette.Train[c];
        return sprite;
    }

    export function splitterSymbol(textures: Atlas, d: Dir): PIXI.Sprite {
        const sprite = new PIXI.Sprite(textures["t_splitter.png"]);

        pivotCenter(sprite);
        sprite.angle = 180 - 90 * d;

        return sprite;
    }

    export function rock(textures: Atlas): PIXI.Sprite { // TODO
        const sprite = new PIXI.Sprite(textures["t_painter.png"]);
        
        pivotCenter(sprite);
        sprite.angle = 180;

        return sprite;
    }

    export function rail(textures: Atlas, ...entrances: Dir[]): PIXI.Sprite {
        let [e1, e2] = entrances;

        let straight = !((e1 - e2) % 2);
        
        let sprite = new PIXI.Sprite(textures[straight ? "rail.png" : "rail2.png"]);
        if (straight) {
            sprite.angle = -90 * e1;
        } else {
            let d = ((e2 - e1) % 4 + 4) % 4;
            if (d == 1) {
                // difference of 1 means e1 is left of e2
                sprite.angle = -90 * e1;
            } else { // d == 3
                // difference of 3 means e2 is left of e1
                sprite.angle = -90 * e2;
            }
        }

        pivotCenter(sprite);
        return sprite;
    }

    export function hoverIndicator(textures: Atlas): PIXI.Sprite {
        const sprite = new PIXI.Sprite(textures["hover.png"]);

        pivotCenter(sprite);
        return sprite;
    }
}

export namespace Tile {

    /**
     * Tile which trains appear from.
     */
    export class Outlet extends Tile implements Serializable {
        /**
         * The output side.
         */
        out: Dir;

        /**
         * The colors of trains that this outlet stores.
         */
        colors: Color[];

        /**
         * Number of trains released.
         */
        released: number = 0;

        readonly serChar = "+";

        constructor(out: Dir, colors: Color[]) {
            super();
            this.out = out;
            this.colors = colors;
            this.trains = Array.from(colors, color => ({color, dir: out}));
        }

        step(grid: TileGrid): void {
            // While the outlet has trains, deploy one.
            this.released += 1;
            grid.intoNeighbor(this.trains.shift()!);
        }
        
        toJSON() {
            return {out: this.out, colors: this.colors.map(c => Color[c])};
        }

        static fromJSON({out, colors}: {out: Dir, colors: string[]}) {
            const outR = Dir.parse(out);
            const colorsR = colors.map(Color.parse);

            return new Outlet(outR, colorsR);
        }

        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box, inner] = TileGraphics.box(textures);
                con.addChild(box);
                
                const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as [number, number];
                const symbols = TileGraphics.symbolSet(
                    this.colors, [center, inner],
                    (cx, cy, s, clr, g) => {
                        const width = s;
                        const height = width / 2;

                        const [dx, dy] = [-width / 2, -height / 2];
                        return g.beginFill(Palette.Train[clr])
                            .drawRect(cx + dx, cy + dy, width, height)
                            .drawRect(cx + dy, cy + dx, height, width);
                    }
                );
                con.addChild(symbols);
                
                con.addChild(TileGraphics.passiveSide(textures, this.out));
            });
        }
    }
    
    /**
     * Tiles which trains must go to.
     */
    export class Goal extends Tile implements Serializable {
        /**
         * The train colors this goal block wants. If met, the color is switched to undefined.
         */
        targets: (Color | undefined)[];
        readonly serChar = "o";

        constructor(targets: Color[], entrances: Dir[]) {
            super(...entrances);
            this.targets = targets;
        }
    
        step(grid: TileGrid): void {
            let trains = this.trains;
            this.trains = [];

            for (let train of trains) {
                let i = this.targets.indexOf(train.color);
                if (i != -1) {
                    this.targets[i] = undefined;
                } else {
                    grid.fail();
                }
            }
        }
    
        toJSON() {
            return {targets: (this.targets as Color[]).map(c => Color[c]), actives: this.actives.bits};
        }

        static fromJSON({targets, actives}: {targets: string[], actives: number}) {
            const targetsR = targets.map(Color.parse);
            const entrances = [...new DirFlags(actives)];

            return new Goal(targetsR, entrances);
        }

        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box, inner] = TileGraphics.box(textures);
                con.addChild(box);
                
                const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as [number, number];
                const symbols = TileGraphics.symbolSet(
                    this.targets as Color[], [center, inner],
                    (cx, cy, s, clr, g) => g.beginFill(Palette.Train[clr])
                        .drawCircle(cx, cy, s / 2)
                );
                con.addChild(symbols);

                con.addChild(...[...this.actives]
                    .map(e => TileGraphics.activeSide(textures, e))
                )
            });
        }
    }
    
    /**
    * Tiles which paint the train.
    */
    export class Painter extends Tile implements Serializable {
        color: Color;
        readonly serChar = "p";

        constructor(color: Color, active1: Dir, active2: Dir) {
            super(active1, active2);
            this.color = color;
        }
    
        step(grid: TileGrid): void {
            // Paint the train and output it.
            let train = this.trains.shift()!;
            // Get the output direction.
            let outDir: Dir = this.actives.dirExcluding(Dir.flip(train.dir));

            grid.intoNeighbor({
                color: this.color,
                dir: outDir
            });
        }
        
        accept(grid: TileGrid, train: Train): void {
            // A train can only enter an outlet from the active side.
            if (this.actives.has(Dir.flip(train.dir))) {
                this.trains.push(train);
            } else {
                grid.fail();
            }
        }

        toJSON() {
            return {actives: this.actives.bits, color: Color[this.color]};
        }

        static fromJSON({actives, color}: {actives: number, color: string}) {
            const colorR = Color.parse(color);
            const activesR = new DirFlags(actives);

            if (activesR.ones != 2) throw new TypeError("Painter must have 2 active sides");
            const [a1, a2] = activesR;
            return new Painter(colorR, a1, a2);
        }

        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box, inner] = TileGraphics.box(textures);
                con.addChild(box);
                
                const centerX = Math.floor(box.width / 2);
                con.addChild(TileGraphics.painterSymbol(textures, this.color));
                con.addChild(...[...this.actives]
                    .map(e => TileGraphics.activeSide(textures, e))
                )
            });
        }
    }
    
    /**
     * Tiles which split the train into 2 trains.
     */
    export class Splitter extends Tile implements Serializable {
        /**
         * The active side.
         * Note that: If this goal accepts right-facing trains, it has a left-facing active side.
         */
        active: Dir;
        readonly serChar = "s";
    
        constructor(active: Dir) {
            super(active);
            this.active = active;
        }
    
        get sides(): [Dir, Dir] {
            return [
                Dir.rotate(this.active, 1),
                Dir.rotate(this.active, 3),
            ];
        }

        step(grid: TileGrid): void {
            let train = this.trains.shift()!;
    
            let [ldir, rdir] = this.sides;
    
            // Split train's colors, pass the new trains through the two passive sides.
            let [lclr, rclr] = Color.split(train.color);
            grid.intoNeighbor({
                color: lclr, dir: ldir
            });
            grid.intoNeighbor({
                color: rclr, dir: rdir
            });
        }

        toJSON() {
            return {actives: this.actives.bits};
        }
        static fromJSON({actives}: {actives: number}) {
            const af = new DirFlags(actives);
            if (af.ones != 1) throw new TypeError("Splitter must have 1 active side");

            const [active] = af;
            return new Splitter(active);
        }

        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box, inner] = TileGraphics.box(textures);
                con.addChild(box);
                
                con.addChild(TileGraphics.splitterSymbol(textures, this.active));
                
                let sides = [
                    TileGraphics.activeSide(textures, this.active),
                    ...this.sides.map(s => TileGraphics.passiveSide(textures, s))
                ];
                con.addChild(...sides);
            });
        }
    }
    
    export class Rock extends Tile {
        readonly serChar = "r";

        step(grid: TileGrid): void {
            // Unreachable state.
            this.trains = [];
            grid.fail();
        }

        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                con.addChild(TileGraphics.rock(textures));
            });
        }
    }
    
    export abstract class Rail extends Tile {
        constructor(entrances: Dir[] | DirFlags) {
            super(...entrances);
        }
    
        step(grid: TileGrid): void {
            let trains = this.trains;
            this.trains = [];
    
            // Figure out where all the trains are leaving
            let destTrains = trains
                .map(this.redirect)
                .filter(t => typeof t !== "undefined") as Train[];
            
            // Merge exits and dispatch
            for (let t of Rail.collapseTrains(destTrains)) {
                grid.intoNeighbor(t);
            }
        }
    
        /**
         * Combine trains into one expected output
         * @param trains trains, uncombined
         * @returns the combined trains
         */
        static collapseTrains(trains: Train[]) {
            // merge all the colors of all the trains going through the rail
            let color = Color.mixMany(trains.map(t => t.color));
    
            // get all train destinations
            let dest = new Set(trains.map(t => t.dir));
    
            // create one train per dest.
            return [...dest].map(dir => ({color, dir}));
        }
    
        /**
         * Create a new rail from two single rails.
         * If they are the same rail, return a SingleRail, else create a joined DoubleRail.
         * @param rail1 rail 1
         * @param rail2 rail 2
         * @returns the new rail
         */
        static of(rail1: SingleRail, rail2: SingleRail) {
            let [e1, e2] = [rail1.actives, rail2.actives];
    
            if (e1.equals(e2)) {
                let [d1, d2, ..._] = e1;
                return new SingleRail(d1, d2);
            }
            return new DoubleRail([e1, e2]);
        }
        
        /**
         * Designate where a train should exit the rail (given its entrance state)
         * @param t train to redirect
         */
        abstract redirect(t: Train): Train | undefined;

        abstract top(): SingleRail;
    }
    
    export class SingleRail extends Rail {
        constructor(dir1: Dir, dir2: Dir) {
            if (dir1 === dir2) throw new Error("Invalid single rail");
            super([dir1, dir2]);
        }
    
        redirect(t: Train): Train | undefined {
            
            let {color, dir} = t;
            let enterDir = Dir.flip(dir);
            
            // A train that entered through one entrance exits through the other entrance
            if (this.actives.has(enterDir)) {
                return {color, dir: this.actives.dirExcluding(enterDir)};
            }
            // invalid state: wipe truck from existence
        }
    
        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                con.addChild(TileGraphics.rail(textures, ...this.actives));
            });
        }

        top() {
            return this;
        }
    }
    
    export class DoubleRail extends Rail {
        paths: [DirFlags, DirFlags];
        #overlapping: boolean;
    
        constructor(paths: [DirFlags, DirFlags]) {
            let [e0, e1] = paths;
            if (e0.equals(e1)) {
                throw new Error("Rails match");
            }
            super(e0.or(e1));
            this.paths = paths;
            this.#overlapping = [...this.actives].length < 4;
        }
    
        redirect(t: Train): Train | undefined {
            let {color, dir} = t;
            let enterDir = Dir.flip(dir);
    
            // Find which path the train is on. Pass the train onto the other side of the path.
            let rails = this.paths
                .filter(r => r.has(enterDir));
    
            if (rails.length > 0) {
                // If the double rail merges at a point, then the primary and secondary rails swap.
                if (this.#overlapping) {
                    this.paths.push(this.paths.shift()!);
                }
                return { color, dir: rails[0].dirExcluding(enterDir) };
            }
            
            // invalid state: wipe truck from existence
        }

        render(textures: Atlas, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const rails = this.paths.map(p => TileGraphics.rail(textures, ...p));

                if (this.#overlapping) {
                    rails[1].tint = Palette.Shadow;
                    rails.reverse();
                }

                con.addChild(...rails);
            });
        }

        top() {
            let [d1, d2] = this.paths[0];
            return new Tile.SingleRail(d1, d2);
        }
    }

    export let deserChars = {
        "+": Outlet,
        "o": Goal,
        "p": Painter,
        "s": Splitter,
        "r": Rock
    }
}