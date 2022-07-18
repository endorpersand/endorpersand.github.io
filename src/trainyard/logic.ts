import { CellPos, Color, Dir, Focus, Grids, LevelTiles, Palette, PixelPos, PIXIResources, Train } from "./values";
import * as PIXI from "pixi.js";
import * as TileGraphics from "./graphics/components";
import { GridContainer, TrainContainer } from "./graphics/grid";
import "./ext/array";

type Edge   = [c1: CellPos, c2: CellPos];
type Center = [center: CellPos, _: undefined];
type RailTouch = Edge | Center;

export const EDIT_MODES = [
    "readonly",  // Active while a simulation. You cannot edit any tiles.
    "rail",      // Active while solving. You can only draw rails.
    "railErase", // Active while solving (while erasing). You can only erase rails.
    "level",     // Active while level editing. Allows you to select and edit tiles.
] as const;
export type EditMode = typeof EDIT_MODES[number];

type Event =
    | `exit${Capitalize<EditMode>}`
    | `enter${Capitalize<EditMode>}`
    | "switchEdit"
    | "load"
    | "fail"
    | "win"

type Action = {
    /**
     * Instant in time where this action was made
     */
    time: number;

    /**
     * The tile that was replaced by the action
     */
    replaced: Tile;

    /**
     * Cell position
     */
    cellPos: CellPos;
};

function capitalize<S extends string>(str: S): Capitalize<S> {
    return str.charAt(0).toUpperCase() + str.slice(1) as any;
}

function removeAllChildren(con: PIXI.Container, options?: boolean | PIXI.IDestroyOptions) {
    while (con.children.length > 0) {
        con.removeChildAt(0).destroy(options);
    }
}

function length2D<A extends {length: number}>(arr2D: A[]) {
    return Math.max(arr2D.length, ...arr2D.map(t => t.length));
}
interface Serializable<J = any> {
    /**
     * Designate how to convert this object into JSON.
     */
    toJSON(): J;
    // static fromJSON(o: J): this;
}

interface GridJSON {
    board: string[], 
    tiles: {[x: number]: unknown}
}
export type LoadableBoard = (Tile | undefined)[][] | GridJSON;

const enum Layer { RAILS, TRAINS, BOXES };
type Layers = {
    [Layer.RAILS]:  GridContainer,
    [Layer.TRAINS]: TrainContainer,
    [Layer.BOXES]:  GridContainer,
};

type HandlerOptions = {
    removeOnReload: boolean
};
/**
 A class which holds a grid of the current tiles on board.
 */
export class TileGrid implements Serializable, Grids.Grid {
    /**
     * The tiles.
     */
    #tiles: Tile[][];
    /**
     * Each cell is [size x size] big.
     */
    cellSize: number;
    /**
     * There are [length x length] cells.
     */
    cellLength: number;

    loadGridSize: number;

    /**
     * Cache for this.container
     */
    #container: PIXI.Container = new PIXI.Container();
    #rendered: boolean = false;

    /**
     * Object references coming from PIXI
     */
    pixi: PIXIResources;

    /**
     * Determines what can be edited on the grid
     */
    #editMode: EditMode = "rail";

