// Edge Function: consulta-reportes
// Consulta exclusiva y optimizada de reportes de auditoría por OP/Lote
// Roles permitidos: ADMIN, MODERATOR, USER-I
// Estrategia: eq exacto primero → ilike parcial como fallback

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const ALLOWED_ROLES = ["ADMIN", "MODERATOR", "USER-I"]

serve(async (req) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // ── Parse body ──
    let payload: any = {}
    try {
      payload = await req.json()
    } catch {
      return jsonError(400, "Body JSON inválido")
    }

    const lote = String(payload.lote || "").trim()
    if (!lote) {
      return jsonError(400, "Parámetro 'lote' requerido")
    }

    // ── Validar sesión JWT ──
    const authHeader = req.headers.get("Authorization") || ""
    const token = authHeader.replace("Bearer ", "").trim()

    if (!token) {
      return jsonError(401, "No autorizado: falta token de sesión")
    }

    // Cliente anon para validar el token del usuario
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token)
    if (authErr || !user) {
      return jsonError(401, "Sesión inválida o expirada")
    }

    // ── Verificar rol ──
    const meta = user.user_metadata || {}
    const appMeta = user.app_metadata || {}
    const userRole = String(appMeta.role || meta.role || "GUEST").toUpperCase()

    if (!ALLOWED_ROLES.includes(userRole)) {
      return jsonError(403, `Acceso denegado. Rol '${userRole}' no tiene permiso para consultar auditorías.`)
    }

    // ── Cliente con service role para consultas sin restricciones de RLS ──
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log(`[consulta-reportes] OP: "${lote}" | Rol: ${userRole}`)

    // ── ESTRATEGIA 1: eq exacto por columna `id` (OP) — usa índice, instantáneo ──
    let reportes: any[] = []
    let usedStrategy = "eq"

    {
      const { data, error } = await supabaseAdmin
        .from("reportes")
        .select("*")
        .eq("id", lote)
        .order("fecha", { ascending: false })

      if (error) throw error
      reportes = data || []
    }

    // ── ESTRATEGIA 2: cast a texto + ilike (búsqueda parcial si exacto no devuelve nada) ──
    if (reportes.length === 0) {
      usedStrategy = "ilike"

      const { data, error } = await supabaseAdmin
        .from("reportes")
        .select("*")
        .filter("id::text", "ilike", `%${lote}%`)
        .order("fecha", { ascending: false })

      if (error) throw error
      reportes = data || []
    }


    const elapsed = Date.now() - startTime

    console.log(`[consulta-reportes] ✅ ${reportes.length} reportes | Estrategia: ${usedStrategy} | ${elapsed}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        reportes,
        meta: {
          lote,
          total: reportes.length,
          estrategia: usedStrategy,
          tiempo_ms: elapsed,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )

  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error(`[consulta-reportes] ❌ Error (${elapsed}ms):`, err.message)
    return jsonError(500, err.message || "Error interno del servidor")
  }
})

function jsonError(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
}
