// Service Worker — офлайн-режим для 888.Finance

const CACHE_NAME = 'finance-v1';
const STATIC_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Устанавливаем — кэшируем статику
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_URLS);
    })
  );
  self.skipWaiting();
});

// Активируем — чистим старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Перехватываем запросы
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Если есть в кэше — отдаём (быстро, без интернета)
      if (cached) return cached;
      // Нет в кэше — грузим из сети
      return fetch(event.request).then((response) => {
        // Кэшируем только JS/CSS/шрифты — не API-запросы
        const url = new URL(event.request.url);
        if (
          event.request.destination === 'script' ||
          event.request.destination === 'style' ||
          event.request.destination === 'font' ||
          event.request.destination === 'image' ||
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Если нет интернета — отдаём заглушку
        return new Response('Нет подключения к интернету', { status: 503 });
      });
    })
  );
});
