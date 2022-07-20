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
})({"b5POD":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
const CHUNK_SIZE = 50;
const N_WORKERS = 4;
let free = [];
/**
 * Map that links a worker to the task they've been assigned
 */ let labor = new Map();
/**
 * The queue to pull work from
 */ let workQueue;
/**
 * The current task to be working on
 */ let currentTask;
onmessage = async function(e) {
    let data = e.data;
    if (data.action === "init") {
        await initLoaders();
        self.postMessage({
            action: "ready"
        });
    } else if (data.action === "mainRequest") {
        let start = this.performance.now();
        let { pev , cd  } = data;
        // on a request, start up the queue and assign work to all currently free workers
        workQueue = queue(start, pev, cd);
        let fit = free[Symbol.iterator]();
        for (let w of fit){
            let t = workQueue.next();
            if (!t.done) assignWorkToWorker(w, t.value);
            else break;
        }
        free = [
            ...fit
        ];
    } else {
        let _ = data;
        throw new Error("Unexpected request into main worker");
    }
};
/**
 * @returns a promise which resolves once all the chunkLoaders have been created and initialized
 */ async function initLoaders() {
    if (free.length > 0) return;
    free = Array.from({
        length: N_WORKERS
    }, ()=>new Worker(require("3a5718b9a991627b")));
    let promises = Array.from(free, (w1)=>new Promise((resolve)=>{
            w1.onmessage = function(e) {
                resolve(w1);
            };
            w1.postMessage({
                action: "init"
            });
        }).then((w)=>{
            w.onmessage = function(e) {
                let out = e.data;
                let ticket = labor.get(w);
                if (typeof ticket === "undefined") return; // worker wasn't working on a ticket
                // If the current task is the currentTask, post up "loadChunk"
                let [sym, start] = ticket;
                if (currentTask == sym) self.postMessage(out, [
                    out.buf
                ]);
                // If there's any more work left to do, take it.
                // Otherwise, free the worker and post up "done"
                let t = workQueue.next();
                if (!t.done) // reassign
                assignWorkToWorker(w, t.value);
                else {
                    // no more work to do, free the worker
                    freeWorker(w);
                    // if all chunks finished, send done
                    if (typeof start !== "undefined" && labor.size == 0) {
                        let done = {
                            action: "done",
                            time: Math.trunc(performance.now() - start)
                        };
                        self.postMessage(done);
                    }
                }
            };
            w.onerror = function(e) {
                freeWorker(w);
            };
        }));
    return await Promise.all(promises);
}
/**
 * Generator that breaks up the canvas into computable chunks, which can be sent to chunkLoaders to compute them
 * @param start Time queue started
 * @param pev Partial evaluator that needs to be evaluated
 * @param cd The dimension data of the canvas to chunk
 */ function* queue(start, pev, cd) {
    let { width , height  } = cd;
    currentTask = Symbol("task");
    for(let i = 0; i < width; i += CHUNK_SIZE)for(let j = 0; j < height; j += CHUNK_SIZE){
        let cw = clamp(0, CHUNK_SIZE, width - i);
        let ch = clamp(0, CHUNK_SIZE, height - j);
        yield [
            {
                action: "chunkRequest",
                pev,
                cd,
                chunk: {
                    width: cw,
                    height: ch,
                    offx: i,
                    offy: j
                }
            },
            currentTask,
            start
        ];
    }
}
/**
 * Designate a worker as free to work.
 * @param w Worker to mark as free.
 */ function freeWorker(w) {
    labor.delete(w);
    free.push(w);
}
/**
 * Assign a worker a chunk to compute.
 * @param w Worker to designate.
 * @param param1 Ticket to work on.
 */ function assignWorkToWorker(w, [job, sym, start]) {
    w.postMessage(job);
    labor.set(w, [
        sym,
        start
    ]);
}
function clamp(v, min, max) {
    return Math.max(min, Math.min(v, max));
}

},{"3a5718b9a991627b":"iTgmt","@parcel/transformer-js/src/esmodule-helpers.js":"9HMD5"}],"iTgmt":[function(require,module,exports) {
let workerURL = require("./helpers/get-worker-url");
let bundleURL = require("./helpers/bundle-url");
let url = bundleURL.getBundleURL("gIi11") + "chunkloader.966fd52a.js";
module.exports = workerURL(url, bundleURL.getOrigin(url), false);

},{"./helpers/get-worker-url":"jRGBS","./helpers/bundle-url":"cjFer"}],"jRGBS":[function(require,module,exports) {
"use strict";
module.exports = function(workerUrl, origin, isESM) {
    if (origin === self.location.origin) // If the worker bundle's url is on the same origin as the document,
    // use the worker bundle's own url.
    return workerUrl;
    else {
        // Otherwise, create a blob URL which loads the worker bundle with `importScripts`.
        var source = isESM ? "import " + JSON.stringify(workerUrl) + ";" : "importScripts(" + JSON.stringify(workerUrl) + ");";
        return URL.createObjectURL(new Blob([
            source
        ], {
            type: "application/javascript"
        }));
    }
};

},{}],"cjFer":[function(require,module,exports) {
"use strict";
var bundleURL = {};
function getBundleURLCached(id) {
    var value = bundleURL[id];
    if (!value) {
        value = getBundleURL();
        bundleURL[id] = value;
    }
    return value;
}
function getBundleURL() {
    try {
        throw new Error();
    } catch (err) {
        var matches = ("" + err.stack).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^)\n]+/g);
        if (matches) // The first two stack frames will be this function and getBundleURLCached.
        // Use the 3rd one, which will be a runtime in the original bundle.
        return getBaseURL(matches[2]);
    }
    return "/";
}
function getBaseURL(url) {
    return ("" + url).replace(/^((?:https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/.+)\/[^/]+$/, "$1") + "/";
} // TODO: Replace uses with `new URL(url).origin` when ie11 is no longer supported.
function getOrigin(url) {
    var matches = ("" + url).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^/]+/);
    if (!matches) throw new Error("Origin not found");
    return matches[0];
}
exports.getBundleURL = getBundleURLCached;
exports.getBaseURL = getBaseURL;
exports.getOrigin = getOrigin;

},{}],"9HMD5":[function(require,module,exports) {
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

},{}]},["b5POD"], "b5POD", "parcelRequire94c2")

//# sourceMappingURL=main.45f4629f.js.map
