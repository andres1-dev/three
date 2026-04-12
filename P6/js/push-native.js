/* ==========================================================================
   push-native.js — Sistema de Notificaciones Push Nativas con Supabase + FCM
   
   Características:
   - Notificaciones push nativas en Android, iOS y Web
   - Integración con Firebase Cloud Messaging (FCM)
   - Registro automático de dispositivos
   - Manejo de permisos multiplataforma
   - Sincronización con Supabase
   - Soporte para notificaciones en background
   ========================================================================== */

const PUSH_CONFIG = {
  supabaseUrl: null,        // Se configura desde config.js
  supabaseAnonKey: null,    // Se configura desde config.js
  fcmVapidKey: null,        // Clave pública VAPID de Firebase
  storageKey: 'sispro_fcm_token',
  permissionRequested: false,
}

let _fcmToken = null
let _swRegistration = null
let _supabaseClient = null

/* ══════════════════════════════════════════════════════════════════════════
   Inicialización
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inicializa el sistema de notificaciones push nativas
 * Debe llamarse después de cargar Firebase SDK y Supabase
 */
async function initNativePush(supabaseUrl, supabaseAnonKey, fcmVapidKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[PUSH-NATIVE] Push notifications no soportadas en este navegador')
    return false
  }

  PUSH_CONFIG.supabaseUrl = supabaseUrl
  PUSH_CONFIG.supabaseAnonKey = supabaseAnonKey
  PUSH_CONFIG.fcmVapidKey = fcmVapidKey

  // Inicializar cliente Supabase si está disponible
  if (window.getSupabaseClient) {
    _supabaseClient = window.getSupabaseClient()
  }

  try {
    // Registrar Service Worker
    _swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' })
    await navigator.serviceWorker.ready
    console.log('[PUSH-NATIVE] Service Worker registrado')

    // Si ya tiene permiso, registrar automáticamente
    if (Notification.permission === 'granted') {
      await _registerDevice()
    }

    // Escuchar mensajes del Service Worker
    navigator.serviceWorker.addEventListener('message', _handleSwMessage)

    return true
  } catch (error) {
    console.error('[PUSH-NATIVE] Error inicializando:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Solicitar Permisos y Registrar Dispositivo
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Solicita permiso para notificaciones y registra el dispositivo
 * Llamar cuando el usuario haga clic en la campana o botón de activar notificaciones
 */
async function requestPushPermission() {
  if (!('Notification' in window) || !('PushManager' in window)) {
    return { success: false, error: 'unavailable' }
  }

  const currentPerm = Notification.permission

  if (currentPerm === 'denied') {
    return { success: false, error: 'denied' }
  }

  if (currentPerm === 'granted') {
    await _registerDevice()
    return { success: true, permission: 'granted' }
  }

  if (PUSH_CONFIG.permissionRequested) {
    return { success: false, error: 'already_requested' }
  }

  PUSH_CONFIG.permissionRequested = true

  try {
    const result = await Notification.requestPermission()
    
    if (result === 'granted') {
      // Mostrar notificación de prueba
      _showTestNotification()
      
      // Registrar dispositivo
      await _registerDevice()
      
      return { success: true, permission: 'granted' }
    } else {
      PUSH_CONFIG.permissionRequested = false
      return { success: false, error: 'denied' }
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error solicitando permiso:', error)
    PUSH_CONFIG.permissionRequested = false
    return { success: false, error: error.message }
  }
}

/**
 * Registra el dispositivo en Supabase para recibir notificaciones
 */
async function _registerDevice() {
  if (!_swRegistration) {
    console.warn('[PUSH-NATIVE] Service Worker no registrado')
    return false
  }

  try {
    // Obtener token FCM
    const token = await _getFCMToken()
    
    if (!token) {
      console.warn('[PUSH-NATIVE] No se pudo obtener token FCM')
      return false
    }

    _fcmToken = token
    localStorage.setItem(PUSH_CONFIG.storageKey, token)

    // Registrar en Supabase
    const userId = currentUser?.ID_USUARIO || currentUser?.ID_PLANTA || 'anonymous'
    const deviceType = _getDeviceType()
    const deviceInfo = _getDeviceInfo()

    const response = await fetch(`${PUSH_CONFIG.supabaseUrl}/functions/v1/push-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'subscribe',
        userId,
        token,
        deviceType,
        deviceInfo,
      }),
    })

    const result = await response.json()

    if (result.success) {
      console.log('[PUSH-NATIVE] Dispositivo registrado correctamente')
      return true
    } else {
      console.error('[PUSH-NATIVE] Error registrando dispositivo:', result.message)
      return false
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error en _registerDevice:', error)
    return false
  }
}

/**
 * Obtiene el token FCM del dispositivo
 */
async function _getFCMToken() {
  try {
    // Verificar si ya tenemos un token guardado
    const savedToken = localStorage.getItem(PUSH_CONFIG.storageKey)
    if (savedToken) {
      console.log('[PUSH-NATIVE] Usando token FCM guardado')
      return savedToken
    }

    // Obtener suscripción push existente
    let subscription = await _swRegistration.pushManager.getSubscription()

    // Si no existe, crear nueva suscripción
    if (!subscription) {
      if (!PUSH_CONFIG.fcmVapidKey) {
        console.error('[PUSH-NATIVE] VAPID key no configurada')
        return null
      }

      subscription = await _swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(PUSH_CONFIG.fcmVapidKey)
      })
    }

    // Convertir suscripción a token FCM
    // Nota: En producción, necesitarás Firebase SDK para obtener el token real
    // Este es un placeholder que usa el endpoint de la suscripción
    const token = subscription.endpoint.split('/').pop()
    
    return token
  } catch (error) {
    console.error('[PUSH-NATIVE] Error obteniendo token FCM:', error)
    return null
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Desregistrar Dispositivo
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Desregistra el dispositivo actual de las notificaciones push
 */
async function unsubscribePush() {
  if (!_fcmToken) {
    _fcmToken = localStorage.getItem(PUSH_CONFIG.storageKey)
  }

  if (!_fcmToken) {
    console.warn('[PUSH-NATIVE] No hay token para desregistrar')
    return false
  }

  try {
    const userId = currentUser?.ID_USUARIO || currentUser?.ID_PLANTA || 'anonymous'

    const response = await fetch(`${PUSH_CONFIG.supabaseUrl}/functions/v1/push-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'unsubscribe',
        userId,
        token: _fcmToken,
      }),
    })

    const result = await response.json()

    if (result.success) {
      localStorage.removeItem(PUSH_CONFIG.storageKey)
      _fcmToken = null
      console.log('[PUSH-NATIVE] Dispositivo desregistrado')
      return true
    } else {
      console.error('[PUSH-NATIVE] Error desregistrando:', result.message)
      return false
    }
  } catch (error) {
    console.error('[PUSH-NATIVE] Error en unsubscribePush:', error)
    return false
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Envío Manual de Notificaciones (para testing)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Envía una notificación de prueba al usuario actual
 */
async function sendTestNotification() {
  const userId = currentUser?.ID_USUARIO || currentUser?.ID_PLANTA
  
  if (!userId) {
    console.warn('[PUSH-NATIVE] No hay usuario logueado')
    return false
  }

  try {
    const response = await fetch(`${PUSH_CONFIG.supabaseUrl}/functions/v1/push-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_CONFIG.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        action: 'send',
        userId,
        title: '🔔 Notificación de Prueba',
        body: 'El sistema de notificaciones push está funcionando correctamente',
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
    console.error('[PUSH-NATIVE] Error en sendTestNotification:', error)
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
    // Manejar navegación o acciones específicas
  } else if (type === 'NOTIFICATION_RECEIVED') {
    console.log('[PUSH-NATIVE] Notificación recibida en foreground:', payload)
    // Actualizar UI si la app está abierta
    if (typeof _addNotifications === 'function' && payload.type === 'estado') {
      // Actualizar campana de notificaciones
    }
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
    requireInteraction: false,
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

window.PushNative = {
  init: initNativePush,
  requestPermission: requestPushPermission,
  unsubscribe: unsubscribePush,
  sendTest: sendTestNotification,
  getToken: () => _fcmToken,
  isSupported: () => 'serviceWorker' in navigator && 'PushManager' in window,
  getPermission: () => Notification.permission,
}

console.log('[PUSH-NATIVE] Módulo cargado')
