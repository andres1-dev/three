// Función para subir curvas a la BD
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
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { records } = body

    if (!records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de registros' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Subiendo ${records.length} curvas`)

    const results = {
      total: records.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Insertar en lotes de 50 (curvas son más pesadas por el array de detalles)
    const batchSize = 50
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      try {
        const { data, error } = await supabaseClient
          .from('CURVA')
          .insert(batch)

        if (error) throw error

        results.success += batch.length

      } catch (error: any) {
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

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        total: 0,
        success: 0,
        failed: 0,
        errors: [error.message || 'Internal server error']
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
