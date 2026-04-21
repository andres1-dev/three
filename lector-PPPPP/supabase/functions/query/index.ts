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

    // Para tablas de autenticación y tablas grandes, usar paginación para traer TODOS los registros
    const authTables = ['USUARIOS', 'PLANTAS', 'usuarios', 'plantas']
    const largeTables = ['BARRAS', 'COLORES', 'SISPRO', 'barras', 'colores', 'sispro']
    const isAuthTable = authTables.includes(table)
    const isLargeTable = largeTables.includes(table)

    if (isAuthTable || isLargeTable) {
      console.log(`[QUERY] Tabla grande detectada (${table}), usando paginación para traer todos los registros`)
      
      let allData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const from = page * pageSize
        const to = from + pageSize - 1

        console.log(`[QUERY] Página ${page + 1}: registros ${from} a ${to}`)

        let query = supabaseClient
          .from(table)
          .select(selectStr)
          .range(from, to)

        // Aplicar filtros si existen
        url.searchParams.forEach((value, key) => {
          if (key.startsWith("eq_")) {
            query = query.eq(key.replace("eq_", ""), value)
          } else if (key.startsWith("neq_")) {
            query = query.neq(key.replace("neq_", ""), value)
          } else if (key.startsWith("in_")) {
            query = query.in(key.replace("in_", ""), value.split(","))
          }
        })

        const { data, error } = await query

        if (error) throw error

        if (data && data.length > 0) {
          allData = allData.concat(data)
          console.log(`[QUERY] Página ${page + 1}: ${data.length} registros obtenidos. Total acumulado: ${allData.length}`)

          // Si obtuvimos menos registros que el tamaño de página, ya no hay más
          if (data.length < pageSize) {
            hasMore = false
          } else {
            page++
          }
        } else {
          hasMore = false
        }
      }

      console.log(`[QUERY] Paginación completa. Total de registros: ${allData.length}`)

      return new Response(JSON.stringify(allData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // Para tablas no-auth, consulta normal con filtros
    let query = supabaseClient.from(table).select(selectStr)

    // Soportar filtros básicos predefinidos (ex: ?eq_col=valor, ?neq_col=valor)
    url.searchParams.forEach((value, key) => {
      if (key.startsWith("eq_")) {
        query = query.eq(key.replace("eq_", ""), value)
      } else if (key.startsWith("neq_")) {
        query = query.neq(key.replace("neq_", ""), value)
      } else if (key.startsWith("in_")) {
        query = query.in(key.replace("in_", ""), value.split(","))
      }
    })

    // Ejecutar consulta SELECT
    const { data, error } = await query

    if (error) throw error

    console.log(`[QUERY] Registros retornados: ${data?.length || 0}`)

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
