# Guía de Despliegue - Edge Function Personas

## Pasos Rápidos

### 1. Instalar Supabase CLI (solo primera vez)

**Windows (PowerShell como Administrador):**
```powershell
scoop install supabase
```

Si no tienes Scoop:
```powershell
irm get.scoop.sh | iex
```

### 2. Login en Supabase
```bash
supabase login
```

Se abrirá tu navegador para autorizar.

### 3. Link al proyecto
```bash
cd "calidad [ Output ]"
supabase link --project-ref efocfgjunowtkrgxepbn
```

### 4. Desplegar la función personas
```bash
supabase functions deploy personas
```

### 5. Verificar el despliegue

La función estará disponible en:
```
https://efocfgjunowtkrgxepbn.supabase.co/functions/v1/personas
```

## Testing

### Probar desde el navegador (consola):

```javascript
// Test: Listar usuarios
const response = await fetch('https://efocfgjunowtkrgxepbn.supabase.co/functions/v1/personas', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb2NmZ2p1bm93dGtyZ3hlcGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDY4NTMsImV4cCI6MjEwNDAyMjg1M30.zNT_9F-tYTt9_auHFehszbSkq8enCBm0ICheExMuOeM',
    'Authorization': 'Bearer TU_TOKEN_DE_SESION'
  },
  body: JSON.stringify({ accion: 'LISTAR_USUARIOS' })
});

const data = await response.json();
console.log(data);
```

### Ver logs en tiempo real:
```bash
supabase functions logs personas --tail
```

## Script PowerShell

Ejecuta el script interactivo:
```powershell
cd supabase
.\deploy.ps1
```

## Importante

- Las tablas YA EXISTEN en Supabase (del proyecto anterior)
- Solo necesitas desplegar la edge function
- El módulo `personas` en el frontend automáticamente usa la nueva función
- No se requiere migración de datos

## Solución de Problemas

### Error: "supabase: command not found"
Instala Supabase CLI (paso 1)

### Error: "Project not linked"
Ejecuta: `supabase link --project-ref efocfgjunowtkrgxepbn`

### Error: "Failed to deploy"
Verifica que estés logueado: `supabase login`

### Ver errores de la función
```bash
supabase functions logs personas --tail
```
