import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

/**
 * Edge Function: Chat Realtime
 * 
 * Función optimizada para operaciones de chat en tiempo real
 * - Lectura ultra-rápida de mensajes con filtros
 * - Sin caché, siempre datos frescos
 * - Bypasea RLS usando Service Role Key
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "get_messages"
    const productoraParam = url.searchParams.get("productora")
    const filtroProductora = (productoraParam !== null && productoraParam !== undefined)
      ? String(productoraParam).trim()
      : ""

    switch (action) {
      case "get_messages": {
        // Obtener mensajes de chat con filtros opcionales
        const idNovedad = url.searchParams.get("id_novedad")
        const rol = url.searchParams.get("rol") // ADMIN, GUEST, etc.
        const limit = parseInt(url.searchParams.get("limit") || "1000")

        let query = supabaseClient
          .from('chat')
          .select('*')
          .order('ts', { ascending: true })
          .limit(limit)

        // Aplicar filtros
        if (idNovedad) {
          query = query.eq('id_novedad', idNovedad)
        }

        // Enforce multi-tenant isolation
        if (filtroProductora) {
          query = query.eq('productora', filtroProductora)
        } else {
          throw new Error("Se requiere productora")
        }
        
        // IMPORTANTE: Filtrar por la columna rol, no autor
        // rol contiene: GUEST, ADMIN, USER-P
        // autor contiene: el nombre de la persona
        if (rol) {
          query = query.eq('rol', rol)
        }

        const { data, error } = await query

        if (error) throw error

        return new Response(JSON.stringify({
          success: true,
          messages: data || [],
          count: data?.length || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      case "get_unread_count": {
        // Contar mensajes no leídos por novedad
        const idNovedad = url.searchParams.get("id_novedad")
        const rol = url.searchParams.get("rol")

        if (!idNovedad) {
          throw new Error("Se requiere id_novedad")
        }

        let query = supabaseClient
          .from('chat')
          .select('*', { count: 'exact', head: true })
          .eq('id_novedad', idNovedad)
          .eq('is_read', false)

        if (filtroProductora) {
          query = query.eq('productora', filtroProductora)
        } else {
          throw new Error("Se requiere productora")
        }

        if (rol) {
          query = query.neq('autor', rol) // Mensajes que NO son míos
        }

        const { count, error } = await query

        if (error) throw error

        return new Response(JSON.stringify({
          success: true,
          unread_count: count || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      case "get_latest_by_novedad": {
        // Obtener el último mensaje de cada novedad (para badges)
        const rol = url.searchParams.get("rol") // Filtrar por rol del autor
        
        // Obtener todos los mensajes
        let query = supabaseClient
          .from('chat')
          .select('*')
          .order('ts', { ascending: false })

        if (filtroProductora) {
          query = query.eq('productora', filtroProductora)
        } else {
          throw new Error("Se requiere productora")
        }

        // IMPORTANTE: Filtrar por la columna rol, no autor
        // rol contiene: GUEST, ADMIN, USER-P
        // autor contiene: el nombre de la persona
        if (rol) {
          query = query.eq('rol', rol)
        }

        const { data, error } = await query

        if (error) throw error

        // Agrupar por id_novedad y quedarnos solo con el más reciente
        const latestByNovedad: Record<string, any> = {}
        
        for (const msg of (data || [])) {
          const novId = msg.id_novedad
          if (!latestByNovedad[novId]) {
            latestByNovedad[novId] = msg
          }
        }

        return new Response(JSON.stringify({
          success: true,
          messages: Object.values(latestByNovedad),
          count: Object.keys(latestByNovedad).length
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      case "get_all": {
        // Obtener TODOS los mensajes (sin filtros)
        if (!filtroProductora) {
          throw new Error("Se requiere productora")
        }

        const { data, error } = await supabaseClient
          .from('chat')
          .select('*')
          .eq('productora', filtroProductora)
          .order('ts', { ascending: true })

        if (error) throw error

        return new Response(JSON.stringify({
          success: true,
          messages: data || [],
          count: data?.length || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      default:
        throw new Error(`Acción no soportada: ${action}`)
    }

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
