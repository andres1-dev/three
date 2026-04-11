-- ============================================================================
-- SISPRO Push Notifications System
-- Migración para sistema de notificaciones push nativas
-- ============================================================================

-- Tabla para almacenar tokens FCM de dispositivos
CREATE TABLE IF NOT EXISTS PUSH_SUBSCRIPTIONS (
  ID SERIAL PRIMARY KEY,
  USER_ID TEXT NOT NULL,
  FCM_TOKEN TEXT NOT NULL,
  DEVICE_TYPE TEXT DEFAULT 'web', -- 'web', 'android', 'ios'
  DEVICE_INFO JSONB DEFAULT '{}',
  ACTIVE BOOLEAN DEFAULT true,
  CREATED_AT TIMESTAMP DEFAULT NOW(),
  LAST_UPDATED TIMESTAMP DEFAULT NOW(),
  UNIQUE(USER_ID, FCM_TOKEN)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON PUSH_SUBSCRIPTIONS(USER_ID);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON PUSH_SUBSCRIPTIONS(ACTIVE);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON PUSH_SUBSCRIPTIONS(USER_ID, ACTIVE);

-- Tabla para log de notificaciones enviadas (opcional, para auditoría)
CREATE TABLE IF NOT EXISTS PUSH_NOTIFICATIONS_LOG (
  ID SERIAL PRIMARY KEY,
  USER_ID TEXT NOT NULL,
  TITLE TEXT NOT NULL,
  BODY TEXT,
  DATA JSONB DEFAULT '{}',
  STATUS TEXT DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  ERROR_MESSAGE TEXT,
  SENT_AT TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user_id ON PUSH_NOTIFICATIONS_LOG(USER_ID);
CREATE INDEX IF NOT EXISTS idx_push_log_sent_at ON PUSH_NOTIFICATIONS_LOG(SENT_AT);

-- ============================================================================
-- TRIGGERS PARA NOTIFICACIONES AUTOMÁTICAS
-- ============================================================================

-- Función para invocar el webhook de notificaciones
CREATE OR REPLACE FUNCTION notify_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  -- URL del webhook (Edge Function notification-trigger)
  webhook_url := current_setting('app.settings.webhook_url', true);
  
  IF webhook_url IS NULL THEN
    -- Si no está configurado, usar la URL por defecto
    -- IMPORTANTE: Reemplazar con tu URL real de Supabase
    webhook_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notification-trigger';
  END IF;

  -- Construir payload según el tipo de operación
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
  ELSIF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'type', 'DELETE',
      'table', TG_TABLE_NAME,
      'old_record', row_to_json(OLD)
    );
  END IF;

  -- Invocar webhook usando pg_net (requiere extensión pg_net)
  -- Si no tienes pg_net, puedes usar http extension o manejar esto desde el cliente
  PERFORM net.http_post(
    url := webhook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para cambios en NOVEDADES (tabla en mayúsculas)
DROP TRIGGER IF EXISTS trigger_novedades_notification ON "NOVEDADES";
CREATE TRIGGER trigger_novedades_notification
  AFTER INSERT OR UPDATE ON "NOVEDADES"
  FOR EACH ROW
  EXECUTE FUNCTION notify_webhook();

-- Trigger para nuevos mensajes en CHAT (tabla en mayúsculas)
DROP TRIGGER IF EXISTS trigger_chat_notification ON "CHAT";
CREATE TRIGGER trigger_chat_notification
  AFTER INSERT ON "CHAT"
  FOR EACH ROW
  EXECUTE FUNCTION notify_webhook();

-- ============================================================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE PUSH_SUBSCRIPTIONS ENABLE ROW LEVEL SECURITY;
ALTER TABLE PUSH_NOTIFICATIONS_LOG ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver/modificar sus propias suscripciones
CREATE POLICY "Users can manage their own subscriptions"
  ON PUSH_SUBSCRIPTIONS
  FOR ALL
  USING (USER_ID = current_setting('request.jwt.claims', true)::json->>'sub');

-- Política: Los usuarios solo pueden ver su propio log
CREATE POLICY "Users can view their own notification log"
  ON PUSH_NOTIFICATIONS_LOG
  FOR SELECT
  USING (USER_ID = current_setting('request.jwt.claims', true)::json->>'sub');

-- Política: Service role puede hacer todo (para Edge Functions)
CREATE POLICY "Service role has full access to subscriptions"
  ON PUSH_SUBSCRIPTIONS
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to log"
  ON PUSH_NOTIFICATIONS_LOG
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Función para limpiar tokens inactivos (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_inactive_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM PUSH_SUBSCRIPTIONS
  WHERE ACTIVE = false
    AND LAST_UPDATED < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de notificaciones
CREATE OR REPLACE FUNCTION get_notification_stats(user_id_param TEXT)
RETURNS TABLE(
  total_sent BIGINT,
  total_failed BIGINT,
  last_notification TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE STATUS = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE STATUS = 'failed') as total_failed,
    MAX(SENT_AT) as last_notification
  FROM PUSH_NOTIFICATIONS_LOG
  WHERE USER_ID = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE PUSH_SUBSCRIPTIONS IS 'Almacena tokens FCM de dispositivos para notificaciones push';
COMMENT ON TABLE PUSH_NOTIFICATIONS_LOG IS 'Log de auditoría de notificaciones enviadas';
COMMENT ON FUNCTION notify_webhook() IS 'Invoca webhook para enviar notificaciones push automáticamente';
COMMENT ON FUNCTION cleanup_inactive_tokens() IS 'Limpia tokens inactivos mayores a 30 días';
COMMENT ON FUNCTION get_notification_stats(TEXT) IS 'Obtiene estadísticas de notificaciones de un usuario';
