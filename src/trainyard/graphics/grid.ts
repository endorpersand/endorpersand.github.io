import * as PIXI from "pixi.js";
import { Move, Step } from "../logic";
import { CellPos, Dir, Grids, Palette, PIXIResources, Train } from "../values";
import * as TileGraphics from "./components";
import "../ext/map";

interface ConstructorGridOptions {
    cellSize: number;
    cellLength: number;
    pixi: PIXIResources;
};

abstract class AbsGriddedContainer extends PIXI.Container implements Grids.Grid, ConstructorGridOptions {
    cellSize: number;
    cellLength: number;
    pixi: PIXIResources;

    constructor(options: ConstructorGridOptions) {
        super();

        this.cellSize = options.cellSize;
        this.cellLength = options.cellLength;
        this.pixi = options.pixi;
    }
}

interface GridContainerOptions extends ConstructorGridOptions {
    drawGrid?: boolean;
}

export class GridContainer extends AbsGriddedContainer {
    cells: PIXI.Container;

    constructor(options: GridContainerOptions) {
        super(options);

        if (options.drawGrid ?? true) this._drawGrid();

        const cells = this.cells = new PIXI.Container();
        cells.name = "cells";
        this.addChild(cells);
    }

    private _drawGrid() {
        const TILE_GAP = Grids.TILE_GAP;
        const DELTA = this.cellSize + TILE_GAP;
        const GRID_SIZE = Grids.gridSize(this);

        const grid = new PIXI.Graphics()
        .beginFill(Palette.Grid.Line);

        for (let i = 0; i <= this.cellLength; i++) {
            let x = 0 + DELTA * i;
            grid.drawRect(x, 0, TILE_GAP, GRID_SIZE);
        }
        for (let j = 0; j <= this.cellLength; j++) {
            let y = 0 + DELTA * j;
            grid.drawRect(0, y, GRID_SIZE, TILE_GAP);
        }

        this.addChild(grid);
    }

    loadCells(cons: PIXI.Container[][]) {
        for (let y = 0; y < this.cellLength; y++) {
            for (let x = 0; x < this.cellLength; x++) {
                let t = cons?.[y]?.[x] ?? new PIXI.Container();
                t.position = Grids.cellToPosition(this, [x, y]);
                this.cells.addChild(t);
            }
        }

        return this;
    }

    replaceCell([x, y]: CellPos, con: PIXI.Container) {
        Grids.assertInBounds(this, x, y);

        const cells = this.cells;

        const index = y * this.cellLength + x;
        con.position = cells.getChildAt(index).position;

        cells.addChildAt(con, index);
        cells.removeChildAt(index + 1).destroy({children: true});

        return this;
    }

    /**
     * Get the PIXI container of the tile at the specified position
     * @param param0 cell position
     * @returns container
     */
    cellAt([x, y]: CellPos) {
        Grids.assertInBounds(this, x, y);

        return this.cells.getChildAt(y * this.cellLength + x) as PIXI.Container;
    }
}

function angleDifference(t1: number, t2: number) {
    let diff = (t2 - t1 + Math.PI) % (2 * Math.PI) - Math.PI;
    return diff < -Math.PI ? diff + 2 * Math.PI : diff;
}

namespace Interp {
    export function linear(x1: number, x2: number, progress: number) {
        return x1 + (x2 - x1) * progress;
    }

    /**
     * Interpolate position across the smaller arc of the circle
     * @param radius Radius of arc
     * @param t1 Initial angle in radians
     * @param t2 Final angle in radians
     * @param progress [0, 1)
     */
    export function minArc(center: readonly [number, number], radius: number, t1: number, t2: number, progress: number) {
        const [cx, cy] = center;
        const delta = angleDifference(t1, t2);
        
        return {
            x: cx + radius * Math.cos(t1 + delta * progress), 
            y: cy + radius * Math.sin(t1 + delta * progress)
        } as const;
    }
}


export class TrainContainer extends AbsGriddedContainer {
    /**
     * A mapping keeping track of references of trains to their designated sprite on the stage.
     * As steps occur, the train reference is replaced.
     */
    trainBodies: Map<Train, [body: TileGraphics.TwoAnchorSprite, edge?: Dir]> = new Map();

    constructor(options: ConstructorGridOptions) {
        super(options);
    }

