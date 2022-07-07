import { Atlas, CellPos, Color, Dir, DirFlags, Grids, Palette, PixelPos, Train } from "./values";
import * as PIXI from "pixi.js";
import * as TileGraphics from "./graphics/components";
import { GridContainer, TrainContainer } from "./graphics/grid";
import "./ext/array";

type Edge   = [c1: CellPos, c2: CellPos];
type Center = [center: CellPos, _: undefined];
type RailTouch = Edge | Center;
type EditMode = 
    | "readonly"  // Active while a simulation. You cannot edit any tiles.
    | "rail"      // Active while solving. You can only draw rails.
    | "railErase" // Active while solving (while erasing). You can only erase rails.
    | "select"    // Active while level editing. Allows you to select and edit tiles.
type Event =
    | `exit${Capitalize<EditMode>}`
    | `enter${Capitalize<EditMode>}`
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

interface Serializable<J = any> {
    /**
     * Designate how to convert this object into JSON.
     */
    toJSON(): J;
    // static fromJSON(o: J): this;
}

interface PIXIData {
    textures: Atlas,
    renderer: PIXI.AbstractRenderer
};
interface GridJSON {
    board: string[], 
    tiles: {[x: number]: unknown}
}

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

    /**
     * If false, a train crashed.
     */
    passing: boolean = true;

    /**
     * Cache for this.container
     */
    #c_container?: GridContainer;
    #trainCon?: TrainContainer;

    /**
     * Object references coming from PIXI
     */
    pixi: PIXIData;

    /**
     * Determines what can be edited on the grid
     */
    #editMode: EditMode = "rail";

    /**
     * Map keeping track of listeners listening to an event
     */
    #eventListeners: Partial<{[E in Event]: Array<() => void>}> = {}

    /**
     * Stack keeping track of all the past actions (allowing for undoing)
     */
    #actionStack: Action[] = [];

    simulation?: Simulation;

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

    constructor(cellSize: number, cellLength: number, pixi: PIXIData, tiles?: (Tile | undefined)[][]) {
        this.cellSize = cellSize;
        this.cellLength = cellLength;
        this.#tiles = TileGrid.#normalizeTileMatrix(tiles, cellLength);

        this.pixi = pixi;

        this.on("enterReadonly", () => {
            this.startSim();
        });
        this.on("exitReadonly", () => {
            this.simulation?.close();
            this.simulation = undefined;
        });
    }

    /**
     * The PIXI container for this TileGrid
     */
    get container(): GridContainer {
        return this.#c_container ??= this.#renderContainer();
    }

    static #normalizeTileMatrix(mat: (Tile | undefined)[][] | undefined, length: number): Tile[][] {
        return Array.from({length}, (_, y) => 
            Array.from({length}, (_, x) => mat?.[y]?.[x] ?? new Tile.Blank())
        );
    }

    get maybeContainer(): GridContainer | undefined { return this.#c_container; }

    get tiles(): Tile[][] { return this.#tiles; }
    set tiles(mat: (Tile | undefined)[][]) {
        this.#tiles = TileGrid.#normalizeTileMatrix(mat, this.cellLength);
        this.#actionStack = []; // the tiles got reset, so can't do undos from here

        if (this.#c_container) {
            this.#c_container.destroy({children: true});
            this.#c_container = this.#renderContainer();
        }
    }

    load(tiles: (Tile | undefined)[][] | GridJSON): this {
        if ("board" in tiles) {
            [tiles, this.cellLength] = TileGrid.#tilesFromJSON(tiles);
        }

        this.tiles = tiles;
        return this;
    }

    get editMode(): EditMode { return this.#editMode; }
    set editMode(em: EditMode) {
        if (this.#editMode !== em) {
            this.#dispatchEvent(`exit${capitalize(this.#editMode)}`);
            
            this.#editMode = em;
            
            this.#dispatchEvent(`enter${capitalize(em)}`);
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
        this.simulation = new Simulation(this, this.#trainCon!);
    }


    dispatchFailEvent() {
        this.#dispatchEvent("fail");
    }

    /**
     * Check if rails can be placed on this type of tile
     * @param t tile (`undefined` represents an OOB tile)
     * @returns true if can be placed
     */
    static canRail(t: Tile | undefined): boolean {
        return t instanceof Tile.Blank || t instanceof Tile.Rail;
    }

    /**
     * Get this tile's rendered PIXI container
     * @param x cell x
     * @param y cell y
     * @returns the container holding the rendering
     */
    #renderTileAt(x: number, y: number): PIXI.Container {
        return this.tile(x, y)!.render(this.pixi, this.cellSize);
    }

    /**
     * Generate the tile grid's rendered PIXI container
     * Use this.container to fallback to cache if already created
     * @returns the container
     */
    #renderContainer(): GridContainer {
        const length = this.cellLength;
        const con = new GridContainer(this);
        con.loadCells(
            Array.from({length}, (_, y) => 
                Array.from({length}, (_, x) =>
                    this.#renderTileAt(x, y)
                )
            )
        );

        const trainCon = this.#trainCon = new TrainContainer(this);
        trainCon.name = "trains";
        con.addChild(trainCon);

        con.interactive = true;
        this.#applyPointerEvents(con);
        this.#applyRailIndicator(con);

        return con;
    }

    /**
     * Replace the container currently at the tile position with a rerendered version of the tile
     * @param x x coord
     * @param y y coord
     */
    rerenderTileInContainer(x: number, y: number) {
        this.#c_container?.replaceCell([x, y], this.#renderTileAt(x, y));
    }

    /**
     * Apply pointer events like click, drag, etc. to a container
     * @param con Container to apply to.
     */
    #applyPointerEvents(con: PIXI.Container) {
        let pointers = 0;

        // In rail mode, this pointer is used to track the last pointed-to edge or center.
        // On an initial click, this can be bound to an edge or a center.
        // While dragging, this can only bind to edges.
        let cellPointer: RailTouch | undefined = undefined;

        con.on("pointermove", (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(this, pos);
            
            // pointer === 1 implies drag
            if (pointers !== 1) {
                // If pointers increases or decreases, then the cellPointer is useless.
                cellPointer = undefined;
            } else {
                const editMode = this.#editMode;

                if (editMode === "rail") {
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
                    }
    
                    cellPointer = nCellPointer;
                } else {
                    // useless if not rail mode
                    cellPointer = undefined;

                    if (editMode === "readonly") {
                        return;
                    } else if (editMode === "railErase") {
                        this.replaceTile(...cellPos, t => {
                            return t instanceof Tile.Rail ? undefined : t;
                        });
                    } else if (editMode === "select") {
                        // TODO
                    } else {
                        let _: never = editMode;
                    }
                }
            }
        });

        let dbtTile: CellPos | undefined;
        let dbtTimeout: NodeJS.Timeout | undefined;
        const DBT_TIMEOUT_MS = 1000;

        con.on("pointerdown", (e: PIXI.InteractionEvent) => {
            pointers++;

            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(this, pos);

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

            const editMode = this.#editMode;
            if (editMode === "rail") {
                let edge = this.nearestEdge(pos, cellPos);
                cellPointer = [
                    cellPos, 
                    typeof edge !== "undefined" ? Dir.shift(cellPos, edge) : undefined
                ];
            } else {
                // useless if not rail mode
                cellPointer = undefined;

                if (editMode === "railErase") {
                    this.replaceTile(...cellPos, t => {
                        return t instanceof Tile.Rail ? undefined : t;
                    });
                } else if (editMode === "readonly") {
                    return;
                } else if (editMode === "select") {
                    // TODO
                } else {
                    let _: never = editMode;
                }
            }
        });

        function pointerup(e: PIXI.InteractionEvent) {
            pointers = Math.max(pointers - 1, 0);
            cellPointer = undefined;
        }
        con.on("pointerup", pointerup);
        con.on("pointerupoutside", pointerup);

        con.on("pointercancel", (e: PIXI.InteractionEvent) => {
            pointers = 0;
            cellPointer = undefined;
        })
    }

    /**
     * On desktop, display a rail indicator that marks which edge the mouse is nearest to.
     * (This is not supported on mobile cause it looks bad and is not properly functional on mobile)
     * @param con Container to apply to
     */
    #applyRailIndicator(con: PIXI.Container) {
        const TILE_GAP = Grids.TILE_GAP;
        const DELTA = this.cellSize + TILE_GAP;

        const railMarker = TileGraphics.hoverIndicator(this.pixi.textures);
        railMarker.width = this.cellSize;
        railMarker.height = this.cellSize;
        railMarker.tint = Palette.Hover;
        railMarker.blendMode = PIXI.BLEND_MODES.SCREEN;
        railMarker.visible = false;
        railMarker.interactive = true;
        railMarker.cursor = "grab";
        con.addChild(railMarker);

        const enum Condition {
            IN_BOUNDS, MOUSE_UP, RAILABLE
        };
        let visibility = [
            false, true, false
        ];
        
        // this syntax is necessary to avoid scoping `this`
        let updateVisibility = () => {
            railMarker.visible = visibility.every(t => t) && this.#editMode === "rail";
        };

        con.on("mousemove", (e: PIXI.InteractionEvent) => {
            const pos = e.data.getLocalPosition(con);
            const cellPos = Grids.positionToCell(this, pos);
            const [cellX, cellY] = cellPos;

            let dir = this.nearestEdge(pos, cellPos);

            if (typeof dir === "undefined") {
                visibility[Condition.RAILABLE] = false;
            } else {
                let tile = this.tile(...cellPos);

                // If you can place a rail on this tile, mark the tile on the nearest edge
                if (TileGrid.canRail(tile)) {
                    visibility[Condition.RAILABLE] = true;
                    railMarker.position.set(
                        TILE_GAP + cellX * DELTA + railMarker.width / 2, 
                        TILE_GAP + cellY * DELTA + railMarker.height / 2
                    );
                    railMarker.angle = -90 * dir;
                } else {
                    let neighborPos = Dir.shift(cellPos, dir);
                    let neighbor = this.tile(...neighborPos);

                    if (TileGrid.canRail(neighbor)) {
                        visibility[Condition.RAILABLE] = true;

                        const [nx, ny] = neighborPos;
                        railMarker.position.set(
                            TILE_GAP + nx * DELTA + railMarker.width / 2, 
                            TILE_GAP + ny * DELTA + railMarker.height / 2
                        );
                        railMarker.angle = -90 * Dir.flip(dir);
                    } else {
                        visibility[Condition.RAILABLE] = false;
                    }
                }
            }
            updateVisibility();
        })

        con.on("mousedown", (e: PIXI.InteractionEvent) => {
            visibility[Condition.MOUSE_UP] = false;
            updateVisibility();
        });
        con.on("mouseup", (e: PIXI.InteractionEvent) => {
            visibility[Condition.MOUSE_UP] = true;
            updateVisibility();
        });
        con.on("mouseupoutside", (e: PIXI.InteractionEvent) => {
            visibility[Condition.MOUSE_UP] = true;
            updateVisibility();
        });

        con.on("mouseover", (e: PIXI.InteractionEvent) => {
            visibility[Condition.IN_BOUNDS] = true;
            updateVisibility();
        });
        con.on("mouseout", (e: PIXI.InteractionEvent) => {
            visibility[Condition.IN_BOUNDS] = false;
            updateVisibility();
        });
    }

    /**
     * Handles what happens when a tile is double tapped
     * @param dbtTile the tile that was double tapped
     */
    #onDoubleTap(dbtTile: CellPos) {
        if (this.#editMode === "rail") {
            // double tap to swap rails (on a double rail)
            this.replaceTile(...dbtTile, t => {
                if (t instanceof Tile.DoubleRail) {
                    return t.flipped();
                }
                return t;
            });
        }
    }
    
    /**
     * Add a handler for when an event occurs
     * @param event
     * @param handler
     */
    on(event: Event, handler: () => void) {
        const listeners = this.#eventListeners[event] ??= [];
        listeners.push(handler);
    }

    /**
     * Call all the event handlers for this event
     * @param e event
     */
    #dispatchEvent(e: Event) {
        const listeners = this.#eventListeners[e] ??= [];

        for (let f of listeners) f();
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
        let length = board.length;

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

        return [newTiles, length] as [Tile[][], number];
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

    /**
     * @returns the container of the tile the cursor is pointing to
     */
    container() {
        return this.#grid.container.cellAt(this.#pos);
    }

    fail() {
        this.#grid.simulation!.fail();
    }
}

