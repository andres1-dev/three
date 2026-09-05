import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get("token")
    const table = url.searchParams.get("table")
    const selectStr = url.searchParams.get("select") || "*"

    let authHeader = req.headers.get('Authorization')
    let supabaseClient;
    let forcedFilter = null;

    // ── GESTIÓN DE AUTENTICACIÓN ──
    
    // CASO A: Acceso por Token (Magic Link)
    if (token) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: tokenData, error: tokenErr } = await adminClient
        .from('ACCESOS_DIRECTOS')
        .select('*')
        .eq('token', token)
        .eq('activo', true)
        .single();

      if (tokenErr || !tokenData) {
        throw new Error("Token de acceso inválido o expirado");
      }

      // El token es válido. Usamos el adminClient para la consulta pero...
      supabaseClient = adminClient;
      // ...IMPORTANTE: Forzamos el filtro de planta asociado al token para mantener la seguridad
      if (tokenData.rol === 'GUEST' && tokenData.planta) {
        forcedFilter = { column: 'PLANTA', value: tokenData.planta };
      }
      
      console.log(`[QUERY] Acceso autorizado por Token: ${tokenData.descripcion}`);
    } 
    // CASO B: Acceso por Cabeceras (App o Basic Auth)
    else {
      if (!authHeader) {
        return new Response("Autenticación requerida", {
          status: 401,
          headers: { ...corsHeaders, "WWW-Authenticate": 'Basic realm="Acceso Seguro a MAP Data"' },
        });
      }

      if (authHeader.startsWith('Basic ')) {
        const decoded = atob(authHeader.replace('Basic ', ''));
        const [email, password] = decoded.split(':');
        const tempClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
        const { data: signInData, error: signInErr } = await tempClient.auth.signInWithPassword({ email, password });
        if (signInErr || !signInData.session) throw new Error("Credenciales inválidas");
        supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } }
        });
      } else {
        supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { Authorization: authHeader } }
        });
      }
    }

    if (!table) throw new Error("Se requiere el nombre de la tabla");

    // BLOQUEO DE SEGURIDAD: No permitir consultas directas a tablas de sistema o sensibles
    if (['USUARIOS', 'AUTH', 'USERS'].includes(table.toUpperCase())) {
      throw new Error("Acceso denegado a tabla protegida")
    }

    console.log(`[QUERY] Consultando tabla: ${table}, Select: ${selectStr}`)

    // Usar paginación automática para TODAS las tablas
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    console.log(`[QUERY] Usando paginación automática para traer todos los registros`)
    
    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1
      
      console.log(`[QUERY] Página ${page + 1}: registros ${from} a ${to}`)
      
      let query = supabaseClient.from(table).select(selectStr).range(from, to)
      
      // Aplicar filtro forzado por TOKEN (Seguridad)
      if (forcedFilter) {
        // Ajuste inteligente de nombre de columna para BUSINT
        const colName = (table.toUpperCase() === 'BUSINT' && forcedFilter.column === 'PLANTA') 
          ? 'NombrePlanta' 
          : forcedFilter.column;
        query = query.eq(colName, forcedFilter.value)
      }

      // Aplicar filtros de URL si existen
      url.searchParams.forEach((value, key) => {
        if (key.startsWith("eq_")) {
          query = query.eq(key.replace("eq_", ""), value)
        } else if (key.startsWith("in_")) {
          query = query.in(key.replace("in_", ""), value.split(","))
        }
      })
      
      const { data, error } = await query
      
      if (error) throw error
      
      if (data && data.length > 0) {
        allData = allData.concat(data)
        console.log(`[QUERY] Página ${page + 1}: ${data.length} registros obtenidos. Total acumulado: ${allData.length}`)
        
        // Si obtuvimos menos registros que el tamaño de página, ya no hay más
        if (data.length < pageSize) {
          hasMore = false
        } else {
          page++
        }
      } else {
        hasMore = false
      }
    }
    
    console.log(`[QUERY] Paginación completa. Total de registros: ${allData.length}`)
    
    return new Response(JSON.stringify(allData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error(`[QUERY ERROR]`, error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
