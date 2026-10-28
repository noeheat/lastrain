// 캐시 후 백그라운드 갱신(stale-while-revalidate). 파일 구성을 바꾸면 CACHE 버전을 올린다.
const CACHE = 'last-train-v1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'time.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // 쿼리(?now= 등)는 캐시 키에서 제외

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(key);
    const net = fetch(req)
      .then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      })
      .catch(() => hit);
    return hit || net;
  }));
});
