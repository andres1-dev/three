/* ==========================================================================
   sw.js — Service Worker SISPRO v2
   - Push real (Android/Chrome via VAPID)
   - Polling fallback para iOS (fetch periódico)
   - SIN CACHE (eliminado completamente)
   - Anti-duplicados por ID de notificación
   ========================================================================== */

const SW_VERSION = 'sispro-v5-no-cache';

/* ── GAS endpoint para pull de última notificación (iOS tickle) ── */
/* Se sobreescribe desde el cliente via mensaje SET_CONFIG */
let GAS_NOTIF_URL = null;

/* ── Anti-duplicados ── */
let _lastNotifId = null;
let _lastNotifTs = 0;
let _processing = false;

/* ── Polling background (iOS / fallback) ── */
let _pollingActive = false;
const POLL_INTERVAL_MS = 10_000; // 10 segundos (optimizado para respuesta rápida)

/* ══════════════════════════════════════════════════════════════════════════
   IndexedDB — persistencia entre reinicios del SW
   ══════════════════════════════════════════════════════════════════════════ */
const IDB_NAME = 'sispro_sw';
const IDB_VERSION = 1;

function _getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('kv'))
        e.target.result.createObjectStore('kv');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function _idbSet(key, val) {
  const db = await _getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function _idbGet(key) {
  const db = await _getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL — Sin caché
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

/* ══════════════════════════════════════════════════════════════════════════
   ACTIVATE — Limpiar cachés antiguos y restaurar estado
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Eliminar TODOS los cachés existentes
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      // Tomar control inmediato
      self.clients.claim(),
      // Restaurar estado persistido
      (async () => {
        GAS_NOTIF_URL = await _idbGet('gasNotifUrl') || null;
        _lastNotifTs = (await _idbGet('lastNotifTs')) || 0;
        _lastNotifId = (await _idbGet('lastNotifId')) || null;
        if (GAS_NOTIF_URL) _startPolling();
      })()
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
  const { type, ...data} = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  /* El cliente envía la URL del GAS de notificaciones y el ts conocido */
  if (type === 'SET_CONFIG' || type === 'SET_POLLING_CONFIG') {
    GAS_NOTIF_URL = data.gasUrl || data.url;
    await _idbSet('gasNotifUrl', GAS_NOTIF_URL);
    
    if (data.lastTs !== undefined) {
      _lastNotifTs = data.lastTs;
      await _idbSet('lastNotifTs', _lastNotifTs);
    }
    
    if (data.lastId !== undefined) {
      _lastNotifId = data.lastId;
      await _idbSet('lastNotifId', _lastNotifId);
    }
    
    _startPolling();
    
    // Responder al cliente
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
    return;
  }

  /* Forzar check inmediato (al volver a la app) */
  if (type === 'CHECK_NOW') {
    _checkAndNotify();
    return;
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PUSH REAL (Android / Chrome / Edge) - Supabase Web Push
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('push', event => {
  event.waitUntil(_handlePushEvent(event));
});

async function _handlePushEvent(event) {
  if (_processing) {
    return;
  }
  
  _processing = true;
  const timeout = setTimeout(() => { _processing = false; }, 8000);

  try {
    let payload = null;

    /* Intentar leer payload directo (Web Push de Supabase) */
    if (event.data) {
      try {
        payload = event.data.json();
        
        // Si viene de Supabase, mostrar directamente
        if (payload && (payload.title || payload.body)) {
          await _showSupabasePush(payload);
          return;
        }
      } catch (e) {
        console.warn('[SW] Error parseando payload:', e);
      }
    }

    /* Fallback: Sin payload (iOS tickle) → fetch desde GAS (sistema antiguo) */
    if (!payload) {
      console.log('[SW] Sin payload, consultando GAS (fallback)...');
      const url = GAS_NOTIF_URL || (await _idbGet('gasNotifUrl'));
      if (!url) {
        console.warn('[SW] No hay URL de GAS configurada');
        return;
      }
      
      const res = await fetch(`${url}?action=get-latest-notification&_t=${Date.now()}`);
      const json = await res.json();
      console.log('[SW] Respuesta GAS:', json);
      
      if (json.success && json.notification) {
        payload = json.notification;
        await _showIfNew(payload);
        return;
      }
    }

    if (!payload) {
      console.warn('[SW] No hay payload para mostrar');
      return;
    }
  } catch (e) {
    console.error('[SW] Error en push:', e);
  } finally {
    clearTimeout(timeout);
    _processing = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   MOSTRAR NOTIFICACIÓN DE SUPABASE WEB PUSH
   ══════════════════════════════════════════════════════════════════════════ */
async function _showSupabasePush(payload) {
  console.log('[SW] Mostrando notificación de Supabase:', payload);
  
  const title = payload.title || 'SISPRO';
  const body = payload.body || '';
  const icon = payload.icon || './icons/pwa-icon.svg';
  const badge = payload.badge || './icons/pwa-icon.svg';
  const data = payload.data || {};
  const url = data.url || './index.html';
  const tag = payload.tag || data.tag || `sispro-${Date.now()}`;
  
  // Verificar si la app está en primer plano
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appVisible = allClients.some(c => c.visibilityState === 'visible');

  if (appVisible) {
    // App visible → enviar mensaje al cliente
    console.log('[SW] App visible, enviando mensaje al cliente');
    allClients.forEach(c => {
      c.postMessage({ 
        type: 'NOTIFICATION_RECEIVED', 
        payload: { title, body, data, url }
      });
    });
    return;
  }

  // App en background → mostrar notificación nativa
  console.log('[SW] App en background, mostrando notificación nativa');
  
  await self.registration.showNotification(title, {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: false,
    vibrate: payload.vibrate || [100, 50, 100],
    data: { url, ...data }
  });

  console.log('[SW] ✅ Notificación Supabase mostrada:', title);
}

/* ══════════════════════════════════════════════════════════════════════════
   POLLING BACKGROUND (fallback iOS / pestaña cerrada)
   ══════════════════════════════════════════════════════════════════════════ */
function _startPolling() {
  if (_pollingActive) {
    console.log('[SW] Polling ya activo');
    return;
  }
  
  _pollingActive = true;
  console.log('[SW] ✅ Polling iniciado cada', POLL_INTERVAL_MS / 1000, 's');
  setInterval(_checkAndNotify, POLL_INTERVAL_MS);
  _checkAndNotify(); // check inmediato
}

async function _checkAndNotify() {
  if (_processing) return;
  
  const url = GAS_NOTIF_URL || (await _idbGet('gasNotifUrl'));
  if (!url) {
    console.log('[SW Polling] No hay URL para polling');
    return;
  }

  console.log('[SW Polling] Consultando servidor...');
  
  try {
    const res = await fetch(`${url}?action=get-latest-notification&_t=${Date.now()}`);
    const json = await res.json();
    
    console.log('[SW Polling] Consultando servidor...');
    
    if (json.success && json.notification) {
      const notif = json.notification;
      const currentTs = parseInt(notif.timestamp) || 0;
      const currentId = notif.id || '';
      
      const lastTs = _lastNotifTs || (await _idbGet('lastNotifTs')) || 0;
      const lastId = _lastNotifId || (await _idbGet('lastNotifId')) || null;
      
      // Verificar si es nueva (timestamp mayor O id diferente)
      const tsMayor = currentTs > lastTs;
      const idDistinto = currentId !== lastId;
      
      console.log('[SW Polling] Consultando servidor...', {
        tsMayor,
        idDistinto,
        lastTs,
        currentTs,
        lastId,
        currentId
      });
      
      if (tsMayor || (idDistinto && currentTs >= lastTs)) {
        console.log('[SW Polling] ✅ Nueva notificación detectada');
        await _showIfNew(notif);
      } else {
        console.log('[SW Polling] Sin cambios o notificación ya mostrada', {
          tsMayor,
          idDistinto,
          lastTs,
          currentTs,
          lastId,
          currentId
        });
      }
    } else {
      console.log('[SW] Sin notificaciones nuevas');
    }
  } catch (e) {
    console.error('[SW] Error en polling:', e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   FORMATEAR NOTIFICACIÓN según notifType
   ══════════════════════════════════════════════════════════════════════════ */
function _formatNotif(payload) {
  const notifType = payload.notifType || 'estado';
  const lote = payload.lote || '';
  const planta = payload.planta || '';
  const ref = payload.referencia || '';
  const area = payload.area || '';
  const idNovedad = payload.idNovedad || '';

  let title, body, url;

  if (notifType === 'chat') {
    // Mensaje de chat
    const autor = payload.autor || planta || 'Planta';
    title = '💬 Mensaje — Lote ' + (lote || 'S/N');
    body = autor + ': ' + (payload.body || '').substring(0, 80);
    url = './index.html';
  } else {
    // Cambio de estado
    const estado = (payload.estadoActual || '').toUpperCase();
    const emoji = estado === 'FINALIZADO' ? '✅' : '🔧';
    const label = estado === 'FINALIZADO' ? 'Solucionado' : 'En Elaboración';
    title = emoji + ' Lote ' + (lote || 'S/N') + ' — ' + label;
    const parts = [];
    if (ref) parts.push('Ref: ' + ref);
    if (area) parts.push(area);
    if (planta) parts.push(planta);
    body = parts.join(' · ');
    url = idNovedad ? ('./seguimiento.html#' + idNovedad) : './seguimiento.html';
  }

  return { title, body, url };
}

/* ══════════════════════════════════════════════════════════════════════════
   MOSTRAR NOTIFICACIÓN (anti-duplicados mejorado)
   ══════════════════════════════════════════════════════════════════════════ */
async function _showIfNew(payload) {
  const ts = parseInt(payload.timestamp) || Date.now();
  const id = payload.id || `${payload.lote || 'unknown'}_${ts}`;

  console.log('[SW] Procesando notificación:', { id, ts, payload });

  const savedTs = _lastNotifTs || (await _idbGet('lastNotifTs')) || 0;
  const savedId = _lastNotifId || (await _idbGet('lastNotifId')) || null;

  console.log('[SW] Estado guardado:', { savedId, savedTs });

  // Verificar duplicados
  if (id === savedId && ts <= savedTs) {
    console.log('[SW] ⚠️ Notificación duplicada, ignorando');
    return;
  }

  // Actualizar anti-duplicados ANTES de mostrar
  _lastNotifTs = ts;
  _lastNotifId = id;
  await _idbSet('lastNotifTs', ts);
  await _idbSet('lastNotifId', id);
  console.log('[SW] Estado actualizado:', { id, ts });

  // Verificar si la app está en primer plano
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appVisible = allClients.some(c => c.visibilityState === 'visible');

  if (appVisible) {
    // App visible → enviar mensaje al cliente para actualizar campana
    console.log('[SW] App visible, enviando mensaje al cliente');
    allClients.forEach(c => {
      c.postMessage({ type: 'NEW_PUSH_NOTIF', payload });
    });
    return;
  }

  // App en background o cerrada → notificación nativa del SO
  console.log('[SW] App en background, mostrando notificación nativa');
  const { title, body, url } = _formatNotif(payload);
  const icon = './icons/TDM_variable_colors.svg';
  const badge = './icons/TDM_variable_colors.svg';

  await self.registration.showNotification(title, {
    body,
    icon,
    badge,
    tag: `sispro-${id}`,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url, id, ts, notifType: payload.notifType || 'estado', payload }
  });

  console.log('[SW] ✅ Notificación nativa mostrada:', title);
}

/* ══════════════════════════════════════════════════════════════════════════
   CLICK EN NOTIFICACIÓN
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  console.log('[SW] Click en notificación');
  event.notification.close();
  
  const target = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Buscar una ventana que ya tenga la URL destino abierta
        for (const c of clients) {
          if (c.url.includes(target.replace('./', '')) && 'focus' in c) {
            console.log('[SW] Enfocando ventana existente');
            return c.focus();
          }
        }
        // Si hay alguna ventana abierta, navegar a la URL correcta
        for (const c of clients) {
          if ('navigate' in c) {
            console.log('[SW] Navegando en ventana existente');
            return c.navigate(target).then(wc => wc && wc.focus());
          }
          if ('focus' in c) return c.focus();
        }
        // Sin ventanas → abrir nueva
        console.log('[SW] Abriendo nueva ventana');
        return self.clients.openWindow(target);
      })
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   PERIODIC SYNC (Chrome Android)
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync:', event.tag);
  if (event.tag === 'sispro-check') {
    event.waitUntil(_checkAndNotify());
  }
});

console.log('[SW] ✅ Cargado —', SW_VERSION, '— SIN CACHE');
