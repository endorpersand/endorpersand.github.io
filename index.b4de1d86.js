!function(){function r(r){if(Symbol.iterator in Object(r)||"[object Arguments]"===Object.prototype.toString.call(r))return Array.from(r)}function t(t,n){return function(r){if(Array.isArray(r))return r}(t)||r(t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance")}()}var n,e=document.querySelector(".wrapper"),o=function(r){if(Array.isArray(r)){for(var t=0,n=new Array(r.length);t<r.length;t++)n[t]=r[t];return n}}(n=document.querySelectorAll(".wrapper a"))||r(n)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance")}(),a=+getComputedStyle(e).getPropertyValue("--cols"),u=3;o.length>a*u&&(u=Math.ceil(o.length/a));for(var c=o.length;c<a*u;c++)y();var i=!0,l=!1,f=void 0;try{for(var d,h=o[Symbol.iterator]();!(i=(d=h.next()).done);i=!0){var p=d.value,m=document.createElement("span");m.classList.add("colhex"),p.appendChild(m)}}catch(r){l=!0,f=r}finally{try{i||null==h.return||h.return()}finally{if(l)throw f}}function y(){var r=document.createElement("a"),t=document.createElement("div"),n=document.createElement("div");t.classList.add("title"),n.classList.add("desc"),r.appendChild(t),r.appendChild(n),r.onclick=v,e.appendChild(r),o.push(r)}function v(){var r=Array.from({length:4},(function(){return function(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:256;return Array.from({length:3},(function(){return s(r,t)}))}(80)}));!function(r){o.forEach((function(n,e){var o,c,i,l=t((o=e,[Math.floor(o/a),o%a])),f=l[0],d=l[1],h=(c=r,i=function(r){return function(r,n){var e=t(n),o=e[0],a=e[1],u=[r.slice(0,2),r.slice(2,4)],c=u[0];return A([A(u[1],o),A(c,o)],a)}([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],r)}([f/(u-1),d/(a-1)]),Array.from({length:3},(function(r,n){var e=c.map((function(r){return r[n]})),o=function(){for(var r=arguments.length,t=new Array(r),n=0;n<r;n++)t[n]=arguments[n];var e=t[0].length;return Array.from({length:e},(function(r,n){return t.map((function(r){return r[n]}))}))}(e,i).map((function(r){var n=t(r),e=n[0];return n[1]*e*e})).reduce((function(r,t){return r+t}));return Math.round(Math.sqrt(o))})));n.style.backgroundColor=g(h),n.querySelector(".colhex").textContent=g(h)}))}(r)}function s(r,t){return Math.floor(Math.random()*(t-r))+r}function g(r){return"#".concat(r.map((function(r){return Math.round(r).toString(16).padStart(2,"0")})).join(""))}function A(r,n){var e=t(r),o=e[0],a=e[1],u=o.length;return Array.from({length:u},(function(r,t){var e=o[t],u=a[t];return e+n*(u-e)}))}v()}();
//# sourceMappingURL=index.b4de1d86.js.map
