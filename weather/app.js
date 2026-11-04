/* Weather Almanac app script. Loaded with defer from index.html after Leaflet.
   Sections, in order: basics · units · data loading · climate math · icons and charts · header and search ·
   at a glance · section renderers · radar · outlooks · themes · live sky · section layout · settings · orchestration.
   All data is fetched metric and converted for display. Nothing here needs a build step. */
'use strict';
/* ============ basics ============ */
// Optional: paste a free CARTO basemap key (carto.com/basemaps/apikey) to use CARTO's map style instead of Esri's.
const CARTO_KEY='';
const DEFAULT_LOC={name:'Detroit',admin1:'Michigan',country:'United States',cc:'US',lat:42.3314,lon:-83.0458};
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}},
  keys(){try{return Object.keys(localStorage)}catch(e){return []}}};
const validLoc=L=>!!L&&typeof L==='object'&&typeof L.lat==='number'&&isFinite(L.lat)&&typeof L.lon==='number'&&isFinite(L.lon);
const S={loc:(L=>validLoc(L)?L:DEFAULT_LOC)(LS.get('wx:loc',null)),units:LS.get('wx:units','us')==='si'?'si':'us',saved:(v=>Array.isArray(v)?v.filter(validLoc):[])(LS.get('wx:saved',[])),
  fc:null,aq:null,hist:null,recent:null,p92:null,models:null,ens:null,nws:null,alerts:null,obs:null,afd:null,
  loadId:0,lastLoad:0,mv:'tmax',histErr:null};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const isNum=v=>typeof v==='number'&&isFinite(v);
