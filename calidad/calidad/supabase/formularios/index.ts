// ================================================================
// Edge Function: formularios
// Gestión centralizada de operaciones para el Módulo de Formularios:
// - Consulta de Lotes (master) y Plantas
// - Reporte de Calidad (reportes + notificaciones Resend)
// - Reporte de Novedades (novedades + fotos + notificaciones Resend)
// - Rutero y Agenda de Visitas (rutero/visitas)
// - Actualización Técnica de Planta (censo, maquinaria, GPS, firmas)
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts"
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, X-JSON",
  "Access-Control-Max-Age": "86400",
}

// ── Cloudflare R2 ──────────────────────────────────────────────
const r2 = new S3Client({
  region: "auto",
  endpoint: Deno.env.get("R2_ENDPOINT") ?? "",
  credentials: {
    accessKeyId:     Deno.env.get("R2_ACCESS_KEY_ID")     ?? "",
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "",
  },
});
const R2_BUCKET     = Deno.env.get("R2_BUCKET")     ?? "calidad";
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") ?? "";
// ──────────────────────────────────────────────────────────────

const RESEND_EMAIL_URL = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") + "/functions/v1/emails" ?? "";

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

/**
 * Normaliza LA localización para guardarla como JSONB REAL en la columna
 * `localizacion` (ya es jsonb en Supabase):
 *   - GPS activo  →  { lat, lng }  (objeto JS → jsonb object)
 *   - Sin GPS     →  null          (SQL NULL, no un string vacío ni "false")
 *   - String JSON legacy  → se parsea y se guarda como objeto jsonb.
 */
function normalizeLocalizacion(raw: any): any | null {
  let value: any = raw;
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      value = JSON.parse(value);
    } catch (_) {
      return null; // no es JSON válido → nada que guardar en jsonb
    }
  }
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

/**
 * Normaliza `novedades_auditoria` para guardarla SIEMPRE como valor JSONB REAL
 * (array/objeto JS), replicando la misma forma en que se guarda `tipo_detalle`
 * en la tabla `novedades` (se pasa el objeto/array JS, NO un string de JSON):
 *
 *   CORRECTO  →  [ { "tipo": "SIN CONFECCIONAR", ... } ]   (array JS → jsonb array)
 *   INCORRECTO →  "[{\"tipo\":\"SIN CONFECCIONAR\",...}]"   (string JSON → jsonb string)
 *
 * Desenrolla TODAS las capas de doble/triple stringify que puedan llegar
 * (JSON.parse en bucle hasta obtener el objeto/array real) y devuelve el valor
 * JS resultante, para que Supabase lo serialice como JSONB (array) y no como
 * string JSON doble-encodificado.
 */
