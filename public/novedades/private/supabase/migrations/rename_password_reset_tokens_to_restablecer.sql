-- Renombrar tabla password_reset_tokens a RESTABLECER
ALTER TABLE password_reset_tokens RENAME TO "RESTABLECER";

-- Renombrar índices
ALTER INDEX idx_password_reset_user_id RENAME TO idx_restablecer_user_id;
ALTER INDEX idx_password_reset_token RENAME TO idx_restablecer_token;
ALTER INDEX idx_password_reset_expires RENAME TO idx_restablecer_expires;

-- Las políticas RLS se renombran automáticamente con la tabla, pero podemos actualizarlas
DROP POLICY IF EXISTS "Service role can insert tokens" ON "RESTABLECER";
DROP POLICY IF EXISTS "Service role can read tokens" ON "RESTABLECER";
DROP POLICY IF EXISTS "Service role can update tokens" ON "RESTABLECER";
DROP POLICY IF EXISTS "Service role can delete expired tokens" ON "RESTABLECER";

-- Recrear políticas con nuevos nombres
CREATE POLICY "Service role puede insertar tokens"
ON "RESTABLECER"
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role puede leer tokens"
ON "RESTABLECER"
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role puede actualizar tokens"
ON "RESTABLECER"
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role puede eliminar tokens expirados"
ON "RESTABLECER"
FOR DELETE
TO service_role
USING (expires_at < NOW() - INTERVAL '1 day');

-- Actualizar comentario de la tabla
COMMENT ON TABLE "RESTABLECER" IS 'Tabla de tokens para restablecer contraseñas. Protegida con RLS, solo accesible mediante service_role.';