const at=(a,i)=>(a&&i>=0&&i<a.length&&isNum(a[i]))?a[i]:null;
const r1=a=>(a||[]).map(v=>isNum(v)?Math.round(v*10)/10:null);
const sum=a=>a.reduce((s,v)=>s+(isNum(v)?v:0),0);
const mean=a=>{const b=a.filter(isNum);return b.length?b.reduce((s,v)=>s+v,0)/b.length:null};
const quant=(a,q)=>{const b=a.filter(isNum).sort((x,y)=>x-y);if(!b.length)return null;const p=(b.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return b[lo]+(b[hi]-b[lo])*(p-lo)};
const locKey=L=>L.lat.toFixed(2)+','+L.lon.toFixed(2);
const US=()=>S.units==='us';

/* ============ units (everything is fetched metric and converted here) ============ */
const U={
  t:c=>c==null?null:(US()?c*9/5+32:c),
  dt:c=>c==null?null:(US()?c*9/5:c),
  w:k=>k==null?null:(US()?k/1.609344:k), wu:()=>US()?'mph':'km/h',
  p:mm=>mm==null?null:(US()?mm/25.4:mm), pu:()=>US()?'in':'mm', pd:()=>US()?2:1,
  sn:cm=>cm==null?null:(US()?cm/2.54:cm), su:()=>US()?'in':'cm',
  dist:m=>m==null?null:(US()?m/1609.344:m/1000), du:()=>US()?'mi':'km',
  h:m=>m==null?null:(US()?m*3.28084:m), hu:()=>US()?'ft':'m',
  pr:h=>h==null?null:(US()?h*0.0295300:h), pru:()=>US()?'inHg':'hPa', prd:()=>US()?2:0
};
const fT=(c,suffix='°')=>c==null?'—':Math.round(U.t(c))+suffix;
const fDT=c=>c==null?'—':(c>=0?'+':'−')+Math.abs(U.dt(c)).toFixed(1)+'°';
const fP=mm=>mm==null?'—':U.p(mm).toFixed(U.pd())+' '+U.pu();
const fS=cm=>cm==null?'—':U.sn(cm).toFixed(1)+' '+U.su();
const fW=k=>k==null?'—':Math.round(U.w(k))+' '+U.wu();
const fN=v=>v==null?'—':(Math.abs(v)>=100?Math.round(v).toLocaleString():(Math.round(v*10)/10).toString());
const DIRS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const card=d=>d==null?'':DIRS[Math.round((((d%360)+360)%360)/22.5)%16];

/* ============ dates (Open-Meteo returns location-local strings; treat them as wall-clock) ============ */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pT=s=>{const [d,t='00:00']=s.split('T');const [y,m,dd]=d.split('-').map(Number);const [h,mi]=t.split(':').map(Number);return new Date(Date.UTC(y,m-1,dd,h||0,mi||0))};
const dstr=d=>d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
const tstr=d=>dstr(d)+'T'+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());
const addDays=(s,n)=>{const [y,m,d]=s.split('-').map(Number);return dstr(new Date(Date.UTC(y,m-1,d+n)))};
const dayDiff=(a,b)=>{const [y1,m1,d1]=a.split('-').map(Number),[y2,m2,d2]=b.split('-').map(Number);return Math.round((Date.UTC(y2,m2-1,d2)-Date.UTC(y1,m1-1,d1))/864e5)};
const leap=y=>(y%4===0&&y%100!==0)||y%400===0;
const mdDate=(y,md)=>md==='02-29'&&!leap(y)?y+'-02-28':y+'-'+md;
const h12=h=>(h%12||12)+(h<12?' AM':' PM');
const fHour=s=>h12(pT(s).getUTCHours());
const fClock=s=>{const d=pT(s);const h=d.getUTCHours();return (h%12||12)+':'+pad(d.getUTCMinutes())+(h<12?' AM':' PM')};
const fDow=s=>DOW[pT(s).getUTCDay()];
const fMD=s=>{const d=pT(s);return MON[d.getUTCMonth()]+' '+d.getUTCDate()};
const fMDL=s=>{const d=pT(s);return MONL[d.getUTCMonth()]+' '+d.getUTCDate()};
function browserToday(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function ctx(){
  const f=S.fc;if(!f)return null;
  const off=f.utc_offset_seconds||0;
  const curT=(f.current&&f.current.time)||tstr(new Date(Date.now()+off*1000));
  let ci=f.hourly.time.indexOf(curT.slice(0,13)+':00');if(ci<0)ci=0;
  const today=curT.slice(0,10);let di=f.daily.time.indexOf(today);if(di<0)di=0;
  return {f,off,curT,ci,today,di,H:f.hourly,D:f.daily,C:f.current||{}};
}
const todayStr=()=>{const c=ctx();return c?c.today:browserToday()};

/* ============ fetching ============ */
async function fetchJSON(url,ms=25000){
  const ac=new AbortController();const t=setTimeout(()=>ac.abort(),ms);
  try{const r=await fetch(url,{signal:ac.signal});
    let j=null;try{j=await r.json()}catch(e){}
    if(!r.ok){const e=new Error((j&&(j.reason||j.detail||j.title))||('HTTP '+r.status));e.status=r.status;e.body=j;throw e}
    return j;
  }catch(e){if(e.name==='AbortError')throw new Error('timed out');throw e}finally{clearTimeout(t)}
}
// Open-Meteo call that drops any variable the API rejects and retries, so one renamed field never blanks a section.
async function fetchOM(base,p,ms=25000,tries=8){
  const q=new URLSearchParams();
  for(const [k,v] of Object.entries(p)){if(v==null||(Array.isArray(v)&&!v.length))continue;q.set(k,Array.isArray(v)?v.join(','):v)}
  try{return await fetchJSON(base+'?'+q.toString(),ms)}
  catch(e){
    const reason=(e.body&&e.body.reason)||e.message||'';
    const bad=/invalid String value\s+([A-Za-z0-9_]+)/.exec(reason);
    if(bad&&tries>0){let np={...p},hit=false;
      for(const k of ['current','hourly','daily','models'])if(Array.isArray(np[k])&&np[k].includes(bad[1])){np[k]=np[k].filter(x=>x!==bad[1]);hit=true}
      if(hit){console.warn('Open-Meteo dropped',bad[1]);return fetchOM(base,np,ms,tries-1)}}
    const rng=/to (\d{4}-\d{2}-\d{2})/.exec(reason);
    if(/out of allowed range/i.test(reason)&&rng&&p.end_date&&tries>0&&rng[1]<p.end_date){return fetchOM(base,{...p,end_date:rng[1]},ms,tries-1)}
    const err=new Error(e.status===429?'the free weather service is busy (rate limit)':(reason||'request failed'));err.status=e.status;throw err;
  }
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// One automatic retry after a minute when Open-Meteo says the per-minute limit was hit.
async function withRetry(fn,onWait){try{return await fn()}catch(e){if(e.status!==429)throw e;onWait&&onWait();await sleep(65000);return fn()}}
const omBase=L=>({latitude:L.lat.toFixed(4),longitude:L.lon.toFixed(4),timezone:'auto'});
const HOURLY=['temperature_2m','relative_humidity_2m','dew_point_2m','apparent_temperature','precipitation_probability','precipitation','snowfall','weather_code','pressure_msl','cloud_cover','cloud_cover_low','cloud_cover_mid','cloud_cover_high','visibility','wind_speed_10m','wind_direction_10m','wind_gusts_10m','wind_speed_80m','wind_speed_120m','wind_speed_180m','uv_index','is_day','cape','lifted_index','freezing_level_height','wet_bulb_temperature_2m','snow_depth'];
const DAILY=['weather_code','temperature_2m_max','temperature_2m_min','apparent_temperature_max','apparent_temperature_min','sunrise','sunset','daylight_duration','sunshine_duration','uv_index_max','precipitation_sum','snowfall_sum','precipitation_hours','precipitation_probability_max','wind_speed_10m_max','wind_gusts_10m_max','wind_direction_10m_dominant','shortwave_radiation_sum','et0_fao_evapotranspiration'];
const CURRENT=['temperature_2m','relative_humidity_2m','apparent_temperature','is_day','precipitation','weather_code','cloud_cover','pressure_msl','surface_pressure','wind_speed_10m','wind_direction_10m','wind_gusts_10m'];
const loadForecast=L=>fetchOM('https://api.open-meteo.com/v1/forecast',{...omBase(L),past_days:2,forecast_days:16,current:CURRENT,hourly:HOURLY,daily:DAILY});
const loadAQ=L=>fetchOM('https://air-quality-api.open-meteo.com/v1/air-quality',{...omBase(L),current:['us_aqi','pm2_5','pm10','ozone','nitrogen_dioxide','uv_index'],hourly:['us_aqi'],forecast_days:3});
const loadP92=L=>fetchOM('https://api.open-meteo.com/v1/forecast',{...omBase(L),past_days:92,forecast_days:1,daily:['temperature_2m_max','temperature_2m_min','precipitation_sum','snowfall_sum']});
const MODELS=[['ecmwf_ifs025','ECMWF','var(--c1)'],['gfs_seamless','GFS','var(--c2)'],['icon_seamless','ICON','var(--c3)'],['gem_seamless','GEM','var(--c4)']];
const loadModels=L=>fetchOM('https://api.open-meteo.com/v1/forecast',{...omBase(L),forecast_days:10,daily:['temperature_2m_max','temperature_2m_min','precipitation_sum'],models:MODELS.map(m=>m[0])});
async function loadEns(L){let last;
  for(const [m,label] of [['gfs_seamless','GFS ensemble'],['ecmwf_ifs025','ECMWF ensemble'],['icon_seamless','ICON ensemble']]){
    try{const j=await fetchOM('https://ensemble-api.open-meteo.com/v1/ensemble',{...omBase(L),hourly:['temperature_2m','precipitation'],models:[m],forecast_days:16},40000);
      if(j&&j.hourly)return {label,j}}catch(e){last=e}}
  throw last||new Error('no ensemble');}
const ARCH='https://archive-api.open-meteo.com/v1/archive';
const HVARS=['temperature_2m_max','temperature_2m_min','precipitation_sum','snowfall_sum'];
const HIST_INFLIGHT={};
function histMsg(t){S.histMsg=t;const el=$('#histNote');if(el)el.textContent=t||''}
function packDaily(d){return {start:d.time[0],end:d.time[d.time.length-1],tmax:r1(d.temperature_2m_max),tmin:r1(d.temperature_2m_min),prcp:r1(d.precipitation_sum),snow:r1(d.snowfall_sum)}}
function saveHist(key,h){if(!LS.set(key,h)){LS.keys().filter(k=>k.startsWith('wx:hist:')&&k!==key).forEach(LS.del);LS.set(key,h)}}
const histDone=h=>!!h&&h.start==='1940-01-01';
// Open-Meteo weighs a request by days x variables: 1940-today in one go counts as ~900 calls, over the
// free 600-per-minute limit, which made the requests right after it fail. So: 1991-on first (~365),
// then 1940-1990 (~530) a minute later. onPart renders as soon as the first half lands.
function loadHistory(L,onPart){
  const key='wx:hist:'+locKey(L);
  if(!HIST_INFLIGHT[key])HIST_INFLIGHT[key]=(async()=>{
    const lastY=+browserToday().slice(0,4)-1;const end=lastY+'-12-31';
    let h=LS.get(key,null);if(h&&h.end!==end)h=null;
    if(histDone(h))return h;
    const get=(a,b)=>withRetry(()=>fetchOM(ARCH,{...omBase(L),start_date:a,end_date:b,daily:HVARS},120000),()=>histMsg('The free weather service is busy. Trying the climate record again in a minute…'));
    let wait=0;
    if(!(h&&h.start==='1991-01-01')){
      histMsg('Downloading 1991–'+lastY+' for this spot. This happens once per location.');
      const t0=Date.now();h={v:2,...packDaily((await get('1991-01-01',end)).daily)};saveHist(key,h);
      wait=Math.max(0,t0+62000-Date.now());
    }
    onPart&&onPart(h);
    histMsg('Adding 1940–1990 to the record. This takes about a minute the first time.');
    await sleep(wait);
    const o=packDaily((await get('1940-01-01','1990-12-31')).daily);
    const gap=Math.max(0,dayDiff(o.start,h.start)-o.tmax.length);const padN=a=>a.concat(new Array(gap).fill(null));
    const full={v:2,start:o.start,end:h.end,tmax:padN(o.tmax).concat(h.tmax),tmin:padN(o.tmin).concat(h.tmin),prcp:padN(o.prcp).concat(h.prcp),snow:padN(o.snow).concat(h.snow)};
    saveHist(key,full);histMsg('');return full;
  })().finally(()=>{delete HIST_INFLIGHT[key]});
  else if(onPart){const h=LS.get(key,null);if(h)onPart(h)}
  return HIST_INFLIGHT[key];
}
async function loadRecent(L){
  const today=browserToday();const start=today.slice(0,4)+'-01-01';const end=addDays(today,-1);
  if(end<start)return {start,tmax:[],tmin:[],prcp:[],snow:[]};
  const key='wx:recent:'+locKey(L);const c=LS.get(key,null);
  if(c&&c.reqEnd===end&&Date.now()-c.at<6*3600e3)return c;
  let j;try{j=await withRetry(()=>fetchOM(ARCH,{...omBase(L),start_date:start,end_date:end,daily:HVARS},60000))}
  catch(e){if(c&&c.start===start)return c;throw e} // offline: an older copy of this year's record beats none
  const d=j.daily;const r={start:d.time[0],reqEnd:end,at:Date.now(),tmax:r1(d.temperature_2m_max),tmin:r1(d.temperature_2m_min),prcp:r1(d.precipitation_sum),snow:r1(d.snowfall_sum)};
  LS.set(key,r);return r;
}
async function loadObs(P){
  const st=await fetchJSON(P.observationStations);const f=(st.features||[])[0];if(!f)throw new Error('no stations listed');
  const id=f.properties.stationIdentifier;const o=await fetchJSON('https://api.weather.gov/stations/'+id+'/observations/latest');
  return {station:f.properties,coords:f.geometry&&f.geometry.coordinates,obs:o.properties};
}
async function loadAFD(cwa){
  const list=await fetchJSON('https://api.weather.gov/products/types/AFD/locations/'+cwa);
  const first=(list['@graph']||[])[0];if(!first)throw new Error('no discussion issued');
  const p=await fetchJSON(first['@id']);return {text:p.productText||'',issued:p.issuanceTime,office:cwa};
}

/* ============ climate history engine ============ */
let NC=new Map();
function hv(date,k){
  const H=S.hist;if(H&&date>=H.start&&date<=H.end){const v=H[k][dayDiff(H.start,date)];return isNum(v)?v:null}
  const R=S.recent;if(R&&R[k]&&date>=R.start){const v=R[k][dayDiff(R.start,date)];if(isNum(v))return v}
  const P=S.p92;if(P&&P[date]&&isNum(P[date][k]))return P[date][k];
  return null;
}
const tmean=d=>{const a=hv(d,'tmax'),b=hv(d,'tmin');return a==null||b==null?null:(a+b)/2};
const val=(d,k)=>k==='tmean'?tmean(d):hv(d,k);
function normal(md,k,w=7,y0=1991,y1=2020){
  if(!S.hist)return null;const key=md+'|'+k+'|'+w+'|'+y0+'|'+y1;if(NC.has(key))return NC.get(key);
  let s=0,c=0;for(let y=y0;y<=y1;y++){const ctr=mdDate(y,md);for(let o=-w;o<=w;o++){const v=val(addDays(ctr,o),k);if(v!=null){s+=v;c++}}}
  const r=c?s/c:null;NC.set(key,r);return r;
}
const mdOf=s=>s.slice(5,10);
function yearsWith(md,k,y0,y1){const out=[];for(let y=y0;y<=y1;y++){const v=val(mdDate(y,md),k);if(v!=null)out.push({y,v})}return out}
function cumBetween(start,end,k){let s=0,n=0;for(let d=start;d<=end;d=addDays(d,1)){const v=hv(d,k);if(v!=null){s+=v;n++}}return {s,n}}

/* ============ weather codes + icons ============ */
const WMO={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Heavy freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Violent showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorms',96:'Thunderstorms with hail',99:'Severe thunderstorms with hail'};
const wLabel=c=>WMO[c]||'—';
function icon(code,day=1){
  const sun=`<circle cx="26" cy="24" r="9" fill="var(--sun)"/><g stroke="var(--sun)" stroke-width="2.6" stroke-linecap="round">${[0,45,90,135,180,225,270,315].map(a=>{const r=Math.PI*a/180;return `<line x1="${26+Math.cos(r)*13.5}" y1="${24+Math.sin(r)*13.5}" x2="${26+Math.cos(r)*17.5}" y2="${24+Math.sin(r)*17.5}"/>`}).join('')}</g>`;
  const moon=`<path d="M31 9a14 14 0 1 0 11 22A11 11 0 1 1 31 9z" fill="var(--snow)"/>`;
  const cloud=(f='var(--cloud)')=>`<path d="M18 50h28a10 10 0 0 0 1-20 14 14 0 0 0-27-2 11 11 0 0 0-2 22z" fill="${f}"/>`;
  const drops=n=>[16,27,38].slice(0,n).map(x=>`<line x1="${x+2}" y1="54" x2="${x-2}" y2="62" stroke="var(--rain)" stroke-width="3" stroke-linecap="round"/>`).join('');
  const flakes=n=>[18,30,42].slice(0,n).map((x,i)=>`<circle cx="${x}" cy="${57+(i%2)*4}" r="2.6" fill="var(--snow)"/>`).join('');
  let b='';const c=code;
  if(c===0)b=day?sun:moon;
  else if(c===1||c===2)b=(day?sun:moon)+`<g transform="translate(8 6) scale(.82)">${cloud()}</g>`;
  else if(c===3)b=cloud('var(--cloud2)');
  else if(c===45||c===48)b=cloud()+`<g stroke="var(--cloud2)" stroke-width="3" stroke-linecap="round"><line x1="10" y1="55" x2="54" y2="55"/><line x1="16" y1="61" x2="48" y2="61"/></g>`;
  else if(c>=51&&c<=57)b=cloud('var(--cloud2)')+drops(2);
  else if((c>=61&&c<=67)||(c>=80&&c<=82))b=cloud('var(--cloud2)')+drops(3);
  else if((c>=71&&c<=77)||c===85||c===86)b=cloud('var(--cloud2)')+flakes(3);
  else if(c>=95)b=cloud('var(--cloud2)')+`<path d="M31 46l-6 10h6l-4 9 11-13h-6l4-6z" fill="var(--bolt)"/>`;
  else b=cloud();
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${b}</svg>`;
}

/* ============ temperature color (diverging cool–neutral–warm, in °C) ============ */
const TSTOPS=[[-25,[72,62,160]],[-8,[47,111,191]],[4,[128,176,216]],[12,[176,184,190]],[20,[232,176,122]],[29,[217,105,63]],[40,[163,38,42]]];
function tColor(c){if(c==null)return 'var(--faint)';if(c<=TSTOPS[0][0])return `rgb(${TSTOPS[0][1]})`;
  for(let i=1;i<TSTOPS.length;i++){if(c<=TSTOPS[i][0]){const [a,ca]=TSTOPS[i-1],[b,cb]=TSTOPS[i];const t=(c-a)/(b-a);return `rgb(${ca.map((v,j)=>Math.round(v+(cb[j]-v)*t))})`}}
  return `rgb(${TSTOPS[TSTOPS.length-1][1]})`;}

/* ============ chart engine (SVG, responsive, hover crosshair + tooltip) ============ */
function niceTicks(min,max,count=4){const span=(max-min)||1;const s0=span/count;const mag=Math.pow(10,Math.floor(Math.log10(s0)));const e=s0/mag;
  const step=(e>=7.5?10:e>=3.5?5:e>=1.5?2:1)*mag;const lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step;const t=[];
  for(let v=lo;v<=hi+step/2;v+=step)t.push(+v.toFixed(10));return {lo,hi,t,step}}
function responsive(el,draw){el.__draw=draw;draw();if(!el.__ro&&window.ResizeObserver){let w=el.clientWidth;el.__ro=new ResizeObserver(()=>{if(Math.abs(el.clientWidth-w)>4){w=el.clientWidth;el.__draw&&el.__draw()}});el.__ro.observe(el)}}
function chart(el,c){responsive(el,()=>drawChart(el,c))}
function drawChart(el,c){
  const W=Math.max(260,el.clientWidth||600),H=c.height||200,m={l:c.ml??44,r:c.mr??14,t:16,b:26};
  const n=c.n,iw=W-m.l-m.r,ih=H-m.t-m.b,step=iw/Math.max(1,n),X=i=>m.l+(i+.5)*step;
  let lo=Infinity,hi=-Infinity;const push=v=>{if(isNum(v)){if(v<lo)lo=v;if(v>hi)hi=v}};
  (c.series||[]).forEach(s=>s.values.forEach(push));if(c.band){c.band.lo.forEach(push);c.band.hi.forEach(push)}
  if(c.bars){c.bars.values.forEach(push);push(0)}if(c.dots)c.dots.values.forEach(push);(c.extraY||[]).forEach(push);
  if(!isFinite(lo)){el.innerHTML='<p class="muted small">No data available.</p>';return}
  const ms=c.minSpan||1;if(hi-lo<ms){const mid=(hi+lo)/2;lo=mid-ms/2;hi=mid+ms/2}
  if(c.yFloor!=null&&lo<c.yFloor)lo=c.yFloor;
  const nt=niceTicks(lo,hi,c.ticks||4);lo=c.yFloor!=null?Math.max(nt.lo,c.yFloor):nt.lo;hi=c.yCeil!=null?Math.min(nt.hi,c.yCeil):nt.hi;
  const Y=v=>m.t+ih-(v-lo)/((hi-lo)||1)*ih;const yf=c.yFmt||fN;
  let s=`<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${esc(c.label||'chart')}">`;
  nt.t.filter(t=>t>=lo-1e-9&&t<=hi+1e-9).forEach(t=>{s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(t)}" y2="${Y(t)}" class="gl"/><text x="${m.l-7}" y="${Y(t)+4}" class="ax" text-anchor="end">${yf(t)}</text>`});
  for(let i=0;i<n;i++){const lab=c.xTick?c.xTick(i):null;if(lab){s+=`<line x1="${X(i)}" x2="${X(i)}" y1="${m.t}" y2="${m.t+ih}" class="gl gl-v"/><text x="${X(i)}" y="${H-7}" class="ax" text-anchor="middle">${lab}</text>`}}
  if(c.band){let top='',bot=[];c.band.hi.forEach((v,i)=>{const l=c.band.lo[i];if(isNum(v)&&isNum(l)){top+=(top?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);bot.unshift('L'+X(i).toFixed(1)+' '+Y(l).toFixed(1))}});
    if(top)s+=`<path d="${top}${bot.join('')}Z" fill="${c.band.color||'var(--band)'}"/>`}
  (c.refLines||[]).forEach(r=>{if(r.y<lo||r.y>hi)return;s+=`<line x1="${m.l}" x2="${W-m.r}" y1="${Y(r.y)}" y2="${Y(r.y)}" class="ref"/><text x="${W-m.r-2}" y="${Y(r.y)-4}" text-anchor="end" class="ax">${esc(r.label)}</text>`});
  if(c.bars){const bw=Math.max(1,Math.min(step*.74,c.bars.max||16));const base=Y(Math.max(lo,Math.min(0,hi)));
    c.bars.values.forEach((v,i)=>{if(!isNum(v))return;const y=Y(v);const top=Math.min(y,base),h=Math.max(v===0?0:1,Math.abs(base-y));
      s+=`<rect x="${(X(i)-bw/2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(2,bw/2)}" fill="${c.bars.color?c.bars.color(v,i):'var(--c2)'}"/>`})}
  (c.series||[]).forEach(se=>{let d='',pen=false;se.values.forEach((v,i)=>{if(!isNum(v)){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);pen=true});
    s+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.width||2}"${se.dash?` stroke-dasharray="${se.dash}"`:''}${se.opacity?` stroke-opacity="${se.opacity}"`:''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if(se.dots)se.values.forEach((v,i)=>{if(isNum(v))s+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="${se.color}" stroke="var(--panel)" stroke-width="1.5"/>`})});
  if(c.dots)c.dots.values.forEach((v,i)=>{if(!isNum(v))return;const st=c.dots.style?c.dots.style(v,i):{};s+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${st.r||3}" fill="${st.fill||'var(--c2)'}"${st.stroke?` stroke="${st.stroke}" stroke-width="${st.sw||2}"`:''}/>`});
  (c.notes||[]).forEach(nn=>{if(!isNum(nn.v))return;const x=X(nn.i),y=Y(nn.v);const anchor=x>W*0.75?'end':x<W*0.2?'start':'middle';s+=`<text x="${x}" y="${y+(nn.below?16:-9)}" text-anchor="${anchor}" class="ax" style="fill:var(--ink);font-weight:600">${esc(nn.text)}</text>`});
  if(c.nowIndex!=null&&c.nowIndex>=0&&c.nowIndex<n){const x=X(c.nowIndex);s+=`<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t+ih}" class="nowl"/><text x="${x+4}" y="${m.t+9}" class="ax nowt">Now</text>`}
  s+=`<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t+ih}" visibility="hidden"/><rect class="hit" x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent"/></svg>`;
  const shown=(c.series||[]).filter(x=>!x.quiet);
  let lg='';if(c.legend)lg=c.legend;else if(shown.length>=2)lg='<div class="legend">'+shown.map(x=>`<span><i class="${x.dash?'dash':''}" style="--c:${x.color}"></i>${esc(x.name)}</span>`).join('')+'</div>';
  el.innerHTML=lg+`<div class="chwrap">${s}<div class="tip" hidden></div></div>`;
  const svg=el.querySelector('svg'),tip=el.querySelector('.tip'),xh=svg.querySelector('.xh'),hit=svg.querySelector('.hit');
  const tipf=c.tip||(i=>{let h=`<b>${c.tipTitle?c.tipTitle(i):''}</b>`;shown.forEach(x=>{const v=x.values[i];h+=`<div class="tr"><i style="background:${x.color}"></i>${esc(x.name)}<span>${isNum(v)?(x.fmt||yf)(v):'—'}</span></div>`});if(c.tipExtra)h+=c.tipExtra(i);return h});
  const move=e=>{const r=svg.getBoundingClientRect();const k=r.width/W;const px=(e.clientX-r.left)/k;let i=Math.floor((px-m.l)/step);i=Math.max(0,Math.min(n-1,i));
    xh.setAttribute('x1',X(i));xh.setAttribute('x2',X(i));xh.setAttribute('visibility','visible');tip.innerHTML=tipf(i);tip.hidden=false;
    const left=X(i)*k;const tw=tip.offsetWidth;tip.style.left=(left+tw+14>r.width?Math.max(0,left-tw-10):left+10)+'px'};
  hit.addEventListener('pointermove',move);hit.addEventListener('pointerdown',move);
  hit.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){tip.hidden=true;xh.setAttribute('visibility','hidden')}});
}
// On touch screens a chart tip stays up after the finger lifts; the next tap anywhere else closes it.
document.addEventListener('pointerdown',e=>{$$('.chwrap').forEach(w=>{if(w.contains(e.target))return;const t=w.querySelector('.tip'),x=w.querySelector('.xh');if(t&&!t.hidden){t.hidden=true;x&&x.setAttribute('visibility','hidden')}})},{passive:true});
const tickHours=(times,every=6)=>i=>{const d=pT(times[i]);const h=d.getUTCHours();if(h%every!==0)return null;return h===0?DOW[d.getUTCDay()]:h12(h).replace(' ','').toLowerCase()};
const tipTime=times=>i=>fDow(times[i])+' '+fHour(times[i]);

/* ============ station model plot ============ */
function barb(cx,cy,r,kt,dir,L=56,stroke='var(--ink)',sw=2){
  if(kt==null||dir==null)return '';
  if(kt<2.5)return `<circle cx="${cx}" cy="${cy}" r="${r+5}" fill="none" stroke="${stroke}" stroke-width="${sw*0.75}"/>`;
  let k=Math.round(kt/5)*5;const tipY=cy-r-L;let y=tipY;const fx=L*0.3,fy=L*0.13,sp=L*0.14;
  let g=`<g transform="rotate(${dir} ${cx} ${cy})" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"><line x1="${cx}" y1="${cy-r}" x2="${cx}" y2="${tipY}"/>`;
  while(k>=50){g+=`<path d="M${cx} ${y} L${cx+fx} ${y-fy} L${cx} ${y+sp} Z" fill="${stroke}" stroke-width="${sw*0.5}"/>`;y+=sp+sp*0.5;k-=50}
  let first=true;while(k>=10){g+=`<line x1="${cx}" y1="${y}" x2="${cx+fx}" y2="${y-fy}"/>`;y+=sp;k-=10;first=false}
  if(k>=5){if(first&&y===tipY)y+=sp;g+=`<line x1="${cx}" y1="${y}" x2="${cx+fx/2}" y2="${y-fy/2}"/>`}
  return g+'</g>';
}
function stationModel(o){
  const W=240,H=200,cx=120,cy=104,r=13;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Station model plot of current conditions">`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--panel)" stroke="var(--ink)" stroke-width="2"/>`;
  const ok=o.cc==null?null:Math.round(o.cc/12.5);
  if(ok!=null&&ok>0){if(ok>=8)s+=`<circle cx="${cx}" cy="${cy}" r="${r-2.5}" fill="var(--ink)"/>`;
    else{const frac=ok<=2?.25:ok<=5?.5:.75;const a=frac*2*Math.PI;const rr=r-2.5;s+=`<path d="M${cx} ${cy} L${cx} ${cy-rr} A${rr} ${rr} 0 ${frac>.5?1:0} 1 ${(cx+Math.sin(a)*rr).toFixed(2)} ${(cy-Math.cos(a)*rr).toFixed(2)} Z" fill="var(--ink)"/>`}}
  const T=(x,y,t,col,anc,sz=24)=>`<text x="${x}" y="${y}" text-anchor="${anc}" style="font:600 ${sz}px var(--f-disp);fill:${col};stroke:var(--panel);stroke-width:5px;paint-order:stroke;stroke-linejoin:round">${esc(t)}</text>`;
  if(o.t!=null)s+=T(cx-r-12,cy-12,Math.round(U.t(o.t)),'var(--c1)','end');
  if(o.td!=null)s+=T(cx-r-12,cy+28,Math.round(U.t(o.td)),'var(--c3)','end');
  if(o.vis!=null){const v=U.dist(o.vis);s+=T(cx-r-12,cy+8,v>=10?'10+':v<1?v.toFixed(1):Math.round(v),'var(--muted)','end',15)}
  if(o.p!=null)s+=T(cx+r+12,cy-12,pad(Math.round(o.p*10)%1000).padStart(3,'0'),'var(--ink)','start');
  if(o.tend!=null){const tv=Math.round(Math.abs(o.tend)*10);const sign=o.tend>0.05?'+':o.tend<-0.05?'−':'';s+=T(cx+r+12,cy+28,sign+pad(tv),'var(--ink)','start',20);
    const x0=cx+r+56,y0=cy+22;const path=o.tend>0.05?`M${x0} ${y0+4} L${x0+12} ${y0-8}`:o.tend<-0.05?`M${x0} ${y0-8} L${x0+12} ${y0+4}`:`M${x0} ${y0-2} L${x0+12} ${y0-2}`;
    s+=`<path d="${path}" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/>`}
  s+=barb(cx,cy,r,o.kt,o.dir,56,'var(--ink)',2.2);
  s+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  return s+'</svg>';
}

/* ============ header, saved places, status ============ */
function setStatus(t){$('#status').innerHTML=t}
function locLabel(L){return [L.name,L.admin1&&L.admin1!==L.name?L.admin1:null].filter(Boolean).join(', ')}
function renderHeader(){
  const L=S.loc;$('#locName').textContent=locLabel(L)||'Unnamed spot';
  document.title='Weather Almanac · '+(L.name||'');
  const bits=[(L.country||''),`${Math.abs(L.lat).toFixed(3)}°${L.lat>=0?'N':'S'} ${Math.abs(L.lon).toFixed(3)}°${L.lon>=0?'E':'W'}`];
  if(S.fc&&isNum(S.fc.elevation))bits.push(`elev ${Math.round(U.h(S.fc.elevation)).toLocaleString()} ${U.hu()}`);
  if(S.fc&&S.fc.timezone_abbreviation)bits.push(S.fc.timezone_abbreviation);
  if(S.nws&&S.nws.cwa)bits.push(`NWS ${S.nws.cwa}`);if(S.nws&&S.nws.radarStation)bits.push(`radar ${S.nws.radarStation}`);
  $('#locMeta').textContent=bits.filter(Boolean).join(' · ');
  renderSaved();
}
function renderSaved(){
  const cur=locKey(S.loc);const isSaved=S.saved.some(x=>locKey(x)===cur);
  let h=S.saved.map((x,i)=>`<span class="chip pair${locKey(x)===cur?' on':''}"><button type="button" data-go="${i}"${locKey(x)===cur?' aria-current="true"':''}>${esc(x.name)}</button><button type="button" class="x" data-rm="${i}" aria-label="Remove ${esc(x.name)}">×</button></span>`).join('');
  h+=isSaved?'':`<button type="button" class="chip" id="saveLoc">☆ Save this place</button>`;
  $('#saved').innerHTML=h;
}
$('#saved').addEventListener('click',e=>{
  const rm=e.target.closest('[data-rm]');if(rm){S.saved.splice(+rm.dataset.rm,1);LS.set('wx:saved',S.saved);renderSaved();e.stopPropagation();return}
  const go=e.target.closest('[data-go]');if(go){setLoc(S.saved[+go.dataset.go]);return}
  if(e.target.closest('#saveLoc')){S.saved.push({...S.loc});S.saved=S.saved.slice(-8);LS.set('wx:saved',S.saved);renderSaved()}
});
function setLoc(L){S.loc=L;LS.set('wx:loc',L);NC=new Map();S.hist=null;if(window.__map){window.__map.remove();window.__map=null}loadAll();window.scrollTo({top:0,behavior:'smooth'})}
let qT,qSeq=0;
$('#q').addEventListener('input',e=>{clearTimeout(qT);const v=e.target.value.trim();const seq=++qSeq;if(v.length<2){$('#results').hidden=true;return}
  qT=setTimeout(async()=>{try{const j=await fetchJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name='+encodeURIComponent(v));
    if(seq!==qSeq)return; // a newer search has started
    const rs=j.results||[];$('#results').innerHTML=rs.length?rs.map((r,i)=>`<button type="button" data-i="${i}"><b>${esc(r.name)}</b> <span class="muted small">${esc([r.admin1,r.country].filter(Boolean).join(', '))}</span></button>`).join(''):'<div class="small muted" style="padding:8px">No matches.</div>';
    $('#results').hidden=false;$('#results').__rs=rs}catch(err){$('#results').innerHTML='<div class="small err" style="padding:8px">Search failed: '+esc(err.message)+'</div>';$('#results').hidden=false}},300)});
$('#results').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(!b)return;const r=$('#results').__rs[+b.dataset.i];
  $('#results').hidden=true;$('#q').value='';setLoc({name:r.name,admin1:r.admin1||'',country:r.country||'',cc:r.country_code||'',lat:r.latitude,lon:r.longitude})});
document.addEventListener('click',e=>{if(!e.target.closest('.search'))$('#results').hidden=true});
$('.search').addEventListener('keydown',e=>{const R=$('#results');if(R.hidden)return;const bs=$$('button',R);const i=bs.indexOf(document.activeElement);
  if(e.key==='Escape'){R.hidden=true;$('#q').focus();e.preventDefault()}
  else if(e.key==='ArrowDown'&&bs.length){bs[Math.min(bs.length-1,i+1)].focus();e.preventDefault()}
  else if(e.key==='ArrowUp'&&bs.length){if(i<=0)$('#q').focus();else bs[i-1].focus();e.preventDefault()}});
$('#geo').addEventListener('click',()=>{
  if(!navigator.geolocation){setStatus('This browser cannot share your location. Search for a place instead.');return}
  setStatus('Asking for your location…');
  navigator.geolocation.getCurrentPosition(async p=>{const lat=+p.coords.latitude.toFixed(4),lon=+p.coords.longitude.toFixed(4);let L={name:'My location',admin1:'',country:'',cc:'',lat,lon};
    try{const j=await fetchJSON(`https://api.weather.gov/points/${lat},${lon}`,8000);const rl=j.properties.relativeLocation.properties;L={...L,name:rl.city,admin1:rl.state,country:'United States',cc:'US'}}catch(e){}
    setLoc(L)},err=>setStatus('Location not available ('+esc(err.message)+'). Search for a place instead.'),{timeout:12000,maximumAge:600000});
});
$('#refresh').addEventListener('click',()=>loadAll());
document.addEventListener('click',e=>{if(e.target.closest('[data-retry]'))loadAll()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-S.lastLoad>10*60e3)loadAll()});
$$('[data-mv]').forEach(b=>b.addEventListener('click',()=>{S.mv=b.dataset.mv;$$('[data-mv]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderModels()}));

/* ============ at a glance: summary line + bike / drone ratings ============ */
// Levels: 0 go (green), 1 caution (yellow), 2 no-go (red). Overall = worst factor.
// Bike: fair-weather (green feels-like 55-85F), dark = caution. Drone: cautious limits for a 249 g DJI Mini, night allowed.
const LVC=['var(--good)','var(--warn)','var(--crit)'],LVW=['Go','Caution','No-go'];
const toF=c=>c*9/5+32,toMph=k=>k/1.609344;
const WET=c=>(c>=51&&c<=67)||(c>=80&&c<=82),SNOWY=c=>(c>=71&&c<=77)||c===85||c===86,FREEZE=c=>[56,57,66,67].includes(c);
function wxAt(c,i,cur){const H=c.H,C=c.C,g=k=>at(H[k],i),pick=k=>cur&&isNum(C[k])?C[k]:g(k);
  let rp=0;for(let j=Math.max(0,i-6);j<=i;j++)rp+=at(H.precipitation,j)||0;
  return {i,t:pick('temperature_2m'),fl:pick('apparent_temperature'),w:pick('wind_speed_10m'),gust:pick('wind_gusts_10m'),
    w120:g('wind_speed_120m'),code:pick('weather_code'),pr:pick('precipitation'),
    pp:Math.max(g('precipitation_probability')||0,at(H.precipitation_probability,i+1)||0),vis:g('visibility'),day:pick('is_day'),rp}}
const fVis=m=>{const v=U.dist(m);return (v>=10?'10+':v<1?v.toFixed(1):Math.round(v))+' '+U.du()};
function rateBike(x,aqi){const f=[],add=(n,l,t)=>f.push({n,l,t});
  if(x.fl!=null){const v=toF(x.fl);add('Temperature',v<40||v>92?2:v<55||v>85?1:0,`Feels like ${fT(x.fl)}`+(v<55?', chilly':v>85?', hot':''))}
  const c=x.code;
  if(c>=95)add('Rain',2,'Thunderstorms');else if(SNOWY(c))add('Rain',2,'Snow');else if(FREEZE(c))add('Rain',2,'Freezing rain');
  else if((x.pr||0)>=0.5||[63,65,81,82].includes(c))add('Rain',2,'Raining');else if((x.pr||0)>0||WET(c))add('Rain',1,'Light rain or drizzle');
  else if(x.pp>=60)add('Rain',1,`${x.pp}% chance within the hour`);else add('Rain',0,'Dry'+(x.pp>=20?`, ${x.pp}% chance soon`:''));
  if(x.t!=null&&toF(x.t)<=34&&x.rp>=0.2)add('Road ice',2,'Wet roads near freezing');
  if(x.w!=null){const w=toMph(x.w),g=toMph(x.gust||0);add('Wind',w>20||g>30?2:w>12||g>22?1:0,`${fW(x.w)}, gusts ${fW(x.gust)}`)}
  if(x.vis!=null&&x.vis<5000)add('Visibility',x.vis<1000?2:1,fVis(x.vis)+(c===45||c===48?' in fog':''));
  add('Light',x.day?0:1,x.day?'Daylight':'Dark: lights needed');
  if(aqi!=null)add('Air quality',aqi>150?2:aqi>100?1:0,`AQI ${Math.round(aqi)}, ${aqiCat(aqi)[0].toLowerCase()}`);
  return f}
function rateDrone(x,kp){const f=[],add=(n,l,t)=>f.push({n,l,t});
  const w120=x.w120!=null?x.w120:(x.w!=null?x.w*1.4:null);
  if(w120!=null){const v=toMph(w120);add('Wind at 400 ft',v>20?2:v>12?1:0,fW(w120)+(x.w120==null?' (estimated)':''))}
  if(x.gust!=null){const v=toMph(x.gust);add('Gusts',v>22?2:v>15?1:0,`${fW(x.gust)} near the ground`)}
  const c=x.code;
  if(c>=95)add('Rain',2,'Thunderstorms');else if((x.pr||0)>0||WET(c)||SNOWY(c)||FREEZE(c))add('Rain',2,'Precipitation. Minis aren’t waterproof');
  else if(x.pp>=50)add('Rain',1,`${x.pp}% chance within the hour`);else add('Rain',0,'Dry');
  if(x.t!=null){const v=toF(x.t);add('Temperature',v<14||v>104?2:v<32?1:0,v<14?`${fT(x.t)}, below DJI’s 14°F minimum`:v>104?`${fT(x.t)}, above DJI’s 104°F maximum`:v<32?`${fT(x.t)}, batteries drain fast; keep spares warm`:fT(x.t))}
  if(c===45||c===48)add('Visibility',2,'Fog');else if(x.vis!=null){const mi=x.vis/1609.344;add('Visibility',mi<1?2:mi<3?1:0,fVis(x.vis))}
  add('Light',0,x.day?'Daylight':'Dark: anti-collision light on');
  if(kp!=null)add('GPS (solar storms)',kp>=7?2:kp>=5?1:0,`Kp ${kp.toFixed(1)}`+(kp>=5?', geomagnetic storm; GPS may drift':', quiet'));
  return f}
const lvlOf=f=>f.reduce((m,x)=>Math.max(m,x.l),0);
function windowText(levels,times,now){
  if(now===0){let k=0;while(k+1<levels.length&&levels[k+1]===0)k++;return k>=levels.length-1?'<b>green</b> the whole time':`<b>green</b> until ${fHour(times[k+1])}`}
  const g=levels.findIndex((l,k)=>k>0&&l===0);if(g>0)return `turns <b>green</b> at ${fHour(times[g])}`;
  const b=levels.findIndex((l,k)=>k>0&&l<now);if(b>0)return `improves to <b>${LVW[levels[b]].toLowerCase()}</b> at ${fHour(times[b])}`;
  return 'no better window';}
function actCard(id,what,f,levels,times,note){
  const l=lvlOf(f);const worst=f.filter(x=>x.l===l).map(x=>x.t);
  const lead=f.find(x=>x.n==='Wind at 400 ft')||f.find(x=>x.n==='Temperature');
  const why=l===0?(id==='drone'?`Light winds aloft, ${lead?lead.t:''}`:`Good riding weather. ${lead?lead.t:''}`):worst.slice(0,2).join(' · ');
  const strip=levels.map((v,k)=>`<span style="--c:${LVC[v]}" title="${fHour(times[k])}: ${LVW[v]}"></span>`).join('');
  return `<details class="act" id="act-${id}" style="--st:${LVC[l]}"><summary>
    <span class="head"><span class="what">${what}</span><span class="verdict">${LVW[l]}</span><span class="why">${esc(why)}</span></span>
    <span class="more">Why</span>
    <span class="wrow"><span class="wbar"><span>Now</span><span class="win" aria-label="Rating for each of the next 12 hours">${strip}</span><span>${fHour(times[times.length-1])}</span></span><span class="wtxt">Next 12 h: ${windowText(levels,times,l)}</span></span>
  </summary><ul class="factors">${f.map(x=>`<li><i style="--c:${LVC[x.l]}"></i><span class="fn">${esc(x.n)}</span><span>${esc(x.t)}</span></li>`).join('')}${note?`<li style="display:block"><span class="fx">${note}</span></li>`:''}</ul></details>`;
}
// When the next rain (or snow) is likely, or when current rain should stop. Hourly: >=0.1 mm or >=50% chance counts as wet.
function rainCallout(c){
  const {H,C,ci,today}=c;const code=C.weather_code;const end=Math.min(H.time.length,ci+48);
  const when=i=>{const d=H.time[i].slice(0,10);const t=fHour(H.time[i]);return d===today?t:d===addDays(today,1)?'tomorrow '+t:fDow(H.time[i])+' '+t};
  const wetAt=i=>(at(H.precipitation,i)||0)>=0.1||(at(H.precipitation_probability,i)||0)>=50;
  const kind=i=>((at(H.snowfall,i)||0)>0||SNOWY(at(H.weather_code,i)))?'snow':'rain';
  const nowWet=(C.precipitation||0)>0||WET(code)||SNOWY(code)||FREEZE(code)||code>=95;
  if(nowWet){const k=SNOWY(code)?'Snow':'Rain';for(let i=ci+1;i<end;i++)if(!wetAt(i))return {wet:true,txt:`${k} ending around ${when(i)}`};return {wet:true,txt:`${k} continuing past ${when(end-1)}`}}
  for(let i=ci;i<end;i++)if(wetAt(i)){const pp=at(H.precipitation_probability,i);const k=kind(i);
    return {wet:false,txt:i===ci?`${k[0].toUpperCase()+k.slice(1)} possible this hour`:`Next ${k} ~${when(i)}`,pp}}
  return {wet:false,txt:'No rain expected in 48 h'};
}
function renderGlance(){
  const el=$('#glance'),ael=$('#actsBody');const c=ctx();if(!el||!c)return;
  const {C,D,H,di,ci}=c;const open=$$('.act[open]').map(d=>d.id);
  const dir=C.wind_direction_10m,to=dir==null?null:(dir+180)%360;
  const arrow=to==null?'':`<svg class="warrow" viewBox="0 0 24 24" role="img" aria-label="Blowing toward ${card(to)}"><g transform="rotate(${to.toFixed(0)} 12 12)"><path d="M12 2.5 L18.5 11 H14.2 V21.5 H9.8 V11 H5.5 Z" fill="var(--ink)"/></g></svg>`;
  const rc=rainCallout(c);
  const drop=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5C6 4.6 3.5 7.4 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.4 10 4.6 8 1.5z" fill="${rc.wet||rc.pp!=null?'var(--rain)':'var(--faint)'}"/></svg>`;
  el.innerHTML=`<div class="sum1"><span>${fT(C.temperature_2m)}${US()?'F':'C'}</span><span class="scond">${icon(C.weather_code,C.is_day)}<span>${esc(wLabel(C.weather_code))}</span></span><span class="dim">H ${fT(at(D.temperature_2m_max,di))} / L ${fT(at(D.temperature_2m_min,di))}</span></div>
    <div class="sum2"><span>Feels like <b>${fT(C.apparent_temperature)}</b></span><span>Humidity <b>${C.relative_humidity_2m!=null?Math.round(C.relative_humidity_2m)+'%':'—'}</b></span>
      <span class="wind" title="Arrow points where the wind is blowing toward. Up is north.">${arrow}<b>${fW(C.wind_speed_10m)}</b><span>from ${card(dir)}${C.wind_gusts_10m!=null?`, gusts ${Math.round(U.w(C.wind_gusts_10m))}`:''}</span></span>
      <span class="rainchip" title="Estimated from the hourly forecast">${drop}${esc(rc.txt)}${rc.pp!=null&&!rc.wet?` · ${rc.pp}%`:''}</span></div>`;
  if(!ael)return;
  const aqi=S.aq&&S.aq.current&&isNum(S.aq.current.us_aqi)?S.aq.current.us_aqi:null;const kp=isNum(S.kp)?S.kp:null;
  const idx=[];for(let i=ci;i<=Math.min(ci+12,H.time.length-1);i++)idx.push(i);const times=idx.map(i=>H.time[i]);
  const xs=idx.map((i,k)=>wxAt(c,i,k===0));
  const bf=xs.map(x=>rateBike(x,aqi)),df=xs.map(x=>rateDrone(x,kp));
  const b4u='Check airspace before every flight: <a href="https://www.faa.gov/uas/getting_started/b4ufly" target="_blank" rel="noopener">B4UFLY ↗</a>. Limits are set well under a DJI Mini’s 24 mph wind rating.'+(kp==null?' Solar storm data isn’t available right now.':'');
  ael.innerHTML=actCard('bike','Bike ride',bf[0],bf.map(lvlOf),times,'')+actCard('drone','Drone · 249 g',df[0],df.map(lvlOf),times,b4u);
  open.forEach(id=>{const d=document.getElementById(id);if(d)d.open=true});
}
async function loadKp(){
  const j=await fetchJSON('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',12000);
  const last=Array.isArray(j)&&j.length?j[j.length-1]:null;if(!last)throw new Error('no Kp data');
  const v=Array.isArray(last)?parseFloat(last[1]):isNum(last.estimated_kp)?last.estimated_kp:isNum(last.kp_index)?last.kp_index:parseFloat(last.Kp??last.kp);
  if(!isFinite(v))throw new Error('unreadable Kp');return v;
}

/* ============ sections ============ */
function fail(sel,what,e,retry=true){const el=$(sel);if(!el)return;
  if(!navigator.onLine){el.innerHTML=`<p class="muted">You're offline, so ${esc(what)} can't load right now. It will load when you reconnect.</p>`;return}
  el.innerHTML=`<p class="err">Couldn't load ${esc(what)}: ${esc(e&&e.message||e)}.</p>${retry?'<button class="btn" type="button" data-retry>Try again</button>':''}`}
function sevColor(s){return s==='Extreme'?'var(--crit)':s==='Severe'?'var(--bad)':s==='Moderate'?'var(--warn)':'var(--faint)'}
function renderAlerts(){
  const el=$('#alerts');const A=S.alerts;if(!A||!A.length){el.innerHTML='';return}
  const fmt=t=>t?new Date(t).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'}):'';
  el.innerHTML=A.map(a=>{const p=a.properties;return `<details class="alert" style="--sev:${sevColor(p.severity)}"><summary><span class="ev">${esc(p.event)}</span><span class="when">${esc(p.severity||'')} · ${fmt(p.onset||p.effective)} to ${fmt(p.ends||p.expires)} · ${esc(p.senderName||'')}</span><span class="small" style="flex-basis:100%">${esc(p.headline||'')}</span></summary>
    <pre>${esc(p.description||'')}${p.instruction?'\n\nWHAT TO DO\n'+esc(p.instruction):''}</pre><p class="note">Areas: ${esc(p.areaDesc||'')}</p></details>`}).join('');
}

function pressureTrend(c){const p=c.H.pressure_msl;const a=at(p,c.ci),b=at(p,c.ci-3);return a==null||b==null?null:a-b}
function comfort(tdC){if(tdC==null)return '';const f=tdC*9/5+32;return f<50?'Dry':f<55?'Comfortable':f<60?'Pleasant':f<65?'Sticky':f<70?'Muggy':'Oppressive'}
function uvCat(u){return u==null?'':u<3?'Low':u<6?'Moderate':u<8?'High':u<11?'Very high':'Extreme'}
function bestHour(c){
  let best=null;for(let i=c.ci+1;i<Math.min(c.ci+36,c.H.time.length);i++){if(!at(c.H.is_day,i))continue;
    const fl=at(c.H.apparent_temperature,i),pp=at(c.H.precipitation_probability,i)||0,w=at(c.H.wind_speed_10m,i)||0,code=at(c.H.weather_code,i)||0;if(fl==null)continue;
    const sc=-Math.abs(fl-21)*1.6-pp*0.35-Math.max(0,w-12)*0.6-(code>=51?25:0)-(code===3?3:0);if(!best||sc>best.sc)best={i,sc,fl,pp,w}}
  return best;
}
function renderNow(){
  const c=ctx();if(!c)return;const {C,H,D,ci,di}=c;
  const t=C.temperature_2m,code=C.weather_code,day=C.is_day;
  const td=at(H.dew_point_2m,ci),vis=at(H.visibility,ci),uv=at(H.uv_index,ci),wb=at(H.wet_bulb_temperature_2m,ci),fz=at(H.freezing_level_height,ci),sd=at(H.snow_depth,ci);
  const tend=pressureTrend(c);const hiN=S.hist?normal(mdOf(c.today),'tmax'):null,loN=S.hist?normal(mdOf(c.today),'tmin'):null;
  const hi=at(D.temperature_2m_max,di),lo=at(D.temperature_2m_min,di);
  let chips='';
  if(hiN!=null&&hi!=null){const d=hi-hiN;chips+=`<span class="tag"><i style="--c:${d>=0?'var(--c1)':'var(--c2)'}"></i>Today's high ${Math.abs(U.dt(d)).toFixed(0)}° ${d>=0?'above':'below'} normal (${fT(hiN)})</span>`}
  if(S.alerts&&S.alerts.length)chips+=`<a class="tag" href="#alerts" style="text-decoration:none;color:inherit"><i style="--c:${sevColor(S.alerts[0].properties.severity)}"></i>${S.alerts.length} active alert${S.alerts.length>1?'s':''}</a>`;
  else if(S.alerts)chips+=`<span class="tag"><i style="--c:var(--good)"></i>No active NWS alerts</span>`;
  if(S.aq&&S.aq.current&&isNum(S.aq.current.us_aqi)){const q=S.aq.current.us_aqi;chips+=`<span class="tag"><i style="--c:${aqiCat(q)[1]}"></i>AQI ${Math.round(q)} · ${aqiCat(q)[0]}</span>`}
  const rd=(k,v,s)=>`<div><dt>${k}</dt><dd>${v}${s?`<small>${s}</small>`:''}</dd></div>`;
  const pu=U.pru();const pv=C.pressure_msl!=null?U.pr(C.pressure_msl).toFixed(U.prd()):'—';
  const tendTxt=tend==null?'':(tend>1?'Rising quickly':tend>0.3?'Rising':tend<-1?'Falling quickly':tend<-0.3?'Falling':'Steady')+` · ${tend>=0?'+':'−'}${Math.abs(tend).toFixed(1)} hPa in 3 h`;
  const nextP=(()=>{for(let i=ci;i<Math.min(ci+24,H.time.length);i++){if((at(H.precipitation,i)||0)>=0.1||(at(H.precipitation_probability,i)||0)>=50)return i===ci?'Precipitation now or this hour':'Next likely precip: '+fDow(H.time[i])+' '+fHour(H.time[i])}return 'No precip expected in the next 24 h'})();
  $('#now').innerHTML=`<div class="now">
    <div>
      <div class="eyebrow">Now · as of ${C.time?fClock(C.time):''}</div>
      <div class="big num">${t==null?'—':Math.round(U.t(t))}<sup>°${US()?'F':'C'}</sup></div>
      <div class="cond">${icon(code,day)}<span>${esc(wLabel(code))}</span></div>
      <div class="nowsub">Feels like ${fT(C.apparent_temperature)} · High ${fT(hi)} / Low ${fT(lo)}</div>
      <div class="nowsub small">${esc(nextP)}</div>
      <div class="chips">${chips}</div>
    </div>
    <figure class="smfig">${stationModel({t,td,p:C.pressure_msl,tend,kt:C.wind_speed_10m==null?null:C.wind_speed_10m/1.852,dir:C.wind_direction_10m,cc:C.cloud_cover,vis})}
      <figcaption>Station model, the way forecasters plot it: temperature and dew point at left, visibility between, coded sea-level pressure and 3-hour tendency at right, wind barb in knots, and sky cover in the circle.</figcaption></figure>
    <dl class="readings">
      ${rd('Wind',`${card(C.wind_direction_10m)} ${fW(C.wind_speed_10m)}`,`Gusts ${fW(C.wind_gusts_10m)} · from ${Math.round(C.wind_direction_10m??0)}°`)}
      ${rd('Humidity',(C.relative_humidity_2m??'—')+'%',`Dew point ${fT(td)} · ${comfort(td)}`)}
      ${rd('Pressure',`${pv} ${pu}`,tendTxt)}
      ${rd('Visibility',vis==null?'—':(U.dist(vis)>=10?'10+':U.dist(vis).toFixed(1))+' '+U.du(),`Cloud cover ${C.cloud_cover??'—'}%`)}
      ${rd('UV index',uv==null?'—':uv.toFixed(1),uvCat(uv)+(at(D.uv_index_max,di)!=null?` · today's peak ${at(D.uv_index_max,di).toFixed(1)}`:''))}
      ${rd('Wet-bulb',fT(wb),'How cool sweat can get you')}
      ${rd('Precip today',fP(at(D.precipitation_sum,di)),`${at(D.precipitation_probability_max,di)??'—'}% max chance · ${at(D.precipitation_hours,di)??'—'} wet hours`)}
      ${rd('Freezing level',fz==null?'—':Math.round(U.h(fz)).toLocaleString()+' '+U.hu(),sd?`Snow on ground ${fS(sd*100)}`:'Height where air hits 32°F / 0°C')}
    </dl></div>`;
  renderGlance();
  const b=bestHour(c);$('#bestHour').innerHTML=b?`Best hour to be outside: <b>${fDow(H.time[b.i])} ${fHour(H.time[b.i])}</b> · feels ${fT(b.fl)}, ${b.pp}% rain chance, wind ${fW(b.w)}`:'';
}

function renderHourly(){
  const c=ctx();if(!c)return;const {H,ci}=c;const end=Math.min(ci+48,H.time.length);const idx=[];for(let i=ci;i<end;i++)idx.push(i);
  const strip=idx.map((i,k)=>{const d=pT(H.time[i]);const newDay=k>0&&d.getUTCHours()===0;return `<div class="hr${newDay?' day0':''}">${newDay?`<div class="dl">${DOW[d.getUTCDay()]}</div>`:`<div class="dl" style="visibility:${k===0?'visible':'hidden'}">${k===0?'Now':'·'}</div>`}<div class="t">${k===0?'':h12(d.getUTCHours())}</div>${icon(at(H.weather_code,i),at(H.is_day,i))}<div class="v">${fT(at(H.temperature_2m,i))}</div><div class="p">${(at(H.precipitation_probability,i)||0)>=10?at(H.precipitation_probability,i)+'%':''}</div></div>`}).join('');
  $('#hourlyBody').innerHTML=`<div class="strip" tabindex="0" aria-label="Hourly forecast">${strip}</div>
   <div class="cols2" style="margin-top:18px"><div class="block"><h3>Temperature</h3><div class="chart" id="chT"></div></div>
   <div class="block"><h3>Chance of precipitation</h3><div class="chart" id="chP"></div><p class="note" id="pTot"></p></div></div>`;
  const times=idx.map(i=>H.time[i]),g=k=>idx.map(i=>{const v=at(H[k],i);return v==null?null:U.t(v)});
  chart($('#chT'),{n:idx.length,label:'Temperature, feels-like and dew point, next 48 hours',series:[
    {name:'Temperature',values:g('temperature_2m'),color:'var(--c1)',width:2.5},
    {name:'Feels like',values:g('apparent_temperature'),color:'var(--c4)',dash:'5 4'},
    {name:'Dew point',values:g('dew_point_2m'),color:'var(--c3)'}],
    yFmt:v=>Math.round(v)+'°',xTick:tickHours(times),tipTitle:tipTime(times),minSpan:10,height:220});
  const pp=idx.map(i=>at(H.precipitation_probability,i));
  chart($('#chP'),{n:idx.length,label:'Hourly chance of precipitation',series:[],bars:{values:pp,color:v=>v>=60?'var(--c2)':'color-mix(in srgb,var(--c2) 55%,transparent)',max:9},
    yFloor:0,yCeil:100,extraY:[100],yFmt:v=>v+'%',xTick:tickHours(times),height:220,
    tip:i=>`<b>${tipTime(times)(i)}</b><div class="tr"><i style="background:var(--c2)"></i>Chance<span>${pp[i]??'—'}%</span></div><div class="tr"><i style="background:var(--c2)"></i>Amount<span>${fP(at(H.precipitation,idx[i]))}</span></div>${(at(H.snowfall,idx[i])||0)>0?`<div class="tr"><i style="background:var(--snow)"></i>Snow<span>${fS(at(H.snowfall,idx[i]))}</span></div>`:''}`});
  const tot=sum(idx.map(i=>at(H.precipitation,i))),sn=sum(idx.map(i=>at(H.snowfall,i)));
  $('#pTot').textContent=`Expected over 48 hours: ${fP(tot)}${sn>0.05?` including ${fS(sn)} of snow`:''}.`;
}

function renderDaily(){
  const c=ctx();if(!c)return;const {D,di}=c;const N=Math.min(16,D.time.length-di);const el=$('#dailyBody');
  $('#dailyLegend').innerHTML=`<span><i class="blk" style="--c:var(--band)"></i>Normal range ${S.hist?'(1991–2020)':'(loading…)'}</span><span><i class="blk" style="--c:linear-gradient(var(--c1),var(--c2))"></i>Forecast high–low</span>`;
  el.innerHTML='<div class="hscroll"><div id="dailySvg"></div></div><p class="note">Bars run from the forecast low to the forecast high, colored by temperature. The gray band behind each is the normal range for that date. Hover a day for details.</p>';
  const host=$('#dailySvg');
  responsive(el,()=>{
    const avail=el.clientWidth;const colW=Math.max(60,avail/N);const W=colW*N;host.style.width=W+'px';
    const rows=[];let lo=Infinity,hi=-Infinity;
    for(let k=0;k<N;k++){const i=di+k,d=D.time[i];const r={d,i,hi:at(D.temperature_2m_max,i),lo:at(D.temperature_2m_min,i),nh:S.hist?normal(mdOf(d),'tmax'):null,nl:S.hist?normal(mdOf(d),'tmin'):null};
      [r.hi,r.lo,r.nh,r.nl].forEach(v=>{if(isNum(v)){lo=Math.min(lo,v);hi=Math.max(hi,v)}});rows.push(r)}
    const top=118,bot=316,Hh=380;const Y=v=>bot-(v-lo)/((hi-lo)||1)*(bot-top);
    let s=`<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" class="ch" role="img" aria-label="16-day forecast highs and lows compared with normals">`;
    rows.forEach((r,k)=>{const x=k*colW,cx=x+colW/2;const i=r.i;
      if(k===0)s+=`<rect x="${x+1}" y="0" width="${colW-2}" height="${Hh}" rx="6" fill="var(--panel2)"/>`;
      if(k>0&&pT(r.d).getUTCDay()===0)s+=`<line x1="${x}" x2="${x}" y1="4" y2="${Hh-4}" class="gl"/>`;
      s+=`<text x="${cx}" y="18" text-anchor="middle" style="font:600 15px var(--f-disp);letter-spacing:.06em;fill:var(--ink)">${k===0?'TODAY':fDow(r.d).toUpperCase()}</text><text x="${cx}" y="34" text-anchor="middle" class="ax">${fMD(r.d)}</text>`;
      s+=`<g transform="translate(${cx-17} 40) scale(.53)">${icon(at(D.weather_code,i),1).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</g>`;
      const pp=at(D.precipitation_probability_max,i);s+=`<text x="${cx}" y="94" text-anchor="middle" class="ax" style="fill:${(pp||0)>=40?'var(--rain)':'var(--faint)'}">${pp==null?'':pp+'%'}</text>`;
      if(isNum(r.nh)&&isNum(r.nl))s+=`<rect x="${cx-colW*0.3}" y="${Y(r.nh)}" width="${colW*0.6}" height="${Math.max(2,Y(r.nl)-Y(r.nh))}" rx="3" fill="var(--band)"/>`;
      if(isNum(r.hi)&&isNum(r.lo)){const gid='g'+k;s+=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tColor(r.hi)}"/><stop offset="1" stop-color="${tColor(r.lo)}"/></linearGradient></defs>`;
        s+=`<rect x="${cx-5}" y="${Y(r.hi)}" width="10" height="${Math.max(4,Y(r.lo)-Y(r.hi))}" rx="5" fill="url(#${gid})"/>`;
        s+=`<text x="${cx}" y="${Y(r.hi)-8}" text-anchor="middle" style="font:600 17px var(--f-disp);fill:var(--ink)">${fT(r.hi)}</text><text x="${cx}" y="${Y(r.lo)+19}" text-anchor="middle" style="font:500 15px var(--f-disp);fill:var(--muted)">${fT(r.lo)}</text>`}
      const pr=at(D.precipitation_sum,i),sn=at(D.snowfall_sum,i);
      s+=`<text x="${cx}" y="${bot+46}" text-anchor="middle" class="ax" style="fill:${(pr||0)>=0.25?'var(--rain)':'var(--faint)'}">${(pr||0)>=0.25?U.p(pr).toFixed(U.pd()):'—'}</text>`;
      if((sn||0)>=0.1)s+=`<text x="${cx}" y="${bot+60}" text-anchor="middle" class="ax" style="fill:var(--snow)">${U.sn(sn).toFixed(1)}${U.su()} ❄</text>`;
      s+=`<text x="${cx}" y="${Hh-4}" text-anchor="middle" class="ax">${card(at(D.wind_direction_10m_dominant,i))} ${Math.round(U.w(at(D.wind_gusts_10m_max,i))??0)}</text>`;
      const an=isNum(r.hi)&&isNum(r.nh)?r.hi-r.nh:null;
      s+=`<rect x="${x}" y="0" width="${colW}" height="${Hh}" fill="transparent"><title>${fDow(r.d)} ${fMD(r.d)} — ${wLabel(at(D.weather_code,i))}\nHigh ${fT(r.hi)} / Low ${fT(r.lo)}${an!=null?`\nNormal ${fT(r.nh)} / ${fT(r.nl)} (high ${fDT(an)})`:''}\nPrecip ${fP(pr)} · ${pp??'—'}% chance\nGusts to ${fW(at(D.wind_gusts_10m_max,i))}\nUV ${at(D.uv_index_max,i)??'—'} · Sunshine ${fN((at(D.sunshine_duration,i)||0)/3600)} h</title></rect>`;
    });
    s+='</svg>';
    host.innerHTML=s;
  });
  el.insertAdjacentHTML('beforeend',`<p class="note">Bottom rows: precipitation (${U.pu()}) and dominant wind direction with peak gust (${U.wu()}).</p>`);
}

function renderHistory(){
  const el=$('#histBody');
  if(S.histErr&&!S.hist){fail('#histBody','the climate record',S.histErr);return}
  if(!S.hist){return}
  const today=todayStr(),md=mdOf(today),Y=+today.slice(0,4),c=ctx();
  $('#histTitle').textContent='On '+fMDL(today);$('#histNote').textContent=S.histMsg||`ERA5 daily record, ${S.hist.start.slice(0,4)}–${Y-1}`;
  const yrV=(y,k)=>val(mdDate(y,md),k);const avg=(k,y0,y1)=>mean(yearsWith(md,k,y0,y1).map(x=>x.v));
  const all=k=>yearsWith(md,k,+S.hist.start.slice(0,4),Y-1);
  const rec=(k,f)=>{const a=all(k);if(!a.length)return null;return a.reduce((b,x)=>f(x.v,b.v)?x:b)};
  const fc=c?{hi:at(c.D.temperature_2m_max,c.di),lo:at(c.D.temperature_2m_min,c.di),p:at(c.D.precipitation_sum,c.di)}:null;
  const row=(lab,hi,lo,p,cls='')=>`<tr class="${cls}"><td>${lab}</td><td>${hi}</td><td>${lo}</td><td>${p}</td></tr>`;
  const cell=(v,f=fT)=>v==null?'—':f(v);
  const rH=rec('tmax',(a,b)=>a>b),rL=rec('tmin',(a,b)=>a<b),rP=rec('prcp',(a,b)=>a>b),rLH=rec('tmax',(a,b)=>a<b),rHL=rec('tmin',(a,b)=>a>b),rS=rec('snow',(a,b)=>a>b);
  const pr=all('prcp');const wetPct=pr.length?Math.round(pr.filter(x=>x.v>=0.25).length/pr.length*100):null;
  const recCell=(r,f=fT)=>r?`${f(r.v)}<span class="yr">${r.y}</span>`:'—';
  let table=`<table><thead><tr><th>${fMD(today)}</th><th>High</th><th>Low</th><th>Precip</th></tr></thead><tbody>
    ${fc?row('This year (forecast)',cell(fc.hi),cell(fc.lo),cell(fc.p,fP),'hl'):''}
    ${row(`Last year (${Y-1})`,cell(yrV(Y-1,'tmax')),cell(yrV(Y-1,'tmin')),cell(yrV(Y-1,'prcp'),fP))}
    ${row(`2 years ago (${Y-2})`,cell(yrV(Y-2,'tmax')),cell(yrV(Y-2,'tmin')),cell(yrV(Y-2,'prcp'),fP))}
    ${row(`5-year average`,cell(avg('tmax',Y-5,Y-1)),cell(avg('tmin',Y-5,Y-1)),cell(avg('prcp',Y-5,Y-1),fP))}
    ${row(`10-year average`,cell(avg('tmax',Y-10,Y-1)),cell(avg('tmin',Y-10,Y-1)),cell(avg('prcp',Y-10,Y-1),fP))}
    ${row(`30-year normal (1991–2020)`,cell(normal(md,'tmax')),cell(normal(md,'tmin')),cell(avg('prcp',1991,2020),fP),'hl')}
    ${row(`Record since ${S.hist.start.slice(0,4)}`,recCell(rH),recCell(rL),recCell(rP,fP))}
  </tbody></table>`;
  const facts=`<div class="stat" style="margin-top:14px">
    <div><div class="k">Coldest high</div><div class="v">${rLH?fT(rLH.v):'—'}</div><div class="s">${rLH?rLH.y:''}</div></div>
    <div><div class="k">Warmest low</div><div class="v">${rHL?fT(rHL.v):'—'}</div><div class="s">${rHL?rHL.y:''}</div></div>
    <div><div class="k">Wet on this date</div><div class="v">${wetPct??'—'}%</div><div class="s">of years had ≥ 0.01 in</div></div>
    <div><div class="k">Biggest snow</div><div class="v">${rS&&rS.v>0?fS(rS.v):'None'}</div><div class="s">${rS&&rS.v>0?rS.y:'on record'}</div></div></div>`;
  el.innerHTML=`<div class="cols2"><div class="block"><div class="hscroll">${table}</div>${facts}</div>
     <div class="block"><div class="ph" style="margin-bottom:4px"><h3 style="margin:0">${fMD(today)} through the years</h3><div class="seg sm" role="group" aria-label="Variable"><button type="button" data-hk="tmax" aria-pressed="${(S.hk||'tmax')==='tmax'}">Highs</button><button type="button" data-hk="tmin" aria-pressed="${S.hk==='tmin'}">Lows</button></div></div><div class="chart" id="chYears"></div><p class="note" id="trendNote"></p></div></div>
   <div class="cols2" style="margin-top:26px"><div class="block"><h3>Last 30 days vs. normal</h3><div class="chart" id="chAnom"></div><p class="note" id="anomNote"></p></div>
     <div class="block"><h3>Precipitation so far this year</h3><div class="chart" id="chYTD"></div><p class="note" id="ytdNote" hidden></p><div class="stat" id="ptot"></div></div></div>
   <div style="margin-top:26px"><h3>Precipitation, last 45 days</h3><div class="cols2"><div class="block"><div class="eyebrow" style="margin-bottom:6px">Running total vs. normal</div><div class="chart" id="ch45c"></div></div><div class="block"><div class="eyebrow" style="margin-bottom:6px">Each day, plus the 7-day forecast</div><div class="chart" id="ch45d"></div></div></div><div class="stat" id="p45" style="margin-top:12px"></div></div>
   <div style="margin-top:26px"><h3>Season watch</h3><div class="stat" id="season"></div></div>`;
  $$('[data-hk]',el).forEach(b=>b.addEventListener('click',()=>{S.hk=b.dataset.hk;renderHistory()}));
  // through the years
  const hk=S.hk||'tmax';const ys=all(hk);const yrs=ys.map(x=>x.y),vals=ys.map(x=>U.t(x.v));
  const fcV=fc?(hk==='tmax'?fc.hi:fc.lo):null;if(fcV!=null){yrs.push(Y);vals.push(U.t(fcV))}
  const n=ys.length;let sx=0,sy=0,sxx=0,sxy=0;ys.forEach(x=>{const v=U.t(x.v);sx+=x.y;sy+=v;sxx+=x.y*x.y;sxy+=x.y*v});
  const slope=n>2?(n*sxy-sx*sy)/(n*sxx-sx*sx):0,icp=(sy-slope*sx)/n;
  const recY=(hk==='tmax'?rH:rL);const recLowY=(hk==='tmax'?rLH:rHL);
  const roll=yrs.map((y,i)=>{if(y===Y)return null;const w=ys.filter(x=>x.y>y-10&&x.y<=y);return w.length>=8?U.t(mean(w.map(x=>x.v))):null});
  chart($('#chYears'),{n:yrs.length,label:`${hk==='tmax'?'High':'Low'} temperature on ${fMD(today)} each year`,
    series:[{name:'10-year running mean',values:roll,color:'var(--ink)',width:2},{name:'Linear trend',values:yrs.map(y=>y===Y?null:icp+slope*y),color:'var(--faint)',dash:'4 4',width:1.5}],
    dots:{values:vals,style:(v,i)=>yrs[i]===Y?{r:6,fill:'var(--panel)',stroke:'var(--accent)',sw:2.5}:yrs[i]===(recY&&recY.y)||yrs[i]===(recLowY&&recLowY.y)?{r:5,fill:'var(--accent)'}:yrs[i]>=Y-2?{r:4.5,fill:'var(--c1)'}:{r:3,fill:'color-mix(in srgb,var(--c2) 70%,transparent)'}},
    legend:`<div class="legend"><span><i class="blk" style="--c:color-mix(in srgb,var(--c2) 70%,transparent);border-radius:50%"></i>Each year</span><span><i class="blk" style="--c:var(--c1);border-radius:50%"></i>Last 2 years</span><span><i class="blk" style="--c:var(--accent);border-radius:50%"></i>Record</span>${fcV!=null?`<span><i class="blk" style="--c:var(--panel);border:2px solid var(--accent);border-radius:50%"></i>${Y} forecast</span>`:''}<span><i style="--c:var(--ink)"></i>10-yr mean</span><span><i class="dash" style="--c:var(--faint)"></i>Trend</span></div>`,
    yFmt:v=>Math.round(v)+'°',xTick:i=>yrs[i]%20===0?String(yrs[i]):null,minSpan:10,height:240,
    notes:[recY?{i:yrs.indexOf(recY.y),v:U.t(recY.v),text:Math.round(U.t(recY.v))+'° in '+recY.y,below:hk!=='tmax'}:null].filter(Boolean),
    tip:i=>`<b>${yrs[i]}${yrs[i]===Y?' (forecast)':''}</b><div class="tr"><i style="background:var(--c2)"></i>${hk==='tmax'?'High':'Low'}<span>${Math.round(vals[i])}°</span></div>${roll[i]!=null?`<div class="tr"><i style="background:var(--ink)"></i>10-yr mean<span>${roll[i].toFixed(1)}°</span></div>`:''}`});
  $('#trendNote').textContent=n>10?`Trend: ${slope>=0?'+':'−'}${Math.abs(slope*10).toFixed(2)}° per decade for this date's ${hk==='tmax'?'high':'low'} since ${ys[0].y}. One calendar day is noisy, so treat the trend as a curiosity.`:'';
  // anomalies, last 30 days
  const days=[];for(let k=30;k>=1;k--)days.push(addDays(today,-k));
  const an=days.map(d=>{const m=tmean(d),nm=normal(mdOf(d),'tmean');return m==null||nm==null?null:U.dt(m-nm)});
  chart($('#chAnom'),{n:days.length,label:'Daily mean temperature departure from normal, last 30 days',series:[],
    bars:{values:an,color:v=>v>=0?'var(--c1)':'var(--c2)',max:14},yFmt:v=>(v>0?'+':'')+Math.round(v)+'°',minSpan:6,height:200,
    xTick:i=>(days.length-1-i)%7===0?fMD(days[i]):null,
    tip:i=>{const d=days[i];return `<b>${fDow(d)} ${fMD(d)}</b><div class="tr"><i style="background:${(an[i]||0)>=0?'var(--c1)':'var(--c2)'}"></i>Departure<span>${an[i]==null?'—':(an[i]>=0?'+':'')+an[i].toFixed(1)+'°'}</span></div><div class="tr"><i style="background:var(--faint)"></i>High / low<span>${fT(hv(d,'tmax'))} / ${fT(hv(d,'tmin'))}</span></div><div class="tr"><i style="background:var(--rain)"></i>Precip<span>${fP(hv(d,'prcp'))}</span></div>`}});
  const anV=an.filter(isNum);$('#anomNote').textContent=anV.length?`Average departure ${mean(anV)>=0?'+':'−'}${Math.abs(mean(anV)).toFixed(1)}° · ${anV.filter(v=>v>0).length} of ${anV.length} days warmer than normal.`:'';
  // YTD precip
  const y0=Y+'-01-01',yd=addDays(today,-1);const nd=Math.max(1,dayDiff(y0,yd)+1);
  const act=[],nrm=[];let ca=0;const nAcc=new Array(nd).fill(0);let ny=0;
  for(let y=1991;y<=2020;y++){let cs=0,ok=true;const row=[];for(let j=0;j<nd;j++){const v=hv(addDays(y+'-01-01',j),'prcp');if(v==null){ok=false;break}cs+=v;row.push(cs)}if(ok){ny++;row.forEach((v,j)=>nAcc[j]+=v)}}
  const missing=[];
  for(let j=0;j<nd;j++){const dd=addDays(y0,j);const v=hv(dd,'prcp');if(v==null){missing.push(dd);act.push(null)}else{ca+=v;act.push(U.p(ca))}nrm.push(ny?U.p(nAcc[j]/ny):null)}
  const ytdDates=[];for(let j=0;j<nd;j++)ytdDates.push(addDays(y0,j));
  chart($('#chYTD'),{n:nd,label:'Cumulative precipitation this year vs normal',series:[{name:`${Y}`,values:act,color:'var(--c2)',width:2.5},{name:'Normal (1991–2020)',values:nrm,color:'var(--faint)',dash:'5 4'}],
    yFloor:0,yFmt:v=>v.toFixed(US()?1:0),xTick:i=>{const d=pT(ytdDates[i]);return d.getUTCDate()===1&&d.getUTCMonth()%2===0?MON[d.getUTCMonth()]:null},height:200,tipTitle:i=>fMD(ytdDates[i])});
  const mStart=today.slice(0,8)+'01';const mtd=cumBetween(mStart,yd,'prcp').s;
  const mtdN=mean(Array.from({length:30},(_,k)=>{const y=1991+k;return cumBetween(y+'-'+mStart.slice(5),mdDate(y,mdOf(yd)),'prcp').s}));
  const ytdN=ny?nAcc[nd-1]/ny:null;const pct=(a,b)=>b?Math.round(a/b*100)+'% of normal':'';
  const spans=[];missing.forEach(d=>{const l=spans[spans.length-1];if(l&&addDays(l[1],1)===d)l[1]=d;else spans.push([d,d])});
  const spanTxt=spans.slice(0,3).map(([a,b])=>a===b?fMD(a):fMD(a)+'–'+fMD(b)).join(', ')+(spans.length>3?' and more':'');
  const ytdEl=$('#ytdNote');if(missing.length){ytdEl.hidden=false;ytdEl.textContent=(S.recentPending?'Still loading this year\'s daily record':S.recentErr?"This year's daily record didn't load ("+S.recentErr.message+")":'Some days are missing from the record')+`: no data yet for ${spanTxt}. The line breaks where days are missing, so the total below is incomplete.`}else ytdEl.hidden=true;
  $('#ptot').innerHTML=`<div><div class="k">Year to date</div><div class="v">${fP(ca)}</div><div class="s">${missing.length?`Incomplete, ${missing.length} days missing · normal ${fP(ytdN)}`:`${pct(ca,ytdN)} (${fP(ytdN)})`}</div></div>
    <div><div class="k">${MONL[+today.slice(5,7)-1]} so far</div><div class="v">${fP(today.slice(8)==='01'?0:mtd)}</div><div class="s">${today.slice(8)==='01'?'Month just started':pct(mtd,mtdN)+` (${fP(mtdN)})`}</div></div>`;
  // last 45 days up close, plus the next 7 forecast days
  {
    const N=45,days=[];for(let k=N;k>=1;k--)days.push(addDays(today,-k));
    const daily=days.map(d=>hv(d,'prcp'));
    // normal: average of the same 45-day window in each year 1991-2020 (cumulative + wet-day count)
    const nAcc=new Array(N).fill(0);let ny=0,wetN=0;
    for(let y=1991;y<=2020;y++){const base=mdDate(y,md);let cs=0,wd=0,ok=true;const row=[];
      for(let k=0;k<N;k++){const v=hv(addDays(base,k-N),'prcp');if(v==null){ok=false;break}cs+=v;if(v>=0.25)wd++;row.push(cs)}
      if(ok){ny++;wetN+=wd;row.forEach((v,k)=>nAcc[k]+=v)}}
    const miss=[];let tot=0;const cumA=daily.map((v,k)=>{if(v==null){miss.push(days[k]);return null}tot+=v;return U.p(tot)});
    const cumN=nAcc.map(v=>ny?U.p(v/ny):null);const totN=ny?nAcc[N-1]/ny:null;
    const fD=[],fV=[];if(c)for(let k=0;k<7&&c.di+k<c.D.time.length;k++){fD.push(c.D.time[c.di+k]);fV.push(at(c.D.precipitation_sum,c.di+k))}
    const allD=days.concat(fD),allV=daily.concat(fV).map(v=>v==null?null:U.p(v));
    const tk=(n,el)=>i=>{const st=el.clientWidth<520?14:7;return i<N&&(N-i)%st===0?fMD(allD[i]):(i===n-1&&i>N&&st===7?fMD(allD[i]):null)};
    chart($('#ch45c'),{n:N,label:'Cumulative precipitation over the last 45 days vs normal',
      series:[{name:'Last 45 days',values:cumA,color:'var(--c2)',width:2.5},{name:'Normal (1991–2020)',values:cumN,color:'var(--faint)',dash:'5 4'}],
      yFloor:0,yFmt:v=>v.toFixed(US()?1:0),xTick:tk(N,$('#ch45c')),tipTitle:i=>fDow(days[i])+' '+fMD(days[i]),height:190,minSpan:US()?0.5:10});
    chart($('#ch45d'),{n:allD.length,label:'Daily precipitation, last 45 days and next 7 forecast days',series:[],nowIndex:N,
      bars:{values:allV,color:(v,i)=>i>=N?'color-mix(in srgb,var(--c2) 38%,transparent)':'var(--c2)',max:10},
      legend:'<div class="legend"><span><i class="blk" style="--c:var(--c2)"></i>Measured</span><span><i class="blk" style="--c:color-mix(in srgb,var(--c2) 38%,transparent)"></i>Forecast</span></div>',
      yFloor:0,yFmt:v=>v.toFixed(US()?1:0),xTick:tk(allD.length,$('#ch45d')),height:170,minSpan:US()?0.4:10,
      tip:i=>{const d=allD[i];const nm=normal(mdOf(d),'prcp');return `<b>${fDow(d)} ${fMD(d)}${i>=N?' (forecast)':''}</b><div class="tr"><i style="background:var(--c2)"></i>${i>=N?'Forecast':'Measured'}<span>${allV[i]==null?'—':allV[i].toFixed(U.pd())+' '+U.pu()}</span></div><div class="tr"><i style="background:var(--faint)"></i>Normal for the date<span>${fP(nm)}</span></div>`}});
    const wet=daily.filter(v=>v!=null&&v>=0.25).length;const big=daily.reduce((b,v,k)=>v!=null&&(b==null||v>daily[b])?k:b,null);
    const last7=sum(daily.slice(-7)),next7=sum(fV);
    $('#p45').innerHTML=`<div><div class="k">45-day total</div><div class="v">${fP(tot)}</div><div class="s">${miss.length?`Incomplete, ${miss.length} days missing`:pct(tot,totN)} · normal ${fP(totN)}</div></div>
      <div><div class="k">Wet days</div><div class="v">${wet}</div><div class="s">of 45 · normal about ${ny?Math.round(wetN/ny):'—'}</div></div>
      <div><div class="k">Wettest day</div><div class="v">${big!=null&&daily[big]>0?fP(daily[big]):'None'}</div><div class="s">${big!=null&&daily[big]>0?fDow(days[big])+' '+fMD(days[big]):'No measurable rain'}</div></div>
      <div><div class="k">Last 7 days</div><div class="v">${fP(last7)}</div><div class="s">Next 7 forecast: ${fP(next7)}</div></div>`;
  }
  // season watch: freeze climatology, dry streak, snow season
  const fallYear=+today.slice(5,7)>=7?Y:Y-1;
  const freezeDays=[];const springDays=[];
  for(let y=1991;y<=2020;y++){let f=null;for(let j=0;j<184;j++){const d=addDays(y+'-07-01',j);const v=hv(d,'tmin');if(v!=null&&v<=0){f=j;break}}if(f!=null)freezeDays.push(f);
    let s=null;for(let j=0;j<182;j++){const d=addDays(y+'-01-01',j);const v=hv(d,'tmin');if(v!=null&&v<=0)s=j}if(s!=null)springDays.push(s)}
  const med=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:null};
  let firstThis=null;for(let d=fallYear+'-07-01';d<today;d=addDays(d,1)){const v=hv(d,'tmin');if(v!=null&&v<=0){firstThis=d;break}}
  let fcFreeze=null;if(c&&!firstThis){for(let i=c.di;i<c.D.time.length;i++){const v=at(c.D.temperature_2m_min,i);if(v!=null&&v<=0){fcFreeze={d:c.D.time[i],v};break}}}
  let dry=0;for(let d=yd;d>=y0;d=addDays(d,-1)){const v=hv(d,'prcp');if(v==null)break;if(v>=0.25)break;dry++}
  let longest=0,run=0;for(let j=0;j<nd;j++){const v=hv(addDays(y0,j),'prcp');if(v!=null&&v<0.25){run++;longest=Math.max(longest,run)}else run=0}
  let streak=0,sgn=0;for(let k=0;k<an.length;k++){const v=an[an.length-1-k];if(v==null)break;const s=v>=0?1:-1;if(sgn===0)sgn=s;if(s!==sgn)break;streak++}
  const sStart=fallYear+'-07-01';const snowSoFar=cumBetween(sStart,yd,'snow').s;
  const snowN=mean(Array.from({length:30},(_,k)=>{const y=1991+k;return cumBetween(y+'-07-01',mdDate(y+(fallYear===Y?0:1),mdOf(yd)),'snow').s}));
  const snowFull=mean(Array.from({length:30},(_,k)=>{const y=1991+k;return cumBetween(y+'-07-01',(y+1)+'-06-30','snow').s}));
  const fd=n=>n==null?'—':fMD(addDays(fallYear+'-07-01',n));
  let h='';
  if(freezeDays.length>=15){h+=`<div><div class="k">First fall freeze</div><div class="v">${firstThis?fMD(firstThis):fcFreeze?'Forecast '+fDow(fcFreeze.d):'Not yet'}</div><div class="s">${firstThis?'Already happened this season':fcFreeze?`${fMD(fcFreeze.d)}, low ${fT(fcFreeze.v)}`:'None in the 16-day forecast'} · typical date ${fd(med(freezeDays))}</div></div>`;
    if(springDays.length>=15)h+=`<div><div class="k">Typical last spring freeze</div><div class="v">${fMD(addDays(Y+'-01-01',med(springDays)))}</div><div class="s">Growing season about ${med(freezeDays)+184-med(springDays)} days</div></div>`}
  h+=`<div><div class="k">Days since measurable precip</div><div class="v">${dry}</div><div class="s">Longest dry spell this year: ${longest} days</div></div>`;
  if(streak>0)h+=`<div><div class="k">${sgn>0?'Warm':'Cool'} streak</div><div class="v">${streak} day${streak>1?'s':''}</div><div class="s">in a row ${sgn>0?'above':'below'} normal</div></div>`;
  if(snowFull&&snowFull>2)h+=`<div><div class="k">Snow this season</div><div class="v">${fS(snowSoFar)}</div><div class="s">Normal to date ${fS(snowN)} · full season ${fS(snowFull)}</div></div>`;
  $('#season').innerHTML=h;
}

