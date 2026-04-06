const CACHE_NAME = 'today-crm-v4';
const API_CACHE_NAME = 'today-api-v1';
const API_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// API routes to cache for offline schedule access
const API_CACHEABLE = ['/api/lessons', '/api/time-slots', '/api/groups', '/api/subjects', '/api/users'];
const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
];

// Offline fallback HTML
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TODAY CRM — Офлайн</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;
      background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%);color:#fff;padding:24px;text-align:center}
    .card{background:rgba(255,255,255,.15);backdrop-filter:blur(20px);border-radius:20px;padding:40px 32px;max-width:360px;width:100%}
    h1{font-size:24px;margin-bottom:8px}
    p{font-size:14px;opacity:.85;margin-bottom:24px;line-height:1.5}
    button{background:#fff;color:#6366f1;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;
      transition:transform .15s,box-shadow .15s}
    button:active{transform:scale(.96)}
    .icon{font-size:48px;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Нет подключения</h1>
    <p>Проверьте интернет-соединение и попробуйте снова</p>
    <button onclick="location.reload()">Обновить</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // API calls — cache selected routes (schedule data), network-only for others
  if (request.url.includes('/api/')) {
    const isCacheable = API_CACHEABLE.some(route => request.url.includes(route));
    if (!isCacheable) return; // pass through uncacheable API calls

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, clone);
              // Store timestamp for TTL
              cache.put(request.url + '__ts', new Response(String(Date.now())));
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline: try API cache with TTL check
          const cache = await caches.open(API_CACHE_NAME);
          const tsResponse = await cache.match(request.url + '__ts');
          if (tsResponse) {
            const ts = parseInt(await tsResponse.text(), 10);
            if (Date.now() - ts < API_CACHE_TTL_MS) {
              return cache.match(request) || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
            }
          }
          return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
        })
    );
    return;
  }

  // Dev assets — network only (never cache Vite internals)
  if (request.url.includes('/node_modules/') || request.url.includes('/@') || request.url.includes('/src/')) return;

  // Navigation requests — network first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response(OFFLINE_HTML, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          )
        )
    );
    return;
  }

  // Static assets — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
