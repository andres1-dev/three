# DEBUG: Realtime no funciona

## Problema
- Los mensajes NO aparecen en tiempo real en el otro chat
- NO aparece el log `💬 ¡EVENTO REALTIME RECIBIDO!`
- Las notificaciones NO llegan

## Posibles causas

### 1. Realtime no habilitado en la tabla CHAT
En Supabase Dashboard:
1. Ve a Database → Replication
2. Busca la tabla `CHAT`
3. Verifica que esté ENABLED

### 2. RLS bloqueando Realtime
Aunque uses Service Role Key para queries, Realtime usa el ANON key y puede estar bloqueado por RLS.

**SOLUCIÓN:** Crear política RLS que permita SELECT a todos:

```sql
-- En Supabase SQL Editor
CREATE POLICY "Enable realtime for all users" ON "CHAT"
FOR SELECT
USING (true);
```

### 3. El filtro de Realtime no funciona
El filtro `ID_NOVEDAD=eq.NOV-XXX` puede no estar funcionando.

**SOLUCIÓN:** Cambiar a escuchar TODOS los eventos y filtrar en el callback:

```javascript
.on('postgres_changes', { 
    event: '*',
    schema: 'public',
    table: 'CHAT'
    // SIN FILTRO
}, payload => {
    // Filtrar aquí
    if (payload.new?.ID_NOVEDAD === _chatNovedadId) {
        console.log('[CHAT] 💬 ¡EVENTO REALTIME RECIBIDO!');
        _loadAndRender();
    }
})
```

### 4. Múltiples canales conflictivos
Si hay muchos canales abiertos, pueden interferir entre sí.

**SOLUCIÓN:** Usar un solo canal global para CHAT y filtrar en memoria.

## Prueba rápida
Ejecuta esto en la consola del navegador:

```javascript
const sb = window.getSupabaseClient();
const testChannel = sb.channel('test-realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'CHAT'
  }, payload => {
    console.log('🔥 REALTIME FUNCIONA:', payload);
  })
  .subscribe(status => {
    console.log('📡 Status:', status);
  });
```

Luego envía un mensaje desde el otro navegador. Si ves `🔥 REALTIME FUNCIONA:`, entonces Realtime está funcionando pero hay un problema con el filtro o la lógica.