function renderAtmos(){
  const c=ctx();if(!c)return;const {H,ci}=c;const el=$('#atmosBody');
  el.innerHTML=`<div class="cols2">
    <div class="block"><h3>Pressure trend</h3><div class="chart" id="chPr"></div><p class="note">Last 2 days and next 7. Falling pressure usually means an approaching storm; rising means clearing.</p></div>
    <div class="block"><h3>Wind &amp; gusts</h3><div class="chart" id="chW"></div><div class="eyebrow" style="margin-top:6px">Wind barbs every 3 hours (knots)</div><div id="barbs"></div></div>
    <div class="block"><h3>Cloud layers</h3><div id="clouds"></div><p class="note">Stronger shading means more of the sky covered at that level. Low is below about 6,500 ft, mid up to about 20,000 ft, high above that.</p></div>
    <div class="block"><h3>Thunderstorm fuel (CAPE)</h3><div class="chart" id="chCape"></div><p class="note" id="capeNote"></p></div>
    <div class="block"><h3>Freezing level</h3><div class="chart" id="chFz"></div><p class="note" id="fzNote"></p></div>
    <div class="block"><h3>Winds aloft right now</h3><div id="aloft"></div></div></div>`;
  const a=Math.max(0,ci-48),b=Math.min(H.time.length,ci+24*7);const ix=[];for(let i=a;i<b;i++)ix.push(i);const t=ix.map(i=>H.time[i]);
  chart($('#chPr'),{n:ix.length,label:'Sea-level pressure',series:[{name:'Pressure',values:ix.map(i=>{const v=at(H.pressure_msl,i);return v==null?null:U.pr(v)}),color:'var(--c4)',width:2,fmt:v=>v.toFixed(U.prd()+(US()?0:1))+' '+U.pru()}],
    nowIndex:ci-a,yFmt:v=>v.toFixed(US()?2:0),ml:US()?50:46,xTick:i=>{const d=pT(t[i]);return d.getUTCHours()===0&&d.getUTCDay()%2===0?DOW[d.getUTCDay()]:null},tipTitle:tipTime(t),minSpan:US()?0.2:6,height:200});
  const n48=[];for(let i=ci;i<Math.min(ci+48,H.time.length);i++)n48.push(i);const t48=n48.map(i=>H.time[i]);
  chart($('#chW'),{n:n48.length,label:'Wind speed and gusts',series:[{name:'Sustained',values:n48.map(i=>U.w(at(H.wind_speed_10m,i))),color:'var(--c2)',width:2},{name:'Gusts',values:n48.map(i=>U.w(at(H.wind_gusts_10m,i))),color:'var(--c1)',dash:'5 4'}],
    yFloor:0,yFmt:v=>Math.round(v)+'',xTick:tickHours(t48),tipTitle:tipTime(t48),minSpan:10,height:180,
    tipExtra:i=>`<div class="tr"><i style="background:var(--faint)"></i>From<span>${card(at(H.wind_direction_10m,n48[i]))} ${Math.round(at(H.wind_direction_10m,n48[i])??0)}°</span></div>`});
  responsive($('#barbs'),()=>{const host=$('#barbs');const W=Math.max(300,host.parentElement.clientWidth);const step=(W-44-14)/n48.length;let s=`<svg viewBox="0 0 ${W} 92" class="ch" aria-label="Wind barbs every 3 hours">`;
    n48.forEach((i,k)=>{if(k%3)return;const x=44+(k+.5)*step;const kt=at(H.wind_speed_10m,i)==null?null:at(H.wind_speed_10m,i)/1.852;s+=`<circle cx="${x}" cy="50" r="2.5" fill="var(--ink)"/>`+barb(x,50,2.5,kt,at(H.wind_direction_10m,i),26,'var(--ink)',1.5)});
    s+=`</svg>`;host.innerHTML=s});
  // cloud layers heat strip
  responsive($('#clouds'),()=>{const host=$('#clouds');const W=Math.max(300,host.clientWidth);const L=44,step=(W-L-14)/n48.length;const rows=[['High','cloud_cover_high'],['Mid','cloud_cover_mid'],['Low','cloud_cover_low']];
    let s=`<svg viewBox="0 0 ${W} 120" class="ch" role="img" aria-label="Cloud cover by layer, next 48 hours">`;
    rows.forEach(([lab,k],r)=>{const y=6+r*30;s+=`<text x="${L-7}" y="${y+18}" text-anchor="end" class="ax">${lab}</text>`;
      n48.forEach((i,j)=>{const v=at(H[k],i);s+=`<rect x="${(L+j*step).toFixed(1)}" y="${y}" width="${Math.max(1,step-1).toFixed(1)}" height="26" fill="var(--ink)" fill-opacity="${v==null?0:(0.04+v/100*0.8).toFixed(2)}"><title>${lab} clouds ${fDow(t48[j])} ${fHour(t48[j])}: ${v??'—'}%</title></rect>`})});
    n48.forEach((i,j)=>{const lab=tickHours(t48)(j);if(lab)s+=`<text x="${L+(j+.5)*step}" y="114" text-anchor="middle" class="ax">${lab}</text>`});host.innerHTML=s+'</svg>'});
  const cape=n48.map(i=>at(H.cape,i));
  chart($('#chCape'),{n:n48.length,label:'Convective available potential energy',series:[{name:'CAPE',values:cape,color:'var(--c1)',width:2,fmt:v=>Math.round(v)+' J/kg'}],yFloor:0,minSpan:500,
    refLines:[{y:1000,label:'Moderate'},{y:2500,label:'Strong'}],yFmt:v=>Math.round(v)+'',xTick:tickHours(t48),tipTitle:tipTime(t48),height:180,
    tipExtra:i=>`<div class="tr"><i style="background:var(--faint)"></i>Lifted index<span>${fN(at(H.lifted_index,n48[i]))}</span></div>`});
  const mc=Math.max(...cape.filter(isNum),0),mi=cape.indexOf(mc);const li=n48.map(i=>at(H.lifted_index,i)).filter(isNum);
  $('#capeNote').textContent=(mc>0?`Peak ${Math.round(mc).toLocaleString()} J/kg ${fDow(t48[mi])} ${fHour(t48[mi])}. `:'')+(li.length?`Lowest lifted index ${Math.min(...li).toFixed(1)} (below −3 favors storms). `:'')+(mc<300?'Not much storm fuel right now.':'');
  chart($('#chFz'),{n:n48.length,label:'Freezing level height',series:[{name:'Freezing level',values:n48.map(i=>U.h(at(H.freezing_level_height,i))),color:'var(--c2)',width:2,fmt:v=>Math.round(v).toLocaleString()+' '+U.hu()}],
    yFloor:0,yFmt:v=>v>=1000?(v/1000)+'k':Math.round(v)+'',xTick:tickHours(t48),tipTitle:tipTime(t48),minSpan:US()?2000:600,height:180});
  const sn7=sum(H.snowfall?H.snowfall.slice(ci,ci+168):[]);$('#fzNote').textContent=`Snow in the next 7 days: ${sn7>0.05?fS(sn7):'none expected'}. When the freezing level drops near the ground, precipitation can fall as snow.`;
  const lv=[['10 m (33 ft)','wind_speed_10m'],['80 m (260 ft)','wind_speed_80m'],['120 m (390 ft)','wind_speed_120m'],['180 m (590 ft)','wind_speed_180m']];
  $('#aloft').innerHTML=`<table><thead><tr><th>Height</th><th>Speed</th></tr></thead><tbody>${lv.map(([l,k])=>`<tr><td>${l}</td><td>${fW(at(H[k],ci))}</td></tr>`).join('')}</tbody></table><p class="note">Speed usually climbs with height. A big jump between levels means strong wind shear. Wet-bulb now: ${fT(at(H.wet_bulb_temperature_2m,ci))}.</p>`;
}

