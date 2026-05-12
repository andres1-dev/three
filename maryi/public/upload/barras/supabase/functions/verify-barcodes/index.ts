// Función para verificar qué barcodes ya existen en la BD
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
    // Crear cliente Supabase con la service role key (solo disponible en el servidor)
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

    // Obtener los barcodes a verificar del body
    const { barcodes } = await req.json()

    if (!barcodes || !Array.isArray(barcodes)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de barcodes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener barcodes únicos
    const uniqueBarcodes = [...new Set(barcodes.map(b => String(b).trim()))]
    console.log(`Verificando ${uniqueBarcodes.length} barcodes únicos`)

    // Verificar en lotes de 500 (optimizado para evitar timeouts)
    const batchSize = 500
    const existingBarcodes = []
    let processedCount = 0

    for (let i = 0; i < uniqueBarcodes.length; i += batchSize) {
      const batch = uniqueBarcodes.slice(i, i + batchSize)
      
      try {
        const { data, error } = await supabaseClient
          .from('BARRAS')
          .select('barcode')
          .in('barcode', batch)

        if (error) {
          console.error(`Error en lote ${Math.floor(i / batchSize) + 1}:`, error)
          throw error
        }

        if (data && data.length > 0) {
          existingBarcodes.push(...data.map(item => item.barcode))
        }

        processedCount += batch.length
        console.log(`Progreso: ${processedCount}/${uniqueBarcodes.length} (${Math.round(processedCount/uniqueBarcodes.length*100)}%)`)
        
      } catch (error) {
        console.error(`Error procesando lote ${Math.floor(i / batchSize) + 1}:`, error)
        throw error
      }
    }

    console.log(`Encontrados ${existingBarcodes.length} duplicados`)

    return new Response(
      JSON.stringify({ 
        existingBarcodes,
        checked: uniqueBarcodes.length,
        duplicates: existingBarcodes.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
