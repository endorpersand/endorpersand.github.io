import { Atlas, Color, Dir, DirFlags, Palette, Train } from "./values";
import * as PIXI from "pixi.js";

/**
 A class which holds a grid of the current tiles on board.
 */
export class TileGrid {
    /**
     * The tiles.
     */
    tiles: Tile[][];
    /**
     * The tile grid is size x size big.
     */
    size: number;

    /**
     * During a step, the cursor indicates which tile the tile grid is currently scanning on.
     */
    cursor: [number, number] = [-1, -1];

    /**
     * If false, a train crashed.
     */
    passing: boolean = true;

    constructor(size: number) {
        this.size = size;
        this.tiles = Array.from({length: size}, () => []);
    }

    tile(x: number, y: number) {
        return (this.tiles?.[x][y]) ?? new Tile.Blank();
    }

    /**
     * Get the neighbor tile in a specific direction
     * @param direction the direction
     * @returns the neighbor tile
     */
    #neighbor(direction: Dir) {
        let [x, y] = this.cursor;

        switch (direction) {
            case Dir.Up:
                y += 1;
                break;
            case Dir.Down:
                y -= 1;
                break;
            case Dir.Left:
                x -= 1;
                break;
            case Dir.Right:
                x += 1;
                break;
            default:
                throw new Error("Invalid direction");
        }

        return this.tile(x, y);
    }

    /**
     * Push train into the neighbor that the train is expected to move into.
     * @param train train to move
     */
    intoNeighbor(train: Train) {
        this.#neighbor(train.dir).accept(this, train);
    }

    /**
     * Iterate one step through the board.
     */
    step() {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                let tile = this.tile(i, j);

                if (tile instanceof TravTile && tile.trains.length > 0) {
                    this.cursor = [i, j];
                    tile.step(this);
                }
            }
        }
    }

    fail() {
        this.passing = false;
    }
}

export abstract class Tile {
    /**
     * Indicates what this tile should do when a train moves onto it.
     * @param train 
     */
    abstract accept(grid: TileGrid, train: Train): void;

    abstract render(textures: Atlas, size: number): PIXI.Container;
}

export abstract class TravTile extends Tile {
    /**
     * A list of the trains currently on the tile.
     */
    trains: Train[] = [];
    
    /**
     * Indicates what this tile should do during the step (is only called if the tile has a train).
     * @param grid Grid that the tile is on
     */
    abstract step(grid: TileGrid): void;
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
        console.log(entrances, straight);
        
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
}

export namespace Tile {

        /**
         * Tile which trains appear from.
         */
        export class Outlet extends TravTile {
            /**
             * The output side.
             */
            out: Dir;
            released: number = 0;
        
            constructor(out: Dir, colors: Color[]) {
                super();
                this.out = out;
                this.trains = Array.from(colors, color => ({color, dir: out}));
            }
        
            step(grid: TileGrid): void {
                // While the outlet has trains, deploy one.
                this.released += 1;
                grid.intoNeighbor(this.trains.shift()!);
            }
        
            accept(grid: TileGrid, _: Train): void {
                // A train cannot enter an outlet.
                grid.fail();
            }
            
