// ================================================================
// Edge Function: operations
// Gestión centralizada de operaciones para Formularios:
// - Consulta de Lotes (master) y Plantas
// - Reporte de Calidad (reportes + notificaciones GAS)
// - Reporte de Novedades (novedades + fotos + notificaciones GAS)
// - Rutero y Agenda de Visitas (rutero/visitas)
// - Actualización Técnica de Planta (censo, maquinaria, GPS, firmas)
// ================================================================

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

const GAS_NOTIF_URL = 'https://script.google.com/macros/s/AKfycbw7PEB7D9TP_wDlzJtwKCJmxwUYguXyniYPb_vRAadPHpy7gDWG26fn0wRowI_mre9V/exec';

function normalizeDate(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0];
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const payload = await req.json();
    const { accion, hoja } = payload;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── 1. OPERACIONES DE LECTURA ──
    if (accion === 'LISTAR_LOTES') {
      const { query, planta, limit = 500 } = payload;
      let q = supabaseClient.from('master').select('*').limit(limit);

      if (planta && planta !== 'TODAS') {
        q = q.ilike('planta', `%${planta.trim()}%`);
      }

      if (query) {
        const term = `%${query.trim()}%`;
        q = q.or(`lote.ilike.${term},op.ilike.${term},referencia.ilike.${term},descripcion.ilike.${term}`);
      }

      const { data, error } = await q;
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    if (accion === 'LISTAR_PLANTAS') {
      const { data, error } = await supabaseClient.from('plantas').select('*');
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, plantas: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // ── 2. VALIDACIÓN DE SESIÓN AUTH PARA OPERACIONES DE ESCRITURA ──
    const authHeader = req.headers.get('Authorization');
    let user: any = null;
    let userRole = 'GUEST';

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: userData } = await supabaseClient.auth.getUser(token);
      user = userData?.user;
      if (user) {
        userRole = (user.app_metadata?.role || user.user_metadata?.role || 'AUDITOR').toUpperCase();
      }
    }

    let publicUrl = "";
    const imgData = payload.imagen || payload.archivo || payload.foto;
    if (imgData && imgData.base64) {
      const options = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
      const formatter = new Intl.DateTimeFormat('es-CO', options);
      const parts = formatter.formatToParts(new Date());
      const year = parts.find(p => p.type === 'year')?.value || String(new Date().getFullYear());
      const month = parts.find(p => p.type === 'month')?.value || String(new Date().getMonth() + 1).padStart(2, '0');
      const day = parts.find(p => p.type === 'day')?.value || String(new Date().getDate()).padStart(2, '0');
      const timestamp = Date.now();

      const folderRoot = (hoja?.toUpperCase() === 'REPORTES' || payload.id_reporte) ? 'reportes' : 'novedades';
      const prodId = payload.productora || user?.user_metadata?.id_productora || '0';
      const fileName = (imgData.fileName || 'upload.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folderRoot}/${prodId}/${year}/${month}/${day}/${timestamp}_${fileName}`;

      const contentType = imgData.mimeType || 'image/jpeg';
      const { error: storageError } = await supabaseClient.storage
        .from('novedades-imagenes')
        .upload(filePath, decode(imgData.base64), { contentType, upsert: true });

      if (!storageError) {
        const { data: { publicUrl: pUrl } } = supabaseClient.storage.from('novedades-imagenes').getPublicUrl(filePath);
        publicUrl = pUrl;
      }
    }

    let result: any = { success: false, message: "" };

    // ── 3. MANEJO DE ACCIONES ESPECÍFICAS ──
    switch (accion) {
      case "REPORTE_CALIDAD": {
        let auditorName = payload.auditor || user?.user_metadata?.nombre || user?.email || "Auditor Calidad";
        let chatUrl = "";

        if (user) {
          const rawPhone = user.phone || user.user_metadata?.phone || "";
          const cleanedPhone = rawPhone.replace(/\D/g, "");
          if (cleanedPhone) {
            const op = payload.lote || payload.op || "OP";
            const ref = payload.referencia || "REF";
            const baseText = `Hola, soy de la planta ${payload.planta}. Tengo consultas sobre la auditoría de la OP ${op} (${ref}).`;
            chatUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(baseText)}`;
          }
        }

        // Insertar en tabla reportes
        const idReporte = `REP-${Date.now().toString(36).toUpperCase()}`;
        const fechaBogota = new Date().toISOString();

        const insertRow: any = {
          id_reporte: idReporte,
          fecha: fechaBogota,
          id: payload.lote || payload.op,
          referencia: payload.referencia || "",
          cantidad: Number(payload.cantidadTotal || payload.cantidad || 0),
          planta: payload.planta || "",
          email: payload.email || user?.email || "",
          localizacion: payload.gps ? JSON.stringify(payload.gps) : (payload.localizacion || ""),
          tipo_visita: payload.tipoVisita || "AUDITORIA",
          conclusion: payload.conclusion || "APROBADO",
          observaciones: payload.observaciones || "",
          soporte: publicUrl || payload.soporte || "",
          firma_svg: payload.firma || "",
          destino_proceso: payload.destinoProceso || "",
          destino_planta: payload.destinoPlanta || "",
          novedades_auditoria: payload.novedadesAsociadas ? JSON.stringify(payload.novedadesAsociadas) : null,
          avance: payload.avanceProduccion || 0,
          productora: payload.productora || 1
        };

        const { data: repData, error: repError } = await supabaseClient
          .from('reportes')
          .insert([insertRow])
          .select()
          .single();

        if (repError) {
          console.warn('[OPERATIONS] Error insertando reporte en BD:', repError);
        }

        // Notificación opcional por Google Apps Script
        try {
          await fetch(GAS_NOTIF_URL, {
            method: "POST",
            body: JSON.stringify({
              accion: 'REPORTE_CALIDAD',
              email: payload.email,
              reporte: {
                ...payload,
                id_reporte: idReporte,
                auditor_nombre: auditorName,
                chat_url: chatUrl
              }
            })
          });
        } catch (_) {}

        result = {
          success: true,
          message: `Auditoría ${idReporte} registrada con éxito.`,
          id_reporte: idReporte,
          data: repData || insertRow
        };
        break;
      }

      case "ACTUALIZAR_PLANTA": {
        const plantaNombre = payload.nombre || payload.planta;
        if (!plantaNombre) throw new Error("Nombre de planta requerido");

        const updateData: any = {
          encargado: payload.encargado,
          telefono: payload.telefono,
          correo: payload.email || payload.correo,
          maquinaria: payload.maquinaria ? JSON.stringify(payload.maquinaria) : null,
          capacidad: payload.capacidad || null,
          gps: payload.gps ? JSON.stringify(payload.gps) : null,
          firma: payload.firma || null,
          updated_at: new Date().toISOString()
        };

        const { error: pltErr } = await supabaseClient
          .from('plantas')
          .update(updateData)
          .ilike('planta', plantaNombre.trim());

        if (pltErr) throw pltErr;

        result = {
          success: true,
          message: `Datos de la planta "${plantaNombre}" actualizados.`
        };
        break;
      }

      default: {
        // Enrutador por nombre de hoja (NOVEDADES, RUTERO, etc.)
        const hojaUpper = (hoja || '').toUpperCase();

        if (hojaUpper === 'NOVEDADES') {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const bogotaDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
          const ymd = `${bogotaDate.getFullYear()}${pad(bogotaDate.getMonth() + 1)}${pad(bogotaDate.getDate())}`;
          const fechaBogota = `${bogotaDate.getFullYear()}-${pad(bogotaDate.getMonth() + 1)}-${pad(bogotaDate.getDate())}T${pad(bogotaDate.getHours())}:${pad(bogotaDate.getMinutes())}:${pad(bogotaDate.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}-05:00`;
          
          const prodId = Number(payload.productora) || 1;
          const idNovedad = payload.id_novedad || `NOV-${prodId}-${ymd}-${Date.now().toString().slice(-4)}`;
          
          let tipoDetalle: any = null;
          if (Array.isArray(payload.insumos) && payload.insumos.length > 0) {
            tipoDetalle = payload.insumos;
          } else if (Array.isArray(payload.telas) && payload.telas.length > 0) {
            tipoDetalle = payload.telas;
          } else if (Array.isArray(payload.cortes) && payload.cortes.length > 0) {
            tipoDetalle = payload.cortes;
          } else if (Array.isArray(payload.codigos) && payload.codigos.length > 0) {
            tipoDetalle = payload.codigos;
          } else if (payload.tipo_detalle) {
            try {
              tipoDetalle = typeof payload.tipo_detalle === 'string' ? JSON.parse(payload.tipo_detalle) : payload.tipo_detalle;
            } catch (_) {
              tipoDetalle = payload.tipo_detalle;
            }
          }

          const novRow: any = {
            id_novedad: idNovedad,
            fecha: fechaBogota,
            id: Number(payload.lote || payload.op || payload.id) || 0,
            referencia: payload.referencia || '',
            cantidad: Number(payload.cantidadTotal || payload.cantidad_total || payload.cantidad || 0),
            planta: payload.planta || '',
            salida: payload.salida || payload.fecha_salida || null,
            cuento: payload.cuento || payload.modulo || payload.linea || null,
            proceso: (payload.proceso || 'CONFECCION').toUpperCase(),
            prenda: payload.prenda || payload.tipoPrenda || payload.descripcion || '',
            genero: payload.genero || '',
            tejido: payload.tejido || null,
            area: payload.area || '',
            tipo_novedad: payload.tipoNovedad || payload.tipo_novedad || '',
            tipo_detalle: tipoDetalle,
            descripcion: payload.observaciones || payload.descripcion || '',
            cantidad_solicitada: Number(payload.cantidadSolicitada || payload.cantidad_solicitada || 0),
            imagen: publicUrl || payload.imagen || '',
            estado: 'PENDIENTE',
            productora: prodId,
            comentarios: payload.comentarios || ''
          };

          const { data: novData, error: novError } = await supabaseClient
            .from('novedades')
            .insert([novRow])
            .select()
            .single();

          if (novError) throw novError;

          result = {
            success: true,
            message: `Novedad ${idNovedad} registrada exitosamente.`,
            id_novedad: idNovedad,
            data: novData
          };
        } else if (hojaUpper === 'RUTERO' || hojaUpper === 'VISITAS') {
          const idVisita = "VIS-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          const ruteroRow: any = {
            id_visita: idVisita,
            fecha_visita: payload.fechaVisita || new Date().toISOString().split('T')[0],
            auditor: payload.auditor || user?.email || '',
            planta: payload.planta || '',
            lote: payload.lote || payload.op || '',
            referencia: payload.referencia || '',
            tipo_visita: payload.tipoVisita || 'AUDITORIA',
            destino: payload.destino || '',
            cantidad: Number(payload.cantidad || 0),
            observaciones: payload.observaciones || '',
            estado: 'PROGRAMADA',
            productora: payload.productora || 1
          };

          const { data: rutData, error: rutError } = await supabaseClient
            .from('rutero')
            .insert([ruteroRow])
            .select()
            .single();

          if (rutError) throw rutError;

          result = {
            success: true,
            message: `Visita para ${ruteroRow.lote} programada para el ${ruteroRow.fecha_visita}.`,
            id_visita: idVisita,
            data: rutData
          };
        } else {
          result = { success: true, message: "Operación completada" };
        }
        break;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[OPERATIONS ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      message: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
