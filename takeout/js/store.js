// Personal data: visits, dishes, per-restaurant prefs, settings.
// Cloud (Supabase) when configured, otherwise this browser's localStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const LOCAL_KEY = "takeout.v1";
const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

let sb = null;
let user = null;
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ---- local ---------------------------------------------------------------------
function readLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    if (d) return d;
  } catch {}
  return { visits: [], prefs: {}, settings: {} };
}
function writeLocal(d) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); return true; } catch { return false; }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

// ---- lifecycle -----------------------------------------------------------------
export async function init() {
  if (!cloudConfigured) return { mode: "local", user: null };
  const { createClient } = await import(SUPABASE_ESM);
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  const { data } = await sb.auth.getSession();
  user = data.session?.user || null;
  if (user) await migrateLocal();
  return { mode: user ? "cloud" : "signed-out", user };
}

export const mode = () => (sb && user ? "cloud" : cloudConfigured ? "signed-out" : "local");

export async function signIn(email) {
  const redirect = location.origin + location.pathname;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw error;
}
export async function signOut() { await sb?.auth.signOut(); user = null; }

// ---- reads ---------------------------------------------------------------------
// -> { visits:[{..., dishes:[]}], prefs: Map(restaurant_id -> pref), settings:{} }
export async function loadAll() {
  if (mode() !== "cloud") {
    const d = readLocal();
    return { visits: d.visits, prefs: new Map(Object.entries(d.prefs)), settings: d.settings || {} };
  }
  const [v, p, s] = await Promise.all([
    sb.from("visits").select("*, dishes(*)").order("visited_on", { ascending: false }),
    sb.from("prefs").select("*"),
    sb.from("settings").select("data").maybeSingle(),
  ]);
  for (const r of [v, p, s]) if (r.error) throw r.error;
  return {
    visits: v.data,
    prefs: new Map(p.data.map((x) => [x.restaurant_id, x])),
    settings: s.data?.data || {},
  };
}

// ---- writes --------------------------------------------------------------------
// visit: {restaurant_id, visited_on, mode, rating, notes, would_return}; dishes: [{name, rating, notes, order_again}]
export async function saveVisit(visit, dishes = []) {
  dishes = dishes.filter((d) => d.name && d.name.trim());
  if (mode() !== "cloud") {
    const d = readLocal();
    const id = visit.id || uid();
    const rec = { ...visit, id, dishes: dishes.map((x) => ({ ...x, id: x.id || uid(), visit_id: id })) };
    d.visits = [rec, ...d.visits.filter((x) => x.id !== id)];
    writeLocal(d);
    return rec;
  }
  const { dishes: _ignored, ...row } = visit;
  const { data: saved, error } = await sb.from("visits").upsert(row).select().single();
  if (error) throw error;
  if (visit.id) await sb.from("dishes").delete().eq("visit_id", saved.id);
  let savedDishes = [];
  if (dishes.length) {
    const { data, error: e2 } = await sb.from("dishes")
      .insert(dishes.map(({ id, visit_id, user_id, created_at, ...x }) => ({ ...x, visit_id: saved.id }))).select();
    if (e2) throw e2;
    savedDishes = data;
  }
  return { ...saved, dishes: savedDishes };
}

export async function deleteVisit(id) {
  if (mode() !== "cloud") {
    const d = readLocal();
    d.visits = d.visits.filter((x) => x.id !== id);
    writeLocal(d);
    return;
  }
  const { error } = await sb.from("visits").delete().eq("id", id);
  if (error) throw error;
}

// patch: {favorite?, hidden?, my_tags?, notes?}
export async function setPref(restaurant_id, patch) {
  if (mode() !== "cloud") {
    const d = readLocal();
    d.prefs[restaurant_id] = { restaurant_id, ...(d.prefs[restaurant_id] || {}), ...patch };
    writeLocal(d);
    return d.prefs[restaurant_id];
  }
  const { data, error } = await sb.from("prefs").upsert({ restaurant_id, ...patch }, { onConflict: "user_id,restaurant_id" }).select().single();
  if (error) throw error;
  return data;
}

export async function saveSettings(settings) {
  if (mode() !== "cloud") {
    const d = readLocal();
    d.settings = settings;
    writeLocal(d);
    return;
  }
  const { error } = await sb.from("settings").upsert({ data: settings }, { onConflict: "user_id" });
  if (error) throw error;
}

// Backup of everything personal, cloud or local.
export async function exportAll() {
  const { visits, prefs, settings } = await loadAll();
  return { exported: new Date().toISOString(), visits, prefs: Object.fromEntries(prefs), settings };
}

// After first sign-in, move anything saved on this device into the account.
async function migrateLocal() {
  const d = readLocal();
  if (!d.visits.length && !Object.keys(d.prefs).length) return;
  try {
    for (const v of d.visits) {
      const { id, dishes, ...row } = v;
      await saveVisit(row, dishes || []);
    }
    for (const [rid, p] of Object.entries(d.prefs)) {
      const { restaurant_id, ...patch } = p;
      await setPref(rid, patch);
    }
    if (Object.keys(d.settings || {}).length) await saveSettings(d.settings);
    try { localStorage.removeItem(LOCAL_KEY); } catch {}
  } catch (e) {
    console.warn("Local → cloud migration incomplete; local copy kept.", e);
  }
}
