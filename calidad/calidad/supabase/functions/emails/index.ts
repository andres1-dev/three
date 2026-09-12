// ================================================================
// Edge Function: emails
// Gestión de notificaciones por email usando SendGrid
// Reemplaza la antigua implementación con Google Apps Script
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const GAS_URL = Deno.env.get("GAS_EMAIL_URL") ?? ""
const SENDER_NAME = Deno.env.get("SENDER_NAME") ?? "GRUPO TDM"

function getVal(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k]
    const lower = k.toLowerCase()
    if (obj[lower] !== undefined && obj[lower] !== null && obj[lower] !== "") return obj[lower]
    const upper = k.toUpperCase()
    if (obj[upper] !== undefined && obj[upper] !== null && obj[upper] !== "") return obj[upper]
  }
  return undefined
}

interface EmailPayload {
  accion?: string
  email?: string
  nombre?: string
  cc?: string[]
  idNovedad?: string
  lote?: string
  referencia?: string
  solucion?: string
  tipoCobro?: string
  reporte?: Record<string, any>
  [key: string]: any
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    let rawBody: any = await req.json()
    if (Array.isArray(rawBody)) {
      rawBody = rawBody[0] || {}
    }
    const payload: Record<string, any> = rawBody || {}
    const accion = String(getVal(payload, "accion", "ACCION", "action") || "").toUpperCase()
    const email = getVal(payload, "email", "EMAIL", "correo", "CORREO")
    const nombre = getVal(payload, "nombre", "NOMBRE", "planta", "PLANTA") || "Usuario"

    if (!email) throw new Error("Email es requerido")
    if (!accion) throw new Error("Acción es requerida")

    const idNovedad = getVal(payload, "idNovedad", "id_novedad", "idReporte", "id_reporte", "id", "ID") || "N/A"
    const lote = getVal(payload, "lote", "LOTE", "op", "OP", "id", "ID") || "N/A"
    const referencia = getVal(payload, "referencia", "REFERENCIA") || "N/A"
    const solucion = getVal(payload, "solucion", "SOLUCION") || ""
    const tipoCobro = String(getVal(payload, "tipoCobro", "tipo_cobro", "TIPO_COBRO") || "").toUpperCase()
    const cc = getVal(payload, "cc", "CC")

    let subject = ""
    let htmlBody = ""

