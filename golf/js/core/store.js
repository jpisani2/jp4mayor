// Persistent storage on IndexedDB. Everything lives on this device, inside the
// installed home-screen app's own storage.
const DB_NAME = 'fairway-forge';
const DB_VER = 1;
const STORES = ['holes', 'courses', 'plays', 'rounds', 'kv'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'kv' ? 'k' : 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((r) => { out = r; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async all(store) { return tx(store, 'readonly', (s) => reqP(s.getAll())); },
  async get(store, id) { return tx(store, 'readonly', (s) => reqP(s.get(id))); },
  async put(store, obj) { return tx(store, 'readwrite', (s) => reqP(s.put(obj))); },
  async del(store, id) { return tx(store, 'readwrite', (s) => reqP(s.delete(id))); },
  async clear(store) { return tx(store, 'readwrite', (s) => reqP(s.clear())); },
};

// Settings ----------------------------------------------------------------------------
export const DEFAULT_SETTINGS = {
  units: 'y', swing: 'swipe', difficulty: 'amateur', quality: 'auto', volume: 0.8, ambience: 0.7, sfx: 0.9,
  haptics: true, power: 1, tee: 'blue', golfer: { shirt: '#1f6fd1', pants: '#2b2f38', cap: '#ffffff', skin: '#e0ac85' },
  showTracer: true, intro: true, camShake: true, leftHanded: false,
};
let settings = null;
export async function loadSettings() {
  try {
    const r = await db.get('kv', 'settings');
    settings = { ...DEFAULT_SETTINGS, ...(r?.v || {}) };
    settings.golfer = { ...DEFAULT_SETTINGS.golfer, ...(settings.golfer || {}) };
  } catch { settings = { ...DEFAULT_SETTINGS }; }
  return settings;
}
export function getSettings() { return settings || { ...DEFAULT_SETTINGS }; }
export async function saveSettings(patch) {
  settings = { ...getSettings(), ...patch };
  await db.put('kv', { k: 'settings', v: settings });
  return settings;
}
export async function kvGet(k) { try { return (await db.get('kv', k))?.v; } catch { return undefined; } }
export async function kvSet(k, v) { return db.put('kv', { k, v }); }

export async function requestPersist() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (already) return true;
      return await navigator.storage.persist();
    }
  } catch { /* ignore */ }
  return false;
}
export async function storageInfo() {
  const out = { persisted: false, usage: 0, quota: 0 };
  try {
    if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; }
  } catch { /* ignore */ }
  return out;
}

// Backup ----------------------------------------------------------------------------------
export async function exportAll() {
  const data = { app: 'fairway-forge', v: 1, date: Date.now() };
  for (const s of STORES) data[s] = await db.all(s);
  return data;
}
export async function importAll(data, merge = true) {
  if (!data || data.app !== 'fairway-forge') throw new Error('Not a Fairway Forge backup file');
  for (const s of STORES) {
    if (!Array.isArray(data[s])) continue;
    if (!merge) await db.clear(s);
    for (const o of data[s]) await db.put(s, o);
  }
  await loadSettings();
}
