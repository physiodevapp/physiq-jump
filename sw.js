const CACHE_NAME = 'physiq-jump-v3';

const SHELL = [
  '/physiq/jump/',
  '/physiq/jump/index.html',
  '/physiq/jump/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then(c => c ?? fetch(e.request)));
  }
});
