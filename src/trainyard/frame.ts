import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
const game = document.querySelector("#game")!;
const app = new PIXI.Application({
    width: 256, 
    height: 256
});

app.renderer.backgroundColor = 0xFFAFAF;
game.prepend(app.view);

loader
    .add(assets["trainyard.json"])
    .load(setup);

let textures: {[name: string]: PIXI.Texture<PIXI.Resource>};

let tile = (i: number) => [32 * (i % 8), 32 * (Math.floor(i / 8))] as [number, number];

function setup() {
    textures = resources[assets["trainyard.json"]].textures!;

    let i = 0;
    for (let t of Object.values(textures)) {
        let st = new PIXI.Sprite(t);
        st.position.set(...tile(i++));
        app.stage.addChild(st);
    }

    app.ticker.add(gameLoop);
};

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
}