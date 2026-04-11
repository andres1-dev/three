# 🚀 Guía Rápida - Notificaciones Push Nativas

## ✅ Sistema Profesional Listo para Producción

Tu sistema ahora incluye:
- ✅ Notificaciones push nativas (Android, iOS, Web)
- ✅ Funciona cuando la app está cerrada
- ✅ Detección automática de cambios de estado
- ✅ Notificaciones de chat en tiempo real
- ✅ Compatible con todas tus tablas en MAYÚSCULAS

---

## 📋 Pasos de Configuración (30 minutos)

### PASO 1: Firebase (10 min)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea proyecto: `SISPRO-Notifications`
3. Agrega app web: `SISPRO PWA`
4. Ve a **Project Settings** → **Cloud Messaging**:
   - Copia el **Server Key** (para Supabase)
   - Genera **Web Push Certificate** (VAPID)
   - Copia la **Public Key** (para frontend)

### PASO 2: Supabase - Base de Datos (5 min)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Ejecuta el archivo: `supabase/migrations/create_push_notifications.sql`
4. Ejecuta verificación: `supabase/migrations/verify_setup.sql`
5. Verifica que veas ✅ en todos los checks

### PASO 3: Supabase - Variables de Entorno (2 min)

Ve a **Project Settings** → **Edge Functions** → **Environment Variables**

Agrega:
```
FCM_SERVER_KEY=tu_server_key_de_firebase
```

### PASO 4: Supabase - Desplegar Edge Functions (5 min)

```bash
# Instalar CLI (si no lo tienes)
npm install -g supabase

# Login
supabase login

# Vincular proyecto
supabase link --project-ref tu-project-ref

# Desplegar funciones
supabase functions deploy push-notifications
supabase functions deploy notification-trigger
```

### PASO 5: Supabase - Webhooks (5 min)

Ve a **Database** → **Webhooks** → **Create a new hook**

**Webhook 1: NOVEDADES**
```
Name: novedades-notifications
Table: NOVEDADES
Events: INSERT, UPDATE
Type: HTTP Request
Method: POST
URL: https://tu-proyecto.supabase.co/functions/v1/notification-trigger
Headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer TU_ANON_KEY"
}
```

**Webhook 2: CHAT**
```
Name: chat-notifications
Table: CHAT
Events: INSERT
Type: HTTP Request
Method: POST
URL: https://tu-proyecto.supabase.co/functions/v1/notification-trigger
Headers: (igual que arriba)
```

### PASO 6: Frontend - Configuración (3 min)

1. Copia `js/config-push.example.js` como `js/config-push.js`
2. Edita `js/config-push.js` con tus credenciales:

```javascript
const PUSH_NOTIFICATIONS_CONFIG = {
  firebase: {
    apiKey: "TU_API_KEY_DE_FIREBASE",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123",
    vapidKey: "TU_VAPID_PUBLIC_KEY"
  },
  supabase: {
    url: "https://tu-proyecto.supabase.co",
    anonKey: "TU_ANON_KEY"
  }
}
```

3. Agrega a tu `.gitignore`:
```
js/config-push.js
```

### PASO 7: Frontend - Integrar en HTML

Agrega antes de `</body>` en `index.html`, `login.html`, etc.:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"></script>

<!-- Configuración -->
<script src="./js/config-push.js"></script>

<!-- Sistema de notificaciones -->
<script src="./js/push-native.js"></script>

<script>
  // Inicializar Firebase
  if (typeof PUSH_NOTIFICATIONS_CONFIG !== 'undefined') {
    firebase.initializeApp(PUSH_NOTIFICATIONS_CONFIG.firebase);
  }
</script>
```

### PASO 8: Frontend - Inicializar en app.js

Agrega después de inicializar Supabase:

```javascript
// Inicializar notificaciones push
if (window.PushNative && window.PushNative.isSupported()) {
  PushNative.init(
    PUSH_NOTIFICATIONS_CONFIG.supabase.url,
    PUSH_NOTIFICATIONS_CONFIG.supabase.anonKey,
    PUSH_NOTIFICATIONS_CONFIG.firebase.vapidKey
  ).then(success => {
    if (success) {
      console.log('✅ Push notifications inicializadas');
    }
  });
}
```

### PASO 9: Frontend - Solicitar Permisos

Modifica tu función de la campana:

```javascript
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  
  // Solicitar permiso al abrir por primera vez
  if (!isOpen && Notification.permission === 'default') {
    setTimeout(() => {
      if (window.PushNative) {
        PushNative.requestPermission();
      }
    }, 500);
  }
}
```

---

## 🧪 Testing

### Opción 1: Página de Testing (Recomendado)

1. Abre `test-notifications.html` en tu navegador
2. Haz clic en "Solicitar Permisos"
3. Haz clic en "Notificación Remota"
4. Deberías recibir una notificación

### Opción 2: Consola del Navegador

```javascript
// Solicitar permisos
await PushNative.requestPermission();

