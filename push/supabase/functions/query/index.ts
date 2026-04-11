import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Inicializar cliente de Supabase con Service Role Key para saltar RLS si es necesario
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const url = new URL(req.url)
    const table = url.searchParams.get("table")
    const selectStr = url.searchParams.get("select") || "*"

    if (!table) {
      throw new Error("Se requiere el nombre de la tabla (?table=NOMBRE)")
    }

    console.log(`[QUERY] Consultando tabla: ${table}, Select: ${selectStr}`)

    let query = supabaseClient.from(table).select(selectStr)

    // Soportar filtros básicos predefinidos (ex: ?eq_col=valor)
    url.searchParams.forEach((value, key) => {
      if (key.startsWith("eq_")) {
        query = query.eq(key.replace("eq_", ""), value)
      } else if (key.startsWith("in_")) {
        query = query.in(key.replace("in_", ""), value.split(","))
      }
    })

    // Ejecutar consulta SELECT
    const { data, error } = await query
    
    if (error) throw error

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error(`[QUERY ERROR]`, error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