    /**
     * Map keeping track of listeners listening to an event
     */
    #eventListeners: Partial<{
        [E in Event]: (HandlerOptions & {handler: () => void})[]
    }> = {}
    pointerEvents: PointerEvents;

    /**
     * Stack keeping track of all the past actions (allowing for undoing)
     */
    #actionStack: Action[] = [];

    simulation?: Simulation.Simulator;

    /**
     * What percentage of the tile from an edge you have to be at to be considered near the edge
     */
     static readonly EDGE_THRESHOLD = 0.2;
     
     /**
      * When undoing, the grid will undo chunks of actions at a time. 
      * If two actions are this many milliseconds apart,
      * they are considered two different chunks.
      */
     static readonly UNDO_THRESHOLD_MS = 300;

    constructor(gridSize: number, cellLength: number, pixi: PIXIResources, tiles?: (Tile | undefined)[][]) {
        this.cellLength = cellLength;
        this.loadGridSize = gridSize;
        this.cellSize = Grids.optimalCellSize(this, gridSize);
        this.#tiles = TileGrid.#normalizeTileMatrix(tiles, cellLength);

        this.pixi = pixi;
        this.pointerEvents = new PointerEvents(this);

        this.on("enterReadonly", () => {
            this.startSim();
        });
        this.on("exitReadonly", () => {
            this.simulation?.close();
            this.simulation = undefined;
        });

        this.on("enterLevel", () => {
            const length = this.cellLength;

            this.tiles = Array.from({length}, (_, y) => 
                Array.from({length}, (_, x) => {
                    const t = this.#tiles[y][x];
                    return !(t instanceof Tile.Rail) ? t : new Tile.Blank();
                })
            )
        });

        this.on("switchEdit", () => {
            this.#actionStack.length = 0;
        });
    }

    /**
     * The PIXI container for this TileGrid
     */
    get container(): PIXI.Container {
        if (!this.#rendered) return this.#renderContainer();
        return this.#container;
    }
    layer<L extends Layer>(layer: L): Layers[L] {
        const con = this.container.getChildByName("layers") as PIXI.Container;
        return con.getChildAt(layer) as any;
    }
    maybeLayer<L extends Layer>(layer: L): Layers[L] | undefined {
        if (this.#rendered) return this.layer(layer);
    }

    static #normalizeTileMatrix(mat: (Tile | undefined)[][] | undefined, length: number): Tile[][] {
        return Array.from({length}, (_, y) => 
            Array.from({length}, (_, x) => mat?.[y]?.[x] ?? new Tile.Blank())
        );
    }

    get tiles(): Tile[][] { return this.#tiles; }
    set tiles(mat: (Tile | undefined)[][]) {
        this.#tiles = TileGrid.#normalizeTileMatrix(mat, this.cellLength);
        this.#actionStack = []; // the tiles got reset, so can't do undos from here

        this.#renderContainer(true);
    }

    load(tiles: LoadableBoard, cellSize?: number): this {
        if ("board" in tiles) {
            tiles = TileGrid.#tilesFromJSON(tiles);
        }
        
        this.cellLength = length2D(tiles);
        this.cellSize = cellSize ?? Grids.optimalCellSize(this, this.loadGridSize);
        this.tiles = tiles;
        return this;
    }

    get editMode(): EditMode { return this.#editMode; }
    set editMode(em: EditMode) {
        if (this.#editMode !== em) {
            this.#dispatchEvent(`exit${capitalize(this.#editMode)}`);
            
            this.#editMode = em;
            
            this.#dispatchEvent(`enter${capitalize(em)}`);
            this.#dispatchEvent("switchEdit");
        }
    }

    /**
     * Get the tile at the specified position
     * @param x cell x
     * @param y cell y
     * @returns a tile, or `undefined` if out of bounds
     */
    tile(x: number, y: number) {
        const tile = this.#tiles?.[y]?.[x];
        if (typeof tile === "undefined") {
            return Grids.inBounds(this, x, y) ? new Tile.Blank() : undefined;
        }
        return tile;
    }

    /**
     * Set tile at the position and update its display.
     * @param x cell x
     * @param y cell y
     * @param t the new tile. `undefined`s are replaced with blank tiles
     * @param canUndo true if the action is undoable
     */
    setTile(x: number, y: number, t: Tile | undefined, canUndo = true) {
        Grids.assertInBounds(this, x, y);

        let current = this.tile(x, y)!;

        // coooould be problematic but should be fine as long as modifications to the tile do not occur
        if (current == t) {
            return;
        }
        if (canUndo) {
            this.#actionStack.push({time: performance.now(), replaced: current, cellPos: [x, y]});
        }

        t ??= new Tile.Blank();
        this.#tiles[y] ??= [];
        this.#tiles[y][x] = t;

        this.rerenderTileInContainer(x, y);
    }

    /**
     * Set tile at the position using a mapper function
     * @param x cell x
     * @param y cell y
     * @param f a mapper function that takes the old tile and maps it to a new one
     * @param canUndo true if the action is undoable
     * @returns the new tile
     */
    replaceTile(x: number, y: number, f: (t: Tile) => (Tile | undefined), canUndo = true) {
        Grids.assertInBounds(this, x, y);
        let t = f(this.tile(x, y)!);

        this.setTile(x, y, t, canUndo);
        return t;
    }

    undo() {
        if (this.#actionStack.length == 0) return;
        let actions: Action[] = [this.#actionStack.pop()!];
        
        while (this.#actionStack.length > 0) {
            let fwd = actions.at(-1)!;
            let rwd = this.#actionStack.at(-1)!;

            if (Math.abs(fwd.time - rwd.time) > TileGrid.UNDO_THRESHOLD_MS) break;
            actions.push(this.#actionStack.pop()!);
        }

        for (let action of actions) {
            const {replaced, cellPos} = action;
            this.setTile(...cellPos, replaced, false);
        }
    }

    /**
     * Iterator of all the stateful tiles in the grid.
     */
    *statefulTiles() {
        for (let y = 0; y < this.cellLength; y++) {
            for (let x = 0; x < this.cellLength; x++) {
                let tile = this.tile(x, y)!;

                if (tile instanceof StatefulTile) {
                    yield [[x, y], tile] as [CellPos, StatefulTile];
                }
            }
        }
    }

    /**
     * Initializes the simulation.
     */
    startSim() {
        this.simulation?.close();
        this.simulation = new Simulation.Simulator(this, this.layer(Layer.TRAINS));
    }


    dispatchFailEvent() {
        this.#dispatchEvent("fail");
    }
    get failed() {
        return !this.simulation?.passing ?? false;
    }
    htmlRequire() {
        const buckets: [string[], string[]] = [[], []];
        
        for (let e of EDIT_MODES) {
            const include = this.#editMode === e;
            buckets[+include].push(`${e}-mode`);
        }
        
        const failedInclude = typeof this.simulation !== "undefined" && !this.simulation.passing;
        buckets[+failedInclude].push("failed");

        const [reject, require] = buckets;
        return {reject, require};
    }

    /**
     * Get this tile's rendered PIXI container
     * @param x cell x
     * @param y cell y
     * @returns the container holding the rendering
     */
    renderTileAt(x: number, y: number, layerMask: number = -1, drag: boolean = false): PIXI.Container {
        const tile = this.tile(x, y);
        if (tile && layerMask & (1 << tile.layer)) {
            return tile.render(this.pixi, this.cellSize, drag);
        }

        const con = new PIXI.Container();
        con.visible = false;
        return con;
    }

    #wipeContainer(con: PIXI.Container) {
        removeAllChildren(con, {children: true});
        this.pointerEvents.clearEvents(con);

        // removeOnReload
        for (let [k, harr] of Object.entries(this.#eventListeners)) {
            if (harr.some(h => h.removeOnReload)) {
                this.#eventListeners[k as Event] = harr.filter(h => !h.removeOnReload);
            }
        }
    }

    /**
     * Generate the tile grid's rendered PIXI container
     * Use this.container to fallback to cache if already created
     * @returns the container
     */
    #renderContainer(force=false): PIXI.Container {
        const con = this.#container;
        if (force || !this.#rendered) {
            this.#wipeContainer(con);
            // const con = new PIXI.Container();

            // background
            const GRID_SIZE = Grids.gridSize(this);

            const bg = new PIXI.Sprite(PIXI.Texture.WHITE);
            bg.tint = Palette.Grid.BG;
            bg.width = GRID_SIZE;
            bg.height = GRID_SIZE;
            
            con.addChild(bg);

            const layers = new PIXI.Container();
            layers.name = "layers";
            const length = this.cellLength;
    
            const railCon = new GridContainer(this).loadCells(
                Array.from({length}, (_, y) => 
                    Array.from({length}, (_, x) =>
                        this.renderTileAt(x, y, 1 << Layer.RAILS)
                    )
                )
            );
            const boxCon = new GridContainer({...this, drawGrid: false}).loadCells(
                Array.from({length}, (_, y) => 
                    Array.from({length}, (_, x) =>
                        this.renderTileAt(x, y, 1 << Layer.BOXES)
                    )
                )
            );

            layers.addChild(
                railCon, new TrainContainer(this), boxCon
            );
            con.addChild(layers);
    
            con.interactive = true;
            this.pointerEvents.applyEvents(con);
        }

        this.#rendered = true;
        this.#dispatchEvent("load");
        return con;
    }

    cellAt(pos: CellPos) {
        Grids.assertInBounds(this, ...pos);
        const tile = this.tile(...pos)!;

        return (this.layer(tile.layer) as GridContainer).cellAt(pos);
    }

    /**
     * Replace the container currently at the tile position with a rerendered version of the tile
     * @param x x coord
     * @param y y coord
     */
    rerenderTileInContainer(x: number, y: number) {
        this.maybeLayer(Layer.RAILS)?.replaceCell([x, y], this.renderTileAt(x, y, 1 << Layer.RAILS));
        this.maybeLayer(Layer.BOXES)?.replaceCell([x, y], this.renderTileAt(x, y, 1 << Layer.BOXES));
    }
    
    /**
     * Add a handler for when an event occurs
     * @param event
     * @param handler
     */
    on(event: Event | Event[], handler: () => void, options: Partial<HandlerOptions> = {}) {
        if (typeof event === "string") event = [event];
        const DEFAULT: HandlerOptions = {
            removeOnReload: false
        }
        const opts: HandlerOptions = {...DEFAULT, ...options};

        for (const e of event) {
            const listeners = this.#eventListeners[e] ??= [];
            listeners.push({...opts, handler});
        }
    }

    /**
     * Call all the event handlers for this event
     * @param e event
     */
    #dispatchEvent(e: Event) {
        const listeners = this.#eventListeners[e] ??= [];

        for (let {handler} of listeners) handler();
    }

    /**
     * Find the nearest edge to a cell from a given point.
     * @param param0 the point
     * @param param1 the cell to compare the edges to
     * @returns a direction, if near enough to an edge, 
     *     or undefined if close to the center or far away from the cell
     */
    nearestEdge({x, y}: PIXI.IPointData, [cellX, cellY]: CellPos): Dir | undefined {
        const TILE_GAP = Grids.TILE_GAP;
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
            let edges: PixelPos[] = [
                [halfX, maxY], // right
                [minX, halfY], // up
                [halfX, minY], // left
                [maxX, halfY], // down
            ];

            let [nearestDir] = near.map(i => [i, edges[i]] as [Dir, PixelPos]) // map near into [index: edge] pair
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
        ): [shared: CellPos, edge1: Dir | undefined, edge2: Dir | undefined] | undefined {
            // find the shared cell
            let match: CellPos | undefined;
            let others: [number, number] = [-1, -1]; // indexes of the values that aren't the shared cell
            for (let i = 0; i < 2; i++) {
                const ci = ptr1[i];
                if (typeof ci === "undefined") continue;
                
                for (let j = 0; j < 2; j++) {
                    const cj = ptr2[j];
                    if (typeof cj === "undefined") continue;
                    
                    if (ci.equals(cj)) {
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

    /**
     * Create an initializer of a TileGrid from JSON serialized data
     * @param o the serialized JSON
     * @returns a function which accepts a size and texture parameter and gives out a TileGrid
     */
    static #tilesFromJSON(o: GridJSON) {
        let {board, tiles} = o;
        let length = length2D(board);

        let newTiles = Array.from({length}, (_, y) => 
            Array.from<unknown, Tile>({length}, (_, x) => {
                let index = y * length + x;
                let tileChar: string = board[y][x];

                type Values<T> = T[keyof T];
                // @ts-ignore
                let TileType: Values<typeof Tile.deserChars> | undefined = Tile.deserChars[tileChar];
                let tileData = tiles[index];

                if (TileType === Tile.Rock || TileType === Tile.Blank) {
                    return new TileType();
                }
                if (typeof TileType !== "undefined" && typeof tileData !== "undefined") {
                    // @ts-ignore
                    return TileType.fromJSON(tileData);
                }

                return new Tile.Blank();
            })
        );

        return newTiles;
    }
}

namespace DragPointer {
    /**
     * When the dragging starts, 
     * a `start` attribute is included that designates the first point that was pressed down.
     */
    export interface FromStart {
        start: {
            pixPos: PIXI.IPointData,
            cellPos: CellPos,
            time: number
        }
    }

    /**
     * A mapping from the current edit mode set to the object used to track drag data.
     */
    type Drag = {
        [s: string]: unknown,
        "rail": RailTouch,
        "level": CellPos,
    }

    /**
     * Conversion of each `Drag` type into its own data object.
     */
    export type DragObjects = {
        [E in EditMode]: Drag[E] extends {} ? {editMode: E, drag: Drag[E]} : never
    };
}
type DragPointer = DragPointer.FromStart & (DragPointer.DragObjects[EditMode]);

const DBT_TIMEOUT_MS  = 1000;
const CLICK_IGNORE_MS = 200;

class PointerEvents {
    #grid: TileGrid;
    #eventLayer: PIXI.Container;
    pointer?: DragPointer;
    pointers: number = 0;

    #editSquare: CellPos = [0, 0];
    #tt?: { ttButtons: NodeListOf<HTMLInputElement>, editTileBtn: HTMLButtonElement };
    
    constructor(grid: TileGrid) {
        this.#grid = grid;
        this.#eventLayer = new PIXI.Container();
    }

    applyEvents(con: PIXI.Container) {
        this.#addEventLayer(con);
        this.#addPointersTracker(con);
        this.#applyHoverEvents(con);
        this.#applyPointerEvents(con);
    }

    clearEvents(con: PIXI.Container) {
        for (let [name, h] of this.#containerEvents) con.off(name, h);
        this.#containerEvents.length = 0;
    }

    #containerEvents: [string | symbol, (e: PIXI.InteractionEvent) => void][] = [];

    #on<T extends string | symbol>(
        emitter: PIXI.utils.EventEmitter<T>, 
        event: T, 
        listener: (e: PIXI.InteractionEvent) => void
    ) {
        this.#containerEvents.push([event, listener]);
        emitter.on(event, listener);
    }

    #addEventLayer(con: PIXI.Container) {
        if (this.#eventLayer.destroyed) {
            this.#eventLayer = new PIXI.Container();
        }
        con.addChild(this.#eventLayer);

        this.#grid.on(["switchEdit", "load"], () => {
            for (let c of this.#eventLayer.children) {
                c.visible = c.name === this.#grid.editMode;
            }
        }, {removeOnReload: true});
    }

    #addPointersTracker(con: PIXI.Container) {
        this.#on(con, "pointerdown", () => {
            this.pointers++;
        });

        const pointerup = () => {
            this.pointers = Math.max(this.pointers - 1, 0);
        }
        this.#on(con, "pointerup", pointerup);
        this.#on(con, "pointerupoutside", pointerup);

        this.#on(con, "pointercancel", () => {
            this.pointers = 0;
        })
    }

    #modeLayer(m: EditMode) {
        let layer = this.#eventLayer.getChildByName(m) as PIXI.Container;
        if (layer) return layer;

        layer = this.#eventLayer.addChild(new PIXI.Container());
        layer.name = m;
        return layer;
    }

    set tt(v: { ttButtons: NodeListOf<HTMLInputElement>, editTileBtn: HTMLButtonElement }) {
        this.#tt = v;
        this.#updateTT();
    }

    ltTile(cellPos: CellPos = this.#editSquare): LevelTiles.Tile {
        Grids.assertInBounds(this.#grid, ...cellPos);
        const tile = this.#grid.tile(...cellPos)!;

        return LevelTiles.Tile[tile.constructor.name as keyof typeof LevelTiles.Tile];
    }

    #updateTT() {
        if (this.#tt) {
            const {ttButtons, editTileBtn} = this.#tt;
            const selected = this.ltTile();

            if (typeof selected !== "undefined") {
                ttButtons[selected].checked = true;
            }

            editTileBtn.disabled = !LevelTiles.Data[selected].modal;
        }
    }

    // TODO, use history rather than preset defaults
    #getDefaultTile(value: LevelTiles.Tile) {
        if (value === LevelTiles.Tile.Blank) {
            return new Tile.Blank();
        } else if (value === LevelTiles.Tile.Goal) {
            return new Tile.Goal([Dir.Right], [Color.Red]);
        } else if (value === LevelTiles.Tile.Outlet) {
            return new Tile.Outlet(Dir.Right, [Color.Red]);
        } else if (value === LevelTiles.Tile.Painter) {
            return new Tile.Painter([Dir.Left, Dir.Right], Color.Red);
        } else if (value === LevelTiles.Tile.Rock) {
            return new Tile.Rock();
        } else if (value === LevelTiles.Tile.Splitter) {
            return new Tile.Splitter(Dir.Left);
        } else {
            let _: never = value;
        }
    }

    // LEVEL EDIT MODE SETTINGS
    get editSquare() {
        return this.#editSquare;
    }

    set editSquare(v: CellPos) {
        this.#editSquare = v;

        const ssq = this.#modeLayer("level").getChildByName("ssq");
        ssq.position = Grids.cellToPosition(this.#grid, this.#editSquare);
        this.#updateTT();
    }

    setSquare(value: LevelTiles.Tile) {
        if (this.#grid.editMode !== "level") return;
        this.#grid.setTile(...this.editSquare, this.#getDefaultTile(value));
    }

    moveSquare(d: Dir) {
        if (this.#grid.editMode !== "level") return;
        const shifted = Dir.shift(this.editSquare, d);

        if (Grids.inBounds(this.#grid, ...shifted)) this.editSquare = shifted;
    }
    //

    /**
     * Apply pointer events like click, drag, etc. to a container
     * @param con Container to apply to.
     */
    #applyPointerEvents(con: PIXI.Container) {
        const grid = this.#grid;
        
        const levelLayer = this.#modeLayer("level");

        // TODO: make actual sprite for this
        const selectSquare = new PIXI.Sprite(PIXI.Texture.WHITE);
        selectSquare.width = grid.cellSize;
        selectSquare.height = grid.cellSize;
        selectSquare.tint = 0xFF0000;
        selectSquare.alpha = 0.2;
        selectSquare.name = "ssq";
        levelLayer.addChild(selectSquare);
        this.editSquare = this.editSquare;

        const selectCopy = new PIXI.Container();
        let ccshift: PIXI.IPointData;
        levelLayer.addChild(selectCopy);

        let dbtTile: CellPos | undefined;
        let dbtTimeout: NodeJS.Timeout | undefined;

        const invalidateDrag = () => {
            this.pointer = undefined;

            selectCopy.visible = false;
            removeAllChildren(selectCopy, {children: true});
        };

        /**
         * Creates drag pointer if it's `undefined`
         */
        const tryCreatePointer = (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(grid, pos);
            const editMode = grid.editMode;

            if (editMode !== this.pointer?.editMode) this.pointer = undefined;
            if (typeof this.pointer !== "undefined") return;

            if (editMode === "rail") {
                let edge = grid.nearestEdge(pos, cellPos);
                this.pointer = {
                    start: { pixPos: pos, cellPos, time: performance.now() },
                    editMode,
                    drag: [
                        cellPos, 
                        typeof edge !== "undefined" ? Dir.shift(cellPos, edge) : undefined
                    ]
                };
            } else if (editMode === "railErase") {
                // nothing
            } else if (editMode === "readonly") {
                // nothing
            } else if (editMode === "level") {
                this.pointer = { 
                    start: { pixPos: pos, cellPos, time: performance.now() },
                    editMode, 
                    drag: cellPos 
                };

                // not technically pointer setting, but it's important in the pointer
                selectCopy.addChild(grid.renderTileAt(...cellPos, -1, true));
                selectCopy.visible = true;
                
                const ccmin = Grids.cellToPosition(grid, cellPos);
                ccshift = {x: pos.x - ccmin.x, y: pos.y - ccmin.y};

                selectCopy.position = {
                    x: e.data.global.x - ccshift.x, 
                    y: e.data.global.y - ccshift.y
                };
            } else {
                let _: never = editMode;
            }
        };

        this.#on(con, "pointerdown", (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(grid, pos);

            // double tap check
            if (!dbtTile) {
                // tap 1
                dbtTile = cellPos;
                dbtTimeout = setTimeout(() => { dbtTile = undefined; }, DBT_TIMEOUT_MS);
            } else {
                // tap 2
                if (cellPos.equals(dbtTile)) {
                    clearTimeout(dbtTimeout);
                    this.#onDoubleTap(dbtTile);
                    dbtTile = undefined;
                }
            }
            //

            if (this.pointers !== 1) {
                invalidateDrag();
                return;
            }
            tryCreatePointer(e);
            
            const editMode = grid.editMode;
            if (editMode === "rail") {
                // nothing
            } else if (editMode === "railErase") {
                grid.replaceTile(...cellPos, t => {
                    return t instanceof Tile.Rail ? undefined : t;
                });
            } else if (editMode === "readonly") {
                // nothing
            } else if (editMode === "level") {
                // nothing
            } else {
                let _: never = editMode;
            }
        });

        this.#on(con, "pointermove", (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(this.#grid, pos);
            // pointer === 1 implies drag
            if (this.pointers !== 1) {
                // can't really make sense of pointer if there's more than one finger dragging
                invalidateDrag();
                return;
            }
            tryCreatePointer(e);
            
            const editMode = grid.editMode;
            if (editMode === "rail") {
                // because `tryCreatePointer`, this.pointer is defined and assigned to rail mode
                if (this.pointer?.editMode !== "rail") {
                    throw new Error("Pointer in `pointermove` is in an invalid state")
                };

                // pointer can now only bind to edges, so ignore centers.
                let edge = grid.nearestEdge(pos, cellPos);
                if (typeof edge === "undefined") return;

                const point = this.pointer.drag;
                const newPoint: Edge = [cellPos, Dir.shift(cellPos, edge)];
                
                // If the cell pointers are in the same cell, we can try to create a rail
                const result = grid.findSharedCell(point, newPoint);
                if (typeof result !== "undefined") {
                    let [shared, me0, me1] = result;
                    
                    // edge + edge = make connection
                    // center + edge = make straight line
                    let e1 = me1!;
                    let e0 = me0 ?? Dir.flip(e1);

                    if (e0 !== e1) {
                        grid.replaceTile(...shared, t => {
                            if (t instanceof Tile.Blank) {
                                return new Tile.SingleRail(e0, e1);
                            } else if (t instanceof Tile.Rail) {
                                return Tile.Rail.of(new Tile.SingleRail(e0, e1), t.top());
                            } else {
                                return t;
                            }
                        });
                    }
                }

                // move pointer to next edge
                this.pointer = { 
                    ...this.pointer,
                    drag: newPoint 
                };
            } else if (editMode === "readonly") {
                // nothing
            } else if (editMode === "railErase") {
                grid.replaceTile(...cellPos, t => {
                    return t instanceof Tile.Rail ? undefined : t;
                });
            } else if (editMode === "level") {
                selectCopy.visible = true;
                selectCopy.position = {
                    x: e.data.global.x - ccshift.x, 
                    y: e.data.global.y - ccshift.y
                };
            } else {
                let _: never = editMode;
            }
        });

        this.#on(con, "pointerup", (e: PIXI.InteractionEvent) => {
            if (this.pointer?.editMode === "level") {
                const pos = e.data.getLocalPosition(con);
                const cellPos = Grids.positionToCell(grid, pos);

                const start = this.pointer.start;
                const isClick = start &&
                    start.cellPos.equals(cellPos) &&
                    (performance.now() - start.time <= CLICK_IGNORE_MS);
                if (isClick) {
                    selectSquare.visible = true;
                    this.editSquare = cellPos;
                } else {
                    grid.setTile(...cellPos, grid.tile(...this.pointer.drag)!.clone());
                }
            }

            invalidateDrag();
        });
        this.#on(con, "pointerupoutside", invalidateDrag);
        this.#on(con, "pointercancel", invalidateDrag);

        // this.#on(con, "click", (e: PIXI.InteractionEvent) => console.log(e.data.global));
    }

    #hoverSquare(size: number) {
        const hoverSquare = new PIXI.Sprite(PIXI.Texture.WHITE);
        hoverSquare.width = size;
        hoverSquare.height = size;
        hoverSquare.alpha = 0.2;
        hoverSquare.visible = false;

        return hoverSquare;
    }

    /**
     * On desktop, display a rail indicator that marks which edge the mouse is nearest to.
     * (This is not supported on mobile cause it looks bad and is not properly functional on mobile)
     * @param con Container to apply to
     */
    #applyHoverEvents(con: PIXI.Container) {
        const grid = this.#grid;

        const railMarker = TileGraphics.hoverIndicator(grid.pixi, grid.cellSize);
        railMarker.tint = Palette.Hover;
        railMarker.visible = false;
        railMarker.interactive = true;
        railMarker.cursor = "grab";
        this.#modeLayer("rail").addChild(railMarker);

        const levelSquare = this.#modeLayer("level").addChild(
            this.#hoverSquare(grid.cellSize)
        );
        const eraseSquare = this.#modeLayer("railErase").addChild(
            this.#hoverSquare(grid.cellSize)
        );

        // yeah i should probably just use a BitSet library but also it's like 3 bits :|
        
        const enum Condition {
            /**
             * `true` if the pointer isn't in the bounds of the grid
             * This will always be false if on mobile.
             */
            IN_BOUNDS, 
            /**
             * `true` if not currently dragging the pointer
             */
            NOT_DRAGGING,
            /**
             * `true` if the current hovering position can be replaced by a rail
             */ 
            RAILABLE
        };
        let visibility = 0b010;

        const setVis = (condition: number, bit: boolean) => {
            if (bit) {
                visibility |=  (1 << condition);
            } else {
                visibility &= ~(1 << condition);
            }
        };
        const bit = (condition: number) => !!((visibility >> condition) & 1);

        const updateVis = () => {
            // note that the layer matching the edit mode is also an implicit condition

            // for rail & erase mode, must be in bounds, must be not dragging, and must be on a railable tile
            // b/c of in-bounds condition, these do not work on mobile
            railMarker.visible  = visibility == 0b111;
            eraseSquare.visible = visibility == 0b111;

            // for level mode, in bounds is sufficient to make it appear.
            // it must always appear when dragging, even on mobile, so:
            levelSquare.visible = bit(Condition.IN_BOUNDS) || !bit(Condition.NOT_DRAGGING);
        };

        this.#on(con, "pointermove", (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(grid, pos);
            const tile = grid.tile(...cellPos);

            if (grid.editMode === "rail") {
                let dir = grid.nearestEdge(pos, cellPos);
    
                if (typeof dir === "undefined") {
                    setVis(Condition.RAILABLE, false);
                } else {
    
                    // If you can place a rail on this tile, mark the tile on the nearest edge
                    if (tile?.railable) {
                        setVis(Condition.RAILABLE, true);
                        railMarker.position = Grids.cellToPosition(grid, cellPos);
                        railMarker.angle = -90 * dir;
                    } else {
                        let neighborPos = Dir.shift(cellPos, dir);
                        let neighbor = grid.tile(...neighborPos);
    
                        if (neighbor?.railable) {
                            setVis(Condition.RAILABLE, true);
    
                            railMarker.position = Grids.cellToPosition(grid, neighborPos);
                            railMarker.angle = -90 * Dir.flip(dir);
                        } else {
                            setVis(Condition.RAILABLE, false);
                        }
                    }
                }
            } else if (grid.editMode === "railErase") {
                setVis(Condition.RAILABLE, !!(tile?.railable));
                eraseSquare.position = Grids.cellToPosition(grid, cellPos);
            } else if (grid.editMode === "level") {
                levelSquare.position = Grids.cellToPosition(grid, cellPos);
                
            } else if (grid.editMode === "readonly") {
                // nothing
            } else {
                let _: never = grid.editMode;
            }

            updateVis();
        })

        this.#on(con, "pointerdown", (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(grid, pos);
            levelSquare.position = Grids.cellToPosition(grid, cellPos);

            setVis(Condition.NOT_DRAGGING, false);
            updateVis();
        });
        this.#on(con, "pointerup", (e: PIXI.InteractionEvent) => {
            setVis(Condition.NOT_DRAGGING, true);
            updateVis();
        });
        this.#on(con, "pointerupoutside", (e: PIXI.InteractionEvent) => {
            setVis(Condition.NOT_DRAGGING, true);
            updateVis();
        });

        this.#on(con, "mouseover", (e: PIXI.InteractionEvent) => {
            setVis(Condition.IN_BOUNDS, true);
            updateVis();
        });
        this.#on(con, "mouseout", (e: PIXI.InteractionEvent) => {
            setVis(Condition.IN_BOUNDS, false);
            updateVis();
        });
    }

    /**
     * Handles what happens when a tile is double tapped
     * @param dbtTile the tile that was double tapped
     */
    #onDoubleTap(dbtTile: CellPos) {
        if (this.#grid.editMode === "rail") {
            // double tap to swap rails (on a double rail)
            this.#grid.replaceTile(...dbtTile, t => {
                if (t instanceof Tile.DoubleRail) {
                    return t.flipped();
                }
                return t;
            });
        }
    }

}

