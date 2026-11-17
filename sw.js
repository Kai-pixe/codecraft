'use strict';

// Sube el número de versión cada vez que cambies archivos de la app
const CACHE = 'codecraft-v20';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './boot.js',
  './preview-sandbox.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  // cache: 'reload' evita guardar copias viejas del caché HTTP del navegador (causa de pantallas a medias)
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((a) => fetch(new Request(a, { cache: 'reload' })).then((res) => { if (!res.ok) throw new Error(a + ' ' + res.status); return cache.put(a, res); }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---- Vista previa: sirve los archivos del proyecto como si fuera un servidor ----
const MIME = { html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
  woff: 'font/woff', woff2: 'font/woff2', mp3: 'audio/mpeg', mp4: 'video/mp4', wasm: 'application/wasm', xml: 'application/xml' };
// La página previsualizada no puede enviar datos a otros sitios
const PREVIEW_CSP = "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' data: blob:; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; form-action 'self'; base-uri 'self'; object-src 'none'; frame-src 'self' data: blob:";
const overlay = new Map();   // pid -> { ruta: texto }  (cambios sin guardar que manda la app)

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'preview-files' && d.pid) overlay.set(d.pid, d.files || {});
});

function idbAll(db, store) {
  return new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function idbGet(db, store, key) {
  return new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function openDb() {
  return new Promise((res, rej) => { const r = indexedDB.open('codecraft'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

async function previewResponse(pid, rel) {
  let path = decodeURIComponent(rel).replace(/^\/+/, '');
  if (!path || path.endsWith('/')) path += 'index.html';
  const headers = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    return { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': PREVIEW_CSP };
  };
  const ov = overlay.get(pid);
  if (ov && Object.prototype.hasOwnProperty.call(ov, path)) return new Response(ov[path], { headers: headers(path) });
  const db = await openDb();
  try {
    const files = await idbAll(db, 'files');
    const f = files.find((x) => (x.project || 'default') === pid && x.name === path);
    if (!f) return new Response('No existe en el proyecto: ' + path, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    const doc = await idbGet(db, 'docs', f.id);
    const body = doc ? (doc.blob || doc.content || '') : '';
    return new Response(body, { headers: headers(path) });
  } finally { db.close(); }
}

// Red primero (siempre la versión más nueva y consistente) y, si no hay internet, el caché.
// Solo archivos del mismo origen: las llamadas a Gemini / OpenRouter nunca pasan por aquí.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const pvBase = new URL('./__preview/', self.registration.scope).pathname;
  if (url.pathname.startsWith(pvBase)) {
    const rest = url.pathname.slice(pvBase.length);
    const slash = rest.indexOf('/');
    const pid = slash === -1 ? rest : rest.slice(0, slash);
    event.respondWith(previewResponse(pid, slash === -1 ? '' : rest.slice(slash + 1)).catch((err) => new Response('Error: ' + err.message, { status: 500 })));
    return;
  }

  if (url.pathname.endsWith('/preview-sandbox.html')) {
    event.respondWith(caches.match('./preview-sandbox.html', { ignoreSearch: true }).then((c) => c || fetch(req)));
    return;
  }
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then((cached) => cached || Response.error()))
  );
});
