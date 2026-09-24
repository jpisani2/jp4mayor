/* 48240 Happy Hour Map — app logic (map, filters, list) */
(function(){
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TYPES={bar:"Bars & pubs",rest:"Restaurants",chain:"Chains",brew:"Breweries & wine",lounge:"Lounges"};
const TYPE1={bar:"Bar / pub",rest:"Restaurant",chain:"Chain",brew:"Brewery / wine bar",lounge:"Lounge"};
const CF={1:"Confirmed",2:"Likely",3:"Unverified"};
const CENTER=[42.4255,-83.3000];
const toMin=s=>{const [h,m]=s.split(":").map(Number);return h*60+m};
VENUES.forEach(v=>{v.win=v.hh.map(w=>({days:w[0].split("").map(Number),s:toMin(w[1]),e:toMin(w[2]),label:w[3]||""}));v.dist=miles(v.ll,CENTER);});
function miles(a,b){const R=3958.8,r=Math.PI/180;const dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(x));}

const state={day:0,t:0,types:new Set(Object.keys(TYPES)),unv:false,sort:"ending",sel:null};
try{const s=JSON.parse(localStorage.getItem("hh48240")||"{}");if(s.types)state.types=new Set(s.types);if(typeof s.unv==="boolean")state.unv=s.unv;if(s.sort)state.sort=s.sort;}catch(e){}
function save(){try{localStorage.setItem("hh48240",JSON.stringify({types:[...state.types],unv:state.unv,sort:state.sort}))}catch(e){}}

function fmtT(m){m=((m%1440)+1440)%1440;if(m===0)return"midnight";if(m===720)return"noon";let h=Math.floor(m/60),mm=m%60,ap=h>=12?"pm":"am";h=h%12||12;return h+(mm?":"+String(mm).padStart(2,"0"):"")+" "+ap;}
function fmtRange(s,e){const a=fmtT(s),b=fmtT(e);const sa=a.slice(-2),sb=b.slice(-2);if(sa===sb&&!/noon|midnight/.test(a+b))return a.slice(0,-3)+"–"+b;return a+"–"+b;}
function fmtDur(m){if(m<60)return m+"m";const h=Math.floor(m/60),r=m%60;return h+"h"+(r?" "+r+"m":"");}
function daysLabel(days){const order=[1,2,3,4,5,6,0];const set=new Set(days);if(set.size===7)return"Daily";const idx=order.filter(d=>set.has(d)).map(d=>order.indexOf(d));const parts=[];let i=0;while(i<idx.length){let j=i;while(j+1<idx.length&&idx[j+1]===idx[j]+1)j++;const a=DS[order[idx[i]]],b=DS[order[idx[j]]];parts.push(j-i>=2?a+"–"+b:(j>i?a+", "+b:a));i=j+1;}return parts.join(", ");}
function schedule(v){return v.win.map(w=>`<b>${daysLabel(w.days)}</b> ${w.e-w.s>=600&&w.label.startsWith("All day")?"all day":fmtRange(w.s,w.e)}${w.label&&!w.label.startsWith("All day")?" ("+w.label.toLowerCase()+")":""}`).join(" · ");}

function activeNow(v,d,t){let best=null;const prev=(d+6)%7;for(const w of v.win){if(w.days.includes(d)&&w.s<=t&&t<w.e){const left=w.e-t;if(!best||left>best.left)best={w,left,end:w.e};}if(w.days.includes(prev)&&w.e>1440&&t+1440>=w.s&&t+1440<w.e){const left=w.e-(t+1440);if(!best||left>best.left)best={w,left,end:w.e};}}return best;}
function laterToday(v,d,t){let best=null;for(const w of v.win){if(w.days.includes(d)&&w.s>t&&w.s<1440){if(!best||w.s<best.s)best={w,s:w.s};}}return best;}
function visible(v){return state.types.has(v.t)&&(state.unv||v.cf<3);}

function mapsLink(v){return"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(v.n+" "+v.a+" "+(/Detroit/.test(v.c)?"Detroit":v.c)+" MI");}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function card(v,kind,info){const rate=v.r?`<span class="rate">★ <b>${v.r.toFixed(1)}</b> (${v.rc.toLocaleString()})</span>`:"";
  let pill="";if(kind==="now")pill=`<span class="pill now">Until ${fmtT(info.end)} · ${fmtDur(info.left)} left</span>`;else if(kind==="later")pill=`<span class="pill soon">Starts ${fmtT(info.s)}</span>`;
  const conf=`<span class="conf c${v.cf}">${CF[v.cf]}</span>`;const ap=v.ap?`<span class="approx">times approximate</span>`:"";
  const links=[`<a href="${mapsLink(v)}" target="_blank" rel="noopener">Directions</a>`];if(v.w)links.push(`<a href="${esc(v.w)}" target="_blank" rel="noopener">Website</a>`);if(v.ph)links.push(`<span class="phone">${esc(v.ph)}</span>`);
  return `<article class="card ${kind==="now"?"active":kind==="later"?"later":""}" id="c-${v.id}" tabindex="0" data-id="${v.id}">
  <div class="row1"><div><h3>${esc(v.n)}</h3><div class="where">${esc(v.c)} · ${esc(v.a)} · ${TYPE1[v.t]} · ${v.dist.toFixed(1)} mi from 48240</div></div>${rate}</div>
  <div class="state">${pill}${conf}${ap}</div>
  ${v.win.length?`<div class="sched">${schedule(v)}</div>`:""}
  <div class="deals">${esc(v.d)}</div>
  <details><summary>Why I think so${v.dt?" · latest evidence "+esc(v.dt):""}</summary><p style="margin:6px 0 0">${esc(v.ev)}</p></details>
  <div class="links">${links.join("")}</div></article>`;}

/* ---------- map ---------- */
const W=1000,H=1226,LNG0=-83.452,LNG1=-83.122,LAT1=42.492,LAT0=42.190;
const X=g=>(g-LNG0)/(LNG1-LNG0)*W, Y=a=>(LAT1-a)/(LAT1-LAT0)*H;
const svg=document.getElementById("map");const NS="http://www.w3.org/2000/svg";
function el(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e;}
const EW=[["10 Mile",42.4695],["9 Mile",42.4550],["8 Mile",42.4425],["7 Mile",42.4275],["6 Mile",42.4135],["5 Mile",42.3995],["Schoolcraft · I-96",42.3845],["Plymouth",42.3685],["Joy",42.3570],["Warren",42.3410],["Ford",42.3265],["Cherry Hill",42.3105],["Van Born",42.2697],["Ecorse",42.2565],["Goddard",42.2270],["Northline",42.2115],["Eureka",42.1975]];
const NSr=[["Haggerty",-83.4335],["Newburgh",-83.4125],["Farmington",-83.3735],["Merriman",-83.3545],["Middlebelt",-83.3335],["Inkster",-83.3130],["Beech Daly",-83.2960],["Telegraph",-83.2745],["Southfield",-83.2190],["Greenfield",-83.1965],["Schaefer",-83.1800]];
const DIAG=[["Grand River",[[42.492,-83.452],[42.4700,-83.3970],[42.4650,-83.3760],[42.4338,-83.3016],[42.4254,-83.2787],[42.4077,-83.2349],[42.3950,-83.2035],[42.3870,-83.1851],[42.372,-83.150],[42.366,-83.122]]],["Michigan Ave",[[42.2765,-83.452],[42.2823,-83.3816],[42.2881,-83.3363],[42.2967,-83.2900],[42.3012,-83.2673],[42.3055,-83.2485],[42.3072,-83.2377],[42.3203,-83.1818],[42.328,-83.150],[42.333,-83.122]]]];
const CITIES=[["FARMINGTON HILLS",42.486,-83.372],["FARMINGTON",42.452,-83.398],["LIVONIA",42.392,-83.392],["REDFORD",42.414,-83.300],["WEST DETROIT",42.398,-83.205],["GARDEN CITY",42.334,-83.352],["WESTLAND",42.298,-83.405],["DEARBORN HTS",42.352,-83.262],["DEARBORN",42.296,-83.212],["INKSTER",42.284,-83.318],["WAYNE",42.266,-83.398],["ALLEN PARK",42.262,-83.172],["TAYLOR",42.240,-83.300]];
const gBase=el("g",{});const gRoads=el("g",{},gBase);const gLbl=el("g",{},gBase);const gMark=el("g",{});
el("rect",{x:-2000,y:-2000,width:5000,height:5000,fill:"var(--mapbg)"},gRoads);
CITIES.forEach(c=>{const t=el("text",{x:X(c[2]),y:Y(c[1]),"text-anchor":"middle",fill:"var(--road-major)","font-family":"Barlow Condensed, Arial Narrow, sans-serif","font-weight":"700","font-size":"24","letter-spacing":"3"},gRoads);t.textContent=c[0];});
EW.forEach(r=>{const mile=/Mile/.test(r[0]);el("line",{x1:-2000,x2:3000,y1:Y(r[1]),y2:Y(r[1]),stroke:mile?"var(--road-major)":"var(--road)","stroke-width":mile?4:3},gRoads);});
NSr.forEach(r=>el("line",{y1:-2000,y2:3000,x1:X(r[1]),x2:X(r[1]),stroke:"var(--road)","stroke-width":3},gRoads));
DIAG.forEach(r=>el("polyline",{points:r[1].map(p=>X(p[1])+","+Y(p[0])).join(" "),fill:"none",stroke:"var(--road-major)","stroke-width":5,"stroke-linejoin":"round"},gRoads));
const labels=[];
EW.forEach(r=>{const t=el("text",{x:8,y:Y(r[1])-6,fill:"var(--roadlabel)","font-family":"Barlow Condensed, Arial Narrow, sans-serif","font-weight":"600","font-size":"17","letter-spacing":"1"},gLbl);t.textContent=r[0].toUpperCase();labels.push({t,kind:"ew",v:r[1]});});
NSr.forEach(r=>{const t=el("text",{x:X(r[1])+5,y:H-10,fill:"var(--roadlabel)","font-family":"Barlow Condensed, Arial Narrow, sans-serif","font-weight":"600","font-size":"17","letter-spacing":"1",transform:`rotate(-90 ${X(r[1])+5} ${H-10})`},gLbl);t.textContent=r[0].toUpperCase();labels.push({t,kind:"ns",v:r[1]});});
svg.appendChild(gMark);
const home=el("g",{},gMark);el("circle",{cx:X(CENTER[1]),cy:Y(CENTER[0]),r:6,fill:"var(--ink)"},home);const homeT=el("text",{x:X(CENTER[1])+10,y:Y(CENTER[0])+5,fill:"var(--ink)","font-family":"Barlow Condensed, Arial Narrow, sans-serif","font-weight":"700","font-size":"18"},home);homeT.textContent="48240";
const markers={};
VENUES.forEach(v=>{const g=el("g",{"data-id":v.id,style:"cursor:pointer"},gMark);const halo=el("circle",{cx:X(v.ll[1]),cy:Y(v.ll[0]),r:0,fill:"var(--glow)",class:"pulse"},g);const c=el("circle",{cx:X(v.ll[1]),cy:Y(v.ll[0]),r:6},g);const title=el("title",{},g);title.textContent=v.n;markers[v.id]={g,c,halo};g.addEventListener("click",e=>{e.stopPropagation();select(v.id,true);});});

let vb={x:0,y:0,w:W,h:H};
function applyVB(){svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);const k=vb.w/W;
  labels.forEach(l=>{if(l.kind==="ew"){const low=Y(l.v)>vb.y+vb.h-105*k;l.t.setAttribute("x",vb.x+(low?150:8)*k);l.t.setAttribute("font-size",17*k);l.t.setAttribute("y",Y(l.v)-6*k);}else{const x=X(l.v)+5*k,y=vb.y+vb.h-10*k;l.t.setAttribute("x",x);l.t.setAttribute("y",y);l.t.setAttribute("font-size",17*k);l.t.setAttribute("transform",`rotate(-90 ${x} ${y})`);}});
  homeT.setAttribute("font-size",18*k);homeT.setAttribute("x",X(CENTER[1])+10*k);homeT.setAttribute("y",Y(CENTER[0])+5*k);home.firstChild.setAttribute("r",6*k);paintMarkers();}
