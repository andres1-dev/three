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

      case "UPDATE_ESTADO": {
        const idNov = payload.timestampId || payload.id;
        const { error: errEst } = await supabaseClient
          .from('NOVEDADES')
          .update({ ESTADO: payload.nuevoEstado })
          .eq('ID_NOVEDAD', idNov)
        if (errEst) throw errEst

        result = { success: true, message: "Estado actualizado" }

        // Mantenimiento Automático: Archivar chat si se finaliza la novedad.
        if (payload.nuevoEstado === 'FINALIZADA') {
          payload.idNovedad = idNov; // Set para que ARCHIVE_CHAT lo use
          // Procedemos intencionalmente al bloque de ARCHIVE_CHAT para que haga el trabajo manual.
        } else {
          break;
        }
      }
      // NOTA FALLTHROUGH: Si UPDATE_ESTADO = FINALIZADA, caerá directo a ARCHIVE_CHAT para el mantenimiento.

      case "ARCHIVE_CHAT": {
        const idNovArc = payload.idNovedad || payload.timestampId || payload.id;
        if (!idNovArc) break;
        
        const { data: chatData, error: readErr } = await supabaseClient
          .from('CHAT')
          .select('*')
          .eq('ID_NOVEDAD', idNovArc)
          .order('TS', { ascending: true });

        if (chatData && chatData.length > 0) {
          // Comprimir a JSON liviano
          const archivedMsgs = chatData.map((msg: any) => ({
            id: msg.ID_MSG,
            autor: msg.AUTOR,
            rol: msg.ROL,
            mensaje: msg.MENSAJE,
            imagen_url: msg.IMAGEN_URL,
            ts: msg.TS
          }));

          const chatJsonStr = JSON.stringify({ msgs: archivedMsgs });
          
          await supabaseClient.from('NOVEDADES').update({ CHAT: chatJsonStr }).eq('ID_NOVEDAD', idNovArc);
          await supabaseClient.from('CHAT').delete().eq('ID_NOVEDAD', idNovArc);
          console.log(`[CHAT] Se archivaron ${chatData.length} mensajes para ${idNovArc}`);
        }
        result = { success: true, message: "Chat archivado correctamente" };
        break;
      }

      case "REOPEN_CHAT": {
        const idNovRe = payload.idNovedad;
        if (!idNovRe) break;

        const { data: novData } = await supabaseClient.from('NOVEDADES').select('CHAT').eq('ID_NOVEDAD', idNovRe).single();
        if (novData && novData.CHAT) {
          try {
            const parsed = JSON.parse(novData.CHAT);
            const msgsArgs = parsed.msgs || [];
            if (msgsArgs.length > 0) {
               const insertPayloads = msgsArgs.map((m:any) => ({
                 ID_MSG: m.id || "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase(),
                 ID_NOVEDAD: idNovRe,
                 LOTE: payload.lote || 'HISTORICO',
                 OP: payload.lote || 'HISTORICO',
                 AUTOR: m.autor || '',
                 ROL: m.rol || '',
                 MENSAJE: m.mensaje || '',
                 IMAGEN_URL: m.imagen_url || m.img || '',
                 IS_READ: true,
                 TS: m.ts || new Date().toISOString(),
                 TIMESTAMP: m.ts || new Date().toISOString()
               }));
               await supabaseClient.from('CHAT').insert(insertPayloads);
            }
            await supabaseClient.from('NOVEDADES').update({ CHAT: null }).eq('ID_NOVEDAD', idNovRe);
            console.log(`[CHAT] Se restauraron ${msgsArgs.length} mensajes a la tabla CHAT para ${idNovRe}`);
          } catch(e) { 
            console.error('[CHAT] Error re-abriendo chat:', e); 
          }
        }
        result = { success: true, message: "Chat reabierto y restaurantes en tabla" };
        break;
      }

      case "GET_CHAT_MSGS": {
        const idNovGet = payload.idNovedad;
        if (!idNovGet) break;

        const { data: novGet } = await supabaseClient.from('NOVEDADES').select('CHAT, CHAT_READ').eq('ID_NOVEDAD', idNovGet).single();
        let msgsRet = [];
        let rReceipts = {};
        
        if (novGet && novGet.CHAT) {
           try { msgsRet = (JSON.parse(novGet.CHAT).msgs || []); } catch(e) {}
        }
        if (novGet && novGet.CHAT_READ) {
           try { rReceipts = typeof novGet.CHAT_READ === 'string' ? JSON.parse(novGet.CHAT_READ) : novGet.CHAT_READ; } catch(e) {}
        }
        result = { success: true, message: "OK", msgs: msgsRet, readReceipts: rReceipts } as any;
        break;
      }

      case "SEND_CHAT_MSG": {
        // Generar ID único corto: MSG-XXXXXXXX
        const msgId = "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');

        // Mapeo profesional: Separamos texto de imagen y quitamos PLANTA
        // Nota: El frontend ya envía los campos limpios y mapeados
        const insertData = {
          ID_MSG:     msgId,
          ID_NOVEDAD: String(payload.idNovedad || payload.ID_NOVEDAD || ''),
          LOTE:       String(payload.lote || payload.LOTE || ''),
          OP:         String(payload.op || payload.OP || ''),
          AUTOR:      String(payload.autor || ''),   // Recibe el Rol (ADMIN/GUEST)
          ROL:        String(payload.rol || ''),     // Recibe el Nombre Real
          MENSAJE:    String(payload.mensaje || ''), // Texto limpio
          IMAGEN_URL: String(payload.imagen_url || payload.imagen || ''), // URL de Drive
          IS_READ:    false,
          TS:         new Date().toISOString(),
          TIMESTAMP:  new Date().toISOString()
        }

        console.log("[CHAT] Insertando en estructura limpia:", insertData)

        const { error: errChat } = await supabaseClient
          .from('CHAT')
          .insert([insertData])

        if (errChat) {
          console.error("[CHAT] Error al insertar:", errChat.message)
          throw new Error(`Error de base de datos: ${errChat.message}`)
        }

        result = { success: true, message: "Mensaje guardado" }
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
