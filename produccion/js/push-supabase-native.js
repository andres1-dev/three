/* ==========================================================================
   push-supabase-native.js — Notificaciones Push 100% Nativas con Supabase
   
   SIN FIREBASE - Solo Web Push API + Supabase
   
   Ventajas:
   - Sin dependencias externas (no Firebase)
   - Más control sobre el sistema
   - Más privacidad (datos solo en Supabase)
   - Estándar Web Push Protocol
   - Funciona en todos los navegadores modernos
   ========================================================================== */

const PUSH_NATIVE_CONFIG = {
  supabaseUrl: null,
  supabaseAnonKey: null,
  vapidPublicKey: null,
  storageKey: 'sispro_push_subscription',
}

let _pushSubscription = null
let _swRegistration = null
let _supabaseClient = null

/* ══════════════════════════════════════════════════════════════════════════
   Inicialización
   ══════════════════════════════════════════════════════════════════════════ */

async function initNativePush(supabaseUrl, supabaseAnonKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[PUSH-NATIVE] Push notifications no soportadas')
    return false
  }

  PUSH_NATIVE_CONFIG.supabaseUrl = supabaseUrl
  PUSH_NATIVE_CONFIG.supabaseAnonKey = supabaseAnonKey

  // Obtener cliente Supabase
  if (window.getSupabaseClient) {
    _supabaseClient = window.getSupabaseClient()
  }

  try {
    // Registrar Service Worker
    _swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' })
    await navigator.serviceWorker.ready
    console.log('[PUSH-NATIVE] Service Worker registrado')

    // Obtener clave VAPID pública desde Supabase
    await _fetchVapidKey()

    // Si ya tiene permiso, verificar suscripción
    if (Notification.permission === 'granted') {
      await _ensureSubscription()
    }

    // Escuchar mensajes del SW
    navigator.serviceWorker.addEventListener('message', _handleSwMessage)

    return true
  } catch (error) {
    console.error('[PUSH-NATIVE] Error inicializando:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Obtener Clave VAPID desde Supabase
   ══════════════════════════════════════════════════════════════════════════ */

async function _fetchVapidKey() {
  try {
    const response = await fetch(`${PUSH_NATIVE_CONFIG.supabaseUrl}/functions/v1/push-native-supabase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_NATIVE_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({ action: 'get-vapid-key' }),
    })

    const result = await response.json()
    
    if (result.success && result.vapidPublicKey) {
      PUSH_NATIVE_CONFIG.vapidPublicKey = result.vapidPublicKey
      console.log('[PUSH-NATIVE] Clave VAPID obtenida')
      return true
    } else {
      console.error('[PUSH-NATIVE] No se pudo obtener clave VAPID')
      return false
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error obteniendo VAPID:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Solicitar Permisos y Suscribir
   ══════════════════════════════════════════════════════════════════════════ */

async function requestPushPermission() {
  if (!('Notification' in window) || !('PushManager' in window)) {
    return { success: false, error: 'unavailable' }
  }

  const currentPerm = Notification.permission

  if (currentPerm === 'denied') {
    return { success: false, error: 'denied' }
  }

  if (currentPerm === 'granted') {
    await _ensureSubscription()
    return { success: true, permission: 'granted' }
  }

  try {
    const result = await Notification.requestPermission()
    
    if (result === 'granted') {
      _showTestNotification()
      await _ensureSubscription()
      return { success: true, permission: 'granted' }
    } else {
      return { success: false, error: 'denied' }
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error solicitando permiso:', error)
    return { success: false, error: error.message }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Gestión de Suscripción
   ══════════════════════════════════════════════════════════════════════════ */

async function _ensureSubscription() {
  if (!_swRegistration) {
    console.warn('[PUSH-NATIVE] Service Worker no registrado')
    return false
  }

  try {
    // Verificar suscripción existente
    let subscription = await _swRegistration.pushManager.getSubscription()

    // Si no existe, crear nueva
    if (!subscription) {
      if (!PUSH_NATIVE_CONFIG.vapidPublicKey) {
        console.error('[PUSH-NATIVE] Clave VAPID no disponible')
        return false
      }

      subscription = await _swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(PUSH_NATIVE_CONFIG.vapidPublicKey)
      })

      console.log('[PUSH-NATIVE] Nueva suscripción creada')
    }

    _pushSubscription = subscription

    // Guardar en localStorage
    localStorage.setItem(PUSH_NATIVE_CONFIG.storageKey, JSON.stringify(subscription.toJSON()))

    // Registrar en Supabase
    await _registerSubscription(subscription)

    return true
  } catch (error) {
    console.error('[PUSH-NATIVE] Error en suscripción:', error)
    return false
  }
}

async function _registerSubscription(subscription) {
  const userId = currentUser?.ID_USUARIO || currentUser?.ID_PLANTA || 'anonymous'
  const deviceType = _getDeviceType()
  const deviceInfo = _getDeviceInfo()

  try {
    const response = await fetch(`${PUSH_NATIVE_CONFIG.supabaseUrl}/functions/v1/push-native-supabase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_NATIVE_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'subscribe',
        userId,
        subscription: subscription.toJSON(),
        deviceType,
        deviceInfo,
      }),
    })

    const result = await response.json()

    if (result.success) {
      console.log('[PUSH-NATIVE] Suscripción registrada en Supabase')
      return true
    } else {
      console.error('[PUSH-NATIVE] Error registrando:', result.message)
      return false
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error en registro:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Desuscribir
   ══════════════════════════════════════════════════════════════════════════ */

async function unsubscribePush() {
  if (!_pushSubscription) {
    const saved = localStorage.getItem(PUSH_NATIVE_CONFIG.storageKey)
    if (saved) {
      _pushSubscription = JSON.parse(saved)
    }
  }

  if (!_pushSubscription) {
    console.warn('[PUSH-NATIVE] No hay suscripción para desregistrar')
    return false
  }

  try {
    const userId = currentUser?.ID_USUARIO || currentUser?.ID_PLANTA || 'anonymous'
    const endpoint = _pushSubscription.endpoint

    // Desregistrar en Supabase
    const response = await fetch(`${PUSH_NATIVE_CONFIG.supabaseUrl}/functions/v1/push-native-supabase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_NATIVE_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'unsubscribe',
        userId,
        endpoint,
      }),
    })

    const result = await response.json()

    if (result.success) {
      // Desuscribir del navegador
      if (_swRegistration) {
        const sub = await _swRegistration.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
      }

      localStorage.removeItem(PUSH_NATIVE_CONFIG.storageKey)
      _pushSubscription = null
      console.log('[PUSH-NATIVE] Desuscrito correctamente')
      return true
    } else {
      console.error('[PUSH-NATIVE] Error desuscribiendo:', result.message)
      return false
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error en desuscripción:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Enviar Notificación de Prueba
   ══════════════════════════════════════════════════════════════════════════ */

async function sendTestNotification() {
  const userId = currentUser?.ID_USUARIO || currentUser?.ID_PLANTA
  
  if (!userId) {
    console.warn('[PUSH-NATIVE] No hay usuario logueado')
    return false
  }

  try {
    const response = await fetch(`${PUSH_NATIVE_CONFIG.supabaseUrl}/functions/v1/push-native-supabase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_NATIVE_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'send',
        userId,
        title: '🔔 Notificación de Prueba',
        body: 'Sistema de notificaciones funcionando correctamente',
        data: {
          type: 'test',
          url: './index.html',
          tag: 'test-notification',
        },
      }),
    })

    const result = await response.json()
    
    if (result.success) {
      console.log('[PUSH-NATIVE] Notificación de prueba enviada')
      return true
    } else {
      console.error('[PUSH-NATIVE] Error enviando notificación:', result.message)
      return false
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error en sendTest:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Manejo de Mensajes del Service Worker
   ══════════════════════════════════════════════════════════════════════════ */

function _handleSwMessage(event) {
  const { type, payload } = event.data || {}
  
  if (type === 'NOTIFICATION_CLICKED') {
    console.log('[PUSH-NATIVE] Notificación clickeada:', payload)
  } else if (type === 'NOTIFICATION_RECEIVED') {
    console.log('[PUSH-NATIVE] Notificación recibida:', payload)
    // Actualizar UI si es necesario
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Notificación de Prueba Local
   ══════════════════════════════════════════════════════════════════════════ */

function _showTestNotification() {
  if (!_swRegistration || Notification.permission !== 'granted') return

  _swRegistration.showNotification('¡SISPRO Activado!', {
    body: 'Las notificaciones push están funcionando correctamente',
    icon: './icons/TDM_variable_colors.svg',
    badge: './icons/TDM_variable_colors.svg',
    vibrate: [100, 50, 100],
    tag: 'sispro-test',
  })
}

/* ══════════════════════════════════════════════════════════════════════════
   Utilidades
   ══════════════════════════════════════════════════════════════════════════ */

function _getDeviceType() {
  const ua = navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  return 'web'
}

function _getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    timestamp: new Date().toISOString(),
  }
}

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

/* ══════════════════════════════════════════════════════════════════════════
   API Pública
   ══════════════════════════════════════════════════════════════════════════ */

window.PushSupabaseNative = {
  init: initNativePush,
  requestPermission: requestPushPermission,
  unsubscribe: unsubscribePush,
  sendTest: sendTestNotification,
  getSubscription: () => _pushSubscription,
  isSupported: () => 'serviceWorker' in navigator && 'PushManager' in window,
  getPermission: () => Notification.permission,
}

console.log('[PUSH-NATIVE] Módulo Supabase nativo cargado')