function renderModels(){
  const el=$('#modelsBody');const M=S.models;if(!M)return;if(M.error){fail('#modelsBody','model runs',M.error);return}
  const d=M.daily;const days=d.time;const k=S.mv;const base=k==='tmax'?'temperature_2m_max':k==='tmin'?'temperature_2m_min':'precipitation_sum';
  const conv=v=>v==null?null:(k==='prcp'?U.p(v):U.t(v));
  const series=MODELS.map(([id,name,color])=>({name,color,values:(d[base+'_'+id]||[]).map(v=>isNum(v)?conv(v):null),dots:true,width:2})).filter(s=>s.values.some(isNum));
  if(!series.length){el.innerHTML='<p class="muted small">No model data came back.</p>';return}
  chart(el,{n:days.length,label:'Daily forecast by model',series,yFmt:k==='prcp'?(v=>v.toFixed(US()?2:0)):(v=>Math.round(v)+'°'),yFloor:k==='prcp'?0:null,minSpan:k==='prcp'?(US()?0.2:5):8,
    xTick:i=>fDow(days[i]),tipTitle:i=>fDow(days[i])+' '+fMD(days[i]),height:240,
    tipExtra:i=>{const v=series.map(s=>s.values[i]).filter(isNum);return v.length>1?`<div class="tr"><i style="background:var(--faint)"></i>Spread<span>${(Math.max(...v)-Math.min(...v)).toFixed(k==='prcp'?U.pd():0)}${k==='prcp'?' '+U.pu():'°'}</span></div>`:''}});
  const spread=days.map((_,i)=>{const v=series.map(s=>s.values[i]).filter(isNum);return v.length>1?Math.max(...v)-Math.min(...v):null});
  const lim=k==='prcp'?(US()?0.25:6):(US()?5:3);const firstBig=spread.findIndex(v=>v!=null&&v>=lim);
  el.insertAdjacentHTML('beforeend',`<p class="note">${firstBig<0?'The models agree closely through the whole run.':firstBig===0?'The models already disagree today.':`The models agree within ${k==='prcp'?lim+' '+U.pu():lim+'°'} through ${fDow(days[firstBig-1])}, then split.`} Big disagreement means lower confidence in the forecast.</p>`);
}
function renderEns(){
  const el=$('#ensBody');const E=S.ens;if(!E)return;if(E.error){fail('#ensBody','the ensemble',E.error);return}
  const h=E.j.hourly;$('#ensTitle').textContent=E.label+' plume';
  const keysT=Object.keys(h).filter(k=>/^temperature_2m/.test(k)),keysP=Object.keys(h).filter(k=>/^precipitation/.test(k));
  const idx=[];for(let i=0;i<h.time.length;i+=3)idx.push(i);const t=idx.map(i=>h.time[i]);
  const mem=keysT.map(k=>idx.map(i=>{const v=h[k][i];return isNum(v)?U.t(v):null}));
  const p10=idx.map((_,j)=>quant(mem.map(m=>m[j]),.1)),p90=idx.map((_,j)=>quant(mem.map(m=>m[j]),.9)),med=idx.map((_,j)=>quant(mem.map(m=>m[j]),.5));
  el.innerHTML='<div class="chart" id="chEns"></div><h3 style="margin-top:18px">Chance of measurable precip, by day</h3><div class="chart" id="chEnsP"></div><p class="note" id="ensNote"></p>';
  chart($('#chEns'),{n:idx.length,label:'Ensemble temperature plume',band:{lo:p10,hi:p90},
    series:[...mem.map(v=>({name:'member',values:v,color:'var(--c2)',width:1,opacity:.22,quiet:true})),{name:'Median',values:med,color:'var(--c1)',width:2.5}],
    legend:`<div class="legend"><span><i style="--c:var(--c1)"></i>Median</span><span><i class="blk" style="--c:var(--band)"></i>Middle 80% of runs</span><span><i style="--c:var(--c2);opacity:.5"></i>${mem.length} individual runs</span></div>`,
    yFmt:v=>Math.round(v)+'°',xTick:i=>{const d=pT(t[i]);return d.getUTCHours()===0&&d.getUTCDate()%2===0?fMD(t[i]):null},height:240,
    tip:i=>`<b>${tipTime(t)(i)}</b><div class="tr"><i style="background:var(--c1)"></i>Median<span>${med[i]==null?'—':Math.round(med[i])+'°'}</span></div><div class="tr"><i style="background:var(--band)"></i>10th–90th<span>${p10[i]==null?'—':Math.round(p10[i])+'° to '+Math.round(p90[i])+'°'}</span></div>`});
  const days=[...new Set(h.time.map(x=>x.slice(0,10)))];
  const prob=days.map(d=>{const ii=h.time.map((x,i)=>x.startsWith(d)?i:-1).filter(i=>i>=0);if(ii.length<20)return null;const tot=keysP.map(k=>ii.reduce((s,i)=>s+(isNum(h[k][i])?h[k][i]:0),0));return tot.length?Math.round(tot.filter(v=>v>=0.25).length/tot.length*100):null});
  chart($('#chEnsP'),{n:days.length,label:'Share of ensemble runs with measurable precipitation each day',series:[],bars:{values:prob,color:v=>v>=60?'var(--c2)':'color-mix(in srgb,var(--c2) 55%,transparent)',max:16},
    yFloor:0,yCeil:100,extraY:[100],yFmt:v=>v+'%',xTick:i=>i%2===0?fMD(days[i]+'T00:00'):null,height:150,
    tip:i=>`<b>${fDow(days[i])} ${fMD(days[i])}</b><div class="tr"><i style="background:var(--c2)"></i>Runs with precip<span>${prob[i]??'—'}%</span></div>`});
  $('#ensNote').textContent=`Each faint line is one run of the ${E.label.replace(' ensemble','')} model with slightly different starting conditions. Where they fan out, the forecast gets uncertain.`;
}