    switch (accion) {
      case "NOVEDAD_REGISTRADA": {
        const fechaNov = getVal(payload, "fecha", "FECHA", "created_at")
        subject = `Novedad Registrada — ${idNovedad}`
        htmlBody = generateNotificationHTML({
          titulo: "Novedad Registrada",
          nombre,
          parrafos: [
            `el día <strong>${formatDatetimeES(fechaNov)}</strong> fue registrada en nuestro sistema una nueva novedad identificada con el radicado <span class="hl">${idNovedad}</span> correspondiente a la Orden de Producción <strong>${lote}</strong>, Referencia <strong>${referencia}</strong>. Nuestro equipo ya fue notificado y dará inicio al proceso de seguimiento y atención a la brevedad posible.`,
            `De acuerdo con nuestras políticas operativas, el Grupo TDM otorga un plazo máximo de <strong>24 horas o un día hábil</strong> a partir del despacho para reportar cualquier faltante o inconsistencia en el material recibido. Transcurrido dicho plazo sin notificación, la entrega se considerará recibida a conformidad y cualquier reclamación posterior podrá generar un cobro proporcional al valor de los artículos involucrados.`,
            `Si este registro no fue realizado por usted, si considera que se trata de un error o si tiene alguna duda sobre esta novedad, le invitamos a comunicarse de inmediato con nuestro equipo a través del <strong>chat de seguimiento</strong> disponible en el sistema. Estamos disponibles para brindarle toda la orientación necesaria dentro de nuestros horarios de atención de lunes a viernes de <strong>7:10 a.m. a 4:43 p.m.</strong>`
          ],
          botonTexto: "VER NOVEDAD",
          botonUrl: `https://andres1-dev.github.io/three/public/novedad-publica/seguimiento-publico.html?id=${idNovedad}`
        })
        break
      }

      case "CHAT_INICIADO": {
        const fechaChat = getVal(payload, "fecha", "FECHA", "created_at")
        subject = `Conversación Iniciada — ${idNovedad}`
        htmlBody = generateNotificationHTML({
          titulo: "Conversación Iniciada",
          nombre,
          parrafos: [
            `un agente del Grupo TDM ha iniciado una conversación el día <strong>${formatDatetimeES(fechaChat)}</strong> para atender y resolver las dudas relacionadas con la novedad <span class="hl">${idNovedad}</span> correspondiente a la Orden de Producción <strong>${lote}</strong>, Referencia <strong>${referencia}</strong>. Le invitamos a ingresar al sistema y atender esta conversación a la brevedad posible, su respuesta es fundamental para darle continuidad al proceso.`
          ],
          botonTexto: "IR AL CHAT",
          botonUrl: `https://andres1-dev.github.io/three/public/novedad-publica/seguimiento-publico.html?id=${idNovedad}`
        })
        break
      }

      case "CHAT_FINALIZADO": {
        const fechaFin = getVal(payload, "fecha", "FECHA", "created_at")
        subject = `Conversación Finalizada — ${idNovedad}`
        htmlBody = generateNotificationHTML({
          titulo: "Conversación Finalizada",
          nombre,
          parrafos: [
            `el día <strong>${formatDatetimeES(fechaFin)}</strong> fue cerrada y archivada la conversación que se mantenía activa para la novedad <span class="hl">${idNovedad}</span> correspondiente a la Orden de Producción <strong>${lote}</strong>, Referencia <strong>${referencia}</strong>. Si en algún momento surge una nueva inquietud, le invitamos a reportarla directamente en el sistema.`
          ],
          botonTexto: "VER REPORTE",
          botonUrl: `https://andres1-dev.github.io/three/public/novedad-publica/seguimiento-publico.html?id=${idNovedad}`
        })
        break
      }

      case "NOVEDAD_FINALIZADA_CON_SOLUCION": {
        const fechaSol = getVal(payload, "fecha", "FECHA", "created_at")
        const esCobro = tipoCobro === "TALLER"
        const tipoSolucion = esCobro ? "COBRO" : "INTERNA"
        subject = `Resolución de Novedad — ${idNovedad}`
        htmlBody = generateNotificationHTML({
          titulo: "Resolución de Novedad",
          nombre,
          parrafos: [
            `nos complace informarle que el día <strong>${formatDatetimeES(fechaSol)}</strong> nuestro equipo de calidad y producción ha finalizado el proceso de atención y resolución de la novedad <span class="hl">${idNovedad}</span> correspondiente a la Orden de Producción <strong>${lote}</strong>, Referencia <strong>${referencia}</strong>.`,
            `<strong>Solución:</strong> <span class="estado">${tipoSolucion}</span>`,
            `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:16px;margin-top:12px;font-size:14px;line-height:1.7;color:#475569;">${solucion || "Sin detalles adicionales."}</div>`,
            `Agradecemos su colaboración durante todo el proceso. Si tiene alguna duda o requiere información adicional, puede comunicarse con nosotros a través del sistema o directamente con nuestro equipo de atención.`
          ],
          botonTexto: "VER REPORTE COMPLETO",
          botonUrl: `https://andres1-dev.github.io/three/public/novedad-publica/seguimiento-publico.html?id=${idNovedad}`
        })
        break
      }

      case "REPORTE_CALIDAD": {
        let rawReporte = payload.reporte || payload
        if (Array.isArray(rawReporte)) {
          rawReporte = rawReporte[0] || {}
        }
        const reporte = rawReporte || {}

        const rTipoVisita = String(getVal(reporte, "tipo_visita", "tipoVisita", "TIPO_VISITA") || "RONDA").toUpperCase()
        const rTipoLabel = rTipoVisita === "AUDITORIA" ? "Auditoría" :
                          rTipoVisita === "RONDA" ? "Ronda" :
                          rTipoVisita === "CONTRAMUESTRA" ? "Contramuestra" :
                          rTipoVisita === "SEGUIMIENTO" ? "Seguimiento" : rTipoVisita

        const rIdReporte = getVal(reporte, "id_reporte", "ID_REPORTE", "idReporte", "id", "ID") || "N/A"
        const rOp = getVal(reporte, "op", "OP", "lote", "LOTE") || "N/A"
        const rReferencia = getVal(reporte, "referencia", "REFERENCIA") || "N/A"
        const rConclusion = String(getVal(reporte, "conclusion", "CONCLUSION") || "N/A").toUpperCase()
        const rLinea = getVal(reporte, "linea", "LINEA") || ""
        const rProductora = getVal(reporte, "productora", "nombreProductora", "PRODUCTORA") || ""
        // cantidad: buscar primero cantidadTotal (frontend camelCase), luego cantidad (DB snake_case)
        // IMPORTANTE: NO usar getVal aquí para evitar que "0" string sea ignorado.
        // getVal excluye "", pero no "0". Sin embargo para seguridad extraemos explícitamente:
        const _rawCant = reporte["cantidadTotal"] ?? reporte["cantidad"] ?? reporte["CANTIDAD"] ?? reporte["unidades"] ?? null
        const rCantidad = (_rawCant !== null && _rawCant !== undefined && String(_rawCant) !== "") ? String(_rawCant) : "0"
        const rProceso = getVal(reporte, "proceso", "PROCESO") || "N/A"
        const rPrenda = getVal(reporte, "prenda", "PRENDA", "tipoPrenda") || ""
        const rGenero = getVal(reporte, "genero", "GENERO") || ""
        const rObservaciones = getVal(reporte, "observaciones", "OBSERVACIONES") || "Sin observaciones adicionales."
        const rDestinoProceso = getVal(reporte, "destino_proceso", "destinoProceso", "DESTINO_PROCESO") || ""
        const rDestinoPlanta = getVal(reporte, "destino_planta", "destinoPlanta", "DESTINO_PLANTA") || ""
        const rAuditor = getVal(reporte, "auditor_nombre", "auditor", "AUDITOR") || "Calidad TDM"
        const rPlanta = getVal(reporte, "planta", "PLANTA", "productora") || nombre || "Taller"
        const rChatUrl = getVal(reporte, "chat_url", "chatUrl") || "https://andres1-dev.github.io/three/public/novedades/"
        const rFechaRaw = getVal(reporte, "fecha", "FECHA", "created_at", "fecha_creacion")

        subject = `Reporte de ${rTipoLabel} — OP ${rOp} / Ref. ${rReferencia}`

        const isAprobRC = (rConclusion.indexOf("APROB") !== -1) || (rConclusion.indexOf("SATIS") !== -1)
        const isRechazRC = rConclusion.indexOf("RECHAZ") !== -1
        const badgeColorRC = isAprobRC ? "#10b981" : (isRechazRC ? "#ef4444" : "#f59e0b")

        const rTipoArticulo = (rTipoVisita === "AUDITORIA" || rTipoVisita === "RONDA" || rTipoVisita === "CONTRAMUESTRA") ? "una" : "un"

        const p1 = `Nos permitimos informarle que el día <strong>${formatDatetimeES(rFechaRaw)}</strong> fue generado satisfactoriamente ${rTipoArticulo} <strong>${rTipoLabel} de Calidad</strong>, identificado bajo el radicado <span class="hl">${rIdReporte}</span>`

        let conclusionTexto = `Como resultado del proceso de validación realizado por nuestro auditor <strong>${rAuditor}</strong>, el lote evaluado obtuvo concepto de <span style="background:${badgeColorRC};color:white;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:bold;letter-spacing:0.5px;display:inline-block;margin:0 4px;vertical-align:middle;">${rConclusion}</span>`
        if (rDestinoProceso && rDestinoPlanta) {
          conclusionTexto += ` autorizando su liberación y continuidad hacia el proceso de <strong>${rDestinoProceso}</strong> en la planta <strong>${rDestinoPlanta}</strong>.`
        } else if (rDestinoProceso) {
          conclusionTexto += ` autorizando su liberación y continuidad hacia el proceso de <strong>${rDestinoProceso}</strong>.`
        } else if (rDestinoPlanta) {
          conclusionTexto += ` autorizando su continuidad en la planta <strong>${rDestinoPlanta}</strong>.`
        } else {
          conclusionTexto += "."
        }

        let detallesTexto = `El presente reporte corresponde a la <strong>Orden de Producción <span class="hl">${rOp}</span></strong>`
        if (rReferencia && rReferencia !== "N/A") detallesTexto += ` asociada a la referencia <span class="hl">${rReferencia}</span>`
        if (rLinea) detallesTexto += ` perteneciente a la línea <strong>${rLinea}</strong>`
        if (rProductora) detallesTexto += ` (${rProductora})`
        detallesTexto += "."

        let prendaTexto = `Se reporta una producción de <strong>${rCantidad}</strong> unidades para el proceso de <strong>${rProceso}</strong>`
        if (rPrenda || rGenero) {
          prendaTexto += ` correspondiente a la prenda <strong>${rPrenda || "N/A"}</strong> de género <strong>${rGenero || "N/A"}</strong>`
        }
        prendaTexto += "."

        const rFechaSalida = getVal(reporte, "salida", "fechaSalida", "fecha_salida", "SALIDA")
        const rFechaEntrega = getVal(reporte, "entrada", "fechaEntrega", "fecha_entrega", "ENTRADA")
        let tiemposTexto = ""
        if (rFechaSalida && rFechaEntrega) {
          tiemposTexto = `Adicionalmente, se registra fecha de salida/despacho el día <strong>${rFechaSalida}</strong> y fecha de entrega acordada programada para el día <strong>${rFechaEntrega}</strong>, por lo cual agradecemos mantener el compromiso operativo y logístico requerido para el cumplimiento oportuno de esta programación.`
        } else if (rFechaEntrega && rFechaEntrega !== "N/A") {
          tiemposTexto = `Adicionalmente, le recordamos que la fecha de entrega acordada se encuentra programada para el día <strong>${rFechaEntrega}</strong>, por lo cual agradecemos mantener el compromiso operativo y logístico requerido para el cumplimiento oportuno de esta programación.`
        } else if (rFechaSalida && rFechaSalida !== "N/A") {
          tiemposTexto = `Adicionalmente, se registra fecha de salida/despacho programada para el día <strong>${rFechaSalida}</strong>.`
        }

        const obsFormatted = String(rObservaciones).replace(/\n/g, "<br>")
        const observacionesSeccion = `<div style="margin-top:16px;"><h4 style="color:#475569;margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Observaciones</h4><div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:14px;border-radius:6px;font-size:13px;color:#334155;line-height:1.6;">${obsFormatted}</div></div>`

        let novedadesParrafo = ""
        const novedadesRaw = getVal(reporte, "novedades_auditoria", "novedadesAsociadas", "NOVEDADES_AUDITORIA", "novedades")
        if (novedadesRaw) {
          let novArr: any[] = []
          if (typeof novedadesRaw === "string") {
            try {
              let parsed = JSON.parse(novedadesRaw)
              if (typeof parsed === "string") parsed = JSON.parse(parsed)
              novArr = Array.isArray(parsed) ? parsed : [parsed]
            } catch (ex) {
              console.warn("[EMAILS] Error parseando novedades:", ex)
              novArr = []
            }
          } else if (Array.isArray(novedadesRaw)) {
            novArr = novedadesRaw
          }
          if (novArr.length > 0) {
            const rows = novArr.map((n: any) => {
              let tipo = getVal(n, "tipo", "TIPO") || "N/A"
              const esSinProceso = (n.sin_proceso === true || n.SIN_PROCESO === true)
              const procesoNov = getVal(n, "proceso", "PROCESO")
              let badgeProceso = ""
              if (esSinProceso) {
                badgeProceso = `<br><span style="font-size:10px;color:#64748b;font-weight:600;">(SP - Sin proceso)</span>`
              } else if (procesoNov) {
                badgeProceso = `<br><span style="font-size:10px;color:#0284c7;font-weight:600;">(${procesoNov})</span>`
              }
              const codigos = n.codigos || n.CODIGOS
              if (codigos && Array.isArray(codigos) && codigos.length > 0) {
                return codigos.map((c: any) => {
                  const talla = getVal(c, "talla", "TALLA") || "N/A"
                  const color = getVal(c, "color", "COLOR") || "N/A"
                  const cant = getVal(c, "cantidad", "CANTIDAD") || "0"
                  return `<tr><td style="padding:8px;border-bottom:1px solid #E2E8F0;line-height:1.3;">${tipo}${badgeProceso}</td><td style="padding:8px;border-bottom:1px solid #E2E8F0;">${talla}</td><td style="padding:8px;border-bottom:1px solid #E2E8F0;">${color}</td><td align="right" style="padding:8px;border-bottom:1px solid #E2E8F0;font-weight:bold;">${cant}</td></tr>`
                }).join("")
              } else {
                const detalle = esSinProceso ? "Sin proceso" : (procesoNov || "Sin detalle")
                return `<tr><td style="padding:8px;border-bottom:1px solid #E2E8F0;line-height:1.3;">${tipo}${badgeProceso}</td><td colspan="3" style="padding:8px;border-bottom:1px solid #E2E8F0;font-style:italic;">${detalle}</td></tr>`
              }
            }).join("")
            novedadesParrafo = `<div style="margin-top:24px;"><h4 style="color:#475569;margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Hallazgos y Novedades de Auditoría</h4><table width="100%" cellpadding="6" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;color:#475569;border-collapse:collapse;"><thead><tr style="background:#F1F5F9;"><th align="left" style="padding:8px;font-weight:bold;color:#1E293B;border-bottom:1px solid #E2E8F0;">Tipo</th><th align="left" style="padding:8px;font-weight:bold;color:#1E293B;border-bottom:1px solid #E2E8F0;">Talla</th><th align="left" style="padding:8px;font-weight:bold;color:#1E293B;border-bottom:1px solid #E2E8F0;">Color</th><th align="right" style="padding:8px;font-weight:bold;color:#1E293B;border-bottom:1px solid #E2E8F0;">Cant.</th></tr></thead><tbody>${rows}</tbody></table></div>`
          }
        }

        htmlBody = generateNotificationHTML({
          titulo: `Reporte de ${rTipoLabel}`,
          nombre: rPlanta,
          parrafos: [
            p1,
            conclusionTexto,
            detallesTexto,
            prendaTexto,
            tiemposTexto,
            observacionesSeccion,
            novedadesParrafo,
            "Agradecemos su compromiso, disposición y cumplimiento con los estándares de calidad establecidos por el Grupo TDM."
          ].filter(Boolean),
          botonTexto: "¿TIENES DUDAS? CONTÁCTANOS",
          botonUrl: rChatUrl
        })
        break
      }

      case "RECUPERAR_PASSWORD":
      case "PASSWORD_RESET":
      case "RESTABLECER_CONTRASENA": {
        let resetUrl = getVal(payload, "enlace", "url", "resetUrl", "link", "action_link") || ""
        const fechaReset = getVal(payload, "fecha", "FECHA", "created_at") || new Date()
        const redirectTo = getVal(payload, "redirectTo", "redirect_to") || "https://andres1-dev.github.io/three/login.html"

        const sbUrl = Deno.env.get("SUPABASE_URL") ?? ""
        const sbServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        let supabaseAdmin: any = null
        if (sbUrl && sbServiceRole) {
          try {
            supabaseAdmin = createClient(sbUrl, sbServiceRole)
          } catch (_) {}
        }

        // Buscar el nombre real registrado en el sistema
        let nombreReal = (nombre && nombre !== "Usuario" && nombre !== "Colaborador") ? String(nombre).trim() : ""

        if (!nombreReal && supabaseAdmin) {
          try {
            const targetEmail = email.toLowerCase().trim()

            // 1. SIEMPRE existe en auth.users -> consultar primero en Auth Admin
            const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
            const authUser = authData?.users?.find((u: any) => u.email?.toLowerCase()?.trim() === targetEmail)

            if (authUser) {
              const meta = authUser.user_metadata || {}
              if (meta.full_name?.trim()) {
                nombreReal = meta.full_name.trim()
              } else if (meta.usuario?.trim()) {
                nombreReal = meta.usuario.trim()
              } else if (meta.name?.trim()) {
                nombreReal = meta.name.trim()
              }

              // Si en user_metadata no estaba, buscar en tabla perfiles mediante auth_user_id
              if (!nombreReal && authUser.id) {
                const { data: pData } = await supabaseAdmin
                  .from("perfiles")
                  .select("full_name")
                  .eq("auth_user_id", authUser.id)
                  .maybeSingle()

                if (pData?.full_name?.trim()) {
                  nombreReal = pData.full_name.trim()
                }
              }
            }

            // 2. Si aún no tenemos nombre, buscar por email en perfiles
            if (!nombreReal) {
              const { data: pData } = await supabaseAdmin
                .from("perfiles")
                .select("full_name")
                .ilike("email", targetEmail)
                .maybeSingle()

              if (pData?.full_name?.trim()) {
                nombreReal = pData.full_name.trim()
              }
            }

            // 3. Buscar en tabla usuarios
            if (!nombreReal) {
              const { data: uData } = await supabaseAdmin
                .from("usuarios")
                .select("usuario, full_name")
                .or(`correo.ilike.${targetEmail},email.ilike.${targetEmail}`)
                .maybeSingle()

              if (uData?.full_name?.trim()) {
                nombreReal = uData.full_name.trim()
              } else if (uData?.usuario?.trim()) {
                nombreReal = uData.usuario.trim()
              }
            }

            // 4. Buscar en tabla plantas (talleres)
            if (!nombreReal) {
              const { data: plData } = await supabaseAdmin
                .from("plantas")
                .select("planta")
                .or(`correo.ilike.${targetEmail},email.ilike.${targetEmail}`)
                .maybeSingle()

              if (plData?.planta?.trim()) {
                nombreReal = plData.planta.trim()
              }
            }
          } catch (errNom) {
            console.warn("[EMAILS] Error buscando nombre real:", errNom)
          }
        }

        // Si no se encontró ningún nombre en Auth ni en BD, formatear el prefijo del correo
        if (!nombreReal) {
          const prefix = email.split("@")[0] || ""
          nombreReal = prefix ? (prefix.charAt(0).toUpperCase() + prefix.slice(1)) : "Usuario"
        }

        // Si no viene enlace directo, generamos el enlace seguro con Supabase Admin
        if (!resetUrl && supabaseAdmin) {
          try {
            const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email,
              options: {
                redirectTo
              }
            })
            if (linkErr) {
              console.error("[EMAILS] Error generando recovery link con Supabase Admin:", linkErr)
            } else if (linkData?.properties?.action_link) {
              resetUrl = linkData.properties.action_link
              console.log(`[EMAILS] Recovery link generado exitosamente para ${email}`)
            }
          } catch (errAdmin) {
            console.warn("[EMAILS] Error inicializando Supabase Admin:", errAdmin)
          }
        }

