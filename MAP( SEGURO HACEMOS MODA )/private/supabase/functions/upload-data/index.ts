// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BusintData {
  OP: string;
  Ref: string;
  InvPlanta: number;
  NombrePlanta: string;
  FSalidaConf: string;
  FEntregaConf: string;
  Proceso: string;
  Descripcion: string;
  Cuento: string;
  Genero: string;
  Obs: string;
  Costo: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with SERVICE_ROLE key to bypass RLS
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

    // 1. VALIDACIÓN DE SEGURIDAD (Nivel 10)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado: Falta token de acceso' }), { status: 401 })
    }

    // Usar el cliente para verificar la identidad del usuario que hace la petición
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), { status: 401 })
    }

    // Verificar si el usuario es ADMIN (Seguridad extra en servidor)
    const role = user.user_metadata?.role
    if (role !== 'ADMIN') {
      console.warn(`⚠️ Intento de acceso no autorizado de: ${user.email}`)
      return new Response(JSON.stringify({ error: 'Permisos insuficientes: Se requiere rol ADMIN' }), { status: 403 })
    }

    console.log(`✅ Petición autorizada para ADMIN: ${user.email}`)

    // Get request body
    const { data, type } = await req.json()

    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format. Expected an array.')
    }

    if (!type || (type !== 'CONFECCION' && type !== 'PROCESOS')) {
      throw new Error('Invalid type. Expected "CONFECCION" or "PROCESOS".')
    }

    // Usar tabla única BUSINT para ambos tipos
    const tableName = 'BUSINT'
    
    // 1. OBTENER ESTADÍSTICAS REALES (Comparación de clave compuesta)
    // Usamos una técnica más robusta para filtrar múltiples pares OP+Proceso
    const keysToCheck = data.map(item => `and(OP.eq."${item.OP}",Proceso.eq."${item.Proceso}")`).join(',')
    
    // Consultar cuáles de estos ya existen (Traemos solo las claves para ahorrar banda)
    const { data: existingRecords, error: fetchError } = await supabaseClient
      .from(tableName)
      .select('OP, Proceso')
      .or(keysToCheck)

    // Log para depuración en consola de Supabase
    console.log(`Buscando duplicados para ${data.length} registros. Encontrados: ${existingRecords?.length || 0}`)

    const existingKeys = new Set(existingRecords?.map(r => `${String(r.OP).trim()}-${String(r.Proceso).trim()}`) || [])
    
    let insertedCount = 0
    let updatedCount = 0
    
    data.forEach(item => {
      const key = `${String(item.OP).trim()}-${String(item.Proceso).trim()}`
      if (existingKeys.has(key)) {
        updatedCount++
      } else {
        insertedCount++
      }
    })

    // 2. REALIZAR EL UPSERT
    const { data: upsertedData, error } = await supabaseClient
      .from(tableName)
      .upsert(data, { 
        onConflict: 'OP,Proceso',
        ignoreDuplicates: false // Update existing records
      })
      .select()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronización completada: ${upsertedData.length} registros procesados.`,
        data: {
          total: upsertedData.length,
          inserted: insertedCount,
          updated: updatedCount,
          errors: 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-data' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"data":[{"OP":"123","Ref":"REF001",...}],"type":"CONFECCION"}'

*/
