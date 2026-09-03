# Migraciones de Base de Datos

## Crear tabla `perfiles`

Esta migración crea la tabla complementaria `perfiles` que almacena información extendida de los usuarios.

### Opción 1: Ejecutar desde Supabase Dashboard (SQL Editor)

1. Ve a tu proyecto en https://supabase.com/dashboard/project/efocfgjunowtkrgxepbn
2. Abre el **SQL Editor** (menú lateral)
3. Copia y pega el contenido de `create_perfiles_table.sql`
4. Click en **Run** o presiona `Ctrl + Enter`

### Opción 2: Ejecutar desde Supabase CLI

```powershell
# Desde el directorio raíz del proyecto
cd "calidad [ Output ]"

# Ejecutar la migración
supabase db push --db-url "postgresql://postgres:[TU-PASSWORD]@db.efocfgjunowtkrgxepbn.supabase.co:5432/postgres"
```

O si tienes el proyecto vinculado localmente:

```powershell
# Vincular proyecto (solo la primera vez)
supabase link --project-ref efocfgjunowtkrgxepbn

# Ejecutar migraciones
supabase db push
```

### Verificar que la tabla se creó correctamente

```sql
-- Ejecuta esto en el SQL Editor para verificar
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'perfiles'
ORDER BY ordinal_position;
```

### Verificar que el trigger funciona

```sql
-- Ver triggers activos
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table = 'perfiles';
```

## Campos de la tabla `perfiles`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK auto-generado |
| `auth_user_id` | UUID | FK → auth.users(id) |
| `foto_url` | TEXT | URL de la foto de perfil |
| `portada_url` | TEXT | URL de la imagen de portada |
| `cedula` | TEXT | Cédula / ID nacional |
| `full_name` | TEXT | Nombre completo |
| `telefono` | TEXT | Teléfono |
| `direccion` | TEXT | Dirección residencial |
| `pais` | TEXT | País (default: 'Colombia') |
| `departamento` | TEXT | Departamento/Estado |
| `ciudad` | TEXT | Ciudad |
| `barrio` | TEXT | Barrio |
| `comuna` | TEXT | Comuna |
| `cargo` | TEXT | Cargo laboral |
| `area` | TEXT | Área de trabajo |
| `fecha_contratacion` | DATE | Fecha de ingreso |
| `sede` | TEXT | Sede de trabajo |
| `division` | TEXT | División |
| `id_productora` | INTEGER | ID de productora |
| `productora` | TEXT | Nombre de productora |
| `contacto_emergencia` | TEXT | Nombre contacto emergencia |
| `telefono_emergencia` | TEXT | Teléfono de emergencia |
| `firma_svg` | TEXT | Firma digital en SVG |
| `estado_personalizado` | TEXT | Estado del usuario |
| `disponible` | BOOLEAN | Disponibilidad (default: true) |
| `email_copia` | BOOLEAN | Recibir copia de emails |
| `notificaciones_activas` | BOOLEAN | Notificaciones activadas |
| `created_at` | TIMESTAMPTZ | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | Última actualización |

## Políticas RLS

La tabla tiene RLS habilitado con estas políticas:

- **SELECT propio perfil**: Los usuarios pueden ver su propio perfil
- **UPDATE propio perfil**: Los usuarios pueden editar su propio perfil  
- **SELECT admin**: Los admins (role='ADMIN') pueden ver todos los perfiles
- **UPDATE admin**: Los admins pueden editar todos los perfiles

## Triggers automáticos

1. **`set_updated_at`**: Actualiza automáticamente el campo `updated_at` al modificar un registro
2. **`on_auth_user_created`**: Crea automáticamente un registro en `perfiles` cuando se crea un usuario en `auth.users`

## Después de ejecutar la migración

1. Redeploy la edge function `personas`:
   ```powershell
   supabase functions deploy personas
   ```

2. El frontend ya está configurado para usar los nuevos campos

3. Prueba cargando el módulo `personas` en la app
