/**
 * Utility namespace to provide some shapes to build tile graphics with
 */

import * as PIXI from 'pixi.js'
import { Color, Dir, Palette, PIXIResources } from '../values';

const SpriteCache: {
    [name: string]: {
        [size: number]: PIXI.RenderTexture
    }
} = {};


export const Ratios = {
    Box: {
        Outline: {
            DEFAULT: 1 / 16,
            OUTLET: 1 / 16
        },
        SPACE: 1 / 16
    },

    Rail: {
        INNER_WIDTH: 7 / 32,
        OUTER_WIDTH: 9 / 32
    },
    ARROW_BASE: 2 / 16,
    SYM_GAP: 1 / 32,
} as const;

const SYM_TEXTURE_SCALE = 5;

namespace Symbols {
    export function circle(size: number) {
        return new PIXI.Graphics()
        .beginFill(0xFFFFFF)
        .drawCircle(size / 2, size / 2, size / 2);
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
}

/**
 * Sprite class that adds a second anchor. 
 * The original anchor is used as the rotation anchor, 
 * while the new anchor (`posAnchor`) is used as the translational anchor.
 */
export class TwoAnchorSprite extends PIXI.Sprite {
    #posAnchor: PIXI.ObservablePoint;
    #position: PIXI.ObservablePoint;

    constructor(texture: PIXI.Texture) {
        super(texture);
        this.#posAnchor = this.#makePoint(0, 0);
        this.#position = this.#makePoint(this.transform.position.x, this.transform.position.y);

        const anchorCB = this._anchor.cb;
        this._anchor.cb = function() {
            anchorCB();
            this.#updatePosition();
        }
    }

    /**
     * Creates a TwoAnchorSprite that rotates around its center
     */
    static centered(texture: PIXI.Texture) {
        const sprite = new TwoAnchorSprite(texture);
        sprite.anchor.set(0.5, 0.5);
        return sprite;
    }

    #updatePosition() {
        const panchor = this.#panchor;
        const anchor = this.anchor;
        
        const dx = (panchor.x - anchor.x) * this.width;
        const dy = (panchor.y - anchor.y) * this.height;

        // dx, dy = -16, -16
        // panchor is 16, 16 up/left from anchor

        const {x, y} = this.#position;
        this.transform.position.set(x - dx, y - dy);
    }
    updatePosition() { return this.#updatePosition(); }
    #makePoint(x: number, y: number) {
        return new PIXI.ObservablePoint( this.#updatePosition, this, x, y );
    }

    get #panchor() {
        return this.#posAnchor ?? this._anchor;
    }

    /** The positional origin point of the sprite */
    get posAnchor(): PIXI.ObservablePoint {
        return this.#posAnchor;
    }
    set posAnchor(v: PIXI.ObservablePoint) {
        this.#posAnchor.copyFrom(v);
    }

    get position(): PIXI.ObservablePoint {
        return this.#position;
    }
    set position(v: PIXI.IPointData) {
        this.#position.copyFrom(v);
    }

    get width() {
        return super.width;
    }
    set width(w: number) {
        super.width = w;
        this.#updatePosition();
    }
    get height() {
        return super.height;
    }
    set height(h: number) {
        super.height = h;
        this.#updatePosition();
    }
}

/**
 * Round to the nearest integer that matches the parity of the given size.
 * @param x Number to round
 * @param toOdd True? Round to nearest odd. False? Round to nearest even.
 * @returns Rounded number
 */
function roundToParity(x: number, toOdd: number | boolean) {
    const parity = +!!(+toOdd % 2);
    return 2 * Math.round((x + parity) / 2) - parity;
}

/**
 * Creates a box (which appears in tiles such as outlet and goal)
 * @param renderer renderer
 * @returns the box, and the inner value designating the size of the box without outline
 */
