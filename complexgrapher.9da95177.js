!function(){function t(t,e,n,r){Object.defineProperty(t,e,{get:n,set:r,enumerable:!0,configurable:!0})}function e(t){return t&&t.__esModule?t.default:t}var n="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},r={},o={},i=n.parcelRequire94c2;function a(t,e,n,r,o,i,a){try{var u=t[i](a),c=u.value}catch(t){return void n(t)}u.done?e(c):Promise.resolve(c).then(r,o)}function u(t){return function(){var e=this,n=arguments;return new Promise((function(r,o){var i=t.apply(e,n);function u(t){a(i,r,o,u,c,"next",t)}function c(t){a(i,r,o,u,c,"throw",t)}u(void 0)}))}}null==i&&((i=function(t){if(t in r)return r[t].exports;if(t in o){var e=o[t];delete o[t];var n={id:t,exports:{}};return r[t]=n,e.call(n.exports,n,n.exports),n.exports}var i=new Error("Cannot find module '"+t+"'");throw i.code="MODULE_NOT_FOUND",i}).register=function(t,e){o[t]=e},n.parcelRequire94c2=i),i.register("91UpR",(function(e,n){var r,o;t(e.exports,"register",(function(){return r}),(function(t){return r=t})),t(e.exports,"resolve",(function(){return o}),(function(t){return o=t}));var i={};r=function(t){for(var e=Object.keys(t),n=0;n<e.length;n++)i[e[n]]=t[e[n]]},o=function(t){var e=i[t];if(null==e)throw new Error("Could not resolve bundle with id "+t);return e}})),i.register("fQyQn",(function(e,n){var r,o;t(e.exports,"getBundleURL",(function(){return r}),(function(t){return r=t})),t(e.exports,"getOrigin",(function(){return o}),(function(t){return o=t}));var i={};function a(t){return(""+t).replace(/^((?:https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/.+)\/[^/]+$/,"$1")+"/"}r=function(t){var e=i[t];return e||(e=function(){try{throw new Error}catch(e){var t=(""+e.stack).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^)\n]+/g);if(t)return a(t[2])}return"/"}(),i[t]=e),e},o=function(t){var e=(""+t).match(/(https?|file|ftp|(chrome|moz|safari-web)-extension):\/\/[^/]+/);if(!e)throw new Error("Origin not found");return e[0]}})),i("91UpR").register(JSON.parse('{"5Hjnn":"complexgrapher.9da95177.js","dq1cl":"webkitTest.5c78f70c.js","egthy":"main.3287f773.js","1GZwD":"main.66bf90c5.js","ainsM":"chunkloader.97209084.js","bumwR":"chunkloader.82f01b80.js","aUCA8":"complexgrapher.201d7235.js","33yRb":"complexgrapher.2d04f01c.js"}'));var c,s,l=i("i4pIp"),f=i("e9mLB"),p=i("isjeC"),d=i("b3Rbn"),m=i("fADtK"),v=(i("fADtK"),i("4enuq")),h=(d=i("b3Rbn"),m=i("fADtK"),(0,d.create)(d.all)),g={pi:m.Complex.PI,e:m.Complex.E,i:m.Complex.I,inf:m.Complex.INFINITY,infinity:m.Complex.INFINITY,epsilon:m.Complex.EPSILON,nan:m.Complex.NAN},y={gamma:function(){return h.gamma(this)},ln:m.Complex.prototype.log},w={add:m.Complex.prototype.add,unaryPlus:function(){return this},subtract:m.Complex.prototype.sub,unaryMinus:m.Complex.prototype.neg,multiply:m.Complex.prototype.mul,divide:m.Complex.prototype.div,pow:m.Complex.prototype.pow,factorial:function(){return h.gamma(this.add(1))}};function x(t){var e=t.name;if("z"===(e=e.toLowerCase()))return{type:"z"};if(c.isMethod(e))return{type:"method",f:c.get(e)};if(e in g)return{type:"constant",value:g[e]};if(e in y)return{type:"method",f:y[e]};throw new Error("Unrecognized symbol [".concat(e,"]"))}function b(t,e){if("constant"===t.type)return t.value;if("function"===t.type)return t.f(e);if("z"===t.type)return e;throw new Error("Unrecognized fold result ".concat(t.type))}function E(t,e){var n=e.map((function(t){return C(t)}));if(n.every((function(t){return"constant"===t.type}))){var r=(0,v.default)(n.map((function(t){return t.value}))),o=r[0],i=r.slice(1),a=(0,m.Complex)(o);return{type:"constant",value:t.apply(a,i)}}var u=(0,v.default)(n),c=u[0],s=u.slice(1);return{type:"function",f:function(e){var n=(0,m.Complex)(b(c,e)),r=s.map((function(t){return b(t,e)}));return t.apply(n,r)}}}function C(t){switch(t.type){case"ConstantNode":return{type:"constant",value:t.value};case"FunctionNode":var e=x(t.fn);if("method"===e.type)return E(e.f,t.args);if("constant"===e.type)throw new Error("Expected function, got constant [".concat(t.fn.name," = ").concat(e.value,"]"));if("z"===e.type)throw new Error("Expected function, got [z]");throw new Error("Expected function, got [".concat(e.type,"]"));case"OperatorNode":var n=function(t,e){if(e in t)return t[e]}(w,t.fn),r=n?E(n,t.args):void 0;if(void 0===r)throw new Error("Unexpected operator [".concat(t.op,"]"));return r;case"ParenthesisNode":return C(t.content);case"SymbolNode":var o=x(t);if("method"===o.type)throw new Error("Unexpected function [".concat(t.name,"]"));return o;default:throw new Error("Cannot parse [".concat(t.type,"] into complex function"))}}function L(t){var e=C(h.parse(t));switch(e.type){case"constant":return{type:"constant",f:e.value};case"function":return e;case"z":return{type:"function",f:function(t){return t}};default:throw new Error("Invalid fold result type ".concat(e.type))}}(s=c||(c={})).isMethod=function(t){return t in m.Complex.prototype},s.get=function(t){var e=m.Complex.prototype[t];return e instanceof Function?e:function(){return this[t]}},s.wrap=function(t){return function(){return t(this)}};var S=(0,d.create)(d.all),R=document.querySelector("div#wrapper"),k=document.querySelector("div#controls"),A=document.querySelector("input#func-input"),q=document.querySelector("#graph-button"),I=document.querySelector("div#graph-status"),O=document.querySelectorAll("div#z-wrapper code"),M=document.querySelectorAll("button.zoom"),N=document.querySelector("input#zoom-input"),z=document.querySelectorAll("input.center-input"),H=document.querySelector("button#recenter-button"),_=document.querySelector("button#home-button"),D=document.querySelectorAll(".domain"),U=document.createElement("canvas"),Y=U.getContext("2d",{alpha:!1});function j(){return X.apply(this,arguments)}function X(){return(X=u(e(p).mark((function t(){var n,r,o;return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,Dt();case 2:n=U.getBoundingClientRect(),r=n.width,o=n.height,Kt(U,"width",Math.trunc(r)),Kt(U,"height",Math.trunc(o)),Y.globalCompositeOperation="copy",ut();case 7:case"end":return t.stop()}}),t)})))).apply(this,arguments)}R.appendChild(U),j();var F,T,P,B,Q,K,Z=document.createElement("canvas"),J=Z.getContext("2d",{alpha:!1});T=F||(F={}),P=function(){K.refs||(Z.width=U.width,Z.height=U.height,J.globalCompositeOperation="copy",J.imageSmoothingEnabled=!1,J.drawImage(U,0,0),K.mat=S.identity(3)),K.refs++},B=function(){K.refs=Math.max(K.refs-1,0)},Q=function(){if(K.refs){var t=K.mat;V++,V|=0,Y.setTransform(t.get([0,0]),t.get([1,0]),t.get([0,1]),t.get([1,1]),t.get([0,2]),t.get([1,2])),Y.drawImage(Z,0,0),Y.resetTransform()}},K={refs:0,mat:S.identity(3)},T.prepare=P,T.release=B,T.borrow=function(t){var e=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],n=0===K.refs;P(),t(n),e&&n&&Q(),B()},T.draw=Q,T.translate=function(t,e){K.mat=S.multiply(S.matrix([[1,0,t],[0,1,e],[0,0,1]]),K.mat)},T.scaleAround=function(t,e){var n=(0,l.default)(null!=e?e:[(U.width-1)/2,(U.height-1)/2],2),r=n[0],o=n[1];K.mat=S.chain(S.matrix([[1,0,r],[0,1,o],[0,0,1]])).multiply(S.matrix([[1/t,0,0],[0,1/t,0],[0,0,1]])).multiply(S.matrix([[1,0,-r],[0,1,-o],[0,0,1]])).multiply(K.mat).done()};var W=m.Complex.ZERO;function G(t,e){var n;(null===(n=null==e?void 0:e.updateBuffer)||void 0===n||n)&&F.borrow((function(){var e,n=W.sub(t),r=At.toCanvasDisplace(n);(e=F).translate.apply(e,(0,f.default)(r))})),W=t,z[0].value="".concat(t.re),z[1].value="".concat(t.im),Zt(H,t.equals(0,0)),Zt(_,t.equals(0,0)&&2===$),ut()}document.querySelectorAll("#center-controls form").forEach((function(t){t.addEventListener("submit",(function(t){var e=+z[0].value,n=+z[1].value;G((0,m.Complex)(e,n))}))})),H.addEventListener("click",(function(t){G(m.Complex.ZERO)}));var V=0,$=2;function tt(t,e){var n;t=Math.max(t,Number.EPSILON),(null===(n=null==e?void 0:e.updateBuffer)||void 0===n||n)&&F.borrow((function(){var e=t/$;F.scaleAround(e)})),$=t,N.value="".concat(2/$),N.style.width="".concat(N.value.length,"ch"),M[1].disabled=2===$,Zt(_,W.equals(0,0)&&2===$),ut()}function et(t,e,n){var r=Math.pow(2,.005*n),o=At.toComplex(t,e),i=o.sub(W);F.borrow((function(){G(o.sub(i.mul(r))),tt($*r)}))}var nt=(0,l.default)(M,3),rt=nt[0],ot=nt[1],it=nt[2];function at(){return[$*U.width/U.height,$]}function ut(){var t=!!+getComputedStyle(document.documentElement).getPropertyValue("--limit-domain"),e=(0,l.default)(at(),2),n=e[0],r=e[1],o=(0,m.Complex)(n,r),i=W.sub(o),a=W.add(o);if(t){var u=i.re,c=i.im,s=a.re,f=a.im,p=-1===Math.sign(c)?"-":"+",d=-1===Math.sign(c)?"-":"+",v=ct(u),h=ct(s),g=ct(Math.abs(c)),y=ct(Math.abs(f));D[0].textContent="".concat(v," ").concat(p," ").concat(g,"i"),D[1].textContent="".concat(h," ").concat(d," ").concat(y,"i")}else D[0].textContent="".concat(i),D[1].textContent="".concat(a)}function ct(t){var e=t.toPrecision(),n=t.toPrecision(5);return e.length<=n.length?e:n}rt.addEventListener("click",(function(){return tt($/2)})),ot.addEventListener("click",(function(){return tt(2)})),it.addEventListener("click",(function(){return tt(2*$)})),_.addEventListener("click",(function(){F.borrow((function(){G(m.Complex.ZERO),tt(2)}))}));var st,lt,ft,pt,dt=function(t){return t};pt=function(t,e,n){if(e===self.location.origin)return t;var r=n?"import "+JSON.stringify(t)+";":"importScripts("+JSON.stringify(t)+");";return URL.createObjectURL(new Blob([r],{type:"application/javascript"}))};var mt=(wt=i("fQyQn")).getBundleURL("5Hjnn")+i("91UpR").resolve("dq1cl");ft=pt(mt,wt.getOrigin(mt),!1);var vt=new Worker(ft);vt.postMessage(void 0);var ht,gt=(wt=i("fQyQn")).getBundleURL("5Hjnn")+i("91UpR").resolve("egthy");ht=pt(gt,wt.getOrigin(gt),!1);var yt,wt,xt,bt=(wt=i("fQyQn")).getBundleURL("5Hjnn")+i("91UpR").resolve("ainsM");function Et(t){var e=t.pageX,n=t.pageY,r=e-U.offsetLeft,o=n-U.offsetTop,i=U.getBoundingClientRect(),a=i.width,u=i.height;if(!(r<0||r>=a||o<0||o>=u))return At.toComplex(r,o)}yt=pt(bt,wt.getOrigin(bt),!1),vt.onmessage=(xt=u(e(p).mark((function t(n){return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return I.textContent="Initializing workers...",t.next=3,Dt();case 3:return lt=n.data,st=lt?new Worker(ht):new Worker(yt),t.next=7,Yt(st);case 7:st.onmessage=function(t){var e,n,r,o,i=t.data;i.graphID===V&&("chunkDone"===i.action?(n=(e=i).chunk,r=e.buf,o=new ImageData(new Uint8ClampedArray(r),n.width,n.height),Y.putImageData(o,n.offx,n.offy)):"done"===i.action&&Tt(i.time))},st.onerror=Bt,q.disabled=!1,vt.terminate(),document.querySelectorAll(".initializing").forEach((function(t){return t.classList.remove("initializing")})),Ht();case 13:case"end":return t.stop()}}),t)}))),function(t){return xt.apply(this,arguments)});var Ct=function(t){var e=St.get(t.pointerId);if(St.delete(t.pointerId)&&F.release(),0===St.size&&e){var n=[t.clientX-e.initX,t.clientY-e.initY];0===n[0]&&0===n[1]||Ht()}},Lt=function(t){var e=t.length,n=(0,l.default)(t.reduce((function(t,e){var n=(0,l.default)(t,2),r=n[0],o=n[1],i=(0,l.default)(e,2);return[r+i[0],o+i[1]]})),2),r=[n[0]/e,n[1]/e],o=(0,l.default)(r,2),i=o[0],a=o[1];return[r,t.map((function(t){var e=(0,l.default)(t,2),n=e[0],r=e[1];return Math.hypot(n-i,r-a)})).reduce((function(t,e){return t+e}))]},St=new Map;U.addEventListener("pointerdown",(function(t){var e,n,r,o;r=e=t.clientX,o=n=t.clientY,St.set(t.pointerId,{initX:e,initY:n,lastX:r,lastY:o}),F.prepare()})),document.addEventListener("pointerup",Ct),document.addEventListener("pointercancel",Ct),document.addEventListener("pointermove",(function(t){var e=St.get(t.pointerId);if(e)if(1===St.size){var n=[t.clientX-e.lastX,t.clientY-e.lastY],r=n[0],o=n[1],i=At.toComplexDisplace(r,o);G(W.sub(i)),F.draw(),e.lastX=t.clientX,e.lastY=t.clientY}else{var a=Array.from(St.values(),(function(t){return[t.lastX,t.lastY]})),u=(0,l.default)(Lt(a),2),c=(u[0],u[1]);e.lastX=t.clientX,e.lastY=t.clientY,a=Array.from(St.values(),(function(t){return[t.lastX,t.lastY]}));var s=(0,l.default)(Lt(a),2),p=s[0],d=s[1];et.apply(void 0,(0,f.default)(p).concat([c-d])),F.draw()}}));var Rt,kt,At,qt,It,Ot,Mt=!1;function Nt(){return zt.apply(this,arguments)}function zt(){return zt=u(e(p).mark((function t(){var n,r,o,i,a,u,c,s,d=arguments;return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:for(n=d.length,r=new Array(n),o=0;o<n;o++)r[o]=d[o];void 0!==(i=Et.apply(void 0,(0,f.default)(r)))&&(a=(0,l.default)(O,2),u=a[0],c=a[1],u.textContent="".concat(i),c.textContent="".concat(null!==(s=null==dt?void 0:dt(i))&&void 0!==s?s:"?"));case 3:case"end":return t.stop()}}),t)}))),zt.apply(this,arguments)}function Ht(){return _t.apply(this,arguments)}function _t(){return(_t=u(e(p).mark((function t(){var n,r;return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(!q.disabled){t.next=2;break}return t.abrupt("return");case 2:return I.classList.remove("hidden","error","done"),I.textContent="Graphing...",t.next=6,j();case 6:return t.next=8,Dt();case 8:n=A.value,t.prev=9,r=L(n),dt="function"===r.type?r.f:function(){return r.f},Xt(st,n),t.next=19;break;case 15:throw t.prev=15,t.t0=t.catch(9),Bt(t.t0),t.t0;case 19:case"end":return t.stop()}}),t,null,[[9,15]])})))).apply(this,arguments)}function Dt(){return Ut.apply(this,arguments)}function Ut(){return(Ut=u(e(p).mark((function t(){return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.abrupt("return",new Promise((function(t){requestAnimationFrame((function(){requestAnimationFrame((function(){return t()}))}))})));case 1:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function Yt(t){return jt.apply(this,arguments)}function jt(){return(jt=u(e(p).mark((function t(n){var r;return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return r={action:"init"},n.postMessage(r),t.abrupt("return",new Promise((function(t){n.onmessage=function(e){t()}})));case 3:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function Xt(t,e){V++,V|=0;var n={action:"mainRequest",pev:Ft(e),cd:{width:U.width,height:U.height,center:[W.re,W.im],scale:$},graphID:V};t.postMessage(n)}function Ft(t){var e=S.simplify(t),n=!1;return"OperatorNode"!=e.type||"divide"!=e.fn||isNaN(+e.args[0])||(e.args.reverse(),e=S.simplify(e),n=!0),{fstr:e.toString(),inverse:n}}function Tt(t){return Pt.apply(this,arguments)}function Pt(){return(Pt=u(e(p).mark((function t(n){return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return I.textContent="Done in ".concat(n,"ms."),I.classList.add("done"),t.next=4,Dt();case 4:Qt();case 5:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function Bt(t){var e=t instanceof ErrorEvent?t.message:t;I.classList.add("error"),I.textContent=String(e)}function Qt(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:1e3;setTimeout((function(){I.classList.contains("done")&&(I.classList.remove("done"),I.classList.add("hidden"))}),t)}function Kt(t,e,n){t[e]!==n&&(t[e]=n)}function Zt(t,e){t.classList.toggle("hidden",e),t instanceof HTMLButtonElement&&(t.disabled=e)}U.addEventListener("wheel",(function(t){if(t.preventDefault(),clearTimeout(Rt),Mt||(Mt=!0,F.prepare()),t.ctrlKey)et(t.clientX,t.clientY,t.deltaY),F.draw();else{var e=.5*t.deltaX,n=.5*t.deltaY,r=At.toComplexDisplace(e,n);G(W.sub(r)),F.draw()}Nt(t),Rt=setTimeout((function(){Ht(),F.release(),Mt=!1}),500)}),!1),U.addEventListener("mousemove",Nt),k.addEventListener("mousemove",Nt),document.addEventListener("click",Nt),window.addEventListener("resize",(function(t){void 0!==kt&&clearTimeout(kt),kt=setTimeout(u(e(p).mark((function t(){return e(p).wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,Ht();case 2:return t.abrupt("return",t.sent);case 3:case"end":return t.stop()}}),t)}))),200)})),document.querySelector("form#zoom-form").addEventListener("submit",(function(){N.checkValidity()&&tt(2/+N.value)})),document.querySelectorAll("form.graph-submit").forEach((function(t){t.addEventListener("submit",(function(t){t.preventDefault(),Ht()}))})),document.querySelectorAll("button.graph-submit").forEach((function(t){t.addEventListener("click",(function(){Ht()}))})),qt=At||(At={}),It=function(t,e){var n=U.width,r=U.height,o=(0,l.default)(at(),2),i=o[0],a=o[1],u=[(n-1)/2,-(r-1)/2],c=u[0],s=u[1];return(0,m.Complex)(t*i/c,e*a/s)},Ot=function(t){var e=U.width,n=U.height,r=(0,l.default)(at(),2),o=r[0],i=r[1],a=[(e-1)/2,-(n-1)/2],u=a[0],c=a[1];return[t.re*u/o,t.im*c/i]},qt.toComplex=function(t,e){var n=[(U.width-1)/2,(U.height-1)/2],r=It(t-n[0],e-n[1]);return W.add(r)},qt.toComplexDisplace=It,qt.toCanvas=function(t){var e=[(U.width-1)/2,(U.height-1)/2],n=e[0],r=e[1],o=t.sub(W),i=(0,l.default)(Ot(o),2);return[n+i[0],r+i[1]]},qt.toCanvasDisplace=Ot}();
//# sourceMappingURL=complexgrapher.9da95177.js.map
