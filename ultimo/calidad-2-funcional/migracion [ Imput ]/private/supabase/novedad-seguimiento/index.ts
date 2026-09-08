import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts"

// ============================================================================
// novedad-seguimiento — Edge Function pública de seguimiento
//
// Acciones disponibles (POST con JSON):
//
//   GET_NOVEDAD      { accion, id_novedad }
//   GET_CHAT_MSGS    { accion, id_novedad }
//   SEND_CHAT_MSG    { accion, id_novedad, mensaje, autor, imagen? }
//
// Usa SUPABASE_SERVICE_ROLE_KEY internamente.
// Ninguna credencial se expone al cliente.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Campos de novedad expuestos al público
const PUBLIC_NOVEDAD_FIELDS = [
  'id_novedad', 'fecha', 'id', 'referencia', 'cantidad', 'planta',
  'salida', 'proceso', 'prenda', 'genero', 'area', 'tipo_novedad',
  'tipo_detalle', 'descripcion', 'cantidad_solicitada', 'imagen',
  'estado', 'chat', 'historial_estados', 'productora', 'comentarios',
].join(', ')

const BUCKET = 'novedades-imagenes'
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Método no permitido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    )
  }

  try {
    const body = await req.json()
    const accion = String(body.accion || 'GET_NOVEDAD').toUpperCase()
    const idNovedad = String(body.id_novedad || body.idNovedad || '').trim()

    if (!idNovedad) {
      return new Response(
        JSON.stringify({ success: false, message: "Se requiere id_novedad" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Cliente con service_role — las credenciales nunca salen del servidor
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // ── GET_NOVEDAD ──────────────────────────────────────────────────────────
    if (accion === 'GET_NOVEDAD') {
      const { data, error } = await supabase
        .from('novedades')
        .select(PUBLIC_NOVEDAD_FIELDS)
        .ilike('id_novedad', idNovedad)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, message: "Novedad no encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        )
      }

      console.log(`[GET_NOVEDAD] ${data.id_novedad} — estado: ${data.estado}`)
      return new Response(
        JSON.stringify({ success: true, novedad: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // ── GET_CHAT_MSGS ────────────────────────────────────────────────────────
    if (accion === 'GET_CHAT_MSGS') {
      // Primero verificar si el chat está archivado en la novedad
      const { data: nov } = await supabase
        .from('novedades')
        .select('chat')
        .ilike('id_novedad', idNovedad)
        .maybeSingle()

      // Si chat es un JSON archivado, devolverlo directamente
      if (nov?.chat && String(nov.chat).startsWith('[') || String(nov?.chat || '').startsWith('{')) {
        try {
          const parsed = JSON.parse(nov.chat)
          const msgs = parsed.msgs || parsed || []
          return new Response(
            JSON.stringify({ success: true, msgs, archived: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          )
        } catch (_) { /* no es JSON, continuar con tabla chat */ }
      }

      // Chat activo — leer de la tabla
      const { data: msgs, error } = await supabase
        .from('chat')
        .select('id_msg, autor, rol, mensaje, imagen_url, ts')
        .eq('id_novedad', idNovedad)
        .order('ts', { ascending: true })

      if (error) throw error

      console.log(`[GET_CHAT_MSGS] ${idNovedad} — ${msgs?.length ?? 0} mensajes`)
      return new Response(
        JSON.stringify({ success: true, msgs: msgs || [], archived: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // ── SEND_CHAT_MSG ────────────────────────────────────────────────────────
    if (accion === 'SEND_CHAT_MSG') {
      const texto  = String(body.mensaje || '').trim().substring(0, 2000)
      const autor  = String(body.autor  || 'GUEST').trim().substring(0, 100)
      const imgData = body.imagen || null  // { base64, mimeType, fileName }

      if (!texto && !imgData) {
        return new Response(
          JSON.stringify({ success: false, message: "El mensaje no puede estar vacío" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        )
      }

      // Verificar que la novedad existe y el chat no está archivado
      const { data: nov } = await supabase
        .from('novedades')
        .select('id, productora, chat')
        .ilike('id_novedad', idNovedad)
        .maybeSingle()

      if (!nov) {
        return new Response(
          JSON.stringify({ success: false, message: "Novedad no encontrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        )
      }

      const chatVal = String(nov.chat || '')
      const isArchived = chatVal.startsWith('[') || chatVal.startsWith('{') || chatVal.startsWith('https://')
      if (isArchived) {
        return new Response(
          JSON.stringify({ success: false, message: "El chat de esta novedad está archivado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        )
      }

      // Subir imagen si viene adjunta
      let imagenUrl: string | null = null
      if (imgData?.base64) {
        if (!ALLOWED_MIME.includes(imgData.mimeType)) {
          return new Response(
            JSON.stringify({ success: false, message: "Tipo de imagen no permitido" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          )
        }

        const bytes = decode(imgData.base64)
        if (bytes.length > MAX_SIZE) {
          return new Response(
            JSON.stringify({ success: false, message: "Imagen demasiado grande (máx 5 MB)" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          )
        }

        const now = new Date()
        const y = now.getFullYear()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const d = String(now.getDate()).padStart(2, '0')
        const prodId = nov.productora || '0'
        const safeName = (imgData.fileName || 'img.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 40)
        const filePath = `chat/${prodId}/${y}/${m}/${d}/${Date.now()}_${safeName}` 

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, bytes, { contentType: imgData.mimeType, upsert: false })

        if (upErr) throw new Error(`Error al subir imagen: ${upErr.message}`)

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
        imagenUrl = publicUrl
      }

      // Insertar mensaje
      const msgId = 'MSG-' + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0')
      const { error: insErr } = await supabase.from('chat').insert({
        id_msg:     msgId,
        id_novedad: idNovedad,
        id:         Number(nov.id) || 0,
        productora: String(nov.productora || '0'),
        autor:      autor,
        rol:        'GUEST',
        mensaje:    texto,
        imagen_url: imagenUrl,
        is_read:    false,
        ts:         new Date().toISOString(),
        timestamp:  new Date().toISOString(),
      })

      if (insErr) throw new Error(`Error al guardar mensaje: ${insErr.message}`)

      console.log(`[SEND_CHAT_MSG] ${idNovedad} — msg ${msgId} de "${autor}"`)
      return new Response(
        JSON.stringify({ success: true, id_msg: msgId, imagen_url: imagenUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // Acción desconocida
    return new Response(
      JSON.stringify({ success: false, message: `Acción desconocida: ${accion}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )

  } catch (e) {
    console.error('[novedad-seguimiento] Error:', e)
    return new Response(
      JSON.stringify({ success: false, message: e.message || "Error interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})