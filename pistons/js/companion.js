/* Pistons Pregame + Postgame: theme switcher shared with the Season Hub and Yearbook (Oct 17, 2026).
   Same rules as the hub: an explicit Blue / Red / Light choice is saved in localStorage "pistons-skin";
   with no choice saved the page follows the device's light/dark setting. */
(function(){
  var root = document.documentElement;
  var store = {
    get: function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set: function(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  };
  function effectiveSkin(){
    var pref = store.get("pistons-skin");
    if (pref) return pref;
    var host = root.getAttribute("data-theme");
    if (host === "light") return "light";
    if (host === "dark") return "navy";
    return (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "navy" : "light";
  }
  function paint(){
    var s = effectiveSkin();
    document.querySelectorAll(".skin button").forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.skin === s)); });
  }
  function apply(){
    var pref = store.get("pistons-skin");
    if (pref) root.setAttribute("data-skin", pref); else root.removeAttribute("data-skin");
    paint();
    try { document.dispatchEvent(new CustomEvent("pistons-skin")); } catch(e){}
  }
  document.querySelectorAll(".skin button").forEach(function(b){
    b.addEventListener("click", function(){ store.set("pistons-skin", b.dataset.skin); apply(); });
  });
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint); } catch(e){}
  /* another tab (the hub or yearbook) changed the theme */
  window.addEventListener("storage", function(e){ if (e.key === "pistons-skin") apply(); });
  apply();
})();
