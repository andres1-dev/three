/**
 * Configuración de Notificaciones Push con Supabase
 * 
 * INSTRUCCIONES:
 * 1. Copia este archivo como js/config-push.js
 * 2. Reemplaza los valores de ejemplo con tus keys reales
 * 3. Agrega config-push.js a .gitignore para no exponer las keys
 * 4. Importa este archivo en tu HTML después de push-supabase.js
 */

// VAPID Public Key (generada con generate-vapid-keys.js)
// Esta key SÍ puede estar en el frontend
const VAPID_PUBLIC_KEY = 'BNxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

/**
 * Inicializa el sistema de notificaciones push
 * Llamar después de que Supabase esté inicializado
 */
function initPushNotifications() {
  // Verificar que el navegador soporte notificaciones push
  if (!PushSupabase.isSupported()) {
    console.warn('[PUSH] Notificaciones push no soportadas en este navegador');
    return false;
  }

  // Obtener configuración de Supabase (debe estar definida en config.js)
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[PUSH] Configuración de Supabase no encontrada');
    return false;
  }

  // Inicializar PushSupabase
  PushSupabase.init(SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY);
  
  console.log('[PUSH] Sistema de notificaciones inicializado');
  
  // Si ya tiene permisos, mostrar estado en UI
  updatePushUI();
  
  return true;
}

/**
 * Solicita permisos para notificaciones push
 * Llamar cuando el usuario haga clic en el botón de activar notificaciones
 */
async function requestPushPermission() {
  try {
    const result = await PushSupabase.requestPermission();
    
    if (result.success) {
      console.log('[PUSH] ✅ Notificaciones activadas');
      updatePushUI();
      
      // Opcional: Mostrar mensaje de éxito al usuario
      if (typeof showToast === 'function') {
        showToast('Notificaciones activadas correctamente', 'success');
      }
      
      return true;
    } else {
      console.error('[PUSH] ❌ Error:', result.error);
      
      // Mostrar mensaje según el error
      let message = 'No se pudieron activar las notificaciones';
      
      if (result.error === 'denied') {
        message = 'Has bloqueado las notificaciones. Actívalas en la configuración del navegador.';
      } else if (result.error === 'unavailable') {
        message = 'Tu navegador no soporta notificaciones push';
      }
      
      if (typeof showToast === 'function') {
        showToast(message, 'error');
      }
      
      return false;
    }
  } catch (error) {
    console.error('[PUSH] Error solicitando permisos:', error);
    return false;
  }
}

/**
 * Desactiva las notificaciones push
 */
async function disablePushNotifications() {
  try {
    const result = await PushSupabase.unsubscribe();
    
    if (result) {
      console.log('[PUSH] Notificaciones desactivadas');
      updatePushUI();
      
      if (typeof showToast === 'function') {
        showToast('Notificaciones desactivadas', 'info');
      }
    }
    
    return result;
  } catch (error) {
    console.error('[PUSH] Error desactivando notificaciones:', error);
    return false;
  }
}

/**
 * Envía una notificación de prueba
 */
async function sendTestPushNotification() {
  try {
    const result = await PushSupabase.sendTest();
    
    if (result) {
      console.log('[PUSH] Notificación de prueba enviada');
      
      if (typeof showToast === 'function') {
        showToast('Notificación de prueba enviada', 'success');
      }
    } else {
      console.error('[PUSH] Error enviando notificación de prueba');
      
      if (typeof showToast === 'function') {
        showToast('Error enviando notificación de prueba', 'error');
      }
    }
    
    return result;
  } catch (error) {
    console.error('[PUSH] Error:', error);
    return false;
  }
}

/**
 * Actualiza la UI según el estado de las notificaciones
 */
function updatePushUI() {
  const permission = PushSupabase.getPermission();
  const subscription = PushSupabase.getSubscription();
  
  // Actualizar botón de notificaciones (si existe)
  const notifButton = document.getElementById('notif-button');
  const notifIcon = document.getElementById('notif-icon');
  
  if (notifButton) {
    if (permission === 'granted' && subscription) {
      notifButton.classList.add('active');
      notifButton.title = 'Notificaciones activadas';
      
      if (notifIcon) {
        notifIcon.textContent = '🔔';
      }
    } else {
      notifButton.classList.remove('active');
      notifButton.title = 'Activar notificaciones';
      
      if (notifIcon) {
        notifIcon.textContent = '🔕';
      }
    }
  }
  
  // Actualizar badge (si existe)
  const notifBadge = document.getElementById('notif-badge');
  if (notifBadge) {
    if (permission === 'granted' && subscription) {
      notifBadge.style.display = 'none';
    } else {
      notifBadge.style.display = 'block';
    }
  }
}

/**
 * Maneja el clic en el botón de notificaciones
 */
function handleNotificationButtonClick() {
  const permission = PushSupabase.getPermission();
  const subscription = PushSupabase.getSubscription();
  
  if (permission === 'granted' && subscription) {
    // Ya está activado, mostrar opciones
    showNotificationOptions();
  } else if (permission === 'denied') {
    // Bloqueado, mostrar instrucciones
    showNotificationBlockedMessage();
  } else {
    // Solicitar permisos
    requestPushPermission();
  }
}

/**
 * Muestra opciones de notificaciones (desactivar, probar, etc.)
 */
function showNotificationOptions() {
  // Implementar según tu UI
  // Ejemplo: mostrar un modal con opciones
  console.log('[PUSH] Mostrar opciones de notificaciones');
  
  // Opciones sugeridas:
  // - Enviar notificación de prueba
  // - Desactivar notificaciones
  // - Ver historial de notificaciones
}

/**
 * Muestra mensaje cuando las notificaciones están bloqueadas
 */
function showNotificationBlockedMessage() {
  // Implementar según tu UI
  console.log('[PUSH] Notificaciones bloqueadas');
  
  const message = `
    Las notificaciones están bloqueadas.
    
    Para activarlas:
    1. Haz clic en el icono de candado en la barra de direcciones
    2. Busca "Notificaciones"
    3. Cambia a "Permitir"
    4. Recarga la página
  `;
  
  if (typeof showToast === 'function') {
    showToast(message, 'warning');
  } else {
    alert(message);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPushNotifications);
} else {
  initPushNotifications();
}

// Exponer funciones globalmente
window.requestPushPermission = requestPushPermission;
window.disablePushNotifications = disablePushNotifications;
window.sendTestPushNotification = sendTestPushNotification;
window.handleNotificationButtonClick = handleNotificationButtonClick;