export function box(
    {renderer}: PIXIResources, 
    outline: {ratio?: number, color?: number},
    size: number
): [box: PIXI.Container, inner: number, outer: number] {
    const ratio = outline.ratio ?? Ratios.Box.Outline.DEFAULT;
    const color = outline.color ?? Palette.Box.Outline.Default;

    const OUTLINE = Math.floor(size * ratio);
    const SPACE   = Math.floor(size * Ratios.Box.SPACE);

    const outer = size - 2 * SPACE;
    const inner = size - 2 * (OUTLINE + SPACE);

    const outlineRT = loadRenderTexture(renderer, `boxOutline[ratio=${ratio}]`, size, size => {
        return new PIXI.Graphics()
            .beginFill(0xFFFFFF, 1)
            .drawRect(SPACE, SPACE, outer, outer)
            .endFill()
            .beginHole()
            .drawRect(SPACE + OUTLINE, SPACE + OUTLINE, inner, inner)
            .endFill();
    });

    const outlineSprite = new PIXI.Sprite(outlineRT);
    outlineSprite.tint = color;

    const bg = new PIXI.Sprite(PIXI.Texture.WHITE);
    bg.tint = Palette.Box.BG;
    bg.position.set(SPACE + OUTLINE);
    bg.width = inner;
    bg.height = inner;

    const box = new PIXI.Container();
    box.addChild(bg, outlineSprite);
    
    return [
        box, inner, outer
    ]
}

/**
 * Creates an active side indicator.
 * @param textures reference to the textures
 * @param d Direction the indicator points
 * @returns the sprite holding the indicator
 */
export function activeSide({textures}: PIXIResources, d: Dir, size: number): TwoAnchorSprite {
    const sprite = TwoAnchorSprite.centered(textures["s_active.png"]);
    sprite.width = size;
    sprite.height = size;
    sprite.angle = -90 * d;
    return sprite;
}

/**
 * Creates a passive side indicator.
 * @param textures reference to the textures
 * @param d Direction the indicator points
 * @returns the sprite holding the indicator
 */
export function passiveSide({textures}: PIXIResources, d: Dir, size: number): TwoAnchorSprite {
    const sprite = TwoAnchorSprite.centered(textures["s_passive.png"]);
    sprite.width = size;
    sprite.height = size;
    sprite.angle = -90 * d;
    return sprite;
}


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
 * Load a render texture from cache or create one with the fallback callback if not in cache
 * @param renderer Renderer
 * @param name Name of the render texture
 * @param size Size of the render texture
 * @param fallback Callback to create a display object to render if not in cache
 * @returns display texture
 */