function zoom(f,cx,cy){const nw=Math.min(W*1.1,Math.max(W/6,vb.w*f));const nh=nw*H/W;if(cx==null){cx=vb.x+vb.w/2;cy=vb.y+vb.h/2;}vb.x=cx-(cx-vb.x)*nw/vb.w;vb.y=cy-(cy-vb.y)*nh/vb.h;vb.w=nw;vb.h=nh;applyVB();}
document.getElementById("zin").onclick=()=>zoom(0.7);document.getElementById("zout").onclick=()=>zoom(1/0.7);document.getElementById("zreset").onclick=()=>{vb={x:0,y:0,w:W,h:H};applyVB();};
function fit(){const r=svg.getBoundingClientRect();const s=Math.min(r.width/vb.w,r.height/vb.h)||1;return{r,s,ox:(r.width-vb.w*s)/2,oy:(r.height-vb.h*s)/2};}
function toUser(cx,cy){const f=fit();return{x:vb.x+(cx-f.r.left-f.ox)/f.s,y:vb.y+(cy-f.r.top-f.oy)/f.s};}
function pt(e){return toUser(e.clientX,e.clientY);}
svg.addEventListener("wheel",e=>{e.preventDefault();const p=pt(e);zoom(e.deltaY>0?1.15:1/1.15,p.x,p.y);},{passive:false});
let drag=null;const ptrs=new Map();
svg.addEventListener("pointerdown",e=>{ptrs.set(e.pointerId,e);if(ptrs.size===1){drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y,moved:false};}else drag=null;});
svg.addEventListener("pointermove",e=>{if(ptrs.has(e.pointerId)){const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,e);
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];const o=[...ptrs.entries()].find(([k])=>k!==e.pointerId)[1];const d1=Math.hypot(prev.clientX-o.clientX,prev.clientY-o.clientY),d2=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(d1>0&&d2>0){const q=toUser((a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);zoom(d1/d2,q.x,q.y);}return;}}
  if(!drag)return;const f=fit();const dx=(e.clientX-drag.x)/f.s,dy=(e.clientY-drag.y)/f.s;if(!drag.moved&&Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>4){drag.moved=true;svg.classList.add("drag");try{svg.setPointerCapture(e.pointerId)}catch(_){}}if(!drag.moved)return;vb.x=drag.vx-dx;vb.y=drag.vy-dy;svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);});