// Enviar notificación de prueba
await PushNative.sendTest();
```

### Opción 3: Simular Cambio de Estado

En Supabase SQL Editor:

```sql
-- Cambiar estado de una novedad
UPDATE "NOVEDADES" 
SET "ESTADO" = 'ELABORACION' 
WHERE "ID_NOVEDAD" = (
  SELECT "ID_NOVEDAD" FROM "NOVEDADES" LIMIT 1
);
```

### Opción 4: Simular Mensaje de Chat

```sql
-- Insertar mensaje de prueba
INSERT INTO "CHAT" (
  "ID_MSG", "ID_NOVEDAD", "LOTE", "OP", 
  "AUTOR", "ROL", "MENSAJE", "TS"
) VALUES (
  'MSG-TEST', 'NOV-12345678', 'LOTE-001', 'OP-001',
  'ADMIN', 'Juan Pérez', 'Mensaje de prueba', NOW()
);
```

---

## 🔍 Verificación

### Verificar que todo funciona:

```sql
-- Ver suscripciones activas
SELECT * FROM "PUSH_SUBSCRIPTIONS" WHERE "ACTIVE" = true;

-- Ver últimas notificaciones enviadas
SELECT * FROM "PUSH_NOTIFICATIONS_LOG" 
ORDER BY "SENT_AT" DESC LIMIT 5;

-- Ver triggers activos
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

---

## 📱 Comportamiento Esperado

### Cuando cambias el estado de una novedad:
1. El trigger detecta el cambio
2. Llama a `notification-trigger` Edge Function
3. Determina quién debe recibir la notificación
4. Llama a `push-notifications` Edge Function
5. Envía notificación via FCM
6. El usuario recibe notificación nativa (incluso con app cerrada)

### Cuando se envía un mensaje de chat:
1. El trigger detecta el nuevo mensaje
2. Notifica al destinatario correspondiente (GUEST u operador)
3. Notificación aparece instantáneamente

---

## 🐛 Troubleshooting Rápido

### No recibo notificaciones

1. **Verifica permisos**: `Notification.permission` debe ser `"granted"`
2. **Verifica token**: `PushNative.getToken()` debe retornar un token
3. **Verifica logs**: `supabase functions logs notification-trigger --tail`
4. **Verifica webhooks**: Deben estar activos en Supabase Dashboard
5. **Verifica FCM_SERVER_KEY**: Debe estar configurado en variables de entorno

### Error "relation novedades does not exist"

✅ **YA CORREGIDO** - Todos los archivos ahora usan comillas dobles: `"NOVEDADES"`

### Notificaciones duplicadas

```sql
-- Limpiar tokens antiguos
SELECT cleanup_inactive_tokens();
```

---

## 📚 Archivos Creados

```
supabase/
├── functions/
│   ├── push-notifications/index.ts    # Envío de notificaciones
│   └── notification-trigger/index.ts  # Detección automática
├── migrations/
│   ├── create_push_notifications.sql  # Tablas y triggers
│   └── verify_setup.sql               # Verificación
└── NOTAS_IMPORTANTES.md               # Notas sobre mayúsculas

js/
├── push-native.js                     # Cliente de notificaciones
└── config-push.example.js             # Ejemplo de configuración

PUSH_NOTIFICATIONS_SETUP.md            # Documentación completa
GUIA_RAPIDA_NOTIFICACIONES.md          # Esta guía
test-notifications.html                # Página de testing
```

---

## 🎯 Próximos Pasos Opcionales

1. **Personalizar mensajes**: Edita `notification-trigger/index.ts`
2. **Agregar imágenes**: Incluye `imageUrl` en el payload
3. **Notificaciones programadas**: Crea función con cron job
4. **Analytics**: Trackea apertura de notificaciones
5. **Segmentación avanzada**: Envía a grupos específicos

---

## 🆘 Soporte

Si tienes problemas:

1. Ejecuta `supabase/migrations/verify_setup.sql`
2. Revisa logs: `supabase functions logs notification-trigger`
3. Verifica la consola del navegador
4. Revisa `supabase/NOTAS_IMPORTANTES.md`

---

**¡Sistema listo para producción! 🚀**

Las notificaciones ahora funcionarán automáticamente cuando:
- Cambies el estado de una novedad
- Se envíe un mensaje de chat
- Incluso cuando la app esté cerrada o en background
