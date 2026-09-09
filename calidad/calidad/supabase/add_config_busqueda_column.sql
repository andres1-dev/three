-- Agregar columna config_busqueda (JSONB) a la tabla perfiles
-- Esta columna almacenará la configuración personalizada de búsqueda y pestañas
-- Formato esperado: { "searchFields": {...}, "tabs": {...} }

ALTER TABLE perfiles 
ADD COLUMN IF NOT EXISTS config_busqueda JSONB DEFAULT '{"searchFields":{"productora":true,"op":true,"referencia":true,"planta":true},"tabs":{"aql":true,"curva":true,"gps":true}}'::jsonb;

-- Comentario para documentación
COMMENT ON COLUMN perfiles.config_busqueda IS 'Configuración personalizada de búsqueda y visibilidad de pestañas (calidad)';