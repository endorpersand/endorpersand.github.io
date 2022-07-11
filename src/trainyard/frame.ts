import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'
import { Tile, TileGrid } from './logic';
import { Atlas, Color, Dir, Grids, Palette } from "./values";
import Levels from "./levels.json";
import { applyButtons, Elements, speed } from './dom';

const DEBUG = true;
declare global {
    interface Window {
        grid: TileGrid;
        Levels: typeof Levels;
        TestLevels: typeof TestLevels;
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
let grid: TileGrid;

function setup() {
    textures = resources[assets["trainyard.atlas.json"]].textures!;

    grid = new TileGrid(gridSize, defaults.cellLength, {textures, renderer: app.renderer})
        .load(TestLevels.MergeTest);
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

namespace TestLevels {
    function repeat<T>(t: T, length: number): T[] {
        return Array.from({length}, () => t);
    }
    function array2DFrom<X, Y, R>(itx: Iterable<X> | ArrayLike<X>, ity: Iterable<Y> | ArrayLike<Y>, mapfn: (t: [X, Y], i: [number, number]) => R) {
        return Array.from(ity, (y, j) => Array.from(itx, (x, i) => mapfn([x, y], [i, j])));
    }
    function gridFrom<R>(length: number, mapfn: (x: number, y: number) => R) {
        return array2DFrom({length}, {length}, (_, i) => mapfn(...i));
    }

    export const CachePerfTest = gridFrom(7, (x, y) => {
        return new Tile.Outlet(Dir.Down, repeat(Color.Red, y * 7 + x + 1));
    });
    export const SixBySix = gridFrom(6, () => {
        return new Tile.Outlet(Dir.Down, [Color.Red]);
    });

    const tilesToLoad = [
        new Tile.Outlet(Dir.Right, repeat(Color.Red, 1)),
        new Tile.Outlet(Dir.Up,    repeat(Color.Orange, 2)),
        new Tile.Outlet(Dir.Left,  repeat(Color.Yellow, 3)),
        new Tile.Outlet(Dir.Down,  repeat(Color.Green, 4)),

        new Tile.Splitter(Dir.Right),
        new Tile.Splitter(Dir.Up),
        new Tile.Splitter(Dir.Left),
        new Tile.Splitter(Dir.Down),

        new Tile.Painter(Color.Red,    Dir.Right, Dir.Up),
        new Tile.Painter(Color.Orange, Dir.Right, Dir.Left),
        new Tile.Painter(Color.Yellow, Dir.Right, Dir.Down),
        new Tile.Painter(Color.Green,  Dir.Up,    Dir.Left),
        new Tile.Painter(Color.Blue,   Dir.Up,    Dir.Down),
        new Tile.Painter(Color.Purple, Dir.Left,  Dir.Down),

        new Tile.Rock(),
        new Tile.Blank(),

        new Tile.Goal(repeat(Color.Red,    1),  []),
        new Tile.Goal(repeat(Color.Orange, 2),  [Dir.Right]),
        new Tile.Goal(repeat(Color.Yellow, 3),  [Dir.Up]),
        new Tile.Goal(repeat(Color.Green,  4),  [Dir.Up, Dir.Right]),
        new Tile.Goal(repeat(Color.Blue,   5),  [Dir.Left]),
        new Tile.Goal(repeat(Color.Purple, 6),  [Dir.Left, Dir.Right]),
        new Tile.Goal(repeat(Color.Brown,  7),  [Dir.Left, Dir.Up]),
        new Tile.Goal(repeat(Color.Red,    8),  [Dir.Left, Dir.Up, Dir.Right]),
        new Tile.Goal(repeat(Color.Orange, 9),  [Dir.Down]),
        new Tile.Goal(repeat(Color.Yellow, 10), [Dir.Down, Dir.Right]),
        new Tile.Goal(repeat(Color.Green,  11), [Dir.Down, Dir.Up]),
        new Tile.Goal(repeat(Color.Blue,   12), [Dir.Down, Dir.Up, Dir.Right]),
        new Tile.Goal(repeat(Color.Purple, 13), [Dir.Down, Dir.Left]),
        new Tile.Goal(repeat(Color.Brown,  14), [Dir.Down, Dir.Left, Dir.Right]),
        new Tile.Goal(repeat(Color.Red,    15), [Dir.Down, Dir.Left, Dir.Up]),
        new Tile.Goal(repeat(Color.Orange, 16), [Dir.Down, Dir.Left, Dir.Up, Dir.Right]),

        new Tile.SingleRail(Dir.Right, Dir.Up),
        new Tile.SingleRail(Dir.Right, Dir.Left),
        new Tile.SingleRail(Dir.Right, Dir.Down),
        new Tile.SingleRail(Dir.Up,    Dir.Left),
        new Tile.SingleRail(Dir.Up,    Dir.Down),
        new Tile.SingleRail(Dir.Left,  Dir.Down),
        new Tile.Blank(),
        new Tile.Blank(),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Right, Dir.Left)
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Right, Dir.Down)
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Up,    Dir.Left)
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Up,    Dir.Down)
        ),
        Tile.Rail.of(
            new Tile.SingleRail(Dir.Right, Dir.Up),
            new Tile.SingleRail(Dir.Left,  Dir.Down)
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

    ];
    export const TextureLoadTest = gridFrom(8, (x, y) => tilesToLoad[y * 8 + x]);
    export const TextureLoadTest7 = gridFrom(7, (x, y) => tilesToLoad[(y * 7 + x + 32) % tilesToLoad.length]);

    export const MergeTest = [
        [new Tile.Outlet(Dir.Right, [Color.Red]), , new Tile.Rock(), new Tile.Rock(), new Tile.Outlet(Dir.Down, [Color.Red]), new Tile.Rock()],
        [new Tile.Rock(), , new Tile.Goal([Color.Purple], [Dir.Left]), new Tile.Outlet(Dir.Right, [Color.Blue])],
        [new Tile.Outlet(Dir.Right, [Color.Blue]), , new Tile.Rock(), new Tile.Rock(), , new Tile.Goal([Color.Blue,Color.Red], [Dir.Up,Dir.Left])],
        [new Tile.Rock(), new Tile.Outlet(Dir.Down, [Color.Red]), new Tile.Rock(), new Tile.Outlet(Dir.Down, [Color.Red]), new Tile.Rock(), new Tile.Goal([Color.Purple], [Dir.Down])],
        [new Tile.Outlet(Dir.Right, [Color.Blue])],
        [new Tile.Rock(), , new Tile.Goal([Color.Purple, Color.Purple], [Dir.Up, Dir.Left]), new Tile.Goal([Color.Purple], [Dir.Up]), new Tile.Outlet(Dir.Up, [Color.Blue]), new Tile.Outlet(Dir.Up, [Color.Blue])],
    ];

    export const AnimTest = [
        [,,, new Tile.Painter(Color.Green, Dir.Down, Dir.Right)],
        [],
        [],
        [new Tile.Outlet(Dir.Right, [Color.Green]), , new Tile.Splitter(Dir.Left), , new Tile.Splitter(Dir.Left), , new Tile.Goal([Color.Green], [Dir.Left])],
        [],
        [],
        [,, new Tile.Goal([Color.Green], [Dir.Up])],
    ]

    export const Empty7 = gridFrom(7, () => undefined);
}

function enableDebug() {
    window.grid = grid;
    window.Levels = Levels;
    window.TestLevels = TestLevels;
}