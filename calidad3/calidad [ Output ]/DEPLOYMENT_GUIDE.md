# 📋 Guía de Deployment — Tabla Perfiles + Edge Function

## 🎯 Resumen de cambios

Se agregó soporte completo para **información complementaria de usuarios** mediante:

1. **Nueva tabla `perfiles`** en Supabase con todos los campos del perfil
2. **Edge function actualizada** (`personas`) para incluir datos de `perfiles`
3. **Frontend actualizado** para mostrar foto, portada y campos extendidos

---

## 📦 Archivos creados/modificados

### Nuevos archivos:
- `supabase/migrations/create_perfiles_table.sql` — SQL para crear tabla perfiles
- `supabase/migrations/README.md` — Documentación de la migración
- `DEPLOYMENT_GUIDE.md` — Esta guía

### Archivos modificados:
- `supabase/functions/personas/index.ts` — Edge function actualizada
- `public/js/auth.js` — Carga de datos no bloqueante (fix login)
- `public/modules/perfil/script.js` — Soporte para foto/portada

---

## 🚀 Pasos para deployment

### 1️⃣ Crear tabla `perfiles` en Supabase

**Opción A: Desde Dashboard (recomendado)**

1. Ve a https://supabase.com/dashboard/project/efocfgjunowtkrgxepbn
2. Abre **SQL Editor** (menú lateral izquierdo)
3. Abre `supabase/migrations/create_perfiles_table.sql`
4. Copia TODO el contenido del archivo
5. Pégalo en el SQL Editor
6. Click en **Run** (o presiona `Ctrl + Enter`)
7. Verifica que no haya errores

**Opción B: Desde CLI**

```powershell
cd "calidad [ Output ]"

# Vincular proyecto (solo primera vez)
supabase link --project-ref efocfgjunowtkrgxepbn

# Ejecutar migración
supabase db push
```

### 2️⃣ Verificar que la tabla se creó

Ejecuta esto en SQL Editor:

```sql
-- Ver columnas de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'perfiles'
ORDER BY ordinal_position;

-- Ver triggers activos
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'perfiles';
```

Deberías ver:
- **24 columnas** (id, auth_user_id, foto_url, portada_url, cedula, full_name, etc.)
- **2 triggers** (set_updated_at, on_auth_user_created)

### 3️⃣ Desplegar Edge Function actualizada

```powershell
cd "calidad [ Output ]"

# Opción 1: Script interactivo
.\supabase\deploy.ps1

# Opción 2: Comando directo
supabase functions deploy personas
```

Verifica que el deployment fue exitoso:
```
✅ Deployed Function personas with version: xxxxx
```

### 4️⃣ Verificar en el frontend

1. Abre la app: https://localhost:5501 (o tu servidor local)
2. Haz login
3. **VERIFICAR FIX LOGIN**: 
   - La página debe cargar **inmediatamente** sin quedarse "pegada"
   - En consola debe aparecer: `[AUTH] UI desbloqueada — cargando datos en background...`
4. Abre el módulo **Personas**
5. Verifica que carga los 28 usuarios
6. Abre tu **Perfil** (desde el bottom nav)
7. Verifica que muestra los datos correctamente

---

## 🗃️ Estructura de la tabla `perfiles`

### Campos principales:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **Imágenes** | | |
| `foto_url` | TEXT | URL de la foto de perfil (avatar) |
| `portada_url` | TEXT | URL de la imagen de portada |
| **Datos personales** | | |
| `cedula` | TEXT | Cédula / ID nacional |
| `full_name` | TEXT | Nombre completo |
| `telefono` | TEXT | Teléfono |
| `direccion` | TEXT | Dirección residencial |
| **Ubicación** | | |
| `pais` | TEXT | País (default: 'Colombia') |
| `departamento` | TEXT | Departamento/Estado |
| `ciudad` | TEXT | Ciudad |
| `barrio` | TEXT | Barrio |
| `comuna` | TEXT | Comuna |
| **Información laboral** | | |
| `cargo` | TEXT | Cargo laboral |
| `area` | TEXT | Área de trabajo |
| `fecha_contratacion` | DATE | Fecha de ingreso |
| `sede` | TEXT | Sede de trabajo |
| `division` | TEXT | División |
| **Organización** | | |
| `id_productora` | INTEGER | ID de productora |
| `productora` | TEXT | Nombre de productora |
| **Contacto emergencia** | | |
| `contacto_emergencia` | TEXT | Nombre contacto emergencia |
| `telefono_emergencia` | TEXT | Teléfono de emergencia |
| **Otros** | | |
| `firma_svg` | TEXT | Firma digital en SVG |
| `estado_personalizado` | TEXT | Estado del usuario (ej: "💡 Trabajando...") |