class Simulation {
    #grid: TileGrid;
    passing: boolean = true;
    #trainCon?: TrainContainer;

    constructor(grid: TileGrid, tc: TrainContainer) {
        this.#grid = grid;
        this.#trainCon = tc;

        for (let [pos, tile] of this.#statefulTiles()) {
            tile.initState();
            for (let t of tile.state!.trainState.trains) {
                this.#trainCon!.createBody(pos, t);
            }
        }
    }

    #statefulTiles() {
        return this.#grid.statefulTiles();
    }

    /**
     * Iterate one step through the board.
     */
    step() {
        for (let [pos, tile] of this.#statefulTiles()) {
            if (tile.state!.trainState.length > 0) {
                tile.step(new GridCursor(this.#grid, pos));
            }
        }

        this.#finalizeStep();
    }

    /**
     * Run everything to complete the step.
     */
    #finalizeStep() {
        for (let [_, tile] of this.#statefulTiles()) {
            tile.state!.trainState.finalize();
        }
        for (let [pos, tile] of this.#statefulTiles()) {
            this.#trainCon!.moveBodies(pos, tile.state!.trainState.deployedTrains);
        }
    }

    /**
     * Wipes all state. Resets simulating state.
     */
    close() {
        for (let [pos, tile] of this.#statefulTiles()) {
            tile.state = undefined;
            this.#grid.rerenderTileInContainer(...pos);
        }

        this.#trainCon!.clearBodies();
        this.#grid.simulation = undefined;
    }

    fail() {
        if (this.passing) {
            this.passing = false;
            this.#grid.dispatchFailEvent();
        }
    }
}

