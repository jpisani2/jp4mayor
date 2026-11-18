// App bootstrap & navigation.
import { loadSettings, requestPersist, db } from './core/store.js';
import { audioUnlock, applyVolumes } from './core/audio.js';
import { initEngine, setView } from './game/engine.js';
import { PlaySession } from './game/play.js';
import { Editor } from './editor/editor.js';
import { initScreens, showHome, showLibrary, importPayload, disposeHomeBg } from './ui/screens.js';
import { toast } from './ui/ui.js';
import { normalizeHole } from './core/hole.js';

const api = {
  play(holes, opts = {}) {
    setView(null);
    disposeHomeBg();
    document.querySelectorAll('.screen').forEach((s) => s.remove());
    const s = new PlaySession({
      holes: holes.map(normalizeHole), index: opts.index || 0, round: opts.round || null,
      onExit: (res) => { if (res.edit) api.edit(res.edit); else showHome(); },
    });
    window.__ff.session = s;
    s.start().catch((e) => { console.error(e); toast('Something went wrong loading the hole'); showHome(); });
  },
  edit(hole) {
    setView(null);
    document.querySelectorAll('.screen').forEach((s) => s.remove());
    window.__ff.editor = new Editor({
      hole,
      onExit: (h) => { showLibrary(false, h.status === 'saved' ? 'saved' : 'draft'); },
      onPlay: (h) => api.play([h], {}),
    });
  },
};

window.__ff = { api, db };
async function boot() {
  await loadSettings();
  initEngine(document.getElementById('gl'));
  initScreens(api);
  applyVolumes();
  document.addEventListener('pointerdown', () => { audioUnlock(); requestPersist(); }, { once: true });
  // prevent iOS double-tap zoom & pinch zoom of the page
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  await showHome();
  document.getElementById('splash')?.classList.add('gone');
  setTimeout(() => document.getElementById('splash')?.remove(), 800);
  // shared code via link
  const m = location.hash.match(/import=([^&]+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    try { await importPayload(decodeURIComponent(m[1])); } catch (e) { toast(e.message || 'Could not import shared code'); }
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  void db;
}
boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:16px system-ui;padding:24px;text-align:center;background:#0d1a12">Fairway Forge couldn't start: ${String(e.message || e)}</div>`);
});
