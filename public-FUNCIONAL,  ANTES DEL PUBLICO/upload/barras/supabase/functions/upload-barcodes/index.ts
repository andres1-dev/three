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

    // Insertar en lotes de 250 (optimizado para velocidad)
    const batchSize = 250
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(records.length / batchSize)
      
      try {
        console.log(`Procesando lote ${batchNum}/${totalBatches} (${batch.length} registros)`)
        
        // Usar upsert con ignoreDuplicates para manejar conflictos
        const { data, error } = await supabaseClient
          .from('BARRAS')
          .upsert(batch, { 
            onConflict: 'barcode',
            ignoreDuplicates: true 
          })

        if (error) {
          console.error(`Error en lote ${batchNum}:`, error)
          throw error
        }

        results.success += batch.length
        console.log(`Lote ${batchNum} completado. Progreso: ${results.success}/${records.length}`)

      } catch (error: any) {
        console.error(`Error en lote ${batchNum}:`, error)
        results.failed += batch.length
        results.errors.push(`Lote ${batchNum}: ${error.message}`)
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
