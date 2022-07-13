import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { TileGrid } from './logic';
import { Atlas, Grids, Palette } from "./values";
import { applyButtons, Dropdowns, Elements, speed } from './dom';
import { ProvidedLevels } from './levels';

const DEBUG = true;
declare global {
    interface Window {
        grid: TileGrid;
        Levels: typeof ProvidedLevels;
    }
}

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const {clientWidth, clientHeight} = document.documentElement;
const defaults = {
    cellSize: 72,
    cellLength: 7
};
const defaultWidth = defaults.cellSize * defaults.cellLength + Grids.TILE_GAP * (defaults.cellLength + 1);
const gridSize = Math.min(clientWidth, clientHeight, defaultWidth);
const app = new PIXI.Application({
    width: gridSize,
    height: gridSize,
});

document.querySelector("#game")!.prepend(app.view);

app.renderer.backgroundColor = Palette.BG;
app.renderer.plugins.interaction.moveWhenInside = true;

loader
    .add(assets["trainyard.atlas.json"])
    .load(setup);

let textures: Atlas;
let grid: TileGrid;

function setup() {
    textures = resources[assets["trainyard.atlas.json"]].textures!;

    grid = new TileGrid(gridSize, defaults.cellLength, {textures, renderer: app.renderer})
        .load(Dropdowns.currentLevel()!);
    Dropdowns.LevelHandlers.add(b => {
        grid.editMode = "rail";
        grid.load(b);
        grid.container.position
            .set((app.renderer.width - tgc.width) / 2, (app.renderer.height - tgc.height) / 2);
    });
    if (DEBUG) enableDebug();
    
    const tgc = grid.container;
    tgc.position.set((app.renderer.width - tgc.width) / 2, (app.renderer.height - tgc.height) / 2);
    app.stage.addChild(tgc);
    applyButtons(grid);

    app.ticker.add(gameLoop);
};

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
    if (grid.editMode === "readonly" && grid.simulation && +Elements.slider.value) {
        grid.simulation.stepPartial(delta * speed());
    }
}

function enableDebug() {
    window.grid = grid;
    window.Levels = ProvidedLevels;
}