            render(textures: Atlas, size: number): PIXI.Container {
                return TileGraphics.sized(size, con => {
                    const [box, inner] = TileGraphics.box(textures);
                    con.addChild(box);
                    
                    const center = [Math.floor(box.width / 2), Math.floor(box.height / 2)] as [number, number];
                    const symbols = TileGraphics.symbolSet(
                        this.trains.map(t => t.color), [center, inner],
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
        export class Goal extends Tile {
            /**
             * The train colors this goal block wants. If met, the color is switched to undefined.
             */
            targets: (Color | undefined)[];
            /**
             * The active sides.
             * Note that: If this goal accepts right-facing trains, it has a left-facing active side.
             */
            entrances: DirFlags;
        
            constructor(targets: Color[], entrances: Dir[]) {
                super();
                this.targets = targets;
                this.entrances = new DirFlags(entrances);
            }
        
            accept(grid: TileGrid, train: Train): void {
                // If the train enters from an active side:
                if (this.entrances.has(Dir.flip(train.dir))) {
        
                    // If this goal was expecting this train's color:
                    let i = this.targets.indexOf(train.color);
                    if (i != -1) {
                        this.targets[i] = undefined;
                        return;
                    }
        
                }
                grid.fail();
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

                    con.addChild(...[...this.entrances]
                        .map(e => TileGraphics.activeSide(textures, e))
                    )
                });
            }
        }
        
        /**
        * Tiles which paint the train.
        */
        export class Painter extends TravTile {
            /**
             * The active sides.
             * Note that: If this goal accepts right-facing trains, it has a left-facing active side.
             */
            actives: DirFlags;
            color: Color;
        
            constructor(color: Color, active1: Dir, active2: Dir) {
                super();
                this.actives = new DirFlags([active1, active2]);
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
        export class Splitter extends TravTile {
            /**
             * The active side.
             * Note that: If this goal accepts right-facing trains, it has a left-facing active side.
             */
            active: Dir;
        
            constructor(active: Dir) {
                super();
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
            
            accept(grid: TileGrid, train: Train): void {
                // A train can only enter a splitter through the active side.
                if (this.active === Dir.flip(train.dir)) {
                    this.trains.push(train);
                } else {
                    grid.fail();
                }
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
        
        export class Blank extends Tile {
            accept(grid: TileGrid, _: Train): void {
                // If a train tries to land on a blank tile, then the train must've crashed.
                grid.fail();
            }

            render(textures: Atlas, size: number): PIXI.Container {
                return TileGraphics.sized(size);
            }
        }
        
        export class Rock extends Blank {
            render(textures: Atlas, size: number): PIXI.Container {
                return TileGraphics.sized(size, con => {
                    con.addChild(TileGraphics.rock(textures));
                });
            }
        }
        
        export abstract class Rail extends TravTile {
            entrances: DirFlags;
        
            constructor(entrances: Dir[] | DirFlags) {
                super();
                this.entrances = new DirFlags(entrances);
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
                let [e1, e2] = [rail1.entrances, rail2.entrances];
        
                if (e1.equals(e2)) {
                    let [d1, d2, ..._] = e1;
                    return new SingleRail(d1, d2);
                }
                return new DoubleRail([e1, e2]);
            }
        
            accept(grid: TileGrid, train: Train): void {
                // Only accept train if the train passes through one of the rail's entrances
                if (this.entrances.has(Dir.flip(train.dir))) {
                    this.trains.push(train);
                } else {
                    grid.fail();
                }
            }
            
            /**
             * Designate where a train should exit the rail (given its entrance state)
             * @param t train to redirect
             */
            abstract redirect(t: Train): Train | undefined;
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
                if (this.entrances.has(enterDir)) {
                    return {color, dir: this.entrances.dirExcluding(enterDir)};
                }
                // invalid state: wipe truck from existence
            }
        
            render(textures: Atlas, size: number): PIXI.Container {
                return TileGraphics.sized(size, con => {
                    con.addChild(TileGraphics.rail(textures, ...this.entrances));
                });
            }
        }
        
        export class DoubleRail extends Rail {
            paths: [DirFlags, DirFlags];
            #do_railswap: boolean;
        
            constructor(paths: [DirFlags, DirFlags]) {
                let [e0, e1] = paths;
                if (e0.equals(e1)) {
                    throw new Error("Rails match");
                }
                super(e0.or(e1));
                this.paths = paths;
                this.#do_railswap = [...this.entrances].length < 4;
            }
        
            redirect(t: Train): Train | undefined {
                let {color, dir} = t;
                let enterDir = Dir.flip(dir);
        
                // Find which path the train is on. Pass the train onto the other side of the path.
                let rails = this.paths
                    .filter(r => r.has(enterDir));
        
                if (rails.length > 0) {
                    // If the double rail merges at a point, then the primary and secondary rails swap.
                    if (this.#do_railswap) {
                        this.paths.push(this.paths.shift()!);
                    }
                    return { color, dir: rails[0].dirExcluding(enterDir) };
                }
                
                // invalid state: wipe truck from existence
            }

            render(textures: Atlas, size: number): PIXI.Container {
                return TileGraphics.sized(size, con => {
                    const rails = this.paths.map(p => TileGraphics.rail(textures, ...p));

                    if (this.#do_railswap) {
                        rails[1].tint = 0x7F7F7F;
                        rails.reverse();
                    }

                    con.addChild(...rails);
                });
            }
        }
}