# 🔧 Solución: Subida de Archivos en Móviles (iOS/Android)

## 🎯 Problema Identificado

Los archivos (imágenes/soportes) se suben correctamente desde PC pero fallan en dispositivos móviles (iOS/Android).

## 🔍 Causas Comunes

1. **Problemas de CORS en móviles**: Los navegadores móviles son más estrictos con CORS
2. **Timeout en conversión de imágenes**: Los móviles tienen menos recursos
3. **Errores silenciosos**: Los errores no se muestran al usuario
4. **Problemas con Content-Type**: Algunos navegadores móviles no aceptan `text/plain`
5. **Tamaño de archivos**: Las fotos de móviles suelen ser muy grandes
6. **Problemas con Canvas API**: Algunos navegadores móviles tienen limitaciones

---

## ✅ Soluciones Implementadas

### 1. Mejora en Conversión de Archivos (`fileToBase64`)

**Cambios:**
- ✅ Timeout de 30 segundos para evitar bloqueos
- ✅ Mejor manejo de errores con mensajes claros
- ✅ Fondo blanco para imágenes con transparencia
- ✅ Calidad adaptativa según tamaño de imagen
- ✅ Validación de base64 generado

### 2. Doble Método de Subida (`_subirArchivoDrive`)

**Cambios:**
- ✅ Intenta primero con `Content-Type: text/plain` (evita preflight)
- ✅ Si falla, intenta con `Content-Type: application/json` (estándar)
- ✅ Logs detallados para debugging
- ✅ Validación de respuesta del servidor

### 3. Mejor Manejo de Errores (`uploadArchivoAsync`)

**Cambios:**
- ✅ Validación de archivo antes de procesar
- ✅ Validación de tamaño (10MB máximo)
- ✅ Mensajes de error claros al usuario
- ✅ Logs detallados en consola
- ✅ Información guardada en localStorage para debugging

### 4. Reintentos Mejorados (`_uploadConReintentos`)

**Cambios:**
- ✅ Backoff exponencial: 2s, 4s, 8s, 16s, 30s
- ✅ Logs de cada intento
- ✅ Notificación al usuario si falla después de 5 intentos
- ✅ El reporte se guarda aunque falle la imagen

---

## 🧪 Herramienta de Diagnóstico

Creamos `diagnostico-upload.html` para probar la subida en cualquier dispositivo.

### Cómo usar:

1. Abre `diagnostico-upload.html` en el dispositivo con problemas
2. Verifica que todos los checks estén en verde
3. Selecciona una foto de prueba
4. Observa los logs en tiempo real
5. Si falla, copia los logs y envíalos para análisis

### Qué verifica:

- ✅ Tipo de dispositivo (Android/iOS/Desktop)
- ✅ Navegador
- ✅ Tipo de conexión
- ✅ Soporte de File API
- ✅ Soporte de Canvas API
- ✅ Disponibilidad de LocalStorage
- ✅ Conversión a base64
- ✅ Subida a Google Drive

---

## 📱 Pasos para Resolver el Problema

### Paso 1: Actualizar el Código

Los archivos ya fueron actualizados:
- ✅ `js/forms/gas.js` - Mejorado con mejor manejo de errores

### Paso 2: Probar en Móvil

1. Abre la app en tu móvil (iOS o Android)
2. Abre la consola del navegador:
   - **iOS Safari**: Settings → Safari → Advanced → Web Inspector
   - **Android Chrome**: chrome://inspect en PC + USB debugging
3. Intenta subir una foto
4. Observa los logs en consola

### Paso 3: Usar Herramienta de Diagnóstico

1. Sube `diagnostico-upload.html` a tu servidor
2. Ábrelo en el móvil con problemas
3. Prueba subir una foto
4. Copia los logs si falla

### Paso 4: Verificar Google Apps Script

Asegúrate de que tu GAS (`uploadDrive.gs`) esté desplegado correctamente:

