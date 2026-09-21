/* app.js — renders the site from content.js. You shouldn't need to edit this. */
(function () {
  "use strict";

  var S = (typeof SITE === "object" && SITE) || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var TAB_IDS = ["projects", "photos", "videos", "about"];
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* ---------- helpers ---------- */

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== "") n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function ext(url) {
    return /^https?:/.test(url || "") ? { rel: "noopener", target: "_blank" } : {};
  }
  function link(label, url, cls) {
    var a = el("a", { href: url || "#", text: label, class: cls || null });
    var e = ext(url);
    if (e.rel) { a.setAttribute("rel", e.rel); a.setAttribute("target", e.target); }
    return a;
  }

  function hash(str) {
    var h = 0, i;
    str = String(str || "x");
    for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // Parsed by hand so a date never shifts a day across time zones.
  function fmtDate(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(iso || "");
    return Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1];
  }

  // A calm, deterministic stand-in for any picture that isn't there yet.
  function placeholder(seed, ratio, label) {
    var h = hash(seed);
    var hue = 152 + (h % 54);
    var dark = document.documentElement.classList.contains("is-dark");
    var a = "hsl(" + hue + " 13% " + (dark ? 21 : 89) + "%)";
    var b = "hsl(" + ((hue + 26) % 360) + " 15% " + (dark ? 14 : 81) + "%)";
    var d = el("div", { class: "ph" });
    d.style.setProperty("--ratio", ratio || "4 / 3");
    d.style.background = "linear-gradient(" + (120 + (h % 110)) + "deg," + a + "," + b + ")";
    d.textContent = (label === undefined || label === null) ? "no image yet" : label;
    return d;
  }

  function swapOnError(img, seed, ratio, label) {
    img.addEventListener("error", function () {
      if (img.parentNode) img.parentNode.replaceChild(placeholder(seed, ratio, label), img);
    });
  }

  // Accepts a watch URL, a youtu.be link, an embed or shorts URL, or a bare ID.
  function youtubeId(input) {
    var s = String(input || "").trim();
    if (!s) return "";
    if (/^[\w-]{11}$/.test(s)) return s;
    var m = s.match(/[?&]v=([\w-]{11})/) ||
            s.match(/youtu\.be\/([\w-]{11})/) ||
            s.match(/\/(?:embed|v|shorts|live)\/([\w-]{11})/);
    return m ? m[1] : "";
  }

  function emptyNote(html) { return el("div", { class: "empty", html: html }); }

  function projectById(id) {
    var list = S.projects || [], i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function sortedLog(p) {
    return (p.log || []).slice().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  /* ---------- lightbox (works with any list of photos) ---------- */

  var lbList = [], lbIndex = 0;

  function openLightbox(list, i) {
    lbList = list || [];
    if (!lbList.length) return;
    lbIndex = (i + lbList.length) % lbList.length;
    var p = lbList[lbIndex];
    var stage = $("#lb-stage");
    stage.textContent = "";

    if (p.src) {
      var img = el("img", { src: p.src, alt: p.caption || "" });
      swapOnError(img, p.caption || p.src, "3 / 2", "this picture isn't in the images folder yet");
      stage.appendChild(img);
    } else {
      stage.appendChild(placeholder(p.caption || lbIndex, "3 / 2", "no image yet"));
    }

    $("#lb-caption").textContent = [p.caption, p.date].filter(Boolean).join("  ·  ");
    $("#lb-count").textContent = (lbIndex + 1) + " / " + lbList.length;
    $("#lb-nav-wrap").hidden = lbList.length < 2;
    $("#lightbox").hidden = false;
    document.body.style.overflow = "hidden";
    $("#lb-close").focus();
  }

  function closeLightbox() {
    $("#lightbox").hidden = true;
    document.body.style.overflow = "";
  }

  function wireLightbox() {
    if (!$("#lightbox")) return;
    $("#lb-close").addEventListener("click", closeLightbox);
    $("#lb-prev").addEventListener("click", function () { openLightbox(lbList, lbIndex - 1); });
    $("#lb-next").addEventListener("click", function () { openLightbox(lbList, lbIndex + 1); });
    $("#lightbox").addEventListener("click", function (e) {
      if (e.target === e.currentTarget || e.target.id === "lb-stage") closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if ($("#lightbox").hidden) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") openLightbox(lbList, lbIndex - 1);
      if (e.key === "ArrowRight") openLightbox(lbList, lbIndex + 1);
    });
  }

  // One clickable photo tile. `list` is what the lightbox pages through.
  function photoTile(p, list, i, cls) {
    var ratios = ["4 / 3", "3 / 4", "1 / 1", "3 / 2", "4 / 5"];
    var ratio = ratios[hash(p.caption || p.src || i) % ratios.length];
    var fig = el("figure", { class: cls || "photo", role: "button", tabindex: "0",
      "aria-label": "Open picture" + (p.caption ? ": " + p.caption : "") });
    fig.style.margin = "0";

    if (p.src) {
      var img = el("img", { src: p.src, alt: p.caption || "", loading: "lazy" });
      swapOnError(img, p.caption || p.src, ratio, "");
      fig.appendChild(img);
    } else {
      fig.appendChild(placeholder(p.caption || i, ratio, ""));
    }

    if (cls !== "log-photo" && (p.caption || p.date)) {
      fig.appendChild(el("figcaption", {}, [
        el("span", { text: p.caption || "" }),
        p.date ? el("span", { class: "date", text: p.date }) : null
      ]));
    }

    function open() { openLightbox(list, i); }
    fig.addEventListener("click", open);
    fig.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    return fig;
  }

  /* ---------- shared header ---------- */

  function renderHeader() {
    if ($("#site-name")) $("#site-name").textContent = S.name || "Your name";
    var t = $("#tagline");
    if (t) { t.textContent = S.tagline || ""; t.hidden = !S.tagline; }

    var box = $("#masthead-links");
    if (box) {
      box.textContent = "";
      (S.links || []).forEach(function (l) {
        if (l && l.label) box.appendChild(link(l.label, l.url));
      });
    }
    var f = $("#footer-name");
    if (f) f.textContent = (S.name || "") + " · " + new Date().getFullYear();
  }

  /* ---------- index: projects list ---------- */

  var activeTag = "all";

  function allTags() {
    var seen = {}, out = [];
    (S.projects || []).forEach(function (p) {
      (p.tags || []).forEach(function (t) { if (t && !seen[t]) { seen[t] = 1; out.push(t); } });
    });
    return out.sort();
  }

  function renderFilters() {
    var box = $("#filters");
    var tags = allTags();
    box.textContent = "";
    if (tags.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    ["all"].concat(tags).forEach(function (t) {
      var b = el("button", { class: "chip", type: "button", "aria-pressed": String(t === activeTag),
        text: t === "all" ? "everything" : t });
      b.addEventListener("click", function () { activeTag = t; renderFilters(); renderProjects(); });
      box.appendChild(b);
    });
  }

  function renderProjects() {
    var list = $("#projects-list");
    list.textContent = "";
    var items = (S.projects || []).filter(function (p) {
      return activeTag === "all" || (p.tags || []).indexOf(activeTag) > -1;
    });

    if (!items.length) {
      list.appendChild(emptyNote("No projects yet. Add them to the <code>projects</code> list in <code>content.js</code>."));
      return;
    }

    items.forEach(function (p) {
      var href = (p.page && p.id) ? "project.html?id=" + encodeURIComponent(p.id) : null;

      var meta = el("div", { class: "project-meta" });
      if (p.year) meta.appendChild(el("span", { class: "mono project-year", text: p.year }));
      if (p.status) meta.appendChild(el("span", {
        class: "status", "data-s": String(p.status).toLowerCase(), text: p.status }));

      var heading = el("h3", {});
      heading.appendChild(href ? el("a", { href: href, text: p.title || "Untitled" })
                               : document.createTextNode(p.title || "Untitled"));

      var body = el("div", {}, [heading]);
      if (p.summary) body.appendChild(el("p", { text: p.summary }));

      var foot = el("div", { class: "project-foot" });
      (p.tags || []).forEach(function (t) { foot.appendChild(el("span", { class: "tag", text: t })); });

      var links = el("div", { class: "project-links" });
      if (href) {
        var n = (p.log || []).length;
        links.appendChild(el("a", { href: href,
          text: n ? "Open (" + n + " updates)" : "Open" }));
      }
      (p.links || []).forEach(function (l) { if (l && l.label) links.appendChild(link(l.label, l.url)); });
      if (links.children.length) foot.appendChild(links);
      if (foot.children.length) body.appendChild(foot);

      var row = el("article", { class: "project" }, [meta, body]);

      if (p.image) {
        var thumb = el("div", { class: "project-thumb" });
        var img = el("img", { src: p.image, alt: p.title || "", loading: "lazy" });
        swapOnError(img, p.title, "4 / 3", "");
        if (href) { var a = el("a", { href: href }); a.appendChild(img); thumb.appendChild(a); }
        else thumb.appendChild(img);
        row.appendChild(thumb);
      }
      list.appendChild(row);
    });
  }

  /* ---------- index: photos, videos, about ---------- */

  function renderPhotos() {
    var grid = $("#photo-grid");
    grid.textContent = "";
    var photos = S.photos || [];
    if (!photos.length) {
      grid.appendChild(emptyNote("No pictures yet. Drop some into <code>images/pictures</code> (or add them to the <code>photos</code> list in <code>content.js</code>) and they'll show up here."));
      return;
    }
    photos.forEach(function (p, i) {
      var tile = photoTile(p, photos, i);
      tile.style.marginBottom = "14px";
      grid.appendChild(tile);
    });
  }

  function videoCard(v) {
    var id = youtubeId(v.youtube);
    var frame = el("div", { class: "video-frame" });
    var btn = el("button", { class: "video-facade", type: "button",
      "aria-label": "Play " + (v.title || "video") });
    var thumb = el("img", { src: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", alt: "", loading: "lazy" });
    swapOnError(thumb, id, "16 / 9", "");
    btn.appendChild(thumb);
    btn.appendChild(el("div", { class: "play" }, [
      el("span", { html: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z"/></svg>' })
    ]));
    btn.addEventListener("click", function () {
      frame.textContent = "";
      frame.appendChild(el("iframe", {
        src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1",
        title: v.title || "YouTube video",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowfullscreen: "", referrerpolicy: "strict-origin-when-cross-origin"
      }));
    });
    frame.appendChild(btn);

    var card = el("article", { class: "video" }, [frame, el("h3", { text: v.title || "Untitled video" })]);
    if (v.note) card.appendChild(el("p", { text: v.note }));
    if (v.date) card.appendChild(el("span", { class: "mono date", text: v.date }));
    return card;
  }

  function renderVideos() {
    var grid = $("#video-grid");
    grid.textContent = "";
    var vids = (S.videos || []).filter(function (v) { return v && youtubeId(v.youtube); });
    if (!vids.length) {
      grid.appendChild(emptyNote("No videos yet. Add them to the <code>videos</code> list in <code>content.js</code>."));
      return;
    }
    vids.forEach(function (v) { grid.appendChild(videoCard(v)); });
  }

  function renderAbout() {
    var box = $("#about-body");
    box.textContent = "";
    var paras = S.about || [];
    if (!paras.length) {
      box.appendChild(emptyNote("Nothing here yet. Add paragraphs to <code>about</code> in <code>content.js</code>."));
      return;
    }
    paras.forEach(function (t) { box.appendChild(el("p", { text: t })); });
  }

  /* ---------- index: tabs ---------- */

  function show(name) {
    if (TAB_IDS.indexOf(name) === -1) name = "projects";
    TAB_IDS.forEach(function (id) {
      $("#sec-" + id).hidden = id !== name;
      var t = $("#tab-" + id);
      if (t) t.setAttribute("aria-selected", String(id === name));
    });
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  }

  function setCounts() {
    var counts = {
      projects: (S.projects || []).length,
      photos: (S.photos || []).length,
      videos: (S.videos || []).length
    };
    Object.keys(counts).forEach(function (k) {
      var c = $("#count-" + k);
      if (c) c.textContent = counts[k] ? counts[k] : "";
    });
  }

  function initIndex() {
    renderFilters();
    renderProjects();
    renderPhotos();
    renderVideos();
    renderAbout();
    setCounts();
    TAB_IDS.forEach(function (id) {
      var t = $("#tab-" + id);
      if (t) t.addEventListener("click", function () { show(id); window.scrollTo({ top: 0, behavior: "smooth" }); });
    });
    show(location.hash.slice(1) || "projects");
    window.addEventListener("hashchange", function () { show(location.hash.slice(1)); });
  }

  /* ---------- project page ---------- */

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  }

  function renderProject() {
    var root = $("#project-root");
    var p = projectById(param("id"));

    if (!p) {
      root.appendChild(el("h1", { class: "project-title", text: "Project not found" }));
      root.appendChild(emptyNote('That project isn\'t in <code>content.js</code>. <a href="projects.html">Back to all projects</a>.'));
      return;
    }

    document.title = (p.title || "Project") + " · " + (S.name || "");

    // header
    var head = el("header", { class: "project-head" });
    var meta = el("div", { class: "project-head-meta" });
    if (p.status) meta.appendChild(el("span", {
      class: "status", "data-s": String(p.status).toLowerCase(), text: p.status }));
    if (p.year) meta.appendChild(el("span", { class: "mono", text: p.year }));
    (p.tags || []).forEach(function (t) { meta.appendChild(el("span", { class: "tag", text: t })); });
    head.appendChild(meta);
    head.appendChild(el("h1", { class: "project-title", text: p.title || "Untitled" }));
    if (p.summary) head.appendChild(el("p", { class: "project-lede", text: p.summary }));

    if ((p.links || []).length) {
      var lrow = el("div", { class: "project-links head-links" });
      p.links.forEach(function (l) { if (l && l.label) lrow.appendChild(link(l.label, l.url)); });
      head.appendChild(lrow);
    }
    root.appendChild(head);

    // facts
    if ((p.facts || []).length) {
      var facts = el("dl", { class: "facts" });
      p.facts.forEach(function (f) {
        if (!f || !f.label) return;
        facts.appendChild(el("div", { class: "fact" }, [
          el("dt", { text: f.label }),
          el("dd", { text: f.value === undefined || f.value === "" ? "—" : String(f.value) })
        ]));
      });
      root.appendChild(facts);
    }

    // demo
    if (p.demo && p.demo.src) {
      var sec = el("section", { class: "block" }, [el("h2", { class: "block-title", text: "Demo" })]);
      var frame = el("div", { class: "demo-frame" });
      frame.style.setProperty("--ratio", p.demo.ratio || "16 / 10");
      frame.appendChild(el("iframe", {
        src: p.demo.src,
        title: (p.title || "Project") + " demo",
        loading: "lazy",
        allowfullscreen: ""
      }));
      sec.appendChild(frame);
      var foot = el("p", { class: "demo-note" });
      if (p.demo.note) foot.appendChild(document.createTextNode(p.demo.note + " "));
      foot.appendChild(link("Open it on its own →", p.demo.src));
      sec.appendChild(foot);
      root.appendChild(sec);
    }

    // write-up
    if ((p.about || []).length) {
      var about = el("section", { class: "block prose" });
      p.about.forEach(function (t) { about.appendChild(el("p", { text: t })); });
      root.appendChild(about);
    }

    // log
    var entries = sortedLog(p);
    var logSec = el("section", { class: "block" }, [
      el("h2", { class: "block-title", text: entries.length ? "Log" : "Log" })
    ]);

    if (!entries.length) {
      logSec.appendChild(emptyNote("Nothing logged yet. Add the first entry to this project's <code>log</code> in <code>content.js</code>."));
    } else {
      var log = el("div", { class: "log" });
      entries.forEach(function (e) {
        var photos = (e.photos || []).map(function (src) {
          return { src: src, caption: e.title || "", date: fmtDate(e.date) };
        });

        var bodyEl = el("div", { class: "log-body" });
        if (e.title) bodyEl.appendChild(el("h3", { text: e.title }));
        if (e.note) bodyEl.appendChild(el("p", { text: e.note }));
        if (photos.length) {
          var grid = el("div", { class: "log-photos" });
          photos.forEach(function (ph, i) { grid.appendChild(photoTile(ph, photos, i, "log-photo")); });
          bodyEl.appendChild(grid);
        }

        log.appendChild(el("article", { class: "log-entry" }, [
          el("div", { class: "log-date mono", text: fmtDate(e.date) }),
          bodyEl
        ]));
      });
      logSec.appendChild(log);
    }
    root.appendChild(logSec);

    // next / previous project
    var all = (S.projects || []).filter(function (x) { return x.page && x.id; });
    var idx = all.indexOf(p);
    if (all.length > 1 && idx > -1) {
      var nav = el("nav", { class: "project-nav", "aria-label": "Other projects" });
      var prev = all[idx - 1], next = all[idx + 1];
      nav.appendChild(prev
        ? el("a", { href: "project.html?id=" + encodeURIComponent(prev.id),
            html: '<span class="mono">Previous</span>' + prev.title })
        : el("span", {}));
      nav.appendChild(next
        ? el("a", { class: "to-next", href: "project.html?id=" + encodeURIComponent(next.id),
            html: '<span class="mono">Next</span>' + next.title })
        : el("span", {}));
      root.appendChild(nav);
    }
  }

  /* ---------- theme ---------- */

  function syncDarkFlag() {
    var stamped = document.documentElement.getAttribute("data-theme");
    var dark = stamped ? stamped === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("is-dark", dark);
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
    syncDarkFlag();

    var btn = $("#theme-btn");
    if (btn) btn.addEventListener("click", function () {
      var next = document.documentElement.classList.contains("is-dark") ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      syncDarkFlag();
    });

    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncDarkFlag);
    } catch (e) {}
  }

  /* ---------- auto-added pictures ----------
     images/photos-manifest.json is regenerated by a GitHub Action whenever
     a file is dropped into images/pictures/ (see that folder's README).
     This merges those into S.photos before the Pictures tab is drawn, so
     new pictures show up with no edits to content.js. If the fetch fails
     (e.g. opening the site from a local file), the page just falls back to
     whatever's in content.js. ---------- */

  function mergeAutoPhotos(auto) {
    if (!Array.isArray(auto) || !auto.length) return;
    var seen = {};
    (S.photos || []).forEach(function (p) { if (p && p.src) seen[p.src] = true; });
    var merged = (S.photos || []).slice();
    auto.forEach(function (p) { if (p && p.src && !seen[p.src]) merged.push(p); });
    merged.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
    S.photos = merged;
  }

  function loadAutoPhotos(done) {
    if (typeof fetch !== "function") { done(); return; }
    fetch("images/photos-manifest.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(mergeAutoPhotos)
      .catch(function () {})
      .then(done, done);
  }

  /* ---------- boot ---------- */

  function init() {
    initTheme();
    renderHeader();
    wireLightbox();
    if ($("#project-root")) { renderProject(); return; }
    if (!$("#projects-list")) return;
    loadAutoPhotos(initIndex);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
