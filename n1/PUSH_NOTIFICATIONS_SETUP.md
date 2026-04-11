# 🔔 Sistema de Notificaciones Push Nativas - SISPRO

Sistema profesional de notificaciones push multiplataforma usando Supabase + Firebase Cloud Messaging (FCM).

## 📋 Características

✅ Notificaciones nativas en Android, iOS y Web  
✅ Funciona cuando la app está cerrada o en background  
✅ Detección automática de cambios de estado  
✅ Notificaciones de chat en tiempo real  
✅ Sistema de suscripción por usuario  
✅ Log de auditoría de notificaciones  
✅ Manejo inteligente de permisos  
✅ Soporte para imágenes y acciones  

---

## 🚀 Configuración Paso a Paso

### 1. Configurar Firebase Cloud Messaging (FCM)

#### 1.1 Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombre sugerido: `SISPRO-Notifications`

#### 1.2 Agregar Aplicación Web

1. En el dashboard del proyecto, haz clic en el ícono Web `</>`
2. Registra tu app con el nombre `SISPRO PWA`
3. Copia las credenciales de configuración (las necesitarás después)

#### 1.3 Habilitar Cloud Messaging

1. Ve a **Project Settings** (⚙️) → **Cloud Messaging**
2. En la pestaña **Cloud Messaging API (Legacy)**, habilita la API si no está habilitada
3. Copia el **Server Key** (lo necesitarás para Supabase)
4. En **Web Push certificates**, genera un nuevo par de claves VAPID
5. Copia la **Public Key** (la necesitarás en el frontend)

---

### 2. Configurar Supabase

#### 2.1 Ejecutar Migración de Base de Datos

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Crea una nueva query y pega el contenido de `supabase/migrations/create_push_notifications.sql`
4. Ejecuta la migración
5. Verifica que se crearon las tablas:
   - `PUSH_SUBSCRIPTIONS`
   - `PUSH_NOTIFICATIONS_LOG`

#### 2.2 Configurar Variables de Entorno

1. Ve a **Project Settings** → **Edge Functions** → **Environment Variables**
2. Agrega las siguientes variables:

```bash
FCM_SERVER_KEY=tu_server_key_de_firebase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
```

#### 2.3 Desplegar Edge Functions

Instala Supabase CLI si no lo tienes:

```bash
npm install -g supabase
```

Inicia sesión:

```bash
supabase login
```

Vincula tu proyecto:

```bash
supabase link --project-ref tu-project-ref
```

Despliega las funciones:

```bash
supabase functions deploy push-notifications
supabase functions deploy notification-trigger
```

#### 2.4 Configurar Database Webhooks

1. Ve a **Database** → **Webhooks**
2. Crea un nuevo webhook con estos datos:

**Webhook 1: Cambios en NOVEDADES**
- Name: `novedades-notifications`
- Table: `NOVEDADES`
- Events: `INSERT`, `UPDATE`
- Type: `HTTP Request`
- Method: `POST`
- URL: `https://tu-proyecto.supabase.co/functions/v1/notification-trigger`
- HTTP Headers:
  ```json
  {
    "Content-Type": "application/json",
    "Authorization": "Bearer TU_ANON_KEY"
  }
  ```

**Webhook 2: Nuevos mensajes en CHAT**
- Name: `chat-notifications`
- Table: `CHAT`
- Events: `INSERT`
- Type: `HTTP Request`
- Method: `POST`
- URL: `https://tu-proyecto.supabase.co/functions/v1/notification-trigger`
- HTTP Headers: (igual que arriba)

---

### 3. Configurar Frontend

#### 3.1 Agregar Firebase SDK

Agrega esto en tu `index.html`, `login.html`, etc., antes de cerrar `</body>`:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"></script>

<!-- Configuración de Firebase -->
<script>
  const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
  };
  
  firebase.initializeApp(firebaseConfig);
</script>

<!-- Sistema de notificaciones nativas -->
<script src="./js/push-native.js"></script>
```

#### 3.2 Inicializar en tu app.js

Agrega esto después de inicializar Supabase:

```javascript
// Inicializar notificaciones push nativas
if (window.PushNative && window.PushNative.isSupported()) {
  const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
  const SUPABASE_ANON_KEY = 'tu_anon_key';
  const FCM_VAPID_KEY = 'tu_vapid_public_key_de_firebase';
  
  PushNative.init(SUPABASE_URL, SUPABASE_ANON_KEY, FCM_VAPID_KEY)
    .then(success => {
      if (success) {
        console.log('✅ Sistema de notificaciones push inicializado');
      }
    });
}
```

#### 3.3 Solicitar Permisos

Modifica tu función de la campana de notificaciones para solicitar permisos:

```javascript
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  
  // Solicitar permiso la primera vez que se abre
  if (!isOpen && Notification.permission === 'default') {
    setTimeout(() => {
      if (window.PushNative) {
        PushNative.requestPermission().then(result => {
          if (result.success) {
            console.log('✅ Permisos de notificaciones concedidos');
          }
        });
      }
    }, 500);
  }
}
```

---

### 4. Actualizar Service Worker

Reemplaza tu `sw.js` actual con una versión mejorada que maneje FCM:

```javascript
// Importar Firebase Messaging en el Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configurar Firebase
firebase.initializeApp({
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
});