    private _interp(pos: CellPos, d1: Dir | undefined, d2: Dir | undefined, progress: number): {pos: PIXI.IPointData, rotation?: number} {
        const edge1 = Grids.cellToPosition(this, pos, Dir.edge(d1, this.cellSize));
        const edge2 = Grids.cellToPosition(this, pos, Dir.edge(d2, this.cellSize));

        const straight =
            typeof d1 === "undefined" ||
            typeof d2 === "undefined" ||
            (d1 - d2) % 2 === 0;
        
        if (straight) {
            const {x: x1, y: y1} = edge1;
            const {x: x2, y: y2} = edge2;

            return {pos: {
                x: Interp.linear(x1, x2, progress),
                y: Interp.linear(y1, y2, progress)
            }};
        }

        const radius = this.cellSize / 2;
        const center = Grids.cellToPosition(this, pos, 
            Dir.shifts([radius, radius], radius, d1, d2)
        );

        // circle direction & angle
        const cDir1 = Dir.difference([center.x, center.y], [edge1.x, edge1.y])!;
        const cDir2 = Dir.difference([center.x, center.y], [edge2.x, edge2.y])!;

        const cAngle1 = -cDir1 * Math.PI / 2;
        const cAngle2 = -cDir2 * Math.PI / 2;

        // display angle
        
        // If you're on this edge, you're facing...
        // Right: [-1 0] -> π
        // Up:    [0  1] -> π/2
        // Left:  [1  0] -> 0
        // Down:  [0 -1] -> 3π/2
        const dAngle1 = (2 - d1) * Math.PI / 2;
        
        
        // If you're on this edge, you're facing...
        // Right: [1  0] -> 0
        // Up:    [0 -1] -> 3π/2
        // Left:  [-1 0] -> π
        // Down:  [0  1] -> π/2
        const dAngle2 = -d2 * Math.PI / 2;

        return {
            pos: Interp.minArc([center.x, center.y], radius, cAngle1, cAngle2, progress),
            rotation: dAngle1 + angleDifference(dAngle1, dAngle2) * progress
        };
    }

