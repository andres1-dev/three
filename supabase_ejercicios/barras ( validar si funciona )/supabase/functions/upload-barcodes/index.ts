// Función para subir barcodes a la BD
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

    // Obtener los registros a subir del body
    const { records } = await req.json()

    if (!records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de registros' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Subiendo ${records.length} registros`)

    const results = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: []
    }

    // Insertar en lotes de 500
    const batchSize = 500
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      try {
        // Usar upsert con ignoreDuplicates para manejar conflictos
        const { data, error } = await supabaseClient
          .from('BARRAS')
          .upsert(batch, { 
            onConflict: 'barcode',
            ignoreDuplicates: true 
          })

        if (error) throw error

        results.success += batch.length

      } catch (error) {
        console.error(`Error en lote ${Math.floor(i / batchSize) + 1}:`, error)
        results.failed += batch.length
        results.errors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      }
    }

    console.log(`Completado: ${results.success} exitosos, ${results.failed} fallidos`)

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        total: 0,
        success: 0,
        failed: 0,
        errors: [error.message]
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
