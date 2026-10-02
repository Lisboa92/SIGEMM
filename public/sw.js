/**
 * SIGEMM · Service Worker Oficial (PWA)
 * Conselho Municipal da Cidade da Matola · República de Moçambique
 * 
 * Funcionalidades:
 * 1. App Shell e Cache Completo de Assets (Offline-Ready)
 * 2. Navegação Resiliente (Network-First com Fallback Instantâneo a /index.html)
 * 3. Cache Estratégico (Stale-While-Revalidate para Scripts, Estilos, Fontes e Imagens)
 * 4. Background Sync API ('sync-multas') para sincronização automática quando a rede regressa
 * 5. Comunicação bidireccional com as abas e janelas activas do SIGEMM
 */

const CACHE_NAME = 'sigemm-sw-v5';
const SHELL_CACHE = `${CACHE_NAME}-shell`;
const ASSETS_CACHE = `${CACHE_NAME}-assets`;

const PRECACHE_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => {
        return cache.addAll(PRECACHE_SHELL_URLS).catch((err) => {
          console.warn('[SIGEMM SW] Aviso no pré-cache inicial:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activação e Limpeza de Caches Antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('sigemm-') && key !== SHELL_CACHE && key !== ASSETS_CACHE)
            .map((key) => {
              console.log('[SIGEMM SW] Removendo cache obsoleto:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Interceção de Requisições de Rede (Fetch)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Não intercetar endpoints de verificação de saúde da ligação
  if (url.pathname.startsWith('/api/health') || url.pathname.startsWith('/api/database/status')) {
    return;
  }

  // 1. Navegação HTML (SPA / Rotas como /nova-multa, /historico, /dashboard)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SIGEMM SW] Falha de rede na navegação, servindo Shell offline');
          const cache = await caches.open(SHELL_CACHE);
          const cachedResponse = await cache.match(req);
          if (cachedResponse) return cachedResponse;
          const indexFallback = await cache.match('/index.html');
          if (indexFallback) return indexFallback;
          return cache.match('/');
        })
    );
    return;
  }

  // 2. Ficheiros Estáticos (Scripts JS, CSS, Fontes, Imagens, SVGs)
  const isStaticAsset =
    req.destination === 'script' ||
    req.destination === 'style' ||
    req.destination === 'font' ||
    req.destination === 'image' ||
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset && url.origin === self.location.origin) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(req);

        // Fetch de actualização em background (Stale While Revalidate)
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            return cachedResponse;
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Helper para notificar todas as janelas/abas activas
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage(message);
  }
}

// Background Sync API (Sincronização em Segundo Plano)
self.addEventListener('sync', (event) => {
  console.log('[SIGEMM SW] Evento de Background Sync recebido:', event.tag);
  if (event.tag === 'sync-multas' || event.tag === 'sigemm-sync') {
    event.waitUntil(
      notifyClients({
        type: 'SIGEMM_TRIGGER_SYNC',
        source: 'background-sync',
        timestamp: Date.now(),
      })
    );
  }
});

// Periodic Sync (se suportado pelo navegador)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-multas' || event.tag === 'sigemm-periodic-sync') {
    event.waitUntil(
      notifyClients({
        type: 'SIGEMM_TRIGGER_SYNC',
        source: 'periodic-sync',
        timestamp: Date.now(),
      })
    );
  }
});

// Mensagens vindas do cliente
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'QUEUE_UPDATED') {
    console.log('[SIGEMM SW] Fila actualizada no cliente, registando sync se disponível');
    if ('sync' in self.registration) {
      self.registration.sync.register('sync-multas').catch(() => {});
    }
  }

  if (event.data.type === 'PING') {
    if (event.source) {
      event.source.postMessage({ type: 'PONG', version: CACHE_NAME });
    }
  }
});
