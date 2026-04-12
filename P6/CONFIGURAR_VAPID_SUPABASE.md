# 🔑 Configuración de VAPID Keys en Supabase

## ✅ Paso 1: Frontend (Ya Completado)
La clave pública ya está actualizada en `js/config.js`

## 🔧 Paso 2: Configurar Supabase Edge Functions

### Accede a tu Dashboard de Supabase:
1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto: **doqsurxxxaudnutsydlk**
3. Ve a: **Project Settings** → **Edge Functions** → **Environment Variables**

### Agrega estas 3 variables de entorno:

```
VAPID_PUBLIC_KEY=BHz68DT2EOWcn9P5pYWs2EGtyuSFNauEZWKhtSFug-isgjrQF5egahSWbsPAXhRPjPl2MCtGT0SBq04QgMORyY0

VAPID_PRIVATE_KEY=SiUKErtICCmTDgAC3XFPrmN7twl5DK6QfQV0Hd1RU94

VAPID_SUBJECT=mailto:soporte@grupotdm.com
```

### Captura de pantalla de dónde agregar las variables:
```
Supabase Dashboard
  └─ Project Settings (⚙️)
      └─ Edge Functions
          └─ Environment Variables
              └─ [+ Add Variable]
```

## 🔄 Paso 3: Reiniciar Edge Functions (Opcional)

Si las notificaciones no funcionan inmediatamente después de agregar las variables:

1. Ve a: **Edge Functions** en el menú lateral
2. Encuentra la función: `push-notifications`
3. Haz clic en **Redeploy** o **Restart**

## ✅ Paso 4: Probar las Notificaciones

1. Recarga tu aplicación web (Ctrl + F5)
2. Haz clic en el ícono de la campana 🔔
3. Activa las notificaciones
4. Deberías ver: "¡SISPRO Activado!" como notificación de prueba

## 🐛 Solución de Problemas

### Si ves el error: "The provided applicationServerKey is not valid"
- Verifica que copiaste las claves COMPLETAS (sin espacios ni saltos de línea)
- Asegúrate de que las 3 variables estén en Supabase
- Reinicia las Edge Functions

### Si las notificaciones no llegan:
- Verifica que el navegador tenga permisos de notificaciones
- Revisa la consola del navegador para ver logs de [PUSH-SUPABASE]
- Verifica que la Edge Function `push-notifications` esté desplegada

## 📝 Notas Importantes

⚠️ **NUNCA** expongas la `VAPID_PRIVATE_KEY` en el código del frontend
✅ Solo la `VAPID_PUBLIC_KEY` debe estar en `js/config.js`
🔒 Las claves privadas deben estar SOLO en Supabase Edge Functions

## 🎯 Resultado Esperado

Después de configurar correctamente:
```
[PUSH-SUPABASE] Service Worker registrado
[PUSH-SUPABASE] Suscripción registrada correctamente
[PUSH] ✅ Notificaciones activadas correctamente
```

---

**Fecha de generación:** 2025-01-11
**Válido para:** Proyecto SISPRO - Grupo TDM
