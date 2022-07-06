/**
 * Utility namespace to provide some shapes to build tile graphics with
 */

import * as PIXI from 'pixi.js'
import { Atlas, Color, Dir, Palette } from '../values';

/**
 * Creates a PIXI container that upscales to the correct size.
 * @param size Size to upscale
 * @param f Function to add everything into container before upscaling
 * @returns the new container
 */
export function sized(size: number, f?: (c: PIXI.Container) => void): PIXI.Container {
    const con = new PIXI.Container();
    f?.(con);

    con.width = size;
    con.height = size;
    return con;
}

const Ratios = {
    Box: {
        OUTLINE: 1 / 16,
        SPACE: 1 / 16
    },

    RAIL_WIDTH: 3 / 16,
    ARROW_BASE: 2 / 16,
    SYM_GAP: 1 / 32,
} as const;

const SYM_TEXTURE_SCALE = 10;

/**
 * Creates a box (which appears in tiles such as outlet and goal)
 * @param renderer renderer
 * @returns the box, and the inner value designating the size of the box without outline
 */
export function box(
    renderer: PIXI.AbstractRenderer, 
    size: number = 32
): [box: PIXI.Sprite, inner: number, outer: number] {
    const OUTLINE = Math.floor(size * Ratios.Box.OUTLINE);
    const SPACE   = Math.floor(size * Ratios.Box.SPACE);

    const outer = size - 2 * SPACE;
    const inner = size - 2 * (OUTLINE + SPACE);

    const boxGraphics = new PIXI.Graphics()
        .beginFill(Palette.Box.Outline, 1)
        .drawRect(SPACE, SPACE, outer, outer)
        .endFill()
        .beginFill(Palette.Box.BG, 1)
        .drawRect(SPACE + OUTLINE, SPACE + OUTLINE, inner, inner)
        .endFill();
    
    const box = new PIXI.Sprite(
        createRenderTexture(renderer, boxGraphics, size)
    );
    
    return [
        box, inner, outer
    ]
}

/**
 * Reposition a sprite so that it rotates around the center of the sprite 
 * and will appear correctly in a container.
 * 
 * Though, if the position is different than (0, 0) on a container, this doesn't really work.
 * @param sprite Sprite to reposition
 */
function pivotCenter(sprite: PIXI.Sprite) {
    const [cx, cy] = [sprite.width / 2, sprite.height / 2];

    sprite.pivot.set(cx, cy);
    sprite.position.set(cx, cy);
}

/**
 * Creates an active side indicator.
 * @param textures reference to the textures
 * @param d Direction the indicator points
 * @returns the sprite holding the indicator
 */
export function activeSide(textures: Atlas, d: Dir): PIXI.Sprite {
    const sprite = new PIXI.Sprite(textures["s_active.png"]);

    pivotCenter(sprite);
    sprite.angle = -90 * d;

    return sprite;
}

/**
 * Creates a passive side indicator.
 * @param textures reference to the textures
 * @param d Direction the indicator points
 * @returns the sprite holding the indicator
 */
export function passiveSide(textures: Atlas, d: Dir): PIXI.Sprite {
    const sprite = new PIXI.Sprite(textures["s_passive.png"]);

    pivotCenter(sprite);
    sprite.angle = -90 * d;

    return sprite;
}

/**
 * Create a render texture
 * @param renderer Renderer
 * @param o Object to render onto texture
 * @param size Dimensions of render texture
 * @returns render texture
 */
function createRenderTexture(
    renderer: PIXI.AbstractRenderer, 
    o: PIXI.DisplayObject, 
    size: number,
) {
    const renderTexture = PIXI.RenderTexture.create({width: size, height: size});
    renderer.render(o, {renderTexture});

    return renderTexture;
}

/**
 * Creates a sequence of symbols from a given symbol (e.g. circle, plus) and colors
 * @param renderer Renderer to render graphics
 * @param clrs Colors of the symbols
 * @param bounds Center and size of the box these symbols need to be placed in
 * @param symbol A function that creates the symbol from a given size.
 * The symbol should be [size x size] pixels, 
 * centered at (size / 2, size / 2), and colored white.
 * 
 * @returns the container holding the symbol set
 */
