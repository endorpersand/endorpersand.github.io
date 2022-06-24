import * as PIXI from 'pixi.js'

const game = document.querySelector("#game")!;
const app = new PIXI.Application({
    width: 500, 
    height: 500
});

app.renderer.backgroundColor = 0xFF0000;
game.prepend(app.view);