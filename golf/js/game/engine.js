// Single shared WebGL renderer + render loop.
import * as THREE from 'three';
import { getSettings } from '../core/store.js';

let renderer = null, view = null, raf = 0, last = 0, canvasEl = null;
export const engine = { renderer: null, quality: 'high', time: 0 };

export function qualityLevel() {
  const q = getSettings().quality;
  if (q && q !== 'auto') return q;
  const dpr = window.devicePixelRatio || 1;
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (!mobile) return 'high';
  return dpr >= 3 ? 'high' : 'medium';
}

export function initEngine(canvas) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  engine.renderer = renderer;
  applyQuality();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && view) startLoop(); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
  resize();
}
export function applyQuality() {
  if (!renderer) return;
  const q = qualityLevel();
  engine.quality = q;
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : 1);
  renderer.shadowMap.enabled = q !== 'low';
  resize();
}
export function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  canvasEl.style.width = w + 'px'; canvasEl.style.height = h + 'px';
  if (view?.camera) { view.camera.aspect = w / h; view.camera.updateProjectionMatrix(); }
  view?.onResize?.(w, h);
}
export function setView(v) {
  view = v;
  if (v?.camera) { v.camera.aspect = window.innerWidth / window.innerHeight; v.camera.updateProjectionMatrix(); }
  canvasEl.style.visibility = v ? 'visible' : 'hidden';
  if (v) startLoop(); else cancelAnimationFrame(raf);
}
export function getView() { return view; }
function startLoop() {
  cancelAnimationFrame(raf);
  last = performance.now();
  const loop = (now) => {
    if (!view || document.hidden) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    engine.time += dt;
    try { view.update?.(dt, engine.time); } catch (e) { console.error(e); }
    if (view?.scene && view?.camera) renderer.render(view.scene, view.camera);
  };
  raf = requestAnimationFrame(loop);
}
