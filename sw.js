// O jogo web saiu do ar (09/10/2026). Este service worker substitui o antigo, apaga a cópia
// offline e se desinstala; depois disso o navegador segue para a página oficial.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (/^guardiao-/.test(k)) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
  })());
});