/* sun + moon math */
function solarElev(ms,lat,lon){const rad=Math.PI/180;const d=ms/864e5+2440587.5-2451545.0;const g=(357.529+0.98560028*d)*rad,q=280.459+0.98564736*d;
  const L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*rad,e=(23.439-0.00000036*d)*rad;const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L));
  const gmst=((18.697374558+24.06570982441908*d)%24+24)%24;const ha=(gmst*15+lon)*rad-ra;
  return Math.asin(Math.sin(lat*rad)*Math.sin(dec)+Math.cos(lat*rad)*Math.cos(dec)*Math.cos(ha))/rad}
function moon(ms){const syn=29.530588853,ref=Date.UTC(2000,0,6,18,14);const age=(((ms-ref)/864e5)%syn+syn)%syn;const f=age/syn;const ill=(1-Math.cos(2*Math.PI*f))/2;
  const nm=f<.0339?'New moon':f<.216?'Waxing crescent':f<.284?'First quarter':f<.466?'Waxing gibbous':f<.534?'Full moon':f<.716?'Waning gibbous':f<.784?'Last quarter':f<.966?'Waning crescent':'New moon';
  return {age,f,ill,name:nm,toFull:((0.5-f+1)%1)*syn,toNew:((1-f)%1)*syn}}
