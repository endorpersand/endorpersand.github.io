// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"eGSzb":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
let s = 25; // 1 game pixel = s canvas pixels
let [gMaxWidth, gMaxHeight] = toG([
    canvas.width,
    canvas.height
]);
let snake = [
    [
        Math.floor(gMaxWidth / 4),
        Math.floor(gMaxHeight / 2)
    ]
]; // [head, ..., tail]
let facing = "e"; //n, e, s, w
let apple;
// CONFIG //
const pal = {
    bg: "#222",
    snake: "#0b0",
    apple: "#d00",
    death: "#fff"
};
snake.length = 5; // initial snake length
const tpu = 75; // ticks per update
drawGRect([
    0,
    0
], canvas.width, canvas.height, pal.bg, [
    0,
    0
]); // draw bg
drawGRect(snake[0], s - 2, s - 2, pal.snake); // draw snake
drawApple();
let int = setInterval(update, tpu);
document.onkeydown = (e)=>{
    switch(e.code){
        case "KeyW":
        case "ArrowUp":
            if (facing != "s" && facing != "n") {
                facing = "n";
                update();
            }
            break;
        case "KeyA":
        case "ArrowLeft":
            if (facing != "e" && facing != "w") {
                facing = "w";
                update();
            }
            break;
        case "KeyS":
        case "ArrowDown":
            if (facing != "s" && facing != "n") {
                facing = "s";
                update();
            }
            break;
        case "KeyD":
        case "ArrowRight":
            if (facing != "e" && facing != "w") {
                facing = "e";
                update();
            }
            break;
        case "KeyR":
            die();
            break;
    }
};
document.onblur = ()=>{
    clearInterval(int);
    int = undefined;
};
document.onfocus = ()=>{
    int = int || setInterval(update, tpu);
};
function drawGRect(g, cw, ch, color, cshift = [
    1,
    1
]) {
    let c = toC(g).map((x, i)=>x + cshift[i]); // conv g coord and then shift point in c space
    ctx.fillStyle = color;
    ctx.fillRect(...c, cw, ch);
}
function drawSnakeSeg(g) {
    /*
     * if s = 4,
     * ........
     * .xx..xx.
     * .xx..xx.
     * ........
     * o.......
     * .xx..xx.
     * .xx..xx.
     * ........
     *
     *
     *
     */ switch(facing){
        case "n":
            drawGRect(g, s - 2, s, pal.snake) //, [1, 1]);
            ;
            break;
        case "e":
            drawGRect(g, s, s - 2, pal.snake, [
                -1,
                1
            ]) //, [-1, 1]);
            ;
            break;
        case "s":
            drawGRect(g, s - 2, s, pal.snake, [
                1,
                -1
            ]) //, [1, -1]);
            ;
            break;
        case "w":
            drawGRect(g, s, s - 2, pal.snake) //, [1, 1]);
            ;
            break;
    }
}
function drawApple() {
    do apple = [
        Math.floor(Math.random() * gMaxWidth),
        Math.floor(Math.random() * gMaxHeight)
    ];
    while (snake.some((x)=>arrEq(x, apple)));
    drawGRect(apple, s - 2, s - 2, pal.apple); // spawn apple
}
function update() {
    let nextPos = [
        ...snake[0]
    ]; //clone head
    switch(facing){
        case "n":
            nextPos[1]--;
            break;
        case "e":
            nextPos[0]++;
            break;
        case "s":
            nextPos[1]++;
            break;
        case "w":
            nextPos[0]--;
            break;
    }
    if (!arrEq(apple, nextPos)) {
        // if next pos is not apple, delete tail
        let stail = snake.pop();
        drawGRect(stail, s + 2, s + 2, pal.bg, [
            -1,
            -1
        ]);
    }
    if (arrEq(apple, nextPos)) drawApple(); // if next pos is apple, spawn a new apple
    if (arrIncludes(snake, nextPos)) die(); // if next pos is snake, die
    if (isOutBound(nextPos)) die(); // if next pos is void, die
    //console.log(nextColor, appleData);
    snake.unshift(nextPos);
    drawSnakeSeg(nextPos);
    document.querySelector("#score").textContent = `Score: ${snake.length}`;
}
function die() {
    clearInterval(int);
    ctx.fillStyle = pal.death;
    ctx.font = `${canvas.width * 250 / 700}px 'Comic Sans MS', 'Papyrus', 'Impact', fantasy, cursive, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("F", canvas.width / 2, canvas.height / 2);
    document.onkeydown = (e)=>e.key == "r" ? location.reload() : void 0;
    document.onfocus = null;
    let button = document.createElement("button");
    button.textContent = "Restart";
    button.onclick = ()=>location.reload();
    document.querySelector("#score")?.parentElement?.appendChild(button);
}
function toC(g) {
    // converts a game coord to canvas coord
    return (g ?? [
        0,
        0
    ]).map((x)=>x * s);
}
function toG(c) {
    // converts a canvas coord to game coord
    return (c ?? [
        0,
        0
    ]).map((x)=>x / s);
}
function isOutBound(g) {
    // game bounds [0, gMaxWidth), [0, gMaxHeight)
    return g[0] < 0 || g[0] >= gMaxWidth || g[1] < 0 || g[1] >= gMaxHeight;
}
function arrEq(a1, a2) {
    return a1.every((x, i)=>x == a2[i]);
}
function arrIncludes(metarr, arr) {
    return metarr.some((a)=>arrEq(a, arr));
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"7TKJq"}],"7TKJq":[function(require,module,exports) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, "__esModule", {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === "default" || key === "__esModule" || dest.hasOwnProperty(key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}]},["eGSzb"], "eGSzb", "parcelRequire94c2")

//# sourceMappingURL=snake.baef0600.js.map
