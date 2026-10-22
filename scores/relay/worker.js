// Optional fallback — only needed if ESPN ever blocks direct browser requests.
// Deploy as a free Cloudflare Worker, then set RELAY in js/config.js to the
// worker's URL (e.g. 'https://scores-relay.yourname.workers.dev/').
// It only forwards requests to ESPN's public site API.
export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const target = new URL(request.url).searchParams.get('url') || '';
    if (!/^https:\/\/site\.api\.espn\.com\/apis\/(site\/)?v2\/sports\//.test(target)) {
      return new Response('Not allowed', { status: 400, headers: cors });
    }
    const res = await fetch(target, { cf: { cacheTtl: 15, cacheEverything: true } });
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};