function endPtr(e){ptrs.delete(e.pointerId);if(drag&&drag.moved){applyVB();}svg.classList.remove("drag");if(ptrs.size===0)setTimeout(()=>drag=null,0);}
svg.addEventListener("pointerup",endPtr);svg.addEventListener("pointercancel",endPtr);
svg.addEventListener("click",e=>{if(drag&&drag.moved)return;select(null);});

let statusMap={};
function paintMarkers(){const k=vb.w/W;VENUES.forEach(v=>{const m=markers[v.id];const st=statusMap[v.id];const show=visible(v);m.g.style.display=show?"":"none";if(!show)return;
  let r=5.5,fill="var(--idle)",stroke="var(--mapbg)",sw=1.5;if(st==="now"){r=9;fill="var(--glow)";stroke="var(--glow-ink)";sw=1.5;}else if(st==="later"){r=7;fill="var(--mapbg)";stroke="var(--later)";sw=3;}else if(st==="unknown"){r=5;fill="var(--mapbg)";stroke="var(--idle)";sw=2;}
  if(state.sel===v.id){r+=4;sw+=1.5;stroke="var(--ink)";}
  m.c.setAttribute("r",r*k);m.c.setAttribute("fill",fill);m.c.setAttribute("stroke",stroke);m.c.setAttribute("stroke-width",sw*k);m.halo.setAttribute("r",st==="now"?18*k:0);
  if(st==="now")gMark.appendChild(m.g);});gMark.appendChild(home);if(state.sel&&markers[state.sel])gMark.appendChild(markers[state.sel].g);}