export function symbolSet(
    renderer: PIXI.AbstractRenderer,
    clrs: readonly Color[], 
    bounds: readonly [center: readonly [number, number], size: number], 
    symbol: (drawSize: number) => PIXI.Graphics
): PIXI.Container {
    const [boundsCenter, boundsSize] = bounds;
    const SYM_GAP = Math.floor(
        boundsSize * Ratios.SYM_GAP / (1 - 2 * (Ratios.Box.OUTLINE + Ratios.Box.SPACE))
    );

    const n = clrs.length;
    const rowN = Math.ceil(Math.sqrt(n));

    const [originX, originY] = boundsCenter.map(x => x - boundsSize / 2);
    const cellSize = (boundsSize - (rowN + 3) * SYM_GAP) / rowN;

    const drawSize = cellSize * SYM_TEXTURE_SCALE;
    const rt = createRenderTexture(renderer, symbol(drawSize), drawSize);

    const con = new PIXI.Container();

    for (let i = 0; i < n; i++) {
        let [cellX, cellY] = [i % rowN, Math.floor(i / rowN)];
        let [centerX, centerY] = [
            // origin > shift to top left pixel in cell > shift to center
            (originX + 2 * SYM_GAP) + (cellX * (cellSize + SYM_GAP)) + (cellSize / 2),
            (originY + 2 * SYM_GAP) + (cellY * (cellSize + SYM_GAP)) + (cellSize / 2),
        ]
        let clr = clrs[i];

        let sym = new PIXI.Sprite(rt);
        sym.scale.set(1 / SYM_TEXTURE_SCALE);
        sym.position.set(centerX - cellSize / 2, centerY - cellSize / 2);
        sym.tint = Palette.Train[clr];
        con.addChild(sym);
    }

    return con;
}

export function plus(size: number) {
    const width = size;
    const height = width / 2;

    const [dx, dy] = [-width / 2, -height / 2];
    return new PIXI.Graphics()
        .beginFill(0xFFFFFF)
        .drawRect(size / 2 + dx, size / 2 + dy, width, height)
        .drawRect(size / 2 + dy, size / 2 + dx, height, width);
}

export function circle(size: number) {
    return new PIXI.Graphics()
    .beginFill(0xFFFFFF)
    .drawCircle(size / 2, size / 2, size / 2);
}

/**
 * Creates a painter symbol sprite
 * @param textures reference to textures
 * @param c Color of the painter
 * @returns the sprite
 */
export function painterSymbol(textures: Atlas, c: Color): PIXI.Sprite {
    const sprite = new PIXI.Sprite(textures["t_painter.png"]);
    sprite.tint = Palette.Train[c];
    return sprite;
}

/**
 * Creates a splitter symbol sprite
 * @param textures reference to textures
 * @param d Direction of the splitter symbol
 * @returns the sprite
 */
export function splitterSymbol(textures: Atlas, d: Dir): PIXI.Sprite {
    const sprite = new PIXI.Sprite(textures["t_splitter.png"]);

    pivotCenter(sprite);
    sprite.angle = 180 - 90 * d;

    return sprite;
}

/**
 * Creates a rock sprite
 * @param textures reference to textures
 * @returns the sprite
 */
export function rock(textures: Atlas): PIXI.Sprite { // TODO
    const sprite = new PIXI.Sprite(textures["t_painter.png"]);
    
    pivotCenter(sprite);
    sprite.angle = 180;

    return sprite;
}

/**
 * Creates a SINGLE rail sprite
 * @param textures reference to textures
 * @param entrances the TWO entrances for the rail
 * @returns the sprite
 */
export function rail(textures: Atlas, ...entrances: Dir[]): PIXI.Sprite {
    let [e1, e2] = entrances;

    let straight = !((e1 - e2) % 2);
    
    let sprite = new PIXI.Sprite(textures[straight ? "rail.png" : "rail2.png"]);
    if (straight) {
        sprite.angle = -90 * e1;
    } else {
        let d = ((e2 - e1) % 4 + 4) % 4;
        if (d == 1) {
            // difference of 1 means e1 is left of e2
            sprite.angle = -90 * e1;
        } else { // d == 3
            // difference of 3 means e2 is left of e1
            sprite.angle = -90 * e2;
        }
    }

    pivotCenter(sprite);
    return sprite;
}

/**
 * Creates a hover indicator sprite
 * @param textures reference to the textures
 * @returns the sprite
 */
export function hoverIndicator(textures: Atlas): PIXI.Sprite {
    const sprite = new PIXI.Sprite(textures["hover.png"]);

    pivotCenter(sprite);
    return sprite;
}

export function train(renderer: PIXI.AbstractRenderer) {
    const graphics = new PIXI.Graphics()
        .beginFill(0xFFFFFF)
        .drawRect(0, 8, 28, 16)
        .beginFill(0x7F7F7F)
        .drawRect(28, 8, 4, 16)
    
    const rt = createRenderTexture(renderer, graphics, 32);
    const sprite = new PIXI.Sprite(rt);
    pivotCenter(sprite);
    return sprite;
}