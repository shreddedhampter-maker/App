/* Chaos & Control service worker: offline app shell.
   Bump VERSION whenever you deploy changed files so phones pick up the update. */
const VERSION = 'cc-v1.1.0'; // v1.1.0: new split eye-mask icon set
const SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon.svg', './icons/favicon-48.png', './icons/mark-128.png',
  './fonts/BarlowCondensed-SemiBold.woff', './fonts/BarlowCondensed-Bold.woff', './fonts/BarlowCondensed-ExtraBold.woff'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // App shell for any navigation, including ?steps=...&date=... links from the Shortcut.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match('./index.html');
      const network = fetch(req).then(res => { if (res.ok) cache.put('./index.html', res.clone()); return res; }).catch(() => null);
      return cached || (await network) || new Response('Offline', { status: 503 });
    })());
    return;
  }
  // Stale-while-revalidate for static assets.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await network) || new Response('', { status: 504 });
  })());
});
