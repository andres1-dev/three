import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    const { accion, hoja } = payload
    let result = { success: false, message: "" }

    console.log(`[OPERATIONS] Acción recibida: ${accion || 'INSERT'}, Tabla/Hoja: ${hoja || '--'}`)

    // ── LÓGICA DE ARCHIVO (IMAGEN) ──
    let publicUrl = ""
    if (payload.imagen && payload.imagen.base64) {
      const fileName = `${Date.now()}_${payload.imagen.fileName || 'upload.jpg'}`
      const contentType = payload.imagen.mimeType || 'image/jpeg'
      const base64Data = payload.imagen.base64

      // Subir a Supabase Storage (Bucket: soportes-r2)
      // Nota: Si prefieres Google Drive, se requiere OAuth2 (no basta con API Key para subir), 
      // por lo que usamos Supabase Storage como solución nativa y segura.
      const { data: storageData, error: storageError } = await supabaseClient
        .storage
        .from('soportes-r2')
        .upload(fileName, decode(base64Data), { contentType, upsert: true })

      if (storageError) throw storageError

      const { data: { publicUrl: url } } = supabaseClient.storage.from('soportes-r2').getPublicUrl(fileName)
      publicUrl = url
      console.log(`[STORAGE] Imagen subida con éxito: ${publicUrl}`)
    }

    // ── MANEJO DE ACCIONES ESPECÍFICAS ──
    switch (accion) {
      case "UPDATE_ESTADO":
        // Actualiza el estado de una novedad
        const { error: errorUp } = await supabaseClient
          .from('NOVEDADES')
          .update({ estado: payload.nuevoEstado })
          .eq('id_novedad', payload.timestampId)
        
        if (errorUp) throw errorUp
        result = { success: true, message: "Estado de novedad actualizado" }
        break;

      case "SEND_CHAT_MSG":
        // Inserta un nuevo mensaje de chat
        const finalMsg = payload.mensaje + (publicUrl ? ` [IMAGEN:${publicUrl}]` : '')
        const { error: errorChat } = await supabaseClient
          .from('CHAT')
          .insert([{
            id_nov: payload.idNovedad,
            planta: payload.planta,
            rol: payload.rol,
            autor: payload.autor,
            mensaje: finalMsg,
            ts: new Date().toISOString()
          }])
        
        if (errorChat) throw errorChat
        result = { success: true, message: "Mensaje de chat enviado" }
        break;

      case "MARK_READ":
        // Actualiza el recibo de lectura en la tabla NOVEDADES
        // (Simplificado: asume que existe columna chat_read tipo JSONB)
        const { data: novData } = await supabaseClient.from('NOVEDADES').select('chat_read').eq('id_novedad', payload.idNovedad).single()
        let currentRead = novData?.chat_read || {}
        currentRead[payload.rol === 'GUEST' ? 'GUEST' : 'OPERATOR'] = new Date().toISOString()
        
        const { error: errorRead } = await supabaseClient
          .from('NOVEDADES')
          .update({ chat_read: currentRead })
          .eq('id_novedad', payload.idNovedad)
        
        if (errorRead) throw errorRead
        result = { success: true, message: "Recibo de lectura actualizado" }
        break;

      case "SOLICITAR_RESETEO_PASSWORD":
        // Mock de reset (Se suele usar Supabase Auth pero lo mantenemos compatible con el flujo previo)
        // Aquí podrías integrar un servicio de email (SendGrid/Resend)
        result = { success: true, message: "Token generado (Simulado)" }
        break;

      default:
        // Caso genérico: Inserción basada en la propiedad 'hoja'
        if (hoja) {
          const table = hoja.toUpperCase()
          // Limpiar el payload de campos redundantes
          const dataToInsert = { ...payload }
          delete dataToInsert.accion
          delete dataToInsert.hoja
          if (publicUrl) dataToInsert.imagen = publicUrl

          const { error: errorIns } = await supabaseClient
            .from(table)
            .insert([dataToInsert])
          
          if (errorIns) throw errorIns
          result = { success: true, message: `Registro insertado en ${table}` }
        } else {
          throw new Error("Acción o tabla no especificada")
        }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error(`[OPERATIONS ERROR]`, error.message)
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
