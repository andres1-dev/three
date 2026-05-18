-- ============================================================================
-- Migración: Agregar campos de consentimiento a PLANTAS y USUARIOS
-- Fecha: 2026-04-20
-- Descripción: Agrega campos para guardar las preferencias de consentimiento
--              de política de datos y notificaciones
-- ============================================================================

-- 1. Agregar campos a la tabla PLANTAS
ALTER TABLE "PLANTAS" 
ADD COLUMN IF NOT EXISTS "ACEPTA_POLITICA_DATOS" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "NOTIFICACIONES" BOOLEAN DEFAULT true;

-- Comentarios para documentar las columnas
COMMENT ON COLUMN "PLANTAS"."ACEPTA_POLITICA_DATOS" IS 'Indica si el usuario aceptó la política de tratamiento de datos personales';
COMMENT ON COLUMN "PLANTAS"."NOTIFICACIONES" IS 'Indica si el usuario aceptó recibir notificaciones operativas del sistema';

-- Actualizar registros existentes para que tengan los valores por defecto
UPDATE "PLANTAS" 
SET "ACEPTA_POLITICA_DATOS" = true, 
    "NOTIFICACIONES" = true
WHERE "ACEPTA_POLITICA_DATOS" IS NULL 
   OR "NOTIFICACIONES" IS NULL;

-- 2. Agregar campos a la tabla USUARIOS
ALTER TABLE "USUARIOS" 
ADD COLUMN IF NOT EXISTS "ACEPTA_POLITICA_DATOS" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "NOTIFICACIONES" BOOLEAN DEFAULT true;

-- Comentarios para documentar las columnas
COMMENT ON COLUMN "USUARIOS"."ACEPTA_POLITICA_DATOS" IS 'Indica si el usuario aceptó la política de tratamiento de datos personales';
COMMENT ON COLUMN "USUARIOS"."NOTIFICACIONES" IS 'Indica si el usuario aceptó recibir notificaciones operativas del sistema';

-- Actualizar registros existentes para que tengan los valores por defecto
UPDATE "USUARIOS" 
SET "ACEPTA_POLITICA_DATOS" = true, 
    "NOTIFICACIONES" = true
WHERE "ACEPTA_POLITICA_DATOS" IS NULL 
   OR "NOTIFICACIONES" IS NULL;

-- 3. Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_plantas_notificaciones ON "PLANTAS"("NOTIFICACIONES");
CREATE INDEX IF NOT EXISTS idx_usuarios_notificaciones ON "USUARIOS"("NOTIFICACIONES");

-- ============================================================================
-- Fin de la migración
-- ============================================================================