function select(id,fromMap){state.sel=id;document.querySelectorAll(".card.sel").forEach(c=>c.classList.remove("sel"));const tip=document.getElementById("tip");
  if(!id){tip.hidden=true;paintMarkers();return;}const v=VENUES.find(x=>x.id===id);const c=document.getElementById("c-"+id);if(c){c.classList.add("sel");if(fromMap){if(c.closest("details"))c.closest("details").open=true;c.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});}}
  const st=statusMap[id];const a=activeNow(v,state.day,state.t),l=laterToday(v,state.day,state.t);
  tip.innerHTML=`<b>${esc(v.n)}</b> · ${esc(v.c)}<br>${st==="now"?"Happy hour until "+fmtT(a.end):st==="later"?"Starts "+fmtT(l.s):v.win.length?schedule(v):"Times unknown"} · <span class="conf c${v.cf}" style="font-size:10px">${CF[v.cf]}</span><br><a href="${mapsLink(v)}" target="_blank" rel="noopener">Directions</a>`;tip.hidden=false;paintMarkers();}

/* ---------- controls ---------- */
const daySel=document.getElementById("day"),timeIn=document.getElementById("time"),sortSel=document.getElementById("sort"),unvChip=document.getElementById("unvChip");
DAYS.forEach((d,i)=>{const o=document.createElement("option");o.value=i;o.textContent=d;daySel.appendChild(o);});
const tc=document.getElementById("typeChips");Object.entries(TYPES).forEach(([k,lab])=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent=lab;b.dataset.t=k;b.setAttribute("aria-pressed",state.types.has(k));b.onclick=()=>{if(state.types.has(k))state.types.delete(k);else state.types.add(k);b.setAttribute("aria-pressed",state.types.has(k));save();render();};tc.appendChild(b);});
function setNow(){const n=new Date();state.day=n.getDay();state.t=n.getHours()*60+n.getMinutes();daySel.value=state.day;timeIn.value=String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");render();}
daySel.onchange=()=>{state.day=+daySel.value;render();};
timeIn.onchange=()=>{if(timeIn.value){state.t=toMin(timeIn.value);render();}};
document.getElementById("nowBtn").onclick=setNow;
sortSel.value=state.sort;sortSel.onchange=()=>{state.sort=sortSel.value;save();render();};
unvChip.setAttribute("aria-pressed",state.unv);unvChip.onclick=()=>{state.unv=!state.unv;unvChip.setAttribute("aria-pressed",state.unv);save();render();};
document.getElementById("lists").addEventListener("click",e=>{if(e.target.closest("a,summary,details p"))return;const c=e.target.closest(".card");if(c)select(c.dataset.id,false);});
document.getElementById("lists").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.classList.contains("card"))select(e.target.dataset.id,false);});

