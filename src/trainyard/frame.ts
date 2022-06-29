import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { Tile, TileGrid } from './tile';
import { Atlas, Color, Dir, Palette } from "./values";

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const {clientWidth, clientHeight} = document.documentElement;
const app = new PIXI.Application({
    width: Math.min(clientWidth, 512), 
    height: clientHeight - 16
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

    let gridSize = app.renderer.width - TileGrid.TILE_GAP * 3;
    let cellLength = 7;
    let cellSpace = gridSize - TileGrid.TILE_GAP * (cellLength + 1);
    let cellSize = 64; //Math.floor(cellSpace / 7);

    const tg = new TileGrid(cellSize, cellLength, textures,
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
};

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
}