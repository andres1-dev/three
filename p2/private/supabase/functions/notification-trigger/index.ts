import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

/**
 * Edge Function: Notification Trigger
 * 
 * Se ejecuta automáticamente cuando hay cambios en las tablas NOVEDADES o CHAT
 * mediante Database Webhooks de Supabase
 * 
 * Detecta:
 * - Cambios de estado en novedades (PENDIENTE → ELABORACION → FINALIZADO)
 * - Nuevos mensajes de chat
 * - Nuevas novedades creadas
 * 
 * Y envía notificaciones push automáticamente a los usuarios relevantes
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-webhook-signature",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    console.log('[NOTIFICATION-TRIGGER] Webhook recibido:', payload.type, payload.table)

    const { type, table, record, old_record } = payload

    // Determinar qué tipo de notificación enviar
    let notificationData: any = null

    // Normalizar nombre de tabla (puede venir en mayúsculas o minúsculas)
    const tableName = table.toUpperCase()

    if (tableName === 'NOVEDADES' && type === 'UPDATE') {
      // Cambio de estado en novedad
      const oldState = old_record?.ESTADO
      const newState = record?.ESTADO

      if (oldState !== newState) {
        notificationData = await handleNovedadStateChange(
          supabaseClient,
          record,
          oldState,
          newState
        )
      }
    } else if (tableName === 'NOVEDADES' && type === 'INSERT') {
      // Nueva novedad creada
      notificationData = await handleNewNovedad(supabaseClient, record)
    } else if (tableName === 'CHAT' && type === 'INSERT') {
      // Nuevo mensaje de chat
      notificationData = await handleNewChatMessage(supabaseClient, record)
    }

    // Si hay datos de notificación, enviarla
    if (notificationData) {
      await sendNotification(supabaseClient, notificationData)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Webhook procesado correctamente" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error(`[NOTIFICATION-TRIGGER ERROR]`, error.message)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})

/**
 * Maneja cambios de estado en novedades
 */
async function handleNovedadStateChange(
  supabase: any,
  record: any,
  oldState: string,
  newState: string
): Promise<any> {
  console.log(`[TRIGGER] Cambio de estado: ${oldState} → ${newState}`)

  const lote = record.LOTE || 'S/N'
  const planta = record.PLANTA || ''
  const idNovedad = record.ID_NOVEDAD

  let title = ''
  let body = ''
  let emoji = ''

  if (newState === 'ELABORACION') {
    emoji = '🔧'
    title = `${emoji} Lote ${lote} — En Elaboración`
    body = `Tu novedad está siendo procesada por ${planta}`
  } else if (newState === 'FINALIZADO') {
    emoji = '✅'
    title = `${emoji} Lote ${lote} — Solucionado`
    body = `La novedad ha sido resuelta exitosamente`
  } else {
    return null // No enviar notificación para otros estados
  }

  // Determinar destinatarios
  // Si la novedad tiene un ID_USUARIO asociado, enviar solo a ese usuario
  // Si no, enviar a todos los GUEST
  const recipients = []
  
  if (record.ID_USUARIO) {
    recipients.push(record.ID_USUARIO)
  } else {
    // Obtener todos los usuarios GUEST (tabla en mayúsculas)
    const { data: guests } = await supabase
      .from('USUARIOS')
      .select('ID_USUARIO')
      .eq('ROL', 'GUEST')
    
    if (guests) {
      recipients.push(...guests.map((g: any) => g.ID_USUARIO))
    }
  }

  return {
    userIds: recipients,
    title,
    body,
    data: {
      type: 'estado',
      idNovedad,
      lote,
      planta,
      estadoAnterior: oldState,
      estadoActual: newState,
      url: `./seguimiento.html#${idNovedad}`,
      tag: `novedad_${idNovedad}`,
    }
  }
}

/**
 * Maneja nuevas novedades creadas
 */
async function handleNewNovedad(supabase: any, record: any): Promise<any> {
  console.log('[TRIGGER] Nueva novedad creada:', record.ID_NOVEDAD)

  const lote = record.LOTE || 'S/N'
  const area = record.AREA || 'General'

  // Notificar a usuarios ADMIN y USER-P (tabla en mayúsculas)
  const { data: operators } = await supabase
    .from('USUARIOS')
    .select('ID_USUARIO')
    .in('ROL', ['ADMIN', 'USER-P'])

  if (!operators || operators.length === 0) return null

  return {
    userIds: operators.map((o: any) => o.ID_USUARIO),
    title: '📋 Nueva Novedad Reportada',
    body: `Lote ${lote} — ${area}`,
    data: {
      type: 'nueva_novedad',
      idNovedad: record.ID_NOVEDAD,
      lote,
      area,
      url: `./index.html#${record.ID_NOVEDAD}`,
      tag: `nueva_novedad_${record.ID_NOVEDAD}`,
    }
  }
}

/**
 * Maneja nuevos mensajes de chat
 */
async function handleNewChatMessage(supabase: any, record: any): Promise<any> {
  console.log('[TRIGGER] Nuevo mensaje de chat:', record.ID_MSG)

  const idNovedad = record.ID_NOVEDAD
  const lote = record.LOTE || 'S/N'
  const autor = record.ROL || record.AUTOR // Nombre real del autor
  const mensaje = record.MENSAJE || ''
  const rolAutor = record.AUTOR // ROL del autor (ADMIN/GUEST)

  // Obtener información de la novedad para determinar destinatarios (tabla en mayúsculas)
  const { data: novedad } = await supabase
    .from('NOVEDADES')
    .select('ID_USUARIO, PLANTA')
    .eq('ID_NOVEDAD', idNovedad)
    .single()

  if (!novedad) return null

  const recipients = []

  // Si el mensaje es de un GUEST, notificar a operadores
  // Si el mensaje es de un operador, notificar al GUEST
  if (rolAutor === 'GUEST') {
    // Notificar a operadores (ADMIN y USER-P) (tabla en mayúsculas)
    const { data: operators } = await supabase
      .from('USUARIOS')
      .select('ID_USUARIO')
      .in('ROL', ['ADMIN', 'USER-P'])
    
    if (operators) {
      recipients.push(...operators.map((o: any) => o.ID_USUARIO))
    }
  } else {
    // Notificar al GUEST que creó la novedad
    if (novedad.ID_USUARIO) {
      recipients.push(novedad.ID_USUARIO)
    }
  }

  if (recipients.length === 0) return null

  const preview = mensaje.substring(0, 60) + (mensaje.length > 60 ? '...' : '')

  return {
    userIds: recipients,
    title: `💬 Mensaje — Lote ${lote}`,
    body: `${autor}: ${preview}`,
    data: {
      type: 'chat',
      idNovedad,
      lote,
      autor,
      mensaje,
      url: `./index.html#chat_${idNovedad}`,
      tag: `chat_${idNovedad}`,
    }
  }
}

/**
 * Envía la notificación usando la función push-notifications
 */
async function sendNotification(supabase: any, notificationData: any): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[TRIGGER] Faltan variables de entorno para enviar notificación')
    return
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/push-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'send-batch',
        ...notificationData,
      }),
    })

    const result = await response.json()
    console.log('[TRIGGER] Notificación enviada:', result)
  } catch (error) {
    console.error('[TRIGGER] Error enviando notificación:', error.message)
  }
}
