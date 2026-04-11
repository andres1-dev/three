/* ==========================================================================
   push.js — PWA Push Notifications SISPRO v2
   - Registra el Service Worker
   - Solicita permiso al primer clic en la campana
   - Suscribe al usuario via VAPID (clave dinámica desde GAS)
   - Notificación local de prueba al activar permisos
   - Escucha mensajes NEW_PUSH_NOTIF del SW → actualiza campana en tiempo real
   ========================================================================== */

const NOTIF_GAS_URL    = 'https://script.google.com/macros/s/AKfycbzPkZzYLgMuqWzUZtcZ9MqEsliJFbjplxwB7wN98SDHF4mIHMFKYCkZUhFtMOIdTahh/exec';
const PUSH_STORAGE_KEY = 'sispro_push_subscribed';

let _swRegistration          = null;
let _vapidPublicKey          = null;
let _pushPermissionRequested = false;

/* ══════════════════════════════════════════════════════════════════════════
   Llamar al GAS de notificaciones
   — GET:  ?action=xxx
   — POST: form-urlencoded (igual que delivery, que es lo que el GAS espera)
   ══════════════════════════════════════════════════════════════════════════ */
async function _callNotifAPI(action, method = 'GET', data = null) {
  try {
    if (method === 'GET') {
      const res  = await fetch(`${NOTIF_GAS_URL}?action=${action}&_t=${Date.now()}`, { mode: 'cors' });
      const text = await res.text();
      try { return JSON.parse(text); } catch (_) { return text; }
    }

    // POST — form-urlencoded (el GAS lee e.parameter, no e.postData.contents para estos campos)
    const form = new URLSearchParams();
    form.append('action', action);
    if (data) {
      form.append('data', JSON.stringify(data));
      if (data.endpoint)        form.append('endpoint', data.endpoint);
      if (data.keys?.p256dh)    form.append('p256dh',   data.keys.p256dh);
      if (data.keys?.auth)      form.append('auth',     data.keys.auth);
      if (data.title)           form.append('title',    data.title);
      if (data.body)            form.append('body',     data.body);
      if (data.icon  != null)   form.append('icon',     data.icon);
      if (data.url)             form.append('url',      data.url);
    }

    const res  = await fetch(NOTIF_GAS_URL, {
      method: 'POST', mode: 'cors', body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return text; }
  } catch (e) {
    console.warn('[PUSH] Error llamando GAS:', e.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Registro del Service Worker
   ══════════════════════════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    _swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    console.log('[PUSH] SW registrado:', _swRegistration.scope);

    // Usar getRegistration para asegurarnos de tener el SW activo
    _swRegistration = await navigator.serviceWorker.ready;

    // Enviar config de polling al SW
    _sendPollingConfigToSW();

    // Escuchar mensajes del SW → actualizar campana en tiempo real
    navigator.serviceWorker.addEventListener('message', _onSwMessage);

    // Periodic sync (Chrome Android)
    _registerPeriodicSync(_swRegistration);

    // Si ya tiene permiso concedido, asegurar suscripción activa
    if (Notification.permission === 'granted') {
      await _subscribeToPush();
    }
  } catch (e) {
    console.warn('[PUSH] Error registrando SW:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Enviar config de polling al SW (mensaje SET_POLLING_CONFIG)
   ══════════════════════════════════════════════════════════════════════════ */
function _sendPollingConfigToSW() {
  if (!_swRegistration?.active) return;
  const lastTs = parseInt(localStorage.getItem('sispro_last_push_ts') || '0');
  _swRegistration.active.postMessage({
    type:   'SET_POLLING_CONFIG',
    url:    NOTIF_GAS_URL,
    userId: currentUser?.ID_PLANTA || currentUser?.ID_USUARIO || 'anonimo',
    lastTs
  });
  console.log('[PUSH] Polling config enviada al SW');
}

/* ══════════════════════════════════════════════════════════════════════════
   Solicitar permiso + suscribir (llamado al primer clic en campana)
   ══════════════════════════════════════════════════════════════════════════ */
async function _requestPushPermission() {
  if (!('Notification' in window) || !('PushManager' in window)) return 'unavailable';

  const currentPerm = Notification.permission;
  if (currentPerm === 'denied') return 'denied';

  if (currentPerm === 'granted') {
    await _subscribeToPush();
    if (typeof _syncNotifToggleUI === 'function') _syncNotifToggleUI('granted');
    return 'granted';
  }

  if (_pushPermissionRequested) return currentPerm;
  _pushPermissionRequested = true;

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      _showLocalTestNotif();
      await _subscribeToPush();
    } else {
      _pushPermissionRequested = false;
    }
    return result;
  } catch (e) {
    console.warn('[PUSH] Error solicitando permiso:', e.message);
    _pushPermissionRequested = false;
    return 'default';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Notificación local de prueba — instantánea, sin red
   ══════════════════════════════════════════════════════════════════════════ */
function _showLocalTestNotif() {
  if (!_swRegistration || Notification.permission !== 'granted') return;
  _swRegistration.showNotification('¡SISPRO activado!', {
    body:    'Las notificaciones push están funcionando correctamente.',
    icon:    './icons/TDM_variable_colors.svg',
    badge:   './icons/TDM_variable_colors.svg',
    vibrate: [100, 50, 100],
    tag:     'sispro-test'
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Obtener VAPID public key desde GAS
   ══════════════════════════════════════════════════════════════════════════ */
async function _fetchVapidKey() {
  try {
    const text = await _callNotifAPI('vapid-public-key', 'GET');
    if (typeof text === 'string' && text.length > 20 && !text.startsWith('{')) {
      _vapidPublicKey = text.trim();
      console.log('[PUSH] VAPID key obtenida');
      return true;
    }
    console.warn('[PUSH] VAPID key inválida:', text);
    return false;
  } catch (e) {
    console.warn('[PUSH] Error obteniendo VAPID key:', e.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Suscribir al usuario a Push via VAPID
   ══════════════════════════════════════════════════════════════════════════ */
async function _subscribeToPush() {
  if (!_swRegistration) return;
  try {
    // Verificar suscripción existente
    let sub = await _swRegistration.pushManager.getSubscription();
    if (sub) {
      console.log('[PUSH] Ya suscrito, re-enviando al servidor');
      await _saveSubscriptionToGAS(sub);
      return;
    }

    // Obtener VAPID key si no la tenemos
    if (!_vapidPublicKey) {
      const ok = await _fetchVapidKey();
      if (!ok) { console.warn('[PUSH] Sin VAPID key, no se puede suscribir'); return; }
    }

    sub = await _swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(_vapidPublicKey)
    });

    console.log('[PUSH] Suscripción creada');
    localStorage.setItem(PUSH_STORAGE_KEY, '1');
    await _saveSubscriptionToGAS(sub);
  } catch (e) {
    console.warn('[PUSH] Error suscribiendo:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Guardar suscripción en GAS (form-urlencoded, igual que delivery)
   ══════════════════════════════════════════════════════════════════════════ */
async function _saveSubscriptionToGAS(subscription) {
  const subJSON = subscription.toJSON();
  const result  = await _callNotifAPI('subscribe', 'POST', subJSON);
  if (result?.success) {
    console.log('[PUSH] Suscripción guardada en GAS:', result.message);
  } else {
    console.warn('[PUSH] Respuesta GAS al suscribir:', result);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Mensajes del SW → actualizar campana en tiempo real
   ══════════════════════════════════════════════════════════════════════════ */
function _onSwMessage(event) {
  const { type, payload } = event.data || {};
  if (type !== 'NEW_PUSH_NOTIF' || !payload) return;

  console.log('[PUSH] Notificación recibida del SW:', payload.title);

  if (payload.timestamp) {
    localStorage.setItem('sispro_last_push_ts', String(payload.timestamp));
  }

  const notifType = payload.notifType || 'estado';

  if (notifType === 'chat' && typeof _addOperatorChatNotif === 'function') {
    _addOperatorChatNotif(
      payload.idNovedad,
      { mensaje: payload.body, ts: payload.timestamp },
      payload.lote,
      payload.planta
    );
  } else if (notifType === 'estado' && typeof _addNotifications === 'function') {
    _addNotifications([{
      nov: {
        ID_NOVEDAD:  payload.idNovedad || '',
        LOTE:        payload.lote      || '',
        PLANTA:      payload.planta    || '',
        DESCRIPCION: payload.body      || ''
      },
      estadoAnterior: payload.estadoAnterior || 'PENDIENTE',
      estadoActual:   payload.estadoActual   || 'ELABORACION'
    }]);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Periodic Sync (Chrome Android)
   ══════════════════════════════════════════════════════════════════════════ */
async function _registerPeriodicSync(reg) {
  if (!('periodicSync' in reg)) return;
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state === 'granted') {
      await reg.periodicSync.register('sispro-check', { minInterval: 60 * 60 * 1000 });
      console.log('[PUSH] Periodic sync registrado');
    }
  } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════════════
   Utilidad: base64url → Uint8Array
   ══════════════════════════════════════════════════════════════════════════ */
function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/* ══════════════════════════════════════════════════════════════════════════
   Init automático al cargar
   ══════════════════════════════════════════════════════════════════════════ */
(function initPush() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerServiceWorker);
  } else {
    registerServiceWorker();
  }
})();
