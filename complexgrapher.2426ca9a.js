!function(){function e(e,t,n,r){Object.defineProperty(e,t,{get:n,set:r,enumerable:!0,configurable:!0})}function t(e){return e&&e.__esModule?e.default:e}var n="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},r={},o={},i=n.parcelRequire94c2;function a(e,t,n,r,o,i,a){try{var c=e[i](a),u=c.value}catch(e){return void n(e)}c.done?t(u):Promise.resolve(u).then(r,o)}function c(e){return function(){var t=this,n=arguments;return new Promise((function(r,o){var i=e.apply(t,n);function c(e){a(i,r,o,c,u,"next",e)}function u(e){a(i,r,o,c,u,"throw",e)}c(void 0)}))}}null==i&&((i=function(e){if(e in r)return r[e].exports;if(e in o){var t=o[e];delete o[e];var n={id:e,exports:{}};return r[e]=n,t.call(n.exports,n,n.exports),n.exports}var i=new Error("Cannot find module '"+e+"'");throw i.code="MODULE_NOT_FOUND",i}).register=function(e,t){o[e]=t},n.parcelRequire94c2=i),i.register("91UpR",(function(t,n){var r,o;e(t.exports,"register",(function(){return r}),(function(e){return r=e})),e(t.exports,"resolve",(function(){return o}),(function(e){return o=e}));var i={};r=function(e){for(var t=Object.keys(e),n=0;n<t.length;n++)i[t[n]]=e[t[n]]},o=function(e){var t=i[e];if(null==t)throw new Error("Could not resolve bundle with id "+e);return t}})),i("91UpR").register(JSON.parse('{"5Hjnn":"complexgrapher.2426ca9a.js","dq1cl":"webkitTest.5c78f70c.js","egthy":"main.6c1b5113.js","8urlN":"main.9853c391.js","9vJF7":"chunkLoader.bf0e0b55.js","l8xXq":"chunkLoader.0046dfdb.js","aUCA8":"complexgrapher.6b0c010b.js"}'));var u=i("7jJm3"),s=i("9uQq0"),f=i("isjeC"),l=i("b3Rbn"),d=(0,l.create)(l.all),p=document.querySelector("#wrapper"),v=document.querySelector("#funcForm"),m=v.querySelector("input"),h=document.querySelector("#graphButton"),g=document.querySelector("#zcoord"),w=document.querySelectorAll("button.zoom"),y=document.querySelector("#zoomForm"),x=y.querySelector("input"),E=document.querySelector("#scaleForm"),b=E.querySelector("input"),k=document.querySelector("#warning"),S=document.querySelectorAll(".domain"),L=document.createElement("canvas"),q=L.getContext("2d",{alpha:!1});p.appendChild(L);var j=[d.complex("-2-2i"),d.complex("2+2i")],H=R();function R(){var e=parseInt(getComputedStyle(p).padding);return Math.min(250,(document.documentElement.clientWidth-1)/2-e)}b.value=""+H;var _,z,C,F,A,N,O,U=1,D=function(e){return e};A=function(e,t,n){if(t===self.location.origin)return e;var r=n?"import "+JSON.stringify(e)+";":"importScripts("+JSON.stringify(e)+");";return URL.createObjectURL(new Blob([r],{type:"application/javascript"}))};var T={};function M(e){return(""+e).replace(/^((?:https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/.+)\/[^/]+$/,"$1")+"/"}N=function(e){var t=T[e];return t||(t=function(){try{throw new Error}catch(t){var e=(""+t.stack).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^)\n]+/g);if(e)return M(e[2])}return"/"}(),T[e]=t),t},O=function(e){var t=(""+e).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^/]+/);if(!t)throw new Error("Origin not found");return t[0]};var J=N("5Hjnn")+i("91UpR").resolve("dq1cl");F=A(J,O(J),!1);var P=new Worker(F);P.postMessage(void 0);var I,W=N("5Hjnn")+i("91UpR").resolve("egthy");I=A(W,O(W),!1);var X,B,Y,$=N("5Hjnn")+i("91UpR").resolve("9vJF7");function G(e){var t=e.pageX-L.offsetLeft,n=e.pageY-L.offsetTop;g.classList.remove("error"),g.textContent="z = ";var r=document.createElement("code");r.append(""+K(t,n)),g.append(r)}function Q(){return Z.apply(this,arguments)}function Z(){return(Z=c(t(f).mark((function e(){return t(f).wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.abrupt("return",new Promise((function(e){requestAnimationFrame((function(){requestAnimationFrame((function(){return e()}))}))})));case 1:case"end":return e.stop()}}),e)})))).apply(this,arguments)}function K(e,t){var n=[(L.width-1)/2,(L.height-1)/2],r=n[0],o=n[1],i=(e-r)/(r/2)/U,a=-(t-o)/(o/2)/U;return d.complex(i,a)}function V(e){return ee.apply(this,arguments)}function ee(){return(ee=c(t(f).mark((function e(n){var r;return t(f).wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return r={action:"init"},n.postMessage(r),e.abrupt("return",new Promise((function(e){n.onmessage=function(t){e()}})));case 3:case"end":return e.stop()}}),e)})))).apply(this,arguments)}function te(e,t){z||(C=performance.now());var n={action:"mainRequest",pev:ne(t),cd:{width:L.width,height:L.height,zoom:U}};e.postMessage(n)}function ne(e){var t=d.simplify(e),n=d.parse("f(z) = 0"),r=!1;return"OperatorNode"!=t.type||"divide"!=t.fn||isNaN(+t.args[0])||(t.args.reverse(),t=d.simplify(t),r=!0),n.expr=t,{fstr:n.toString(),inverse:r}}function re(e){g.textContent="Done in ".concat(e,"ms."),ie()}function oe(e){var t=e instanceof ErrorEvent?e.message:e;L.removeEventListener("mousemove",G),g.classList.add("error"),g.textContent=String(t),ie()}function ie(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:500;setTimeout((function(){L.addEventListener("mousemove",G),z||(h.disabled=!1)}),e)}function ae(e){var t=e.chunk,n=e.buf,r=new ImageData(new Uint8ClampedArray(n),t.width,t.height);q.putImageData(r,t.offx,t.offy)}X=A($,O($),!1),P.onmessage=(B=c(t(f).mark((function e(n){return t(f).wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return g.textContent="Initializing workers...",e.next=3,Q();case 3:return z=n.data,_=z?new Worker(I):new Worker(X),e.next=7,V(_);case 7:_.onmessage=z?function(e){var t=e.data;"chunkDone"===t.action?ae(t):"done"===t.action&&re(t.time)}:function(e){ae(e.data),re(Math.trunc(performance.now()-C))},_.onerror=oe,h.disabled=!1,h.click(),P.terminate();case 12:case"end":return e.stop()}}),e)}))),function(e){return B.apply(this,arguments)}),L.addEventListener("mousemove",G),L.addEventListener("click",(function(e){var t=K(e.pageX-L.offsetLeft,e.pageY-L.offsetTop);console.log("z = ".concat(t,",\nf(z) = ").concat(D(t)))})),m.addEventListener("input",(function(){m.value=m.value.replace(/[^a-zA-Z0-9+\-*/^., ()]/g,"")})),v.addEventListener("submit",(function(e){e.preventDefault(),h.click()})),w[0].addEventListener("click",(function(){U*=2,h.click()})),w[1].addEventListener("click",(function(){1!==U&&(U=1,h.click())})),w[2].addEventListener("click",(function(){U/=2,h.click()})),x.addEventListener("input",(function(){if(x.value=x.value.replace(/[^0-9.]/g,""),isNaN(+b.value)&&(x.value="1"),(0,s.default)(x.value).filter((function(e){return"."===e})).length>1){var e=x.value.split(".");x.value=e[0]+"."+e.slice(1).join("")}})),y.addEventListener("submit",(function(e){e.preventDefault(),U!==+x.value&&(U=+x.value||0,h.click())})),b.addEventListener("input",(function(){isNaN(+b.value)&&(b.value=""+H),k.style.display=+b.value>250?"inline":"none"})),E.addEventListener("submit",(function(e){e.preventDefault();var t=2*+b.value+1;L.width!==t&&(L.width=L.height=t,h.click())})),window.addEventListener("resize",(function(e){void 0!==Y&&clearTimeout(Y),H=R(),b.value=""+H,k.style.display=+b.value>250?"inline":"none",Y=setTimeout((function(){return h.click()}),50)})),h.addEventListener("click",c(t(f).mark((function e(){var n,r,o;return t(f).wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return z||(h.disabled=!0),g.classList.remove("error"),x.value=U.toString(),n=2*+b.value+1,L.width!==n&&(L.width=L.height=n),r=(0,u.default)(j.map((function(e){return e.div(U).toString()})),2),S[0].textContent=r[0],S[1].textContent=r[1],g.textContent="Graphing...",e.next=10,Q();case 10:L.removeEventListener("mousemove",G),o=m.value,e.prev=12,D=d.evaluate("f(z) = ".concat(o)),te(_,o),e.next=21;break;case 17:throw e.prev=17,e.t0=e.catch(12),oe(e.t0),e.t0;case 21:case"end":return e.stop()}}),e,null,[[12,17]])}))))}();
//# sourceMappingURL=complexgrapher.2426ca9a.js.map