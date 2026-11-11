/* 已停用 Service Worker
   本文件仅作善后：让此前注册过 SW 的浏览器自动注销并清理缓存。
   访客浏览器下次检查更新时会自动执行，之后该文件即可删除。
*/
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (err) {}
    try {
      await self.registration.unregister();
    } catch (err) {}
  })());
});
