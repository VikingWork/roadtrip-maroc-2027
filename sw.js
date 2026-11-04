// Mode hors-ligne partiel : la page, les donnÃ©es, les photos et les morceaux de carte dÃ©jÃ  vus restent en mÃ©moire.
const V = 'maroc-v15';
const BASE = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'data/bon_a_savoir.json', 'data/j1.json', 'data/j2.json', 'data/j3.json', 'data/j4.json', 'data/j5.json', 'data/j6.json', 'data/j7.json', 'data/j8.json', 'data/j9.json', 'data/j10.json', 'data/j11.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'tuiles').map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (e.request.method !== 'GET' || u.includes('youtube') || u.includes('ytimg')) return;
  const tuile = /tile|arcgisonline/.test(u);
  // Pages et donnÃ©es : rÃ©seau d'abord (pour avoir la derniÃ¨re version), cache si pas de rÃ©seau
  if (!tuile && !u.includes('/photos/')) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request)));
    return;
  }
  // Photos et tuiles de carte : cache d'abord
  const nom = tuile ? 'tuiles' : V;
  e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => {
    const c = r.clone(); caches.open(nom).then(x => x.put(e.request, c)); return r; })));
});
