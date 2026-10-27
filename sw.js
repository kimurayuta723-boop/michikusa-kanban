// オフラインでも図鑑を開けるように、アプリ本体をキャッシュする。
// ファイルを更新したら VERSION を上げると、次回起動時に入れ替わる。
const VERSION = 'v3';
const CACHE = `michikusa-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './image.js',
  './color.js',
  './tags.js',
  './tagger.js',
  './mascot.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('michikusa-') && k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 地図タイルとAIモデルは対象外(それぞれブラウザ側でキャッシュされる)
  const isShell = url.origin === location.origin || SHELL.includes(req.url) || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isShell) return;
  // 本体は「ネット優先・だめならキャッシュ」で、更新がすぐ反映されるようにする
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
