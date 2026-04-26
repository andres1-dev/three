// Edge Function unificada para BARRAS
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Acción: verify ────────────────────────────────────────────────────────────
async function verifyBarcodes(supabase: any, barcodes: string[]) {
  const uniqueBarcodes = [...new Set(barcodes.map((b: any) => String(b).trim()))]
  console.log(`Verificando ${uniqueBarcodes.length} barcodes únicos`)

  const batchSize = 500
  const existingBarcodes: string[] = []

  for (let i = 0; i < uniqueBarcodes.length; i += batchSize) {
    const batch = uniqueBarcodes.slice(i, i + batchSize)
    const { data, error } = await supabase.from('BARRAS').select('barcode').in('barcode', batch)
    if (error) throw error
    if (data?.length) existingBarcodes.push(...data.map((item: any) => item.barcode))
  }

  return { existingBarcodes, checked: uniqueBarcodes.length, duplicates: existingBarcodes.length }
}

// ── Acción: upload ────────────────────────────────────────────────────────────
async function uploadBarcodes(supabase: any, records: any[]) {
  console.log(`Subiendo ${records.length} registros`)
  const results = { total: records.length, success: 0, failed: 0, errors: [] as string[] }
  const batchSize = 250

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    try {
      const { error } = await supabase.from('BARRAS').upsert(batch, { onConflict: 'barcode', ignoreDuplicates: true })
      if (error) throw error
      results.success += batch.length
    } catch (err: any) {
      results.failed += batch.length
      results.errors.push(`Lote ${batchNum}: ${err.message}`)
    }
  }

  return results
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action } = body

    if (!action) {
      return new Response(JSON.stringify({ error: 'Se requiere el campo action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = getClient()
    let result: any

    if (action === 'verify') {
      if (!body.barcodes || !Array.isArray(body.barcodes))
        return new Response(JSON.stringify({ error: 'Se requiere barcodes[]' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      result = await verifyBarcodes(supabase, body.barcodes)

    } else if (action === 'upload') {
      if (!body.records || !Array.isArray(body.records))
        return new Response(JSON.stringify({ error: 'Se requiere records[]' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      result = await uploadBarcodes(supabase, body.records)

    } else {
      return new Response(JSON.stringify({ error: `Acción desconocida: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (err: any) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
