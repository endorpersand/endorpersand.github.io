import * as PIXI from 'pixi.js'

const app = new PIXI.Application({
    width: 800, 
    height: 800
});

app.renderer.backgroundColor = 0xFF0000;
document.body.appendChild(app.view)
console.log('2');