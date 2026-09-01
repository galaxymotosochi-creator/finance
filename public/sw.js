// Service Worker — AtlasPos офлайн-режим
// 1) Кеширует статику и данные — приложение работает без интернета
// 2) Мутации (POST/PATCH/DELETE) без сети уходят в очередь (IndexedDB)
// 3) При появлении сети очередь синхронизируется автоматически

const CACHE = 'atlaspos-v5';
const STATIC = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

// ===== IndexedDB: очередь офлайн-запросов =====
const DB_NAME = 'atlaspos-sync';
const STORE = 'queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function queueAdd(entry) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function queueAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}
async function queueRemove(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function queueCount() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).count();
    r.onsuccess = () => res(r.result || 0);
    r.onerror = () => rej(r.error);
  });
}

// ===== Синхронизация очереди =====
async function syncQueue() {
  const items = await queueAll();
  if (!items.length) return;
  let done = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // 2xx — успех; 4xx — ошибка данных (не зацикливаемся), убираем из очереди
        await queueRemove(item.id);
        done++;
      }
      // 5xx — серверная ошибка, пробуем позже
    } catch (e) {
      break; // сети ещё нет — останавливаемся
    }
  }
  const left = await queueCount();
  self.clients.matchAll().then((clients) => {
    clients.forEach((c) => c.postMessage({ type: 'sync-done', done, left }));
  });
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data === 'sync') syncQueue();
});

// ===== Обработка запросов =====
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Чужие домены (supabase и т.п.) не трогаем
  if (url.hostname !== location.hostname) return;

  // ===== Мутации (POST/PATCH/DELETE): офлайн → в очередь =====
  if (e.request.method !== 'GET') {
    if (url.pathname.startsWith('/api/')) {
      e.respondWith(handleMutation(e.request));
    }
    return;
  }

  // ===== Статика: кеш → сеть =====
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // ===== API GET: сеть → кеш (данные видны офлайн) =====
  if (url.pathname.startsWith('/api/')) {
    // /api/health — живая проверка связи: НИКОГДА не отвечаем из кеша,
    // иначе индикатор не увидит, что интернета нет
    if (url.pathname === '/api/health') {
      e.respondWith(fetch(e.request).catch(() => new Response('offline', { status: 503 })));
      return;
    }
    e.respondWith(networkFirst(e.request));
    return;
  }

  // ===== Страница и всё остальное: сеть → кеш =====
  e.respondWith(networkFirst(e.request));
});

async function handleMutation(request) {
  // Пробуем отправить сразу
  try {
    const res = await fetch(request.clone());
    return res;
  } catch (e) {
    // Сети нет — сохраняем запрос в очередь и отвечаем «успех»,
    // чтобы интерфейс не сломался; данные уйдут при синхронизации
    try {
      const body = await request.clone().text();
      await queueAdd({
        url: request.url,
        method: request.method,
        headers: [...request.headers.entries()],
        body,
        ts: Date.now()
      });
    } catch (err) { /* очередь недоступна */ }
    return new Response(JSON.stringify({ ok: true, queued: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    const clone = res.clone();
    caches.open(CACHE).then((c) => c.put(request, clone));
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const idx = await caches.match('/');
      if (idx) return idx;
    }
    return new Response('Нет интернета', { status: 503 });
  }
}