        if (!resetUrl) {
          throw new Error("No se pudo obtener ni generar el enlace de recuperación para este usuario.")
        }

        subject = "Restablecimiento de Contraseña — Grupo TDM"

        // Opción A: Editorial Ejecutivo (Estilo Apple / Stripe)
        const avisoSeguridad = `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;">
          <p style="font-size:12.5px;line-height:1.65;color:#64748b;margin:0 0 8px;">
            <strong style="color:#0f172a;font-weight:600;">Seguridad:</strong> Este enlace es de un solo uso y expirará automáticamente en <strong>5 minutos</strong>.
          </p>
          <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:0;">
            Si no solicitaste este cambio, ignora este mensaje con tranquilidad; tu cuenta sigue protegida y ningún colaborador de Grupo TDM te solicitará tus credenciales.
          </p>
        </div>`

        htmlBody = generateNotificationHTML({
          titulo: "Restablecer Contraseña",
          nombre: nombreReal,
          parrafos: [
            `el día <strong>${formatDatetimeES(fechaReset)}</strong> hemos recibido una solicitud para restablecer la contraseña de acceso a tu cuenta en el sistema.`,
            `Para crear una nueva contraseña y continuar trabajando en la plataforma, por favor haz clic en el botón a continuación:`
          ],
          botonTexto: "RESTABLECER MI CONTRASEÑA",
          botonUrl: resetUrl,
          bloqueInferior: avisoSeguridad
        })
        break
      }

      default:
        throw new Error(`Acción no reconocida: ${accion}`)
    }

    if (payload.subject) {
      subject = payload.subject
    }
    if (payload.html) {
      htmlBody = payload.html
    }

    // Adjunto: si el cliente envía attachmentHtml (la plantilla en .html), usarla con prioridad
    const attachHtml = payload.attachmentHtml || payload.plantillaHtml || (
      (accion === "REPORTE_CALIDAD" && payload.adjunto !== false) ? htmlBody : undefined
    )
    const attachName = payload.attachmentName || (
      idNovedad !== "N/A" ? `${idNovedad}.pdf` : "documento.pdf"
    )

    // Enviar con GAS
    await sendWithGAS({
      to: email,
      subject,
      html: htmlBody,
      attachmentHtml: attachHtml,
      attachmentName: attachName,
      cc: Array.isArray(cc) ? cc : undefined
    })

    return new Response(
      JSON.stringify({ success: true, message: "Correo enviado exitosamente" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    console.error("[ERROR]", error)
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    )
  }
})

