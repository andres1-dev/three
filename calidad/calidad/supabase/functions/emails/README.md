# Edge Function: Emails con SendGrid

Esta Edge Function reemplaza la implementación anterior con Google Apps Script para enviar notificaciones por email usando **SendGrid**, un servicio robusto de envío de emails con plan gratuito sin restricciones.

## Setup

### 1. Crear cuenta en SendGrid

1. Ve a [sendgrid.com](https://sendgrid.com) y crea una cuenta gratuita
2. En el dashboard, obtén tu **API Key** en Settings → API Keys
3. Copia la API Key (ej: `SG.xxx...`)

### 2. Configurar secreto en Supabase

En **Supabase Dashboard → Settings → Edge Functions Secrets**, agrega:

```
SENDGRID_API_KEY = SG.xxx... (tu API key de SendGrid)
```

### 3. Desplegar la Edge Function

```bash
supabase functions deploy emails
```

Verifica que no haya errores de despliegue.

## 🔍 Cómo verificar que funciona

### Desde Supabase Logs:

1. Ve a **Supabase Dashboard → Functions**
2. Selecciona `emails`
3. Activa **Logs** para ver requests en tiempo real
4. Ejecuta un test (ver abajo)

### Log esperado:
```
[REPORTE_CALIDAD] Enviando email a: taller@example.com
[REPORTE_CALIDAD] Email URL: https://...
[REPORTE_CALIDAD] Email response: success
[REPORTE_CALIDAD] Email enviado exitosamente
```

### Errores comunes:

```
SENDGRID_API_KEY is missing
→ Agrega la variable de entorno en Supabase Secrets

Invalid API Key
→ Verifica que el API Key sea correcto (debe empezar con "SG.")

Email field is required
→ El payload no incluye el campo "email"

401 Unauthorized
→ El SENDGRID_API_KEY es inválido o expiró
```

## ✅ Ventajas de SendGrid

- ✅ Plan gratuito: 100 emails/día sin restricciones
- ✅ Sin verificación de dominio requerida
- ✅ Puedes enviar a cualquier email
- ✅ Mejor entregabilidad que alternativas
- ✅ API robusta y bien documentada

## Acciones Soportadas

### NOVEDAD_REGISTRADA
Notifica cuando se registra una nueva novedad.

```json
{
  "accion": "NOVEDAD_REGISTRADA",
  "email": "taller@example.com",
  "nombre": "Taller Ejemplo",
  "idNovedad": "NOV20260910-1",
  "lote": "OP-222",
  "referencia": "REF-001"
}
```

### CHAT_INICIADO
Notifica cuando un agente inicia una conversación.

```json
{
  "accion": "CHAT_INICIADO",
  "email": "taller@example.com",
  "nombre": "Taller Ejemplo",
  "idNovedad": "NOV20260910-1",
  "lote": "OP-222",
  "referencia": "REF-001"
}
```

### CHAT_FINALIZADO
Notifica cuando se cierra una conversación.

```json
{
  "accion": "CHAT_FINALIZADO",
  "email": "taller@example.com",
  "nombre": "Taller Ejemplo",
  "idNovedad": "NOV20260910-1",
  "lote": "OP-222",
  "referencia": "REF-001"
}
```

### NOVEDAD_FINALIZADA_CON_SOLUCION
Notifica la resolución de una novedad.

```json
{
  "accion": "NOVEDAD_FINALIZADA_CON_SOLUCION",
  "email": "taller@example.com",
  "nombre": "Taller Ejemplo",
  "idNovedad": "NOV20260910-1",
  "lote": "OP-222",
  "referencia": "REF-001",
  "solucion": "Descripción detallada de la solución implementada...",
  "tipoCobro": "TALLER"
}
```

### REPORTE_CALIDAD
Envía reporte de auditoría, ronda o contramuestra.

```json
{
  "accion": "REPORTE_CALIDAD",
  "email": "productora@example.com",
  "nombre": "Productora Ejemplo",
  "reporte": {
    "ID": "OP-222",
    "ID_REPORTE": "REP20260910-1",
    "REFERENCIA": "REF-001",
    "TIPO_VISITA": "AUDITORIA",
    "CONCLUSION": "APROBADO",
    "CANTIDAD": "100",
    "PROCESO": "CONFECCIÓN",
    "PRENDA": "Camiseta",
    "GENERO": "Masculino",
    "LINEA": "CASUAL",
    "PLANTA": "CARLOS ANDRES MENDOZA",
    "auditor_nombre": "Carlos Auditor",
    "DESTINO_PROCESO": "TERMINACIÓN",
    "DESTINO_PLANTA": "PLANTA B",
    "ENTRADA": "2026-09-20",
    "OBSERVACIONES": "Lote conforme a especificaciones.",
    "NOVEDADES_AUDITORIA": []
  },
  "cc": ["supervisor@example.com"]
}
```

## Variables de Configuración

Edita estas variables en el código si es necesario:

```typescript
const SENDER_EMAIL = "notificaciones@grupo-tdm.com"  // Dominio verificado en Resend
const SENDER_NAME = "Grupo TDM - Notificaciones"      // Nombre del remitente
```

## Testing

Desde el cliente:

```javascript
const res = await fetch('https://tu-proyecto.supabase.co/functions/v1/emails', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseClient.auth.session()?.access_token}`
  },
  body: JSON.stringify({
    accion: 'NOVEDAD_REGISTRADA',
    email: 'test@example.com',
    nombre: 'Test User',
    idNovedad: 'NOV20260910-1',
    lote: 'OP-222',
    referencia: 'REF-001'
  })
})

const data = await res.json()
console.log(data)
```

## Ventajas sobre GAS

✅ Sin limitación de cuota diaria (GAS = 100/día)
✅ Mejor entregabilidad y tracking
✅ Soporte para dominios personalizados
✅ API moderna y documentación robusta
✅ No requiere fallbacks ni colas complejas
✅ Integración nativa con Supabase
