/* ==========================================================================
   sw.js — Service Worker SISPRO v3
   - SIN CACHE (eliminado completamente)
   - SIN PUSH (eliminado completamente)
   ========================================================================== */

const SW_VERSION = 'sispro-v6-no-cache-no-push';

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL — Sin caché
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

/* ══════════════════════════════════════════════════════════════════════════
   ACTIVATE — Limpiar cachés antiguos
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Eliminar TODOS los cachés existentes
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      // Tomar control inmediato
      self.clients.claim()
    ])
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   FETCH — Sin caché, solo red
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  // Sin caché, dejar que el navegador maneje todo normalmente
  return;
});

/* ══════════════════════════════════════════════════════════════════════════
   MENSAJES DESDE EL CLIENTE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('message', async event => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
});

console.log('[SW] ✅ Cargado —', SW_VERSION, '— SIN CACHE — SIN PUSH');

