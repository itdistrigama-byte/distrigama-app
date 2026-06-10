const CACHE = 'distrigama-v4';
const OFFLINE_ASSETS = ['/', '/index.html', '/manifest.json', '/data-catalog.js',
  '/js/config.js', '/js/utils.js', '/js/auth.js', '/js/censo.js',
  '/js/cartera.js', '/js/pdf-xlsx.js', '/js/reporte.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Firebase calls always go to network
  if (e.request.url.includes('firebase') || e.request.url.includes('google')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
