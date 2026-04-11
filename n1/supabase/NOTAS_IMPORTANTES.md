# ⚠️ Notas Importantes - PostgreSQL y Nombres en Mayúsculas

## Problema con Nombres de Tablas en Mayúsculas

PostgreSQL es **case-sensitive** cuando usas comillas dobles, pero **case-insensitive** sin comillas (convierte todo a minúsculas).

### ❌ Incorrecto (causará error)
```sql
SELECT * FROM NOVEDADES;  -- PostgreSQL busca "novedades" (minúsculas)
```

### ✅ Correcto
```sql
SELECT * FROM "NOVEDADES";  -- Busca exactamente "NOVEDADES" (mayúsculas)
```

---

## Soluciones Implementadas

### 1. En los Triggers SQL
```sql
-- Usar comillas dobles para nombres en mayúsculas
CREATE TRIGGER trigger_novedades_notification
  AFTER INSERT OR UPDATE ON "NOVEDADES"  -- ✅ Con comillas
  FOR EACH ROW
  EXECUTE FUNCTION notify_webhook();
```

### 2. En Edge Functions (TypeScript)
```typescript
// Supabase JS Client maneja automáticamente los nombres
const { data } = await supabase
  .from('NOVEDADES')  // ✅ Sin comillas, el cliente lo maneja
  .select('*')
```

### 3. En Webhooks de Supabase
Cuando configures webhooks en el Dashboard:
- Table: `NOVEDADES` (sin comillas en la UI)
- Supabase automáticamente agregará las comillas necesarias

---

## Verificación de Tablas

Para verificar los nombres exactos de tus tablas:

```sql
-- Ver todas las tablas y sus nombres exactos
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Ver columnas de una tabla específica
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'NOVEDADES';
```

---

## Checklist de Configuración

- [ ] Migración SQL ejecutada con comillas dobles: `"NOVEDADES"`, `"CHAT"`
- [ ] Triggers creados correctamente (verificar con `\d+ "NOVEDADES"` en psql)
- [ ] Edge Functions desplegadas
- [ ] Webhooks configurados apuntando a las tablas correctas
- [ ] Variables de entorno configuradas en Supabase
- [ ] Firebase configurado con credenciales correctas

---

## Comandos Útiles para Debugging

### Ver triggers activos
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table 
FROM information_schema.triggers 
WHERE event_object_schema = 'public';
```

### Ver funciones creadas
```sql
SELECT 
  routine_name, 
  routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public';
```

### Probar trigger manualmente
```sql
-- Esto debería disparar el trigger y enviar notificación
UPDATE "NOVEDADES" 
SET "ESTADO" = 'ELABORACION' 
WHERE "ID_NOVEDAD" = (
  SELECT "ID_NOVEDAD" 
  FROM "NOVEDADES" 
  LIMIT 1
);
```

---

## Logs y Debugging

### Ver logs de Edge Functions
```bash
# En terminal con Supabase CLI
supabase functions logs push-notifications --tail
supabase functions logs notification-trigger --tail
```

### Ver logs en Dashboard
1. Ve a **Edge Functions** en Supabase Dashboard
2. Selecciona la función
3. Ve a la pestaña **Logs**
4. Filtra por errores o busca mensajes específicos

---

## Errores Comunes y Soluciones

### Error: `relation "novedades" does not exist`
**Causa**: PostgreSQL está buscando en minúsculas  
**Solución**: Usar comillas dobles: `"NOVEDADES"`

### Error: `trigger does not exist`
**Causa**: El trigger no se creó correctamente  
**Solución**: Re-ejecutar la migración con comillas dobles

### Error: `FCM_SERVER_KEY no configurada`
**Causa**: Variable de entorno no configurada  
**Solución**: Agregar en Project Settings → Edge Functions → Environment Variables

### Webhook no se dispara
**Causa**: Webhook mal configurado o tabla incorrecta  
**Solución**: 
1. Verificar que la tabla sea exactamente `NOVEDADES` (mayúsculas)
2. Verificar que la URL del webhook sea correcta
3. Verificar que los eventos estén seleccionados (INSERT, UPDATE)

---

## Mejores Prácticas

1. **Siempre usar comillas dobles** en SQL cuando los nombres están en mayúsculas
2. **No usar comillas** en el cliente de Supabase JS (lo maneja automáticamente)
3. **Verificar logs** después de cada cambio
4. **Probar con queries manuales** antes de confiar en los triggers
5. **Mantener consistencia** en los nombres de columnas y tablas

---

## Recursos Adicionales

- [PostgreSQL Case Sensitivity](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