type TrainStateOptions = Partial<{
    mergeTrains: boolean
}>;

export namespace Move {
    export interface Destroy {
        move: "destroy",
        preimage: Train
    }

    export interface Pass {
        move: "pass",
        preimage: Train,
        image: Train
    }

    export interface Split {
        move: "split",
        preimage: Train,
        image: Train[]
    }

    export interface Merge {
        move: "merge",
        preimage: Train[],
        image: Train
    }
}
export type Move = Move.Destroy | Move.Pass | Move.Split | Move.Merge;

class TrainState {
    /**
     * A list of the trains currently on the tile.
     */
    #trains: Train[];

    /**
     * A list of trains that will be on the tile after all step computations are complete.
     */
    #pendingTrains: Train[] = [];

    /**
     * A mapping keeping track of which trains moved to where during the step calculation.
     * It is used during finalization to move train sprites on the stage.
     */
    deployedTrains: Move[] = [];

    doTrainsMerge: boolean = true;

    constructor(iter: Iterable<Train> = [], options: TrainStateOptions = {}) {
        this.#trains = Array.from(iter);

        if (typeof options.mergeTrains !== "undefined") this.doTrainsMerge = options.mergeTrains;
    }

    get length() {
        return this.#trains.length;
    }

    get trains(): readonly Train[] {
        return this.#trains;
    }
    