class GridCursor {
    #grid: TileGrid;
    #pos: CellPos;

    constructor(grid: TileGrid, pos: CellPos) {
        this.#grid = grid;
        this.#pos = pos;
    }

    /**
     * Get the neighbor tile in a specific direction
     * @param direction the direction
     * @returns the neighbor tile
     */
    neighbor(direction: Dir) {
        return this.#grid.tile(...Dir.shift(this.#pos, direction));
    }

    updateRender(progress: number, call: (con: PIXI.Container) => void) {
        const updates = this.#grid.simulation!.renderUpdates;
        const result = [progress, () => call(this.#grid.cellAt(this.#pos))] as const;

        let gtIndex = updates.findIndex(([p, _]) => progress < p);

        if (gtIndex == -1) updates.splice(updates.length, 0, result);
        else updates.splice(gtIndex, 0, result);
    }
}


export namespace Step {
    export const Main = Symbol("main step");
    export const CenterCollision = Symbol("center collision check");
    export const EdgeCollision = Symbol("edge collision check");
    export const Deploy = Symbol("deploy");
    export const Finalize = Symbol("finalize");
}
export type Step = (typeof Step)[keyof typeof Step];

export namespace Move {

    export interface Destroy {
        step: Step,
        move: "destroy",

        preimage: Train,
        crashed: boolean
    }

    export interface Pass {
        step: Step,
        move: "pass",

        preimage: Train,
        image: Train
    }

    export interface Split {
        step: Step,
        move: "split",

        preimage: Train,
        image: Train[]
    }

    export interface Merge {
        step: Step,
        move: "merge",

        preimage: Train[],
        image: Train
    }
}

/**
 * Possible ways a train can be modified in a tile.
 */
export type Move = Move.Destroy | Move.Pass | Move.Split | Move.Merge;

namespace Simulation {
    type GridStep = Map<number, Move[]>;
    const FRAMES_PER_STEP = 30;

    export class Simulator {

        iterator: Iterator;
        #grid: TileGrid;
        #trainCon: TrainContainer;
        #peeked: GridStep[] = [];
        passing: boolean = true;
        progress: number = 0;
        renderUpdates: (readonly [progress: number, call: () => void])[] = [];

        constructor(grid: TileGrid, tc: TrainContainer) {
            this.#grid = grid;
            this.#trainCon = tc;
    
            for (let [pos, tile] of this.#grid.statefulTiles()) {
                tile.initState();

                // render trains
                for (let t of tile.state!.trainState.trains) {
                    this.#trainCon.createBody(pos, undefined, t);
                }
            }

            this.iterator = new Iterator(this.#grid);
        }

        /**
         * Peek at a future move, and do not render it.
         * @param advance Number of moves to look forward. By default, 1.
         */
        peek(advance = 1) {
            while (this.#peeked.length < advance && !this.iterator.done) {
                const ent = this.iterator.next();
                if (ent.done) return undefined;

                this.#peeked.push(ent.value);
            }

            return this.#peeked[advance - 1];
        }

        /**
         * Move to the next move and do not render it.
         * @returns next move
         */
        advance() {
            // const pk = this.peek();
            // if (pk) {
            //     for (let [tile, move] of pk) {
            //         console.log(tile, ...move);
            //     }
            // }
            // console.log("next move");

            return this.#peeked.shift() ?? this.iterator.next().value;
        }

        /**
         * Move to the next move and render it.
         */
        step() {
            const moves = this.advance();
            this.progress = 0;

            if (typeof moves !== "undefined") {
                this.render(moves);
            }
        }

        stepPartial(frames: number) {
            this.progress += frames / FRAMES_PER_STEP;
            
            while (this.progress > 1) {
                this.progress -= 1;

                const nextMove = this.advance();
                if (nextMove) this.render(nextMove);
            }

            if (this.progress > 0) {
                const peekMove = this.peek();
                if (peekMove) this.renderPartial(peekMove);
            }
        }

        /**
         * Render a set of grid moves.
         */
        render(step: GridStep) {
            for (let [i, deployedTrains] of step.entries()) {
                const pos = Grids.indexToCell(this.#grid, +i);

                if (deployedTrains.some(m => m.move == "destroy" && m.crashed)) this.fail();
                this.#trainCon.moveBodies(pos, deployedTrains);
            }

            for (let [_, call] of this.renderUpdates) call();
            this.renderUpdates = [];
        }

        renderPartial(step: GridStep) {
            for (let [i, deployedTrains] of step.entries()) {
                const pos = Grids.indexToCell(this.#grid, +i);
                this.#trainCon.moveBodiesPartial(pos, deployedTrains, this.progress);
            }

            while (this.renderUpdates.length > 0 && this.renderUpdates[0][0] <= this.progress) {
                this.renderUpdates.shift()![1]();
            }
        }

        /**
         * Cause a fail.
         */
        fail() {
            if (this.passing) {
                this.passing = false;
                this.#grid.dispatchFailEvent();
            }
        }

        /**
         * Wipes all state. Resets simulating state.
         */
        close() {
            for (let [pos, tile] of this.#grid.statefulTiles()) {
                tile.state = undefined;
                this.#grid.rerenderTileInContainer(...pos);
            }

            this.#trainCon.clearBodies();
            this.#grid.simulation = undefined;
        }
    }

    class Iterator implements IterableIterator<GridStep> {
        #grid: TileGrid;
        done: boolean = false;
        curs: Map<StatefulTile, GridCursor>;
    
        constructor(grid: TileGrid) {
            this.#grid = grid;

            this.curs = new Map(
                Array.from(
                    this.#grid.statefulTiles(), 
                    ([pos, tile]) => [tile, new GridCursor(grid, pos)] as const
                )
            );
        }
    
        next() {
            // Computing a step takes a few stages:
            // 1. Step
            //      The step functions are called on each applicable tile, 
            //      and trains are designated as exiting.
            // 2. Collision check
            //      Check for edge collisions and center collisions.
            // 3. Deploy
            //      Send exiting trains to enter neighbors.
            // 4. Finalize
            //      Accept entering trains.

            let deploys: GridStep = new Map();
            let done = true;

            for (let [_, tile] of this.#grid.statefulTiles()) {
                const trainState = tile.state!.trainState;
    
                if (trainState.length > 0) {
                    tile.step(this.curs.get(tile)!);
                    done = false;
                }
            }
    
            if (done) {
                return {value: undefined, done: true as const};
            }
    
            let trainEdges = new Focus.FocusMap<[TrainState, Train][]>(this.#grid);

            // check intra collisions
            for (let [pos, tile] of this.#grid.statefulTiles()) {
                const trainState = tile.state!.trainState;

                for (let t of trainState.exitingTrains) {
                    trainEdges.setDefault([pos, t.dir], () => []).push([trainState, t]);
                }
            }

            // check inter collisions: mix/merge trains on the same edge
            for (let trains of trainEdges.values()) {
                if (trains.length > 1) {
                    const trainColors = trains.map(([_, t]) => t.color);
                    const color = Color.mixMany(trainColors)!;
                    for (let [trainState, t] of trains) {
                        trainState.replaceExit(t, {color, dir: t.dir}, Step.EdgeCollision);
                    }
                }
            }

            // deploy
            for (let [pos, tile] of this.#grid.statefulTiles()) {
                const trainState = tile.state!.trainState;
                trainState.deployExiting(this.curs.get(tile)!);

                if (trainState.tileMoves.length > 0) {
                    const i = Grids.cellToIndex(this.#grid, pos);
                    deploys.set(i, [...trainState.tileMoves]);
                    trainState.tileMoves.length = 0;
                }
            }

            // finalize
            for (let [_, tile] of this.#grid.statefulTiles()) {
                tile.state!.trainState.finalize();
            }
    
            return {value: deploys, done: false as const};
        }
    
        [Symbol.iterator]() {
            return this;
        }
    }
}

const TRAIN_CRASH = Symbol("train crashed");

type TrainImage = void | typeof TRAIN_CRASH | Train | Train[];
type NormalizedImage = typeof TRAIN_CRASH | Train[];
type TrainDeploy = (t: Train) => TrainImage;

class TrainState {
    /**
     * A list of the trains currently on the tile.
     */
    #trains: Train[];

    /**
     * Trains that are entering this tile in finalization.
     */
    #enteringTrains: Train[] = [];

    /**
     * Trains that will be exiting this tile in deploy.
     */
    #exitingTrains: Train[] = [];

    /**
     * Path that a train took through this tile.
     */
    #paths: (readonly [pre: Train, im: Train])[] = []
    /**
     * A mapping keeping track of which trains moved to where during the step calculation.
     * It is used during finalization to move train sprites on the stage.
     */
    tileMoves: Move[] = [];

    constructor(iter: Iterable<Train> = []) {
        this.#trains = Array.from(iter);
    }

    get length() {
        return this.#trains.length;
    }

    get trains(): readonly Train[] {
        return this.#trains;
    }
    get exitingTrains(): readonly Train[] {
        return this.#exitingTrains;
    }
    
    replaceExit(exiting: number | Train, newExiting: Train, step: Step) {
        let i: number;
        if (typeof exiting === "object") {
            i = this.exitingTrains.indexOf(exiting);
        } else {
            i = exiting;
            exiting = this.exitingTrains[i];
        }

        if (i === -1) {
            const {color, dir} = exiting;
            throw new Error(`Train[color=${color}, dir=${dir}] isn't exiting`);
        }
        if (exiting === newExiting) return;
        this.#exitingTrains[i] = newExiting;
        this.#trackMove(exiting, [newExiting], step);
    }

    sendToExit(preimage: Train, image: NormalizedImage) {
        if (image === TRAIN_CRASH) {
            this.#trackMove(preimage, image, Step.Main);
            return;
        }

        const pimPairs = image.map(t => [preimage, t] as const);
        
        this.#trackMove(preimage, image, Step.Main);
        this.#exitingTrains.push(...image);
        this.#paths.push(...pimPairs);
    }

    mergePass(m: Move.Pass) {
        let mergingMove = this.tileMoves.find((tm): tm is Move.Pass => tm.move === "pass" && tm.image === m.preimage)!;
        
        mergingMove.image = m.image;
        mergingMove.step = m.step;
    }

    deployExiting(cur: GridCursor) {
        // merge trains that are leaving the same edge
        const groupMap = new Map<Dir, Train[]>();
        for (let t of this.#exitingTrains) {
            groupMap.setDefault(t.dir, () => []).push(t);
        }

        for (let [d, trains] of groupMap) {
            const nb = cur.neighbor(d);
            
            let t: Train;
            if (trains.length > 1) {
                const tc = trains.map(t => t.color);
                t = {dir: d, color: Color.mixMany(tc)!};
                this.#trackMerge(trains, t, Step.Deploy);
            } else {
                t = trains[0];
            }

            if (nb?.accepts(t)) {
                nb.state!.trainState.#enteringTrains.push(t);
            } else {
                this.#trackMove(t, TRAIN_CRASH, Step.Deploy);
            }
        }

        this.#exitingTrains.length = 0;
    }

    /**
     * After all the steps have been computed, this should be called.
     */
    finalize() {
        // do train collapsing here
        this.#trains.push(...this.#enteringTrains);
        this.#enteringTrains = [];
    }

    #trackMerge(preimage: Train[], image: Train, step: Step) {
        // if only 1 preimage, this is just an extension of the previous move
        if (preimage.length == 1) {
            const im = this.tileMoves.find((m): m is Move.Pass => m.move == "pass" && m.image == preimage[0]);
            if (im) {
                im.image = image;
            } else {
                this.#trackMove(preimage[0], [image], step);
            }
        } else {
            this.tileMoves.push({
                step,
                move: "merge",
                preimage,
                image
            });
        }
    }
    #trackMove(preimage: Train, image: NormalizedImage, step: Step) {
        let move: Move;
        
        if (image === TRAIN_CRASH) {
            move = {
                step,
                move: "destroy",
                preimage,
                crashed: true
            };
        } else if (image.length == 0) {
            move = {
                step,
                move: "destroy",
                preimage,
                crashed: false
            };
        } else if (image.length == 1) {
            move = {
                step,
                move: "pass",
                preimage,
                image: image[0]
            };
        } else {
            move = {
                step,
                move: "split",
                preimage,
                image
            };
        }

        this.tileMoves.push(move);
        return move;
    }

    #normalizeImage(image: ReturnType<TrainDeploy>): NormalizedImage {
        image ??= [];

        if (image === TRAIN_CRASH) {
            return TRAIN_CRASH;
        };
    
        if (!(image instanceof Array)) image = [image];
        return image;
    }
    #computeImage(preimage: Train, f?: TrainDeploy): NormalizedImage {
        return f ? this.#normalizeImage(f(preimage)) : [preimage];
    }

    /**
     * Take out one train from the list of trains and send it to a neighboring tile.
     * @param f a function which modifies how the train exits the tile.
     *     The direction of the train designates which neighbor the train goes to.
     */
    deployOne(f?: TrainDeploy) {
        const preimage = this.#trains.shift()!;

        if (preimage) {
            // convert image result into Train[]
            let image = this.#computeImage(preimage, f);

            this.sendToExit(preimage, image);
        }
    }
    
    /**
     * Take out every train from the list of trains and send them to neighboring tiles.
     * @param f  a function which modifies how the train exits the tile.
     *     The direction of the train designates which neighbor the train goes to.
     */
    deployAll(f?: TrainDeploy) {
        while (this.#trains.length > 0) this.deployOne(f);
    }
}

export abstract class Tile {
    /**
     * Char this is represented with during serialization. If not serialized, serChar is " ".
     */
    readonly serChar: string = " ";

    /**
     * Which layer of the grid container is this object rendered on?
     */
    readonly layer: number = Layer.BOXES;

    /**
     * If this tile can be overwritten by a rail tile in rail edit mode.
     */
    readonly railable: boolean = false;

    /**
     * Check if the specified train would be able to enter the tile.
     * @param train
     * @returns false
     */
    accepts(train: Train): this is StatefulTile {
        return false;
    }

    /**
     * Create the Container that displays this tile.
     * @param resources Rendering objects from PIXI
     * @param size Size of the tile
     */
    abstract render(resources: PIXIResources, size: number, drag: boolean): PIXI.Container;

    /**
     * Create a copy of this tile.
     */
    abstract clone(): Tile;
}

type TileState = {
    /**
     * The state of trains of the tile at the current step
     */
    trainState: TrainState;
}

export abstract class StatefulTile<S extends TileState = TileState> extends Tile {
    /**
     * Holds the state for the tile during simulation.
     */
    state: S | undefined;

    /**
     * The sides that trains can enter this tile through.
     * Note that if an active left side accepts right-facing trains.
     */
    readonly actives: Dir.Flags;

    /**
     * Char this is represented with during serialization. If not serialized, serChar is " ".
     */
    readonly serChar: string = " ";

    constructor(...actives: Dir[]) {
        super();
        this.actives = new Dir.Flags(actives);
    }


    /**
     * @returns a default state initialization, for any StatefulTile<TileState>
     */
    createDefaultState(this: StatefulTile<TileState>): TileState {
        return {
            trainState: new TrainState(),
        };
    }

    /**
     * Create the state for the simulation.
     * Classes that extend StatefulTile<TileState> can use `createDefaultState` as a default implementation.
     */
    abstract createState(): S;

    /**
     * Initializes the state using `createState`. This is called before a simulation begins.
     */
    initState() {
        this.state = this.createState();
    }

    /**
     * Check if the specified train would be able to enter the tile.
     * @param train
     * @returns true if the train can enter
     */
    accepts(train: Train) {
        return this.actives.has(Dir.flip(train.dir));
    }

    /**
     * Indicates what this tile should do during the step (is only called if the tile has a train).
     * Should only be called during simulation.
     * @param cur Cursor that allows interaction with the tiles around
     */
    abstract step(cur: GridCursor): void;

    abstract clone(): StatefulTile;
}

export namespace Tile {

    /**
     * Tile which trains appear from.
     */
    export class Outlet extends StatefulTile implements Serializable {
        /**
         * The output side.
         */
        readonly out: Dir;

        /**
         * The colors of trains that this outlet stores.
         */
        readonly colors: readonly Color[];

        readonly serChar = "+";

        constructor(out: Dir, colors: readonly Color[]) {
            super();
            this.out = out;
            this.colors = colors;
        }

        createState(): TileState {
            const {colors, out} = this;
            
            return {
                ...this.createDefaultState(),
                trainState: new TrainState(
                    Array.from(colors, color => ({color, dir: out}))
                )
            };
        }

        step(cur: GridCursor): void {
            // While the outlet has trains, deploy one.
            this.state!.trainState.deployOne();
            cur.updateRender(0, con => {
                const symbols = con.getChildByName("symbols", false) as PIXI.Container;
                symbols.removeChildAt(0).destroy({children: true});
            });
        }
        
        toJSON() {
            return {out: this.out, colors: this.colors.map(c => Color[c])};
        }

        static fromJSON({out, colors}: {out: Dir, colors: string[]}) {
            const outR = Dir.parse(out);
            const colorsR = colors.map(Color.parse);

            return new Outlet(outR, colorsR);
        }

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Container();

            const [box, inner] = TileGraphics.box(resources, {ratio: TileGraphics.Ratios.Box.Outline.OUTLET}, size);
            
            const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as const;
            const symbols = TileGraphics.symbolSet(
                resources, this.colors, [center, inner, size], "plus"
            );
            symbols.name = "symbols";

            const exit = TileGraphics.passiveSide(resources, this.out, size);
            
            con.addChild(exit, box, symbols);
            return con;
        }

        clone() {
            return new Outlet(this.out, [...this.colors]);
        }
    }
    
    type GoalState = TileState & {
        /**
         * The trains needed to complete the goal
         */
        remaining: Color[]
    }
    /**
     * Tiles which trains must go to.
     */
    export class Goal extends StatefulTile<GoalState> implements Serializable {
        /**
         * The train colors this goal block wants. If met, the color is switched to undefined.
         */
        readonly targets: readonly Color[];
        readonly serChar = "o";

        constructor(entrances: readonly Dir[], targets: readonly Color[]) {
            super(...entrances);
            this.targets = targets;
        }
    
        createState(): GoalState {
            return {
                ...this.createDefaultState(),
                remaining: [...this.targets]
            };
        }

        step(cur: GridCursor): void {
            let {remaining, trainState} = this.state!;

            trainState.deployAll(train => {
                let i = remaining.indexOf(train.color);
                if (i != -1) {
                    remaining.splice(i, 1);
                    cur.updateRender(0.5, con => {
                        const targets = con.getChildByName("targets") as PIXI.Container;
                        targets.removeChildAt(i).destroy({children: true});
                    });

                    return;
                }
                return TRAIN_CRASH;
            });
        }
    
        toJSON() {
            return {targets: this.targets.map(c => Color[c]), actives: this.actives.bits};
        }

        static fromJSON({targets, actives}: {targets: string[], actives: number}) {
            const targetsR = targets.map(Color.parse);
            const entrances = [...new Dir.Flags(actives)];

            return new Goal(entrances, targetsR);
        }

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Container();

            const [box, inner] = TileGraphics.box(resources, {color: Palette.Box.Outline.Goal}, size);
            
            const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as const;
            const symbols = TileGraphics.symbolSet(
                resources, this.targets, [center, inner, size], "circle"
            );
            symbols.name = "targets";
            
            let activeSides = Array.from(this.actives, e => TileGraphics.activeSide(resources, e, size));
            
            con.addChild(...activeSides, box, symbols);
            return con;
        }

        clone() {
            return new Goal([...this.actives], [...this.targets]);
        }
    }
    
    /**
    * Tiles which paint the train.
    */
    export class Painter extends StatefulTile implements Serializable {
        readonly color: Color;
        readonly serChar = "p";

        constructor(actives: readonly [Dir, Dir], color: Color) {
            const [a1, a2] = actives;
            super(a1, a2);
            this.color = color;
        }
    
        createState(): TileState {
            return this.createDefaultState();
        }

        step(cur: GridCursor): void {
            // Paint the train and output it.
            this.state!.trainState.deployAll(train => {
                // Get the output direction.
                let outDir: Dir = this.actives.dirExcluding(Dir.flip(train.dir));
    
                return {
                    color: this.color,
                    dir: outDir
                };
            });
        }
        
        toJSON() {
            return {actives: this.actives.bits, color: Color[this.color]};
        }

        static fromJSON({actives, color}: {actives: number, color: string}) {
            const colorR = Color.parse(color);
            const activesR = new Dir.Flags(actives);

            if (activesR.ones != 2) throw new TypeError("Painter must have 2 active sides");
            const [a1, a2] = activesR;
            return new Painter([a1, a2], colorR);
        }

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Graphics();

            const [box] = TileGraphics.box(resources, {color: Palette.Train[this.color]}, size);
            
            const painter = TileGraphics.painterSymbol(resources, this.color, size);
            const activeSides = Array.from(this.actives, e => TileGraphics.activeSide(resources, e, size));

            con.addChild(...activeSides, box, painter);
            return con;
        }

        clone() {
            const [d1, d2] = this.actives;
            return new Painter([d1, d2], this.color);
        }
    }
    
    /**
     * Tiles which split the train into 2 trains.
     */
    export class Splitter extends StatefulTile implements Serializable {
        /**
         * The active side.
         * Note that: If this goal accepts right-facing trains, it has a left-facing active side.
         */
        readonly active: Dir;
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

        createState(): TileState {
            return this.createDefaultState();
        }

        step(cur: GridCursor): void {
            const [ldir, rdir] = this.sides;

            this.state!.trainState.deployAll(train => {
                // Split train's colors, pass the new trains through the two passive sides.
                const [lclr, rclr] = Color.split(train.color);

                return [
                    { color: lclr, dir: ldir },
                    { color: rclr, dir: rdir }
                ];
            });
        }

        toJSON() {
            return {actives: this.actives.bits};
        }
        static fromJSON({actives}: {actives: number}) {
            const af = new Dir.Flags(actives);
            if (af.ones != 1) throw new TypeError("Splitter must have 1 active side");

            const [active] = af;
            return new Splitter(active);
        }

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Container();

            const [box] = TileGraphics.box(resources, {}, size);
            con.addChild(box);
            
            const splitter = TileGraphics.splitterSymbol(resources, this.active, size);
            
            const sides = [
                TileGraphics.activeSide(resources, this.active, size),
                ...this.sides.map(s => TileGraphics.passiveSide(resources, s, size))
            ];
            
            con.addChild(...sides, box, splitter);
            return con;
        }

        clone() {
            return new Splitter(this.active);
        }
    }
    
