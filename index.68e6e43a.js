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
})({"feclo":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
let wrapper = document.querySelector(".wrapper");
class SquareTracker {
    static _MIN_ROWS = 3;
    corners = [
        [
            0x77,
            0x77,
            0x77
        ],
        [
            0x77,
            0x77,
            0x77
        ],
        [
            0x77,
            0x77,
            0x77
        ],
        [
            0x77,
            0x77,
            0x77
        ]
    ];
    constructor(){
        this._cols = +getComputedStyle(document.documentElement).getPropertyValue("--cols");
        this.projectSquares = [
            ...wrapper.querySelectorAll("a")
        ];
        for (let s of this.projectSquares){
            let span = document.createElement("span");
            span.classList.add("colhex");
            s.appendChild(span);
            s.classList.add("box");
        }
        this.placeholderSquares = [];
        for(let i = this.squares; i < this.cols * SquareTracker._MIN_ROWS; i++)this._addSquare();
    }
    get squares() {
        return this.projectSquares.length + this.placeholderSquares.length;
    }
    get cols() {
        return this._cols;
    }
    set cols(value) {
        if (value != this._cols) {
            this._cols = value;
            this._rebalance();
        }
    }
    get rows() {
        return this.squares / this.cols;
    }
    _addSquare() {
        let box = document.createElement("div");
        let title = document.createElement("div");
        let desc = document.createElement("div");
        let colhex = document.createElement("span");
        title.classList.add("title");
        desc.classList.add("desc");
        colhex.classList.add("colhex");
        box.classList.add("box");
        box.append(title, desc, colhex);
        box.addEventListener("click", this.regenColors.bind(this, false));
        wrapper.appendChild(box);
        this.placeholderSquares.push(box);
    }
    _removeSquare() {
        this.placeholderSquares.pop()?.remove();
    }
    _rebalance() {
        let squares1 = this.squares;
        // n = number of squares that should be on board
        let n = Math.max(this._cols * SquareTracker._MIN_ROWS, this.projectSquares.length);
        n = Math.ceil(n / this._cols) * this._cols;
        if (squares1 == n) return;
        if (squares1 > n) for(let i = squares1; i > n; i--)this._removeSquare();
        else if (squares1 < n) for(let i1 = squares1; i1 < n; i1++)this._addSquare();
        this.regenColors(true);
    }
    forEach(callback) {
        let i = 0;
        for (let e of this.projectSquares)callback(e, i++);
        for (let e1 of this.placeholderSquares)callback(e1, i++);
    }
    regenColors(useCurrentCorners = false) {
        if (!useCurrentCorners) this.corners = Array.from({
            length: 4
        }, ()=>randRGB(0x50));
        let corners = this.corners;
        if (this._cols < 3) {
            // use TL + BR boxes rather than the corners to make a consistent grid (rather than 2 columns of color)
            let corners2 = [
                corners[2],
                corners[1]
            ];
            this.assignColors((i)=>interpolate2(corners2, asCoord(i)), useCurrentCorners);
        } else this.assignColors((i)=>interpolate4(corners, asNormCoord(i)), useCurrentCorners);
    }
    assignColors(callback, skipTransition = false) {
        squares.forEach((s, i)=>{
            let clr = callback(i);
            if (skipTransition) {
                s.classList.add("no-transition");
                s.offsetHeight;
            }
            s.style.backgroundColor = hex(clr);
            s.querySelector(".colhex").textContent = hex(clr);
        });
        if (skipTransition) // return transition after color change
        requestAnimationFrame(()=>{
            requestAnimationFrame(()=>{
                squares.forEach((s)=>{
                    s.classList.remove("no-transition");
                });
            });
        });
    }
}
let squares = new SquareTracker();
squares.regenColors();
window.addEventListener("resize", (e)=>{
    squares.cols = +getComputedStyle(wrapper).getPropertyValue("--cols");
});
function asCoord(i) {
    // takes an index in the array, maps it to its [row, col] value
    return [
        Math.floor(i / squares.cols),
        i % squares.cols
    ];
}
function asNormCoord(i) {
    // takes an index in the array, maps it to its NormCoord value
    let [r, c] = asCoord(i);
    return [
        r / (squares.rows - 1),
        c / (squares.cols - 1)
    ];
}
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
function randRGB(min = 0, max = 256) {
    // [min, max)
    return Array.from({
        length: 3
    }, ()=>randInt(min, max));
}
function hex(arr) {
    // converts rgb array => hex notation
    return `#${arr.map((x)=>Math.round(x).toString(16).padStart(2, "0")).join("")}`;
}
function zip(...v) {
    let length = v[0].length;
    return Array.from({
        length
    }, (_, i)=>v.map((a)=>a[i]));
}
function lerp(pts, dist) {
    let [p, q] = pts;
    let length = p.length;
    return Array.from({
        length
    }, (_, i)=>{
        let a = p[i], b = q[i];
        return a + dist * (b - a);
    });
}
function bilerp(pts, c) {
    let [px, py] = c;
    let [top, bottom] = [
        pts.slice(0, 2),
        pts.slice(2, 4)
    ];
    return lerp([
        lerp(bottom, px),
        lerp(top, px)
    ], py);
}
// interpolate given that each corner is assigned a color
function interpolate4(clrs, c1) {
    // weight = how much each of the 4 points are valued based on the distance point c is from the corner
    let weights = bilerp([
        [
            1,
            0,
            0,
            0
        ],
        [
            0,
            1,
            0,
            0
        ],
        [
            0,
            0,
            1,
            0
        ],
        [
            0,
            0,
            0,
            1
        ]
    ], c1);
    return Array.from({
        length: 3
    }, (_, i)=>{
        let channels = clrs.map((clr)=>clr[i]);
        let sqsum = zip(channels, weights).map(([c, w])=>w * c * c).reduce((acc, cv)=>acc + cv);
        return Math.round(Math.sqrt(sqsum));
    });
}
function manhattan(p, q) {
    return zip(p, q).map(([px, qx])=>Math.abs(px - qx)).reduce((acc, cv)=>acc + cv);
}
// interpolate given that the top left and bottom right are assigned colors
function interpolate2(clrs, c2) {
    // weight = how much each of the 2 points are valued based on the distance point c is from the corner
    let [aw, bw] = [
        manhattan([
            0,
            0
        ], c2),
        manhattan([
            squares.rows - 1,
            squares.cols - 1
        ], c2), 
    ];
    let weights = [
        bw / (aw + bw),
        aw / (aw + bw)
    ];
    return Array.from({
        length: 3
    }, (_, i)=>{
        let channels = clrs.map((clr)=>clr[i]);
        let sqsum = zip(channels, weights).map(([c, w])=>w * c * c).reduce((acc, cv)=>acc + cv);
        return Math.round(Math.sqrt(sqsum));
    });
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

},{}]},["feclo"], "feclo", "parcelRequire94c2")

//# sourceMappingURL=index.68e6e43a.js.map
