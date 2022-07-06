import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { Tile, TileGrid } from './logic';
import { Atlas, Color, Dir, Grids, Palette } from "./values";
import Levels from "./levels.json";

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const {clientWidth, clientHeight} = document.documentElement;
const defaults = {
    cellSize: 72,
    cellLength: 7
};
const defaultWidth = defaults.cellSize * defaults.cellLength + Grids.TILE_GAP * (defaults.cellLength + 1);
const gridSize = Math.min(clientWidth - 16, clientHeight - 16, defaultWidth);
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

function setup() {
    textures = resources[assets["trainyard.atlas.json"]].textures!;

    let gridSize = app.renderer.width;
    let cellLength = defaults.cellLength;
    let cellSpace = gridSize - Grids.TILE_GAP * (cellLength + 1);
    let cellSize = Math.floor(cellSpace / cellLength);

    const tg = new TileGrid(cellSize, cellLength, {textures, renderer: app.renderer})
        .load(Levels.Calgary.Multicolor);

    const tgc = tg.container;
    tgc.position.set((app.renderer.width - tgc.width) / 2, (app.renderer.height - tgc.height) / 2);
    app.stage.addChild(tgc);
    applyButtons(tg);
};

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
}

function applyButtons(grid: TileGrid) {
    const wrapper = document.querySelector("#wrapper")!;

    const erase = wrapper.querySelector("button#b-erase")!;
    const undo  = wrapper.querySelector("button#b-undo")!;
    const start = wrapper.querySelector("button#b-start")!;
    const step  = wrapper.querySelector("button#b-step")!;

    const slider = document.querySelector("#speed-controls > input[type=range]")! as HTMLInputElement;
    erase.addEventListener("click", () => {
        let em = grid.editMode;
        if (em === "rail") grid.editMode = "railErase";
        else if (em === "railErase") grid.editMode = "rail";
    });
    undo.addEventListener("click", () => {
        grid.undo();
    })
    start.addEventListener("click", () => {
        let em = grid.editMode;

        if (em === "readonly") grid.editMode = "rail";
        else grid.editMode = "readonly";
    })
    step.addEventListener("click", () => {
        let em = grid.editMode;

        if (em !== "readonly") {
            grid.editMode = "readonly";
        } else {
            grid.step();
        }

        slider.value = "0";
    });

    grid.on("enterRailErase", () => {
        // enable erase mode
        document.body.classList.add("erase-mode");
        erase.classList.add("erase-mode");
        erase.textContent = "Stop Erasing";
    });
    grid.on("exitRailErase", () => {
        // reset erase mode
        document.body.classList.remove("erase-mode");
        erase.classList.remove("erase-mode");
        erase.textContent = "Erase";
    });

    grid.on("enterReadonly", () => {
        // set readonly mode active
        document.body.classList.add("readonly-mode");
        start.classList.add("readonly-mode");
        start.textContent = "Return";
    });
    grid.on("exitReadonly", () => {
        // reset readonly mode
        document.body.classList.remove("readonly-mode");
        start.classList.remove("readonly-mode");
        start.textContent = "Start";
        document.body.classList.remove("failed");
    });

    grid.on("fail", () => {
        document.body.classList.add("failed");
    });
}

namespace TestLevels {
    function repeat<T>(t: T, length: number): T[] {
        return Array.from({length}, () => t);
    }

    export const TextureLoadTest = Array.from({length: 7}, (_, y) => Array.from({length: 7}, (_, x) => {
        return new Tile.Outlet(Dir.Down, repeat(Color.Red, y * 7 + x + 1));
    }));
}