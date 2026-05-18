-- Habilitar RLS en la tabla password_reset_tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Solo el service_role puede insertar tokens (desde Edge Functions o GAS)
CREATE POLICY "Service role can insert tokens"
ON password_reset_tokens
FOR INSERT
TO service_role
WITH CHECK (true);

-- Política: Solo el service_role puede leer tokens (desde Edge Functions)
CREATE POLICY "Service role can read tokens"
ON password_reset_tokens
FOR SELECT
TO service_role
USING (true);

-- Política: Solo el service_role puede actualizar tokens (marcar como usado)
CREATE POLICY "Service role can update tokens"
ON password_reset_tokens
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Política: Permitir eliminar tokens expirados (opcional, para limpieza)
CREATE POLICY "Service role can delete expired tokens"
ON password_reset_tokens
FOR DELETE
TO service_role
USING (expires_at < NOW() - INTERVAL '1 day');

-- Comentarios para documentación
COMMENT ON TABLE password_reset_tokens IS 'Tabla protegida con RLS. Solo accesible mediante service_role desde Edge Functions y Google Apps Script.';
COMMENT ON POLICY "Service role can insert tokens" ON password_reset_tokens IS 'Permite a GAS y Edge Functions crear tokens de reseteo';
COMMENT ON POLICY "Service role can read tokens" ON password_reset_tokens IS 'Permite a Edge Functions validar tokens';
COMMENT ON POLICY "Service role can update tokens" ON password_reset_tokens IS 'Permite marcar tokens como usados';
COMMENT ON POLICY "Service role can delete expired tokens" ON password_reset_tokens IS 'Permite limpiar tokens antiguos';