const messaging = firebase.messaging();

// Manejar mensajes en background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje recibido en background:', payload);
  
  const notificationTitle = payload.notification?.title || 'SISPRO';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/TDM_variable_colors.svg',
    badge: '/icons/TDM_variable_colors.svg',
    data: payload.data,
    tag: payload.data?.tag || 'sispro-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Buscar ventana existente
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Abrir nueva ventana
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
```

---

## 🧪 Testing

### Probar Notificaciones Manualmente

Abre la consola del navegador y ejecuta:

```javascript
// Solicitar permisos
await PushNative.requestPermission();

// Enviar notificación de prueba
await PushNative.sendTest();
```

### Probar desde Supabase

Ejecuta esta query en el SQL Editor (nota: las tablas están en MAYÚSCULAS):

```sql
-- Simular cambio de estado en una novedad
UPDATE "NOVEDADES" 
SET "ESTADO" = 'ELABORACION' 
WHERE "ID_NOVEDAD" = 'NOV-12345678';

-- Insertar mensaje de chat de prueba
INSERT INTO "CHAT" (
  "ID_MSG", "ID_NOVEDAD", "LOTE", "OP", "AUTOR", "ROL", "MENSAJE", "TS"
) VALUES (
  'MSG-TEST', 'NOV-12345678', 'LOTE-001', 'OP-001',
  'ADMIN', 'Juan Pérez', 'Mensaje de prueba', NOW()
);
```

### Verificar Logs

```sql
-- Ver suscripciones activas
SELECT * FROM "PUSH_SUBSCRIPTIONS" WHERE "ACTIVE" = true;

-- Ver log de notificaciones
SELECT * FROM "PUSH_NOTIFICATIONS_LOG" ORDER BY "SENT_AT" DESC LIMIT 10;

-- Ver estadísticas de un usuario
SELECT * FROM get_notification_stats('USER-123');
```

---

## 📱 Soporte por Plataforma

| Plataforma | Soporte | Notas |
|------------|---------|-------|
| Android (Chrome) | ✅ Completo | Notificaciones nativas en background |
| Android (Firefox) | ✅ Completo | Notificaciones nativas en background |
| iOS (Safari 16.4+) | ✅ Completo | Requiere agregar a Home Screen |
| iOS (Safari <16.4) | ⚠️ Limitado | Solo notificaciones en foreground |
| Desktop (Chrome) | ✅ Completo | Notificaciones del sistema operativo |
| Desktop (Firefox) | ✅ Completo | Notificaciones del sistema operativo |
| Desktop (Edge) | ✅ Completo | Notificaciones del sistema operativo |
| Desktop (Safari) | ⚠️ Limitado | Soporte básico |

---

## 🔧 Troubleshooting

### Las notificaciones no llegan

1. Verifica que FCM_SERVER_KEY esté configurado correctamente en Supabase
2. Revisa los logs de Edge Functions: `supabase functions logs push-notifications`
3. Verifica que el usuario tenga tokens registrados: `SELECT * FROM "PUSH_SUBSCRIPTIONS" WHERE "USER_ID" = 'tu-user-id'`
4. Comprueba que los webhooks estén activos en Supabase Dashboard
5. **IMPORTANTE**: Asegúrate de que los webhooks usen comillas dobles para nombres de tablas en mayúsculas: `"NOVEDADES"`, `"CHAT"`

### Error "FCM_SERVER_KEY no configurada"

1. Ve a Supabase Dashboard → Project Settings → Edge Functions
2. Agrega la variable de entorno `FCM_SERVER_KEY` con tu Server Key de Firebase

### Notificaciones duplicadas

1. Limpia tokens antiguos: `SELECT cleanup_inactive_tokens();`
2. Verifica que no haya múltiples webhooks configurados para la misma tabla

### iOS no recibe notificaciones

1. Asegúrate de que el usuario haya agregado la PWA a la pantalla de inicio
2. Verifica que Safari sea versión 16.4 o superior
3. En iOS, las notificaciones solo funcionan cuando la PWA está instalada

---

## 🎯 Próximos Pasos

1. **Personalizar notificaciones**: Modifica `notification-trigger/index.ts` para ajustar títulos y mensajes
2. **Agregar imágenes**: Incluye URLs de imágenes en el payload de notificaciones
3. **Notificaciones programadas**: Crea una función para enviar notificaciones en horarios específicos
4. **Analytics**: Implementa tracking de apertura de notificaciones
5. **Segmentación**: Envía notificaciones a grupos específicos de usuarios

---

## 📚 Recursos

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Web Push Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

## 🆘 Soporte

Si tienes problemas con la configuración:

1. Revisa los logs de Supabase Edge Functions
2. Verifica la consola del navegador para errores de JavaScript
3. Comprueba que todas las variables de entorno estén configuradas
4. Asegúrate de que los webhooks estén activos y apuntando a las URLs correctas

---

**¡Sistema de notificaciones push listo para producción! 🚀**
