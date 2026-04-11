-- ============================================================================
-- Script de Verificación - Sistema de Notificaciones Push
-- Ejecuta este script para verificar que todo está configurado correctamente
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR TABLAS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== VERIFICANDO TABLAS ===';
  
  -- Verificar PUSH_SUBSCRIPTIONS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PUSH_SUBSCRIPTIONS') THEN
    RAISE NOTICE '✅ Tabla PUSH_SUBSCRIPTIONS existe';
  ELSE
    RAISE WARNING '❌ Tabla PUSH_SUBSCRIPTIONS NO existe';
  END IF;
  
  -- Verificar PUSH_NOTIFICATIONS_LOG
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PUSH_NOTIFICATIONS_LOG') THEN
    RAISE NOTICE '✅ Tabla PUSH_NOTIFICATIONS_LOG existe';
  ELSE
    RAISE WARNING '❌ Tabla PUSH_NOTIFICATIONS_LOG NO existe';
  END IF;
  
  -- Verificar NOVEDADES (en mayúsculas)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'NOVEDADES') THEN
    RAISE NOTICE '✅ Tabla NOVEDADES existe';
  ELSE
    RAISE WARNING '❌ Tabla NOVEDADES NO existe';
  END IF;
  
  -- Verificar CHAT (en mayúsculas)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CHAT') THEN
    RAISE NOTICE '✅ Tabla CHAT existe';
  ELSE
    RAISE WARNING '❌ Tabla CHAT NO existe';
  END IF;
END $$;

-- ============================================================================
-- 2. VERIFICAR TRIGGERS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICANDO TRIGGERS ===';
  
  -- Verificar trigger en NOVEDADES
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_novedades_notification' 
    AND event_object_table = 'NOVEDADES'
  ) THEN
    RAISE NOTICE '✅ Trigger trigger_novedades_notification existe en NOVEDADES';
  ELSE
    RAISE WARNING '❌ Trigger trigger_novedades_notification NO existe en NOVEDADES';
  END IF;
  
  -- Verificar trigger en CHAT
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_chat_notification' 
    AND event_object_table = 'CHAT'
  ) THEN
    RAISE NOTICE '✅ Trigger trigger_chat_notification existe en CHAT';
  ELSE
    RAISE WARNING '❌ Trigger trigger_chat_notification NO existe en CHAT';
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR FUNCIONES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICANDO FUNCIONES ===';
  
  -- Verificar función notify_webhook
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'notify_webhook'
  ) THEN
    RAISE NOTICE '✅ Función notify_webhook existe';
  ELSE
    RAISE WARNING '❌ Función notify_webhook NO existe';
  END IF;
  
  -- Verificar función cleanup_inactive_tokens
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'cleanup_inactive_tokens'
  ) THEN
    RAISE NOTICE '✅ Función cleanup_inactive_tokens existe';
  ELSE
    RAISE WARNING '❌ Función cleanup_inactive_tokens NO existe';
  END IF;
  
  -- Verificar función get_notification_stats
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'get_notification_stats'
  ) THEN
    RAISE NOTICE '✅ Función get_notification_stats existe';
  ELSE
    RAISE WARNING '❌ Función get_notification_stats NO existe';
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFICAR ÍNDICES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICANDO ÍNDICES ===';
  
  -- Verificar índices en PUSH_SUBSCRIPTIONS
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'PUSH_SUBSCRIPTIONS' 
    AND indexname = 'idx_push_subscriptions_user_id'
  ) THEN
    RAISE NOTICE '✅ Índice idx_push_subscriptions_user_id existe';
  ELSE
    RAISE WARNING '❌ Índice idx_push_subscriptions_user_id NO existe';
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFICAR POLÍTICAS RLS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICANDO POLÍTICAS RLS ===';
  
  -- Verificar RLS habilitado en PUSH_SUBSCRIPTIONS
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'PUSH_SUBSCRIPTIONS' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS habilitado en PUSH_SUBSCRIPTIONS';
  ELSE
    RAISE WARNING '⚠️ RLS NO habilitado en PUSH_SUBSCRIPTIONS';
  END IF;
  
  -- Contar políticas en PUSH_SUBSCRIPTIONS
  DECLARE
    policy_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'PUSH_SUBSCRIPTIONS';
    
    RAISE NOTICE 'ℹ️ PUSH_SUBSCRIPTIONS tiene % política(s)', policy_count;
  END;
END $$;

-- ============================================================================
-- 6. ESTADÍSTICAS DE DATOS
-- ============================================================================

DO $$
DECLARE
  sub_count INTEGER;
  log_count INTEGER;
  nov_count INTEGER;
  chat_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ESTADÍSTICAS DE DATOS ===';
  
  -- Contar suscripciones
  SELECT COUNT(*) INTO sub_count FROM "PUSH_SUBSCRIPTIONS";
  RAISE NOTICE 'ℹ️ Suscripciones registradas: %', sub_count;
  
  -- Contar suscripciones activas
  SELECT COUNT(*) INTO sub_count FROM "PUSH_SUBSCRIPTIONS" WHERE "ACTIVE" = true;
  RAISE NOTICE 'ℹ️ Suscripciones activas: %', sub_count;
  
  -- Contar notificaciones en log
  SELECT COUNT(*) INTO log_count FROM "PUSH_NOTIFICATIONS_LOG";
  RAISE NOTICE 'ℹ️ Notificaciones en log: %', log_count;
  
  -- Contar novedades
  SELECT COUNT(*) INTO nov_count FROM "NOVEDADES";
  RAISE NOTICE 'ℹ️ Novedades totales: %', nov_count;
  
  -- Contar mensajes de chat
  SELECT COUNT(*) INTO chat_count FROM "CHAT";
  RAISE NOTICE 'ℹ️ Mensajes de chat: %', chat_count;
END $$;

-- ============================================================================
-- 7. RESUMEN FINAL
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== RESUMEN ===';
  RAISE NOTICE 'Verificación completada. Revisa los mensajes arriba.';
  RAISE NOTICE 'Si ves ❌, ejecuta la migración create_push_notifications.sql';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- QUERIES ÚTILES PARA DEBUGGING
-- ============================================================================

-- Ver todas las tablas del esquema public
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Ver todos los triggers
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation 
-- FROM information_schema.triggers 
-- WHERE trigger_schema = 'public';

-- Ver todas las funciones
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public';

-- Ver suscripciones activas con detalles
-- SELECT "USER_ID", "DEVICE_TYPE", "ACTIVE", "LAST_UPDATED" 
-- FROM "PUSH_SUBSCRIPTIONS" 
-- WHERE "ACTIVE" = true 
-- ORDER BY "LAST_UPDATED" DESC;

-- Ver últimas notificaciones enviadas
-- SELECT "USER_ID", "TITLE", "STATUS", "SENT_AT" 
-- FROM "PUSH_NOTIFICATIONS_LOG" 
-- ORDER BY "SENT_AT" DESC 
-- LIMIT 10;
