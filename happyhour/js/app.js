/* Clock Out — app logic: map, filters, lists, timeline, planner, themes. */
(function(){
"use strict";
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const TYPES={bar:"Bars & pubs",rest:"Restaurants",chain:"Chains",brew:"Breweries & wine",lounge:"Lounges"};
const TYPE1={bar:"Bar / pub",rest:"Restaurant",chain:"Chain",brew:"Brewery / wine bar",lounge:"Lounge"};
const CF={1:"Confirmed",2:"Likely",3:"Unverified"};
const REPORT_TO="bar@jp4mayor.com";
const DOWNRIVER=new Set(["Taylor","Allen Park","Melvindale"]);
const NEARBY=new Set(["Wayne","Northville","Plymouth"]);
const AREAS={all:{name:"All areas",box:[42.19,42.492,-83.452,-83.122]},west:{name:"West Side",box:[42.255,42.492,-83.452,-83.122]},downriver:{name:"Downriver",box:[42.19,42.292,-83.33,-83.15]}};
const DEALS=[
  {k:"marg",lab:"Margaritas",re:/margarit|\brita\b|ritas\b/i},
  {k:"wings",lab:"Wings",re:/\bwings?\b/i},
  {k:"half",lab:"Half-off",re:/half|½|50%/i},
  {k:"tacos",lab:"Tacos",re:/\btacos?\b/i},
  {k:"music",lab:"Music & karaoke",re:/live music|karaoke|\bdj\b|live shows|bingo|trivia|old-school/i},
  {k:"pool",lab:"Pool",re:/\bpool\b/i}];
const PALS=[
  {id:"classic",name:"Classic",dark:false,sw:["#EEF2EF","#1D6A4D","#DD9210"],tc:"#1D6A4D"},
  {id:"afterhours",name:"After Hours",dark:true,sw:["#0E1719","#56B88C","#F2B23A"],tc:"#0E1719"},
  {id:"coney",name:"Coney",dark:false,sw:["#FBF4E4","#B3261E","#E3A500"],tc:"#B3261E"},
  {id:"lastcall",name:"Last Call",dark:true,sw:["#1A0D12","#E8C07D","#FF5CAD"],tc:"#1A0D12"},
  {id:"belleisle",name:"Belle Isle",dark:false,sw:["#EEF4F8","#2C6E49","#F26B3A"],tc:"#2C6E49"},
  {id:"neondive",name:"Neon Dive",dark:true,sw:["#07080C","#8C9BFF","#00E0FF"],tc:"#07080C"},
  {id:"market",name:"Eastern Market",dark:false,sw:["#F6EFE9","#9E3B2C","#F0A202"],tc:"#9E3B2C"},
  {id:"chrome",name:"Chrome",dark:true,sw:["#16181B","#C9D1D9","#FFB000"],tc:"#16181B"},
  {id:"riverwalk",name:"Riverwalk",dark:false,sw:["#F5F1E8","#0F6E6E","#E4572E"],tc:"#0F6E6E"},
  {id:"lakeeffect",name:"Lake Effect",dark:true,sw:["#0B1626","#7FDBFF","#FFD166"],tc:"#0B1626"}];

const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const toMin=s=>{const [h,m]=s.split(":").map(Number);return h*60+m;};
function miles(a,b){const R=3958.8,r=Math.PI/180;const dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmtT(m){m=((Math.round(m)%1440)+1440)%1440;if(m===0)return"midnight";if(m===720)return"noon";let h=Math.floor(m/60),mm=m%60,ap=h>=12?"pm":"am";h=h%12||12;return h+(mm?":"+String(mm).padStart(2,"0"):"")+" "+ap;}
function fmtRange(s,e){const a=fmtT(s),b=fmtT(e);const sa=a.slice(-2),sb=b.slice(-2);if(sa===sb&&!/noon|midnight/.test(a+b))return a.slice(0,-3)+"–"+b;return a+"–"+b;}
function fmtDur(m){m=Math.round(m);if(m<60)return m+"m";const h=Math.floor(m/60),r=m%60;return h+"h"+(r?" "+r+"m":"");}
function daysLabel(days){const order=[1,2,3,4,5,6,0];const set=new Set(days);if(set.size===7)return"Daily";const idx=order.filter(d=>set.has(d)).map(d=>order.indexOf(d));const parts=[];let i=0;while(i<idx.length){let j=i;while(j+1<idx.length&&idx[j+1]===idx[j]+1)j++;const a=DS[order[idx[i]]],b=DS[order[idx[j]]];parts.push(j-i>=2?a+"–"+b:(j>i?a+", "+b:a));i=j+1;}return parts.join(", ");}
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");

/* ---------- prepare data ---------- */
const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function parseHours(s){if(!s)return null;const parts=s.split(",");const toks=parts.length===1?Array(7).fill(parts[0]):parts;
  return toks.map(t=>{if(t==="x")return[];if(t==="?"||!t)return null;return t.split("+").map(r=>{const [a,b]=r.split("-").map(Number);return[Math.round(a*60),Math.round(b*60)];});});}
const chainCount={};VENUES.forEach(v=>{if(v.t==="chain")chainCount[v.n]=(chainCount[v.n]||0)+1;});
VENUES.forEach(v=>{
  v.win=v.hh.map(w=>({days:w[0].split("").map(Number),s:toMin(w[1]),e:toMin(w[2]),label:w[3]||""}));
  v.sp=(v.sp||[]).map(s=>({days:s[0].split("").map(Number),txt:s[1]}));
  v.hoD=parseHours(v.ho);
  v.area=DOWNRIVER.has(v.c)?"downriver":"west";
  v.near=NEARBY.has(v.c);
  const txt=(v.d||"")+" "+v.sp.map(s=>s.txt).join(" ");
  v.deals=new Set(DEALS.filter(d=>d.re.test(txt)).map(d=>d.k));
  v.hay=(v.n+" "+v.c+" "+v.a+" "+txt+" "+TYPE1[v.t]).toLowerCase();
  const m=String(v.dt||"").match(/(?:([A-Za-z]{3})[a-z]*\s+)?(20\d\d)/);
  v.evd=m?{y:+m[2],mo:m[1]&&MONTHS[m[1].toLowerCase()]!=null?MONTHS[m[1].toLowerCase()]:null}:null;
});
function evInfo(v){if(!v.evd)return{cls:"stale",label:"Undated"};const n=new Date();const mo=v.evd.mo==null?0:v.evd.mo;const age=(n.getFullYear()-v.evd.y)*12+(n.getMonth()-mo);
  const label=(v.evd.mo!=null?["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][v.evd.mo]+" ":"")+v.evd.y;return{cls:age<=6?"fresh":age<=18?"mid":"stale",label};}

/* happy-hour windows for a day, trimmed to the bar's posted hours */
function effWins(v,d){const out=[];const hrs=v.hoD?v.hoD[d]:null;
  for(const w of v.win){if(!w.days.includes(d))continue;
    if(hrs&&hrs.length===0)continue;
    if(!hrs){out.push({s:w.s,e:w.e,label:w.label,cut:false});continue;}
    for(const r of hrs){const a=Math.max(w.s,r[0]),b=Math.min(w.e,r[1]);if(b-a>=15)out.push({s:a,e:b,label:w.label,cut:b<w.e,lateStart:a>w.s});}}
  return out;}
function activeNow(v,d,t){let best=null;const prev=(d+6)%7;
  for(const w of effWins(v,d)){if(w.s<=t&&t<w.e){const left=w.e-t;if(!best||left>best.left)best={w,left,end:w.e};}}
  for(const w of effWins(v,prev)){if(w.e>1440&&t+1440>=w.s&&t+1440<w.e){const left=w.e-(t+1440);if(!best||left>best.left)best={w,left,end:w.e};}}
  return best;}
function laterToday(v,d,t){let best=null;for(const w of effWins(v,d)){if(w.s>t&&w.s<1440){if(!best||w.s<best.s)best={w,s:w.s};}}return best;}
function openInfo(v,d,t){if(!v.hoD)return null;const today=v.hoD[d],prev=v.hoD[(d+6)%7];
  if(prev)for(const r of prev){if(r[1]>1440&&t+1440<r[1])return{open:true,until:r[1]};}
  if(today===null)return null;if(today.length===0)return{closedDay:true};
  for(const r of today){if(r[0]<=t&&t<r[1])return{open:true,until:r[1]};}
  const next=today.filter(r=>r[0]>t).sort((a,b)=>a[0]-b[0])[0];return next?{open:false,opens:next[0]}:{open:false,done:true};}
function schedule(v){const groups=new Map();
  for(let d=0;d<7;d++)for(const w of effWins(v,d)){const k=w.s+"-"+w.e+"-"+w.label+"-"+(w.cut?1:0);if(!groups.has(k))groups.set(k,{w,days:[]});groups.get(k).days.push(d);}
  if(!groups.size)return v.win.length?"Not during posted business hours":"";
  return[...groups.values()].sort((a,b)=>([1,2,3,4,5,6,0].indexOf(a.days[0])-[1,2,3,4,5,6,0].indexOf(b.days[0]))||a.w.s-b.w.s).map(g=>{const w=g.w;
    const all=w.label.startsWith("All day");return`<b>${daysLabel(g.days)}</b> ${all&&w.e-w.s>=600?"all day":fmtRange(w.s,w.e)}${w.label&&!all?" ("+esc(w.label.toLowerCase())+")":""}${w.cut?" <span class=\"approx\">till close</span>":""}`;}).join(" · ");}
function schedulePlain(v){return schedule(v).replace(/<[^>]+>/g,"")||"times unknown";}
function spFor(v,d){return v.sp.filter(s=>s.days.includes(d));}
function lateOK(v,d){return effWins(v,d).some(w=>w.s>=1200||w.e>=1320)||effWins(v,(d+6)%7).some(w=>w.e>1440);}

/* ---------- state ---------- */
const saved=store.get("clockout.state",{});
const state={day:0,t:0,types:new Set(saved.types||Object.keys(TYPES)),deals:new Set(saved.deals||[]),unv:!!saved.unv,sort:saved.sort||"ending",area:saved.area&&saved.area!=="near"?saved.area:"all",q:"",late:false,fav:false,sel:null,me:null,tab:"list"};
let favs=new Set(store.get("clockout.favs",[]));
function save(){store.set("clockout.state",{types:[...state.types],deals:[...state.deals],unv:state.unv,sort:state.sort,area:state.area});}

function inArea(v){if(state.area==="all"||state.area==="near")return true;return v.area===state.area;}
function baseVisible(v){return state.types.has(v.t)&&(state.unv||v.cf<3)&&inArea(v)&&(!state.q||state.q.split(/\s+/).every(w=>v.hay.includes(w)))&&([...state.deals].every(k=>v.deals.has(k)))&&(!state.fav||favs.has(v.id));}
function visible(v){return baseVisible(v)&&(!state.late||lateOK(v,state.day));}
function dist(v){return state.me?miles(v.ll,state.me):null;}

/* ---------- cards ---------- */
const ICON_STAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 2.9 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
const ICON_PHONE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
function mapsLink(v){return"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(v.n+" "+v.a+" "+(/Detroit/.test(v.c)?"Detroit":v.c)+" MI");}
function reportLink(v){const body=`Bar: ${v.n}\nAddress: ${v.a}, ${v.c}\nCurrently listed: ${schedulePlain(v)}${v.d?" — "+v.d:""}\n\nWhat changed:\n`;return"mailto:"+REPORT_TO+"?subject="+encodeURIComponent("Clock Out: "+v.n)+"&body="+encodeURIComponent(body);}
function hoursLine(v){const o=openInfo(v,state.day,state.t);if(!o)return"";
  if(o.closedDay)return`<div class="hours"><span class="closed">Closed ${DAYS[state.day]}s</span></div>`;
  if(o.open)return`<div class="hours">Open till <b>${fmtT(o.until)}</b></div>`;
  if(o.opens!=null)return`<div class="hours"><span class="closed">Closed at ${fmtT(state.t)}</span> · opens ${fmtT(o.opens)}</div>`;
  return`<div class="hours"><span class="closed">Closed for the night</span></div>`;}
function weekView(v){const order=[1,2,3,4,5,6,0],A=480,Z=1560,span=Z-A;const pc=m=>Math.max(0,Math.min(100,(m-A)/span*100));
  let h='<div class="week" aria-label="Happy hours by day">';
  for(const d of order){const o=v.hoD?v.hoD[d]:null;let tr="";
    if(o)for(const r of o)tr+=`<span class="open" style="left:${pc(r[0])}%;width:${pc(r[1])-pc(r[0])}%"></span>`;
    const ws=effWins(v,d);for(const w of ws)tr+=`<span class="hh${w.cut?" clip":""}" style="left:${pc(w.s)}%;width:${Math.max(1.5,pc(w.e)-pc(w.s))}%" title="${fmtRange(w.s,w.e)}"></span>`;
    const lab=o&&o.length===0?"closed":ws.length?ws.map(w=>fmtRange(w.s,w.e)).join(", "):"no happy hour";
    h+=`<span class="d${d===state.day?" today":""}">${DS[d]}</span><div class="track" role="img" aria-label="${DAYS[d]}: ${lab}">${tr}</div>`;
    for(const s of spFor(v,d))h+=`<span></span><div class="spx">★ ${esc(s.txt)}</div>`;}
  h+='<span></span><div class="axis"><span>8a</span><span>noon</span><span>4p</span><span>8p</span><span>12a</span><span>2a</span></div></div>';
  if(!v.hoD)h+='<p style="margin:6px 0 0">Business hours unknown; bars show happy hour only.</p>';return h;}
function card(v,kind,info){
  const rate=v.r?`<span class="rate">★ <b>${v.r.toFixed(1)}</b> (${v.rc.toLocaleString()})</span>`:"";
  let pill="";if(kind==="now")pill=`<span class="pill now">Until ${fmtT(info.end)} · ${fmtDur(info.left)} left</span>`;
  else if(kind==="later"){const inM=info.s-state.t;pill=`<span class="pill soon${inM<=60?" imminent":""}">Starts ${fmtT(info.s)} · in ${fmtDur(inM)}</span>`;}
  const tags=[`<span class="tag conf c${v.cf}">${CF[v.cf]}</span>`];
  if(v.t==="chain")tags.push(`<span class="tag chain">Chain${chainCount[v.n]>1?" · "+chainCount[v.n]+" on map":""}</span>`);
  if(v.pr)tags.push(`<span class="tag price">$${v.pr[0]%1?v.pr[0].toFixed(2):v.pr[0]} ${esc(v.pr[1])}</span>`);
  if(v.ap)tags.push(`<span class="approx">times approximate</span>`);
  const dd=dist(v);const ev=evInfo(v);
  const sps=spFor(v,state.day).map(s=>`<div class="special"><b>${DS[state.day]}:</b> ${esc(s.txt)}</div>`).join("");
  const links=[];if(v.ph)links.push(`<a class="call" href="tel:${v.ph.replace(/[^\d+]/g,"")}">${ICON_PHONE}Call</a>`);
  links.push(`<a href="${mapsLink(v)}" target="_blank" rel="noopener">Directions</a>`);if(v.w)links.push(`<a href="${esc(v.w)}" target="_blank" rel="noopener">Website</a>`);
  links.push(`<a class="report" href="${reportLink(v)}">Something changed?</a>`);
  const sch=v.win.length?`<div class="sched">${schedule(v)}</div>`:"";
  return`<article class="card ${kind==="now"?"active":kind==="later"?"later":""}" id="c-${kind}-${v.id}" data-id="${v.id}" tabindex="0">
  <div class="row1"><div class="titlebox"><h3>${esc(v.n)}</h3><div class="where">${esc(v.c)}${v.near?' <span class="tag near">nearby</span>':""} · ${esc(v.a)} · ${TYPE1[v.t]}${dd!=null?" · "+dd.toFixed(1)+" mi away":""}</div></div>
  <div class="right"><button class="star" type="button" data-fav="${v.id}" aria-pressed="${favs.has(v.id)}" aria-label="${favs.has(v.id)?"Remove from":"Add to"} favorites">${ICON_STAR}</button>${rate}</div></div>
  <div class="state">${pill}${tags.join("")}</div>
  ${sch}${hoursLine(v)}${sps}${v.d?`<div class="deals">${esc(v.d)}</div>`:""}
  <details><summary>Why I think so <span class="ev ${ev.cls}">${ev.label}</span></summary><p style="margin:6px 0 0">${esc(v.ev)}</p></details>
  <details><summary>Week at a glance</summary>${weekView(v)}</details>
  <div class="links">${links.join("")}</div></article>`;}

/* ---------- map ---------- */
const W=1000,H=1226,LNG0=-83.452,LNG1=-83.122,LAT1=42.492,LAT0=42.190;
const X=g=>(g-LNG0)/(LNG1-LNG0)*W, Y=a=>(LAT1-a)/(LAT1-LAT0)*H;
const svg=$("map");const NS="http://www.w3.org/2000/svg";
function el(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e;}
const EW=[["10 Mile",42.4695],["9 Mile",42.4550],["8 Mile",42.4425],["7 Mile",42.4275],["6 Mile",42.4135],["5 Mile",42.3995],["Schoolcraft · I-96",42.3845],["Plymouth",42.3685],["Joy",42.3570],["Warren",42.3410],["Ford",42.3265],["Cherry Hill",42.3105],["Van Born",42.2697],["Ecorse",42.2565],["Goddard",42.2270],["Northline",42.2115],["Eureka",42.1975]];
const NSr=[["Haggerty",-83.4335],["Newburgh",-83.4125],["Farmington",-83.3735],["Merriman",-83.3545],["Middlebelt",-83.3335],["Inkster",-83.3130],["Beech Daly",-83.2960],["Telegraph",-83.2745],["Southfield",-83.2190],["Greenfield",-83.1965],["Schaefer",-83.1800]];
const DIAG=[["Grand River",[[42.492,-83.452],[42.4700,-83.3970],[42.4650,-83.3760],[42.4338,-83.3016],[42.4254,-83.2787],[42.4077,-83.2349],[42.3950,-83.2035],[42.3870,-83.1851],[42.372,-83.150],[42.366,-83.122]]],["Michigan Ave",[[42.2765,-83.452],[42.2823,-83.3816],[42.2881,-83.3363],[42.2967,-83.2900],[42.3012,-83.2673],[42.3055,-83.2485],[42.3072,-83.2377],[42.3203,-83.1818],[42.328,-83.150],[42.333,-83.122]]]];
const CITIES=[["FARMINGTON HILLS",42.486,-83.372],["FARMINGTON",42.452,-83.398],["LIVONIA",42.392,-83.392],["REDFORD",42.414,-83.300],["WEST DETROIT",42.398,-83.205],["GARDEN CITY",42.334,-83.352],["WESTLAND",42.298,-83.405],["DEARBORN HTS",42.352,-83.262],["DEARBORN",42.296,-83.212],["INKSTER",42.284,-83.318],["WAYNE",42.266,-83.398],["ALLEN PARK",42.262,-83.172],["TAYLOR",42.240,-83.300]];
const FONT="Barlow Condensed, Arial Narrow, sans-serif";
const gBase=el("g",{});const gRoads=el("g",{},gBase);const gLbl=el("g",{},gBase);const gPlan=el("g",{});const gMark=el("g",{});
el("rect",{x:-3000,y:-3000,width:7000,height:7000,fill:"var(--mapbg)"},gRoads);
CITIES.forEach(c=>{const t=el("text",{x:X(c[2]),y:Y(c[1]),"text-anchor":"middle",fill:"var(--road-major)","font-family":FONT,"font-weight":"700","font-size":"24","letter-spacing":"3"},gRoads);t.textContent=c[0];});
EW.forEach(r=>{const mile=/Mile/.test(r[0]);el("line",{x1:-3000,x2:4000,y1:Y(r[1]),y2:Y(r[1]),stroke:mile?"var(--road-major)":"var(--road)","stroke-width":mile?4:3},gRoads);});
NSr.forEach(r=>el("line",{y1:-3000,y2:4000,x1:X(r[1]),x2:X(r[1]),stroke:"var(--road)","stroke-width":3},gRoads));
DIAG.forEach(r=>el("polyline",{points:r[1].map(p=>X(p[1])+","+Y(p[0])).join(" "),fill:"none",stroke:"var(--road-major)","stroke-width":5,"stroke-linejoin":"round"},gRoads));
const labels=[];
EW.forEach(r=>{const t=el("text",{x:8,y:Y(r[1])-6,fill:"var(--roadlabel)","font-family":FONT,"font-weight":"600","font-size":"17","letter-spacing":"1"},gLbl);t.textContent=r[0].toUpperCase();labels.push({t,kind:"ew",v:r[1]});});
NSr.forEach(r=>{const t=el("text",{x:X(r[1])+5,y:H-10,fill:"var(--roadlabel)","font-family":FONT,"font-weight":"600","font-size":"17","letter-spacing":"1"},gLbl);t.textContent=r[0].toUpperCase();labels.push({t,kind:"ns",v:r[1]});});
svg.appendChild(gPlan);svg.appendChild(gMark);
const you=el("g",{style:"display:none"},gMark);const youC=el("circle",{r:7,fill:"var(--sign)",stroke:"var(--surface)","stroke-width":3},you);const youR=el("circle",{r:16,fill:"none",stroke:"var(--sign)","stroke-width":2,opacity:.5},you);
const markers={};
VENUES.forEach(v=>{const g=el("g",{"data-id":v.id,style:"cursor:pointer"},gMark);const halo=el("circle",{cx:X(v.ll[1]),cy:Y(v.ll[0]),r:0,fill:"var(--glow)",class:"pulse"},g);const c=el("circle",{cx:X(v.ll[1]),cy:Y(v.ll[0]),r:6},g);const title=el("title",{},g);title.textContent=v.n;markers[v.id]={g,c,halo};g.addEventListener("click",e=>{e.stopPropagation();select(v.id,true);});});

let vb={x:0,y:0,w:W,h:H};
function boxVB(lat0,lat1,lng0,lng1,pad){pad=pad||0.06;let x0=X(lng0),x1=X(lng1),y0=Y(lat1),y1=Y(lat0);let w=x1-x0,h=y1-y0;w*=1+pad*2;h*=1+pad*2;const cx=(x0+x1)/2,cy=(y0+y1)/2;if(w/h<W/H)w=h*W/H;else h=w*H/W;return{x:cx-w/2,y:cy-h/2,w,h};}
function areaVB(){if(state.area==="near"&&state.me){const d=0.06;return boxVB(state.me[0]-d,state.me[0]+d,state.me[1]-d*1.35,state.me[1]+d*1.35,0);}const b=AREAS[state.area]||AREAS.all;return state.area==="all"?{x:0,y:0,w:W,h:H}:boxVB(b.box[0],b.box[1],b.box[2],b.box[3]);}
function applyVB(){svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);const k=vb.w/W;
  labels.forEach(l=>{if(l.kind==="ew"){const low=Y(l.v)>vb.y+vb.h-105*k;l.t.setAttribute("x",vb.x+(low?150:8)*k);l.t.setAttribute("font-size",17*k);l.t.setAttribute("y",Y(l.v)-6*k);}else{const x=X(l.v)+5*k,y=vb.y+vb.h-10*k;l.t.setAttribute("x",x);l.t.setAttribute("y",y);l.t.setAttribute("font-size",17*k);l.t.setAttribute("transform",`rotate(-90 ${x} ${y})`);}});
  youC.setAttribute("r",7*k);youC.setAttribute("stroke-width",3*k);youR.setAttribute("r",16*k);youR.setAttribute("stroke-width",2*k);
  gPlan.querySelectorAll("[data-k]").forEach(n=>{const t=n.dataset.k;if(t==="line")n.setAttribute("stroke-width",4*k),n.setAttribute("stroke-dasharray",`${10*k} ${7*k}`);if(t==="c")n.setAttribute("r",13*k);if(t==="t"){n.setAttribute("font-size",17*k);n.setAttribute("y",+n.dataset.cy+6*k);}});
  paintMarkers();}
function zoom(f,cx,cy){const nw=Math.min(W*1.2,Math.max(W/8,vb.w*f));const nh=nw*H/W;if(cx==null){cx=vb.x+vb.w/2;cy=vb.y+vb.h/2;}vb.x=cx-(cx-vb.x)*nw/vb.w;vb.y=cy-(cy-vb.y)*nh/vb.h;vb.w=nw;vb.h=nh;applyVB();}
function centerOn(ll,w){w=w||W/3.2;const h=w*H/W;vb={x:X(ll[1])-w/2,y:Y(ll[0])-h/2,w,h};applyVB();}
$("zin").onclick=()=>zoom(0.7);$("zout").onclick=()=>zoom(1/0.7);$("zreset").onclick=()=>{vb=areaVB();applyVB();};
function fit(){const r=svg.getBoundingClientRect();const s=Math.min(r.width/vb.w,r.height/vb.h)||1;return{r,s,ox:(r.width-vb.w*s)/2,oy:(r.height-vb.h*s)/2};}
function toUser(cx,cy){const f=fit();return{x:vb.x+(cx-f.r.left-f.ox)/f.s,y:vb.y+(cy-f.r.top-f.oy)/f.s};}
svg.addEventListener("wheel",e=>{e.preventDefault();const p=toUser(e.clientX,e.clientY);zoom(e.deltaY>0?1.15:1/1.15,p.x,p.y);},{passive:false});
let drag=null;const ptrs=new Map();
svg.addEventListener("pointerdown",e=>{ptrs.set(e.pointerId,e);if(ptrs.size===1){drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y,moved:false};}else drag=null;});
svg.addEventListener("pointermove",e=>{if(ptrs.has(e.pointerId)){const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,e);
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];const o=[...ptrs.entries()].find(([k])=>k!==e.pointerId)[1];const d1=Math.hypot(prev.clientX-o.clientX,prev.clientY-o.clientY),d2=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(d1>0&&d2>0){const q=toUser((a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);zoom(d1/d2,q.x,q.y);}return;}}
  if(!drag)return;const f=fit();const dx=(e.clientX-drag.x)/f.s,dy=(e.clientY-drag.y)/f.s;if(!drag.moved&&Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>4){drag.moved=true;svg.classList.add("drag");try{svg.setPointerCapture(e.pointerId)}catch(_){}}if(!drag.moved)return;vb.x=drag.vx-dx;vb.y=drag.vy-dy;svg.setAttribute("viewBox",`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);});
function endPtr(e){ptrs.delete(e.pointerId);if(drag&&drag.moved){applyVB();}svg.classList.remove("drag");if(ptrs.size===0)setTimeout(()=>drag=null,0);}
svg.addEventListener("pointerup",endPtr);svg.addEventListener("pointercancel",endPtr);
svg.addEventListener("click",()=>{if(drag&&drag.moved)return;select(null);});

let statusMap={};
function paintMarkers(){const k=vb.w/W;VENUES.forEach(v=>{const m=markers[v.id];const st=statusMap[v.id];const show=visible(v);m.g.style.display=show?"":"none";if(!show)return;
  let r=5.5,fill="var(--idle)",stroke="var(--mapbg)",sw=1.5;if(st==="now"){r=9;fill="var(--glow)";stroke="var(--glow-ink)";}else if(st==="later"){r=7;fill="var(--mapbg)";stroke="var(--later)";sw=3;}else if(st==="unknown"){r=5;fill="var(--mapbg)";stroke="var(--idle)";sw=2;}
  if(favs.has(v.id)&&st!=="now"){stroke="var(--glow)";sw=Math.max(sw,2.5);}
  if(state.sel===v.id){r+=4;sw+=1.5;stroke="var(--ink)";}
  m.c.setAttribute("r",r*k);m.c.setAttribute("fill",fill);m.c.setAttribute("stroke",stroke);m.c.setAttribute("stroke-width",sw*k);m.halo.setAttribute("r",st==="now"?18*k:0);
  if(st==="now")gMark.appendChild(m.g);});
  if(state.me){you.style.display="";you.setAttribute("transform",`translate(${X(state.me[1])} ${Y(state.me[0])})`);gMark.appendChild(you);}
  if(state.sel&&markers[state.sel])gMark.appendChild(markers[state.sel].g);}

function select(id,fromMap){state.sel=id;document.querySelectorAll(".card.sel").forEach(c=>c.classList.remove("sel"));const tip=$("tip");
  if(!id){tip.hidden=true;paintMarkers();return;}const v=VENUES.find(x=>x.id===id);if(!v)return;
  const c=document.querySelector(`.card[data-id="${id}"]`);if(c){c.classList.add("sel");if(fromMap&&state.tab==="list"){const det=c.closest("details");if(det)det.open=true;c.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});}}
  const st=statusMap[id];const a=activeNow(v,state.day,state.t),l=laterToday(v,state.day,state.t);
  tip.innerHTML=`<b>${esc(v.n)}</b> · ${esc(v.c)}<br>${st==="now"&&a?"Happy hour until "+fmtT(a.end):st==="later"&&l?"Starts "+fmtT(l.s):v.win.length?schedule(v):"Times unknown"} · <span class="tag conf c${v.cf}" style="font-size:10px">${CF[v.cf]}</span><br>${v.ph?`<a href="tel:${v.ph.replace(/[^\d+]/g,"")}">Call</a> · `:""}<a href="${mapsLink(v)}" target="_blank" rel="noopener">Directions</a>`;tip.hidden=false;paintMarkers();}

/* ---------- controls ---------- */
const daySel=$("day"),timeIn=$("time"),sortSel=$("sort"),unvChip=$("unvChip"),q=$("q");
DAYS.forEach((d,i)=>{const o=document.createElement("option");o.value=i;o.textContent=d;daySel.appendChild(o);});
Object.entries(TYPES).forEach(([k,lab])=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent=lab;b.setAttribute("aria-pressed",state.types.has(k));b.onclick=()=>{if(state.types.has(k))state.types.delete(k);else state.types.add(k);b.setAttribute("aria-pressed",state.types.has(k));save();render();};$("typeChips").appendChild(b);});
DEALS.forEach(d=>{const b=document.createElement("button");b.type="button";b.className="chip deal";b.textContent=d.lab;b.dataset.k=d.k;b.setAttribute("aria-pressed",state.deals.has(d.k));b.onclick=()=>{if(state.deals.has(d.k))state.deals.delete(d.k);else state.deals.add(d.k);b.setAttribute("aria-pressed",state.deals.has(d.k));save();render();};$("dealChips").appendChild(b);});
function syncTimeInputs(){daySel.value=state.day;timeIn.value=hhmm(state.t);}
function setNow(){const n=new Date();state.day=n.getDay();state.t=n.getHours()*60+n.getMinutes();syncTimeInputs();render();}
daySel.onchange=()=>{state.day=+daySel.value;render();};
timeIn.onchange=()=>{if(timeIn.value){state.t=toMin(timeIn.value);render();}};
$("nowBtn").onclick=setNow;
sortSel.value=state.sort;sortSel.onchange=()=>{state.sort=sortSel.value;if(state.sort==="near"&&!state.me)locate(false);save();render();};
unvChip.setAttribute("aria-pressed",state.unv);unvChip.onclick=()=>{state.unv=!state.unv;unvChip.setAttribute("aria-pressed",state.unv);save();render();};
$("favChip").onclick=()=>{state.fav=!state.fav;$("favChip").setAttribute("aria-pressed",state.fav);if(state.fav&&!favs.size)toast("Tap the ☆ on any card to add favorites");render();};
$("lateChip").onclick=()=>{state.late=!state.late;$("lateChip").setAttribute("aria-pressed",state.late);if(state.late&&state.t<20*60&&state.t>=5*60){state.t=21*60+30;syncTimeInputs();}render();};
let qT;q.addEventListener("input",()=>{clearTimeout(qT);qT=setTimeout(()=>{state.q=q.value.trim().toLowerCase();render();},150);});
function setArea(a,noZoom){state.area=a;document.querySelectorAll("#areaSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.area===a));if(a!=="near")save();if(!noZoom){vb=areaVB();applyVB();}render();}
document.querySelectorAll("#areaSeg button").forEach(b=>b.onclick=()=>{const a=b.dataset.area;if(a==="near"){locate(true);return;}setArea(a);});
function locate(asArea){if(!navigator.geolocation){toast("Location isn't available in this browser");return;}
  toast("Finding you…");
  navigator.geolocation.getCurrentPosition(p=>{state.me=[p.coords.latitude,p.coords.longitude];$("youLegend").hidden=false;
    if(asArea){state.sort="near";sortSel.value="near";setArea("near");}else render();
    const inMap=state.me[0]>LAT0&&state.me[0]<LAT1&&state.me[1]>LNG0&&state.me[1]<LNG1;toast(inMap?"Sorted by distance from you":"You're outside the mapped area; distances still work");},
  ()=>{toast("Couldn't get your location. Check location permissions.");if(state.sort==="near"){state.sort="ending";sortSel.value="ending";render();}},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});}
const lists=$("lists");
lists.addEventListener("click",e=>{const fb=e.target.closest("[data-fav]");if(fb){const id=fb.dataset.fav;if(favs.has(id))favs.delete(id);else favs.add(id);store.set("clockout.favs",[...favs]);
    document.querySelectorAll(`[data-fav="${id}"]`).forEach(b=>{b.setAttribute("aria-pressed",favs.has(id));b.setAttribute("aria-label",(favs.has(id)?"Remove from":"Add to")+" favorites");});toast(favs.has(id)?"Added to favorites":"Removed from favorites");if(state.fav)render();else paintMarkers();return;}
  const row=e.target.closest(".tl-row");if(row){select(row.dataset.id,false);centerOn(VENUES.find(v=>v.id===row.dataset.id).ll,vb.w);return;}
  if(e.target.closest("a,summary,details,button"))return;const c=e.target.closest(".card");if(c)select(c.dataset.id,false);});
lists.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.classList.contains("card"))select(e.target.dataset.id,false);});
function setTab(t){state.tab=t;$("tabList").setAttribute("aria-selected",t==="list");$("tabTimeline").setAttribute("aria-selected",t==="timeline");$("listView").hidden=t!=="list";$("timelineView").hidden=t!=="timeline";render();}
$("tabList").onclick=()=>setTab("list");$("tabTimeline").onclick=()=>setTab("timeline");

/* ---------- render ---------- */
function sorter(kind){return(a,b)=>{const s=state.sort;
  if(s==="near"&&state.me)return dist(a.v)-dist(b.v);
  if(s==="rating")return(b.v.r||0)-(a.v.r||0);
  if(s==="cheap"){const pa=a.v.pr?a.v.pr[0]:99,pb=b.v.pr?b.v.pr[0]:99;return pa-pb||(b.v.r||0)-(a.v.r||0);}
  if(kind==="now")return a.i.left-b.i.left||a.v.cf-b.v.cf;if(kind==="later")return a.i.s-b.i.s||a.v.cf-b.v.cf;return(b.v.r||0)-(a.v.r||0);};}
let nowList=[],laterList=[];
function render(){const d=state.day,t=state.t;statusMap={};const now=[],later=[],unknown=[],special=[];let otherDays=0;
  VENUES.forEach(v=>{const vis=visible(v);if(baseVisible(v)&&spFor(v,d).length)special.push({v});
    if(!v.win.length){statusMap[v.id]="unknown";if(vis)unknown.push({v});return;}
    const a=activeNow(v,d,t);if(a){statusMap[v.id]="now";if(vis)now.push({v,i:a});return;}
    const l=laterToday(v,d,t);if(l){statusMap[v.id]="later";if(vis)later.push({v,i:l});return;}
    statusMap[v.id]="idle";if(vis)otherDays++;});
  now.sort(sorter("now"));later.sort(sorter("later"));unknown.sort(sorter("x"));special.sort(sorter("x"));nowList=now;laterList=later;
  const filt=state.q||state.deals.size||state.fav||state.late;
  $("listNow").innerHTML=now.length?now.map(x=>card(x.v,"now",x.i)).join(""):`<div class="empty">Nothing ${filt?"matching your filters ":""}running at ${fmtT(t)} on ${DAYS[d]}${later.length?". The next one starts at "+fmtT(later.slice().sort((a,b)=>a.i.s-b.i.s)[0].i.s)+".":". Try an afternoon between 3 and 6."}</div>`;
  $("listLater").innerHTML=later.length?later.map(x=>card(x.v,"later",x.i)).join(""):`<div class="empty">No more happy hours start later on ${DAYS[d]}.</div>`;
  $("listUnknown").innerHTML=unknown.map(x=>card(x.v,"unknown")).join("");
  $("listSpecial").innerHTML=special.length?special.map(x=>card(x.v,"special")).join(""):`<div class="empty">No day-specific specials on file for ${DAYS[d]}.</div>`;
  $("nNow").textContent=now.length;$("nLater").textContent=later.length;$("nUnknown").textContent=unknown.length;$("nSpecial").textContent=special.length;$("laterDay").textContent=DAYS[d];$("spDay").textContent=DAYS[d]+"'s";
  $("bigStatus").innerHTML=`<b>${now.length}</b> happy hour${now.length===1?"":"s"} running`;
  const areaName=state.area==="near"?"near you":AREAS[state.area].name;
  $("metaStatus").textContent=`${DAYS[d]} at ${fmtT(t)} · ${areaName} · ${later.length} more start later · ${otherDays} at other times${state.unv?"":" · unverified hidden"}`;
  if(state.tab==="timeline")renderTimeline();
  if(state.sel&&!VENUES.find(v=>v.id===state.sel&&visible(v)))state.sel=null;paintMarkers();if(state.sel)select(state.sel,false);else $("tip").hidden=true;
  fitCtl();}

function renderTimeline(){const d=state.day,t=state.t,A=600,Z=1560,span=Z-A;const pc=m=>Math.max(0,Math.min(100,(m-A)/span*100));
  const rows=[];VENUES.forEach(v=>{if(!visible(v))return;const ws=effWins(v,d).filter(w=>w.s<1440);if(ws.length)rows.push({v,ws,s:Math.min(...ws.map(w=>w.s))});});
  rows.sort((a,b)=>a.s-b.s||a.ws[0].e-b.ws[0].e);$("tlDay").textContent="on "+DAYS[d];$("nTl").textContent=rows.length;
  const ticks=[[600,"10a"],[720,"noon"],[900,"3p"],[1080,"6p"],[1260,"9p"],[1440,"12a"],[1560,"2a"]];
  const nowL=t>=A&&t<=Z?`<span class="nowline" style="left:${pc(t)}%"></span>`:"";
  let h=`<div class="tl-axis"><span></span><div class="ticks">${ticks.map(x=>`<span style="left:${pc(x[0])}%">${x[1]}</span>`).join("")}</div></div>`;
  h+=rows.map(r=>`<button type="button" class="tl-row" data-id="${r.v.id}" aria-label="${esc(r.v.n)}: ${r.ws.map(w=>fmtRange(w.s,w.e)).join(" and ")}"><span class="nm">${esc(r.v.n)} <small>${esc(r.v.c)}</small></span><span class="bar">${r.ws.map(w=>`<i class="${w.s<=t&&t<w.e?"on":""}" style="left:${pc(w.s)}%;width:${Math.max(1,pc(w.e)-pc(w.s))}%"></i>`).join("")}${nowL}</span></button>`).join("");
  $("timeline").innerHTML=rows.length?h:`<div class="empty" style="border:0">No happy hours on ${DAYS[d]} match your filters.</div>`;}

/* ---------- surprise me ---------- */
$("surpriseBtn").onclick=()=>{const pool=nowList.length?nowList:laterList;if(!pool.length){toast("Nothing running or starting later with these filters");return;}
  const pick=pool[Math.floor(Math.random()*pool.length)].v;if(state.tab!=="list")setTab("list");centerOn(pick.ll,W/3);select(pick.id,true);toast("How about "+pick.n+"?");};

/* ---------- plan my night ---------- */
let lastPlan=null;
function planNight(start,nStops,shuffle){const d=state.day;const pool=VENUES.filter(v=>baseVisible(v)&&v.win.length);const used=new Set();const steps=[];let t=start,prev=state.me;
  for(let i=0;i<nStops;i++){let best=null;
    for(const v of pool){if(used.has(v.id))continue;const dm=prev?miles(prev,v.ll):0;if(prev&&dm>(i===0?12:6))continue;
      const drive=prev?Math.round(dm*2.8)+4:0;const arrive=t+drive;let a=activeNow(v,d,arrive),startAt=arrive,end;
      if(a){if(a.left<30)continue;end=a.end;}else{const w=effWins(v,d).filter(w=>w.s>arrive&&w.s<=arrive+45).sort((x,y)=>x.s-y.s)[0];if(!w)continue;startAt=w.s;end=w.e;}
      const score=Math.min(end-startAt,120)/60*1.2+(v.r||4)-(prev?dm*0.45:0)-(v.cf-1)*0.8-(startAt-arrive)/60+(shuffle?Math.random()*1.6:0);
      if(!best||score>best.score)best={v,score,drive,dm,arrive:startAt,end};}
    if(!best)break;used.add(best.v.id);const leave=Math.min(best.end,best.arrive+(i===nStops-1?120:80));
    steps.push({...best,leave});t=leave;prev=best.v.ll;}
  return steps;}
function showPlan(shuffle){const start=toMin($("planStart").value||hhmm(state.t));const n=+$("planStops").value;const steps=planNight(start,n,shuffle);lastPlan=steps;
  $("planSub").textContent=`${DAYS[state.day]} · ${state.area==="near"?"near you":AREAS[state.area].name}${state.deals.size?" · with your deal filters":""}${state.me?"":" · turn on Near me to start from your location"}`;
  if(!steps.length){$("planOut").innerHTML=`<div class="empty">Nothing lines up from ${fmtT(start)} on ${DAYS[state.day]}. Try an earlier start, another day or a different area.</div>`;return;}
  $("planOut").innerHTML=steps.map((s,i)=>`${i&&s.drive?`<div class="plan-drive">🚗 about ${s.drive} min drive (${s.dm.toFixed(1)} mi)</div>`:""}<div class="plan-step"><span class="num">${i+1}</span><div><h3>${esc(s.v.n)}</h3><div class="where">${esc(s.v.c)} · ${esc(s.v.a)}</div><div class="sched"><b>${fmtT(s.arrive)}–${fmtT(s.leave)}</b> · happy hour until ${fmtT(s.end)}</div>${spFor(s.v,state.day).map(x=>`<div class="special"><b>${DS[state.day]}:</b> ${esc(x.txt)}</div>`).join("")}${s.v.d?`<div class="deals">${esc(s.v.d)}</div>`:""}</div></div>`).join("");}
function drawPlan(){gPlan.innerHTML="";if(!lastPlan||!lastPlan.length)return;const k=vb.w/W;
  const pts=lastPlan.map(s=>[X(s.v.ll[1]),Y(s.v.ll[0])]);
  if(pts.length>1)el("polyline",{"data-k":"line",points:pts.map(p=>p.join(",")).join(" "),fill:"none",stroke:"var(--ink)","stroke-width":4*k,"stroke-dasharray":`${10*k} ${7*k}`,"stroke-linecap":"round"},gPlan);
  pts.forEach((p,i)=>{el("circle",{"data-k":"c",cx:p[0],cy:p[1],r:13*k,fill:"var(--ink)"},gPlan);const t=el("text",{"data-k":"t","data-cy":p[1],x:p[0],y:p[1]+6*k,"text-anchor":"middle",fill:"var(--bg)","font-family":FONT,"font-weight":"800","font-size":17*k},gPlan);t.textContent=i+1;});
  const lats=lastPlan.map(s=>s.v.ll[0]),lngs=lastPlan.map(s=>s.v.ll[1]);vb=boxVB(Math.min(...lats)-0.01,Math.max(...lats)+0.01,Math.min(...lngs)-0.015,Math.max(...lngs)+0.015,0.15);applyVB();}
$("planBtn").onclick=()=>{$("planStart").value=hhmm(state.t);showPlan(false);openPop("planPop");};
$("planStart").onchange=()=>showPlan(false);$("planStops").onchange=()=>showPlan(false);$("planShuffle").onclick=()=>showPlan(true);
$("planMap").onclick=()=>{closePop("planPop");drawPlan();if(lastPlan&&lastPlan.length){select(lastPlan[0].v.id,false);toast("Your route is on the map");document.getElementById("mapbox").scrollIntoView({behavior:"smooth",block:"nearest"});}};

/* ---------- popups & toast ---------- */
let lastFocus=null;
function openPop(id){lastFocus=document.activeElement;const p=$(id);p.hidden=false;const f=p.querySelector("button,select,input");if(f)f.focus();}
function closePop(id){$(id).hidden=true;if(lastFocus&&lastFocus.focus)lastFocus.focus();}
document.querySelectorAll(".pop").forEach(p=>{p.addEventListener("click",e=>{if(e.target===p||e.target.closest("[data-close]"))closePop(p.id);});});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".pop:not([hidden])").forEach(p=>closePop(p.id));});
let toastT;function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2400);}

/* ---------- themes ---------- */
const palBtn=$("palBtn");
function applyPal(id,announce){const p=PALS.find(x=>x.id===id)||PALS[0];const r=document.documentElement;r.dataset.pal=p.id;r.dataset.theme=p.dark?"dark":"light";$("palName").textContent=p.name;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.setAttribute("content",p.tc));store.set("clockout.pal",p.id);
  document.querySelectorAll("#palGrid button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pal===p.id));if(announce)toast(p.name+(p.dark?" · dark":" · light"));}
$("palGrid").innerHTML=PALS.map(p=>`<button type="button" data-pal="${p.id}" aria-pressed="false"><span class="sw"><i style="background:${p.sw[0]}"></i><i style="background:${p.sw[1]}"></i><i style="background:${p.sw[2]}"></i></span><span class="nm">${p.name}<small>${p.dark?"Dark":"Light"}</small></span></button>`).join("");
$("palGrid").addEventListener("click",e=>{const b=e.target.closest("[data-pal]");if(b){applyPal(b.dataset.pal,true);closePop("palPop");}});
let pressT=null,longFired=false;
palBtn.addEventListener("pointerdown",()=>{longFired=false;clearTimeout(pressT);pressT=setTimeout(()=>{longFired=true;openPop("palPop");},500);});
["pointerup","pointerleave","pointercancel"].forEach(ev=>palBtn.addEventListener(ev,()=>clearTimeout(pressT)));
palBtn.addEventListener("contextmenu",e=>{e.preventDefault();clearTimeout(pressT);longFired=true;openPop("palPop");});
palBtn.addEventListener("click",e=>{if(longFired){longFired=false;return;}if(e.shiftKey||e.altKey){openPop("palPop");return;}const cur=document.documentElement.dataset.pal;const i=PALS.findIndex(p=>p.id===cur);applyPal(PALS[(i+1)%PALS.length].id,true);});
applyPal(store.get("clockout.pal",null)||(matchMedia("(prefers-color-scheme: dark)").matches?"afterhours":"classic"),false);

/* ---------- share ---------- */
function shareParams(){const p=new URLSearchParams();p.set("d",state.day);p.set("t",hhmm(state.t).replace(":",""));if(state.area!=="all"&&state.area!=="near")p.set("a",state.area);if(state.q)p.set("q",state.q);if(state.deals.size)p.set("deal",[...state.deals].join("."));if(state.late)p.set("late","1");if(state.types.size<Object.keys(TYPES).length)p.set("type",[...state.types].join("."));return p;}
$("shareBtn").onclick=async()=>{let top=true;try{top=window.top===window.self;}catch(e){top=false;}
  if(!top||!/^https?:$/.test(location.protocol)){toast("Share links work from the website version of Clock Out");return;}
  const url=location.origin+location.pathname+"#"+shareParams().toString();const text=`Happy hours ${DAYS[state.day]} at ${fmtT(state.t)}`;
  try{if(navigator.share){await navigator.share({title:"Clock Out",text,url});return;}await navigator.clipboard.writeText(url);toast("Link copied");}catch(e){if(e&&e.name==="AbortError")return;prompt("Copy this link:",url);}};
function readParams(){let p;try{p=new URLSearchParams((location.hash||"").replace(/^#/,"")||location.search);}catch(e){return false;}if(!p.has("d")&&!p.has("t"))return false;
  const d=+p.get("d");if(d>=0&&d<=6)state.day=d;const tt=p.get("t");if(tt&&/^\d{3,4}$/.test(tt)){const n=tt.padStart(4,"0");state.t=+n.slice(0,2)*60+ +n.slice(2);}
  if(p.get("a")&&AREAS[p.get("a")])state.area=p.get("a");if(p.get("q")){state.q=p.get("q").toLowerCase();q.value=p.get("q");}
  if(p.get("deal")){state.deals=new Set(p.get("deal").split(".").filter(k=>DEALS.some(x=>x.k===k)));document.querySelectorAll("#dealChips .chip").forEach(b=>b.setAttribute("aria-pressed",state.deals.has(b.dataset.k)));}
  if(p.get("late")==="1"){state.late=true;$("lateChip").setAttribute("aria-pressed","true");}
  if(p.get("type")){const ts=p.get("type").split(".").filter(k=>TYPES[k]);if(ts.length){state.types=new Set(ts);document.querySelectorAll("#typeChips .chip").forEach((b,i)=>b.setAttribute("aria-pressed",state.types.has(Object.keys(TYPES)[i])));}}
  return true;}

/* ---------- layout helpers ---------- */
function fitCtl(){const c=$("controls");const h=matchMedia("(max-width:700px)").matches?0:c.offsetHeight;document.documentElement.style.setProperty("--ctl-h",h+"px");}
window.addEventListener("resize",fitCtl);
(function(){const b=$("toTop");const narrow=()=>matchMedia("(max-width:900px)").matches;const target=()=>narrow()?document.querySelector(".status"):null;
  function upd(){const t=target();const lim=t?t.getBoundingClientRect().top+scrollY+120:350;const on=scrollY>lim;b.classList.toggle("show",on);b.tabIndex=on?0:-1;}
  addEventListener("scroll",upd,{passive:true});addEventListener("resize",upd);upd();
  b.addEventListener("click",()=>{const smooth=!matchMedia("(prefers-reduced-motion:reduce)").matches;const t=target();const y=t?Math.max(0,t.getBoundingClientRect().top+scrollY-8):0;scrollTo({top:y,behavior:smooth?"smooth":"auto"});});})();

/* ---------- start ---------- */
const fromLink=readParams();
document.querySelectorAll("#areaSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.area===state.area));
vb=areaVB();applyVB();
if(fromLink){syncTimeInputs();render();}else setNow();
setInterval(()=>{const n=new Date();const tm=n.getHours()*60+n.getMinutes();if(+daySel.value===n.getDay()&&Math.abs(state.t-tm)<=2&&tm!==state.t){state.t=tm;syncTimeInputs();render();}},60000);
try{if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)&&window.top===window.self)navigator.serviceWorker.register("sw.js").catch(()=>{});}catch(e){}
})();
