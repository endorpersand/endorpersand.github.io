!function(){function e(e){if(Array.isArray(e))return e}function t(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}function r(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function n(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function o(e,t){if(e){if("string"==typeof e)return n(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(r):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?n(e,t):void 0}}function a(n,a){return e(n)||t(n)||o(n,a)||r()}function l(e){if(Array.isArray(e))return n(e)}function i(){throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function u(e){return l(e)||t(e)||o(e)||i()}var c=document.querySelector("#lin-result canvas").getContext("2d",{alpha:!1}),d=document.querySelector("#rms-result canvas").getContext("2d",{alpha:!1}),f=document.querySelector("#css-result div#css-gradient"),v=document.querySelector("button#coloradd"),y=document.querySelector("div#colors"),s=document.querySelector("input#gamma-input");function h(){var e=!(arguments.length>0&&void 0!==arguments[0])||arguments[0],t=g();y.insertBefore(t,v);var r=p(),n=!0,o=!1,a=void 0;if(r.length>2)try{for(var l,i=r[Symbol.iterator]();!(n=(l=i.next()).done);n=!0){var u=l.value;u.disabled=!1}}catch(e){o=!0,a=e}finally{try{n||null==i.return||i.return()}finally{if(o)throw a}}return e&&w(),t}function m(){return y.querySelectorAll("div")}function p(){return document.querySelectorAll("button.colorrm")}function g(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"#000000",t=document.createElement("div"),r=document.createElement("input");r.type="color",r.value=e,r.addEventListener("change",w);var n=document.createElement("button");return n.classList.add("colorrm"),n.textContent="x",n.addEventListener("click",(function(){y.removeChild(t);var e=p(),r=!0,n=!1,o=void 0;if(e.length<3)try{for(var a,l=e[Symbol.iterator]();!(r=(a=l.next()).done);r=!0){a.value.disabled=!0}}catch(e){n=!0,o=e}finally{try{r||null==l.return||l.return()}finally{if(n)throw o}}w()})),t.append(r,n),t}function w(){var e,t=(e=document.querySelectorAll("input[type=color]"),Array.from(e,(function(e){return e.value})));f.style.background="linear-gradient(0.25turn, ".concat(t.join(", "),")"),b(c,"lin",t),b(d,"rms",t)}function b(e,t,r){var n=r.length-1,o=e.canvas;if("lin"===t){var l=e.createLinearGradient(0,0,o.width,0),i=!0,u=!1,c=void 0;try{for(var d,f=r.entries()[Symbol.iterator]();!(i=(d=f.next()).done);i=!0){var v=a(d.value,2),y=v[0],h=v[1];l.addColorStop(y/n,h)}}catch(e){u=!0,c=e}finally{try{i||null==f.return||f.return()}finally{if(u)throw c}}e.fillStyle=l}else if("rms"===t){var m,p,g=function(e){var t,o=e/F*n,l=[Math.floor(o),o%1],i=l[0],u=l[1],c=a([r[i],null!==(t=r[i+1])&&void 0!==t?t:"#000000"].map((function(e){return[(t=e).slice(1,3),t.slice(3,5),t.slice(5,7)].map((function(e){return parseInt(e,16)}));var t})),2),d=c[0],f=c[1],v=Array.from({length:3},(function(e,t){return function(e,t,r,n){return Math.pow((1-n)*Math.pow(e,r)+n*Math.pow(t,r),1/r)}(d[t],f[t],(s.checkValidity()&&""!==s.value||(s.value="2.2"),+s.value),u)}));S[e]=-16777216|v[2]<<16|v[1]<<8|v[0]<<0};if("OffscreenCanvas"in globalThis)m=new OffscreenCanvas(o.width,1);else m=document.createElement("canvas"),p=[o.width,1],m.width=p[0],m.height=p[1];var w=m.getContext("2d"),b=w.createImageData(m.width,1),S=new Uint32Array(b.data.buffer),F=S.length-1;for(y=0;y<S.length;y++)g(y);w.putImageData(b,0,0);var A=e.createPattern(m,"repeat-y");e.fillStyle=A}else;e.fillRect(0,0,o.width,o.height)}function S(){for(var e=arguments.length,t=new Array(e),r=0;r<e;r++)t[r]=arguments[r];var n,o=u(m());if(t.length<2)throw new Error("Two colors are required for a gradient");for(;t.length<o.length;)null===(n=o.pop())||void 0===n||n.remove();for(;o.length<t.length;)o.push(h(!1));o.forEach((function(e,r){var n=e.querySelector("input[type=color]"),o=t[r];n.value=o})),w()}w(),document.querySelectorAll("input[type=color]").forEach((function(e){return e.addEventListener("change",w)})),s.addEventListener("input",w),v.addEventListener("click",(function(){h(!0)})),document.querySelectorAll(".colorrm").forEach((function(e){return e.addEventListener("click",(function(){y.removeChild(e.parentElement);var t=p(),r=!0,n=!1,o=void 0;if(t.length<3)try{for(var a,l=t[Symbol.iterator]();!(r=(a=l.next()).done);r=!0){a.value.disabled=!0}}catch(e){n=!0,o=e}finally{try{r||null==l.return||l.return()}finally{if(n)throw o}}w()}))})),window.setColors=S,window.gay=function(){S("#FF0000","#FFFF00","#00FF00","#00FFFF","#0000FF","#FF00FF","#FF0000")}}();
//# sourceMappingURL=gradient.cf327ab6.js.map