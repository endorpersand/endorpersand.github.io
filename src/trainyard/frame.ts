import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { Tile } from './tile';
import { Atlas, Color, Dir, Palette } from "./values";

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const app = new PIXI.Application({
    width: 512, 
    height: 512
});

document.querySelector("#game")!.prepend(app.view);

app.renderer.backgroundColor = Palette.BG;
app.renderer.plugins.interaction.moveWhenInside = true;

loader
    .add(assets["trainyard.json"])
    .load(setup);

let textures: Atlas;

let tile = (i: number) => [64 * (i % 8), 64 * (Math.floor(i / 8))] as [number, number];

function setup() {
    textures = resources[assets["trainyard.json"]].textures!;

    let i = 0;
    for (let t of [
        new Tile.Goal([Color.Blue], [Dir.Up]),
        new Tile.Outlet(Dir.Down, [Color.Blue]),
        new Tile.Painter(Color.Blue, Dir.Left, Dir.Right),
        new Tile.Splitter(Dir.Up),
        new Tile.Rock(),
        new Tile.Blank(),
        new Tile.SingleRail(Dir.Left, Dir.Right),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Left, Dir.Right),
            new Tile.SingleRail(Dir.Left, Dir.Up),
        )
    ]) {
        let st = t.render(textures, 64);
        st.position.set(...tile(i++));
        app.stage.addChild(st);
        
        st.interactive = true;
    }
    // app.ticker.add(gameLoop);
};

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
}