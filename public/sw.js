// 오프라인 지원 서비스 워커
// - /_next/static/*: 파일명에 해시가 있어 바뀌지 않으므로 캐시 우선
// - 페이지·아이콘: 네트워크 우선, 실패하면 캐시 (오프라인에서 마지막 화면 유지)
// - /api/*: 캐시하지 않음 (막차 계산은 항상 최신이어야 함)
const CACHE = 'last-train-v2';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
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
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const key = url.origin + url.pathname; // 쿼리(?now= 등)는 캐시 키에서 제외

  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(key);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(key, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(key, res.clone());
      return res;
    } catch {
      return (await cache.match(key)) ?? (await cache.match('/')) ?? Response.error();
    }
  }));
});