function normalizeNovedades(raw: any): any | null {
  if (raw === undefined || raw === null) return null;

  let value: any = raw;
  // Desenrollar capas de string JSON hasta quedarnos con el objeto/array real.
  for (let i = 0; i < 4; i++) {
    if (typeof value !== 'string') break;

    const t = value.trim();
    if (t === '') return null;

    // ¿Empieza con comilla externa? → el contenido interno está escapado → desenrollar.
    if (t.startsWith('"')) {
      try {
        value = JSON.parse(t); // quita la capa externa (comillas + backslashes)
        continue;              // puede haber otra capa → iterar de nuevo
      } catch (_) {
        // No es JSON válido → devolver tal cual (mejor que romper el insert)
        return t;
      }
    }

    // Ya NO empieza con comilla → es JSON limpio (array u objeto) → parsear a JS real
    try {
      value = JSON.parse(t);
      break;
    } catch (_) {
      // No es JSON válido → devolver tal cual (mejor que romper el insert)
      return t;
    }
  }

  // `tipo_base` es solo un helper de la UI para agrupar tarjetas: NO debe
  // persistirse. Se fuerza el COBROS (el detalle va en `proceso`) y se
  // elimina `tipo_base` del objeto final guardado en `novedades_auditoria`.
  if (Array.isArray(value)) {
    value = value.map((nov: any) => {
      if (!nov || typeof nov !== 'object') return nov;
      const tb = String(nov.tipo_base || '');
      const tp = String(nov.tipo || '');
      let clean: any = nov;
      // COBROS: el tipo SIEMPRE debe llamarse "COBROS"; el proceso va en `proceso`
      if (tb === 'COBROS' || /^COBRO\s*-/i.test(tp)) {
        clean = { ...nov, tipo: 'COBROS' };
      }
      const { tipo_base, ...rest } = clean;
      return rest;
    });
  }

  // value ya es objeto/array JS real → devolverlo para que JSONB lo guarde como array
  return value;
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

    // ── 1. OPERACIONES DE LECTURA (PÚBLICAS O CON AUTH) ──
    if (accion === 'LISTAR_PRODUCTORAS') {
      const { data, error } = await supabaseClient
        .from('productoras')
        .select('id_productora, nit, productora, nombre_corto')
        .order('productora', { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    if (accion === 'LISTAR_LOTES') {
      const { query, planta, productora, limit = 50, searchConfig } = payload;
      let q = supabaseClient.from('master').select('*').limit(limit);

      if (productora && productora !== 'TODAS') {
        const prodNum = Number(productora);
        if (!isNaN(prodNum)) {
          q = q.eq('productora', prodNum);
        }
      }

      if (planta && planta !== 'TODAS') {
        const pTerm = `%${planta.trim()}%`;
        q = q.or(`nombre_planta.ilike.${pTerm},planta.ilike.${pTerm}`);
      }

      if (query && query.trim()) {
        const qTrim = query.trim();
        const isNumeric = /^\d+$/.test(qTrim);

        // Usar configuración de búsqueda si está disponible
        if (searchConfig && searchConfig.searchFields) {
          const fields = searchConfig.searchFields;
          const conditions = [];

          if (isNumeric) {
            const num = parseInt(qTrim, 10);
            if (fields.op) conditions.push(`id_master.eq.${num}`);
            if (fields.referencia) conditions.push(`referencia.ilike.%${qTrim}%`);
            if (fields.planta) conditions.push(`nombre_planta.ilike.%${qTrim}%`);
          } else {
            if (fields.referencia) conditions.push(`referencia.ilike.%${qTrim}%`);
            if (fields.planta) conditions.push(`nombre_planta.ilike.%${qTrim}%`);
            if (fields.productora) conditions.push(`productora.ilike.%${qTrim}%`);
          }

          if (conditions.length > 0) {
            q = q.or(conditions.join(','));
          }
        } else {
          // Comportamiento por defecto (buscar en todas las columnas)
          if (isNumeric) {
            const num = parseInt(qTrim, 10);
            q = q.or(`id_master.eq.${num},referencia.ilike.%${qTrim}%,nombre_planta.ilike.%${qTrim}%`);
          } else {
            q = q.or(
              `referencia.ilike.%${qTrim}%,nombre_planta.ilike.%${qTrim}%,descripcion.ilike.%${qTrim}%,proceso.ilike.%${qTrim}%`
            );
          }
        }
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

    // ── CURVA DE LA OP (extensiones talla x color) ──
    // Consulta desde FORMULARIOS con la clave id_productora + op
    // (lo que el usuario está consultando/aceptando en el selector).
    if (accion === 'LISTAR_CURVA') {
      const { op, idProductora } = payload;
      const opNum = Number(op) || 0;
      const idProd = String(idProductora || '').trim();
      if (!opNum || !idProd) throw new Error('Debe indicar op e id_productora.');

      const { data, error } = await supabaseClient
        .from('extensiones')
        .select('id_productora, op, extensiones')
        .eq('op', opNum)
        .eq('id_productora', idProd)
        .limit(100);
      if (error) throw error;

      // Aplanar el JSONB `extensiones` → [{ color, talla, cantidad }]
      const curva: any[] = [];
      for (const row of data || []) {
        for (const e of row.extensiones || []) {
          curva.push({
            color: String(e.color || ''),
            talla: String(e.talla || ''),
            cantidad: Number(e.cantidad || 0)
          });
        }
      }

      return new Response(JSON.stringify({ success: true, data: curva }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // ── PLANTILLAS DE CALIDAD (paqueteo / etiqueta) ──────────────────────────
    if (accion === 'LISTAR_PLANTILLAS') {
      const tipo = String(payload.tipo || '').toUpperCase().trim();
      let q = supabaseClient
        .from('plantillas')
        .select('id, tipo, texto, created_at')
        .order('created_at', { ascending: true });
      if (tipo) q = q.eq('tipo', tipo);
      const { data, error } = await q;
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (accion === 'CREAR_PLANTILLA') {
      const tipo  = String(payload.tipo  || '').toUpperCase().trim();
      const texto = String(payload.texto || '').trim();
      if (!tipo)  throw new Error('Debe indicar el tipo de plantilla.');
      if (!texto) throw new Error('El texto de la plantilla no puede estar vacío.');
      const { data, error } = await supabaseClient
        .from('plantillas')
        .insert([{ tipo, texto }])
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    if (accion === 'ELIMINAR_PLANTILLA') {
      const id = Number(payload.id);
      if (!id) throw new Error('Se requiere el id de la plantilla.');
      const { error } = await supabaseClient
        .from('plantillas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // ── ORIGEN DE IMÁGENES (una o varias) ────────────────────────────────────
    // El payload puede traer `imagenes` (array), `fotos` (array) o un solo
    // `imagen`/`archivo`/`foto`. Se suben TODAS y se guardan en la BD
    // SEPARADAS POR COMA (mismo formato del legacy uploadArchivoAsync):
    //   soporte = "url1,url2,url3"
    const fuentesImg: any[] = Array.isArray(payload.imagenes)
      ? payload.imagenes
      : (Array.isArray(payload.fotos) ? payload.fotos : []);
    const imgDataSingle = payload.imagen || payload.archivo || payload.foto;
    if (imgDataSingle && imgDataSingle.base64 && !fuentesImg.some((i: any) => i && i.base64 === imgDataSingle.base64)) {
      fuentesImg.unshift(imgDataSingle);
    }

    const publicUrls: string[] = [];

    const options = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('es-CO', options);
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value || String(new Date().getFullYear());
    const month = parts.find(p => p.type === 'month')?.value || String(new Date().getMonth() + 1).padStart(2, '0');
    const day = parts.find(p => p.type === 'day')?.value || String(new Date().getDate()).padStart(2, '0');

    const folderRoot = (hoja?.toUpperCase() === 'REPORTES' || payload.id_reporte) ? 'reportes' : 'novedades';
    const prodId = String(payload.productora || user?.user_metadata?.id_productora || '0').replace(/[^a-zA-Z0-9._-]/g, '_');

    for (const [idx, img] of fuentesImg.entries()) {
      if (!img || !img.base64) continue;
      const timestamp = Date.now() + idx; // timestamp único por foto
      const fileName = (img.fileName || 'upload.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folderRoot}/${prodId}/${year}/${month}/${day}/${timestamp}_${fileName}`;

      const contentType = img.mimeType || 'image/jpeg';
      try {
        await r2.send(new PutObjectCommand({
          Bucket:      R2_BUCKET,
          Key:         filePath,
          Body:        decode(img.base64),
          ContentType: contentType,
        }));
        if (!R2_PUBLIC_URL) {
          console.warn(`[R2] OJO: R2_PUBLIC_URL no configurado → en la BD solo se guardará la RUTA relativa (${filePath}). La imagen NO será visible hasta configurarlo.`);
        }
        publicUrls.push(R2_PUBLIC_URL
          ? `${R2_PUBLIC_URL.replace(/\/$/, "")}/${filePath}`
          : filePath);
        console.log(`[R2] Subido: ${filePath}`);
      } catch (r2Err: any) {
        console.error("[R2] Error:", r2Err?.message);
        // ── Fallback: subir a Supabase Storage para no perder la evidencia ──
        try {
          const base64Clean = String(img.base64).includes(',')
            ? String(img.base64).split(',')[1]
            : img.base64;
          const { error: upErr } = await supabaseClient.storage
            .from('novedades-imagenes')
            .upload(filePath, decode(base64Clean), { contentType, upsert: true });
          if (upErr) throw upErr;
          const { data: pubData } = supabaseClient.storage
            .from('novedades-imagenes')
            .getPublicUrl(filePath);
          const urlFallback = pubData?.publicUrl || filePath;
          publicUrls.push(urlFallback);
          console.warn(`[R2] Fallback Supabase Storage OK: ${urlFallback}`);
        } catch (fbErr: any) {
          throw new Error(
            `Error al subir imagen a R2: ${r2Err?.message ?? "desconocido"}` +
            (fbErr?.message ? ` | Fallback Storage: ${fbErr.message}` : "")
          );
        }
      }
    }

    const soporteUrls = publicUrls.join(',');

    let result: any = { success: false, message: "" };

    // ── 3. MANEJO DE ACCIONES DE FORMULARIOS ──
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

        // Consecutivo del reporte de calidad: REP{YYYYMMDD}-{COUNT}
        // (ej: REP20260909-2).
        //
        // SIN reinicios: el COUNT es un consecutivo SIEMPRE CRECIENTE a nivel
        // global (REP20260909-1, REP20260909-2, … y al día siguiente continúa
        // REP20260910-3, nunca vuelve a 1). Por eso el cálculo se hace vía
        // SELECT sobre TODOS los id_reporte existentes (máximo numérico + 1),
        // no solo los del día.
        //
        // Nota: SEQUENCE (nextval/currval/setval) es la herramienta nativa y
        // vigente de PostgreSQL 18 para numeración atómica; aquí NO se usa
        // porque se pidió explícitamente que el número NO se genere con una
        // secuencia PostgreSQL (SEQUENCE).
        const pad = (n: number) => String(n).padStart(2, '0');
        const bogotaDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
        const ymd = `${bogotaDate.getFullYear()}${pad(bogotaDate.getMonth() + 1)}${pad(bogotaDate.getDate())}`;

        // Escanear TODOS los id_reporte (formato actual y legacy) y tomar el
        // sufijo numérico más alto registrado → consecutivo global creciente.
        const { data: repRows } = await supabaseClient
          .from("reportes")
          .select("id_reporte")
          .ilike("id_reporte", "REP%");
        let maxCount = 0;
        for (const r of repRows || []) {
          const match = /(\d+)$/.exec(String(r.id_reporte || ""));
          if (!match) continue;
          const n = Number(match[1]);
          if (!Number.isNaN(n) && n > maxCount) maxCount = n;
        }
        const idReporte = `REP${ymd}-${maxCount + 1}`;
        const fechaBogota = new Date().toISOString();

        const insertRow: any = {
          id_reporte: idReporte,
          fecha: fechaBogota,
          op: payload.lote || payload.op,
          referencia: payload.referencia || "",
          cantidad: Number(payload.cantidadTotal || payload.cantidad || 0),
          planta: payload.planta || "",
          correo: payload.email || payload.correo || user?.email || "",
          auditor: auditorName,
          localizacion: normalizeLocalizacion(payload.gps ?? payload.localizacion),
          tipo_visita: payload.tipoVisita || "AUDITORIA",
          conclusion: payload.conclusion || "APROBADO",
          observaciones: payload.observaciones || "",
          soporte: soporteUrls || payload.soporte || "",
          firma_svg: payload.firma || "",
          destino_proceso: payload.destinoProceso || "",
          destino_planta: payload.destinoPlanta || "",
          novedades_auditoria: normalizeNovedades(payload.novedadesAsociadas || payload.novedades_auditoria),
          avance: payload.avanceProduccion || 0,
          id_productora: Number(payload.idProductora || payload.productora) || 1,
          productora: payload.nombreProductora || payload.productoraNombre || "",
          proceso_anterior: payload.procesoAnterior || payload.proceso_anterior || null,
          compromiso: payload.compromisoRonda || payload.compromiso || null,
          paqueteo: payload.paqueteo || null,
          etiqueta: payload.ubicacionEtiqueta || payload.etiqueta || null,
          cita: payload.cita || null,
          // ── SOLO columnas que EXISTEN en `reportes` (confirmadas en la fila devuelta) ──
          linea: payload.linea || payload.cuento || payload.modulo || "",
          proceso: payload.proceso || "",
          prenda: payload.prenda || payload.tipoPrenda || payload.descripcion || "",
          genero: payload.genero || "",
          salida: payload.salida || payload.fechaSalida || payload.fecha_salida || null,
          entrada: payload.entrada || payload.fechaEntrega || payload.fecha_entrega || null
        };

        console.log(
          "[FORMULARIOS] REPORTE_CALIDAD insertRow → novedades_auditoria:",
          insertRow.novedades_auditoria
        );

        // Insert robusto: si una columna no existe en la BD (esquema cambiante),
        // reintentar con el set MÍNIMO garantizado para no perder el reporte.
        const insertWith = async (row: any) => {
          return supabaseClient.from("reportes").insert([row]).select().single();
        };

        let { data: repData, error: repError } = await insertWith(insertRow);

        if (repError) {
          console.warn("[FORMULARIOS] Error insertando reporte, reintento con set mínimo:", repError);
          const minimalRow: any = {
            id_reporte: idReporte,
            fecha: fechaBogota,
            op: payload.lote || payload.op,
            referencia: payload.referencia || "",
            cantidad: Number(payload.cantidadTotal || payload.cantidad || 0),
            planta: payload.planta || "",
            correo: payload.email || payload.correo || user?.email || "",
            auditor: auditorName,
            localizacion: normalizeLocalizacion(payload.gps ?? payload.localizacion),
            tipo_visita: payload.tipoVisita || "AUDITORIA",
            conclusion: payload.conclusion || "APROBADO",
            observaciones: payload.observaciones || "",
            soporte: soporteUrls || payload.soporte || "",
            firma_svg: payload.firma || "",
            destino_proceso: payload.destinoProceso || "",
            destino_planta: payload.destinoPlanta || "",
            novedades_auditoria: normalizeNovedades(payload.novedadesAsociadas || payload.novedades_auditoria),
            avance: payload.avanceProduccion || 0,
            id_productora: Number(payload.idProductora || payload.productora) || 1,
            productora: payload.nombreProductora || payload.productoraNombre || "",
            proceso_anterior: payload.procesoAnterior || payload.proceso_anterior || null,
            compromiso: payload.compromisoRonda || payload.compromiso || null,
            paqueteo: payload.paqueteo || null,
            etiqueta: payload.ubicacionEtiqueta || payload.etiqueta || null,
            cita: payload.cita || null
          };
          const retry = await insertWith(minimalRow);
          repData = retry.data;
          repError = retry.error;
        }

        if (repError) {
          console.warn("[FORMULARIOS] Error insertando reporte en BD:", repError);
        }

// ────────────────────────────────────────────────────────────────
// Buscar el correo REAL de la planta en la tabla `plantas`

        try {
          const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/emails`;
          const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

          // ── Buscar correo REAL en tabla `plantas` ──────────────────
          // NO usar payload.email como fallback — ese es el correo del auditor
          let plantaEmail: string = "";
          const plantaNombre: string = (payload.planta || "").trim();
          const idProductora: string = String(payload.idProductora || payload.id_productora || payload.productora || "").trim();

          console.log(`[REPORTE_CALIDAD] Buscando planta: nombre="${plantaNombre}" | idProductora="${idProductora}"`);

          try {
            // Buscar por nombre de planta primero (match exacto), luego por id_productora
            let plantaQuery = supabaseClient.from("plantas").select("correo, planta");
            if (plantaNombre) {
              plantaQuery = plantaQuery.eq("planta", plantaNombre);
            } else if (idProductora) {
              plantaQuery = plantaQuery.eq("productora", idProductora);
            } else {
              console.warn("[REPORTE_CALIDAD] Sin nombre ni idProductora — no se puede buscar planta");
            }
            const { data: plantaData, error: plantaError } = await plantaQuery.limit(1).single();

            console.log(`[REPORTE_CALIDAD] Resultado plantas BD:`, JSON.stringify(plantaData), "| error:", plantaError?.message);

            if (plantaError) {
              console.warn("[REPORTE_CALIDAD] No se encontró la planta en BD:", plantaError.message);
            } else if (plantaData?.correo) {
              plantaEmail = plantaData.correo.trim();
              console.log(`[REPORTE_CALIDAD] ✅ Correo encontrado: ${plantaEmail}`);
            } else {
              console.warn(`[REPORTE_CALIDAD] ⚠️ La planta "${plantaNombre}" no tiene correo registrado`);
            }
          } catch (plantaErr) {
            console.warn("[REPORTE_CALIDAD] Error consultando tabla plantas:", plantaErr);
          }

          // Si no hay correo de la planta → NO enviar email
          if (!plantaEmail) {
            console.warn(`[REPORTE_CALIDAD] Sin correo de planta — email omitido para: "${plantaNombre}"`);
          } else {
            console.log(`[REPORTE_CALIDAD] Enviando email a planta: ${plantaEmail}`);
            console.log(`[REPORTE_CALIDAD] Email URL: ${emailUrl}`);

            const emailRes = await fetch(emailUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceRole}`
              },
              body: JSON.stringify({
                accion: 'REPORTE_CALIDAD',
                email: plantaEmail,
                nombre: payload.planta || payload.nombre || 'Productora',
                reporte: {
                  // 1) Campos DB (snake_case) del insertRow — fuente de verdad
                  ...insertRow,
                  // 2) Campos originales del frontend (camelCase) — fallback
                  ...payload,
                  // 3) Campos calculados/obligatorios que siempre deben estar presentes
                  id_reporte: idReporte,
                  ID_REPORTE: idReporte,
                  fecha: fechaBogota,
                  auditor: auditorName,
                  auditor_nombre: auditorName,
                  chat_url: chatUrl,
                  // Campos clave en ambas convenciones para máxima compatibilidad
                  cantidad: insertRow.cantidad,
                  cantidadTotal: insertRow.cantidad,
                  destino_proceso: insertRow.destino_proceso,
                  destinoProceso: insertRow.destino_proceso,
                  destino_planta: insertRow.destino_planta,
                  destinoPlanta: insertRow.destino_planta,
                  novedades_auditoria: insertRow.novedades_auditoria,
                  novedadesAsociadas: insertRow.novedades_auditoria,
                  tipo_visita: insertRow.tipo_visita,
                  tipoVisita: insertRow.tipo_visita
                }
              })
            });

            const emailData = await emailRes.json();
            console.log(`[REPORTE_CALIDAD] Email response:`, emailData);

            if (!emailRes.ok) {
              console.error(`[REPORTE_CALIDAD] Error enviando email:`, emailData);
            } else {
              console.log(`[REPORTE_CALIDAD] ✅ Email enviado exitosamente a ${plantaEmail}`);
            }
          } // fin else plantaEmail
        } catch (emailErr) {
          console.error(`[REPORTE_CALIDAD] Error en envío de email:`, emailErr);
          // No bloquear el insert si falla el email
        }


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
        const hojaUpper = (hoja || '').toUpperCase();

        if (hojaUpper === 'NOVEDADES') {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const bogotaDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
          const ymd = `${bogotaDate.getFullYear()}${pad(bogotaDate.getMonth() + 1)}${pad(bogotaDate.getDate())}`;
          const fechaBogota = `${bogotaDate.getFullYear()}-${pad(bogotaDate.getMonth() + 1)}-${pad(bogotaDate.getDate())}T${pad(bogotaDate.getHours())}:${pad(bogotaDate.getMinutes())}:${pad(bogotaDate.getSeconds())}.${String(now.getMilliseconds()).padStart(3, '0')}-05:00`;
          
          const prodId = Number(payload.idProductora || payload.productora) || 1;

          // Consecutivo propio de NOVEDADES (NOV), INDEPENDIENTE del de
          // REPORTES (REP); cada tabla lleva su propio correlativo creciente:
          //   NOV{YYYYMMDD}-{COUNT}  (ej: NOV20260909-2)
          // SIN reinicios: COUNT = máximo sufijo numérico global en la tabla
          // `novedades` + 1. NO se usa SEQUENCE PostgreSQL (por requerimiento).
          const { data: novRows, error: novRowsError } = await supabaseClient
            .from("novedades")
            .select("id_novedad")
            .ilike("id_novedad", "NOV%");
          console.log("[NOVEDADES] SELECT id_novedad rows:", novRows, "error:", novRowsError);
          let maxNovedad = 0;
          for (const r of novRows || []) {
            const num = /(\d+)$/.exec(String(r.id_novedad || ""));
            if (!num) continue;
            const n = Number(num[1]);
            if (!Number.isNaN(n) && n > maxNovedad) maxNovedad = n;
          }
          const idNovedad = `NOV${ymd}-${maxNovedad + 1}`;
          console.log("[NOVEDADES] id_novedad calculado:", idNovedad, "maxNovedad:", maxNovedad);
          
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
            op: Number(payload.lote || payload.op || payload.id) || 0,
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
            imagen: soporteUrls || payload.imagen || '',
            estado: 'PENDIENTE',
            id_productora: prodId,
            productora: payload.nombreProductora || payload.productoraNombre || '',
            auditor: payload.auditor || user?.user_metadata?.nombre || user?.email || '',
            correo: payload.email || payload.correo || user?.email || '',
            comentarios: payload.comentarios || ''
          };

          console.log("[NOVEDADES] INSERT novRow.id_novedad:", novRow.id_novedad);
          const { data: novData, error: novError } = await supabaseClient
            .from('novedades')
            .insert([novRow])
            .select()
            .single();

          console.log("[NOVEDADES] INSERT result → novData.id_novedad:", novData?.id_novedad, "error:", novError);
          if (novError) throw novError;

          const finalId = novData?.id_novedad || idNovedad;
          result = {
            success: true,
            message: `Novedad ${finalId} registrada exitosamente.`,
            id_novedad: finalId,
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
    console.error(`[FORMULARIOS ERROR]`, error.message);
    return new Response(JSON.stringify({
      success: false,
      message: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
