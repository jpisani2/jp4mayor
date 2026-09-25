/* Clock Out — color themes. Tap the theme button to cycle; press and hold (or right-click, or shift-click) to pick.
   The colors are in css/styles.css; the list is CO.config.PALS. */
(function(CO){
"use strict";
const {PALS} = CO.config;
const {$, store, toast, openPop, closePop} = CO.util;

const palBtn = $("palBtn");

function applyPal(id, announce){
  const p = PALS.find(x => x.id === id) || PALS[0];
  const r = document.documentElement;
  r.dataset.pal = p.id;
  r.dataset.theme = p.dark ? "dark" : "light";
  $("palName").textContent = p.name;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", p.tc));
  store.set("clockout.pal", p.id);
  document.querySelectorAll("#palGrid button").forEach(b => b.setAttribute("aria-pressed", b.dataset.pal === p.id));
  if(announce) toast(p.name + (p.dark ? " · dark" : " · light"));
}

$("palGrid").innerHTML = PALS.map(p => `<button type="button" data-pal="${p.id}" aria-pressed="false"><span class="sw"><i style="background:${p.sw[0]}"></i><i style="background:${p.sw[1]}"></i><i style="background:${p.sw[2]}"></i></span><span class="nm">${p.name}<small>${p.dark ? "Dark" : "Light"}</small></span></button>`).join("");
$("palGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-pal]");
  if(b){ applyPal(b.dataset.pal, true); closePop("palPop"); }
});

/* press and hold opens the picker; the click that follows the release is then ignored */
let pressT = null, longFired = false;
palBtn.addEventListener("pointerdown", () => {
  longFired = false;
  clearTimeout(pressT);
  pressT = setTimeout(() => { longFired = true; openPop("palPop"); }, 500);
});
["pointerup", "pointerleave", "pointercancel"].forEach(ev => palBtn.addEventListener(ev, () => clearTimeout(pressT)));
palBtn.addEventListener("contextmenu", e => { e.preventDefault(); clearTimeout(pressT); longFired = true; openPop("palPop"); });
palBtn.addEventListener("click", e => {
  if(longFired){ longFired = false; return; }
  if(e.shiftKey || e.altKey){ openPop("palPop"); return; }
  const i = PALS.findIndex(p => p.id === document.documentElement.dataset.pal);
  applyPal(PALS[(i + 1) % PALS.length].id, true);
});

/* first visit: follow the device's light/dark setting */
applyPal(store.get("clockout.pal", null) || (matchMedia("(prefers-color-scheme: dark)").matches ? "afterhours" : "classic"), false);
})(window.CO);
