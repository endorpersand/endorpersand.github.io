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

        new Tile.Painter([Dir.Right, Dir.Up  ], Color.Red    ),
        new Tile.Painter([Dir.Right, Dir.Left], Color.Orange ),
        new Tile.Painter([Dir.Right, Dir.Down], Color.Yellow ),
        new Tile.Painter([Dir.Up,    Dir.Left], Color.Green  ),
        new Tile.Painter([Dir.Up,    Dir.Down], Color.Blue   ),
        new Tile.Painter([Dir.Left,  Dir.Down], Color.Purple ),

        new Tile.Rock(),
        new Tile.Blank(),

        new Tile.Goal([],                                      repeat(Color.Red,    1)),
        new Tile.Goal([Dir.Right],                             repeat(Color.Orange, 2)),
        new Tile.Goal([Dir.Up],                                repeat(Color.Yellow, 3)),
        new Tile.Goal([Dir.Up, Dir.Right],                     repeat(Color.Green,  4)),
        new Tile.Goal([Dir.Left],                              repeat(Color.Blue,   5)),
        new Tile.Goal([Dir.Left, Dir.Right],                   repeat(Color.Purple, 6)),
        new Tile.Goal([Dir.Left, Dir.Up],                      repeat(Color.Brown,  7)),
        new Tile.Goal([Dir.Left, Dir.Up, Dir.Right],           repeat(Color.Red,    8)),
        new Tile.Goal([Dir.Down],                              repeat(Color.Orange, 9)),
        new Tile.Goal([Dir.Down, Dir.Right],                   repeat(Color.Yellow, 10)),
        new Tile.Goal([Dir.Down, Dir.Up],                      repeat(Color.Green,  11)),
        new Tile.Goal([Dir.Down, Dir.Up, Dir.Right],           repeat(Color.Blue,   12)),
        new Tile.Goal([Dir.Down, Dir.Left],                    repeat(Color.Purple, 13)),
        new Tile.Goal([Dir.Down, Dir.Left, Dir.Right],         repeat(Color.Brown,  14)),
        new Tile.Goal([Dir.Down, Dir.Left, Dir.Up],            repeat(Color.Red,    15)),
        new Tile.Goal([Dir.Down, Dir.Left, Dir.Up, Dir.Right], repeat(Color.Orange, 16)),

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
        [new Tile.Rock(), , new Tile.Goal([Dir.Left], [Color.Purple]), new Tile.Outlet(Dir.Right, [Color.Blue])],
        [new Tile.Outlet(Dir.Right, [Color.Blue]), , new Tile.Rock(), new Tile.Rock(), , new Tile.Goal([Dir.Up,Dir.Left], [Color.Blue, Color.Red])],
        [new Tile.Rock(), new Tile.Outlet(Dir.Down, [Color.Red]), new Tile.Rock(), new Tile.Outlet(Dir.Down, [Color.Red]), new Tile.Rock(), new Tile.Goal([Dir.Down], [Color.Purple])],
        [new Tile.Outlet(Dir.Right, [Color.Blue])],
        [new Tile.Rock(), , new Tile.Goal([Dir.Up, Dir.Left], [Color.Purple, Color.Purple]), new Tile.Goal([Dir.Up], [Color.Purple]), new Tile.Outlet(Dir.Up, [Color.Blue]), new Tile.Outlet(Dir.Up, [Color.Blue])],
    ];

    export const AnimTest = [
        [,,, new Tile.Painter([Dir.Down, Dir.Right], Color.Green)],
        [],
        [],
        [new Tile.Outlet(Dir.Right, [Color.Green]), , new Tile.Splitter(Dir.Left), , new Tile.Splitter(Dir.Left), , new Tile.Goal([Dir.Left], [Color.Green])],
        [],
        [],
        [,, new Tile.Goal([Dir.Up], [Color.Green])],
    ]

    export const Empty7 = gridFrom(7, () => undefined);
}

export const ProvidedLevels = {...Levels, TestLevels} as const;
export const Default = ["Calgary", "Multicolor"];