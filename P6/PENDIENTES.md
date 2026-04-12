# Tareas Pendientes - Sistema de Notificaciones Push con Supabase

## ✅ COMPLETADO

### 1. Sistema de Notificaciones Push con Supabase
- ✅ Archivo `js/push-supabase.js` creado con Web Push API nativo
- ✅ Service Worker `sw.js` actualizado para soportar Web Push de Supabase
- ✅ Edge Function `supabase/functions/push-notifications/index.ts` implementada
- ✅ Edge Function `supabase/functions/notification-trigger/index.ts` implementada
- ✅ Migración SQL `supabase/migrations/create_push_notifications.sql` creada
- ✅ Script `generate-vapid-keys.js` para generar VAPID keys
- ✅ VAPID Public Key configurada en `js/config.js`
- ✅ Sistema antiguo (push.js con GAS) desactivado
- ✅ Funciones `activarNotificaciones()` y `enviarNotificacionPrueba()` expuestas globalmente
- ✅ Script `push-supabase.js` agregado a todos los HTML
- ✅ Todas las versiones (?v=X) eliminadas de los scripts en HTML

### 2. Audios Embebidos en Base64
- ✅ Archivo `js/sounds.js` con audios MP3 embebidos como Data URI Base64
- ✅ Constante `CHAT_AUDIO_BASE64` con el audio de chat
- ✅ Constante `STATE_AUDIO_BASE64` con el audio de estado
- ✅ Sistema de sonidos adaptado para usar Base64 en lugar de archivos externos
- ✅ No hay referencias a archivos MP3 externos en el código

### 3. Correcciones Previas
- ✅ Problema de subida de archivos en móviles solucionado
- ✅ Error de formato de fecha en PostgreSQL corregido
- ✅ Atributo required eliminado de inputs de archivo

---

## ⚠️ PENDIENTE - ACCIONES DEL USUARIO

### 1. Ejecutar Migración SQL en Supabase
**Archivo:** `supabase/migrations/create_push_notifications.sql`

**Pasos:**
1. Ir a Supabase Dashboard → SQL Editor
2. Copiar y ejecutar el contenido del archivo de migración
3. Verificar que las tablas `push_subscriptions` y `push_notifications_log` se hayan creado

### 2. Configurar Variables de Entorno en Supabase
**Ubicación:** Supabase Dashboard → Settings → Edge Functions → Secrets

**Variables requeridas:**
```
VAPID_PUBLIC_KEY=MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMUTkkkISEH7rI9lCSvaSK4uxyfpcDH_SQL5Pm663bMaOeNvLmjta8ABCz5u3cdWj8rfWl8mRxj2aMNnMSHtjQA
VAPID_PRIVATE_KEY=[Tu clave privada generada]
VAPID_SUBJECT=mailto:admin@sispro.com
```

**Nota:** La clave privada debe ser generada con el script `generate-vapid-keys.js` si aún no la tienes.

### 3. Desplegar Edge Functions en Supabase
**Comandos:**
```bash
supabase functions deploy push-notifications
supabase functions deploy notification-trigger
```

### 4. Probar el Sistema
**En la aplicación web:**
1. Abrir la aplicación en el navegador
2. Hacer clic en el botón de notificaciones (campana)
3. Aceptar los permisos de notificaciones
4. Verificar que aparezca la notificación de prueba: "🔔 Notificación de Prueba"
5. Verificar en Supabase Dashboard que se haya registrado la suscripción en la tabla `push_subscriptions`

**En iOS (Safari 16.4+):**
1. Instalar la PWA en la pantalla de inicio
2. Abrir la app desde la pantalla de inicio (NO desde Safari)
3. Activar las notificaciones desde la configuración de la app
4. Verificar que funcione la notificación de prueba

---

## 📋 VERIFICACIÓN FINAL

### Checklist de Funcionalidad
- [ ] Migración SQL ejecutada correctamente
- [ ] Variables de entorno configuradas en Supabase
- [ ] Edge Functions desplegadas
- [ ] Notificaciones funcionan en Chrome/Edge (Desktop)
- [ ] Notificaciones funcionan en Android
- [ ] Notificaciones funcionan en iOS (PWA instalada)
- [ ] Suscripciones se registran en la tabla `push_subscriptions`
- [ ] Audios de notificación funcionan correctamente (Base64)
- [ ] No hay errores en la consola del navegador

---

## 🔧 TROUBLESHOOTING

### Si las notificaciones no funcionan:
1. Verificar que las variables de entorno estén configuradas en Supabase
2. Verificar que las Edge Functions estén desplegadas
3. Abrir la consola del navegador y buscar errores con `[PUSH-SUPABASE]`
4. Verificar que el Service Worker esté registrado correctamente
5. En iOS, asegurarse de que la PWA esté instalada y abierta desde la pantalla de inicio

### Si los audios no funcionan:
1. Verificar que el archivo `js/sounds.js` esté cargado correctamente
2. Verificar que las constantes `CHAT_AUDIO_BASE64` y `STATE_AUDIO_BASE64` existan
3. Verificar permisos de audio en el navegador
4. Verificar que no haya errores en la consola con `[SOUND]`

---

## 📝 NOTAS IMPORTANTES

1. **iOS Requiere PWA Instalada:** Las notificaciones push en iOS solo funcionan si la aplicación está instalada en la pantalla de inicio y se abre desde ahí (Safari 16.4+).

2. **VAPID Keys:** Las claves VAPID son únicas para tu aplicación. No las compartas públicamente. La clave pública puede estar en el código del cliente, pero la privada debe estar solo en Supabase.

3. **Audios en Base64:** Los audios están embebidos en el código como Data URI Base64, por lo que no se necesitan archivos externos. Esto mejora la velocidad de carga y evita problemas de CORS.

4. **Sistema Antiguo Desactivado:** El sistema antiguo de notificaciones con GAS (Google Apps Script) está desactivado. Si necesitas reactivarlo, descomenta la auto-inicialización en `js/push.js`.

5. **Sin Caché:** El Service Worker está configurado SIN CACHÉ para facilitar el desarrollo. En producción, considera habilitar el caché para mejorar el rendimiento.