function sorter(kind){return(a,b)=>{if(state.sort==="near")return a.v.dist-b.v.dist;if(state.sort==="rating")return(b.v.r||0)-(a.v.r||0);if(kind==="now")return a.i.left-b.i.left||a.v.cf-b.v.cf;if(kind==="later")return a.i.s-b.i.s||a.v.dist-b.v.dist;return a.v.dist-b.v.dist;};}
function render(){const d=state.day,t=state.t;statusMap={};const now=[],later=[],unknown=[];let otherDays=0;
  VENUES.forEach(v=>{if(!v.win.length){statusMap[v.id]="unknown";if(state.types.has(v.t))unknown.push({v});return;}const a=activeNow(v,d,t);if(a){statusMap[v.id]="now";if(visible(v))now.push({v,i:a});return;}const l=laterToday(v,d,t);if(l){statusMap[v.id]="later";if(visible(v))later.push({v,i:l});return;}statusMap[v.id]="idle";if(visible(v))otherDays++;});
  now.sort(sorter("now"));later.sort(sorter("later"));unknown.sort((a,b)=>a.v.dist-b.v.dist);
  document.getElementById("listNow").innerHTML=now.length?now.map(x=>card(x.v,"now",x.i)).join(""):`<div class="empty">Nothing running at ${fmtT(t)} on ${DAYS[d]}${later.length?". The next one starts at "+fmtT(later[0].i.s)+".":". Try an afternoon between 3 and 6."}</div>`;
  document.getElementById("listLater").innerHTML=later.length?later.map(x=>card(x.v,"later",x.i)).join(""):`<div class="empty">No more happy hours start later on ${DAYS[d]}.</div>`;
  document.getElementById("listUnknown").innerHTML=unknown.map(x=>card(x.v,"unknown")).join("");
  document.getElementById("nNow").textContent=now.length;document.getElementById("nLater").textContent=later.length;document.getElementById("nUnknown").textContent=unknown.length;document.getElementById("laterDay").textContent=DAYS[d];
  document.getElementById("bigStatus").innerHTML=`<b>${now.length}</b> happy hour${now.length===1?"":"s"} running`;
  document.getElementById("metaStatus").textContent=`${DAYS[d]} at ${fmtT(t)} · ${later.length} more start later · ${otherDays} run at other times${state.unv?"":" · unverified hidden"}`;
  if(state.sel&&!VENUES.find(v=>v.id===state.sel&&visible(v)))state.sel=null;paintMarkers();if(state.sel)select(state.sel,false);else document.getElementById("tip").hidden=true;}
applyVB();setNow();
setInterval(()=>{const n=new Date();const tm=n.getHours()*60+n.getMinutes();if(+daySel.value===n.getDay()&&Math.abs(state.t-tm)<=2&&tm!==state.t){state.t=tm;timeIn.value=String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");render();}},60000);

/* back-to-map button */
(function(){const b=document.getElementById("toTop");if(!b)return;
  const narrow=()=>window.matchMedia("(max-width:900px)").matches;
  const target=()=>narrow()?document.querySelector(".status"):null;
  function upd(){const t=target();const lim=t?t.getBoundingClientRect().top+window.scrollY+120:350;const on=window.scrollY>lim;b.classList.toggle("show",on);b.tabIndex=on?0:-1;}
  window.addEventListener("scroll",upd,{passive:true});window.addEventListener("resize",upd);upd();
  b.addEventListener("click",()=>{const smooth=!window.matchMedia("(prefers-reduced-motion:reduce)").matches;const t=target();const y=t?Math.max(0,t.getBoundingClientRect().top+window.scrollY-8):0;window.scrollTo({top:y,behavior:smooth?"smooth":"auto"});});
})();
})();
