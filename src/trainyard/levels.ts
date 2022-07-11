import { Tile } from "./logic";
import { Color, Dir } from "./values";
import Levels from "./levels.json";

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
    export const CachePerfTest10 = gridFrom(10, (x, y) => {
        return new Tile.Outlet(Dir.Down, repeat(Math.floor(Math.random() * 7) + 1, y * 10 + x + 1));
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

export const ProvidedLevels = {...Levels, TestLevels} as const;
export const Default = ["Calgary", "Multicolor"];