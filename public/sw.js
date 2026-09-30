// Сервис-воркер PWA: игра открывается без сети и обновляется сама.
//
// Версия приходит в адресе регистрации (sw.js?v=<SHA коммита>, main.js):
// каждая выкладка — новый воркер со своим кешем, старые кеши он удаляет.
// Страница — сначала из сети (так приезжает новая версия), без сети — из
// кеша. Остальное — сначала из кеша: у JS хэш в имени, у картинок ?v=, то
// есть адрес меняется вместе с содержимым.

const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE = `tarot-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('./')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tarot-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; })
      .catch(() => caches.match('./')));
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