function sanitizeEmail(emailStr: string): string {
  if (!emailStr) return ""
  const match = emailStr.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0].toLowerCase().trim() : emailStr.trim()
}

// ── Envío con Google Apps Script (GAS) ────────────────────────────
async function sendWithGAS(options: {
  to: string
  subject: string
  html: string
  attachmentHtml?: string
  attachmentName?: string
  cc?: string[]
}) {
  if (!GAS_URL) {
    throw new Error("GAS_EMAIL_URL no está configurada en las variables de entorno")
  }

  const toEmail = sanitizeEmail(options.to)
  if (!toEmail) {
    // Correo inválido — NO reintentar, fallar inmediatamente
    throw new Error(`Email de destino inválido: "${options.to}"`)
  }

  console.log(`[GAS] Enviando email a: ${toEmail}`)

  // Un único intento — sin retries
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toEmail,
      subject: options.subject,
      html: options.html,
      attachmentHtml: options.attachmentHtml || "",
      attachmentName: options.attachmentName || "reporte.html",
      senderName: SENDER_NAME
    }),
    // Sin signal/timeout: GAS puede tardar hasta 10s, es aceptable
  })

  // GAS siempre devuelve 200; el error real viene en el JSON
  const responseText = await res.text()
  let parsed: any = {}
  try { parsed = JSON.parse(responseText) } catch (_) { /* ignorar parse error */ }

  if (!res.ok || parsed.success === false) {
    const errMsg = parsed.error || responseText || `HTTP ${res.status}`
    // Fallar SIN reintentar
    throw new Error(`GAS email error: ${errMsg}`)
  }

  console.log(`[GAS] Email enviado exitosamente a ${toEmail}`)
  return { success: true }
}

