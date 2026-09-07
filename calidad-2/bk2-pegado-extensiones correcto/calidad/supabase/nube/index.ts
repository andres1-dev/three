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

    throw new Error(`Acción no reconocida: '${accion}'.`)
  } catch (err: any) {
    console.error("[NUBE ERROR]", err?.message || err)
    return json({ success: false, message: err?.message || "Error interno." }, 400)
  }
})
