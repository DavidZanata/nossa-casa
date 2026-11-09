/* Nossa Casa · service worker
   Deixa o app abrir rápido (e mesmo sem internet) e recebe as notificações. */
importScripts('config.js');

const VERSAO = 'nossa-casa-v2.2';
const ARQUIVOS = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Arquivos do app: tenta a internet primeiro (pega atualizações), cai no cache se demorar ou faltar rede.
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const doCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
  const daRede = fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
    return res;
  });
  const limite = new Promise(res => setTimeout(res, 3500)).then(doCache);
  e.respondWith(Promise.race([daRede.catch(doCache), limite.then(r => r || daRede)]));
});

// Notificação: o servidor manda um "toque" vazio; aqui buscamos o texto e mostramos.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let itens = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch(self.NOSSA_CASA.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: 'avisos', args: [sub && sub.endpoint] })
      });
      const j = await r.json();
      itens = (j && j.data) || [];
    } catch (err) { /* sem rede: mostra o aviso genérico */ }
    if (!itens.length) itens = [{ titulo: 'Nossa Casa', corpo: 'Tem novidade por aqui. Toque para abrir.', tag: 'geral', aba: 'inicio' }];
    await Promise.all(itens.map(n => self.registration.showNotification(n.titulo, {
      body: n.corpo, tag: n.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { aba: n.aba }
    })));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const aba = (e.notification.data && e.notification.data.aba) || 'inicio';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) {
      c.postMessage({ aba });
      if ('focus' in c) return c.focus();
    }
    return self.clients.openWindow('./?aba=' + aba);
  }));
});
