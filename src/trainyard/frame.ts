import * as PIXI from 'pixi.js'
// @ts-ignore
import assets from '../../static/*'

const loader = PIXI.Loader.shared,
   resources = PIXI.Loader.shared.resources;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

const app = new PIXI.Application({
    width: 512, 
    height: 512
});
document.querySelector("#game")!.prepend(app.view);

app.renderer.backgroundColor = 0xFFAFAF;
app.renderer.plugins.interaction.moveWhenInside = true;

loader
    .add(assets["trainyard.json"])
    .load(setup);

let textures: {[name: string]: PIXI.Texture<PIXI.Resource>};

let tile = (i: number) => [32 * (i % 16), 32 * (Math.floor(i / 16))] as [number, number];

function setup() {
    textures = resources[assets["trainyard.json"]].textures!;

    let i = 0;
    for (let t of Object.values(textures)) {
        let st = new PIXI.Sprite(t);
        st.position.set(...tile(i++));
        app.stage.addChild(st);
        
        st.interactive = true;
        st.on("mouseout", leave);
        st.on("mouseover", enter);
    }

    // app.ticker.add(gameLoop);
};

function enter(e: PIXI.InteractionEvent) {
    (e.currentTarget as PIXI.Sprite).tint = 0xFF0000;
}
function leave(e: PIXI.InteractionEvent) {
    (e.currentTarget as PIXI.Sprite).tint = 0xFFFFFF;
}

function gameLoop(delta: number) {
    // cat.x = (cat.x + speed + delta) % 256;
}