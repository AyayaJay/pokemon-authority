// Offline support for Pokémon Authority.
// - Game files (this site): always try the internet first so updates show up right away; use the saved copy when offline.
// - Sprites, sounds, music (GitHub / Showdown / fonts): use the saved copy if there is one, otherwise download and save it.
const CACHE = 'pa-files-v1';
const ASSET_HOSTS = ['raw.githubusercontent.com', 'play.pokemonshowdown.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) { e.respondWith(siteFile(req)); return; }
  if (ASSET_HOSTS.includes(u.hostname)) e.respondWith(asset(req));
});

async function siteFile(req) {
  const key = req.url.split('#')[0].split('?')[0];
  try {
    const r = await fetch(req);
    if (r.ok && !req.headers.has('range')) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(key, c)); }
    return r;
  } catch (err) {
    const hit = await caches.match(key) || (req.mode === 'navigate' ? await caches.match(new URL('./', self.location).href) || await caches.match(new URL('./index.html', self.location).href) : null);
    return hit || Response.error();
  }
}

async function asset(req) {
  const key = req.url.split('?')[0];   // the game adds ?r to retry a download; it's the same file
  const ca = await caches.open(CACHE);
  const hit = await ca.match(key);
  if (hit) return hit;
  let r = null;
  try { r = await fetch(key, {mode: 'cors', credentials: 'omit'}); }
  catch (err) { try { return await fetch(req); } catch (err2) { return Response.error(); } }   // site without CORS: just pass it through
  if (r.ok && r.status === 200) ca.put(key, r.clone()).catch(() => {});
  return r;
}