    /**
     * After all the steps have been computed, this should be called.
     */
    finalize() {
        // do train collapsing here
        this.#trains.push(...this.#pendingTrains);
        this.#pendingTrains = [];
    }

    /**
     * Take departuring trains and merge trains being deployed to the same place.
     * @param trains trains, uncombined
     * @returns the combined trains
     */
    static #mergeTrains(trains: Train[]): Train[] {
        if (trains.length == 0) return trains;

        // merge all the colors of all the trains going through the rail
        let color = Color.mixMany(trains.map(t => t.color));

        // get all train destinations
        let dest = new Set(trains.map(t => t.dir));

        // create one train per dest.
        return Array.from(dest, dir => ({color, dir}));
    }

    #trackMove(preimage: Train, image: Train[]) {
        let move: Move;

        if (image.length == 0) {
            move = {
                move: "destroy",
                preimage
            }
        } else if (image.length == 1) {
            move = {
                move: "pass",
                preimage,
                image: image[0]
            };
        } else {
            move = {
                move: "split",
                preimage,
                image
            };
        }

        if (move) this.deployedTrains.push(move);
    }

    #computeImage(preimage: Train, f?: (t: Train) => void | Train | Train[]): Train[] {
        if (typeof f === "undefined") return [preimage];

        let image = f(preimage) ?? [];
        if (!(image instanceof Array)) image = [image];

        return image;
    }

    #deployImage(cur: GridCursor, image: Train[]) {
        for (let t of image) {
            const nb = cur.neighbor(t.dir);
            
            if (nb?.accepts(t)) {
                nb.state!.trainState.#pendingTrains.push(t);
            } else {
                cur.fail();
                this.#trackMove(t, []);
            }
        }
    }

    /**
     * Take out one train from the list of trains and send it to a neighboring tile.
     * @param cur current cursor
     * @param f a function which modifies how the train exits the tile.
     *     The direction of the train designates which neighbor the train goes to.
     */
    deployOne(cur: GridCursor, f?: (t: Train) => void | Train | Train[]) {
        const preimage = this.#trains.shift()!;

        if (preimage) {
            // convert image result into Train[]
            let image = this.#computeImage(preimage, f);
    
            this.#trackMove(preimage, image);
            this.#deployImage(cur, image);
        }
    }
    
    /**
     * Take out every train from the list of trains and send them to neighboring tiles.
     * @param cur current cursor
     * @param f  a function which modifies how the train exits the tile.
     *     The direction of the train designates which neighbor the train goes to.
     */
    deployAll(cur: GridCursor, f?: (t: Train) => void | Train | Train[]) {
        // no merge is identical to this
        if (!this.doTrainsMerge) {
            while (this.#trains.length > 0) this.deployOne(cur, f);
            return;
        }

        // get image every preimage maps to
        let imageTrains = this.#trains
            .flatMap(preimage => {
                const image = this.#computeImage(preimage, f);
                this.#trackMove(preimage, image);
                return image;
            });

        // merge the trains, there should be 1 train that exits per direction
        let mergedImage = TrainState.#mergeTrains(imageTrains);

        let imageMap = new Map<Dir, Train[]>();

        for (let t of imageTrains) {
            const {dir} = t;
            if (imageMap.has(dir)) {
                imageMap.get(dir)!.push(t);
            } else {
                imageMap.set(dir, [t]);
            }
        }

        for (let t of mergedImage) {
            this.deployedTrains.push({
                move: "merge",
                preimage: imageMap.get(t.dir)!,
                image: t
            });
        }
        this.#deployImage(cur, mergedImage);

        this.#trains = [];
    }
}

