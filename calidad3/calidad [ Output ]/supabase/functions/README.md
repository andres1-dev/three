# Edge Functions - Proyecto Calidad

Este directorio contiene las Edge Functions de Supabase para el proyecto Calidad.

## Estructura Modular

Cada edge function maneja un dominio específico de la aplicación:

- **`personas/`** - Gestión de usuarios y plantas (talleres)
  - LISTAR_USUARIOS
  - LISTAR_PLANTAS
  - CREAR_USUARIO
  - UPDATE_USER
  - CREAR_PLANTA
  - ACTUALIZAR_PLANTA

- **`operations/`** - (Por migrar) Operaciones generales heredadas del sistema legacy

## Despliegue

### 1. Instalar Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# macOS
brew install supabase/tap/supabase

# Linux
brew install supabase/tap/supabase
```

### 2. Login en Supabase

```bash
supabase login
```

### 3. Link al proyecto

```bash
supabase link --project-ref efocfgjunowtkrgxepbn
```

### 4. Desplegar una función específica

```bash
# Desplegar la función personas
supabase functions deploy personas

# Desplegar todas las funciones
supabase functions deploy
```

### 5. Ver logs en tiempo real

```bash
supabase functions logs personas --tail
```

## Base de Datos

Las tablas ya están creadas en Supabase (heredadas del proyecto anterior):
- `usuarios` - Tabla de usuarios internos
- `plantas` - Tabla de plantas/talleres
- Todas las demás tablas del sistema legacy

## Variables de Entorno

Las edge functions tienen acceso automático a:

- `SUPABASE_URL` - URL del proyecto (https://efocfgjunowtkrgxepbn.supabase.co)
- `SUPABASE_ANON_KEY` - Clave pública anon
- `SUPABASE_SERVICE_ROLE_KEY` - Clave de servicio (admin)

## Testing Local

```bash
# Servir funciones localmente
supabase functions serve personas --env-file ./supabase/.env.local

# Hacer request de prueba
curl -i --location --request POST 'http://localhost:54321/functions/v1/personas' \
  --header 'Authorization: Bearer SUPABASE_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"accion":"LISTAR_USUARIOS"}'
```

## Estructura de Payload

### Listar Usuarios
```json
{
  "accion": "LISTAR_USUARIOS"
}
```

### Crear Usuario
```json
{
  "accion": "CREAR_USUARIO",
  "id": "1234567890",
  "usuario": "Juan Pérez",
  "correo": "juan@ejemplo.com",
  "telefono": "3001234567",
  "rol": "USER-P",
  "password": "password123",
  "id_productora": 1,
  "productora": "TEXTILES Y CREACIONES EL UNIVERSO S.A.S."
}
```

### Actualizar Usuario
```json
{
  "accion": "UPDATE_USER",
  "id": "1234567890",
  "telefono": "3009876543",
  "rol": "MODERATOR"
}
```

### Crear Planta
```json
{
  "accion": "CREAR_PLANTA",
  "id": "900123456",
  "nombrePlanta": "Taller El Norte",
  "correo": "taller@ejemplo.com",
  "telefono": "6012345678",
  "direccion": "Calle 123 # 45-67",
  "password": "password123"
}
```

## Seguridad

- Todas las funciones usan el token de autenticación del usuario actual
- RLS (Row Level Security) se aplica automáticamente en Supabase
- Las contraseñas deben ser hasheadas antes de guardar (usar bcrypt en producción)

## Migracion desde Operations

El sistema anterior usaba una única edge function `operations` que manejaba todas las acciones.
Ahora estamos migrando a funciones modulares por dominio:

- ✅ `personas` - Migrado y funcionando
- ⏳ `novedades` - Por migrar
- ⏳ `reportes` - Por migrar
- ⏳ `rutero` - Por migrar
- ⏳ `chat` - Por migrar

El archivo `gas.js` enruta automáticamente a la función correcta según la acción.