    /**
     * Given the original position of a tile and a mapping from each train reference 
     * from the tile into a list of the new train references that were deployed from that train,
     * update the trainBodies field.
     * @param preImagePos original cell position
     * @param moves deployments
     */
    moveBodies(preImagePos: CellPos, moves: Move[]) {
        for (let m of moves) {
            if (m.move == "destroy") {
                const {preimage} = m;

                if (this.trainBodies.has(preimage)) {
                    const [trainBody, _] = this.trainBodies.popItem(preimage)!;
                    this.removeChild(trainBody).destroy();
                }
            } else if (m.move == "pass") {
                const {preimage, image} = m;

                if (this.trainBodies.has(preimage)) {
                    const [trainBody, _] = this.trainBodies.popItem(preimage)!;
                    this._passBody(trainBody, preImagePos, image);
                }
            } else if (m.move == "split") {
                const {preimage, image} = m;

                if (this.trainBodies.has(preimage)) {
                    const [trainBody, _] = this.trainBodies.popItem(preimage)!;

                    this._passBody(trainBody, preImagePos, image.shift()!);
    
                    for (let t of image) {
                        this.createBody(Dir.shift(preImagePos, t.dir), Dir.flip(t.dir), t);
                    }
                } else {
                    // If a partial step occurred, we need to move the new bodies into the right place.
                    // Pass does exactly what we want, sooooooo...
                    this.moveBodies(preImagePos, image.map(t => ({
                        step: m.step,
                        move: "pass",
                        preimage: t,
                        image: t
                    })));
                }
            } else if (m.move == "merge") {
                const {preimage, image} = m;

                let first = preimage.shift()!;
                if (this.trainBodies.has(first)) {
                    const [trainBody, _] = this.trainBodies.popItem(first)!;

                    this._passBody(trainBody, preImagePos, image);
    
                    for (let t of preimage) {
                        if (this.trainBodies.has(t)) {
                            const [trainBody, _] = this.trainBodies.popItem(t)!;
                            this.removeChild(trainBody).destroy();
                        }
                    }
                }

            } else {
                let _: never = m;
            }
        }
        moves.length = 0;
    }

    
    moveBodiesPartial(preImagePos: CellPos, moves: Move[], progress: number) {
        // these steps are handled at the end (by `moveBodies`)
        const NO_PARTIAL_RENDER: readonly Step[] = [Step.EdgeCollision, Step.Deploy, Step.Finalize];
        moves = moves.filter(m => !NO_PARTIAL_RENDER.includes(m.step));

        for (let m of moves) {
            if (m.move == "pass") {
                const {preimage, image} = m;
                if (this.trainBodies.has(preimage)) {
                    const [trainBody, initDir] = this.trainBodies.get(preimage)!;

                    const transform = this._interp(preImagePos, initDir, image.dir, progress);

                    // after progress 0.5, the trains likely intersected, so color changes
                    const c = progress > 0.5 ? image : preimage;
                    this._redressBody(trainBody, {...transform, train: c});
                }
            } else if (m.move == "split") {
                const {preimage, image} = m;

                if (this.trainBodies.has(preimage)) {
                    this.trainBodies.set(image[0], this.trainBodies.get(preimage)!);

                    for (let i = 1; i < image.length; i++) {
                        // create preimage body, but assign the image to it
                        const body = this.createBody(preImagePos, Dir.flip(preimage.dir), preimage);
                        this.trainBodies.set(image[i], [body, Dir.flip(preimage.dir)]);
                    }
                    
                    // erase any instance of preimage body
                    this.trainBodies.popItem(preimage);
                }

                image.forEach(t => {
                    if (this.trainBodies.has(t)) {
                        const tbd = this.trainBodies.get(t)!;
                        const [trainBody, initDir] = tbd;
                        const {pos, rotation} = this._interp(preImagePos, initDir, t.dir, progress);

                        // after the trains are deep inside (and not visible), we can do color change
                        if (progress > 0.5) {
                            // prevent recoloring changes until the trains have moved in
                            this._redressBody(trainBody, {pos, rotation, train: t});
                        } else {
                            this._redressBody(trainBody, {pos, rotation});
                        }
                    }
                });
            } else if (m.move == "destroy") {
                const {preimage} = m;

                if (this.trainBodies.has(preimage)) {
                    const [trainBody, initDir] = this.trainBodies.get(preimage)!;
    
                    const transform = this._interp(preImagePos, initDir, preimage.dir, progress);

                    this._redressBody(trainBody, transform);

                    if (progress > 0.5) {
                        this.trainBodies.delete(preimage);
                        trainBody.destroy();
                    }
                }
            } else if (m.move == "merge") {
                // merge at the end of the step
            } else {
                let _: never = m;
            }
        }
    }

    private _passBody(body: TileGraphics.TwoAnchorSprite | undefined, preImagePos: CellPos, t: Train) {
        if (body) {
            this.trainBodies.set(t, [body, Dir.flip(t.dir)]);

            const pixPos = Grids.cellToPosition(this, preImagePos, Dir.edge(t.dir, this.cellSize));
            this._redressBody(body, {pos: pixPos, train: t});
        }
    }

    /**
     * Fix the body's position, color, and direction
     * @param body train sprite
     * @param pos pixel position
     * @param param2 train data
     */
    private _redressBody(body: TileGraphics.TwoAnchorSprite, options?: Partial<{pos: PIXI.IPointData, rotation: number, train: Train}>) {
        if (!options) return;

        const {pos, rotation, train} = options;
        if (pos) body.position = pos;

        if (train) {
            body.rotation = rotation ?? -train.dir * Math.PI / 2;
            body.tint = Palette.Train[train.color];
        } else if (typeof rotation === "number") {
            body.rotation = rotation;
        };
    }

    /**
     * Make a new sprite for a train and register it into trainBodies and the stage
     * @param pos cell position
     * @param edge edge where body should be created
     * @param t new train
     * @returns the sprite
     */
    createBody(pos: CellPos, edge: Dir | undefined, t: Train) {
        const body = TileGraphics.train(this.pixi, this.cellSize);
        body.posAnchor.set(0.5, 0.5);
        
        const pixPos = Grids.cellToPosition(this, pos, Dir.edge(edge, this.cellSize));
        this._redressBody(body, {pos: pixPos, train: t});
        this.addChild(body);
        this.trainBodies.set(t, [body, edge]);

        return body;
    }

    clearBodies() {
        this.trainBodies.clear();
        while (this.children[0]) {
            this.removeChild(this.children[0]).destroy({children: true});
        }
    }
}