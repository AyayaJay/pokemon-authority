// Only here so phones can install the game as an app (full screen, no browser bar).
// It does not cache anything: every request goes to the network, so updates show up right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
