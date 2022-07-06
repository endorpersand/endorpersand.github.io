import * as PIXI from "pixi.js";
import { Atlas, CellPos, Dir, Grids, Palette, Train } from "../values";
import * as TileGraphics from "./components";

type PIXIData = {
    textures: Atlas,
    renderer: PIXI.AbstractRenderer
};

interface ConstructorOptions {
    cellSize: number;
    cellLength: number;
    pixi: PIXIData;
};

abstract class AbsGriddedContainer extends PIXI.Container implements Grids.Grid, ConstructorOptions {
    cellSize: number;
    cellLength: number;
    pixi: PIXIData;

    constructor(options: ConstructorOptions) {
        super();

        this.cellSize = options.cellSize;
        this.cellLength = options.cellLength;
        this.pixi = options.pixi;
    }
}

export class GridContainer extends AbsGriddedContainer {
    cells: PIXI.Container;

    constructor(options: ConstructorOptions) {
        super(options);

        this.#drawBG();
        this.#drawGrid();

        const cells = this.cells = new PIXI.Container();
        cells.name = "cells";
        this.addChild(cells);
    }

    #drawBG() {
        const GRID_SIZE = Grids.gridSize(this);

        const bg = new PIXI.Sprite(PIXI.Texture.WHITE);
        bg.tint = Palette.Grid.BG;
        bg.width = GRID_SIZE;
        bg.height = GRID_SIZE;
        
        this.addChild(bg);
    }

    #drawGrid() {
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

export class TrainContainer extends AbsGriddedContainer {
    /**
     * A mapping keeping track of references of trains to their designated sprite on the stage.
     * As steps occur, the train reference is replaced.
     */
     trainBodies: Map<Train, PIXI.Sprite> = new Map();

    constructor(options: ConstructorOptions) {
        super(options);
    }

    /**
     * Given the original position of a tile and a mapping from each train reference 
     * from the tile into a list of the new train references that were deployed from that train,
     * update the trainBodies field.
     * @param preImagePos original cell position
     * @param moves deployments
     */
    moveBodies(preImagePos: CellPos, moves: Map<Train, Train[]>) {
        for (let [preimage, images] of moves) {
            // pop trainBody
            const trainBody = this.trainBodies.get(preimage);
            this.trainBodies.delete(preimage);

            if (trainBody) {
                if (images.length == 0) {
                    // trainBody should no longer exist. kill it.
                    this.removeChild(trainBody).destroy();
                    continue;
                }
                
                // assign trainBody to new train
                let ref = images.shift()!;
                this.trainBodies.set(ref, trainBody);
                this.#redressBody(trainBody, Dir.shift(preImagePos, ref.dir), ref);
            }

            // create new bodies for the rest of the trains:
            for (let t of images) {
                this.createBody(Dir.shift(preImagePos, t.dir), t);
            }
        }
        moves.clear();
    }

    /**
     * Fix the body's position, color, and direction
     * @param body train sprite
     * @param pos cell position
     * @param param2 train data
     */
    #redressBody(body: PIXI.Sprite, pos: CellPos, {color, dir}: Train) {
        const shift = [this.cellSize / 2, this.cellSize / 2] as const;
        
        body.position = Grids.cellToPosition(this, pos, shift);
        body.angle = -90 * dir;
        body.tint = Palette.Train[color];
    }

    /**
     * Make a new sprite for a train and register it into trainBodies and the stage
     * @param pos cell position
     * @param t new train
     * @returns the sprite
     */
    createBody(pos: CellPos, t: Train) {
        const body = TileGraphics.train(this.pixi.renderer);

        this.#redressBody(body, pos, t);
        this.addChild(body);
        this.trainBodies.set(t, body);

        return body;
    }

    clearBodies() {
        this.trainBodies.clear();
        while (this.children[0]) {
            this.removeChild(this.children[0]).destroy({children: true});
        }
    }
}