function moonSvg(f){const r=44,c=48;const k=Math.cos(2*Math.PI*f);const rx=Math.abs(k)*r;let d;
  if(f<0.5){d=`M${c} ${c-r} A${r} ${r} 0 0 1 ${c} ${c+r} A${rx} ${r} 0 0 ${k>0?0:1} ${c} ${c-r}Z`}else{d=`M${c} ${c-r} A${r} ${r} 0 0 0 ${c} ${c+r} A${rx} ${r} 0 0 ${k>0?1:0} ${c} ${c-r}Z`}
  return `<svg viewBox="0 0 96 96" role="img" aria-label="Moon phase"><circle cx="${c}" cy="${c}" r="${r}" fill="var(--panel2)" stroke="var(--line)"/><path d="${d}" fill="var(--sun)" fill-opacity=".85"/></svg>`}
function renderSky(){
  const c=ctx();if(!c)return;const {D,di,off,today}=c;const L=S.loc;const el=$('#skyBody');
  const [y,m,d]=today.split('-').map(Number);const mid=Date.UTC(y,m-1,d)-off*1000;const nowMs=Date.now();
  const el2=[];for(let k=0;k<=1440;k+=4)el2.push(solarElev(mid+k*60e3,L.lat,L.lon));
  const maxE=Math.max(...el2),noonK=el2.indexOf(maxE)*4;
  const seg=(lo,hi)=>{const out=[];let s=null;el2.forEach((e,i)=>{const inR=e>=lo&&e<hi;if(inR&&s==null)s=i;if(!inR&&s!=null){out.push([s*4,i*4]);s=null}});if(s!=null)out.push([s*4,1440]);return out};
  const clk=k=>{const dd=new Date(mid+off*1000+k*60e3);const h=dd.getUTCHours();return (h%12||12)+':'+pad(dd.getUTCMinutes())+(h<12?' AM':' PM')};
  const pick=(a,pm)=>{const s=a.find(([s0])=>pm?s0>noonK:s0<noonK);return s?clk(s[0])+'–'+clk(s[1]):'—'};
  const gold=seg(-4,6),blue=seg(-6,-4);
  const dl=at(D.daylight_duration,di),dlY=at(D.daylight_duration,di-1);const dd=dl!=null&&dlY!=null?dl-dlY:null;
  const fmtDur=s=>{s=Math.abs(Math.round(s));return Math.floor(s/3600)+'h '+pad(Math.floor(s%3600/60))+'m'};
  const md=today.slice(5);const sol=md<'06-21'?Y0(y,'06-21','Summer solstice'):md<'12-21'?Y0(y,'12-21','Winter solstice'):Y0(y+1,'06-21','Summer solstice');
  function Y0(yy,mmdd,name){return {name,days:dayDiff(today,yy+'-'+mmdd)}}
  const mo=moon(nowMs);const nowK=(nowMs-mid)/60e3;
  el.innerHTML=`<div class="cols2"><div class="block">
     <div class="stat">
       <div><div class="k">Sunrise</div><div class="v">${D.sunrise&&D.sunrise[di]?fClock(D.sunrise[di]):'—'}</div><div class="s">Solar noon ${clk(noonK)}</div></div>
       <div><div class="k">Sunset</div><div class="v">${D.sunset&&D.sunset[di]?fClock(D.sunset[di]):'—'}</div><div class="s">Sun peaks at ${maxE.toFixed(1)}° high</div></div>
       <div><div class="k">Day length</div><div class="v">${dl!=null?fmtDur(dl):'—'}</div><div class="s">${dd!=null?(dd>=0?'+':'−')+Math.floor(Math.abs(dd)/60)+'m '+pad(Math.round(Math.abs(dd)%60))+'s vs. yesterday':''}</div></div>
       <div><div class="k">${sol.name}</div><div class="v">${sol.days} days</div><div class="s">Approximate date</div></div>
       <div><div class="k">Golden hour</div><div class="v small" style="font-size:18px">${pick(gold,true)}</div><div class="s">Morning ${pick(gold,false)}</div></div>
       <div><div class="k">Blue hour</div><div class="v small" style="font-size:18px">${pick(blue,true)}</div><div class="s">Morning ${pick(blue,false)}</div></div>
     </div><div id="sunpath" style="margin-top:12px"></div></div>
   <div class="block"><h3>Moon</h3><div class="moonrow">${moonSvg(mo.f)}<div><div style="font:600 24px/1.1 var(--f-disp)">${mo.name}</div><div class="muted">${Math.round(mo.ill*100)}% lit · ${mo.age.toFixed(1)} days old</div></div></div>
     <div class="stat" style="margin-top:12px"><div><div class="k">Next full moon</div><div class="v">${fMD(dstr(new Date(nowMs+off*1000+mo.toFull*864e5)))}</div><div class="s">in ${mo.toFull.toFixed(1)} days</div></div><div><div class="k">Next new moon</div><div class="v">${fMD(dstr(new Date(nowMs+off*1000+mo.toNew*864e5)))}</div><div class="s">in ${mo.toNew.toFixed(1)} days</div></div></div>
     <h3 style="margin-top:18px">Sunshine &amp; energy today</h3><div class="stat"><div><div class="k">Sunshine</div><div class="v">${fN((at(D.sunshine_duration,di)||0)/3600)} h</div><div class="s">of ${dl!=null?fN(dl/3600):'—'} h daylight</div></div><div><div class="k">Solar energy</div><div class="v">${fN(at(D.shortwave_radiation_sum,di))}</div><div class="s">MJ/m² reaching the ground</div></div><div><div class="k">Evaporation</div><div class="v">${fP(at(D.et0_fao_evapotranspiration,di))}</div><div class="s">Water a lawn loses today</div></div></div></div></div>`;
  responsive($('#sunpath'),()=>{const host=$('#sunpath');const W=Math.max(280,host.clientWidth),Hh=130,top=Math.max(10,maxE+8),bot=Math.min(-10,Math.min(...el2)-4);const X=k=>k/1440*W,Y=e=>8+(top-e)/(top-bot)*(Hh-26);
    let p='';el2.forEach((e,i)=>{p+=(i?'L':'M')+X(i*4).toFixed(1)+' '+Y(e).toFixed(1)});
    let s=`<svg viewBox="0 0 ${W} ${Hh}" class="sunsvg" role="img" aria-label="Sun elevation through the day"><rect x="0" y="${Y(0)}" width="${W}" height="${Hh-18-Y(0)}" fill="var(--band)"/><line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" class="gl" style="stroke:var(--faint)"/><path d="${p}" fill="none" stroke="var(--sun)" stroke-width="2.5"/>`;
    if(nowK>=0&&nowK<=1440){const e=solarElev(nowMs,L.lat,L.lon);s+=`<circle cx="${X(nowK)}" cy="${Y(e)}" r="7" fill="var(--sun)" stroke="var(--panel)" stroke-width="2"/>`}
    [0,6,12,18].forEach(h=>s+=`<text x="${X(h*60)+3}" y="${Hh-4}" class="ax" style="font-size:11px;fill:var(--muted)">${h12(h).replace(' ','').toLowerCase()}</text>`);
    s+=`<text x="${W-4}" y="${Y(0)-5}" text-anchor="end" style="font-size:11px;fill:var(--muted)">horizon</text></svg>`;host.innerHTML='<div class="eyebrow" style="margin-bottom:4px">Sun height through the day</div>'+s});
}
function aqiCat(q){return q<=50?['Good','var(--good)']:q<=100?['Moderate','var(--warn)']:q<=150?['Unhealthy for sensitive groups','var(--bad)']:q<=200?['Unhealthy','var(--crit)']:q<=300?['Very unhealthy','var(--aqi5)']:['Hazardous','var(--aqi6)']}
function renderAir(){
  const el=$('#airBody');const A=S.aq;const c=ctx();if(!A)return;if(A.error){fail('#airBody','air quality',A.error,false);return}
  const q=A.current||{};const cat=isNum(q.us_aqi)?aqiCat(q.us_aqi):['—','var(--faint)'];
  const uvNow=c?at(c.H.uv_index,c.ci):q.uv_index;const uvMax=c?at(c.D.uv_index_max,c.di):null;
  el.innerHTML=`<div class="eyebrow">U.S. AQI now</div><div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><div class="aqi num">${isNum(q.us_aqi)?Math.round(q.us_aqi):'—'}</div><div style="font:600 20px/1.1 var(--f-disp)"><span class="tag"><i style="--c:${cat[1]}"></i>${cat[0]}</span></div></div>
   <div class="sevbar" aria-hidden="true"><span style="background:var(--good)"></span><span style="background:var(--warn)"></span><span style="background:var(--bad)"></span><span style="background:var(--crit)"></span><span style="background:var(--aqi5)"></span><span style="background:var(--aqi6)"></span></div>
   <div class="stat" style="margin-top:12px"><div><div class="k">PM2.5</div><div class="v">${fN(q.pm2_5)}</div><div class="s">µg/m³ fine particles</div></div><div><div class="k">PM10</div><div class="v">${fN(q.pm10)}</div><div class="s">µg/m³ coarse</div></div><div><div class="k">Ozone</div><div class="v">${fN(q.ozone)}</div><div class="s">µg/m³</div></div><div><div class="k">NO₂</div><div class="v">${fN(q.nitrogen_dioxide)}</div><div class="s">µg/m³</div></div>
   <div><div class="k">UV now</div><div class="v">${uvNow==null?'—':uvNow.toFixed(1)}</div><div class="s">${uvCat(uvNow)}</div></div><div><div class="k">UV peak today</div><div class="v">${uvMax==null?'—':uvMax.toFixed(1)}</div><div class="s">${uvCat(uvMax)}</div></div></div>
   <h3 style="margin-top:16px">AQI next 3 days</h3><div class="chart" id="chAQ"></div><p class="note">Modeled by CAMS. Official readings from monitors can differ; see airnow.gov.</p>`;
  const h=A.hourly;if(h&&h.us_aqi){const t=h.time;chart($('#chAQ'),{n:t.length,label:'Air quality index forecast',series:[{name:'AQI',values:h.us_aqi.map(v=>isNum(v)?v:null),color:'var(--c3)',width:2,fmt:v=>Math.round(v)+''}],yFloor:0,minSpan:50,
    refLines:[{y:50,label:'Good'},{y:100,label:'Moderate'}],yFmt:v=>Math.round(v)+'',xTick:i=>{const d=pT(t[i]);return d.getUTCHours()===0?DOW[d.getUTCDay()]:d.getUTCHours()===12?'noon':null},tipTitle:tipTime(t),height:160})}
}

/* station obs */
function renderObs(){
  const el=$('#obsBody');
  if(S.nws&&S.nws.none){el.innerHTML='<p class="muted">Official station observations come from the U.S. National Weather Service, so they only show for U.S. locations.</p>';return}
  const O=S.obs;if(!O)return;if(O.error){fail('#obsBody','station observations',O.error,false);return}
  const o=O.obs,st=O.station;const v=x=>x&&isNum(x.value)?x.value:null;
  const age=o.timestamp?Math.round((Date.now()-new Date(o.timestamp))/60e3):null;
  let dist='';if(O.coords){const [lo,la]=O.coords;const R=6371,dLa=(la-S.loc.lat)*Math.PI/180,dLo=(lo-S.loc.lon)*Math.PI/180;const a=Math.sin(dLa/2)**2+Math.cos(la*Math.PI/180)*Math.cos(S.loc.lat*Math.PI/180)*Math.sin(dLo/2)**2;const km=2*R*Math.asin(Math.sqrt(a));dist=(US()?(km/1.609).toFixed(1)+' mi':km.toFixed(1)+' km')+' away'}
  const slp=v(o.seaLevelPressure)??v(o.barometricPressure);
  el.innerHTML=`<div style="font:600 22px/1.15 var(--f-disp)">${esc(st.stationIdentifier)} · ${esc(st.name||'')}</div><div class="muted small">${dist}${age!=null?` · observed ${age<90?age+' min':Math.round(age/60)+' h'} ago`:''}${age>120?' (station may be reporting late)':''}</div>
   <div class="stat" style="margin-top:12px"><div><div class="k">Temperature</div><div class="v">${fT(v(o.temperature))}</div><div class="s">${esc(o.textDescription||'')}</div></div>
     <div><div class="k">Dew point</div><div class="v">${fT(v(o.dewpoint))}</div><div class="s">RH ${v(o.relativeHumidity)!=null?Math.round(v(o.relativeHumidity))+'%':'—'}</div></div>
     <div><div class="k">Wind</div><div class="v">${v(o.windSpeed)==null?'—':card(v(o.windDirection))+' '+fW(v(o.windSpeed))}</div><div class="s">${v(o.windGust)?'Gusts '+fW(v(o.windGust)):'No gusts reported'}</div></div>
     <div><div class="k">Pressure</div><div class="v">${slp==null?'—':U.pr(slp/100).toFixed(U.prd())+' '+U.pru()}</div><div class="s">Visibility ${v(o.visibility)==null?'—':(U.dist(v(o.visibility))).toFixed(1)+' '+U.du()}</div></div></div>
   ${o.rawMessage?`<div class="eyebrow" style="margin-top:14px">Raw METAR</div><pre class="metar">${esc(o.rawMessage)}</pre><p class="note">The coded aviation report pilots read. It lists station, day and time (UTC), wind, visibility, weather, clouds, temperature/dew point and altimeter.</p>`:''}`;
}

