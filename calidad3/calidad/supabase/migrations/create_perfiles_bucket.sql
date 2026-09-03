-- ================================================================
-- BUCKET DE STORAGE PARA PERFILES
-- ================================================================
-- Bucket para almacenar fotos de perfil y portadas de usuarios
-- ================================================================

-- Crear bucket 'perfiles' (público para lectura)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'perfiles',
    'perfiles',
    true, -- Público para lectura
    5242880, -- 5MB máximo por archivo
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- POLÍTICAS RLS PARA EL BUCKET
-- ================================================================

-- Política: Los usuarios pueden ver todas las imágenes (bucket público)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'perfiles');

-- Política: Los usuarios pueden subir sus propias imágenes
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'perfiles' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Los usuarios pueden actualizar sus propias imágenes
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'perfiles' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Los usuarios pueden eliminar sus propias imágenes
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'perfiles' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Los admins pueden gestionar todas las imágenes
DROP POLICY IF EXISTS "Admins can manage all images" ON storage.objects;
CREATE POLICY "Admins can manage all images"
ON storage.objects FOR ALL
USING (
    bucket_id = 'perfiles'
    AND (
        (auth.jwt()->'user_metadata'->>'role')::text = 'ADMIN'
        OR (auth.jwt()->>'role')::text = 'ADMIN'
    )
);

-- ================================================================
-- COMENTARIOS
-- ================================================================
COMMENT ON TABLE storage.buckets IS 'Bucket para fotos de perfil y portadas de usuarios';
