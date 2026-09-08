import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const BUCKET_NAME = 'novedades-imagenes';

// Rate limiting
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_SEARCH_PER_MINUTE = 30;
const rateLimitMap = new Map();
const searchRateLimitMap = new Map();

// Configuración de notificaciones (GAS)
const GAS_NOTIF_URL = 'https://script.google.com/macros/s/AKfycbw7PEB7D9TP_wDlzJtwKCJmxwUYguXyniYPb_vRAadPHpy7gDWG26fn0wRowI_mre9V/exec';

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + 3600000
    });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_PER_HOUR) {
    return false;
  }
  
  record.count++;
  return true;
}

function checkSearchRateLimit(ip) {
  const now = Date.now();
  const record = searchRateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    searchRateLimitMap.set(ip, {
      count: 1,
      resetTime: now + 60000
    });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_SEARCH_PER_MINUTE) {
    return false;
  }
  
  record.count++;
  return true;
}

function sanitizeString(str, maxLength = 500) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '');
}

function validateOP(op) {
  return /^[0-9]+$/.test(op) && op.length > 0 && op.length < 20;
}

function validateArea(area) {
  const validAreas = ['INSUMOS', 'CORTE', 'TELAS', 'CODIGOS', 'DISEÑO', 'OTROS'];
  return validAreas.includes(area);
}

function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 100;
}

