// Share codes: compress hole/course JSON into a URL-safe string.
const PREFIX = 'FF1';

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
// strip volatile fields & round numbers to shrink codes
function slim(hole) {
  const h = JSON.parse(JSON.stringify(hole, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
  delete h.thumb; delete h.status; delete h.created; delete h.updated;
  return h;
}
export async function encodePayload(obj) {
  const json = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    const z = await pipe(json, new CompressionStream('deflate-raw'));
    return `${PREFIX}z.${b64url(z)}`;
  }
  return `${PREFIX}j.${b64url(json)}`;
}
export async function decodePayload(code) {
  code = code.trim();
  const m = code.match(/FF1([zj])\.([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('That does not look like a Fairway Forge code');
  let bytes = unb64url(m[2]);
  if (m[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function encodeHole(hole) { return encodePayload({ t: 'hole', hole: slim(hole) }); }
export async function encodeCourse(course, holes) { return encodePayload({ t: 'course', course: { name: course.name, holes: course.holes }, holes: holes.map(slim) }); }
export function shareLink(code) {
  const base = location.href.split('#')[0];
  return `${base}#import=${code}`;
}
