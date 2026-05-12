// Función para verificar qué OPs ya existen en CURVA
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

    // Obtener las OPs a verificar del body
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { ops } = body

    if (!ops || !Array.isArray(ops)) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un array de OPs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener OPs únicas y convertir a números si es necesario
    const uniqueOPs = [...new Set(ops.map((op: any) => {
      const opStr = String(op).trim()
      // Intentar convertir a número si es posible
      const opNum = Number(opStr)
      return isNaN(opNum) ? opStr : opNum
    }))]
    console.log(`Verificando ${uniqueOPs.length} OPs únicas`)
    console.log(`Ejemplo de OP:`, uniqueOPs[0], `(tipo: ${typeof uniqueOPs[0]})`)

    // Verificar en lotes de 1000 (límite de Supabase para IN)
    const batchSize = 1000
    const existingOPs: string[] = []

    for (let i = 0; i < uniqueOPs.length; i += batchSize) {
      const batch = uniqueOPs.slice(i, i + batchSize)
      
      const { data, error } = await supabaseClient
        .from('CURVA')
        .select('op')
        .in('op', batch)

      if (error) {
        console.error('Error querying CURVA:', error)
        throw error
      }

      if (data && data.length > 0) {
        existingOPs.push(...data.map((item: any) => {
          // Mantener el mismo tipo que enviamos
          const op = item.op
          return typeof uniqueOPs[0] === 'number' ? Number(op) : String(op)
        }))
      }
    }

    console.log(`Encontradas ${existingOPs.length} OPs duplicadas`)

    return new Response(
      JSON.stringify({ 
        existingOPs,
        checked: uniqueOPs.length,
        duplicates: existingOPs.length
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
