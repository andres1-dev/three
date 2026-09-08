// Edge Function: nube (Módulo NUBE — Programación de Taller)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
}

/**
 * Mapa de términos del campo CUENTO que identifican productoras conocidas.
 * Se normaliza: quitar "S2", colapsar espacios, sin tildes, mayúsculas.
 */
const CUENTO_PRODUCTORA_MAP = [
  { terms: ["HACEMOS MODA"], searchFor: "HACEMOS MODA" },
  { terms: ["ANGELES", "ÁNGELES"], searchFor: "ANGELES" },
]

function _normalizarCuento(v: string): string {
  return v.toUpperCase()
    .replace(/\s*S2\s*$/i, "")
    .replace(/\u00e1/g, "A").replace(/\u00e9/g, "E").replace(/\u00ed/g, "I")
    .replace(/\u00f3/g, "O").replace(/\u00fa/g, "U")
    .replace(/\s+/g, " ").trim()
}

/**
 * Detecta la productora mayoritaria a partir del campo cuento de las filas.
 * Consulta dinámicamente la tabla productoras para hacer el match.
 *
 * @returns {{ id_productora: string, productora: string } | null}
 */
async function _detectarProductoraPorCuento(
  rows: any[],
  db: ReturnType<typeof createClient>
): Promise<{ id_productora: string; productora: string } | null> {
  if (!rows || !rows.length) return null

  // 1. Frecuencia del campo cuento normalizado
  const freq = new Map<string, number>()
  for (const r of rows) {
    const raw = String(r.cuento || "").trim()
    if (!raw) continue
    const norm = _normalizarCuento(raw)
    freq.set(norm, (freq.get(norm) || 0) + 1)
  }
  if (!freq.size) return null

  // 2. Moda
  let modaKey = ""
  let modaCount = 0
  for (const [k, v] of freq) {
    if (v > modaCount) { modaCount = v; modaKey = k }
  }

  // Al menos 40% de las filas deben coincidir para considerarse representativo
  if (modaCount / rows.length < 0.4) return null

  // 3. Buscar término en el mapa de CUENTO → productora
  let searchFor: string | null = null
  for (const entry of CUENTO_PRODUCTORA_MAP) {
    if (entry.terms.some((t: string) => modaKey.includes(t))) {
      searchFor = entry.searchFor
      break
    }
  }
  if (!searchFor) return null

  // 4. Buscar en tabla productoras (búsqueda case-insensitive)
  const { data: prods } = await db
    .from("productoras")
    .select("id_productora, productora, nombre_corto")
    .ilike("productora", `%${searchFor}%`)
    .limit(1)

  if (!prods || !prods.length) return null
  const found = prods[0]
  return {
    id_productora: String(found.id_productora ?? ""),
    productora: String(found.productora || found.nombre_corto || "").toUpperCase()
  }
}

/**
 * Paginación genérica para PostgREST/Supabase: cada request devuelve como
 * máximo ~1.000 filas (límite del servidor) aunque se pida .limit(mayor).
 * Recorre TODAS las filas de una consulta en páginas y las agrega.
 *
 * @param buildQuery  función que construye el query BASE (sin limit/range)
 * @param pageSize    filas por página (por defecto el máximo de PostgREST)
 * @param maxPages    tope de seguridad de páginas (evita bucles infinitos)
 * @returns           todas las filas (hasta agotar datos o alcanzar el tope)
 */