### Relaciones:

- **1-a-1 con `auth.users`** mediante `auth_user_id`
- **Eliminación en cascada**: Si se borra el usuario de Auth, se borra su perfil automáticamente

### Políticas RLS:

✅ Los usuarios pueden ver/editar **su propio perfil**  
✅ Los **admins** (`role='ADMIN'`) pueden ver/editar **todos los perfiles**

### Triggers automáticos:

1. **`set_updated_at`**: Actualiza `updated_at` automáticamente al modificar
2. **`on_auth_user_created`**: Crea registro en `perfiles` al crear usuario en Auth

---

## 🔄 Migración de datos existentes (opcional)

Si ya tienes usuarios y quieres migrar sus datos desde la tabla `usuarios` a `perfiles`:

```sql
-- Migrar datos de usuarios → perfiles
INSERT INTO public.perfiles (
    auth_user_id,
    cedula,
    full_name,
    telefono,
    id_productora,
    productora,
    firma_svg,
    email_copia
)
SELECT 
    auth_user_id,
    cedula,
    full_name,
    phone,
    id_productora,
    productora,
    firma_svg,
    email_copia
FROM public.usuarios
ON CONFLICT (auth_user_id) DO NOTHING;
```

---

## 🧪 Testing

### Test 1: Login no se queda pegado

1. Cierra sesión
2. Vuelve a hacer login
3. **Debe redirigir a index.html inmediatamente** (sin esperar 1243 plantas)
4. En consola debe aparecer:
   ```
   [AUTH] UI desbloqueada — cargando datos en background...
   [AUTH] Datos cargados: 28 usuarios, 1243 plantas
   ```

### Test 2: Módulo Personas carga correctamente

1. Abre el módulo **Personas**
2. Debe mostrar 28 usuarios y 1243 plantas
3. No debe haber errores en consola

### Test 3: Perfil muestra datos extendidos

1. Abre tu **Perfil**
2. Verifica que muestra:
   - Nombre completo
   - Avatar (iniciales con gradiente por ahora)
   - Cédula (no UUID)
   - Cargo, área, fecha de contratación
   - Ubicación completa
   - Contacto

---

## 🐛 Troubleshooting

### Error: "column perfiles.xxx does not exist"

**Causa**: La tabla `perfiles` no se creó o faltan columnas  
**Solución**: Ejecuta el SQL de migración nuevamente

### Error: "relation perfiles does not exist"

**Causa**: La tabla `perfiles` no existe  
**Solución**: Ejecuta `create_perfiles_table.sql` en SQL Editor

### Error: Edge function retorna 400

**Causa**: La edge function no se redesplegó después de crear la tabla  
**Solución**: 
```powershell
supabase functions deploy personas
```

### Login se queda pegado

**Causa**: `auth.js` no se actualizó correctamente  
**Solución**: 
1. Verifica que `auth.js` tenga el cambio en `loadUsers()`
2. Limpia caché del navegador (`Ctrl + F5`)
3. Vuelve a hacer login

### Datos no aparecen en perfil

**Causa**: `currentUser` no tiene los campos de `perfiles`  
**Solución**: 
1. Abre consola del navegador
2. Ejecuta: `console.log(window.currentUser)`
3. Verifica que tenga campos como `foto_url`, `cargo`, `ciudad`, etc.
4. Si no los tiene, verifica que la edge function se desplegó correctamente

---

## 📝 Próximos pasos

1. **Subir fotos de perfil**: Integrar con Supabase Storage
2. **Subir portadas**: Integrar con Supabase Storage
3. **Editar perfil**: Crear formulario de edición
4. **Firma digital**: Agregar funcionalidad de captura de firma SVG
5. **Estado personalizado**: Permitir editar el estado desde el perfil

---

## 🔗 Referencias

- **Proyecto Supabase**: https://supabase.com/dashboard/project/efocfgjunowtkrgxepbn
- **Edge Function URL**: https://efocfgjunowtkrgxepbn.supabase.co/functions/v1/personas
- **Documentación Supabase**: https://supabase.com/docs

---

## ✅ Checklist de deployment

- [ ] 1. Crear tabla `perfiles` en Supabase
- [ ] 2. Verificar triggers y políticas RLS
- [ ] 3. Desplegar edge function `personas`
- [ ] 4. Verificar que login funciona sin quedarse pegado
- [ ] 5. Verificar que módulo Personas carga usuarios y plantas
- [ ] 6. Verificar que Perfil muestra datos correctamente
- [ ] 7. (Opcional) Migrar datos desde tabla `usuarios` antigua

---

**Fecha**: 2026-09-03  
**Versión**: 1.0  
**Autor**: Kiro AI