// ── Utilidades ────────────────────────────────────────────────
function formatDatetimeES(raw: Date | string | null | undefined): string {
  if (!raw) return "fecha no disponible"
  // Convertir a objeto Date (soporta string ISO con offset, e.g. "2026-09-10 12:33:48.107-05")
  let d: Date
  if (raw instanceof Date) {
    d = raw
  } else {
    // Normalizar separador espacio → T para compatibilidad ISO 8601
    const normalized = String(raw).replace(" ", "T")
    d = new Date(normalized)
  }
  if (isNaN(d.getTime())) return String(raw)

  // Formatear siempre en hora de Colombia (America/Bogota = UTC-5)
  const fmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
  const partes = fmt.formatToParts(d)
  const get = (t: string) => partes.find(p => p.type === t)?.value ?? ""

  const dia = get("day")
  const mes = get("month")
  const anio = get("year")
  const hora = get("hour")
  const min = get("minute")
  const ampm = get("dayPeriod").toLowerCase().replace("\u202f", "").replace(" ", "")

  const articulo = Number(hora) === 1 ? "la" : "las"
  return `${dia} de ${mes} de ${anio} a ${articulo} ${hora}:${min} ${ampm}`
}

interface NotificationParams {
  titulo: string
  nombre: string
  parrafos: string[]
  botonTexto: string
  botonUrl: string
  bloqueInferior?: string
}

