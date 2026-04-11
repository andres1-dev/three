-- ============================================================================
-- SISPRO Push Notifications System (Web Push API Nativo)
-- Migración para sistema de notificaciones push sin Firebase
-- ============================================================================

-- Tabla para almacenar suscripciones Web Push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type TEXT DEFAULT 'web', -- 'web', 'android', 'ios'
  device_info JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON push_subscriptions(user_id, active);

-- Tabla para log de notificaciones enviadas (opcional, para auditoría)
CREATE TABLE IF NOT EXISTS push_notifications_log (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user_id ON push_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_sent_at ON push_notifications_log(sent_at);

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
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications_log ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver/modificar sus propias suscripciones
CREATE POLICY "Users can manage their own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Política: Los usuarios solo pueden ver su propio log
CREATE POLICY "Users can view their own notification log"
  ON push_notifications_log
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Política: Service role puede hacer todo (para Edge Functions)
CREATE POLICY "Service role has full access to subscriptions"
  ON push_subscriptions
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to log"
  ON push_notifications_log
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
  DELETE FROM push_subscriptions
  WHERE active = false
    AND updated_at < NOW() - INTERVAL '30 days';
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
    COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
    MAX(sent_at) as last_notification
  FROM push_notifications_log
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE push_subscriptions IS 'Almacena suscripciones Web Push de dispositivos (sin Firebase)';
COMMENT ON TABLE push_notifications_log IS 'Log de auditoría de notificaciones enviadas';
COMMENT ON FUNCTION notify_webhook() IS 'Invoca webhook para enviar notificaciones push automáticamente';
COMMENT ON FUNCTION cleanup_inactive_tokens() IS 'Limpia tokens inactivos mayores a 30 días';
COMMENT ON FUNCTION get_notification_stats(TEXT) IS 'Obtiene estadísticas de notificaciones de un usuario';
