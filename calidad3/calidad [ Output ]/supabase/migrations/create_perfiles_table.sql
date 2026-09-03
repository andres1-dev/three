-- ================================================================
-- TABLA COMPLEMENTARIA DE PERFILES
-- ================================================================
-- Esta tabla complementa los datos de auth.users con información
-- de perfil extendida, incluyendo foto, portada y campos personalizados.
--
-- RELACIÓN: 1-a-1 con auth.users mediante auth_user_id
-- ================================================================

CREATE TABLE IF NOT EXISTS public.perfiles (
    -- ── Identificadores ──────────────────────────────────────────
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- ── Imágenes de perfil ───────────────────────────────────────
    foto_url TEXT, -- URL de la foto de perfil (avatar)
    portada_url TEXT, -- URL de la imagen de portada/cover
    
    -- ── Datos personales ─────────────────────────────────────────
    cedula TEXT, -- Cédula / ID nacional
    full_name TEXT,
    telefono TEXT,
    direccion TEXT,
    
    -- ── Ubicación ────────────────────────────────────────────────
    pais TEXT DEFAULT 'Colombia',
    departamento TEXT,
    ciudad TEXT,
    barrio TEXT,
    comuna TEXT,
    
    -- ── Información laboral ──────────────────────────────────────
    cargo TEXT,
    area TEXT,
    fecha_contratacion DATE,
    sede TEXT,
    division TEXT,
    
    -- ── Organización ─────────────────────────────────────────────
    id_productora INTEGER,
    productora TEXT,
    
    -- ── Contacto emergencia ──────────────────────────────────────
    contacto_emergencia TEXT,
    telefono_emergencia TEXT,
    
    -- ── Firma digital ────────────────────────────────────────────
    firma_svg TEXT, -- SVG de la firma digital del usuario
    
    -- ── Estado y disponibilidad ──────────────────────────────────
    estado_personalizado TEXT, -- "💡 Actualiza tu estado..."
    disponible BOOLEAN DEFAULT true,
    
    -- ── Preferencias ─────────────────────────────────────────────
    email_copia BOOLEAN DEFAULT false,
    notificaciones_activas BOOLEAN DEFAULT true,
    
    -- ── Control de versiones ─────────────────────────────────────
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- ── Índices ──────────────────────────────────────────────────
    CONSTRAINT perfiles_auth_user_id_key UNIQUE (auth_user_id)
);

-- ================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_perfiles_auth_user_id ON public.perfiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_cedula ON public.perfiles(cedula);
CREATE INDEX IF NOT EXISTS idx_perfiles_productora ON public.perfiles(id_productora);
CREATE INDEX IF NOT EXISTS idx_perfiles_updated_at ON public.perfiles(updated_at DESC);

-- ================================================================
-- TRIGGER PARA AUTO-ACTUALIZAR updated_at
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.perfiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.perfiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ================================================================
-- FUNCIÓN PARA CREAR PERFIL AUTOMÁTICAMENTE AL CREAR USUARIO
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfiles (
        auth_user_id,
        full_name,
        cedula,
        telefono,
        id_productora,
        productora
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'cedula',
        COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
        NULLIF(NEW.raw_user_meta_data->>'id_productora', '')::INTEGER,
        NEW.raw_user_meta_data->>'productora'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- RLS (ROW LEVEL SECURITY)
-- ================================================================
-- DESHABILITADO: La edge function usa SERVICE_ROLE_KEY para todas
-- las operaciones, haciendo bypass de RLS. No se permite acceso
-- directo desde el cliente a esta tabla.
-- ================================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Sin políticas = acceso denegado para clientes normales
-- Solo la edge function con SERVICE_ROLE_KEY puede acceder

-- ================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ================================================================
COMMENT ON TABLE public.perfiles IS 'Tabla complementaria de perfiles de usuario con datos extendidos, foto y portada';
COMMENT ON COLUMN public.perfiles.auth_user_id IS 'Relación 1-a-1 con auth.users';
COMMENT ON COLUMN public.perfiles.foto_url IS 'URL de la foto de perfil (avatar)';
COMMENT ON COLUMN public.perfiles.portada_url IS 'URL de la imagen de portada/cover';
COMMENT ON COLUMN public.perfiles.cedula IS 'Cédula / ID nacional del usuario';
COMMENT ON COLUMN public.perfiles.firma_svg IS 'SVG de la firma digital del usuario';
COMMENT ON COLUMN public.perfiles.estado_personalizado IS 'Estado personalizado del usuario (ej: "💡 Trabajando en...")';