function generateNotificationHTML(params: NotificationParams): string {
  const { titulo, nombre, parrafos, botonTexto, botonUrl, bloqueInferior } = params
  const parrafosHTML = parrafos.map((p, i) => {
    const contenido = i === 0 ? `Hola, <strong>${nombre},</strong> ${p}` : p
    return `<p class="txt">${contenido}</p>`
  }).join("\n            ")

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body  { margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#1E293B; }
    .wrap { max-width:600px; margin:0 auto; background:#fff; }
    .hdr  { padding:24px 30px; text-align:center; }
    .bdy  { padding:0 48px 40px; }
    .ttl  { font-size:22px; font-weight:700; color:#1E293B; margin:0 0 24px; text-align:center; }
    .txt  { font-size:15px; line-height:1.75; color:#475569; margin:0 0 24px; text-align:left; }
    .txt strong { color:#1E293B; }
    .hl   { display:inline-block; background:#F1F5F9; border:1px solid #E2E8F0; border-radius:4px; padding:1px 7px; font-weight:600; color:#1E293B; font-size:14px; }
    .estado { display:inline-block; background:#F1F5F9; border:1px solid #E2E8F0; border-radius:4px; padding:1px 7px; font-weight:600; color:#1E293B; font-size:14px; }
    .div  { border:none; border-top:1px solid #F1F5F9; margin:8px 0 32px; }
    .btn-wrap { text-align:center; }
    .btn  { display:inline-block; padding:14px 36px; background:#1E293B; color:#fff !important; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; text-transform:uppercase; letter-spacing:.5px; }
    .ftr  { padding:20px 24px; font-size:12px; color:#94A3B8; text-align:center; border-top:1px solid #F1F5F9; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <img src="https://lh3.googleusercontent.com/d/1ut0pgWZJ1nGr2EaS2-gtJwCftVILMJO4" alt="Grupo TDM" width="180">
    </div>
    <div class="bdy">
      <div class="ttl">${titulo}</div>
            ${parrafosHTML}
      <hr class="div">
      <div class="btn-wrap"><a href="${botonUrl}" class="btn">${botonTexto}</a></div>
      ${bloqueInferior ? bloqueInferior : ""}
    </div>
    <div class="ftr">
      © ${new Date().getFullYear()} Grupo TDM<br>
      ¿Ya nos sigues en redes? ¡Siempre tenemos cosas nuevas!
      <div style="margin-top:10px;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td style="padding:0 8px; text-align:center; vertical-align:top;">
              <a href="https://www.instagram.com/eltemplodelamoda/" style="text-decoration:none;">
                <img src="https://img.icons8.com/ios/50/9CA3AF/instagram-new.png" width="20" height="20" alt="Instagram" style="display:block;margin:0 auto;">
                <span style="display:block;font-size:10px;font-weight:500;color:#9CA3AF;margin-top:4px;font-family:'Segoe UI',Arial,sans-serif;">Instagram</span>
              </a>
            </td>
            <td style="padding:0 8px; text-align:center; vertical-align:top;">
              <a href="https://www.facebook.com/templodelamodaoficial/" style="text-decoration:none;">
                <img src="https://img.icons8.com/ios/50/9CA3AF/facebook-new.png" width="20" height="20" alt="Facebook" style="display:block;margin:0 auto;">
                <span style="display:block;font-size:10px;font-weight:500;color:#9CA3AF;margin-top:4px;font-family:'Segoe UI',Arial,sans-serif;">Facebook</span>
              </a>
            </td>
            <td style="padding:0 8px; text-align:center; vertical-align:top;">
              <a href="https://www.eltemplodelamoda.com/" style="text-decoration:none;">
                <img src="https://img.icons8.com/ios/50/9CA3AF/shopping-bag.png" width="20" height="20" alt="Tienda" style="display:block;margin:0 auto;">
                <span style="display:block;font-size:10px;font-weight:500;color:#9CA3AF;margin-top:4px;font-family:'Segoe UI',Arial,sans-serif;">Tienda</span>
              </a>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`
}
