import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { Tile, TileGrid } from './tile';
import { Atlas, Color, Dir, Palette } from "./values";

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const {clientWidth, clientHeight} = document.documentElement;
const defaults = {
    cellSize: 72,
    cellLength: 7
};
const defaultWidth = defaults.cellSize * defaults.cellLength + TileGrid.TILE_GAP * (defaults.cellLength + 1);
const gridSize = Math.min(clientWidth - 16, clientHeight - 16, defaultWidth);
const app = new PIXI.Application({
    width: gridSize,
    height: gridSize,
});

document.querySelector("#game")!.prepend(app.view);

app.renderer.backgroundColor = Palette.BG;
app.renderer.plugins.interaction.moveWhenInside = true;

loader
    .add(assets["trainyard.json"])
    .load(setup);

let textures: Atlas;

function setup() {
    textures = resources[assets["trainyard.json"]].textures!;

    let gridSize = app.renderer.width;
    let cellLength = defaults.cellLength;
    let cellSpace = gridSize - TileGrid.TILE_GAP * (cellLength + 1);
    let cellSize = Math.floor(cellSpace / cellLength);

    const tg = new TileGrid(cellSize, cellLength, {textures, renderer: app.renderer},
        [
            [,,, new Tile.Outlet(Dir.Down, [Color.Blue])],
            [],
            [],
            [
                new Tile.Outlet(Dir.Right, [Color.Green]),,,
                new Tile.Goal([Color.Green, Color.Blue, Color.Red, Color.Yellow], [Dir.Up, Dir.Left, Dir.Down, Dir.Right]),,,
                new Tile.Outlet(Dir.Left, [Color.Yellow])
            ],
            [],
            [],
            [,,, new Tile.Outlet(Dir.Up, [Color.Red])],
        ]
    );

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
            (document.querySelector("#speed-controls > input[type=range]")! as HTMLInputElement).value = "0";
        }
    });

    grid.onEnterEditMode("railErase", () => {
        // enable erase mode
        document.body.classList.add("erase-mode");
        erase.classList.add("erase-mode");
        erase.textContent = "Stop Erasing";
    });
    grid.onExitEditMode("railErase", () => {
        // reset erase mode
        document.body.classList.remove("erase-mode");
        erase.classList.remove("erase-mode");
        erase.textContent = "Erase";
    });

    grid.onEnterEditMode("readonly", () => {
        // set readonly mode active
        document.body.classList.add("readonly-mode");
        start.classList.add("readonly-mode");
        start.textContent = "Return";
    });
    grid.onExitEditMode("readonly", () => {
        // reset readonly mode
        document.body.classList.remove("readonly-mode");
        start.classList.remove("readonly-mode");
        start.textContent = "Start";
    });
}