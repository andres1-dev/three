// Función para obtener barcodes de la tabla BARRAS
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente Supabase con la service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Obtener las combinaciones a buscar del body
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { items } = body

    if (!items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Buscando barcodes para ${items.length} items`)

    // Crear un mapa para resultados
    const barcodeMap: Record<string, string> = {}

    // Agrupar por referencia para optimizar queries
    const byReferencia: Record<string, any[]> = {}
    for (const item of items) {
      const ref = String(item.referencia).trim()
      if (!byReferencia[ref]) {
        byReferencia[ref] = []
      }
      byReferencia[ref].push(item)
    }

    // Buscar por referencia (más eficiente)
    for (const [referencia, refItems] of Object.entries(byReferencia)) {
      const { data, error } = await supabaseClient
        .from('BARRAS')
        .select('referencia, talla, id_color, barcode')
        .eq('referencia', referencia)

      if (error) {
        console.error(`Error buscando referencia ${referencia}:`, error)
        continue
      }

      if (data && data.length > 0) {
        // Crear mapa de esta referencia
        for (const row of data) {
          const key = `${String(row.referencia).trim()}-${String(row.talla).trim()}-${String(row.id_color).trim()}`
          barcodeMap[key] = row.barcode
        }
      }
    }

    console.log(`Encontrados ${Object.keys(barcodeMap).length} barcodes`)

    return new Response(
      JSON.stringify({ 
        barcodeMap,
        requested: items.length,
        found: Object.keys(barcodeMap).length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
