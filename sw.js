/* 独木导航 Service Worker —— 解决 GitHub Pages 仅 10 分钟缓存的问题
   策略：
   - HTML 导航请求：网络优先（4s 超时回退缓存），保证内容永远最新
   - 同源静态资源：stale-while-revalidate（秒开 + 后台静默更新）
   - 跨域资源：stale-while-revalidate（字体/天气/看板娘）
*/
const VERSION = '2026-11-11-1';
const CACHE_STATIC = 'dm-static-' + VERSION;
const CACHE_HTML = 'dm-html-' + VERSION;
const CACHE_EXT = 'dm-ext-' + VERSION;

const CORE = [
  './',
  'wp-content/themes/onenav/css/bootstrap.min-3.03029.1.css',
  'wp-content/themes/onenav/css/style-3.03029.1.css',
  'wp-content/themes/onenav/css/iconfont-3.03029.1.css',
  'wp-content/themes/onenav/css/jquery.fancybox.min-3.03029.1.css',
  'css/font-awesome.min.css',
  'wp-content/themes/onenav/js/jquery.min-3.03029.1.js',
  'wp-content/themes/onenav/js/app-3.03029.1.js',
  'wp-content/themes/onenav/js/bootstrap.min-3.03029.1.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_STATIC);
    await Promise.allSettled(
      CORE.map((u) => c.add(new Request(new URL(u, self.location.href).href, { cache: 'reload' })))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const c = await caches.open(CACHE_HTML);
  try {
    const fresh = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    if (fresh && fresh.ok) c.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = (await c.match(req, { ignoreSearch: true })) || (await c.match('./'));
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName);
  const cached = await c.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) return cached;
  const res = await network;
  return res || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.endsWith('/sw.js')) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
    return;
  }
  e.respondWith(staleWhileRevalidate(req, CACHE_EXT));
});
