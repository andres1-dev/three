// Edge Function unificada para CURVA
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

// ── Acción: verify-ops ────────────────────────────────────────────────────────
async function verifyOps(supabase: any, ops: any[]) {
  const uniqueOPs = [...new Set(ops.map((op: any) => {
    const n = Number(String(op).trim())
    return isNaN(n) ? String(op).trim() : n
  }))]
  console.log(`Verificando ${uniqueOPs.length} OPs únicas`)

  const batchSize = 1000
  const existingOPs: any[] = []

  for (let i = 0; i < uniqueOPs.length; i += batchSize) {
    const batch = uniqueOPs.slice(i, i + batchSize)
    const { data, error } = await supabase.from('CURVA').select('op').in('op', batch)
    if (error) throw error
    if (data?.length) {
      existingOPs.push(...data.map((item: any) =>
        typeof uniqueOPs[0] === 'number' ? Number(item.op) : String(item.op)
      ))
    }
  }

  return { existingOPs, checked: uniqueOPs.length, duplicates: existingOPs.length }
}

// ── Acción: get-barcodes ──────────────────────────────────────────────────────
async function getBarcodes(supabase: any, items: any[]) {
  console.log(`Buscando barcodes para ${items.length} items`)
  const barcodeMap: Record<string, string> = {}

  const byReferencia: Record<string, any[]> = {}
  for (const item of items) {
    const ref = String(item.referencia).trim()
    if (!byReferencia[ref]) byReferencia[ref] = []
    byReferencia[ref].push(item)
  }

  for (const [referencia] of Object.entries(byReferencia)) {
    const { data, error } = await supabase
      .from('BARRAS')
      .select('referencia, talla, id_color, barcode')
      .eq('referencia', referencia)
    if (error) { console.error(`Error ref ${referencia}:`, error); continue }
    if (data?.length) {
      for (const row of data) {
        const key = `${String(row.referencia).trim()}-${String(row.talla).trim()}-${String(row.id_color).trim()}`
        barcodeMap[key] = row.barcode
      }
    }
  }

  return { barcodeMap, requested: items.length, found: Object.keys(barcodeMap).length }
}

// ── Acción: upload ────────────────────────────────────────────────────────────
async function uploadCurvas(supabase: any, records: any[]) {
  console.log(`Subiendo ${records.length} curvas`)
  const results = { total: records.length, success: 0, failed: 0, errors: [] as string[] }
  const batchSize = 50

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    try {
      const { error } = await supabase.from('CURVA').insert(batch)
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

    if (action === 'verify-ops') {
      if (!body.ops || !Array.isArray(body.ops))
        return new Response(JSON.stringify({ error: 'Se requiere ops[]' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      result = await verifyOps(supabase, body.ops)

    } else if (action === 'get-barcodes') {
      if (!body.items || !Array.isArray(body.items))
        return new Response(JSON.stringify({ error: 'Se requiere items[]' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      result = await getBarcodes(supabase, body.items)

    } else if (action === 'upload') {
      if (!body.records || !Array.isArray(body.records))
        return new Response(JSON.stringify({ error: 'Se requiere records[]' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      result = await uploadCurvas(supabase, body.records)

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
