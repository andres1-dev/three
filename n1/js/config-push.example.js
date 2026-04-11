/* ==========================================================================
   config-push.example.js — Configuración de Notificaciones Push
   
   INSTRUCCIONES:
   1. Copia este archivo como config-push.js
   2. Reemplaza los valores de ejemplo con tus credenciales reales
   3. Agrega config-push.js a tu .gitignore para no subir credenciales
   ========================================================================== */

const PUSH_NOTIFICATIONS_CONFIG = {
  // ── Firebase Configuration ──
  firebase: {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef",
    
    // VAPID Public Key (Web Push Certificate)
    vapidKey: "BNxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  },

  // ── Supabase Configuration ──
  supabase: {
    url: "https://tu-proyecto.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1LXByb3llY3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAwMDAwMDAsImV4cCI6MTk5NTU3NjAwMH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  },

  // ── Configuración de Notificaciones ──
  notifications: {
    // Habilitar/deshabilitar notificaciones push
    enabled: true,
    
    // Solicitar permisos automáticamente al cargar la app
    autoRequestPermission: false,
    
    // Mostrar notificación de prueba al activar permisos
    showTestNotification: true,
    
    // Sonido de notificaciones (si está disponible)
    sound: './sounds/estado.mp3',
    
    // Vibración (patrón en milisegundos)
    vibrate: [200, 100, 200],
    
    // Requerir interacción del usuario para cerrar notificación
    requireInteraction: false,
    
    // Tiempo de vida de la notificación (en segundos, 0 = sin límite)
    ttl: 0,
  },

  // ── Configuración de Debugging ──
  debug: {
    // Mostrar logs detallados en consola
    verbose: true,
    
    // Simular notificaciones sin enviar a FCM (solo para desarrollo)
    mockNotifications: false,
  }
}

// Exportar configuración
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PUSH_NOTIFICATIONS_CONFIG
}