function loadRenderTexture(renderer: PIXI.AbstractRenderer, name: string, size: number, fallback: (drawSize: number) => PIXI.DisplayObject) {
    const cached = SpriteCache[name]?.[size];

    if (cached) return cached;
    const rt = createRenderTexture(renderer, fallback(size), size);
    (SpriteCache[name] ??= {})[size] = rt;
    return rt;
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
    {renderer}: PIXIResources,
    clrs: readonly Color[], 
    bounds: readonly [center: readonly [number, number], size: number], 
    symbol: keyof typeof Symbols | [name: string, cb: (drawSize: number) => PIXI.Graphics]
): PIXI.Container {
    const [boundsCenter, boundsSize] = bounds;
    const SYM_GAP = Math.floor(
        boundsSize * Ratios.SYM_GAP / (1 - 2 * (Ratios.Box.Outline.DEFAULT + Ratios.Box.SPACE))
    );

    const n = clrs.length;
    const rowN = Math.ceil(Math.sqrt(n));

    const [originX, originY] = boundsCenter.map(x => x - boundsSize / 2);
    const cellSize = (boundsSize - (rowN + 3) * SYM_GAP) / rowN;

    const drawSize = cellSize * SYM_TEXTURE_SCALE;

    let symName: string, s: (n: number) => PIXI.Graphics;
    if (typeof symbol === "string") {
        [symName, s] = [symbol, Symbols[symbol]];
    } else {
        [symName, s] = symbol;
    }

    const rt = loadRenderTexture(renderer, symName, drawSize, drawSize => s(drawSize));
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

/**
 * Creates a painter symbol sprite
 * @param textures reference to textures
 * @param c Color of the painter
 * @returns the sprite
 */
export function painterSymbol({textures}: PIXIResources, c: Color, size: number): PIXI.Sprite {
    const sprite = new PIXI.Sprite(textures["t_painter.png"]);
    sprite.width = size;
    sprite.height = size;
    sprite.tint = Palette.Train[c];
    return sprite;
}

/**
 * Creates a splitter symbol sprite
 * @param textures reference to textures
 * @param d Direction of the splitter symbol
 * @returns the sprite
 */
export function splitterSymbol({textures}: PIXIResources, d: Dir, size: number): TwoAnchorSprite {
    const sprite = TwoAnchorSprite.centered(textures["t_splitter.png"]);
    sprite.width = size;
    sprite.height = size;
    sprite.angle = 180 - 90 * d;
    return sprite;
}

/**
 * Creates a rock sprite
 * @param textures reference to textures
 * @returns the sprite
 */
export function rock({textures}: PIXIResources, size: number): TwoAnchorSprite { // TODO
    const sprite = TwoAnchorSprite.centered(textures["t_painter.png"]);
    sprite.width = size;
    sprite.height = size;
    sprite.angle = 180;
    return sprite;
}

/**
 * Creates a SINGLE rail sprite
 * @param textures reference to textures
 * @param entrances the TWO entrances for the rail
 * @returns the sprite
 */
export function rail({renderer}: PIXIResources, entrances: Dir[], size: number): TwoAnchorSprite {
    let [e1, e2] = entrances;

    let straight = !((e1 - e2) % 2);
    
    let rt: PIXI.RenderTexture;
    if (straight) {
        rt = loadRenderTexture(renderer, "railStraight", size, size => {
            const width = size;
            const outerHeight = roundToParity(size * Ratios.Rail.OUTER_WIDTH, 0);
            const innerHeight = roundToParity(size * Ratios.Rail.INNER_WIDTH, 0);
            
            return new PIXI.Graphics()
                .beginFill(Palette.Rail.Outer)
                .drawRect(size / 2 - width / 2, size / 2 - outerHeight / 2, width, outerHeight)
                .endFill()
                .beginFill(Palette.Rail.Inner)
                .drawRect(size / 2 - width / 2, size / 2 - innerHeight / 2, width, innerHeight)
                .endFill();
        });
    } else {
        rt = loadRenderTexture(renderer, "railCurved", size * SYM_TEXTURE_SCALE, size => {
            const outerThickness = roundToParity(size * Ratios.Rail.OUTER_WIDTH, 0);
            const innerThickness = roundToParity(size * Ratios.Rail.INNER_WIDTH, 0);
            
            // draw ring
            const center = [size, 0] as const;
            const radius = size / 2;

            return new PIXI.Graphics()
                .beginFill(Palette.Rail.Outer)
                .moveTo(...center)
                .arc(...center, radius + outerThickness / 2, 0, 2 * Math.PI)
                .endFill()

                .beginHole()
                .moveTo(...center)
                .arc(...center, radius - outerThickness / 2, 0, 2 * Math.PI)
                .endHole()

                .beginFill(Palette.Rail.Inner)
                .moveTo(...center)
                .arc(...center, radius + innerThickness / 2, 0, 2 * Math.PI)
                .endFill()

                .beginHole()
                .moveTo(...center)
                .arc(...center, radius - innerThickness / 2, 0, 2 * Math.PI)
                .endHole();
        });
    }
    const sprite = TwoAnchorSprite.centered(rt);
    sprite.width = size;
    sprite.height = size;

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

    return sprite;
}

/**
 * Creates a hover indicator sprite
 * @param textures reference to the textures
 * @returns the sprite
 */
export function hoverIndicator({textures}: PIXIResources, size: number): TwoAnchorSprite {
    const sprite = TwoAnchorSprite.centered(textures["hover.png"]);
    sprite.width = size;
    sprite.height = size;
    return sprite;
}

export function train({renderer}: PIXIResources, size: number) {
    const rt = loadRenderTexture(renderer, "train", size, size => {
        return new PIXI.Graphics()
            .beginFill(0xFFFFFF)
            .drawRect(0, 8, 28, 16)
            .beginFill(0x7F7F7F)
            .drawRect(28, 8, 4, 16)
    });
    
    return TwoAnchorSprite.centered(rt);
}