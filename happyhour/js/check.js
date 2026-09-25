/* Clock Out — data check. Open check.html after editing js/data.js.
   Errors: the app will show something wrong or nothing at all. Warnings: probably a mistake, worth a look. */
(function(){
"use strict";
const TYPES=Object.keys(CO.config.TYPES);
const BOUNDS=CO.config.MAP;
const DAYS=CO.config.DS;

const errors=[],warnings=[];
const err=(v,msg)=>errors.push({id:v&&v.id,n:v&&v.n,msg}),warn=(v,msg)=>warnings.push({id:v&&v.id,n:v&&v.n,msg});
const TIME=/^(\d{1,2}):([0-5]\d)$/;
const toMin=s=>{const m=TIME.exec(s);return m?+m[1]*60+ +m[2]:null;};
const validDays=s=>typeof s==="string"&&/^[0-6]+$/.test(s)&&new Set(s).size===s.length;

/* city lists */
const areaOf={};
for(const [area,list] of Object.entries(AREA_CITIES))for(const c of list){if(areaOf[c])err(null,`"${c}" is listed under both ${areaOf[c]} and ${area} in AREA_CITIES`);areaOf[c]=area;}
for(const c of NEARBY_CITIES)if(!areaOf[c])err(null,`NEARBY_CITIES has "${c}", which isn't in AREA_CITIES`);

/* business hours: null = unknown, [] = closed, else [[open,close],...] in minutes */
function parseHours(v){if(!v.ho)return null;const parts=v.ho.split(",");
  if(parts.length!==1&&parts.length!==7){err(v,`ho has ${parts.length} days; needs 1 (same every day) or 7 (Sun→Sat)`);return null;}
  const toks=parts.length===1?Array(7).fill(parts[0]):parts;
  return toks.map((t,d)=>{t=t.trim();if(t==="x")return[];if(t==="?"||!t)return null;
    const out=[];for(const r of t.split("+")){const m=/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(r);
      if(!m){err(v,`ho for ${DAYS[d]} can't be read: "${t}"`);return null;}
      const a=+m[1],b=+m[2];if(b<=a)err(v,`ho for ${DAYS[d]} closes before it opens: "${r}" (use 26 for 2am)`);else if(b>30)warn(v,`ho for ${DAYS[d]} closes after 6am: "${r}"`);
      out.push([a*60,b*60]);}
    return out;});}

const seen={};
VENUES.forEach((v,i)=>{
  if(!v||typeof v!=="object"){err({id:"#"+(i+1)},"entry isn't an object");return;}
  if(!v.id){v={...v,id:"entry "+(i+1)};err(v,"missing id");}
  if(seen[v.id])err(v,`duplicate id (also used by ${seen[v.id]})`);seen[v.id]=v.n||v.id;
  for(const f of ["n","c","a"])if(!v[f]||typeof v[f]!=="string")err(v,`missing ${f}`);
  if(v.c&&!areaOf[v.c])err(v,`city "${v.c}" isn't in AREA_CITIES at the top of data.js, so it can't be put in an area`);
  if(!TYPES.includes(v.t))err(v,`type t is "${v.t}"; must be one of ${TYPES.join(", ")}`);
  if(![1,2,3].includes(v.cf))err(v,`confidence cf is ${JSON.stringify(v.cf)}; must be 1, 2 or 3`);
  if(!Array.isArray(v.ll)||v.ll.length!==2||!v.ll.every(n=>typeof n==="number"&&isFinite(n)))err(v,"ll must be [lat, lng] numbers");
  else if(v.ll[0]<BOUNDS.lat0||v.ll[0]>BOUNDS.lat1||v.ll[1]<BOUNDS.lng0||v.ll[1]>BOUNDS.lng1)err(v,`ll ${v.ll.join(", ")} is off the map${v.ll[1]>0?" (lng should be negative)":""}`);

  const hours=parseHours(v);
  if(!Array.isArray(v.hh))err(v,"hh must be a list (use [] if times are unknown)");
  else v.hh.forEach(w=>{
    if(!Array.isArray(w)||w.length<3){err(v,`hh entry ${JSON.stringify(w)} needs ["days","start","end"]`);return;}
    if(!validDays(w[0])){err(v,`hh days "${w[0]}" must be digits 0–6 (0=Sun), each once`);return;}
    const s=toMin(w[1]),e=toMin(w[2]);
    if(s==null||e==null){err(v,`hh times must look like "15:00": ${JSON.stringify(w)}`);return;}
    if(e<=s){err(v,`hh ends before it starts: ${w[1]}–${w[2]} (use "26:00" for 2am)`);return;}
    if(e-s<15)warn(v,`hh is under 15 minutes: ${w[1]}–${w[2]}`);
    if(s>=1560)warn(v,`hh starts after 2am (${w[1]}); it won't appear on the timeline`);
    if(hours){const dead=[...w[0]].map(Number).filter(d=>{const h=hours[d];if(!h)return false;
        return h.length===0||!h.some(r=>Math.min(e,r[1])-Math.max(s,r[0])>=15);});
      if(dead.length)warn(v,`hh ${w[1]}–${w[2]} never shows on ${dead.map(d=>DAYS[d]).join(", ")}: the business hours (ho) say closed then`);}
  });
  if(v.sp!=null){if(!Array.isArray(v.sp))err(v,"sp must be a list");
    else v.sp.forEach(s=>{if(!Array.isArray(s)||!validDays(s[0])||!s[1])err(v,`sp entry ${JSON.stringify(s)} needs ["days","text"] with days 0–6`);});}
  if(v.pr!=null&&(!Array.isArray(v.pr)||typeof v.pr[0]!=="number"||typeof v.pr[1]!=="string"))err(v,`pr must be [price, "kind"], e.g. [2,"beer"]`);
  if(v.r!=null&&(typeof v.r!=="number"||v.r<1||v.r>5))err(v,`rating r should be 1–5, got ${v.r}`);
  if(v.r!=null&&typeof v.rc!=="number")err(v,"rating r is set but review count rc isn't");
  if(v.w&&!/^https?:\/\//.test(v.w))warn(v,`website should start with https://: ${v.w}`);
  if(v.ph&&v.ph.replace(/\D/g,"").length!==10)warn(v,`phone doesn't have 10 digits: ${v.ph}`);
  if(v.ap!=null&&v.ap!==1)warn(v,"ap should be 1 or left out");
  if(v.dt&&/20\d\d/.test(v.dt)){const y=+v.dt.match(/20\d\d/)[0];if(y>new Date().getFullYear())warn(v,`evidence date dt is in the future: ${v.dt}`);}
  if(!v.ev)warn(v,"no evidence note (ev)");
});

/* report */
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const row=x=>`<li>${x.id?`<b>${esc(x.n||x.id)}</b> <code>${esc(x.id)}</code> `:""}${esc(x.msg)}</li>`;
const out=document.getElementById("out");
const counts=Object.entries(AREA_CITIES).map(([a,l])=>`${VENUES.filter(v=>l.includes(v.c)).length} ${a}`).join(" · ");
out.innerHTML=`<p class="sum ${errors.length?"bad":warnings.length?"meh":"ok"}">${errors.length?`${errors.length} error${errors.length>1?"s":""}`:"No errors"} · ${warnings.length} warning${warnings.length===1?"":"s"}</p>
<p class="meta">${VENUES.length} venues (${counts}) · ${Object.keys(areaOf).length} cities</p>
${errors.length?`<h2>Errors</h2><p class="meta">The app will show these venues wrong, or not at all.</p><ul>${errors.map(row).join("")}</ul>`:""}
${warnings.length?`<h2>Warnings</h2><p class="meta">Probably fine, but worth a look.</p><ul>${warnings.map(row).join("")}</ul>`:""}`;
document.title=(errors.length?"✗ ":"✓ ")+"Clock Out data check";
})();
