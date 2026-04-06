// Función para validar un código de barras individual
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

    // Obtener el código de barras del body
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { barcode } = body

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Se requiere un código de barras' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Validando código de barras: ${barcode}`)

    // Buscar el código de barras en la tabla BARRAS
    const { data: barcodeData, error: barcodeError } = await supabaseClient
      .from('BARRAS')
      .select('barcode, referencia, talla, id_color')
      .eq('barcode', barcode)
      .single()

    if (barcodeError) {
      console.error('Error buscando código:', barcodeError)
      
      // Si no se encuentra, retornar found: false
      if (barcodeError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ 
            found: false,
            barcode: barcode
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }
      
      throw barcodeError
    }

    // Buscar el color en la tabla COLORES
    const { data: colorData, error: colorError } = await supabaseClient
      .from('COLORES')
      .select('color')
      .eq('id_color', barcodeData.id_color)
      .single()

    let color = 'N/A'
    
    if (colorData && !colorError) {
      color = colorData.color
    }

    console.log(`Código encontrado: ${barcodeData.referencia} - ${color} - ${barcodeData.talla}`)

    return new Response(
      JSON.stringify({ 
        found: true,
        barcode: barcodeData.barcode,
        referencia: barcodeData.referencia,
        talla: barcodeData.talla,
        id_color: barcodeData.id_color,
        color: color
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
