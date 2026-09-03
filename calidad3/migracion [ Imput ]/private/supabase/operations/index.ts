import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, X-JSON",
  "Access-Control-Max-Age": "86400",
}

// Configuración de Notificaciones (GAS)
const GAS_NOTIF_URL = 'https://script.google.com/macros/s/AKfycbw7PEB7D9TP_wDlzJtwKCJmxwUYguXyniYPb_vRAadPHpy7gDWG26fn0wRowI_mre9V/exec';

async function notificarGuest(supabase: any, idNovedad: string, dataNotif: any, novedadData?: any) {
  try {
    console.log(`[NOTIF] Intentando notificar a Guest para ${idNovedad}...`);
    console.log(`[NOTIF] Datos de notificación:`, dataNotif);

    let nov = novedadData;

    // Si no se proporcionan datos, buscar en la base de datos
    if (!nov) {
      const { data: novData, error: errN } = await supabase
        .from('novedades')
        .select('planta, lote, referencia, productora')
        .eq('id_novedad', idNovedad)
        .single();

      if (errN || !novData) {
        console.warn(`[NOTIF] No se pudo encontrar reporte ${idNovedad}`);
        return;
      }
      nov = novData;
    }

    // Buscar el email de la planta
    const { data: plant, error: errP } = await supabase
      .from('plantas')
      .select('correo, planta')
      .eq('planta', nov.planta)
      .single();

    if (errP || !plant || !plant.correo) {
      console.warn(`[NOTIF] No se encontró email para planta ${nov.planta}`);
      return;
    }

    // Determinar correos CC según la productora leyendo de usuarios
    let ccEmails: string[] = [];
    const productora = nov.productora;

    if (productora) {
      try {
        // Obtener usuarios con email_copia activado según productora y rol
        const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
        if (!authErr && authData?.users) {
          ccEmails = authData.users
            .filter((u: any) => {
              const meta = u.user_metadata || u.raw_user_meta_data || {};
              const userRole = (meta.role || '').toUpperCase();
              const userIdProductora = meta.id_productora; // ID numérico de productora
              const userEmailCopia = meta.email_copia; // Ahora es booleano
              const userCorreo = u.email;
              // Incluir usuarios USER-P de la misma productora con email_copia activado
              // Y usuarios ADMIN/MODERATOR con email_copia activado
              return userEmailCopia === true && userCorreo &&
                     ((userRole === 'USER-P' && userIdProductora === productora) ||
                      (userRole === 'ADMIN' || userRole === 'MODERATOR'));
            })
            .map((u: any) => u.email) // Usar el correo del usuario
            .filter((email: string) => email); // Filtrar emails vacíos
        }
      } catch (e) {
        console.warn('[NOTIF] Error al obtener usuarios para CC:', e);
      }
    }

    // No incluir CC para notificaciones de solución
    const incluirCC = dataNotif.accion !== 'NOVEDAD_FINALIZADA_CON_SOLUCION';

    const payload = {
      ...dataNotif,
      email: plant.correo,
      nombre: plant.planta,
      idNovedad: idNovedad,
      lote: nov.lote || nov.id,
      referencia: nov.referencia,
      cc: incluirCC ? ccEmails : []
    };

    console.log(`[NOTIF] Payload completo a enviar:`, payload);

    const res = await fetch(GAS_NOTIF_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const resJson = await res.json();
    console.log(`[NOTIF] Respuesta GAS:`, resJson);
  } catch (e) {
    console.error("[NOTIF] Error en flujo de notificación:", e);
  }
}

/**
 * Normaliza fechas de DD/MM/YYYY a YYYY-MM-DD para PostgreSQL
 */
function normalizeDate(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;

  // Si ya tiene formato YYYY-MM-DD, dejarlo así
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];

  // Si tiene formato DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

serve(async (req) => {
  // 1. Manejo de CORS Preflight (Inmediato y sin dependencias)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }

  console.log(`[REQUEST] ${req.method} ${req.url}`);

  try {
    // 2. Extraer payload
    const payload = await req.json();
    const { accion, hoja, url } = payload;

    // 3. Inicializar Supabase Client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── ACCIONES PÚBLICAS (no requieren sesión — usadas en login) ──
    if (accion === 'LISTAR_PLANTAS') {
      let allPlantas: any[] = [];
      let from = 0;
      const limit = 1000;
      let keepFetching = true;

      while (keepFetching) {
        const { data: plantasData, error: plantasErr } = await supabaseClient
          .from('plantas')
          .select('*')
          .range(from, from + limit - 1);

        if (plantasErr) {
          console.error('[LISTAR_PLANTAS ERROR]', plantasErr);
          throw plantasErr;
        }

        if (plantasData && plantasData.length > 0) {
          allPlantas = allPlantas.concat(plantasData);
        }

        if (plantasData && plantasData.length === limit) {
          from += limit;
        } else {
          keepFetching = false;
        }
      }

      return new Response(JSON.stringify({ success: true, plantas: allPlantas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      });
    }

    if (accion === 'LISTAR_PRODUCTORAS') {
      const { data: prodsData, error: prodsErr } = await supabaseClient
        .from('productoras')
        .select('id_productora, nit, productora');
      if (prodsErr) throw prodsErr;
      return new Response(JSON.stringify({ success: true, productoras: prodsData || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      });
    }

    if (accion === 'LISTAR_NOVEDADES') {
      // Usado por el GUEST para leer novedades sin restricciones de RLS
      let allNovedades: any[] = [];
      let from = 0;
      const limit = 1000;
      let keepFetching = true;

      while (keepFetching) {
        let novQuery = supabaseClient
          .from('novedades')
          .select('*')
          .range(from, from + limit - 1);

        // Filtrar por nombre de planta (más específico) o por productora
        const filtroPlanta    = payload.planta    || payload.PLANTA;
        const filtroProductora = payload.productora || payload.PRODUCTORA;

        if (filtroPlanta) {
          novQuery = novQuery.ilike('planta', String(filtroPlanta).trim());
        } else if (filtroProductora) {
          novQuery = novQuery.eq('productora', parseInt(filtroProductora));
        }

        const { data: novsData, error: novsErr } = await novQuery;
        if (novsErr) throw novsErr;

        if (novsData && novsData.length > 0) {
          allNovedades = allNovedades.concat(novsData);
        }

        if (novsData && novsData.length === limit) {
          from += limit;
        } else {
          keepFetching = false;
        }
      }

      return new Response(JSON.stringify({ success: true, novedades: allNovedades }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      });
    }

    // Resolución de email para login: devuelve solo id + email, sin datos sensibles
    if (accion === 'RESOLVER_USUARIOS_LOGIN') {
      const { data: authData, error: authErr } = await supabaseClient.auth.admin.listUsers();
      if (authErr) throw authErr;
      const minimal = (authData?.users || []).map((u: any) => {
        const meta = u.user_metadata || u.raw_user_meta_data || {};
        return {
          ID_USUARIO: meta.id_usuario || meta.cedula || '',
          CORREO: u.email,
          ROL: meta.role || 'PENDIENTE',
          NOMBRE: meta.full_name || u.email.split('@')[0],
          FIRMA_SVG: meta.firma_svg || null,
          EMAIL_COPIA: meta.email_copia || false
        };
      }).filter((u: any) => u.ID_USUARIO);
      return new Response(JSON.stringify({ success: true, users: minimal }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
      });
    }

    // ── VALIDACIÓN DE SEGURIDAD (RLS para Edge Functions) ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("No autorizado: Falta token de sesión")

    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) throw new Error("No autorizado: Sesión inválida o expirada")

    const userRole = (user.app_metadata?.role || user.user_metadata?.role || 'GUEST').toUpperCase()

    // Restricciones de acciones administrativas
    const adminActions = ['LISTAR_USUARIOS', 'CREAR_USUARIO', 'UPDATE_USER', 'ELIMINAR_USUARIO', 'LOGOUT_ALL_USERS'];
    if (adminActions.includes(accion) && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new Error("Acceso denegado: Se requieren permisos de administrador")
    }

    if (accion === 'CREAR_PLANTA' && !['ADMIN', 'MODERATOR', 'USER-C'].includes(userRole)) {
      throw new Error("Acceso denegado: Se requieren permisos de administrador o auditor")
    }

    if (accion === 'ACTUALIZAR_PLANTA' && !['ADMIN', 'MODERATOR', 'USER-P', 'USER-C'].includes(userRole)) {
      // Un GUEST solo puede actualizar su propia planta
      const guestId = String(user.user_metadata?.id_planta || user.user_metadata?.cedula || user.user_metadata?.id_usuario);
      const targetId = String(payload.id || payload.ID_PLANTA);

      // Permitir acceso universal
      if (user.email !== 'plantas@grupotdm.com.co' && guestId !== targetId) {
        throw new Error("Acceso denegado: Solo puedes actualizar tu propia información");
      }
    }

    const id = payload.id || payload.idNovedad || payload.idReporte;
    let result = { success: false, message: "" }

    console.log(`[OPERATIONS] Acción: ${accion || 'INSERT'}, Usuario: ${user.email}, Rol: ${userRole}`)

    // ── LÓGICA DE ARCHIVO (IMAGEN) ──
    let publicUrl = ""
    const imgData = payload.imagen || payload.archivo
    if (imgData && imgData.base64) {
      // Obtener fecha en la zona horaria de Colombia (America/Bogota) para evitar desfases UTC
      const options = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
      const formatter = new Intl.DateTimeFormat('es-CO', options);
      const parts = formatter.formatToParts(new Date());
      const year = parts.find(p => p.type === 'year')?.value || String(new Date().getFullYear());
      const month = parts.find(p => p.type === 'month')?.value || String(new Date().getMonth() + 1).padStart(2, '0');
      const day = parts.find(p => p.type === 'day')?.value || String(new Date().getDate()).padStart(2, '0');
      const timestamp = Date.now()

      // Decidir carpeta raíz según la hoja (novedades, reportes o chat)
      const hojaUpper = (payload.hoja || '').toUpperCase();
      let folderRoot = 'novedades';
      if (hojaUpper === 'REPORTES' || payload.idReporte) {
        folderRoot = 'reportes';
      } else if (hojaUpper === 'CHATS' || hojaUpper === 'CHAT') {
        folderRoot = 'chat';
      }

      // Estructura: [folderRoot]/ID_PRODUCTORA/YYYY/MM/DD/archivo.jpg
      const prodId = payload.productora || payload.PRODUCTORA || user.user_metadata?.id_productora || '0';
      console.log(`[STORAGE DEBUG] Guardando en ${folderRoot}. Productora: "${prodId}"`);

      const fileName = (imgData.fileName || 'upload.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folderRoot}/${prodId}/${year}/${month}/${day}/${timestamp}_${fileName}`;

      const contentType = imgData.mimeType || 'image/jpeg'
      const base64Data = imgData.base64

      const { data: storageData, error: storageError } = await supabaseClient
        .storage
        .from('novedades-imagenes')
        .upload(filePath, decode(base64Data), { contentType, upsert: true })

      if (storageError) throw storageError
      const { data: { publicUrl: pUrl } } = supabaseClient.storage.from('novedades-imagenes').getPublicUrl(filePath)
      publicUrl = pUrl
    }

    // ── MANEJO DE ACCIONES ──
    switch (accion) {
      case "SUBIR_ARCHIVO":
        if (!publicUrl) throw new Error("No se pudo procesar el archivo")
        result = { success: true, url: publicUrl }
        break;

      case "REPORTE_CALIDAD": {
        try {
          // Intentar resolver el nombre del auditor y su enlace de WhatsApp
          let auditorName = "Calidad TDM";
          let chatUrl = "https://andres1-dev.github.io/three/public/novedades/";
          
          const repEmail = payload.reporte?.email || payload.reporte?.EMAIL;
          if (repEmail) {
            const { data: listData } = await supabaseClient.auth.admin.listUsers();
            const foundUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === repEmail.toLowerCase());
            if (foundUser) {
              auditorName = foundUser.user_metadata?.full_name || foundUser.user_metadata?.nombre || foundUser.email.split('@')[0];
              const rawPhone = foundUser.phone || foundUser.user_metadata?.phone || "";
              const cleanedPhone = rawPhone.replace(/\D/g, "");
              if (cleanedPhone) {
                const repIdReporte = payload.reporte?.id_reporte || payload.reporte?.ID_REPORTE || "N/A";
                const repPlanta = payload.reporte?.planta || payload.reporte?.PLANTA || "N/A";
                const repId = payload.reporte?.id || payload.reporte?.ID || "N/A";
                const repRef = payload.reporte?.referencia || payload.reporte?.REFERENCIA || "N/A";
                
                const baseText = `Hola! soy ${repPlanta}, Tengo algunas dudas sobre el reporte ${repIdReporte} de la Orden de Produccion ${repId} y Referencia ${repRef}`;
                const encodedText = encodeURIComponent(baseText);
                chatUrl = `https://wa.me/${cleanedPhone}?text=${encodedText}`;
              }
            }
          }

          const payloadGAS = {
            accion: 'REPORTE_CALIDAD',
            email: payload.email,
            cc: payload.cc,
            reporte: {
              ...payload.reporte,
              fecha_entrega: payload.reporte?.fecha_entrega || payload.reporte?.FECHA_ENTREGA || payload.reporte?.entrada || payload.reporte?.ENTRADA || "",
              fecha_salida: payload.reporte?.fecha_salida || payload.reporte?.FECHA_SALIDA || payload.reporte?.salida || payload.reporte?.SALIDA || "",
              auditor_nombre: auditorName,
              chat_url: chatUrl
            }
          };
          
          console.log(`[OPERATIONS] Enviando REPORTE_CALIDAD a GAS con auditor:`, auditorName, chatUrl);
          
          const res = await fetch(GAS_NOTIF_URL, {
            method: "POST",
            body: JSON.stringify(payloadGAS),
          });
          
          if (!res.ok) {
            throw new Error(`Google Apps Script devolvió status ${res.status}`);
          }
          
          const resJson = await res.json();
          console.log(`[OPERATIONS] Respuesta GAS para REPORTE_CALIDAD:`, resJson);
          
          result = resJson;
        } catch (e: any) {
          console.error(`[OPERATIONS ERROR] REPORTE_CALIDAD:`, e.message);
          throw new Error(`Error en el servicio de correo de Google: ${e.message}`);
        }
        break;
      }

      case "APROBACION_PLANTA": {
        try {
          // Intentar resolver el nombre del auditor y su enlace de WhatsApp
          let auditorName = "Calidad TDM";
          let chatUrl = "https://andres1-dev.github.io/three/public/novedades/";
          
          const aprEmail = payload.aprobacion?.email_usuario || payload.aprobacion?.EMAIL_USUARIO;
          if (aprEmail) {
            const { data: listData } = await supabaseClient.auth.admin.listUsers();
            const foundUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === aprEmail.toLowerCase());
            if (foundUser) {
              auditorName = foundUser.user_metadata?.full_name || foundUser.user_metadata?.nombre || foundUser.email.split('@')[0];
              const rawPhone = foundUser.phone || foundUser.user_metadata?.phone || "";
              const cleanedPhone = rawPhone.replace(/\D/g, "");
              if (cleanedPhone) {
                const aprId = payload.aprobacion?.id_planta_anexo || payload.aprobacion?.ID_PLANTA_ANEXO || "N/A";
                const aprPlanta = payload.aprobacion?.planta_anexo || payload.aprobacion?.PLANTA_ANEXO || "N/A";
                
                const baseText = `Hola! soy ${aprPlanta}, Tengo algunas dudas sobre la aprobación ${aprId}`;
                const encodedText = encodeURIComponent(baseText);
                chatUrl = `https://wa.me/${cleanedPhone}?text=${encodedText}`;
              }
            }
          }

          const payloadGAS = {
            accion: 'APROBACION_PLANTA',
            email: payload.email,
            cc: payload.cc,
            aprobacion: {
              ...payload.aprobacion,
              auditor_nombre: auditorName,
              chat_url: chatUrl
            }
          };
          
          console.log(`[OPERATIONS] Enviando APROBACION_PLANTA a GAS con auditor:`, auditorName, chatUrl);
          
          const res = await fetch(GAS_NOTIF_URL, {
            method: "POST",
            body: JSON.stringify(payloadGAS),
          });
          
          if (!res.ok) {
            throw new Error(`Google Apps Script devolvió status ${res.status}`);
          }
          
          const resJson = await res.json();
          console.log(`[OPERATIONS] Respuesta GAS para APROBACION_PLANTA:`, resJson);
          
          result = resJson;
        } catch (e: any) {
          console.error(`[OPERATIONS ERROR] APROBACION_PLANTA:`, e.message);
          throw new Error(`Error en el servicio de correo de Google: ${e.message}`);
        }
        break;
      }

      case "UPDATE_ARCHIVO_URL": {
        if (!hoja || !id || !url) throw new Error("Faltan parámetros para actualizar URL (hoja, id, url)")

        const hojaUpper = hoja.toUpperCase();
        const isNov = hojaUpper === 'NOVEDADES' || hojaUpper === 'NOVEDAD';
        const isReportes = hojaUpper === 'REPORTES';
        const table = isNov ? 'novedades' : (isReportes ? 'reportes' : hojaUpper);

        // Identificar columnas
        const pkName = isNov ? 'id_novedad' : (isReportes ? 'id_reporte' : 'ID');
        const colName = isNov ? 'imagen' : (isReportes ? 'soporte' : 'IMAGEN');

        console.log(`[UPDATE_URL] Intentando actualizar. Tabla: ${table}, PK: ${pkName}, ID: ${id}`)

        // Intentar actualización por la clave primaria principal
        const { data: updData, error: errUrl } = await supabaseClient
          .from(table)
          .update({ [colName]: url })
          .eq(pkName, id)
          .select();

        // Si es novedad y no se actualizó nada, intentar por el ID numérico como respaldo
        if (isNov && (!updData || updData.length === 0)) {
          console.log(`[UPDATE_URL] No se encontró por id_novedad, reintentando por id numérico: ${id}`)
          const numericId = parseInt(id);
          if (!isNaN(numericId)) {
            await supabaseClient
              .from(table)
              .update({ [colName]: url })
              .eq('id', numericId);
          }
        }

        if (errUrl) {
          console.error(`[UPDATE_URL ERROR]`, errUrl)
          throw errUrl;
        }

        result = { success: true, message: "URL de archivo actualizada" }
        break;
      }

      case "UPDATE_REPORTE": {
        const idRep = payload.idReporte || payload.id;
        if (!idRep) {
          throw new Error('Se requiere idReporte para actualizar el reporte');
        }

        const updateData: any = {};
        if (payload.tipoVisita !== undefined) updateData.tipo_visita = payload.tipoVisita;
        if (payload.conclusion !== undefined) updateData.conclusion = payload.conclusion;
        if (payload.observaciones !== undefined) updateData.observaciones = payload.observaciones;
        if (payload.avance !== undefined) updateData.avance = payload.avance;
        if (payload.destinoProceso !== undefined) updateData.destino_proceso = payload.destinoProceso;
        if (payload.destinoPlanta !== undefined) updateData.destino_planta = payload.destinoPlanta;
        if (payload.novedadesAuditoria !== undefined) updateData.novedades_auditoria = payload.novedadesAuditoria;
        if (payload.soporte !== undefined) updateData.soporte = payload.soporte;

        let errorRep = null;
        try {
          const { error: err1 } = await supabaseClient
            .from('reportes')
            .update(updateData)
            .eq('id_reporte', idRep);
          if (err1) throw err1;
        } catch (dbErr) {
          console.warn("Error actualizando en 'reportes', intentando 'reportes_calidad'...", dbErr);
          const { error: err2 } = await supabaseClient
            .from('reportes_calidad')
            .update(updateData)
            .eq('id_reporte', idRep);
          if (err2) errorRep = err2;
        }

        if (errorRep) throw errorRep;
        result = { success: true, message: "Reporte de calidad actualizado correctamente" }
        break;
      }

      case "UPDATE_NOVEDAD": {
        const idNov = payload.timestampId || payload.id;

        if (!idNov) {
          throw new Error('Se requiere timestampId para actualizar la novedad');
        }

        // Construir objeto de actualización
        const updateData: any = {};

        if (payload.area !== undefined) updateData.area = payload.area;
        if (payload.tipoNovedad !== undefined) updateData.tipo_novedad = payload.tipoNovedad;
        if (payload.cantidadSolicitada !== undefined) updateData.cantidad_solicitada = payload.cantidadSolicitada;
        if (payload.descripcion !== undefined) updateData.descripcion = payload.descripcion;
        if (payload.comentarios !== undefined) updateData.comentarios = payload.comentarios;
        if (payload.cobro !== undefined) updateData.cobro = payload.cobro;

        // Nuevos campos técnicos para sincronización desde Master
        if (payload.referencia !== undefined) updateData.referencia = payload.referencia;
        if (payload.prenda !== undefined) updateData.prenda = payload.prenda;
        if (payload.genero !== undefined) updateData.genero = payload.genero;
        if (payload.tejido !== undefined) updateData.tejido = payload.tejido;
        if (payload.cuento !== undefined) updateData.cuento = payload.cuento;
        if (payload.cantidad !== undefined) updateData.cantidad = payload.cantidad;
        if (payload.proceso !== undefined) updateData.proceso = payload.proceso;
        if (payload.fecha !== undefined) updateData.fecha = normalizeDate(payload.fecha);
        if (payload.salida !== undefined) updateData.salida = normalizeDate(payload.salida);
        if (payload.productora !== undefined) updateData.productora = payload.productora;
        if (payload.planta !== undefined) updateData.planta = payload.planta;

        // TIPO_DETALLE debe ser JSONB, convertir a JSON si es necesario
        if (payload.tipoDetalle !== undefined) {
          updateData.tipo_detalle = payload.tipoDetalle;
        }

        const { error: errUpd } = await supabaseClient
          .from('novedades')
          .update(updateData)
          .eq('id_novedad', idNov);

        if (errUpd) throw errUpd;
        result = { success: true, message: "Novedad actualizada correctamente" }
        break;
      }

      case "UPDATE_ESTADO": {
        const idNov = payload.timestampId || payload.id;

        // Obtener el estado actual para construir el historial
        const { data: novData } = await supabaseClient
          .from('novedades')
          .select('estado, historial_estados, planta, cobro')
          .eq('id_novedad', idNov)
          .single();

        const estadoAnterior = novData?.estado || 'PENDIENTE';
        const historialActual = novData?.historial_estados || '';
        const planta = novData?.planta || '';
        const cobro = novData?.cobro || '';

        // Construir nueva entrada de historial: "ANTERIOR->NUEVO@timestamp"
        const timestamp = new Date().toISOString();
        const nuevaEntrada = `${estadoAnterior}->${payload.nuevoEstado}@${timestamp}`;
        const nuevoHistorial = historialActual
          ? `${historialActual}|${nuevaEntrada}`
          : nuevaEntrada;

        // Actualizar estado e historial
        const { error: errEst } = await supabaseClient
          .from('novedades')
          .update({
            estado: payload.nuevoEstado,
            historial_estados: nuevoHistorial
          })
          .eq('id_novedad', idNov)
        if (errEst) throw errEst

        // Enviar broadcast manual para notificar al GUEST (bypasea RLS)
        const channel = supabaseClient.channel('novedades-broadcast');
        await channel.send({
          type: 'broadcast',
          event: 'estado_changed',
          payload: {
            id_novedad: idNov,
            estado: payload.nuevoEstado,
            estado_anterior: estadoAnterior,
            planta: planta,
            timestamp: timestamp
          }
        });

        result = { success: true, message: "Estado actualizado" }

        // Mantenimiento Automático: Archivar chat si se finaliza la novedad.
        if (payload.nuevoEstado === 'FINALIZADO' || payload.nuevoEstado === 'FINALIZADA' || payload.nuevoEstado === 'RESUELTA') {
          // Obtener datos de la novedad para notificación
          const { data: novData } = await supabaseClient
            .from('novedades')
            .select('planta, id, referencia, productora, comentarios')
            .eq('id_novedad', idNov)
            .single();

          // Usar comentarios del payload o de la base de datos
          const solucion = payload.comentarios || novData?.comentarios || '';

          // Notificar resolución con solución y tipo de cobro
          notificarGuest(supabaseClient, idNov, {
            accion: 'NOVEDAD_FINALIZADA_CON_SOLUCION',
            solucion: solucion,
            tipoCobro: cobro
          }, novData || undefined);

          payload.idNovedad = idNov; // Set para que ARCHIVE_CHAT lo use
          // Procedemos intencionalmente al bloque de ARCHIVE_CHAT para que haga el trabajo manual.
        } else {
          // Notificar cambio de estado genérico
          notificarGuest(supabaseClient, idNov, {
            accion: 'CAMBIO_ESTADO',
            nuevoEstado: payload.nuevoEstado
          });
          break;
        }
      }
      // NOTA FALLTHROUGH: Si UPDATE_ESTADO = FINALIZADA, caerá directo a ARCHIVE_CHAT para el mantenimiento.

      case "ARCHIVE_CHAT": {
        const idNovArc = payload.idNovedad || payload.timestampId || payload.id;
        if (!idNovArc) break;

        const filtroProductora = String(
          payload.productora ||
          payload.PRODUCTORA ||
          user.user_metadata?.id_productora ||
          user.user_metadata?.productora ||
          ''
        ).trim();

        const { data: chatData, error: readErr } = await supabaseClient
          .from('chat')
          .select('*')
          .eq('id_novedad', idNovArc)
          .eq('productora', filtroProductora)
          .order('ts', { ascending: true });

        if (chatData && chatData.length > 0) {
          // Comprimir a JSON liviano
          const archivedMsgs = chatData.map((msg: any) => ({
            id: msg.id_msg,
            autor: msg.autor,
            rol: msg.rol,
            mensaje: msg.mensaje,
            imagen_url: msg.imagen_url,
            ts: msg.ts
          }));

          const chatJsonStr = JSON.stringify({ msgs: archivedMsgs });

          await supabaseClient.from('novedades').update({ chat: chatJsonStr }).eq('id_novedad', idNovArc);
          await supabaseClient.from('chat').delete().eq('id_novedad', idNovArc).eq('productora', filtroProductora);
          console.log(`[CHAT] Se archivaron ${chatData.length} mensajes para ${idNovArc}`);

          // Solo notificar finalización si realmente hubo un chat activo
          notificarGuest(supabaseClient, idNovArc, { accion: 'CHAT_FINALIZADO' });
        } else {
          console.log(`[CHAT] No había mensajes activos para ${idNovArc}, no se notifica finalización.`);
        }

        result = { success: true, message: "Chat archivado correctamente" };
        break;
      }

      case "REOPEN_CHAT": {
        const idNovRe = payload.idNovedad;
        if (!idNovRe) break;

        const { data: novData } = await supabaseClient.from('novedades').select('chat').eq('id_novedad', idNovRe).single();
        if (novData && novData.chat) {
          try {
            const parsed = JSON.parse(novData.chat);
            const msgsArgs = parsed.msgs || [];
            if (msgsArgs.length > 0) {
              const productoraReopen = String(
                payload.productora ||
                payload.PRODUCTORA ||
                user.user_metadata?.id_productora ||
                user.user_metadata?.productora ||
                ''
              ).trim();
              const insertPayloads = msgsArgs.map((m: any) => ({
                id_msg: m.id || "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase(),
                id_novedad: idNovRe,
                id: payload.lote || 'HISTORICO',
                op: payload.lote || 'HISTORICO',
                productora: productoraReopen,
                autor: m.autor || '',
                rol: m.rol || '',
                mensaje: m.mensaje || '',
                imagen_url: m.imagen_url || m.img || '',
                is_read: true,
                ts: m.ts || new Date().toISOString(),
                timestamp: m.ts || new Date().toISOString()
              }));
              await supabaseClient.from('chat').insert(insertPayloads);
            }
            await supabaseClient.from('novedades').update({ chat: null }).eq('id_novedad', idNovRe);
            console.log(`[CHAT] Se restauraron ${msgsArgs.length} mensajes a la tabla CHAT para ${idNovRe}`);
          } catch (e) {
            console.error('[CHAT] Error re-abriendo chat:', e);
          }
        }
        result = { success: true, message: "Chat reabierto y restaurado en tabla" };
        break;
      }

      case "GET_CHAT": {
        const idNovGet = payload.idNovedad || payload.id;
        const { data: novGet } = await supabaseClient.from('novedades').select('chat, chat_read').eq('id_novedad', idNovGet).single();
        let msgsRet = [];
        let rReceipts = {};

        if (novGet && novGet.chat) {
          try { msgsRet = (JSON.parse(novGet.chat).msgs || []); } catch (e) { }
        }
        if (novGet && novGet.chat_read) {
          try { rReceipts = typeof novGet.chat_read === 'string' ? JSON.parse(novGet.chat_read) : novGet.chat_read; } catch (e) { }
        }
        result = { success: true, message: "OK", msgs: msgsRet, readReceipts: rReceipts } as any;
        break;
      }

      case "GET_CHAT_MSGS": {
        const idNov = payload.idNovedad || payload.id;
        const filtroProductora = String(
          payload.productora ||
          payload.PRODUCTORA ||
          user.user_metadata?.id_productora ||
          user.user_metadata?.productora ||
          ''
        ).trim();
        const { data: chatData, error: errChat } = await supabaseClient
          .from('chat')
          .select('*')
          .eq('id_novedad', idNov)
          .eq('productora', filtroProductora)
          .order('ts', { ascending: true });

        if (errChat) throw errChat;
        result = { success: true, msgs: chatData || [] };
        break;
      }

      case "SEND_CHAT_MSG": {
        // Generar ID único corto: MSG-XXXXXXXX
        const msgId = "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');

        const idNovedad = String(payload.idNovedad || payload.ID_NOVEDAD || '');
        let loteReal: any = payload.lote || payload.id;
        let opReal: any = payload.op || payload.OP;

        // GARANTIZAR EL DATO: Siempre consultamos la novedad para tener el ID y OP reales del registro maestro
        const { data: novData } = await supabaseClient
          .from('novedades')
          .select('id, op, productora')
          .eq('id_novedad', idNovedad)
          .single();

        if (novData) {
          loteReal = novData.id || loteReal;
          opReal = novData.op || opReal;
        }

        const prodId = String(payload.productora || novData?.productora || user.user_metadata?.id_productora || '0');

        const insertData = {
          id_msg: msgId,
          id_novedad: idNovedad,
          id: Number(loteReal) || 0, // Forzamos numérico
          op: Number(opReal) || 0,   // Forzamos numérico
          productora: prodId,
          autor: String(payload.autor || ''),
          rol: String(payload.rol || ''),
          mensaje: String(payload.mensaje || ''),
          imagen_url: String(payload.imagen_url || payload.imagen || ''),
          is_read: false,
          ts: new Date().toISOString(),
          timestamp: new Date().toISOString()
        }

        console.log("[CHAT] Insertando datos garantizados (Numéricos):", insertData)

        const { error: errChat } = await supabaseClient
          .from('chat')
          .insert([insertData])

        if (errChat) {
          console.error("[CHAT] Error al insertar:", errChat.message)
          throw new Error(`Error de base de datos: ${errChat.message}`)
        }

        result = { success: true, message: "Mensaje guardado" }

        // NOTIFICACIÓN: Inicio de Chat
        // Si el autor NO es GUEST, verificar si es el primer mensaje del chat activo
        if (insertData.rol !== 'Taller' && insertData.autor !== 'GUEST') {
          const { count } = await supabaseClient
            .from('chat')
            .select('*', { count: 'exact', head: true })
            .eq('id_novedad', insertData.id_novedad);

          if (count === 1) { // Es el primer mensaje que se acaba de insertar
            notificarGuest(supabaseClient, insertData.ID_NOVEDAD, {
              accion: 'CHAT_INICIADO'
            });
          }
        }
        break;
      }

      case "MARK_AS_READ": {
        const filtroProductora = String(
          payload.productora ||
          payload.PRODUCTORA ||
          user.user_metadata?.id_productora ||
          user.user_metadata?.productora ||
          ''
        ).trim();
        const filtroProductoraNum = Number.parseInt(filtroProductora, 10);

        // Actualizar CHAT_READ en NOVEDADES (para tracking general)
        let novQuery = supabaseClient.from('novedades').select('chat_read').eq('id_novedad', payload.idNovedad);
        if (Number.isFinite(filtroProductoraNum)) {
          novQuery = novQuery.eq('productora', filtroProductoraNum);
        }
        const { data: novData } = await novQuery.single();
        let cR = novData?.chat_read ? (typeof novData.chat_read === 'string' ? JSON.parse(novData.chat_read) : novData.chat_read) : {};
        cR[payload.rol === 'GUEST' ? 'GUEST' : 'OPERATOR'] = new Date().toISOString()
        let novUpd = supabaseClient.from('novedades').update({ chat_read: cR }).eq('id_novedad', payload.idNovedad)
        if (Number.isFinite(filtroProductoraNum)) {
          novUpd = novUpd.eq('productora', filtroProductoraNum);
        }
        const { error: errR } = await novUpd
        if (errR) throw errR

        // Actualizar is_read y read_at en mensajes de chat que NO son míos
        const myRol = payload.rol || 'GUEST'
        const { error: errChatRead } = await supabaseClient
          .from('chat')
          .update({
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id_novedad', payload.idNovedad)
          .eq('productora', filtroProductora)
          .neq('rol', myRol)  // Solo marcar mensajes que NO son míos
          .eq('is_read', false)  // Solo los que aún no están leídos

        if (errChatRead) throw errChatRead

        result = { success: true, message: "Leído" }
        break;
      }

      case "UPDATE_USER": {
        const userId = String(payload.id);
        const emailToFind = payload.oldEmail || payload.correo || payload.CORREO;

        // 1. Búsqueda exhaustiva del UUID de Auth
        let targetAuthId = "";
        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
        if (listErr) throw listErr;
        const users = listData?.users || [];

        // Intentar encontrar por cualquier medio
        const found = users.find((u: any) =>
          u.id === userId ||
          u.email === emailToFind ||
          u.user_metadata?.id_usuario === userId ||
          u.user_metadata?.cedula === userId
        );

        if (found) {
          targetAuthId = found.id;
        } else if (userId.includes('-') && userId.length > 30) {
          targetAuthId = userId; // Si parece un UUID, lo usamos como último recurso
        }

        console.log(`[UPDATE_USER] Buscando: ${userId}/${emailToFind} -> Encontrado: ${targetAuthId}`);

        if (!targetAuthId) {
          throw new Error("No se pudo encontrar el usuario en el sistema de autenticación.");
        }

        // 2. Preparar datos de actualización limpios
        const attributes: any = {
          user_metadata: { ...found?.user_metadata },
          app_metadata: { ...found?.app_metadata }
        };

        if (payload.usuario !== undefined) attributes.user_metadata.full_name = payload.usuario;
        if (payload.rol !== undefined) {
          attributes.user_metadata.role = payload.rol;
          attributes.app_metadata = { ...attributes.app_metadata, role: payload.rol };
        }
        if (payload.telefono !== undefined) {
          let tel = String(payload.telefono);
          if (tel) {
            // Limpiar el teléfono (quitar caracteres no numéricos)
            tel = tel.replace(/\D/g, '');
            // Si ya empieza con 57, no agregarlo de nuevo
            if (!tel.startsWith('57')) tel = '57' + tel;
            // Agregar el signo + al inicio
            tel = '+' + tel;
          }
          attributes.user_metadata.phone = tel;
          attributes.phone = tel;
        }
        if (payload.correo !== undefined && payload.correo !== found?.email) {
          attributes.email = payload.correo;
        }
        if (payload.password !== undefined && payload.password !== "") {
          attributes.password = payload.password;
        }
        if (payload.firma_svg !== undefined) {
          attributes.user_metadata.firma_svg = payload.firma_svg;
        }
        if (payload.id_productora !== undefined) {
          attributes.user_metadata.id_productora = payload.id_productora;
        }
        if (payload.productora !== undefined) {
          attributes.user_metadata.productora = payload.productora;
        }
        if (payload.email_copia !== undefined) {
          attributes.user_metadata.email_copia = payload.email_copia === true || payload.email_copia === 'true';
        }

        // 3. Ejecutar actualización en Auth
        const { error: authErr } = await supabaseClient.auth.admin.updateUserById(targetAuthId, attributes);
        if (authErr) throw new Error("Error al actualizar identidad: " + authErr.message);

        // 4. Sincronización con tabla legada (ELIMINADA por solicitud del usuario)
        result = { success: true, message: "Usuario actualizado con éxito" };
        break;
      }

      case "ELIMINAR_USUARIO": {
        const userId = String(payload.id);

        // 1. Buscar el UUID real si lo que recibimos es la cédula/ID
        let targetAuthId = userId;
        if (!userId.includes('-')) {
          const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
          if (listErr) throw listErr;
          const users = listData?.users || [];
          const found = users.find((u: any) =>
            u.user_metadata?.id_usuario === userId ||
            u.user_metadata?.cedula === userId
          );
          if (found) targetAuthId = found.id;
        }

        // 2. Borrar de Auth
        if (targetAuthId && targetAuthId.includes('-')) {
          const { error: delAuthErr } = await supabaseClient.auth.admin.deleteUser(targetAuthId);
          if (delAuthErr) console.warn("Error al borrar de Auth:", delAuthErr.message);
        }

        // 3. Borrar de tabla legada (ELIMINADA por solicitud del usuario)
        result = { success: true, message: "Usuario eliminado correctamente" };
        break;
      }

      case "ACTUALIZAR_PLANTA": {
        const plantId = payload.id;
        const plantData: any = {};

        // Datos para la tabla operativa
        if (payload.nombrePlanta !== undefined) plantData.planta = payload.nombrePlanta;
        if (payload.email !== undefined) plantData.correo = payload.email;
        if (payload.telefono !== undefined) plantData.telefono = payload.telefono;
        if (payload.rol !== undefined) plantData.rol = payload.rol;

        // Preservar productora
        const prodId = parseInt(payload.productora);
        if (!isNaN(prodId)) plantData.productora = prodId;

        // Actualizar Tabla PLANTAS
        let query = supabaseClient
          .from('plantas')
          .update(plantData)
          .eq('id_planta', plantId);

        if (!isNaN(prodId)) {
          query = query.eq('productora', prodId);
        }

        const { error: errP } = await query;
        if (errP) throw errP;

        result = { success: true, message: "Planta actualizada correctamente" }
        break;
      }

      case "CREAR_USUARIO": {
        // 1. Validar si el ID ya existe en el sistema (Búsqueda por metadatos)
        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
        if (listErr) throw listErr;
        const allUsers = listData?.users || [];
        const existingId = allUsers.find((u: any) =>
          u.user_metadata?.id_usuario === payload.id ||
          u.user_metadata?.cedula === payload.id
        );

        if (existingId) {
          throw new Error(`La identificación ${payload.id} ya está registrada para el usuario ${existingId.user_metadata?.full_name || existingId.email}.`);
        }

        // 2. Crear en Auth (MAP Style)
        let rawTel = payload.telefono || payload.TELEFONO;
        if (rawTel && !String(rawTel).startsWith('+')) rawTel = '+57' + rawTel;

        const { data: authUser, error: authErr } = await supabaseClient.auth.admin.createUser({
          email: payload.correo || payload.CORREO,
          password: payload.password || payload.CONTRASEÑA,
          phone: rawTel,
          email_confirm: true,
          user_metadata: {
            full_name: payload.usuario || payload.USUARIO,
            role: payload.rol || 'PENDIENTE',
            id_usuario: payload.id || payload.ID_USUARIO,
            phone: payload.telefono || payload.TELEFONO,
            cedula: payload.id || payload.ID_USUARIO,
            firma_svg: payload.firma_svg || null,
            id_productora: payload.id_productora !== undefined ? payload.id_productora : null,
            productora: payload.productora !== undefined ? payload.productora : null,
            email_copia: payload.email_copia === true || payload.email_copia === 'true'
          },
          app_metadata: {
            role: payload.rol || 'PENDIENTE'
          }
        });

        if (authErr) {
          console.error("[CREAR_USUARIO] Error en Auth:", authErr);
          if (authErr.message.includes('already registered')) {
            if (authErr.message.toLowerCase().includes('phone')) {
              throw new Error('Este número de teléfono ya está registrado con otro usuario.');
            }
            throw new Error('Este correo ya está registrado en el sistema.');
          }
          throw new Error("Error de identidad: " + authErr.message);
        }

        // 2. Intentar guardar en tabla legada (ELIMINADA por solicitud del usuario)
        result = {
          success: true,
          message: "Usuario creado exitosamente en el sistema de identidad",
          id: payload.id || authUser.user.id
        }
        break;
      }

      case "CREAR_PLANTA": {
        // Guardar datos operativos en tabla plantas
        const newPlantData: any = {
          id_planta: payload.id || payload.ID_PLANTA,
          planta: payload.planta || payload.PLANTA,
          telefono: payload.telefono || payload.TELEFONO,
          correo: payload.email || payload.EMAIL,
          rol: payload.rol || 'GUEST',
          productora: parseInt(payload.productora) || null
        };

        const { error: errNewP } = await supabaseClient.from('plantas').upsert([newPlantData]);
        if (errNewP) throw errNewP;

        result = { success: true, message: "Taller creado exitosamente en la Base de Datos" }
        break;
      }

      case "APPEND_MASTER": {
        // Inserta registros adicionales sin borrar (usado en chunks después del primer SYNC_BUSINT)
        const { records: appendRecords } = payload;
        if (!appendRecords || !Array.isArray(appendRecords) || appendRecords.length === 0) {
          throw new Error('Se requiere records[]');
        }

        // Normalizar fechas antes de deduplicar
        const normalizedRecords = appendRecords.map((r: any) => ({
          ...r,
          fecha_salida: normalizeDate(r.fecha_salida),
          fecha_entrega: normalizeDate(r.fecha_entrega)
        }));

        // Deduplicar por id_master + proceso + productora
        const dedupMap = new Map<string, any>();
        const duplicates: any[] = [];
        for (const r of normalizedRecords) {
          const key = `${r.id_master}_${r.proceso}_${r.productora}`;
          if (dedupMap.has(key)) {
            const existing = dedupMap.get(key);
            duplicates.push({
              key,
              existing: { ...existing },
              duplicate: { ...r }
            });
          } else {
            dedupMap.set(key, r);
          }
        }
        const dedupedRecords = Array.from(dedupMap.values());

        const batchA = 200;
        let insertedA = 0;
        const errorsA: string[] = [];
        for (let i = 0; i < dedupedRecords.length; i += batchA) {
          const batch = dedupedRecords.slice(i, i + batchA);
          const { error: insErr } = await supabaseClient.from('master').insert(batch);
          if (insErr) errorsA.push(`Lote ${Math.floor(i / batchA) + 1}: ${insErr.message}`);
          else insertedA += batch.length;
        }

        const resultErrors = [...errorsA];
        if (duplicates.length > 0) {
          resultErrors.push(`Registros duplicados omitidos: ${duplicates.length}`);
        }

        result = { success: errorsA.length === 0, inserted: insertedA, errors: resultErrors, duplicates } as any;
        break;
      }

      case "APPEND_PLANTAS": {
        const { plantas: appendPlantas } = payload;
        if (!appendPlantas || !Array.isArray(appendPlantas) || appendPlantas.length === 0) {
          throw new Error('Se requiere plantas[]');
        }
        // Deduplicar por id_planta
        const dedupMapA = new Map<number, any>();
        for (const r of appendPlantas) {
          const id = parseInt(r.id_planta);
          if (!isNaN(id) && id > 0) dedupMapA.set(id, r);
        }
        const dedupedA = Array.from(dedupMapA.values());

        const batchP = 50;
        let insertedP = 0;
        const errorsP: string[] = [];
        for (let i = 0; i < dedupedA.length; i += batchP) {
          const batch = dedupedA.slice(i, i + batchP);
          const { data: upsData, error: upsErr } = await supabaseClient
            .from('plantas')
            .upsert(batch, { onConflict: 'id_planta,productora' })
            .select('id_planta');
          if (upsErr) errorsP.push(`Lote ${Math.floor(i / batchP) + 1}: ${upsErr.message}`);
          else insertedP += upsData?.length || batch.length;
        }
        result = { success: errorsP.length === 0, inserted: insertedP, errors: errorsP } as any;
        break;
      }

      case "SYNC_PLANTAS": {
        const { plantas: plantasRecords } = payload;
        if (!plantasRecords || !Array.isArray(plantasRecords) || plantasRecords.length === 0) {
          throw new Error('Se requiere plantas[]');
        }

        const idProdPlanta = parseInt(plantasRecords[0]?.productora);
        if (isNaN(idProdPlanta) || idProdPlanta <= 0) {
          throw new Error('Los registros no tienen una productora válida.');
        }

        if (!['ADMIN', 'MODERATOR', 'USER-P'].includes(userRole)) {
          throw new Error('Acceso denegado: Se requieren permisos de administrador o de producción');
        }

        const recordsWithProd = plantasRecords.map((r: any) => ({
          ...r,
          id_planta: parseInt(r.id_planta),
          productora: idProdPlanta
        })).filter((r: any) => !isNaN(r.id_planta) && r.id_planta > 0 && r.planta);

        if (recordsWithProd.length === 0) {
          throw new Error('Ningún registro válido — verifique que id_planta y planta tengan valores');
        }

        // Deduplicar por id_planta — si hay duplicados en el Excel, quedarse con el último
        const dedupMap = new Map<number, any>();
        for (const r of recordsWithProd) {
          dedupMap.set(r.id_planta, r);
        }
        const dedupedRecords = Array.from(dedupMap.values());

        // UPSERT: actualiza si existe (id_planta, productora), inserta si es nueva
        const batchSize = 50;
        let upserted = 0;
        const upsertErrors: string[] = [];

        for (let i = 0; i < dedupedRecords.length; i += batchSize) {
          const batch = dedupedRecords.slice(i, i + batchSize);
          const { data: upsData, error: upsErr } = await supabaseClient
            .from('plantas')
            .upsert(batch, { onConflict: 'id_planta,productora' })
            .select('id_planta');
          if (upsErr) {
            console.error(`[SYNC_PLANTAS] Error lote ${Math.floor(i / batchSize) + 1}:`, upsErr.message);
            upsertErrors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${upsErr.message}`);
          } else {
            upserted += upsData?.length || batch.length;
          }
        }

        result = {
          success: upsertErrors.length === 0,
          message: `PLANTAS actualizadas: ${upserted} de ${dedupedRecords.length} registros`,
          inserted: upserted,
          errors: upsertErrors
        } as any;
        break;
      }

      case "INSERT_PLANTA_ANEXO": {
        const { planta_anexo: plantaAnexoData } = payload;
        if (!plantaAnexoData) {
          throw new Error('Se requiere planta_anexo');
        }

        if (!['ADMIN', 'MODERATOR', 'USER-P', 'USER-C'].includes(userRole)) {
          throw new Error('Acceso denegado: Se requieren permisos de administrador, producción o calidad');
        }

        const { data: insData, error: insErr } = await supabaseClient
          .from('plantas_anexos')
          .insert([plantaAnexoData])
          .select()
          .single();

        if (insErr) {
          console.error('[INSERT_PLANTA_ANEXO ERROR]', insErr);
          throw new Error(`Error insertando planta anexo: ${insErr.message}`);
        }

        result = {
          success: true,
          message: 'Planta anexo aprobada exitosamente',
          id: insData.id_planta_anexo
        } as any;
        break;
      }

      case "SYNC_BUSINT": {
        const { records: busintRecords } = payload;
        if (!busintRecords || !Array.isArray(busintRecords) || busintRecords.length === 0) {
          throw new Error('Se requiere records[]');
        }

        // Leer productora del primer registro
        const idProductoraNum = parseInt(busintRecords[0]?.productora);
        if (isNaN(idProductoraNum) || idProductoraNum <= 0) {
          throw new Error('Los registros no tienen una productora válida asignada.');
        }

        if (!['ADMIN', 'MODERATOR', 'USER-P'].includes(userRole)) {
          throw new Error('Acceso denegado: Se requieren permisos de administrador o de producción');
        }

        // Extraer todos los procesos únicos del archivo entrante
        const procesosUnicos: string[] = [...new Set(
          busintRecords.map((r: any) => String(r.proceso || '').trim()).filter((p: string) => p.length > 0)
        )];

        if (procesosUnicos.length === 0) {
          throw new Error('Los registros no tienen proceso asignado.');
        }

        // Borrar registros:
        // Si es la productora 1, se eliminan todos los registros de la productora 1 para subirlos frescos.
        // Para cualquier otra productora, se eliminan segmentados por los procesos presentes en el archivo.
        let deleteQuery = supabaseClient
          .from('master')
          .delete()
          .eq('productora', idProductoraNum);

        if (idProductoraNum !== 1) {
          deleteQuery = deleteQuery.in('proceso', procesosUnicos);
        }

        const { error: delErr } = await deleteQuery;
        if (delErr) throw new Error('Error al limpiar master: ' + delErr.message);

        // 2. Normalizar fechas y asegurar que todos los registros lleven la productora correcta
        const recordsWithProductora = busintRecords.map((r: any) => ({
          ...r,
          productora: idProductoraNum,
          fecha_salida: normalizeDate(r.fecha_salida),
          fecha_entrega: normalizeDate(r.fecha_entrega)
        }));

        // 3. Deduplicar por id_master + proceso + productora
        const dedupMap = new Map<string, any>();
        const duplicates: any[] = [];
        for (const r of recordsWithProductora) {
          const key = `${r.id_master}_${r.proceso}_${r.productora}`;
          if (dedupMap.has(key)) {
            const existing = dedupMap.get(key);
            duplicates.push({
              key,
              existing: { ...existing },
              duplicate: { ...r }
            });
          } else {
            dedupMap.set(key, r);
          }
        }
        const dedupedRecords = Array.from(dedupMap.values());

        // 4. Insertar en lotes de 200
        const batchSize = 200;
        let inserted = 0;
        const insertErrors: string[] = [];

        for (let i = 0; i < dedupedRecords.length; i += batchSize) {
          const batch = dedupedRecords.slice(i, i + batchSize);
          const { error: insErr } = await supabaseClient.from('master').insert(batch);
          if (insErr) {
            insertErrors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${insErr.message}`);
          } else {
            inserted += batch.length;
          }
        }

        const resultErrors = [...insertErrors];
        if (duplicates.length > 0) {
          resultErrors.push(`Registros duplicados omitidos: ${duplicates.length}`);
        }

        result = {
          success: insertErrors.length === 0,
          message: `master sincronizado: ${inserted} registros insertados`,
          inserted,
          errors: resultErrors,
          duplicates
        } as any;
        break;
      }

      case "GET_TALLAS_COLORES": {        // Obtener tallas y colores disponibles para una OP desde la tabla master.
        // Reemplaza la lógica de barras/curva en el formulario de novedad.
        const { id_master: opId, proceso: procesoFiltro } = payload;

        if (!opId) throw new Error('Se requiere id_master');

        // Buscar el registro en master para obtener referencia y proceso
        const { data: masterRow, error: masterErr } = await supabaseClient
          .from('master')
          .select('id_master, referencia, proceso, descripcion, cantidad, nombre_planta')
          .eq('id_master', opId)
          .maybeSingle();

        if (masterErr) throw masterErr;
        if (!masterRow) throw new Error(`No se encontró la OP ${opId} en master`);

        // Buscar en CURVA por referencia para obtener tallas y colores
        const { data: curvaRows, error: curvaErr } = await supabaseClient
          .from('CURVA')
          .select('detalles, referencia, op')
          .or(`op.eq.${opId},referencia.eq.${masterRow.referencia}`)
          .limit(5);

        if (curvaErr) throw curvaErr;

        // Extraer tallas y colores únicos de los detalles de la curva
        let tallas: string[] = [];
        let colores: string[] = [];

        if (curvaRows && curvaRows.length > 0) {
          // Preferir la curva que coincida exactamente con la OP
          const curva = curvaRows.find((r: any) => String(r.op) === String(opId)) || curvaRows[0];
          const detalles = Array.isArray(curva.detalles) ? curva.detalles : [];

          const tallasSet = new Set<string>();
          const coloresSet = new Set<string>();

          for (const d of detalles) {
            if (d.talla && String(d.talla).trim()) tallasSet.add(String(d.talla).trim().toUpperCase());
            if (d.color && String(d.color).trim()) coloresSet.add(String(d.color).trim().toUpperCase());
            if (d.id_color && String(d.id_color).trim()) coloresSet.add(String(d.id_color).trim().toUpperCase());
          }

          tallas = Array.from(tallasSet).sort();
          colores = Array.from(coloresSet).sort();
        }

        result = {
          success: true,
          op: masterRow,
          tallas,
          colores,
          hasCurva: tallas.length > 0 || colores.length > 0
        } as any;
        break;
      }

      case "LISTAR_USUARIOS": {
        // Obtener usuarios directamente del sistema de Auth (MAP Style)
        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();

        if (listErr) throw listErr;
        const users = listData.users;

        // Mapear al formato que espera la app de MI
        const mappedUsers = users.map((u: any) => {
          // Supabase devuelve metadata en raw_user_meta_data (con guiones bajos)
          const meta = u.user_metadata || u.raw_user_meta_data || {};
          return {
            ID_USUARIO: meta.id_usuario || meta.cedula || u.id,
            USUARIO: meta.full_name || u.email.split('@')[0],
            CORREO: u.email,
            TELEFONO: meta.phone || '',
            ROL: meta.role || 'PENDIENTE',
            PRODUCTORA: meta.productora || null,
            ID_PRODUCTORA: meta.id_productora || null,
            EMAIL_COPIA: meta.email_copia || false, // Ahora es booleano
            ULTIMO_ACCESO: u.last_sign_in_at,
            FIRMA_SVG: meta.firma_svg || null,
            ID_AUTH: u.id
          };
        });

        result = { success: true, users: mappedUsers } as any;
        break;
      }

      case "LOGOUT_ALL_USERS": {
        // Deslogear todos los usuarios activos usando una bandera de forzamiento de reautenticación
        // Supabase no tiene un método directo para deslogear todos los usuarios, así que usamos un enfoque alternativo
        // Actualizamos un campo en la metadata de los usuarios para forzar reautenticación

        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();

        if (listErr) throw listErr;
        const users = listData.users;

        let revokedCount = 0;
        const errors: string[] = [];

        // Crear o actualizar un registro en una tabla de configuración para forzar logout global
        const { error: configErr } = await supabaseClient
          .from('configuracion')
          .upsert({
            clave: 'force_logout_timestamp',
            valor: Date.now().toString(),
            actualizado_por: user.email
          }, {
            onConflict: 'clave'
          });

        if (configErr) {
          // Si la tabla no existe, intentar crearla
          const { error: createErr } = await supabaseClient
            .from('configuracion')
            .insert({
              clave: 'force_logout_timestamp',
              valor: Date.now().toString(),
              actualizado_por: user.email
            });

          if (createErr) {
            throw new Error('No se pudo establecer la bandera de logout global. Error: ' + createErr.message);
          }
        }

        revokedCount = users.length;

        result = {
          success: true,
          message: `Se ha establecido una bandera de logout global. ${revokedCount} usuarios deberán reautenticarse.`,
          revokedCount,
          totalUsers: users.length,
          note: 'Los usuarios serán redirigidos al login en su próxima solicitud debido a la bandera de logout global.'
        } as any;
        break;
      }

      case "LISTAR_REPORTES": {
        let allReportes: any[] = [];
        let from = 0;
        const limit = 1000;
        let keepFetching = true;

        // Si es USER-C, forzar que solo pueda ver sus propios reportes filtrados por su email de autenticación
        let filtroEmail = null;
        if (userRole === 'USER-C') {
          filtroEmail = user.email;
        } else {
          filtroEmail = payload.email || payload.EMAIL || payload.correo || payload.CORREO;
        }

        while (keepFetching) {
          let repQuery = supabaseClient
            .from('reportes')
            .select('*')
            .range(from, from + limit - 1);

          if (filtroEmail) {
            repQuery = repQuery.ilike('email', String(filtroEmail).trim());
          }

          const { data: repsData, error: repsErr } = await repQuery;
          if (repsErr) throw repsErr;

          if (repsData && repsData.length > 0) {
            allReportes = allReportes.concat(repsData);
          }

          if (repsData && repsData.length === limit) {
            from += limit;
          } else {
            keepFetching = false;
          }
        }

        result = { success: true, reportes: allReportes } as any;
        break;
      }

      case "LISTAR_APROBACIONES": {
        let allAprobaciones: any[] = [];
        let from = 0;
        const limit = 1000;
        let keepFetching = true;

        // Si es USER-C, forzar que solo pueda ver sus propias aprobaciones filtrados por su email de autenticación
        let filtroEmail = null;
        if (userRole === 'USER-C') {
          filtroEmail = user.email;
        } else {
          filtroEmail = payload.email || payload.EMAIL || payload.correo || payload.CORREO;
        }

        while (keepFetching) {
          let aprQuery = supabaseClient
            .from('plantas_anexos')
            .select('*')
            .range(from, from + limit - 1);

          if (filtroEmail) {
            aprQuery = aprQuery.ilike('email_usuario', String(filtroEmail).trim());
          }

          const { data: aprData, error: aprErr } = await aprQuery;
          if (aprErr) throw aprErr;

          if (aprData && aprData.length > 0) {
            allAprobaciones = allAprobaciones.concat(aprData);
          }

          if (aprData && aprData.length === limit) {
            from += limit;
          } else {
            keepFetching = false;
          }
        }

        result = { success: true, aprobaciones: allAprobaciones } as any;
        break;
      }

      case "ANULAR_REPORTE": {
        try {
          console.log('[ANULAR_REPORTE] Payload recibido:', JSON.stringify(payload));
          console.log('[ANULAR_REPORTE] Usuario:', user.email, 'Rol:', userRole);
          
          // Validar permisos: Solo ADMIN y MODERATOR
          if (!['ADMIN', 'MODERATOR'].includes(userRole)) {
            throw new Error('Acceso denegado: Solo ADMIN y MODERATOR pueden anular reportes');
          }
          
          const idReporte = payload.id_reporte;
          if (!idReporte) {
            throw new Error("ID de reporte requerido");
          }

          console.log(`[OPERATIONS] Anulando reporte ${idReporte}...`);

          // Actualizar estado a false
          const { data, error } = await supabaseClient
            .from('reportes')
            .update({ estado: false })
            .eq('id_reporte', idReporte)
            .select();

          if (error) {
            console.error('[ANULAR_REPORTE] Error en update:', error);
            throw error;
          }

          console.log(`[OPERATIONS] Reporte ${idReporte} anulado exitosamente:`, data);
          result = { success: true, anulado: data };
        } catch (e: any) {
          console.error(`[OPERATIONS ERROR] ANULAR_REPORTE:`, e.message, e);
          throw new Error(`Error al anular reporte: ${e.message}`);
        }
        break;
      }

      case "DUPLICAR_REPORTE": {
        try {
          console.log('[DUPLICAR_REPORTE] Payload recibido:', JSON.stringify(payload));
          console.log('[DUPLICAR_REPORTE] Usuario:', user.email, 'Rol:', userRole);
          
          // Validar permisos: Solo ADMIN y MODERATOR
          if (!['ADMIN', 'MODERATOR'].includes(userRole)) {
            throw new Error('Acceso denegado: Solo ADMIN y MODERATOR pueden duplicar reportes');
          }
          
          const idReporteOriginal = payload.id_reporte;
          if (!idReporteOriginal) {
            throw new Error("ID de reporte requerido para duplicar");
          }

          // 1. Obtener el reporte original directamente de la BD
          const { data: originalRow, error: fetchErr } = await supabaseClient
            .from('reportes')
            .select('*')
            .eq('id_reporte', idReporteOriginal)
            .single();

          if (fetchErr || !originalRow) {
            console.error('[DUPLICAR_REPORTE] Error al obtener original:', fetchErr);
            throw new Error(`No se encontró el reporte original: ${idReporteOriginal}`);
          }

          console.log(`[OPERATIONS] Duplicando reporte ${idReporteOriginal}...`);

          // 2. Generar nuevo ID de reporte con formato: REP-{PRODUCTORA}-{HEX5}
          const pId = originalRow.productora || '0';
          const nuevoIdReporte = `REP-${pId}-` + Math.floor(Math.random() * 0x100000).toString(16).toUpperCase().padStart(5, '0');
          
          // 3. Generar fecha en formato Colombia
          const ahoraDate = new Date();
          const options = { 
            timeZone: 'America/Bogota',
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          } as const;
          
          const formatter = new Intl.DateTimeFormat('es-CO', options);
          const parts = formatter.formatToParts(ahoraDate);
          
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          const hour = parts.find(p => p.type === 'hour')?.value;
          const minute = parts.find(p => p.type === 'minute')?.value;
          const second = parts.find(p => p.type === 'second')?.value;
          
          const ahora = `${year}-${month}-${day} ${hour}:${minute}:${second}-05`;

          // 4. Copiar TODAS las columnas del original excepto las que cambian
          const reporteData: any = { ...originalRow };
          
          // Eliminar campos autogenerados por la BD que no se deben duplicar
          delete reporteData.created_at;
          
          // Sobrescribir con los valores nuevos
          reporteData.id_reporte = nuevoIdReporte;
          reporteData.estado = true;
          reporteData.fecha = ahora;

          console.log('[DUPLICAR_REPORTE] Datos a insertar:', JSON.stringify(reporteData));

          // 5. Insertar nuevo reporte
          const { data, error } = await supabaseClient
            .from('reportes')
            .insert(reporteData)
            .select();

          if (error) {
            console.error('[DUPLICAR_REPORTE] Error en insert:', error);
            throw error;
          }

          console.log(`[OPERATIONS] Reporte duplicado con ID: ${nuevoIdReporte}`, data);
          result = { success: true, reporte: data?.[0], id_reporte: nuevoIdReporte };
        } catch (e: any) {
          console.error(`[OPERATIONS ERROR] DUPLICAR_REPORTE:`, e.message, e);
          throw new Error(`Error al duplicar reporte: ${e.message}`);
        }
        break;
      }

      default:
        // Caso genérico: Inserción (Novedades, Calidad, etc.)
        if (hoja) {
          const isNovedades = hoja.toUpperCase() === 'NOVEDADES';
          const isReportes = hoja.toUpperCase() === 'REPORTES';
          const isRutero = hoja.toUpperCase() === 'RUTERO' || hoja.toUpperCase() === 'VISITAS';
          const table = isNovedades ? 'novedades' : (isReportes ? 'reportes' : (isRutero ? 'visitas' : hoja.toUpperCase()));
          const dataToInsert = { ...payload }
          delete dataToInsert.accion
          delete dataToInsert.hoja
          if (publicUrl) {
            // Unificar nombre de columna de imagen/soporte
            if (isReportes) dataToInsert.soporte = publicUrl
            else dataToInsert.imagen = publicUrl
          }

          const finalData: any = {}
          for (const key in dataToInsert) {
            // No procesar IDs aquí, los manejamos abajo
            const keyUpper = key.toUpperCase();
            if (['ID', 'ID_NOVEDAD', 'ID_REPORTE', 'ID_VISITA', 'ID_RUTERO'].includes(keyUpper)) continue;
            // Convertir camelCase a snake_case
            let snakeKey = key.replace(/([A-Z])/g, "_$1").replace(/^_/, "");

            if (isNovedades || isReportes || isRutero) {
              snakeKey = snakeKey.toLowerCase();
              // Mapeo especial para LINEA -> CUENTO y LOTE -> ID
              if (isNovedades) {
                if (snakeKey === 'linea') snakeKey = 'cuento';
                if (snakeKey === 'lote') snakeKey = 'id';
              } else if (isReportes) {
                if (snakeKey === 'lote') snakeKey = 'id';
              }
            } else {
              snakeKey = snakeKey.toUpperCase();
            }
            finalData[snakeKey] = dataToInsert[key]
          }

          // Generación de Identificadores siguiendo el patrón del usuario
          if (isNovedades && !finalData.id_novedad) {
            finalData.id_novedad = "NOV-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }
          if (isReportes && !finalData.id_reporte) {
            const pId = finalData.productora || '0';
            finalData.id_reporte = `REP-${pId}-` + Math.floor(Math.random() * 0x1000000).toString(16).toUpperCase();
          }
          if (isRutero && !finalData.id_visita) {
            const incomingId = payload.id_visita || payload.id_rutero || payload.ID_VISITA || payload.ID_RUTERO || payload.id;
            finalData.id_visita = incomingId || ("VIS-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase());
          }

          if (!isRutero && !finalData.fecha && !finalData.FECHA) {
            // Generar la hora de Bogotá en formato ISO estricto con desfase
            const now = new Date();
            const bogotaIso = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Bogota',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              hour12: false
            }).format(now).replace(', ', 'T');

            // Formato final: 2024-05-15T09:44:14-05:00
            const finalTimestamp = `${bogotaIso}-05:00`;

            if (isNovedades || isReportes) finalData.fecha = finalTimestamp;
            else finalData.FECHA = finalTimestamp;

            console.log(`[DATE DEBUG] Enviando ISO Bogotá: ${finalTimestamp}`);
          }

          // Inyectar URL de imagen si se subió una
          if (publicUrl) {
            const imgCol = isNovedades ? 'imagen' : (isReportes ? 'soporte' : 'IMAGEN');
            finalData[imgCol] = publicUrl;
          }
          if (isNovedades && !finalData.estado) finalData.estado = 'PENDIENTE';

          // AVANCE ya existe como columna en reportes, así que no se elimina

          if (isRutero) {
            const ruteroCols = ['id_visita', 'fecha_visita', 'auditor', 'planta', 'lote', 'referencia', 'proceso', 'tipo_visita', 'destino', 'cantidad', 'prioridad', 'estado', 'productora'];
            for (const k of Object.keys(finalData)) {
              if (!ruteroCols.includes(k)) delete finalData[k];
            }
          } else if (isReportes) {
            const reportesCols = [
              'id_reporte', 'fecha', 'id', 'referencia', 'cantidad', 'planta', 'entrada', 'salida', 'linea', 'proceso', 
              'prenda', 'genero', 'tejido', 'email', 'localizacion', 'tipo_visita', 'conclusion', 'observaciones', 
              'soporte', 'productora', 'firma_svg', 'destino_proceso', 'destino_planta', 'novedades_auditoria', 'avance'
            ];
            for (const k of Object.keys(finalData)) {
              if (!reportesCols.includes(k)) delete finalData[k];
            }
            // Normalizar fechas
            if (finalData.entrada) finalData.entrada = normalizeDate(finalData.entrada);
            if (finalData.salida) finalData.salida = normalizeDate(finalData.salida);
          } else if (isNovedades) {
            const novedadesCols = ['id_novedad', 'fecha', 'id', 'referencia', 'cantidad', 'planta', 'salida', 'cuento', 'proceso', 'prenda', 'genero', 'area', 'descripcion', 'cantidad_solicitada', 'imagen', 'estado', 'chat', 'chat_read', 'historial_estados', 'tipo_novedad', 'tipo_detalle', 'comentarios', 'cobro', 'productora'];
            for (const k of Object.keys(finalData)) {
              if (!novedadesCols.includes(k)) delete finalData[k];
            }

            // Conversión de tipos para evitar errores de esquema
            if (finalData.cantidad !== undefined) finalData.cantidad = Number(finalData.cantidad) || 0;
            if (finalData.cantidad_solicitada !== undefined) finalData.cantidad_solicitada = Number(finalData.cantidad_solicitada) || 0;
            if (finalData.id !== undefined) finalData.id = Number(finalData.id) || 0;

            // Normalizar fecha de salida
            if (finalData.salida) finalData.salida = normalizeDate(finalData.salida);
          }

          // ── RESOLVER PRODUCTORA (NOT NULL) PARA TABLAS OPERATIVAS (Composite PK) ──
          if (isNovedades || isReportes || isRutero) {
            let prodResolved = Number(finalData.productora);

            if (!prodResolved || isNaN(prodResolved)) {
              // Fallback A: JWT del usuario
              const metaProd = user.user_metadata?.id_productora || user.user_metadata?.productora;
              if (metaProd) prodResolved = Number(metaProd);
            }

            if (!prodResolved || isNaN(prodResolved)) {
              // Fallback B: buscar por nombre de planta en la tabla plantas
              const plantaNombre = finalData.planta;
              if (plantaNombre) {
                const { data: plantaRow } = await supabaseClient
                  .from('plantas')
                  .select('productora')
                  .ilike('planta', plantaNombre.trim())
                  .single();
                if (plantaRow?.productora) prodResolved = Number(plantaRow.productora);
                console.log(`[PRODUCTORA RESOLVER] Resuelta por nombre de planta "${plantaNombre}": ${prodResolved}`);
              }
            }

            if (prodResolved && !isNaN(prodResolved)) {
              finalData.productora = prodResolved;
            } else {
              throw new Error(`No se pudo determinar la productora para la operación. Planta: "${finalData.planta}", valor recibido: "${finalData.productora}"`);
            }
          }

          if (isNovedades && !finalData.correo && user?.email) {
            // El usuario no incluyó 'correo' en su lista de SQL, así que no lo añado a finalData 
            // a menos que esté en novedadesCols.
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
            id: insData.id_novedad || insData.id_reporte || insData.ID_VISITA || insData.id,
            id_novedad: insData.id_novedad
          }

          // Notificar al GUEST cuando se registra una nueva novedad
          if (isNovedades && insData.id_novedad) {
            notificarGuest(supabaseClient, insData.id_novedad, {
              accion: 'NOVEDAD_REGISTRADA'
            }, {
              planta: insData.planta,
              lote: insData.id,
              referencia: insData.referencia,
              productora: insData.productora
            });
          }
        }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    console.error(`[OPERATIONS ERROR]`, error.message)
    return new Response(JSON.stringify({
      success: false,
      message: error.message,
      code: error.code || 'UNKNOWN',
      details: error.details || null,
      hint: error.hint || null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