/* radar */
let RAD={layers:[],idx:0,timer:null,playing:true,labels:[],warn:null};
// Base map follows the theme (light or dark tiles); theme CSS can tint it through the .wx-base class.
function setBasemap(){
  const map=window.__map;if(!map||!window.L)return;const dark=isDarkUI();
  if(RAD.base&&RAD.baseDark===dark){restyleMarker();return}
  (RAD.base||[]).forEach(l=>map.removeLayer(l));
  if(CARTO_KEY){const st=dark?'dark':'light';const k='?key='+encodeURIComponent(CARTO_KEY);
    RAD.base=[L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/${st}_nolabels/{z}/{x}/{y}{r}.png${k}`,{attribution:'© OpenStreetMap contributors © CARTO',maxZoom:12,className:'wx-base'}),
      L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/${st}_only_labels/{z}/{x}/{y}{r}.png${k}`,{pane:'labels',maxZoom:12,className:'wx-base'})]}
  else{const g=dark?'Dark':'Light';const esri=n=>`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${g}_Gray_${n}/MapServer/tile/{z}/{y}/{x}`;
    RAD.base=[L.tileLayer(esri('Base'),{attribution:'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors',maxZoom:12,maxNativeZoom:16,className:'wx-base'}),
      L.tileLayer(esri('Reference'),{pane:'labels',maxZoom:12,maxNativeZoom:16,className:'wx-base'})]}
  RAD.base.forEach(l=>l.addTo(map));RAD.baseDark=dark;restyleMarker();
}
function restyleMarker(){if(RAD.marker)RAD.marker.setStyle({color:cssVar('--ink'),fillColor:cssVar('--sun')})}
function renderRadar(){
  if(!shown('radar'))return;
  if(!window.L){ // the map library loads in the background; wait for it if the page is still loading
    if(document.readyState!=='complete'){addEventListener('load',renderRadar,{once:true});return}
    $('#radarNote').textContent='The map library could not load. Check your connection and refresh.';return}
  const Lc=S.loc;
  if(window.__map){window.__map.remove();window.__map=null}
  clearInterval(RAD.timer);RAD={layers:[],idx:0,timer:null,playing:true,labels:[],warn:null};$('#rPlay').textContent='Pause';
  // Touch screens: one finger scrolls the page, two fingers move the map. Mouse: scroll-zoom only after a click on the map.
  const map=L.map('map',{zoomControl:true,attributionControl:true,scrollWheelZoom:false,dragging:!matchMedia('(pointer: coarse)').matches}).setView([Lc.lat,Lc.lon],7);window.__map=map;
  map.on('click',()=>map.scrollWheelZoom.enable());map.on('mouseout',()=>map.scrollWheelZoom.disable());
  map.createPane('labels');map.getPane('labels').style.zIndex=650;map.getPane('labels').style.pointerEvents='none';
  setBasemap();
  RAD.marker=L.circleMarker([Lc.lat,Lc.lon],{radius:6,color:cssVar('--ink'),weight:2,fillColor:cssVar('--sun'),fillOpacity:1,pane:'labels'}).addTo(map);
  const us=S.nws&&!S.nws.none;
  const add=(url,label,opt={})=>{const l=L.tileLayer(url,{opacity:0,zIndex:400,maxZoom:12,...opt}).addTo(map);RAD.layers.push(l);RAD.labels.push(label)};
  const start=()=>{const n=RAD.layers.length;$('#rFrame').max=n-1;show(n-1);RAD.timer=setInterval(()=>{if(!RAD.playing||document.hidden)return;const n=RAD.layers.length;show(RAD.idx>=n-1?0:RAD.idx+1)},650)};
  if(us){const mins=[50,45,40,35,30,25,20,15,10,5,0];
    mins.forEach(m=>add(`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913${m?'-m'+pad(m)+'m':''}/{z}/{x}/{y}.png`,m?'−'+m+' min':'Latest',{attribution:'Radar: Iowa Environmental Mesonet'}));
    $('#radarNote').textContent='NEXRAD base reflectivity, last 50 minutes in 5-minute steps. Greens are light rain, yellows and reds heavy rain or storms.';
    const rs=S.nws.radarStation;$('#radarLinks').innerHTML=rs?`<a href="https://radar.weather.gov/station/${esc(rs.toLowerCase())}/standard" target="_blank" rel="noopener">${esc(rs)} full radar ↗</a>`:'';
    start();addAlertShapes();}
  else{const thisMap=map;fetchJSON('https://api.rainviewer.com/public/weather-maps.json').then(j=>{if(window.__map!==thisMap)return;
      (j.radar&&j.radar.past||[]).slice(-10).forEach(f=>{const d=new Date(f.time*1000);add(`${j.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}),{maxNativeZoom:7,attribution:'Radar: RainViewer'})});
      if(RAD.layers.length){start();$('#radarNote').textContent='Global radar mosaic from RainViewer.'}else $('#radarNote').textContent='No radar frames available right now.'})
      .catch(e=>{$('#radarNote').textContent='Radar unavailable for this location right now ('+e.message+').'});
    $('#radarLinks').innerHTML=`<a href="https://www.windy.com/?radar,${Lc.lat.toFixed(2)},${Lc.lon.toFixed(2)},8" target="_blank" rel="noopener">Open in Windy ↗</a>`}
  function show(i){RAD.layers.forEach((l,k)=>l.setOpacity(k===i?0.72:0));RAD.idx=i;$('#rFrame').value=i;$('#rTime').textContent=RAD.labels[i]||''}
  RAD.show=show;
}
function stopRadar(){clearInterval(RAD.timer);if(window.__map){window.__map.remove();window.__map=null}}
$('#rPlay').addEventListener('click',()=>{RAD.playing=!RAD.playing;$('#rPlay').textContent=RAD.playing?'Pause':'Play'});
$('#rFrame').addEventListener('input',e=>{RAD.playing=false;$('#rPlay').textContent='Play';RAD.show&&RAD.show(+e.target.value)});
$('#rWarn').addEventListener('change',()=>{if(!RAD.warn||!window.__map)return;if($('#rWarn').checked)RAD.warn.addTo(window.__map);else window.__map.removeLayer(RAD.warn)});
{ // gesture hints; the #map element outlives each Leaflet map, so these listeners are attached once
  let hintT;const box=$('#map');
  const hint=t=>{const h=$('#mapHint');h.textContent=t;h.classList.add('on');clearTimeout(hintT);hintT=setTimeout(()=>h.classList.remove('on'),1300)};
  box.addEventListener('touchmove',e=>{if(e.touches.length===1&&window.__map&&!window.__map.dragging.enabled())hint('Use two fingers to move the map')},{passive:true});
  box.addEventListener('wheel',()=>{if(window.__map&&!window.__map.scrollWheelZoom.enabled())hint('Click the map, then scroll to zoom')},{passive:true});
}
function addAlertShapes(){
  if(!window.__map||!S.alerts||!window.L)return;const fs=S.alerts.filter(a=>a.geometry);if(!fs.length)return;
  if(RAD.warn)window.__map.removeLayer(RAD.warn);
  const col=s=>cssVar(s==='Extreme'?'--crit':s==='Severe'?'--bad':s==='Moderate'?'--warn':'--faint');
  RAD.warn=L.geoJSON({type:'FeatureCollection',features:fs.map(f=>({type:'Feature',geometry:f.geometry,properties:f.properties}))},{style:f=>({color:col(f.properties.severity),weight:2,fillOpacity:.1}),onEachFeature:(f,l)=>l.bindPopup(`<b>${esc(f.properties.event)}</b><br>${esc(f.properties.headline||'')}`)});
  if($('#rWarn').checked)RAD.warn.addTo(window.__map);
}

/* outlooks + discussion */
function renderOutlooks(){
  if(!shown('outlooks'))return;
  const el=$('#olBody');
  if(!S.nws||S.nws.none){el.innerHTML=S.nws?'<p class="muted">These national outlook maps cover the United States. For other regions, try your national weather service.</p>':'<div class="loading">Loading…</div>';return}
  const OL=[['Storms today','https://www.spc.noaa.gov/products/outlook/day1otlk.gif','SPC Day 1 convective outlook: where severe storms are possible today.','https://www.spc.noaa.gov/products/outlook/'],
    ['Storms tomorrow','https://www.spc.noaa.gov/products/outlook/day2otlk.gif','SPC Day 2 convective outlook.','https://www.spc.noaa.gov/products/outlook/'],
    ['7-day rain','https://www.wpc.ncep.noaa.gov/qpf/p168i.gif','WPC total precipitation forecast for the next 7 days.','https://www.wpc.ncep.noaa.gov/qpf/qpf2.shtml'],
    ['6–10 day temps','https://www.cpc.ncep.noaa.gov/products/predictions/610day/610temp.new.gif','CPC 6–10 day outlook: odds of above or below normal temperatures.','https://www.cpc.ncep.noaa.gov/products/predictions/610day/'],
    ['6–10 day precip','https://www.cpc.ncep.noaa.gov/products/predictions/610day/610prcp.new.gif','CPC 6–10 day precipitation outlook.','https://www.cpc.ncep.noaa.gov/products/predictions/610day/'],
    ['8–14 day temps','https://www.cpc.ncep.noaa.gov/products/predictions/814day/814temp.new.gif','CPC 8–14 day temperature outlook.','https://www.cpc.ncep.noaa.gov/products/predictions/814day/'],
    ['8–14 day precip','https://www.cpc.ncep.noaa.gov/products/predictions/814day/814prcp.new.gif','CPC 8–14 day precipitation outlook.','https://www.cpc.ncep.noaa.gov/products/predictions/814day/']];
  const i0=S.olIdx||0;
  el.innerHTML=`<div class="tabs" role="tablist">${OL.map((o,i)=>`<button type="button" role="tab" aria-selected="${i===i0}" data-ol="${i}">${o[0]}</button>`).join('')}</div>
    <img class="olimg" id="olImg" alt="${esc(OL[i0][2])}" src="${OL[i0][1]}?t=${Math.floor(Date.now()/600e3)}"><p class="note" id="olCap">${esc(OL[i0][2])} <a href="${OL[i0][3]}" target="_blank" rel="noopener">Source ↗</a></p>`;
  $('#olImg').onerror=()=>{$('#olCap').innerHTML=`This map didn't load. <a href="${OL[S.olIdx||0][3]}" target="_blank" rel="noopener">Open it on NOAA's site ↗</a>`};
  $$('[data-ol]',el).forEach(b=>b.addEventListener('click',()=>{S.olIdx=+b.dataset.ol;renderOutlooks()}));
}
function renderAFD(){
  const el=$('#afdBody');
  if(S.nws&&S.nws.none){el.innerHTML='<p class="muted">Forecast discussions are written by U.S. National Weather Service offices, so they only show for U.S. locations.</p>';return}
  const A=S.afd;if(!A)return;if(A.error){fail('#afdBody','the forecast discussion',A.error,false);return}
  $('#afdMeta').textContent=`NWS ${A.office} · issued ${A.issued?new Date(A.issued).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'}):''}`;
  const txt=A.text.replace(/^\s*000\s*\n/,'').replace(/&&\s*$/m,'').trim();
  el.innerHTML=`<p class="note" style="margin-top:0">The forecasters' own notes on what they expect and how confident they are. Expect jargon; it's the good stuff.</p><pre class="afd">${esc(txt)}</pre>`;
}

/* ============ themes ============ */
const THEMES=[
  {id:'auto',name:'Auto',desc:'Light or dark to match your device',sw:['#e9eef2','#e9eef2','#0d141b','#0d141b']},
  {id:'light',name:'Light',desc:'Plotting paper and instrument panels',sw:['#e9eef2','#f7f9fb','#1f5fae']},
  {id:'dark',name:'Dark',desc:'The same panels with the lights down',sw:['#0d141b','#18232e','#6aa8ee']},
  {id:'paper',name:'Paper almanac',desc:'Cream paper, sepia ink and serif type',sw:['#efe6d3','#2a2017','#8c2f1b']},
  {id:'sky',name:'Live sky',desc:'The page becomes the sky outside right now',sw:['#1c64b4','#f29a62','#0a1832']}];
let THEME=LS.get('wx:theme','auto');
if(/^term/.test(THEME)){THEME='dark';LS.set('wx:theme','dark');LS.del('wx:scan')} // retired terminal themes
if(!THEMES.some(t=>t.id===THEME))THEME='auto';
const DARK_MQ=matchMedia('(prefers-color-scheme: dark)'),RM_MQ=matchMedia('(prefers-reduced-motion: reduce)');
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// Whether the page currently shows light text on a dark background (decides map tiles and the browser bar color).
function isDarkUI(){const t=THEME;if(t==='auto')return DARK_MQ.matches;if(t==='sky')return document.documentElement.dataset.tone==='dark';return t==='dark'}
const META_TC=$$('meta[name="theme-color"]').map(m=>({m,c:m.content}));
function syncThemeColor(){const bg=cssVar('--bg');META_TC.forEach(x=>{x.m.content=THEME==='auto'?x.c:bg})}
function onUiChange(){syncThemeColor();setBasemap();addAlertShapes()}
function applyTheme(t){
  THEME=t;const r=document.documentElement;
  if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);
  if(t!=='sky'){r.removeAttribute('data-sky');r.removeAttribute('data-tone')}
  window.__wxFont&&window.__wxFont(t);LS.set('wx:theme',t);
  updateSky();onUiChange();syncSettings();
}
DARK_MQ.addEventListener('change',()=>{if(THEME==='auto')onUiChange()});

/* ============ live sky (the "Live sky" theme) ============ */
// Scene from current conditions and the sun's height. tone = which panel colors keep text readable on that scene.
const SKY_SCENES={day:{tone:'light',cloud:[255,255,255,.9]},cloudy:{tone:'light',cloud:[240,243,246,.82]},rain:{tone:'light',cloud:[148,160,172,.72]},
  snow:{tone:'light',cloud:[246,248,251,.82]},fog:{tone:'light',cloud:[236,239,241,.6]},storm:{tone:'dark',cloud:[66,72,88,.78]},
  dawn:{tone:'light',cloud:[255,212,196,.72]},dusk:{tone:'dark',cloud:[220,140,150,.6]},night:{tone:'dark',cloud:[72,84,108,.5]},'night-cloudy':{tone:'dark',cloud:[56,64,76,.72]}};
function skyRead(){
  const c=ctx();if(!c)return null;const C=c.C;const code=C.weather_code??0;
  const cc=isNum(C.cloud_cover)?C.cloud_cover/100:code>=3?.9:code>=1?.4:0;
  const now=Date.now(),e=solarElev(now,S.loc.lat,S.loc.lon),rising=solarElev(now+20*60e3,S.loc.lat,S.loc.lon)>e;
  const storm=code>=95,snow=SNOWY(code),rain=!snow&&(WET(code)||FREEZE(code)||storm),fog=code===45||code===48;
  const dim=storm||snow||rain||fog||code===3||cc>=.8;
  let id;
  if(storm)id='storm';
  else if(e<-6)id=dim?'night-cloudy':'night';
  else if(e<8&&!dim)id=rising?'dawn':'dusk';
  else if(e<0)id='night-cloudy';
  else id=rain?'rain':snow?'snow':fog?'fog':dim?'cloudy':'day';
  const pr=isNum(C.precipitation)?C.precipitation:0,wind=isNum(C.wind_speed_10m)?C.wind_speed_10m:10;
  const to=((isNum(C.wind_direction_10m)?C.wind_direction_10m:270)+180)*Math.PI/180; // wind direction is where it comes FROM
  return {id,tone:SKY_SCENES[id].tone,cover:Math.max(cc,dim?.85:0),rain:rain?Math.min(1,.35+pr/4):0,snow:snow?Math.min(1,.4+pr/3):0,
    fog,storm,stars:e<-4&&cc<.75,moon:e<-2&&cc<.85,sun:e>2&&!dim,lowSun:id==='dawn'||id==='dusk',wind,dirX:Math.sin(to)||.3};
}
const SKY={st:null,raf:0,last:0,W:0,H:0,dpr:1,clouds:[],drops:[],flakes:[],stars:[],fogs:[],flash:0,nextFlash:0,bolt:null};
const skyOn=()=>THEME==='sky';
const skyAnimOn=()=>LS.get('wx:skyAnim',true);
const skyMoving=()=>skyOn()&&skyAnimOn()&&!RM_MQ.matches&&!document.hidden;
function updateSky(){
  if(!skyOn()){skyStop();return}
  const st=skyRead();
  if(st){const prev=SKY.st;SKY.st=st;const r=document.documentElement;
    if(r.dataset.sky!==st.id){
      // crossfade: freeze the old gradient on the top layer, switch the scene underneath, then fade the top layer out
      const a=$('#skyBg .a'),b=$('#skyBg .b');
      if(r.dataset.sky){b.style.transition='none';b.style.backgroundImage=getComputedStyle(a).backgroundImage;b.style.opacity='1';void b.offsetWidth;b.style.transition=''}
      const toneChanged=r.dataset.tone!==st.tone;r.dataset.sky=st.id;r.dataset.tone=st.tone;
      requestAnimationFrame(()=>{b.style.opacity='0'});
      if(toneChanged)onUiChange();else syncThemeColor();
    }
    LS.set('wx:skyState',{id:st.id,tone:st.tone});
    if(!prev||prev.id!==st.id||Math.abs(prev.cover-st.cover)>.15||prev.rain!==st.rain||prev.snow!==st.snow)SKY.built=false;
  }
  skyStart();
}
function skyResize(){
  const cv=$('#skyFx'),W=innerWidth,H=innerHeight,dpr=Math.min(devicePixelRatio||1,W<700?1.25:1.5);
  if(W===SKY.W&&H===SKY.H&&dpr===SKY.dpr)return;
  if(W!==SKY.W)SKY.built=false; // phones change height as the address bar slides; only a width change rebuilds the scene
  SKY.W=W;SKY.H=H;SKY.dpr=dpr;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
}
function cloudSprite(s,[r,g,b,a]){
  const w=Math.round(340*s),h=Math.round(150*s),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),R=Math.random;
  for(let i=0,n=8+Math.round(R()*5);i<n;i++){const px=w*(.16+R()*.68),py=h*(.5+R()*.22)-(Math.abs(px-w/2)<w*.2?h*.14:0),pr=h*(.2+R()*.22);
    const gr=x.createRadialGradient(px,py,0,px,py,pr);gr.addColorStop(0,`rgba(${r},${g},${b},${a})`);gr.addColorStop(.62,`rgba(${r},${g},${b},${a*.5})`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
    x.fillStyle=gr;x.beginPath();x.arc(px,py,pr,0,6.2832);x.fill()}
  return c;
}
function skyBuild(){
  const st=SKY.st;SKY.built=true;if(!st)return;const {W,H}=SKY,R=Math.random,small=W<700,area=W*H/1e6;
  SKY.stars=st.stars?Array.from({length:Math.min(small?110:220,Math.round(area*160))},()=>({x:R()*W,y:R()*H*.8,r:R()*1.1+.35,a:R()*.55+.35,ph:R()*6.28,sp:.6+R()*1.6})):[];
  const nc=st.cover<.08?0:Math.round(1+st.cover*(small?5:8)),tint=SKY_SCENES[st.id].cloud;
  SKY.clouds=Array.from({length:nc},()=>{const s=(small?.6:1)*(.7+R()*.8)*(1+st.cover*.6);return {x:R()*(W+500)-250,y:R()*H*.55-40*st.cover,v:(5+R()*9)*(.5+st.wind/25),img:cloudSprite(s,tint)}});
  const k=Math.min(1.6,area/.9);
  SKY.drops=Array.from({length:Math.round(st.rain*(small?170:380)*k)},()=>({x:R()*W,y:R()*H,l:10+R()*14,v:650+R()*450}));
  SKY.flakes=Array.from({length:Math.round(st.snow*(small?120:260)*k)},()=>({x:R()*W,y:R()*H,r:1+R()*2.3,v:22+R()*50,ph:R()*6.28,sw:8+R()*22}));
  SKY.fogs=st.fog?Array.from({length:4},(_,i)=>({x:R()*W,y:H*(.3+i*.18),h:H*.24,v:3+R()*5,a:.16+R()*.12})):[];
  SKY.slant=Math.max(-.45,Math.min(.45,st.dirX*st.wind/60));
}
function drawMoon(x,cx,cy,r,f){
  const glow=x.createRadialGradient(cx,cy,r*.8,cx,cy,r*4);glow.addColorStop(0,'rgba(210,222,245,.18)');glow.addColorStop(1,'rgba(210,222,245,0)');
  x.fillStyle=glow;x.beginPath();x.arc(cx,cy,r*4,0,6.2832);x.fill();
  x.fillStyle='rgba(190,204,230,.14)';x.beginPath();x.arc(cx,cy,r,0,6.2832);x.fill();
  const k=Math.cos(2*Math.PI*f),rx=Math.abs(k)*r;x.fillStyle='rgba(244,240,226,.95)';x.beginPath();
  if(f<.5){x.arc(cx,cy,r,-Math.PI/2,Math.PI/2,false);x.ellipse(cx,cy,rx,r,0,Math.PI/2,-Math.PI/2,k>0)}
  else{x.arc(cx,cy,r,-Math.PI/2,Math.PI/2,true);x.ellipse(cx,cy,rx,r,0,Math.PI/2,-Math.PI/2,k<=0)}
  x.fill();
}
function skyBolt(W,H){const p=[[W*(.15+Math.random()*.7),0]];while(p[p.length-1][1]<H*.55){const [px,py]=p[p.length-1];p.push([px+(Math.random()-.5)*60,py+20+Math.random()*40])}return p}
function skyFrame(t){
  SKY.raf=0;const moving=skyMoving();
  if(moving&&SKY.last&&t-SKY.last<30){SKY.raf=requestAnimationFrame(skyFrame);return} // about 30 fps is plenty and saves battery
  const dt=moving&&SKY.last?Math.min(.1,(t-SKY.last)/1000):0;SKY.last=t;
  if(!SKY.built)skyBuild();
  const cv=$('#skyFx'),x=cv.getContext('2d'),{W,H,dpr,st}=SKY;
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  if(st){
    const ts=t/1000;
    if(SKY.stars.length){x.fillStyle='#fff';SKY.stars.forEach(s=>{x.globalAlpha=s.a*(moving?.65+.35*Math.sin(s.ph+ts*s.sp):1);x.fillRect(s.x,s.y,s.r,s.r)});x.globalAlpha=1}
    if(st.moon)drawMoon(x,W*.84,Math.min(110,H*.13),W<700?15:22,moon(Date.now()).f);
    if(st.sun||st.lowSun){const lo=st.lowSun,cx=lo?W*.72:W*.84,cy=lo?H*.98:H*.08,rr=Math.max(W,H)*(lo?.55:.42);
      const g=x.createRadialGradient(cx,cy,0,cx,cy,rr);g.addColorStop(0,lo?'rgba(255,196,128,.55)':'rgba(255,247,220,.65)');g.addColorStop(.25,lo?'rgba(255,170,110,.22)':'rgba(255,240,200,.22)');g.addColorStop(1,'rgba(255,240,200,0)');
      x.fillStyle=g;x.fillRect(0,0,W,H)}
    const dir=st.dirX>=0?1:-1;
    SKY.clouds.forEach(c=>{c.x+=c.v*dt*dir;const w=c.img.width;if(c.x>W+40)c.x=-w-40;if(c.x<-w-40)c.x=W+40;x.drawImage(c.img,c.x,c.y)});
    SKY.fogs.forEach(f=>{f.x+=f.v*dt*dir;if(f.x>W*1.5)f.x=-W*.5;if(f.x<-W*.5)f.x=W*1.5;const g=x.createRadialGradient(f.x,f.y,0,f.x,f.y,W*.6);
      g.addColorStop(0,`rgba(240,243,245,${f.a})`);g.addColorStop(1,'rgba(240,243,245,0)');x.fillStyle=g;x.fillRect(0,f.y-f.h,W,f.h*2)});
    if(SKY.drops.length){const sl=SKY.slant;x.strokeStyle=st.tone==='dark'?'rgba(170,192,225,.38)':'rgba(225,236,250,.55)';x.lineWidth=1.1;x.lineCap='round';x.beginPath();
      SKY.drops.forEach(d=>{d.y+=d.v*dt;d.x+=d.v*dt*sl;if(d.y>H+20){d.y=-d.l-Math.random()*40;d.x=Math.random()*W}if(d.x>W+20)d.x-=W+40;if(d.x<-20)d.x+=W+40;
        x.moveTo(d.x,d.y);x.lineTo(d.x+d.l*sl,d.y+d.l)});x.stroke()}
    if(SKY.flakes.length){x.fillStyle='rgba(255,255,255,.88)';x.beginPath();
      SKY.flakes.forEach(f=>{f.y+=f.v*dt;f.ph+=dt*.9;if(f.y>H+6){f.y=-6;f.x=Math.random()*W}const fx=f.x+Math.sin(f.ph)*f.sw+(SKY.slant*f.y*.3);x.moveTo(fx+f.r,f.y);x.arc(fx,f.y,f.r,0,6.2832)});x.fill()}
    if(st.storm&&moving){
      if(!SKY.nextFlash)SKY.nextFlash=t+2500;
      if(t>SKY.nextFlash){SKY.flash=1;SKY.bolt=Math.random()<.55?skyBolt(W,H):null;SKY.nextFlash=t+5000+Math.random()*9000}
      if(SKY.flash>0){x.fillStyle=`rgba(214,224,255,${.2*SKY.flash})`;x.fillRect(0,0,W,H);
        if(SKY.bolt&&SKY.flash>.5){x.strokeStyle=`rgba(240,244,255,${SKY.flash})`;x.lineWidth=2;x.beginPath();SKY.bolt.forEach(([bx,by],i)=>i?x.lineTo(bx,by):x.moveTo(bx,by));x.stroke()}
        SKY.flash=Math.max(0,SKY.flash-dt*3)}
    }
  }
  if(moving)SKY.raf=requestAnimationFrame(skyFrame);
}
function skyStart(){if(!skyOn())return;skyResize();cancelAnimationFrame(SKY.raf);SKY.last=0;SKY.raf=requestAnimationFrame(skyFrame)}
function skyStop(){cancelAnimationFrame(SKY.raf);SKY.raf=0;SKY.st=null;SKY.built=false;const cv=$('#skyFx');cv.getContext('2d').clearRect(0,0,cv.width,cv.height)}
{let rT;addEventListener('resize',()=>{clearTimeout(rT);rT=setTimeout(()=>{if(skyOn())skyStart()},150)})}
document.addEventListener('visibilitychange',()=>{if(skyOn()&&!document.hidden)skyStart()});
RM_MQ.addEventListener('change',()=>{if(skyOn())skyStart();syncSettings()});
setInterval(()=>{if(skyOn()&&!document.hidden)updateSky()},5*60e3); // follows sunrise and sunset between refreshes

/* ============ sections: order, visibility, width ============ */
// w = preferred width out of 12. Two narrower sections next to each other share a row; one alone goes full width.
const SECTIONS=[
  {id:'glance',name:'At a glance'},{id:'now',name:'Current conditions',nav:'Now'},{id:'hourly',name:'Next 48 hours',nav:'48 hours'},
  {id:'ride',name:'Ride & fly',nav:'Ride & fly'},{id:'daily',name:'16-day outlook',nav:'16 days'},{id:'history',name:'History',nav:'History'},
  {id:'radar',name:'Radar',nav:'Radar',w:7},{id:'station',name:'Nearest station',w:5},{id:'atmos',name:'Atmosphere',nav:'Atmosphere'},
  {id:'models',name:'Model showdown',nav:'Models'},{id:'sky',name:'Sun & moon',nav:'Sun & moon',w:7},{id:'air',name:'Air quality & UV',w:5},
  {id:'outlooks',name:'National outlooks',nav:'Outlooks',w:6},{id:'afd',name:'Forecast discussion',nav:'Discussion',w:6}];
const SEC=Object.fromEntries(SECTIONS.map(x=>[x.id,{w:12,...x}]));
function readLayout(){
  const v=LS.get('wx:layout',null)||{};const ids=SECTIONS.map(x=>x.id);
  const order=(Array.isArray(v.order)?v.order:[]).filter((id,i,a)=>SEC[id]&&a.indexOf(id)===i);
  ids.forEach((id,i)=>{if(!order.includes(id)){const prev=ids.slice(0,i).reverse().find(p=>order.includes(p));order.splice(prev?order.indexOf(prev)+1:0,0,id)}}); // sections added in a later version land in their usual spot
  return {order,hidden:(Array.isArray(v.hidden)?v.hidden:[]).filter(id=>SEC[id])};
}
let LAYOUT=readLayout();
const shown=id=>!LAYOUT.hidden.includes(id);
function saveLayout(){LS.set('wx:layout',LAYOUT)}
function applyLayout(){
  const main=$('#main');const vis=[];
  LAYOUT.order.forEach(id=>{const el=document.getElementById(id);main.appendChild(el);el.hidden=!shown(id);if(shown(id))vis.push(SEC[id])});
  for(let i=0;i<vis.length;i++){const a=vis[i],b=vis[i+1],ea=document.getElementById(a.id);
    if(a.w<12&&b&&b.w<12){let wa=a.w,wb=b.w;if(wa+wb!==12){wa=6;wb=6}ea.style.setProperty('--span',wa);document.getElementById(b.id).style.setProperty('--span',wb);i++}
    else ea.style.setProperty('--span',12)}
  $('#jumpLinks').innerHTML=LAYOUT.order.filter(id=>shown(id)&&SEC[id].nav).map(id=>`<a href="#${id}">${esc(SEC[id].nav)}</a>`).join('');
  if(!shown('radar')&&window.__map){stopRadar();S.got&&S.got.delete('radar')}
  if(window.__map)window.__map.invalidateSize();
  loadNeeded();
}

/* ============ settings sheet ============ */
const DLG=$('#settings');
$('#openSettings').addEventListener('click',()=>{renderSettings();DLG.showModal()});
DLG.addEventListener('click',e=>{if(e.target===DLG)DLG.close()}); // a click on the dimmed backdrop closes it
function renderSettings(){
  $('#themeList').innerHTML=THEMES.map(t=>`<label class="th"><input type="radio" name="theme" value="${t.id}"${t.id===THEME?' checked':''}><span class="sw" aria-hidden="true">${t.sw.map(c=>`<i style="background:${c}"></i>`).join('')}</span><span><b>${esc(t.name)}</b><span class="small muted">${esc(t.desc)}</span></span></label>`).join('');
  $$('input[name="units"]',DLG).forEach(r=>r.checked=r.value===S.units);
  renderSecList();syncSettings();
}
function syncSettings(){
  if(!DLG.open&&!$('#themeList').children.length)return;
  $('#skyAnimRow').hidden=THEME!=='sky';
  $('#skyAnim').checked=skyAnimOn();
  $('#skyAnim').disabled=RM_MQ.matches;
  $('#skyAnimNote').textContent=RM_MQ.matches?'Your device is set to reduce motion, so the sky stays still.':'Drifting clouds, rain, snow, stars and lightning that match the weather.';
}
function renderSecList(focus){
  const n=LAYOUT.order.length;
  $('#secList').innerHTML=LAYOUT.order.map((id,i)=>{const s=SEC[id],nm=esc(s.name);return `<li data-id="${id}" draggable="true"><span class="grip" aria-hidden="true">⠿</span>
    <label><input type="checkbox" data-show="${id}"${shown(id)?' checked':''}>${nm}</label>
    <span class="mv"><button type="button" class="btn icon" data-mv-up="${id}" aria-label="Move ${nm} up"${i===0?' disabled':''}>↑</button><button type="button" class="btn icon" data-mv-dn="${id}" aria-label="Move ${nm} down"${i===n-1?' disabled':''}>↓</button></span></li>`}).join('');
  if(focus){const el=$(focus,$('#secList'));if(el&&!el.disabled)el.focus();else{const alt=$(focus.replace(/up|dn/,m=>m==='up'?'dn':'up'),$('#secList'));alt&&alt.focus()}}
}
function moveSection(id,to){const o=LAYOUT.order,i=o.indexOf(id);if(i<0||to<0||to>=o.length)return;o.splice(i,1);o.splice(to,0,id);saveLayout();applyLayout()}
$('#themeList').addEventListener('change',e=>{if(e.target.name==='theme')applyTheme(e.target.value)});
$('#skyAnim').addEventListener('change',e=>{LS.set('wx:skyAnim',e.target.checked);skyStart()});
$$('input[name="units"]',DLG).forEach(r=>r.addEventListener('change',()=>{if(!r.checked)return;S.units=r.value;LS.set('wx:units',r.value);renderAll()}));
$('#secList').addEventListener('change',e=>{const id=e.target.dataset.show;if(!id)return;
  LAYOUT.hidden=e.target.checked?LAYOUT.hidden.filter(x=>x!==id):LAYOUT.hidden.concat(id);saveLayout();applyLayout()});
$('#secList').addEventListener('click',e=>{const up=e.target.closest('[data-mv-up]'),dn=e.target.closest('[data-mv-dn]');if(!up&&!dn)return;
  const id=(up||dn).dataset[up?'mvUp':'mvDn'];moveSection(id,LAYOUT.order.indexOf(id)+(up?-1:1));renderSecList(`[data-mv-${up?'up':'dn'}="${id}"]`)});
{ // drag to reorder (mouse); touch screens use the arrow buttons
  const list=$('#secList');let dragId=null;
  const clear=()=>$$('li',list).forEach(li=>li.classList.remove('drop-before','drop-after','dragging'));
  list.addEventListener('dragstart',e=>{const li=e.target.closest('li');if(!li)return;dragId=li.dataset.id;li.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId)});
  list.addEventListener('dragover',e=>{const li=e.target.closest('li');if(!li||!dragId)return;e.preventDefault();const r=li.getBoundingClientRect(),after=e.clientY>r.top+r.height/2;
    $$('li',list).forEach(x=>x.classList.remove('drop-before','drop-after'));if(li.dataset.id!==dragId)li.classList.add(after?'drop-after':'drop-before')});
  list.addEventListener('drop',e=>{const li=e.target.closest('li');if(!li||!dragId)return;e.preventDefault();const after=li.classList.contains('drop-after');clear();
    if(li.dataset.id===dragId)return;const o=LAYOUT.order.filter(x=>x!==dragId);o.splice(o.indexOf(li.dataset.id)+(after?1:0),0,dragId);LAYOUT.order=o;saveLayout();applyLayout();renderSecList();dragId=null});
  list.addEventListener('dragend',()=>{clear();dragId=null});
}
$('#resetLayout').addEventListener('click',()=>{LS.del('wx:layout');LAYOUT=readLayout();applyLayout();renderSecList()});
$('#resetAll').addEventListener('click',()=>{['wx:layout','wx:theme','wx:units','wx:skyAnim','wx:skyState'].forEach(LS.del);
  LAYOUT=readLayout();S.units='us';applyTheme('auto');applyLayout();renderAll();renderSettings()});

/* ============ orchestration ============ */
function renderAll(){renderHeader();renderAlerts();if(S.fc){renderNow();renderHourly();renderDaily();renderAtmos();renderSky()}renderHistory();renderModels();renderEns();renderAir();renderObs();renderAFD();renderOutlooks()}
// Optional data sources and the sections that use them. A source downloads only while at least one of its sections is showing.
const NEEDS={kp:['ride'],aq:['air','now','ride'],models:['models'],ens:['models'],recent:['history'],p92:['history'],hist:['history','daily','now'],
  obs:['station'],afd:['afd'],radar:['radar'],outlooks:['outlooks']};
const NWS_DEP=new Set(['obs','afd','radar','outlooks']); // these wait for the weather.gov lookup (or its failure, outside the U.S.)
function histRefresh(ok){if(!ok()||!S.hist)return;NC=new Map();renderHistory();if(S.fc){renderDaily();renderNow()}}
const LOADERS={
  kp:(L,ok)=>loadKp().then(v=>{if(ok()){S.kp=v;renderGlance()}}).catch(e=>console.warn('kp',e)),
  aq:(L,ok)=>loadAQ(L).then(d=>{if(ok()){S.aq=d;renderAir();renderNow()}}).catch(e=>{if(ok()){S.aq={error:e};renderAir()}}),
  models:(L,ok)=>loadModels(L).then(d=>{if(ok()){S.models=d;renderModels()}}).catch(e=>{if(ok()){S.models={error:e};renderModels()}}),
  ens:(L,ok)=>loadEns(L).then(d=>{if(ok()){S.ens=d;renderEns()}}).catch(e=>{if(ok()){S.ens={error:e};renderEns()}}),
  // This year's record goes first: it is small and is what the year-to-date numbers depend on.
  recent:(L,ok)=>{S.recentErr=null;S.recentPending=true;
    return loadRecent(L).then(r=>{if(ok())S.recent=r}).catch(e=>{if(ok()){S.recentErr=e;console.warn('recent',e)}}).finally(()=>{if(ok()){S.recentPending=false;histRefresh(ok)}})},
  p92:(L,ok)=>loadP92(L).then(j=>{if(!ok())return;const d=j.daily,m={};d.time.forEach((t,i)=>{m[t]={tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],prcp:d.precipitation_sum[i],snow:d.snowfall_sum?d.snowfall_sum[i]:null}});S.p92=m;histRefresh(ok)}).catch(e=>console.warn('p92',e)),
  hist:(L,ok)=>{ // not awaited: the full record can take a minute on first visit
    if(histDone(S.hist)){histRefresh(ok);return null}
    if(!S.hist)$('#histBody').innerHTML='<div class="loading">Loading the climate record…</div>';
    loadHistory(L,part=>{if(ok()&&!histDone(S.hist)){S.hist=part;histRefresh(ok)}})
      .then(h=>{if(ok()){S.hist=h;histRefresh(ok)}})
      .catch(e=>{if(!ok())return;if(S.hist)histMsg("Records before 1991 couldn't load ("+e.message+"). They'll be tried again next time you open the page.");else{S.histErr=e;renderHistory()}});
    return null},
  obs:(L,ok)=>S.nws.none?(renderObs(),null):loadObs(S.nws).then(o=>{if(ok()){S.obs=o;renderObs()}}).catch(e=>{if(ok()){S.obs={error:e};renderObs()}}),
  afd:(L,ok)=>S.nws.none?(renderAFD(),null):(S.nws.cwa?loadAFD(S.nws.cwa):Promise.reject(new Error('no forecast office'))).then(a=>{if(ok()){S.afd=a;renderAFD()}}).catch(e=>{if(ok()){S.afd={error:e};renderAFD()}}),
  radar:()=>{renderRadar();return null},
  outlooks:()=>{renderOutlooks();return null}
};
// Starts every source that a visible section needs and hasn't been fetched for this load yet.
function loadNeeded(){
  if(!S.ok)return [];const L=S.loc,ok=S.ok,ps=[];
  for(const k in LOADERS){if(S.got.has(k)||!NEEDS[k].some(shown)||(NWS_DEP.has(k)&&!S.nws))continue;S.got.add(k);const p=LOADERS[k](L,ok);if(p)ps.push(p)}
  return ps;
}
async function loadAll(){
  const id=++S.loadId;const L=S.loc;const ok=()=>id===S.loadId;const k=locKey(L);S.ok=ok;S.got=new Set();
  if(S.histKey!==k){S.hist=null;S.histKey=k;S.histMsg='';NC=new Map()}
  S.kp=null;S.fc=S.aq=S.models=S.ens=S.nws=S.alerts=S.obs=S.afd=S.recent=S.p92=null;S.histErr=null;
  renderHeader();setStatus('Updating…');
  ['#glance','#actsBody','#now','#hourlyBody','#dailyBody','#atmosBody','#skyBody','#airBody','#obsBody','#afdBody','#olBody','#modelsBody','#ensBody'].forEach(s=>{$(s).innerHTML='<div class="loading">Loading…</div>'});
  $('#alerts').innerHTML='';$('#bestHour').textContent='';
  const lastKey='wx:last:'+k;
  const tasks=[];
  tasks.push(loadForecast(L).then(d=>{if(!ok())return;S.fc=d;LS.set(lastKey,{at:Date.now(),fc:d});renderHeader();renderNow();renderHourly();renderDaily();renderAtmos();renderSky();renderAir();renderHistory();updateSky()})
    .catch(e=>{if(!ok())return;const cached=LS.get(lastKey,null);
      if(cached&&cached.fc){S.fc=cached.fc;S.offline=cached.at;renderNow();renderHourly();renderDaily();renderAtmos();renderSky();renderHistory();updateSky()}
      else['#glance','#actsBody','#now','#hourlyBody','#dailyBody','#atmosBody','#skyBody'].forEach(s=>fail(s,'the forecast',e));throw e}));
  tasks.push(...loadNeeded());
  tasks.push(fetchJSON(`https://api.weather.gov/points/${L.lat.toFixed(4)},${L.lon.toFixed(4)}`,12000).then(async j=>{
      if(!ok())return;S.nws=j.properties;renderHeader();
      await Promise.all([
        fetchJSON(`https://api.weather.gov/alerts/active?point=${L.lat.toFixed(4)},${L.lon.toFixed(4)}`).then(a=>{if(!ok())return;S.alerts=a.features||[];renderAlerts();addAlertShapes();if(S.fc)renderNow()}).catch(e=>console.warn('alerts',e)),
        ...loadNeeded()]);
    }).catch(e=>{if(!ok())return;if(S.nws){console.warn('nws',e);return} // lookup failed: outside the U.S. (or weather.gov is down)
      S.nws={none:true};$('#alerts').innerHTML='';return Promise.all(loadNeeded())}));
  const res=await Promise.allSettled(tasks);
  if(!ok())return;S.lastLoad=Date.now();
  const now=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  setStatus(S.offline&&res[0].status==='rejected'?`${navigator.onLine?"Couldn't reach the forecast service.":"You're offline."} Showing the forecast saved ${new Date(S.offline).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'})}.`:`Updated ${now}. Refreshes every time you open this page.`);
  S.offline=null;
}
applyLayout();renderHeader();loadAll();if(THEME==='sky')updateSky();
addEventListener('online',()=>loadAll()); // pick up live data as soon as the connection comes back
// Offline support (sw.js). Service workers only run on a real web address, not when the file is opened from disk.
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn('offline support unavailable',e)));
