// Service worker: guarda o jogo no cache pra rodar OFFLINE na versão web.
// No app Android (Capacitor) os arquivos já vêm no pacote — o SW não é usado.
const CACHE = "guardiao-v3";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Rede primeiro (pega atualizações), cache como reserva quando offline.
// cache: "no-cache" = sempre REVALIDA com o servidor (resposta 304 barata):
// sem isso o cache HTTP do navegador podia entregar módulos .js antigos
// misturados com novos depois de uma atualização.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
