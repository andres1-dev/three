/* ==========================================================================
   push-supabase.js — Sistema de Notificaciones Push 100% Supabase
   
   Características:
   - Web Push API nativo (sin Firebase)
   - VAPID authentication
   - Compatible con Android, iOS 16.4+, Desktop
   - Integración directa con Supabase Edge Functions
   ========================================================================== */

const PushSupabase = (() => {
  let config = {
    supabaseUrl: null,
    supabaseAnonKey: null,
    vapidPublicKey: null,
    swRegistration: null,
    subscription: null,
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Inicialización
     ══════════════════════════════════════════════════════════════════════════ */

  async function init(supabaseUrl, supabaseAnonKey, vapidPublicKey) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PUSH-SUPABASE] Push notifications no soportadas')
      return false
    }

    config.supabaseUrl = supabaseUrl
    config.supabaseAnonKey = supabaseAnonKey
    config.vapidPublicKey = vapidPublicKey

    try {
      // Registrar Service Worker
      config.swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' })
      await navigator.serviceWorker.ready
      console.log('[PUSH-SUPABASE] Service Worker registrado')

      // Si ya tiene permiso, verificar suscripción
      if (Notification.permission === 'granted') {
        await _checkExistingSubscription()
      }

      // Escuchar mensajes del Service Worker
      navigator.serviceWorker.addEventListener('message', _handleSwMessage)

      return true
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error inicializando:', error)
      return false
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Solicitar Permisos y Suscribir
     ══════════════════════════════════════════════════════════════════════════ */

  async function requestPermission() {
    if (!('Notification' in window) || !('PushManager' in window)) {
      return { success: false, error: 'unavailable' }
    }

    const currentPerm = Notification.permission

    if (currentPerm === 'denied') {
      return { success: false, error: 'denied' }
    }

    if (currentPerm === 'granted') {
      const subscribed = await _subscribe()
      return { success: subscribed, permission: 'granted' }
    }

    try {
      const result = await Notification.requestPermission()
      
      if (result === 'granted') {
        _showWelcomeNotification()
        const subscribed = await _subscribe()
        return { success: subscribed, permission: 'granted' }
      } else {
        return { success: false, error: 'denied' }
      }
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error solicitando permiso:', error)
      return { success: false, error: error.message }
    }
  }

  async function _subscribe() {
    if (!config.swRegistration) {
      console.error('[PUSH-SUPABASE] Service Worker no registrado')
      return false
    }

    try {
      // Verificar si ya existe una suscripción
      let subscription = await config.swRegistration.pushManager.getSubscription()

      // Si no existe, crear nueva
      if (!subscription) {
        subscription = await config.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: _urlBase64ToUint8Array(config.vapidPublicKey)
        })
      }

      config.subscription = subscription

      // Registrar en Supabase
      const registered = await _registerInSupabase(subscription)
      
      if (registered) {
        console.log('[PUSH-SUPABASE] Suscripción registrada correctamente')
        return true
      } else {
        console.error('[PUSH-SUPABASE] Error registrando en Supabase')
        return false
      }
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error en _subscribe:', error)
      return false
    }
  }

  async function _registerInSupabase(subscription) {
    const userId = window.currentUser?.ID_USUARIO || window.currentUser?.ID_PLANTA || 'anonymous'
    
    // Extraer keys de la suscripción
    const subscriptionJson = subscription.toJSON()
    const endpoint = subscriptionJson.endpoint
    const p256dh = subscriptionJson.keys.p256dh
    const auth = subscriptionJson.keys.auth

    try {
      const response = await fetch(`${config.supabaseUrl}/functions/v1/push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'subscribe',
          userId,
          endpoint,
          p256dh,
          auth,
          deviceType: _getDeviceType(),
          deviceInfo: _getDeviceInfo(),
        }),
      })

      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error registrando en Supabase:', error)
      return false
    }
  }

  async function _checkExistingSubscription() {
    if (!config.swRegistration) return

    try {
      const subscription = await config.swRegistration.pushManager.getSubscription()
      
      if (subscription) {
        config.subscription = subscription
        console.log('[PUSH-SUPABASE] Suscripción existente encontrada')
        
        // Verificar que esté registrada en Supabase
        await _registerInSupabase(subscription)
      }
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error verificando suscripción:', error)
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Desuscribir
     ══════════════════════════════════════════════════════════════════════════ */

  async function unsubscribe() {
    if (!config.subscription) {
      console.warn('[PUSH-SUPABASE] No hay suscripción activa')
      return false
    }

    try {
      const userId = window.currentUser?.ID_USUARIO || window.currentUser?.ID_PLANTA || 'anonymous'
      const endpoint = config.subscription.endpoint

      // Desuscribir del navegador
      await config.subscription.unsubscribe()

      // Desregistrar de Supabase
      const response = await fetch(`${config.supabaseUrl}/functions/v1/push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'unsubscribe',
          userId,
          endpoint,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        config.subscription = null
        console.log('[PUSH-SUPABASE] Desuscripción exitosa')
        return true
      }

      return false
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error desuscribiendo:', error)
      return false
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Enviar Notificación de Prueba
     ══════════════════════════════════════════════════════════════════════════ */

  async function sendTest() {
    const userId = window.currentUser?.ID_USUARIO || window.currentUser?.ID_PLANTA
    
    if (!userId) {
      console.warn('[PUSH-SUPABASE] No hay usuario logueado')
      return false
    }

    try {
      const response = await fetch(`${config.supabaseUrl}/functions/v1/push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabaseAnonKey}`,
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
        console.log('[PUSH-SUPABASE] Notificación de prueba enviada')
        return true
      } else {
        console.error('[PUSH-SUPABASE] Error:', result.message)
        return false
      }
    } catch (error) {
      console.error('[PUSH-SUPABASE] Error enviando notificación:', error)
      return false
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Manejo de Mensajes del Service Worker
     ══════════════════════════════════════════════════════════════════════════ */

  function _handleSwMessage(event) {
    const { type, payload } = event.data || {}
    
    if (type === 'NOTIFICATION_CLICKED') {
      console.log('[PUSH-SUPABASE] Notificación clickeada:', payload)
    } else if (type === 'NOTIFICATION_RECEIVED') {
      console.log('[PUSH-SUPABASE] Notificación recibida:', payload)
      
      // Actualizar UI si es necesario
      if (typeof window._addNotifications === 'function' && payload.type === 'estado') {
        // Actualizar campana de notificaciones
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Notificación de Bienvenida
     ══════════════════════════════════════════════════════════════════════════ */

  function _showWelcomeNotification() {
    if (!config.swRegistration || Notification.permission !== 'granted') return

    config.swRegistration.showNotification('¡SISPRO Activado!', {
      body: 'Las notificaciones push están funcionando correctamente',
      icon: './icons/TDM_variable_colors.svg',
      badge: './icons/TDM_variable_colors.svg',
      vibrate: [100, 50, 100],
      tag: 'sispro-welcome',
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

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window
  }

  function getPermission() {
    return Notification.permission
  }

  function getSubscription() {
    return config.subscription
  }

  /* ══════════════════════════════════════════════════════════════════════════
     API Pública
     ══════════════════════════════════════════════════════════════════════════ */

  return {
    init,
    requestPermission,
    unsubscribe,
    sendTest,
    isSupported,
    getPermission,
    getSubscription,
  }
})()

// Exponer globalmente
window.PushSupabase = PushSupabase

console.log('[PUSH-SUPABASE] Módulo cargado')
