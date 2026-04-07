// Función ULTRA OPTIMIZADA - Filtros SQL directos con fechas YYYY-MM-DD
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    const url = new URL(req.url)
    
    // Obtener parámetros de fecha (formato YYYY-MM-DD)
    const fechaInicio = url.searchParams.get('fechaInicio')
    const fechaFin = url.searchParams.get('fechaFin')
    
    if (!fechaInicio || !fechaFin) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Se requieren fechaInicio y fechaFin en formato YYYY-MM-DD'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
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

    console.log(`📦 Cargando datos desde ${fechaInicio} hasta ${fechaFin}...`)

    // Cargar TODAS las facturas sin límite (paginación automática)
    let facturas: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: batch, error: facturasError } = await supabaseClient
        .from('SIESA')
        .select(`
          *,
          PROVEEDORES!SIESA_Compáa_fkey (
            proveedor
          )
        `)
        .gte('Fecha', fechaInicio)
        .lte('Fecha', fechaFin)
        .order('Fecha', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (facturasError) throw facturasError
      
      if (batch && batch.length > 0) {
        // Aplanar el objeto PROVEEDORES para tener el proveedor directamente
        const batchConProveedor = batch.map(f => ({
          ...f,
          proveedor: f.PROVEEDORES?.proveedor || null,
          PROVEEDORES: undefined // Eliminar el objeto anidado
        }))
        facturas = facturas.concat(batchConProveedor)
        hasMore = batch.length === pageSize
        page++
        console.log(`📄 Página ${page}: ${batch.length} facturas (total: ${facturas.length})`)
      } else {
        hasMore = false
      }
    }

    console.log(`✅ ${facturas.length} facturas encontradas`)

    // Obtener solo las facturas del resultado para filtrar entregas
    const nrosDocumento = facturas.map(f => f['Nro documento'])

    // Si no hay facturas, retornar vacío
    if (nrosDocumento.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [],
          stats: {
            totalFacturas: 0,
            totalEntregas: 0,
            facturasConEntregas: 0,
            tiempoCarga: `${Date.now() - startTime}ms`,
            rangoFechas: `${fechaInicio} - ${fechaFin}`
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cargar entregas: si hay muchas facturas (>100), cargar todas y filtrar en memoria
    // Si hay pocas, usar .in() para ser más eficiente
    let entregas: any[] = []
    
    if (nrosDocumento.length > 100) {
      console.log(`⚡ Muchas facturas (${nrosDocumento.length}), cargando todas las entregas...`)
      
      // Cargar TODAS las entregas sin límite
      let todasEntregas: any[] = []
      let entregasPage = 0
      let hasMoreEntregas = true

      while (hasMoreEntregas) {
        const { data: batchEntregas, error: entregasError } = await supabaseClient
          .from('ENTREGAS')
          .select('*')
          .range(entregasPage * pageSize, (entregasPage + 1) * pageSize - 1)

        if (entregasError) throw entregasError
        
        if (batchEntregas && batchEntregas.length > 0) {
          todasEntregas = todasEntregas.concat(batchEntregas)
          hasMoreEntregas = batchEntregas.length === pageSize
          entregasPage++
          console.log(`📦 Entregas página ${entregasPage}: ${batchEntregas.length} (total: ${todasEntregas.length})`)
        } else {
          hasMoreEntregas = false
        }
      }
      
      // Filtrar en memoria
      const nrosSet = new Set(nrosDocumento)
      entregas = todasEntregas.filter(e => nrosSet.has(e.Factura))
      
    } else {
      console.log(`⚡ Pocas facturas (${nrosDocumento.length}), usando filtro .in()...`)
      const { data: entregasFiltradas, error: entregasError } = await supabaseClient
        .from('ENTREGAS')
        .select('*')
        .in('Factura', nrosDocumento)

      if (entregasError) throw entregasError
      entregas = entregasFiltradas || []
    }

    const loadTime = Date.now() - startTime
    console.log(`✅ ${facturas.length} facturas, ${entregas.length} entregas en ${loadTime}ms`)

    // Agrupar entregas por factura
    const entregasPorFactura = new Map<string, any[]>()
    entregas.forEach(e => {
      const factura = e.Factura
      if (!entregasPorFactura.has(factura)) {
        entregasPorFactura.set(factura, [])
      }
      entregasPorFactura.get(factura)!.push(e)
    })

    // Combinar facturas con entregas
    const data = facturas.map(f => ({
      ...f,
      entregas: entregasPorFactura.get(f['Nro documento']) || []
    }))

    const totalTime = Date.now() - startTime
    console.log(`🎉 ${data.length} facturas procesadas en ${totalTime}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        stats: {
          totalFacturas: data.length,
          totalEntregas: entregas.length,
          facturasConEntregas: data.filter(f => f.entregas.length > 0).length,
          tiempoCarga: `${totalTime}ms`,
          rangoFechas: `${fechaInicio} - ${fechaFin}`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
