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
})({"k5Www":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
const linCanvas = document.querySelector("#lin-result canvas");
const lctx = linCanvas.getContext("2d", {
    alpha: false
});
const rmsCanvas = document.querySelector("#rms-result canvas");
const rctx = rmsCanvas.getContext("2d", {
    alpha: false
});
const cssCanvas = document.querySelector("#css-result div#css-gradient");
const coloradd = document.querySelector("button#coloradd");
const colorsWrapper = document.querySelector("div#colors");
const gammaInput = document.querySelector("input#gamma-input");
const DEFAULT_GAMMA = 2.2;
/**
 * Computes the input gamma.
 */ function gamma() {
    if (!gammaInput.checkValidity() || gammaInput.value === "") gammaInput.value = "" + DEFAULT_GAMMA;
    return +gammaInput.value;
}
updateAll();
document.querySelectorAll("input[type=color]").forEach((x)=>x.addEventListener("change", updateAll));
gammaInput.addEventListener("input", updateAll);
/**
 * Add another color stop to the display. This automatically inserts the color input to DOM.
 * @param update Whether or not the gradients should be refreshed.
 * @returns the color stop element
 */ function addColorInput(update = true) {
    let div = makeColorDiv();
    colorsWrapper.insertBefore(div, coloradd);
    let buts = colorRMButtons();
    if (buts.length > 2) for (let b of buts)b.disabled = false;
    if (update) updateAll();
    return div;
}
coloradd.addEventListener("click", ()=>{
    addColorInput(true);
});
document.querySelectorAll(".colorrm").forEach((e)=>e.addEventListener("click", ()=>{
        colorsWrapper.removeChild(e.parentElement);
        let buts = colorRMButtons();
        if (buts.length < 3) for (let b of buts)b.disabled = true;
        updateAll();
    }));
/**
 * @returns the input colors as hex strings
 */ function getColors() {
    let cinputs = document.querySelectorAll("input[type=color]");
    return Array.from(cinputs, (e)=>e.value);
}
/**
 * Takes a hex string and converts it into an RGB array
 * @param hex hex string
 * @returns RGB array
 */ function rgb(hex) {
    return [
        hex.slice(1, 3),
        hex.slice(3, 5),
        hex.slice(5, 7)
    ].map((x)=>parseInt(x, 16));
}
/**
 * @returns every color input <div>
 */ function colorInput() {
    return colorsWrapper.querySelectorAll("div");
}
/**
 * @returns every color "remove" button
 */ function colorRMButtons() {
    return document.querySelectorAll("button.colorrm");
}
/**
 * Creates a color input div
 * @param hex Initial color of the div
 * @returns the div
 */ function makeColorDiv(hex = "#000000") {
    let div = document.createElement("div");
    let clr = document.createElement("input");
    clr.type = "color";
    clr.value = hex;
    clr.addEventListener("change", updateAll);
    let button = document.createElement("button");
    button.classList.add("colorrm");
    button.textContent = "x";
    button.addEventListener("click", ()=>{
        colorsWrapper.removeChild(div);
        let buts = colorRMButtons();
        if (buts.length < 3) for (let b of buts)b.disabled = true;
        updateAll();
    });
    div.append(clr, button);
    return div;
}
/**
 * Interpolates from one number to another using root-mean-square (the end points are squared, averaged, then the mean is rooted).
 * @param a endpoint
 * @param b endpoint
 * @param prog [0, 1)
 * @returns interpolated value
 */ function gammaInterpolate(a, b, gamma1, prog) {
    return ((1 - prog) * a ** gamma1 + prog * b ** gamma1) ** (1 / gamma1);
}
/**
 * Update all result canvases
 */ function updateAll() {
    const clrs = getColors();
    cssCanvas.style.background = `linear-gradient(0.25turn, ${clrs.join(", ")})`;
    updateCanvas(lctx, "lin", clrs);
    updateCanvas(rctx, "rms", clrs);
}
/**
 * Update a canvas using a specified interpolation type and array of colors
 * @param ctx the canvas's rendering context
 * @param ipol interpolation type
 * @param clrs array of colors to update the canvas with
 */ function updateCanvas(ctx, ipol, clrs) {
    const lastIndex = clrs.length - 1;
    const canvas = ctx.canvas;
    if (ipol === "lin") {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        for (var [i1, c] of clrs.entries())grad.addColorStop(i1 / lastIndex, c);
        ctx.fillStyle = grad;
    } else if (ipol === "rms") {
        let ocanvas;
        if ("OffscreenCanvas" in globalThis) ocanvas = new OffscreenCanvas(canvas.width, 1);
        else {
            ocanvas = document.createElement("canvas");
            [ocanvas.width, ocanvas.height] = [
                canvas.width,
                1
            ];
        }
        const octx = ocanvas.getContext("2d");
        const dat = octx.createImageData(ocanvas.width, 1);
        const arr32 = new Uint32Array(dat.data.buffer);
        const arr32LastIndex = arr32.length - 1;
        for(var i1 = 0; i1 < arr32.length; i1++){
            const pos = i1 / arr32LastIndex * lastIndex;
            const [j, prog] = [
                Math.floor(pos),
                pos % 1
            ];
            const [a, b] = [
                clrs[j],
                clrs[j + 1] ?? "#000000"
            ].map((x)=>rgb(x));
            const c = Array.from({
                length: 3
            }, (_, i)=>gammaInterpolate(a[i], b[i], gamma(), prog));
            arr32[i1] = -16777216 | c[2] << 16 | c[1] << 8 | c[0] << 0;
        }
        octx.putImageData(dat, 0, 0);
        const pat = ctx.createPattern(ocanvas, "repeat-y");
        ctx.fillStyle = pat;
    } else {
        let _ = ipol;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function setColors(...clrs) {
    let inputs = [
        ...colorInput()
    ];
    if (clrs.length < 2) throw new Error("Two colors are required for a gradient");
    while(clrs.length < inputs.length)inputs.pop()?.remove();
    while(inputs.length < clrs.length)inputs.push(addColorInput(false));
    inputs.forEach((div, i)=>{
        const input = div.querySelector("input[type=color]");
        const clr = clrs[i];
        input.value = clr;
    });
    updateAll();
}
window.setColors = setColors;
function gay() {
    setColors("#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#FF0000");
}
window.gay = gay;

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

},{}]},["k5Www"], "k5Www", "parcelRequire94c2")

//# sourceMappingURL=gradient.189c4587.js.map