async function _fetchAllPaged(
  buildQuery: () => any,
  pageSize = 1000,
  maxPages = 300
): Promise<any[]> {
  const all: any[] = []
  for (let i = 0; i < maxPages; i++) {
    const from = i * pageSize
    const to = from + pageSize - 1
    const { data, error } = await buildQuery().limit(pageSize).range(from, to)
    if (error) throw error
    const rows = data || []
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const authHeader = req.headers.get("Authorization") || ""
    if (!authHeader) throw new Error("Se requiere autenticación (Authorization).")

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    // Cliente con el JWT del usuario (identidad)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) throw new Error("Usuario no autenticado.")
    const userEmail: string = userData.user.email || ""

    // Cliente service role para operaciones de datos (bypass RLS)
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const payload = await req.json().catch(() => ({}))
    const accion: string = payload.accion || ""
    const usuarioNombre: string = String(payload.usuarioNombre || "").trim()

    // ── Catálogo de productoras (el usuario lo mantiene actualizado) ──────
    if (accion === "LISTAR_PRODUCTORAS") {
      const { data, error } = await db
        .from("productoras")
        .select("id_productora, nit, productora, nombre_corto")
        .order("productora", { ascending: true })
      if (error) throw error
      return json({ success: true, productoras: data || [] })
    }

    // ── Listar programación guardada ──────────────────────────────────────
    if (accion === "LISTAR_PROGRAMACION") {
      let q = db
        .from("extensiones")
        .select("referencia, op, extensiones, fecha, id_productora, productora, usuario, updated_at")
        .order("referencia", { ascending: true })
        .order("op", { ascending: true })

      if (payload.op) q = q.eq("op", Number(payload.op))
      if (payload.idProductora) q = q.eq("id_productora", String(payload.idProductora))
      if (payload.fecha) q = q.eq("fecha", payload.fecha)

      const limit = Number(payload.limit || 1000)
      q = q.limit(limit)

      const { data, error } = await q
      if (error) throw error
      return json({ success: true, rows: data || [] })
    }

    // ── Guardar programación (upsert batch agrupado por OP/Referencia) ────
    if (accion === "GUARDAR_PROGRAMACION") {
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      if (!rows.length) throw new Error("No hay filas de programación para guardar.")

      const fecha: string = payload.fecha ? String(payload.fecha) : new Date().toISOString()
      const idProductora: string = String(payload.idProductora || payload.productora || "").trim()
      const productora: string = String(payload.productoraNombre || (payload.idProductora ? payload.productora : "") || "").trim()
      if (!idProductora) throw new Error("Debe indicar la productora.")
      if (!productora) throw new Error("Debe indicar el nombre de la productora.")

      const grupos = new Map<string, any>()
      for (const r of rows) {
        const referencia = String(r.referencia || "").trim()
        const op = Number(r.op || 0)
        if (!referencia || !op) continue

        const key = `${referencia}|${op}`
        if (!grupos.has(key)) grupos.set(key, { referencia, op, extensiones: [] })
        const grupo = grupos.get(key)

        for (const e of r.extensiones || []) {
          const color = String(e.color || "").trim()
          const talla = String(e.talla || "").trim()
          const cantidad = Number(e.cantidad || 0)
          const existente = grupo.extensiones.find((x: any) => x.color === color && x.talla === talla)
          if (existente) existente.cantidad += cantidad
          else grupo.extensiones.push({ color, talla, cantidad })
        }
      }

      const flat: any[] = []
      for (const g of grupos.values()) {
        if (!g.extensiones.length) continue
        flat.push({
          referencia: g.referencia,
          op: g.op,
          extensiones: g.extensiones,
          fecha,
          productora,
          id_productora: idProductora,
          usuario: usuarioNombre || userEmail,
        })
      }

      if (!flat.length) throw new Error("No hay extensiones válidas (falta referencia u OP).")

      const { data, error } = await db
        .from("extensiones")
        .upsert(flat, { onConflict: "op,id_productora", ignoreDuplicates: true })
        .select("op, id_productora")

      if (error) throw error
      const totalExt = flat.reduce((acc, g) => acc + g.extensiones.length, 0)
      const agregadas = (data || []).length
      const omitidas = flat.length - agregadas
      return json({
        success: true,
        message: `Programación asentada: ${agregadas} nuevo(s), ${omitidas} omitidas, ${totalExt} extensiones.`,
        agregadas,
        omitidas,
        guardadas: flat.length,
        ids: (data || []).map((d: any) => d.op),
      })
    }


    // ── Resumen: última actualización por productora (su día más reciente) ──
    if (accion === "RESUMEN_PROGRAMACION") {
      const { data, error } = await db
        .from("extensiones")
        .select("id_productora, productora, op, fecha, created_at, updated_at, usuario")
        .order("updated_at", { ascending: false })
        .limit(20000)
      if (error) throw error

      const filas = data || []
      const dia = (iso: any) => String(iso || "").slice(0, 10)

      // Agrupar todos los registros por productora
      const grupos = new Map<string, any[]>()
      for (const r of filas) {
        const id = String(r.id_productora || "")
        if (!grupos.has(id)) grupos.set(id, [])
        grupos.get(id)!.push(r)
      }

      const resumen: any[] = []
      let ultima: any = null

      for (const [id, rows] of grupos) {
        // Día más reciente de esta productora
        let fechaUltima = ""
        for (const r of rows) {
          const f = String(r.fecha || "")
          if (f > fechaUltima) fechaUltima = f
        }
        const diaUltimo = dia(fechaUltima)

        // Registros de ese día (no todo el histórico)
        const delDia = rows.filter((r: any) => dia(r.fecha) === diaUltimo)

        // Fila modificada más recientemente dentro de ese día (orden ya desc)
        const last = delDia[0]
        const entry = {
          id_productora: id,
          productora: String((last && last.productora) || ""),
          registros: delDia.length,
          fecha: fechaUltima,
          ultima_modificacion: last ? last.updated_at : "",
          usuario: String((last && last.usuario) || ""),
        }
        resumen.push(entry)

        if (!ultima || (entry.ultima_modificacion || "") > (ultima.updated_at || "")) {
          ultima = {
            fecha: fechaUltima,
            updated_at: entry.ultima_modificacion,
            usuario: entry.usuario,
            registros: delDia.length,
          }
        }
      }

      resumen.sort((a, b) =>
        String(b.ultima_modificacion || "").localeCompare(String(a.ultima_modificacion || ""))
      )

      return json({ success: true, resumen, ultima })
    }

    // ── Resumen COMPLETO en UNA sola llamada (SIN RPCs SQL) ─────────────────
    // Todo se resuelve con consultas directas (service role) a las tablas:
    //   1) `extensiones` → agregación por productora (última actualización).
    //   2) `master`      → clasificación Confección/Procesos por proceso
    //                      NORMALIZADO (mayúsculas/espacios/tildes) + agregación.
    // Devuelve: { extensiones, confeccion, procesos, rows: {confeccion, procesos}, ultima }
    if (accion === "RESUMEN_COMPLETO") {
      const idProd: string | null = String(payload.idProductora || "").trim() || null

      // Normaliza el valor de proceso (mayúsculas, espacios y tildes → 'CONFECCION')
      const normProceso = (p: any): string =>
        String(p || "").toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

      // ── 1) TABLA `extensiones`: PAGINADA (PostgREST limita a ~1.000 filas
      //       por request) → se recorre TODA la tabla con .range() y se agrega.
      const extRows = await _fetchAllPaged(() => {
        let q = db
          .from("extensiones")
          .select("id_productora, productora, op, fecha, created_at, updated_at, usuario")
          .order("updated_at", { ascending: false })
        if (idProd) q = q.eq("id_productora", idProd)
        return q
      })

      // Agrupar por productora: total de registros, fecha máx, última
      // modificación y usuario de esa última modificación.
      const extGrupos = new Map<string, any>()
      for (const r of extRows || []) {
        const id = String(r.id_productora || "")
        if (!extGrupos.has(id)) {
          extGrupos.set(id, {
            productora: String(r.productora || ""),
            registros: 0,
            fecha: "",
            ultima_modificacion: "",
            usuario: "—",
          })
        }
        const g = extGrupos.get(id)!
        g.registros++
        if (String(r.fecha || "") > g.fecha) g.fecha = String(r.fecha || "")
        if (String(r.updated_at || "") > g.ultima_modificacion) {
          g.ultima_modificacion = String(r.updated_at || "")
          g.usuario = String(r.usuario || "—")
        }
      }
      const extensiones = Array.from(extGrupos.entries())
        .map(([id, g]: [string, any]) => ({
          id_productora: id,
          productora: g.productora,
          registros: g.registros,
          fecha: g.fecha,
          ultima_modificacion: g.ultima_modificacion,
          usuario: g.usuario,
        }))
        .sort((a: any, b: any) => String(b.ultima_modificacion || "").localeCompare(String(a.ultima_modificacion || "")))

      // ── 2) TABLA `master`: PAGINADA (Confección + Procesos juntas) → se
      //       procesa la información COMPLETA, no solo las primeras 1.000 filas.
      const masterRows = await _fetchAllPaged(() => {
        let q = db
          .from("master")
          .select("id_productora, productora, proceso, updated_at, usuario")
          .order("updated_at", { ascending: false })
        if (idProd) q = q.eq("id_productora", idProd)
        return q
      })

      // Clasificar por proceso NORMALIZADO (captura 'confeccion', 'Confección',
      // ' CONFECCION '… que antes se perdían con el match exacto).
      const confRowClas = (masterRows || []).filter((r: any) => normProceso(r.proceso) === "CONFECCION")
      const procRowClas = (masterRows || []).filter((r: any) => normProceso(r.proceso) !== "CONFECCION")

      const buildResumen = (rows: any[]): any[] => {
        const grupos = new Map<string, any>()
        for (const r of rows || []) {
          const key = String(r.id_productora || "") || String(r.productora || "—")
          if (!grupos.has(key)) {
            grupos.set(key, {
              id_productora: r.id_productora,
              productora: String(r.productora || r.id_productora || "—"),
              registros: 0,
              ultima_modificacion: String(r.updated_at || ""),
              usuario: String(r.usuario || "—"),
            })
          }
          const g = grupos.get(key)!
          g.registros++
          const cur = String(r.updated_at || "")
          if (cur > g.ultima_modificacion) {
            g.ultima_modificacion = cur
            g.usuario = String(r.usuario || "—")
          }
        }
        return Array.from(grupos.values()).sort((a: any, b: any) =>
          String(b.ultima_modificacion || "").localeCompare(String(a.ultima_modificacion || ""))
        )
      }

      const confeccion = buildResumen(confRowClas)
      const procesos = buildResumen(procRowClas)

      // "ultima": modificación más reciente global (por updated_at)
      let ultima: any = null
      for (const e of extensiones) {
        const um = String(e.ultima_modificacion || "")
        if (!ultima || um > String(ultima.updated_at || "")) {
          ultima = {
            fecha: String(e.fecha || ""),
            updated_at: um,
            usuario: String(e.usuario || ""),
            registros: Number(e.registros || 0),
          }
        }
      }

      return json({
        success: true,
        extensiones,
        confeccion,
        procesos,
        rows: {
          confeccion: confRowClas,
          procesos: procRowClas,
        },
        ultima,
      })
    }

    // ── Sincronizar Confección (tabla master) ────────────────────────────────
    if (accion === "SYNC_CONFECCION") {
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      if (!rows.length) throw new Error("No hay filas de confección para guardar.")

      let idProductora: string = String(payload.idProductora || "").trim()
      if (!idProductora) throw new Error("Debe indicar la productora.")

      // Limpiar campos vacíos
      const cleanData = rows.filter((r: any) => r.id_master && r.referencia)

      if (!cleanData.length) throw new Error("No hay registros válidos (falta id_master o referencia).")

      // ── Validación adicional en la nube: detectar productora por CUENTO ──
      // Si la mayoría de los registros tienen un cuento que identifica a otra
      // productora, se corrige automáticamente antes del upsert.
      const detectedProd = await _detectarProductoraPorCuento(cleanData, db)
      let productoraNombre: string = String(payload.productoraNombre || payload.productora || "").trim()

      if (detectedProd && detectedProd.id_productora !== idProductora) {
        console.warn(
          `[NUBE][SYNC_CONFECCION] Discrepancia de productora detectada.` +
          ` Recibido: id_productora="${idProductora}" nombre="${productoraNombre}"` +
          ` | CUENTO mayoritario apunta a: id="${detectedProd.id_productora}" nombre="${detectedProd.productora}".` +
          ` Corrigiendo automáticamente.`
        )
        idProductora = detectedProd.id_productora
        productoraNombre = detectedProd.productora
      }

      const now = new Date().toISOString()
      const usuarioNombre: string = String(payload.usuarioNombre || userEmail || "").trim()

      const withMeta = cleanData.map((r: any) => {
        const meta: any = {
          id_productora: idProductora,
          productora: productoraNombre || idProductora,
          usuario: usuarioNombre,
          updated_at: now,
        }
        if (!r.created_at) meta.created_at = now
        return { ...r, ...meta }
      })

      const { data, error } = await db
        .from("master")
        .upsert(withMeta, { onConflict: "id_master,id_productora,proceso", ignoreDuplicates: false })
        .select("id_master")

      if (error) throw error

      const agregadas = (data || []).length
      const omitidas = cleanData.length - agregadas

      return json({
        success: true,
        message: `Confección sincronizada: ${agregadas} registro(s), ${omitidas} omitidos.`,
        agregadas,
        omitidas,
        total: cleanData.length,
        productora_usada: productoraNombre || idProductora,
        ids: (data || []).map((d: any) => d.id_master),
      })
    }

    // ── Sincronizar Procesos (tabla master) ──────────────────────────────────
    if (accion === "SYNC_PROCESOS") {
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      if (!rows.length) throw new Error("No hay filas de procesos para guardar.")

      let idProductora: string = String(payload.idProductora || "").trim()
      if (!idProductora) throw new Error("Debe indicar la productora.")

      // Limpiar campos vacíos
      const cleanData = rows.filter((r: any) => r.id_master && r.referencia)

      if (!cleanData.length) throw new Error("No hay registros válidos (falta id_master o referencia).")

      // ── Validación adicional en la nube: detectar productora por CUENTO ──
      const detectedProd = await _detectarProductoraPorCuento(cleanData, db)
      let productoraNombre: string = String(payload.productoraNombre || payload.productora || "").trim()

      if (detectedProd && detectedProd.id_productora !== idProductora) {
        console.warn(
          `[NUBE][SYNC_PROCESOS] Discrepancia de productora detectada.` +
          ` Recibido: id_productora="${idProductora}" nombre="${productoraNombre}"` +
          ` | CUENTO mayoritario apunta a: id="${detectedProd.id_productora}" nombre="${detectedProd.productora}".` +
          ` Corrigiendo automáticamente.`
        )
        idProductora = detectedProd.id_productora
        productoraNombre = detectedProd.productora
      }

      const now = new Date().toISOString()
      const usuarioNombre: string = String(payload.usuarioNombre || userEmail || "").trim()

      const withMeta = cleanData.map((r: any) => {
        const meta: any = {
          id_productora: idProductora,
          productora: productoraNombre || idProductora,
          usuario: usuarioNombre,
          updated_at: now,
        }
        if (!r.created_at) meta.created_at = now
        return { ...r, ...meta }
      })

      const { data, error } = await db
        .from("master")
        .upsert(withMeta, { onConflict: "id_master,id_productora,proceso", ignoreDuplicates: false })
        .select("id_master")

      if (error) throw error

      const agregadas = (data || []).length
      const omitidas = cleanData.length - agregadas

      return json({
        success: true,
        message: `Procesos sincronizados: ${agregadas} registro(s), ${omitidas} omitidos.`,
        agregadas,
        omitidas,
        total: cleanData.length,
        productora_usada: productoraNombre || idProductora,
        ids: (data || []).map((d: any) => d.id_master),
      })
    }

    // ── Listar registros de master (Confección/Procesos) ─────────────────────
    if (accion === "LISTAR_MASTER") {
      const tipo: string = String(payload.tipo || "").toUpperCase()
      const idProductora: string = String(payload.idProductora || "").trim()
      const limit = Math.max(0, Number(payload.limit || 1000))

      const buildBase = () => {
        let q = db
          .from("master")
          .select("*")
          .order("updated_at", { ascending: false })
        if (idProductora) q = q.eq("id_productora", idProductora)
        if (tipo === "CONFECCION") {
          q = q.eq("proceso", "CONFECCION")
        } else if (tipo === "PROCESOS") {
          q = q.neq("proceso", "CONFECCION")
        }
        return q
      }

      // Paginación con .range() para superar el límite de ~1.000 filas por
      // request de PostgREST y devolver TODAS las filas solicitadas.
      let rows: any[] = []
      if (limit <= 1000) {
        const { data, error } = await buildBase().limit(limit)
        if (error) throw error
        rows = data || []
      } else {
        rows = (await _fetchAllPaged(buildBase)).slice(0, limit)
      }

      return json({ success: true, rows })
    }

    throw new Error(`Acción no reconocida: '${accion}'.`)
  } catch (err: any) {
    console.error("[NUBE ERROR]", err?.message || err)
    return json({ success: false, message: err?.message || "Error interno." }, 400)
  }
})
