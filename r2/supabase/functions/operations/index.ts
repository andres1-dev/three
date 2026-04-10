import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    const { accion, hoja, id, url } = payload
    let result = { success: false, message: "" }

    console.log(`[OPERATIONS] Acción: ${accion || 'INSERT'}, Hoja: ${hoja || '--'}`)

    // ── LÓGICA DE ARCHIVO (IMAGEN) ──
    let publicUrl = ""
    const imgData = payload.imagen || payload.archivo // Soporta ambos formatos de payload
    if (imgData && imgData.base64) {
      const fileName = `${Date.now()}_${imgData.fileName || 'upload.jpg'}`
      const contentType = imgData.mimeType || 'image/jpeg'
      const base64Data = imgData.base64

      const { data: storageData, error: storageError } = await supabaseClient
        .storage
        .from('soportes-r2')
        .upload(fileName, decode(base64Data), { contentType, upsert: true })

      if (storageError) throw storageError
      const { data: { publicUrl: pUrl } } = supabaseClient.storage.from('soportes-r2').getPublicUrl(fileName)
      publicUrl = pUrl
    }

    // ── MANEJO DE ACCIONES ──
    switch (accion) {
      case "SUBIR_ARCHIVO":
        if (!publicUrl) throw new Error("No se pudo procesar el archivo")
        result = { success: true, url: publicUrl }
        break;

      case "UPDATE_ARCHIVO_URL":
        if (!hoja || !id || !url) throw new Error("Faltan parámetros para actualizar URL")
        const tableUp = hoja.toUpperCase()
        const pkName = tableUp === 'NOVEDADES' ? 'ID_NOVEDAD' : (tableUp === 'REPORTES' ? 'ID_REPORTE' : 'ID');
        const { error: errUrl } = await supabaseClient
          .from(tableUp)
          .update({ IMAGEN: url })
          .eq(pkName, id)
        if (errUrl) throw errUrl
        result = { success: true, message: "URL de imagen actualizada" }
        break;

      case "UPDATE_ESTADO":
        const { error: errEst } = await supabaseClient
          .from('NOVEDADES')
          .update({ ESTADO: payload.nuevoEstado })
          .eq('ID_NOVEDAD', payload.timestampId || payload.id)
        if (errEst) throw errEst
        result = { success: true, message: "Estado actualizado" }
        break;

      case "SEND_CHAT_MSG":
        const finalMsg = payload.mensaje + (publicUrl ? ` [IMAGEN:${publicUrl}]` : '')
        const { error: errChat } = await supabaseClient
          .from('CHAT')
          .insert([{
            ID_NOV: payload.idNovedad,
            PLANTA: payload.planta,
            ROL: payload.rol,
            AUTOR: payload.autor,
            MENSAJE: finalMsg,
            TS: new Date().toISOString()
          }])
        if (errChat) throw errChat
        result = { success: true, message: "Mensaje enviado" }
        break;

      case "MARK_READ":
        const { data: nD } = await supabaseClient.from('NOVEDADES').select('CHAT_READ').eq('ID_NOVEDAD', payload.idNovedad).single()
        let cR = nD?.CHAT_READ || {}
        if (typeof cR === 'string') cR = JSON.parse(cR);
        cR[payload.rol === 'GUEST' ? 'GUEST' : 'OPERATOR'] = new Date().toISOString()
        const { error: errR } = await supabaseClient.from('NOVEDADES').update({ CHAT_READ: cR }).eq('ID_NOVEDAD', payload.idNovedad)
        if (errR) throw errR
        result = { success: true, message: "Leído" }
        break;

      case "UPDATE_USER":
        const { error: errU } = await supabaseClient
          .from('USUARIOS')
          .update({
            USUARIO: payload.usuario,
            CORREO: payload.correo,
            TELEFONO: payload.telefono,
            ROL: payload.rol,
            CONTRASEÑA: payload.password
          })
          .eq('ID_USUARIO', payload.id)
        if (errU) throw errU
        result = { success: true, message: "Usuario actualizado" }
        break;

      case "UPDATE_USER_ROLE":
        const { error: errUR } = await supabaseClient
          .from('USUARIOS')
          .update({ ROL: payload.nuevoRol })
          .eq('ID_USUARIO', payload.id)
        if (errUR) throw errUR
        result = { success: true, message: "Rol actualizado" }
        break;

      case "ACTUALIZAR_PLANTA":
        const { error: errP } = await supabaseClient
          .from('PLANTAS')
          .update({
            PLANTA: payload.nombrePlanta,
            EMAIL: payload.email,
            TELEFONO: payload.telefono,
            DIRECCION: payload.direccion,
            ROL: payload.rol,
            CONTRASEÑA: payload.password
          })
          .eq('ID_PLANTA', payload.id)
        if (errP) throw errP
        result = { success: true, message: "Planta actualizada" }
        break;

      default:
        // Caso genérico: Inserción (Novedades, Calidad, etc.)
        if (hoja) {
          const table = hoja.toUpperCase()
          const dataToInsert = { ...payload }
          delete dataToInsert.accion
          delete dataToInsert.hoja
          if (publicUrl) dataToInsert.imagen = publicUrl

          const finalData: any = {}
          for (const key in dataToInsert) {
            if (key === 'id' || key === 'ID_NOVEDAD' || key === 'ID_REPORTE') continue;
            const snakeKey = key
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase()
              .replace(/^_/, "");
            finalData[snakeKey] = dataToInsert[key]
          }

          // Réplica exacta de la generación de ID del sistema original
          if (table === 'NOVEDADES' && !finalData.ID_NOVEDAD) {
            finalData.ID_NOVEDAD = "NOV-" + Math.floor(Math.random() * 1000000000).toString(16).toUpperCase();
          }
          if (table === 'REPORTES' && !finalData.ID_REPORTE) {
            finalData.ID_REPORTE = "CAL-" + Math.floor(Math.random() * 1000000000).toString(16).toUpperCase();
          }

          if (!finalData.FECHA) finalData.FECHA = new Date().toISOString();
          if (table === 'NOVEDADES' && !finalData.ESTADO) finalData.ESTADO = 'ABIERTO';

          const { data: insData, error: errIns } = await supabaseClient
            .from(table)
            .insert([finalData])
            .select()
            .single()
          
          if (errIns) {
            console.error(`[INSERT ERROR] Table: ${table}`, errIns)
            throw new Error(`Error insertando en ${table}: ${errIns.message}`)
          }
          
          result = { 
            success: true, 
            message: `Insertado en ${table}`, 
            id: insData.ID_NOVEDAD || insData.ID_REPORTE || insData.ID_VISITA || insData.ID,
            ID_NOVEDAD: insData.ID_NOVEDAD
          }
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