    export class Blank extends Tile {
        readonly serChar = " ";
        readonly railable = true;

        render(_resources: unknown, size: number, drag: boolean): PIXI.Container {
            const con = new PIXI.Container();

            if (drag) {
                const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
                sprite.width = size;
                sprite.height = size;
                sprite.tint = Palette.BG;
                con.addChild(sprite);
            } else {
                con.visible = false;
            }
            return con;
        }

        clone() {
            return new Blank();
        }
    }

    export class Rock extends Tile {
        readonly serChar = "r";

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Container();

            con.addChild(TileGraphics.rock(resources, size));

            return con;
        }

        clone() {
            return new Rock();
        }
    }
    
    export abstract class Rail<S extends TileState = TileState> extends StatefulTile<S> {
        readonly layer: number = Layer.RAILS;
        readonly railable = true;

        constructor(entrances: Dir[] | Dir.Flags) {
            super(...entrances);
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

        protected static redirect(d: Dir, path: Dir.Flags) {
            let enterDir = Dir.flip(d);
            
            // A train that entered through one entrance exits through the other entrance
            if (path.has(enterDir)) {
                return path.dirExcluding(enterDir);
            }

            // invalid state if not in the path
        }

        abstract top(): SingleRail;

        updateContainer(cur: GridCursor) {

        }

        abstract clone(): Rail<S>;
    }
    
    export class SingleRail extends Rail {
        constructor(dir1: Dir, dir2: Dir) {
            if (dir1 === dir2) throw new Error("Invalid single rail");
            super([dir1, dir2]);
        }
    
        createState(): TileState {
            return this.createDefaultState();
        }

        step(cur: GridCursor): void {
            const trainState = this.state!.trainState;
            const color = Color.mixMany(trainState.trains.map(t => t.color))!; // there has to be trains if step was called

            trainState.deployAll(({dir}) => {
                const newDir = Rail.redirect(dir, this.actives);

                if (typeof newDir === "number") return {color, dir: newDir};
                // invalid state if undefined
            });
            this.updateContainer(cur);
        }

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Container();
            con.addChild(TileGraphics.rail(resources, [...this.actives], size));
            return con;
        }

        top() {
            return this;
        }

        clone() {
            const [d1, d2] = this.actives;
            return new SingleRail(d1, d2);
        }
    }
    
    type DoubleRailState = TileState & {
        /**
         * The index of the path that's currently considered "the top"
         */
        topIndex: 0 | 1;
    };

    export class DoubleRail extends Rail<DoubleRailState> {
        readonly paths: readonly [Dir.Flags, Dir.Flags];
        readonly #overlapping: boolean;
    
        constructor(paths: [Dir.Flags, Dir.Flags]) {
            let [e0, e1] = paths;
            if (e0.equals(e1)) {
                throw new Error("Rails match");
            }
            super(e0.or(e1));
            this.paths = paths;
            this.#overlapping = [...this.actives].length < 4;
        }
    
        createState(): DoubleRailState {
            return {
                ...this.createDefaultState(),
                topIndex: 0
            };
        }

        step(cur: GridCursor): void {
            const state = this.state!;
            const trainState = state.trainState;
            
            const redirects = trainState.trains.length;
            const paths: typeof this.paths = [state.topIndex, 1 - state.topIndex].map(i => this.paths[i]) as any;

            const trains = this.state!.trainState.trains;
            let pathTrains: [Train[], Train[]] = [[], []];
            for (let t of trains) {
                const i = paths.findIndex(p => p.has(Dir.flip(t.dir)));
                if (i !== -1) pathTrains[i].push(t);
            }

            let pathColors: [Color, Color];
            if (!this.#overlapping && this.crossesOver) { // + rail
                const color = Color.mixMany(trains.map(t => t.color))!; // there has to be trains if step was called
                pathColors = [color, color];
            } else {
                pathColors = pathTrains.map(trains => {
                    const clrs = trains.map(t => t.color);
    
                    if (clrs.length > 0) return Color.mixMany(clrs);
                }) as any;
            }

            trainState.deployAll(({dir}) => {
                const i = paths.findIndex(p => p.has(Dir.flip(dir)));

                if (i !== -1) {
                    const exitDir = Rail.redirect(dir, paths[i]);
                    if (typeof exitDir === "number") return {color: pathColors[i]!, dir: exitDir};
                }

                return TRAIN_CRASH;
            });

            state.topIndex += redirects;
            state.topIndex %= 2;

            this.updateContainer(cur);
        }

        render(resources: PIXIResources, size: number): PIXI.Container {
            const con = new PIXI.Container();

            const rails = this.paths.map(p => TileGraphics.rail(resources, [...p], size));

            if (this.#overlapping) {
                rails[1].tint = Palette.Shadow;
            }
            
            rails.reverse();
            con.addChild(...rails);

            return con;
        }

        /**
         * @returns the flipped version of the double rail, where the other rail is on top
         */
        flipped() {
            const [p0, p1] = this.paths;
            return new DoubleRail([p1, p0]);
        }

        top() {
            let [d1, d2] = this.paths[0];
            return new Tile.SingleRail(d1, d2);
        }

        get crossesOver() {
            if (this.#overlapping) return true;

            const [[a1, a2], [b1, b2]] = this.paths;

            // if true, this is the + rail
            // if false, this is the wavy rail.
            return (a2 - a1) % 2 == 0 && (b2 - b1) % 2 == 0;
        }
        updateContainer(cur: GridCursor): void {
            cur.updateRender(1, con => {
                const [c1, c2] = con.children as PIXI.Sprite[];
    
                [c1.tint, c2.tint] = [c2.tint, c1.tint];
                con.swapChildren(c1, c2);
            });
        }

        clone() {
            return new DoubleRail([...this.paths]);
        }
    }

    export let deserChars = {
        " ": Blank,
        "+": Outlet,
        "o": Goal,
        "p": Painter,
        "s": Splitter,
        "r": Rock
    }
}