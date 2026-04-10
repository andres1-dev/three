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
    const { accion, hoja, url } = payload
    const id = payload.id || payload.idNovedad || payload.idReporte;
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
        const colName = tableUp === 'REPORTES' ? 'SOPORTE' : 'IMAGEN';

        const { error: errUrl } = await supabaseClient
          .from(tableUp)
          .update({ [colName]: url })
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

      case "SEND_CHAT_MSG": {
        const finalMsg = payload.mensaje + (publicUrl ? ` [IMAGEN:${publicUrl}]` : '')

        // Generar ID único similar al formato del usuario: MSG-XXXXXXXX
        const msgId = "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');

        // Mapeo EXACTO basado en el JSON proporcionado por el usuario
        const insertData = {
          ID_MSG: msgId,
          ID_NOVEDAD: String(payload.idNovedad || ''),
          PLANTA: String(payload.planta || ''),
          AUTOR: String(payload.rol || 'GUEST'), // En el JSON del usuario, AUTOR es el rol
          ROL: String(payload.autor || 'Usuario'), // En el JSON del usuario, ROL es el nombre
          MENSAJE: String(finalMsg || ''),
          TIMESTAMP: new Date().toISOString() // El usuario usa TIMESTAMP, no TS
        }

        console.log("[CHAT] Insertando con esquema exacto:", insertData)

        const { error: errChat } = await supabaseClient
          .from('CHAT')
          .insert([insertData])

        if (errChat) {
          console.error("[CHAT CRÍTICO] Error al insertar:", errChat.message)
          throw new Error(`Error de base de datos: ${errChat.message}`)
        }

        result = { success: true, message: "Mensaje guardado exitosamente" }
        break;
      }

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
        const userData: any = {};
        if (payload.usuario !== undefined) userData.USUARIO = payload.usuario;
        if (payload.correo !== undefined) userData.CORREO = payload.correo;
        if (payload.telefono !== undefined) userData.TELEFONO = payload.telefono;
        if (payload.rol !== undefined) userData.ROL = payload.rol;
        if (payload.password !== undefined) userData.CONTRASEÑA = payload.password; // Usar CONTRASEÑA

        const { error: errU } = await supabaseClient
          .from('USUARIOS')
          .update(userData)
          .eq('ID_USUARIO', payload.id)
        if (errU) throw errU
        result = { success: true, message: "Usuario actualizado" }
        break;

      case "ACTUALIZAR_PLANTA":
        const plantData: any = {};
        if (payload.nombrePlanta !== undefined) plantData.PLANTA = payload.nombrePlanta;
        if (payload.email !== undefined) plantData.EMAIL = payload.email;
        if (payload.telefono !== undefined) plantData.TELEFONO = payload.telefono;
        if (payload.direccion !== undefined) plantData.DIRECCION = payload.direccion;
        if (payload.rol !== undefined) plantData.ROL = payload.rol;
        if (payload.password !== undefined) plantData.CONTRASEÑA = payload.password; // Usar CONTRASEÑA

        const { error: errP } = await supabaseClient
          .from('PLANTAS')
          .update(plantData)
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
          if (publicUrl) {
            // Unificar nombre de columna de imagen/soporte
            if (table === 'REPORTES') dataToInsert.soporte = publicUrl
            else dataToInsert.imagen = publicUrl
          }

          const finalData: any = {}
          for (const key in dataToInsert) {
            // No procesar IDs aquí, los manejamos abajo
            if (['id', 'ID_NOVEDAD', 'ID_REPORTE', 'ID_VISITA'].includes(key.toUpperCase())) continue;

            // Convertir camelCase a SNAKE_CASE para las columnas de la DB
            const snakeKey = key
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase()
              .replace(/^_/, "");
            finalData[snakeKey] = dataToInsert[key]
          }

          // Generación de Identificadores siguiendo el patrón del usuario
          if (table === 'NOVEDADES' && !finalData.ID_NOVEDAD) {
            finalData.ID_NOVEDAD = "NOV-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }
          if (table === 'REPORTES' && !finalData.ID_REPORTE) {
            finalData.ID_REPORTE = "REP-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }
          if (table === 'RUTERO' && !finalData.ID_VISITA) {
            finalData.ID_VISITA = "VIS-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }

          if (table !== 'RUTERO' && !finalData.FECHA) finalData.FECHA = new Date().toISOString();
          if (table === 'NOVEDADES' && !finalData.ESTADO) finalData.ESTADO = 'PENDIENTE'; // Según JSON es PENDIENTE

          // Manejar AVANCE para REPORTES (no existe como columna, combinar en OBSERVACIONES)
          if (table === 'REPORTES' && finalData.AVANCE !== undefined) {
            if (finalData.AVANCE && finalData.AVANCE !== '' && finalData.AVANCE !== '0') {
              finalData.OBSERVACIONES = `[Avance: ${finalData.AVANCE}%] ` + (finalData.OBSERVACIONES || '');
            }
            delete finalData.AVANCE;
          }

          // Filtro estricto de columnas según esquema
          if (table === 'RUTERO') {
            const ruteroCols = ['ID_VISITA', 'FECHA_VISITA', 'AUDITOR', 'PLANTA', 'LOTE', 'REFERENCIA', 'PROCESO', 'TIPO_VISITA', 'DESTINO', 'CANTIDAD', 'PRIORIDAD', 'ESTADO'];
            for (const k of Object.keys(finalData)) {
              if (!ruteroCols.includes(k)) delete finalData[k];
            }
          } else if (table === 'REPORTES') {
            const reportesCols = ['ID_REPORTE', 'FECHA', 'LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'LINEA', 'PROCESO', 'PRENDA', 'GENERO', 'TEJIDO', 'EMAIL', 'LOCALIZACION', 'TIPO_VISITA', 'CONCLUSION', 'OBSERVACIONES', 'SOPORTE'];
            for (const k of Object.keys(finalData)) {
              if (!reportesCols.includes(k)) delete finalData[k];
            }
          }

          console.log(`[INSERT] Tabla: ${table}, Datos:`, finalData)

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
