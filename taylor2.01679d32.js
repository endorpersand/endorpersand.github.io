var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},t={},r={},n=e.parcelRequire94c2;null==n&&((n=function(e){if(e in t)return t[e].exports;if(e in r){var n=r[e];delete r[e];var i={id:e,exports:{}};return t[e]=i,n.call(i.exports,i,i.exports),i.exports}var l=new Error("Cannot find module '"+e+"'");throw l.code="MODULE_NOT_FOUND",l}).register=function(e,t){r[e]=t},e.parcelRequire94c2=n);var i=n("ghe96");const l=(i=n("ghe96")).create(i.all);let o=l.parse("x"),u=l.parse("y");function a(e){return Array.from({length:e+1},((t,r)=>l.combinations(e,r)))}function c(e){return l.isInteger(e)&&(e=l.number(e)),l.format(e)}var d=function(e,t=2,r=0,n=0){return function(e){let[t,r,n]=e,i=n.map((([e,n,i])=>{let o={};if(0==e)return"0";o.h=l.parse(`(x - ${t}) ^ ${n}`),o.k=l.parse(`(y - ${r}) ^ ${i}`);let u=l.simplify("h * k",o).toString();if("1"===u)return c(e);{let t;return t=1==e?"":-1==e?"-":c(e)+" * ",t+u}})).filter((e=>"0"!=e));return 0==i.length?"0":i.reduce(((e,t)=>t.startsWith("-")?`${e} - ${t.slice(1)}`:`${e} + ${t}`))}(function(e,t=2,r=0,n=0){let i=l.parse(e),c=[],d=[];for(let e=0;e<=t;e++){if(0==d.length)d.push(i);else{let e=d[0],t=[l.derivative(e,o)];for(let e of d)t.push(l.derivative(e,u));d=t}let t=a(e);for(var s=0;s<=e;s++){let i=t[s],o=d[s].evaluate({x:r,y:n}),u=l.factorial(e),a=l.fraction(o),p=l.multiply(l.fraction(i,u),a);c.push([p,e-s,s])}}return[r,n,c]}(e,t,r,n))};const s=i.create(i.all);let p=document.querySelector("#centerDiv"),[f,v]=p.querySelectorAll("input"),y=document.querySelector("#func input"),$=document.querySelector("#funcTex"),x=document.querySelector("#resultTex"),h=document.querySelector("#appn"),m=document.querySelector("#appninput"),g=document.querySelector("#compute"),L={valid:!1,expr:""};function T(e,t){if("OperatorNode"===e.type&&"*"===e.op){let[r,n]=e.args;return`${r.toTex(t)}${n.toTex(t)}`}}function q(e,t="=",r=!0){let n,i="f(x, y) = "+e,l=r?{}:{handler:T};try{n=s.parse(i).toTex(l).replace(":=",t)}catch{return{valid:!1,expr:e}}return{valid:!0,expr:e,tex:n}}function S(){x.classList.add("notCurrentFunc")}function E(){"typeset"in MathJax&&MathJax.typeset()}function M(){L=q(y.value),L.valid?$.innerHTML=`$$${L.tex}$$`:$.innerHTML="$$\\color{red}{?}$$",S(),E()}function b(){let e=!1;if(L.valid){let t="";x.classList.remove("err"),x.classList.remove("notCurrentFunc");try{t=d(L.expr,function(){let e=[...document.querySelectorAll("input[name=approx]")].filter((e=>e.checked)).map((e=>e.value))[0];return 0!=+e?+e:+m.value}(),+f.value,+v.value)}catch(e){if(console.log(e),e instanceof Error&&e.message.startsWith("Undefined ")){let t=e.message,r=t.slice(17);return(r.includes("x")||r.includes("y"))&&(t+=" (try adding * here?)"),x.innerHTML=t,void x.classList.add("err")}}let r=q(t,"\\approx",!1);r.valid&&(x.innerHTML=`$$${r.tex}$$`,e=!0)}e||(x.innerHTML="$$\\color{red}{?}$$"),E()}function w(){m.disabled=!h.checked,S()}f.addEventListener("input",S),v.addEventListener("input",S),y.addEventListener("input",M),document.querySelectorAll("input[name=approx]").forEach((e=>e.addEventListener("change",w))),g.addEventListener("click",b),M(),b();
//# sourceMappingURL=taylor2.01679d32.js.map