1. Ve a [Google Apps Script](https://script.google.com/)
2. Abre tu proyecto
3. Ve a **Deploy** → **Manage deployments**
4. Verifica que la versión sea la más reciente
5. Copia la URL del deployment

---

## 🔧 Configuración Adicional Recomendada

### 1. Aumentar Timeout en GAS (Opcional)

Si las imágenes son muy grandes, aumenta el timeout:

```javascript
// En uploadDrive.gs, al inicio
const TIMEOUT_MS = 60000; // 60 segundos
```

### 2. Reducir Calidad de Compresión (Si es necesario)

Si las imágenes siguen siendo muy grandes:

```javascript
// En js/forms/gas.js, función fileToBase64
const quality = w > 800 ? 0.6 : 0.7; // Reducir de 0.7/0.8 a 0.6/0.7
```

### 3. Reducir Tamaño Máximo de Imagen

```javascript
// En js/forms/gas.js, función fileToBase64
const MAX_W = 1024; // Reducir de 1280 a 1024
```

---

## 📊 Logs Esperados (Subida Exitosa)

```
[upload] Iniciando subida para REP-12345678: {nombre: "foto.jpg", tipo: "image/jpeg", tamaño: "2.5MB", hoja: "REPORTES"}
[upload] Archivo convertido a base64: 1.8MB
[upload] Guardado en localStorage: pending_upload_REP-12345678
[upload] Intento 1/5 para REP-12345678
[upload] Subiendo archivo para REP-12345678, tamaño: 1843.2KB
[upload] ✓ Archivo subido exitosamente: https://lh3.googleusercontent.com/d/...
[upload] ✓ Subida completada exitosamente para REP-12345678
```

---

## 🐛 Logs de Error Comunes

### Error 1: Timeout en Conversión

```
[ERROR] Error comprimiendo archivo: Timeout al cargar imagen
```

**Solución**: La imagen es muy grande o el dispositivo es lento. Reduce MAX_W o aumenta timeout.

### Error 2: CORS

```
[ERROR] Error en intento 1: Failed to fetch
```

**Solución**: Verifica que el GAS_ENDPOINT esté desplegado correctamente y sea accesible.

### Error 3: Archivo Muy Grande

```
[ERROR] Archivo muy grande: 15728640
```

**Solución**: El archivo supera los 10MB. Pide al usuario que use una foto más pequeña.

### Error 4: Canvas API No Soportado

```
[ERROR] Error al generar base64 de imagen
```

**Solución**: El navegador no soporta Canvas API. Usa conversión directa sin compresión.

---

## 🎯 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] El código de `js/forms/gas.js` está actualizado
- [ ] El GAS_ENDPOINT es correcto y accesible
- [ ] El archivo es menor a 10MB
- [ ] El dispositivo tiene conexión a internet
- [ ] El navegador soporta File API y Canvas API
- [ ] Los logs en consola muestran el error específico
- [ ] Probaste con `diagnostico-upload.html`

---

## 📞 Soporte

Si el problema persiste después de seguir estos pasos:

1. Abre `diagnostico-upload.html` en el dispositivo
2. Copia todos los logs
3. Toma screenshot de la pantalla
4. Envía:
   - Tipo de dispositivo (ej: iPhone 12, Samsung Galaxy S21)
   - Versión del navegador
   - Logs completos
   - Screenshot

---

## 🚀 Mejoras Futuras (Opcional)

### 1. Subida Directa a Supabase Storage

En lugar de usar Google Drive, subir directamente a Supabase Storage:

**Ventajas:**
- Más rápido
- Mejor manejo de errores
- No depende de GAS
- Mejor integración con el resto del sistema

**Implementación:**
```javascript
// Usar la Edge Function de operations con acción SUBIR_ARCHIVO
const result = await sendToSupabase({
  accion: 'SUBIR_ARCHIVO',
  archivo: {
    base64: fileData.base64,
    mimeType: fileData.mimeType,
    fileName: fileData.fileName
  }
});
```

### 2. Compresión Progresiva

Comprimir la imagen en múltiples pasos si es muy grande:

```javascript
// Intentar con calidad 0.8, si es muy grande, reducir a 0.6, luego 0.4
```

### 3. Subida en Chunks

Para archivos muy grandes, dividir en partes:

```javascript
// Dividir base64 en chunks de 1MB y subir por partes
```

---

**¡El sistema ahora debería funcionar correctamente en todos los dispositivos!** 🎉
