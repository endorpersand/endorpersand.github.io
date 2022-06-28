import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { Tile, TileGrid } from './tile';
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

    function repeat<T>(a: T[], n: number): T[] {
        let z = [];
        for (let i = 0; i < n; i++) z.push(...a);
        return z;
    }

    let i = 0;
    /*
    for (let t of [
        new Tile.Goal([Color.Red],    [Dir.Right]),
        new Tile.Goal([Color.Orange], [Dir.Up]),
        new Tile.Goal([Color.Yellow], [Dir.Right, Dir.Up]),
        new Tile.Goal([Color.Green],  [Dir.Left]),
        new Tile.Goal([Color.Blue],   [Dir.Right, Dir.Left]),
        new Tile.Goal([Color.Purple], [Dir.Up, Dir.Left]),
        new Tile.Goal([Color.Brown],  [Dir.Right, Dir.Up, Dir.Left]),
        new Tile.Goal(repeat([Color.Red], 2),    [Dir.Down, Dir.Down]),
        new Tile.Goal(repeat([Color.Orange], 3), [Dir.Right, Dir.Down]),
        new Tile.Goal(repeat([Color.Yellow], 4), [Dir.Up, Dir.Down]),
        new Tile.Goal(repeat([Color.Green], 5),  [Dir.Right, Dir.Up, Dir.Down]),
        new Tile.Goal(repeat([Color.Blue], 6),   [Dir.Left, Dir.Down]),
        new Tile.Goal(repeat([Color.Purple], 7), [Dir.Right, Dir.Left, Dir.Down]),
        new Tile.Goal(repeat([Color.Brown], 8),  [Dir.Up, Dir.Left, Dir.Down]),
        new Tile.Goal(repeat([Color.Red], 9),    [Dir.Right, Dir.Up, Dir.Left, Dir.Down]),

        new Tile.Rock(),
        new Tile.Splitter(Dir.Right),
        new Tile.Splitter(Dir.Up),
        new Tile.Splitter(Dir.Left),
        new Tile.Splitter(Dir.Down),
        
        new Tile.Outlet(Dir.Right, [Color.Blue]),
        new Tile.Outlet(Dir.Up,    repeat([Color.Blue], 2)),
        new Tile.Outlet(Dir.Left,  repeat([Color.Blue], 3)),
        new Tile.Outlet(Dir.Down,  repeat([Color.Blue], 4)),
        
        new Tile.Painter(Color.Red,    Dir.Right, Dir.Up),
        new Tile.Painter(Color.Orange, Dir.Right, Dir.Left),
        new Tile.Painter(Color.Yellow, Dir.Right, Dir.Down),
        new Tile.Painter(Color.Green,  Dir.Up,    Dir.Left),
        new Tile.Painter(Color.Blue,   Dir.Up,    Dir.Down),
        new Tile.Painter(Color.Purple, Dir.Left,  Dir.Down),

        new Tile.Blank(),
        new Tile.Blank(),

        new Tile.SingleRail(Dir.Right, Dir.Up),
        new Tile.SingleRail(Dir.Right, Dir.Left),
        new Tile.SingleRail(Dir.Right, Dir.Down),
        new Tile.SingleRail(Dir.Up,    Dir.Left),
        new Tile.SingleRail(Dir.Up,    Dir.Down),
        new Tile.SingleRail(Dir.Left,  Dir.Down),

        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Right, Dir.Left),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Right, Dir.Down),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Up,    Dir.Left),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Up,    Dir.Down),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Left,  Dir.Down),
        ),

        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Left),
            new Tile.SingleRail(Dir.Right, Dir.Down),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Left),
            new Tile.SingleRail(Dir.Up,    Dir.Left),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Left),
            new Tile.SingleRail(Dir.Up,    Dir.Down),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Left),
            new Tile.SingleRail(Dir.Left,  Dir.Down),
        ),

        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Down),
            new Tile.SingleRail(Dir.Up,    Dir.Left),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Down),
            new Tile.SingleRail(Dir.Up,    Dir.Down),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Down),
            new Tile.SingleRail(Dir.Left,  Dir.Down),
        ),
        
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Up,    Dir.Left),
            new Tile.SingleRail(Dir.Up,    Dir.Down),
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Up,    Dir.Left),
            new Tile.SingleRail(Dir.Left,  Dir.Down),
        ),

        Tile.Rail.of(
            new Tile.SingleRail(Dir.Up,    Dir.Down),
            new Tile.SingleRail(Dir.Left,  Dir.Down),
        ),

    ]) {
        let st = t.render(textures, 64);
        st.position.set(...tile(i++));
        app.stage.addChild(st);
    }
    */
    
    const tg = new TileGrid(64, 7);
    tg.tiles[0] = [new Tile.Goal([Color.Red], [Dir.Up, Dir.Left, Dir.Down, Dir.Right]), new Tile.Goal([Color.Red], [Dir.Up, Dir.Left, Dir.Down, Dir.Right])];
    const tgc = tg.render(textures, tg.gridSize);

    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.tint = 0xFFCFCF;
    sprite.width = tgc.width;
    sprite.height = tgc.height;

    sprite.position.set(16, 16);
    tgc.position.set(16, 16);
    app.stage.addChild(sprite);
    app.stage.addChild(tgc);
};

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
}