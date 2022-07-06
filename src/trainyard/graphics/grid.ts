import * as PIXI from "pixi.js";
import { CellPos, Grids, Palette } from "../values";

type ConstructorOptions = {
    cellSize: number;
    cellLength: number;
};

export class GridContainer extends PIXI.Container implements Grids.Grid {
    cellSize: number;
    cellLength: number;
    cells: PIXI.Container;

    constructor(options: ConstructorOptions) {
        super();

        this.cellSize = options.cellSize;
        this.cellLength = options.cellLength;

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