export abstract class Tile {
    /**
     * Char this is represented with during serialization. If not serialized, serChar is " ".
     */
    readonly serChar: string = " ";

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
     * @param pixi Rendering objects from PIXI
     * @param size Size of the tile
     */
    abstract render(pixi: PIXIData, size: number): PIXI.Container;
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
    readonly actives: DirFlags;

    /**
     * Char this is represented with during serialization. If not serialized, serChar is " ".
     */
    readonly serChar: string = " ";

    constructor(...actives: Dir[]) {
        super();
        this.actives = new DirFlags(actives);
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

        constructor(out: Dir, colors: Color[]) {
            super();
            this.out = out;
            this.colors = colors;
        }

        createState() {
            const {colors, out} = this;
            
            return {
                trainState: new TrainState(
                    Array.from(colors, color => ({color, dir: out}))
                )
            };
        }

        step(cur: GridCursor): void {
            // While the outlet has trains, deploy one.
            this.state!.trainState.deployOne(cur);
            const symbols = cur.container().getChildByName("symbols", false) as PIXI.Container;
            symbols.removeChildAt(0).destroy({children: true});
        }
        
        toJSON() {
            return {out: this.out, colors: this.colors.map(c => Color[c])};
        }

        static fromJSON({out, colors}: {out: Dir, colors: string[]}) {
            const outR = Dir.parse(out);
            const colorsR = colors.map(Color.parse);

            return new Outlet(outR, colorsR);
        }

        render({textures, renderer}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box, inner] = TileGraphics.box(renderer);
                con.addChild(box);
                
                const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as const;
                const symbols = TileGraphics.symbolSet(
                    renderer, this.colors, [center, inner], TileGraphics.plus
                );
                symbols.name = "symbols";
                con.addChild(symbols);

                con.addChild(TileGraphics.passiveSide(textures, this.out));
            });
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

        constructor(targets: Color[], entrances: Dir[]) {
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

            trainState.deployAll(cur, train => {
                let i = remaining.indexOf(train.color);
                if (i != -1) {
                    remaining.splice(i, 1);
                    const targets = cur.container().getChildByName("targets", false) as PIXI.Container;
                    targets.removeChildAt(i).destroy({children: true});
                } else {
                    cur.fail();
                }
            });
        }
    
        toJSON() {
            return {targets: this.targets.map(c => Color[c]), actives: this.actives.bits};
        }

        static fromJSON({targets, actives}: {targets: string[], actives: number}) {
            const targetsR = targets.map(Color.parse);
            const entrances = [...new DirFlags(actives)];

            return new Goal(targetsR, entrances);
        }

        render({textures, renderer}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box, inner] = TileGraphics.box(renderer);
                con.addChild(box);
                
                const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as const;
                const symbols = TileGraphics.symbolSet(
                    renderer, this.targets, [center, inner], TileGraphics.circle
                );
                symbols.name = "targets";
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
    export class Painter extends StatefulTile implements Serializable {
        readonly color: Color;
        readonly serChar = "p";

        constructor(color: Color, active1: Dir, active2: Dir) {
            super(active1, active2);
            this.color = color;
        }
    
        createState(): TileState {
            return this.createDefaultState();
        }

        step(cur: GridCursor): void {
            // Paint the train and output it.
            this.state!.trainState.deployAll(cur, train => {
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
            const activesR = new DirFlags(actives);

            if (activesR.ones != 2) throw new TypeError("Painter must have 2 active sides");
            const [a1, a2] = activesR;
            return new Painter(colorR, a1, a2);
        }

        render({textures, renderer}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box] = TileGraphics.box(renderer);
                con.addChild(box);
                
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

            this.state!.trainState.deployAll(cur, train => {
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
            const af = new DirFlags(actives);
            if (af.ones != 1) throw new TypeError("Splitter must have 1 active side");

            const [active] = af;
            return new Splitter(active);
        }

        render({textures, renderer}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const [box] = TileGraphics.box(renderer);
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
    
    export class Blank extends Tile {
        readonly serChar = " ";

        render(): PIXI.Container {
            const con = new PIXI.Container();
            con.visible = false;
            return con;
        }
    }

    export class Rock extends Tile {
        readonly serChar = "r";

        render({textures}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                con.addChild(TileGraphics.rock(textures));
            });
        }
    }
    
    export abstract class Rail<S extends TileState = TileState> extends StatefulTile<S> {
        constructor(entrances: Dir[] | DirFlags) {
            super(...entrances);
        }
    
        step(cur: GridCursor): void {
            this.state!.trainState.deployAll(cur, this.redirect.bind(this));
            this.updateContainer(cur);
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

        updateContainer(cur: GridCursor) {

        }
    }
    
    export class SingleRail extends Rail {
        constructor(dir1: Dir, dir2: Dir) {
            if (dir1 === dir2) throw new Error("Invalid single rail");
            super([dir1, dir2]);
        }
    
        createState(): TileState {
            return this.createDefaultState();
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
    
        render({textures}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                con.addChild(TileGraphics.rail(textures, ...this.actives));
            });
        }

        top() {
            return this;
        }
    }
    
    type DoubleRailState = TileState & {
        /**
         * The index of the path that's currently considered "the top"
         */
        topIndex: 0 | 1;
    };

    export class DoubleRail extends Rail<DoubleRailState> {
        readonly paths: readonly [DirFlags, DirFlags];
        readonly #overlapping: boolean;
    
        constructor(paths: [DirFlags, DirFlags]) {
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
        redirect(t: Train): Train | undefined {
            let {color, dir} = t;
            let enterDir = Dir.flip(dir);
            const state = this.state!;
    
            // Find which path the train is on. Pass the train onto the other side of the path.
            let rails = [state.topIndex, 1 - state.topIndex]
                .map(i => this.paths[i])
                .filter(r => r.has(enterDir));
    
            if (rails.length > 0) {
                // If the double rail merges at a point, then the primary and secondary rails swap.
                if (this.#overlapping) {
                    state.topIndex = 1 - state.topIndex as 0 | 1;
                }
                return { color, dir: rails[0].dirExcluding(enterDir) };
            }
            
            // invalid state: wipe truck from existence
        }

        render({textures}: PIXIData, size: number): PIXI.Container {
            return TileGraphics.sized(size, con => {
                const rails = this.paths.map(p => TileGraphics.rail(textures, ...p));

                if (this.#overlapping) {
                    rails[1].tint = Palette.Shadow;
                    rails.reverse();
                }

                con.addChild(...rails);
            });
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

        updateContainer(cur: GridCursor): void {
            const con = cur.container();
            const [c1, c2] = con.children as PIXI.Sprite[];

            [c1.tint, c2.tint] = [c2.tint, c1.tint];
            con.swapChildren(c1, c2);
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