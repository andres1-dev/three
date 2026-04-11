-- ============================================================================
-- SISPRO Push Notifications - 100% Supabase Native
-- Sistema de notificaciones usando Web Push API estándar
-- SIN FIREBASE - Solo Supabase + Web Push Protocol
-- ============================================================================

-- Tabla para almacenar suscripciones Web Push
CREATE TABLE IF NOT EXISTS "PUSH_SUBSCRIPTIONS" (
  "ID" SERIAL PRIMARY KEY,
  "USER_ID" TEXT NOT NULL,
  "ENDPOINT" TEXT NOT NULL,
  "P256DH_KEY" TEXT NOT NULL,
  "AUTH_KEY" TEXT NOT NULL,
  "DEVICE_TYPE" TEXT DEFAULT 'web',
  "DEVICE_INFO" JSONB DEFAULT '{}',
  "ACTIVE" BOOLEAN DEFAULT true,
  "CREATED_AT" TIMESTAMP DEFAULT NOW(),
  "LAST_UPDATED" TIMESTAMP DEFAULT NOW(),
  UNIQUE("USER_ID", "ENDPOINT")
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON "PUSH_SUBSCRIPTIONS"("USER_ID");
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON "PUSH_SUBSCRIPTIONS"("ACTIVE");
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON "PUSH_SUBSCRIPTIONS"("USER_ID", "ACTIVE");
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON "PUSH_SUBSCRIPTIONS"("ENDPOINT");

-- Tabla para log de notificaciones enviadas
CREATE TABLE IF NOT EXISTS "PUSH_NOTIFICATIONS_LOG" (
  "ID" SERIAL PRIMARY KEY,
  "USER_ID" TEXT NOT NULL,
  "TITLE" TEXT NOT NULL,
  "BODY" TEXT,
  "DATA" JSONB DEFAULT '{}',
  "STATUS" TEXT DEFAULT 'sent',
  "ERROR_MESSAGE" TEXT,
  "SENT_AT" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user_id ON "PUSH_NOTIFICATIONS_LOG"("USER_ID");
CREATE INDEX IF NOT EXISTS idx_push_log_sent_at ON "PUSH_NOTIFICATIONS_LOG"("SENT_AT");

-- ============================================================================
-- TRIGGERS PARA NOTIFICACIONES AUTOMÁTICAS
-- ============================================================================

-- Función para invocar Edge Function de notificaciones
CREATE OR REPLACE FUNCTION notify_push_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
  http_request_id BIGINT;
BEGIN
  -- URL de la Edge Function
  webhook_url := current_setting('app.settings.webhook_url', true);
  
  IF webhook_url IS NULL THEN
    webhook_url := 'https://doqsurxxxaudnutsydlk.supabase.co/functions/v1/notification-trigger';
  END IF;

  -- Construir payload
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    );
  END IF;

  -- Invocar webhook usando pg_net (si está disponible)
  -- Si no tienes pg_net, los webhooks de Supabase Dashboard harán el trabajo
  BEGIN
    SELECT net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := payload
    ) INTO http_request_id;
  EXCEPTION WHEN OTHERS THEN
    -- Si pg_net no está disponible, solo loguear
    RAISE NOTICE 'pg_net no disponible, usar webhooks de Dashboard';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para cambios en NOVEDADES
DROP TRIGGER IF EXISTS trigger_novedades_push ON "NOVEDADES";
CREATE TRIGGER trigger_novedades_push
  AFTER INSERT OR UPDATE ON "NOVEDADES"
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_webhook();

-- Trigger para nuevos mensajes en CHAT
DROP TRIGGER IF EXISTS trigger_chat_push ON "CHAT";
CREATE TRIGGER trigger_chat_push
  AFTER INSERT ON "CHAT"
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_webhook();

-- ============================================================================
-- POLÍTICAS RLS
-- ============================================================================

ALTER TABLE "PUSH_SUBSCRIPTIONS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PUSH_NOTIFICATIONS_LOG" ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden gestionar sus propias suscripciones
CREATE POLICY "Users can manage their own subscriptions"
  ON "PUSH_SUBSCRIPTIONS"
  FOR ALL
  USING ("USER_ID" = current_setting('request.jwt.claims', true)::json->>'sub');

-- Los usuarios pueden ver su propio log
CREATE POLICY "Users can view their own notification log"
  ON "PUSH_NOTIFICATIONS_LOG"
  FOR SELECT
  USING ("USER_ID" = current_setting('request.jwt.claims', true)::json->>'sub');

-- Service role tiene acceso completo
CREATE POLICY "Service role has full access to subscriptions"
  ON "PUSH_SUBSCRIPTIONS"
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to log"
  ON "PUSH_NOTIFICATIONS_LOG"
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Limpiar suscripciones inactivas
CREATE OR REPLACE FUNCTION cleanup_inactive_subscriptions()
RETURNS void AS $$
BEGIN
  DELETE FROM "PUSH_SUBSCRIPTIONS"
  WHERE "ACTIVE" = false
    AND "LAST_UPDATED" < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener estadísticas
CREATE OR REPLACE FUNCTION get_push_stats(user_id_param TEXT)
RETURNS TABLE(
  total_sent BIGINT,
  total_failed BIGINT,
  last_notification TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE "STATUS" = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE "STATUS" = 'failed') as total_failed,
    MAX("SENT_AT") as last_notification
  FROM "PUSH_NOTIFICATIONS_LOG"
  WHERE "USER_ID" = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE "PUSH_SUBSCRIPTIONS" IS 'Suscripciones Web Push nativas (sin Firebase)';
COMMENT ON TABLE "PUSH_NOTIFICATIONS_LOG" IS 'Log de notificaciones enviadas';
COMMENT ON FUNCTION notify_push_webhook() IS 'Trigger para enviar notificaciones automáticamente';
COMMENT ON FUNCTION cleanup_inactive_subscriptions() IS 'Limpia suscripciones inactivas';
COMMENT ON FUNCTION get_push_stats(TEXT) IS 'Estadísticas de notificaciones por usuario';