async function notificarGuest(supabase, idNovedad, dataNotif, novedadData?: any) {
  try {
    console.log(`[NOTIF] Notificando Guest para ${idNovedad}...`);
    console.log(`[NOTIF] Datos de notificación:`, dataNotif);

    let nov = novedadData;

    // Si no se proporcionan datos, buscar en la base de datos
    if (!nov) {
      const { data: novData, error: errN } = await supabase
        .from('novedades')
        .select('planta, id, referencia, productora')
        .eq('id_novedad', idNovedad)
        .single();

      if (errN || !novData) {
        console.warn(`[NOTIF] No se encontró reporte ${idNovedad}`);
        return;
      }
      nov = novData;
    }

    // Buscar el email de la planta
    const { data: plant, error: errP } = await supabase
      .from('plantas')
      .select('correo, planta')
      .eq('planta', nov.planta)
      .eq('productora', nov.productora)
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

    const payload = {
      ...dataNotif,
      email: plant.correo,
      nombre: plant.planta,
      idNovedad: idNovedad,
      lote: nov.lote,
      referencia: nov.referencia,
      cc: ccEmails
    };

    console.log(`[NOTIF] Payload completo a enviar:`, payload);

    await fetch(GAS_NOTIF_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    console.log(`[NOTIF] Notificación enviada exitosamente`);
  } catch (e) {
    console.error("[NOTIF] Error:", e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVIDOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normaliza fechas de DD/MM/YYYY a YYYY-MM-DD para PostgreSQL
 */
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
  // Manejar preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const url = new URL(req.url);
  
  console.log(`[REQUEST] IP: ${clientIP}, Method: ${req.method}, Path: ${url.pathname}`);

  try {
    // Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ═══════════════════════════════════════════════════════════
    // ENDPOINT GET: BUSCAR OP EN BUSINT
    // ═══════════════════════════════════════════════════════════
    
    if (req.method === "GET") {
      // Rate limiting para búsquedas
      if (!checkSearchRateLimit(clientIP)) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Demasiadas búsquedas. Intente nuevamente en un minuto."
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 429,
          }
        );
      }

      const op = url.searchParams.get('op');
      const plantaId = url.searchParams.get('plantaId');
      
      // ═══════════════════════════════════════════════════════════
      // NUEVO: BUSCAR POR ID DE PLANTA (CÉDULA)
      // ═══════════════════════════════════════════════════════════
      if (plantaId) {
        console.log('[SEARCH] Buscando planta por ID:', plantaId);
        
        // 1. Obtener datos de la planta
        const { data: plantaRecord, error: plantaError } = await supabaseClient
          .from('PLANTAS')
          .select('PLANTA, EMAIL')
          .eq('ID_PLANTA', plantaId)
          .maybeSingle();

        if (plantaError || !plantaRecord) {
          console.log('[SEARCH] Planta no encontrada:', plantaId);
          return new Response(
            JSON.stringify({
              success: false,
              message: "Identificación de planta no encontrada."
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404,
            }
          );
        }

        // 2. Buscar OPs asociadas en master
        console.log('[SEARCH] Buscando OPs para planta:', plantaRecord.PLANTA);
        const { data: opsData, error: opsError } = await supabaseClient
          .from('master')
          .select('id_master, referencia, cantidad, descripcion, fecha_salida, proceso, cuento, genero')
          .eq('nombre_planta', plantaRecord.PLANTA)
          .order('id_master', { ascending: false })
          .limit(30);

        if (opsError) throw opsError;

        return new Response(
          JSON.stringify({
            success: true,
            planta: plantaRecord.PLANTA,
            email: plantaRecord.EMAIL,
            needsEmail: !plantaRecord.EMAIL || plantaRecord.EMAIL.trim() === '',
            ops: (opsData || []).map(record => ({
              OP:         sanitizeString(record.id_master, 50),
              referencia: sanitizeString(record.referencia || '', 100),
              cantidad:   parseInt(record.cantidad) || 0,
              prenda:     sanitizeString(record.descripcion || '', 100),
              salida:     sanitizeString(record.fecha_salida || '', 50),
              proceso:    sanitizeString(record.proceso || '', 100),
              linea:      sanitizeString(record.cuento || '', 50),
              genero:     sanitizeString(record.genero || '', 50),
              planta:     plantaRecord.PLANTA
            }))
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // ═══════════════════════════════════════════════════════════
      // BUSCAR OP DIRECTA
      // ═══════════════════════════════════════════════════════════
      if (!op) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Identificación de planta o número de OP requerido"
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      // Validar formato de OP
      if (!validateOP(op)) {
        return new Response(
          JSON.stringify({ success: false, message: "Número de OP inválido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      console.log('[SEARCH] Buscando OP en master:', op);
      const opNum = parseInt(op);
      const query = supabaseClient.from('master').select('*');
      if (!isNaN(opNum)) query.or(`id_master.eq.${op},id_master.eq.${opNum}`);
      else query.eq('id_master', op);

      const { data: busintData, error: busintError } = await query;

      if (busintError) throw busintError;

      if (!busintData || busintData.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: `No se encontró información para la OP: ${op}`, found: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Obtener nombres de productoras
      const prodIds = [...new Set(busintData.map((r: any) => r.productora).filter(Boolean))];
      const productorasMap = new Map();
      if (prodIds.length > 0) {
        const { data: prodRows } = await supabaseClient
          .from('productoras')
          .select('id_productora, productora')
          .in('id_productora', prodIds);
        
        if (prodRows) {
          prodRows.forEach((p: any) => {
            productorasMap.set(String(p.id_productora), p.productora);
          });
        }
      }

      const results = [];
      for (const record of busintData) {
        const opData = {
          OP:         sanitizeString(record.id_master  || op,  50),
          referencia: sanitizeString(record.referencia || '', 100),
          cantidad:   parseInt(record.cantidad)        || 0,
          planta:     sanitizeString(record.nombre_planta || '', 100),
          salida:     sanitizeString(record.fecha_salida || '',  50),
          proceso:    sanitizeString(record.proceso    || '', 100),
          prenda:     sanitizeString(record.descripcion || '', 100),
          linea:      sanitizeString(record.cuento     || '',  50),
          genero:     sanitizeString(record.genero     || '',  50),
          productora: record.productora ? String(record.productora) : null,
          nombre_productora: record.productora ? sanitizeString(productorasMap.get(String(record.productora)) || '', 100) : ''
        };

        // Verificar email, telefono y nit/cédula de la planta
        let needsEmail = false;
        let needsDetails = false;
        let currentEmail = null;
        let currentPhone = null;
        let currentIdPlanta = null;
        if (opData.planta) {
          const { data: pData } = await supabaseClient
            .from('plantas')
            .select('correo, telefono, id_planta')
            .eq('planta', opData.planta)
            .eq('productora', record.productora)
            .maybeSingle();

          if (pData) {
            currentEmail = pData.correo;
            currentPhone = pData.telefono;
            currentIdPlanta = pData.id_planta;
            needsEmail = !pData.correo || pData.correo.trim() === '';
            needsDetails = needsEmail || !pData.telefono || !pData.id_planta;
          } else {
            needsEmail = true;
            needsDetails = true; // No existe la planta en absoluto!
          }
        }

        results.push({
          data: opData,
          needsEmail,
          needsDetails,
          currentEmail,
          currentPhone,
          currentIdPlanta
        });
      }

      if (results.length === 1) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "OP encontrada", 
            found: true, 
            multiple: false, 
            data: results[0].data, 
            needsEmail: results[0].needsEmail, 
            needsDetails: results[0].needsDetails,
            currentEmail: results[0].currentEmail,
            currentPhone: results[0].currentPhone,
            currentIdPlanta: results[0].currentIdPlanta
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "OP encontrada en múltiples plantas", 
            found: true, 
            multiple: true, 
            ops: results 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ENDPOINT POST: CREAR NOVEDAD O ACTUALIZAR EMAIL
    // ═══════════════════════════════════════════════════════════
    
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Método no permitido. Use GET para buscar OP o POST para crear novedad."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }

    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Límite de solicitudes excedido. Intente nuevamente en una hora."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    // Obtener payload
    const payload = await req.json();
    
    console.log('[PAYLOAD] Recibido:', {
      hasImage: !!payload.imagen,
      OP: payload.OP,
      area: payload.area,
      soloActualizarEmail: payload._soloActualizarEmail
    });

    // ═══════════════════════════════════════════════════════════
    // MODO ESPECIAL: SOLO ACTUALIZAR/CREAR PLANTA
    // ═══════════════════════════════════════════════════════════

    if (payload._soloActualizarPlanta) {
      console.log('[PLANTA_UPDATE] Modo actualización/creación de planta');
      
      const idPlanta = String(payload.id_planta || '').trim();
      const plantaName = String(payload.planta || '').trim();
      const correo = String(payload.correo || '').trim();
      const telefono = String(payload.telefono || '').trim();
      const productora = parseInt(payload.productora) || null;

      if (!idPlanta) throw new Error("ID (Cédula o NIT) es requerido");
      if (!plantaName) throw new Error("Nombre del taller es requerido");
      if (!correo || !validateEmail(correo)) throw new Error("Correo es requerido y debe ser válido");
      if (!telefono) throw new Error("Teléfono es requerido");

      // upsert en la tabla 'plantas'
      const newPlantData = {
        id_planta: idPlanta,
        planta: plantaName,
        correo: correo,
        telefono: telefono,
        rol: 'GUEST',
        productora: productora
      };

      console.log('[PLANTA_UPDATE] Upserteando planta:', newPlantData);
      
      const { error: upsertError } = await supabaseClient
        .from('plantas')
        .upsert([newPlantData]);

      if (upsertError) {
        console.error('[PLANTA_UPDATE] Error en upsert:', upsertError);
        throw new Error(`Error al actualizar taller: ${upsertError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Taller actualizado exitosamente en la base de datos",
          data: newPlantData
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // MODO ESPECIAL: SOLO ACTUALIZAR EMAIL
    // ═══════════════════════════════════════════════════════════
    
    if (payload._soloActualizarEmail && payload.correo && payload.planta) {
      console.log('[EMAIL_UPDATE] Modo actualización de email solamente');
      
      const correoTrimmed = payload.correo.trim();
      
      if (!validateEmail(correoTrimmed)) {
        throw new Error("El correo electrónico proporcionado no es válido");
      }

      const plantaName = payload.planta;
      
      console.log('[EMAIL_UPDATE] Actualizando email para planta:', plantaName);
      
      // Verificar si la planta existe y si ya tiene email
      const { data: plantaExistente, error: plantaCheckError } = await supabaseClient
        .from('PLANTAS')
        .select('EMAIL, PLANTA')
        .eq('PLANTA', plantaName)
        .single();

      if (plantaCheckError) {
        console.warn('[EMAIL_UPDATE] No se encontró la planta:', plantaName);
        throw new Error(`No se encontró la planta: ${plantaName}`);
      }
      
      if (plantaExistente) {
        // Solo actualizar si no tiene email o si es diferente
        if (!plantaExistente.EMAIL || plantaExistente.EMAIL.trim() === '') {
          const { error: updateError } = await supabaseClient
            .from('PLANTAS')
            .update({ EMAIL: correoTrimmed })
            .eq('PLANTA', plantaName);

          if (updateError) {
            console.error('[EMAIL_UPDATE] Error al actualizar:', updateError);
            throw new Error('Error al actualizar el email');
          }
          
          console.log('[EMAIL_UPDATE] Email actualizado exitosamente');
          
          return new Response(
            JSON.stringify({
              success: true,
              message: "Email actualizado exitosamente",
              email: correoTrimmed
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          console.log('[EMAIL_UPDATE] La planta ya tiene email registrado');
          return new Response(
            JSON.stringify({
              success: true,
              message: "La planta ya tiene email registrado",
              email: plantaExistente.EMAIL
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDAR DATOS DEL FORMULARIO
    // ═══════════════════════════════════════════════════════════

    // Validar campos requeridos — campo es OP (no lote)
    if (!payload.OP || !validateOP(String(payload.OP))) {
      throw new Error("Número de OP inválido");
    }

    if (!payload.area || !validateArea(payload.area)) {
      throw new Error("Área inválida");
    }

    // Validar que la OP exista en master
    const opNumVal = parseInt(payload.OP);
    const prodVal = payload.productora ? parseInt(payload.productora) : null;
    const validationQuery = supabaseClient.from('master').select('id_master, referencia, cantidad, nombre_planta, productora');
    
    if (!isNaN(opNumVal)) {
      validationQuery.or(`id_master.eq.${payload.OP},id_master.eq.${opNumVal}`);
    } else {
      validationQuery.eq('id_master', String(payload.OP));
    }

    if (prodVal !== null && !isNaN(prodVal)) {
      validationQuery.eq('productora', prodVal);
    }

    const { data: busintDataValidation, error: busintErrorValidation } = await validationQuery.limit(1);

    if (busintErrorValidation) {
      console.error('[VALIDATION] Error en query master:', busintErrorValidation);
      throw busintErrorValidation;
    }

    if (!busintDataValidation || busintDataValidation.length === 0) {
      throw new Error(`No se encontró la OP ${payload.OP} para la productora seleccionada`);
    }

    const busintRecord = busintDataValidation[0];
    console.log('[VALIDATION] OP encontrada en master:', busintRecord.id_master, 'Productora:', busintRecord.productora);

    // ═══════════════════════════════════════════════════════════
    // ACTUALIZAR EMAIL DE LA PLANTA (SI SE PROPORCIONA)
    // ═══════════════════════════════════════════════════════════

    if (payload.correo) {
      const correoTrimmed = payload.correo.trim();
      
      if (!validateEmail(correoTrimmed)) {
        throw new Error("El correo electrónico proporcionado no es válido");
      }

      const plantaName = payload.planta || busintRecord.NombrePlanta;

      if (plantaName) {
        console.log('[EMAIL] Actualizando email para planta:', plantaName);

        const { data: plantaExistente, error: plantaCheckError } = await supabaseClient
          .from('PLANTAS')
          .select('EMAIL, PLANTA')
          .eq('PLANTA', plantaName)
          .eq('PRODUCTORA', busintRecord.productora)
          .single();

        if (plantaCheckError) {
          console.warn('[EMAIL] No se encontró la planta:', plantaName);
        } else if (plantaExistente) {
          if (!plantaExistente.EMAIL || plantaExistente.EMAIL.trim() === '') {
            const { error: updateError } = await supabaseClient
              .from('PLANTAS')
              .update({ EMAIL: correoTrimmed })
              .eq('PLANTA', plantaName);

            if (updateError) {
              console.error('[EMAIL] Error al actualizar:', updateError);
              // No lanzar error — no queremos que falle la novedad por esto
            } else {
              console.log('[EMAIL] Email actualizado exitosamente');
            }
          } else {
            console.log('[EMAIL] La planta ya tiene email registrado, no se actualiza');
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PROCESAR IMAGEN (SI EXISTE)
    // ═══════════════════════════════════════════════════════════

    let imagenUrl = '';

    if (payload.imagen && payload.imagen.base64) {
      console.log('[IMAGE] Procesando imagen...');
      
      const imgData = payload.imagen;
      
      // Validar tipo MIME
      if (!ALLOWED_MIME_TYPES.includes(imgData.mimeType)) {
        throw new Error(`Tipo de imagen no permitido: ${imgData.mimeType}`);
      }

      // Decodificar base64
      const base64Data = imgData.base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const fileBlob = new Blob([bytes], { type: imgData.mimeType });

      // Validar tamaño
      if (fileBlob.size > MAX_FILE_SIZE) {
        throw new Error(`Imagen muy grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      if (fileBlob.size === 0) {
        throw new Error("La imagen está vacía");
      }

      // Generar nombre único y seguro con estructura de carpetas por fecha
      // Obtener fecha en la zona horaria de Colombia (America/Bogota) para evitar desfases UTC
      const options = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
      const formatter = new Intl.DateTimeFormat('es-CO', options);
      const parts = formatter.formatToParts(new Date());
      const year = parts.find(p => p.type === 'year')?.value || String(new Date().getFullYear());
      const month = parts.find(p => p.type === 'month')?.value || String(new Date().getMonth() + 1).padStart(2, '0');
      const day = parts.find(p => p.type === 'day')?.value || String(new Date().getDate()).padStart(2, '0');
      
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const sanitizedFileName = (imgData.fileName || 'upload.jpg')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 50);
      
      const uniqueFileName = `novedad_${timestamp}_${randomStr}_${sanitizedFileName}`;
      // Estructura: public/ID_PRODUCTORA/YYYY/MM/DD/archivo.jpg
      const prodId = payload.productora || 'public';
      const filePath = `public/${prodId}/${year}/${month}/${day}/${uniqueFileName}`;

      console.log('[IMAGE] Subiendo:', {
        fileName: uniqueFileName,
        size: `${(fileBlob.size / 1024).toFixed(2)} KB`,
        mimeType: imgData.mimeType
      });

      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBlob, {
          contentType: imgData.mimeType,
          upsert: false,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('[IMAGE ERROR]', uploadError);
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabaseClient
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      imagenUrl = publicUrl;
      console.log('[IMAGE] Subida exitosa:', imagenUrl);
    }

    // ═══════════════════════════════════════════════════════════
    // PREPARAR DATOS PARA INSERTAR
    // ═══════════════════════════════════════════════════════════

    const idNovedad = "NOV-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();

    const novedadData = {
      id_novedad:          idNovedad,
      fecha:               new Date().toISOString(),
      id:                  parseInt(payload.OP) || 0,
      referencia:          sanitizeString(payload.referencia || busintRecord.referencia, 100),
      cantidad:            parseInt(payload.cantidad) || busintRecord.cantidad || 0,
      planta:              sanitizeString(payload.planta || busintRecord.nombre_planta, 100),
      salida:              normalizeDate(payload.salida), // Normalizado para Postgres
      cuento:              sanitizeString(payload.linea, 50),
      proceso:             sanitizeString(payload.proceso, 100),
      prenda:              sanitizeString(payload.prenda, 100),
      genero:              sanitizeString(payload.genero, 50),
      area:                sanitizeString(payload.area, 50),
      tipo_novedad:        sanitizeString(payload.tipoNovedad, 50) || null,
      tipo_detalle:        payload.tipoDetalle || null,
      descripcion:         sanitizeString(payload.descripcion, 1000),
      cantidad_solicitada: parseInt(payload.cantidadSolicitada) || 0,
      imagen:              imagenUrl,
      estado:              'PENDIENTE',
      chat:                null,
      chat_read:           null,
      historial_estados:   null,
      productora:          parseInt(payload.productora) || (busintRecord.productora ? parseInt(busintRecord.productora) : null)
    };

    console.log('[INSERT] Insertando novedad:', idNovedad);

    const { data: insertData, error: insertError } = await supabaseClient
      .from('novedades')
      .insert([novedadData])
      .select()
      .single();

    if (insertError) {
      console.error('[INSERT ERROR]', insertError);
      
      // Si falla la inserción y ya subimos imagen, intentar eliminarla
      if (imagenUrl) {
        try {
          const urlParts = imagenUrl.split(`${BUCKET_NAME}/`);
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabaseClient.storage.from(BUCKET_NAME).remove([filePath]);
            console.log('[CLEANUP] Imagen eliminada tras error de inserción');
          }
        } catch (e) {
          console.error('[CLEANUP ERROR]', e);
        }
      }
      
      throw new Error(`Error al guardar novedad: ${insertError.message}`);
    }

    console.log('[SUCCESS] Novedad creada:', insertData.id_novedad);

    // ═══════════════════════════════════════════════════════════
    // NOTIFICAR A LA PLANTA
    // ═══════════════════════════════════════════════════════════

    // Notificar de forma asíncrona (no bloquear respuesta)
    notificarGuest(supabaseClient, insertData.id_novedad, {
      accion: 'NOVEDAD_REGISTRADA'
    }, {
      planta: insertData.planta,
      lote: insertData.id,
      referencia: insertData.referencia,
      productora: insertData.productora
    }).catch(e => console.error('[NOTIF ERROR]', e));

    // ═══════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════

    return new Response(
      JSON.stringify({
        success: true,
        message: "Novedad registrada exitosamente",
        id: insertData.id_novedad,
        ID_NOVEDAD: insertData.id_novedad,
        imagenUrl: imagenUrl || null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[ERROR]', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Error al procesar la solicitud",
        error: error.toString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
