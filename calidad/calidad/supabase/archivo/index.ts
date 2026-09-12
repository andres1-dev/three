// ================================================================
// Edge Function: archivo
// Módulo de Archivo — consulta de Mis Reportes y Liquidaciones
// Acciones:
//   LISTAR_REPORTES      → tabla reportes (scoped por email/rol)
//   LISTAR_LIQUIDACIONES → tabla liquidaciones_rodamiento (scoped por email/rol)
//   OBTENER_REPORTE      → reporte completo por id_reporte
//   CREAR_PLANTA         → crear planta en tabla plantas
//   ACTUALIZAR_PLANTA    → actualizar planta en tabla plantas
// ================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Roles con acceso total (ven todos los registros) ──────────
const ROLES_ADMIN = ['ADMIN', 'MODERATOR', 'MODERADOR']

// ================================================================
// LISTAR_REPORTES
// Devuelve reportes de la tabla `reportes` filtrados por mes/año.
// - ADMIN / MODERADOR : todos los registros (o filtrados por email si se pasa)
// - USER-C            : solo sus propios registros (por email)
// - USER-P / USER-I   : por id_productora
// ================================================================
async function listarReportes(adminClient: any, payload: any, userEmail: string, userRol: string) {
    const { fecha, mes, anio, email: emailFiltro, productora } = payload

    // Construir filtro de fecha
    // Prioridad a búsqueda por fecha específica (HOY o día seleccionado YYYY-MM-DD)
    let q = adminClient
        .from('reportes')
        .select('*')
        .order('fecha', { ascending: false })

    if (fecha) {
        const fStr = String(fecha).trim()
        const ymd = fStr.split('T')[0]
        const m = ymd.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
        if (m) {
            const anioNum = parseInt(m[1], 10)
            const mesNum = parseInt(m[2], 10) - 1
            const diaNum = parseInt(m[3], 10)

            // Rango del día completo en UTC y hora local colombiana (UTC-5)
            const desde = new Date(Date.UTC(anioNum, mesNum, diaNum, 0, 0, 0)).toISOString()
            const hasta = new Date(Date.UTC(anioNum, mesNum, diaNum + 1, 5, 59, 59, 999)).toISOString()

            q = q.gte('fecha', desde).lte('fecha', hasta)
        } else {
            // Para búsquedas parciales en string de fecha, convertimos a texto
            q = q.or(`fecha::text.ilike.%${fStr}%`)
        }
    } else if (mes && anio) {
        const mesNum  = Number(mes)
        const anioNum = Number(anio)
        const desde   = new Date(anioNum, mesNum - 1, 1).toISOString()
        const hasta   = new Date(anioNum, mesNum, 0, 23, 59, 59).toISOString()
        q = q.gte('fecha', desde).lte('fecha', hasta)
    }

    const esAdmin = ROLES_ADMIN.includes(userRol.toUpperCase())

    if (esAdmin) {
        // Admin puede filtrar por correo de auditora si lo envía
        if (emailFiltro && emailFiltro.trim()) {
            q = q.ilike('correo', `%${emailFiltro.trim()}%`)
        }
    } else if (userRol.toUpperCase() === 'USER-P' || userRol.toUpperCase() === 'USER-I') {
        // Productora: filtrar por id_productora
        if (productora) {
            q = q.eq('id_productora', String(productora))
        }
    } else {
        // USER-C u otros: solo sus reportes por correo
        if (userEmail) {
            q = q.ilike('correo', userEmail)
        }
    }

    // Excluir anulados (estado = false)
    q = q.neq('estado', false)

    const { data, error } = await q
    if (error) throw new Error(`Error al listar reportes: ${error.message}`)

    // Normalizar campos a mayúsculas para compatibilidad con la UI
    const reportes = (data || []).map((r: any) => ({
        ID:            r.id_reporte  || '',
        LOTE:          r.op          || '',
        REFERENCIA:    r.referencia  || '',
        PLANTA:        r.planta      || '',
        PRODUCTORA:    r.productora  || '',
        ID_PRODUCTORA: r.id_productora || '',
        PROCESO:       r.proceso     || '',
        LINEA:         r.linea       || '',
        PRENDA:        r.prenda      || '',
        GENERO:        r.genero      || '',
        FECHA:         r.fecha       || '',
        TIPO_VISITA:   r.tipo_visita || 'AUDITORIA',
        CONCLUSION:    r.conclusion  || '',
        OBSERVACIONES: r.observaciones || '',
        EMAIL:         r.correo      || r.auditor || '',
        AUDITOR:       r.auditor     || '',
        SOPORTE:       r.soporte     || '',
        FIRMA_SVG:     r.firma_svg   || '',
        NOVEDADES:     r.novedades_auditoria || null,
        DESTINO_PLANTA: r.destino_planta || '',
        DESTINO_PROCESO: r.destino_proceso || '',
    }))

    return { success: true, data: reportes }
}

// ================================================================
// LISTAR_LIQUIDACIONES
// Devuelve registros de `liquidaciones_rodamiento` por mes/año.
// - ADMIN / MODERADOR : todos (o filtro por correo si se pasa)
// - Resto             : solo los propios (por correo)
// ================================================================
async function listarLiquidaciones(adminClient: any, payload: any, userEmail: string, userRol: string) {
    const { mes, anio, email: emailFiltro } = payload

    let q = adminClient
        .from('liquidaciones_rodamiento')
        .select('*')
        .order('created_at', { ascending: false })

    const esAdmin = ROLES_ADMIN.includes(userRol.toUpperCase())

    if (esAdmin) {
        if (emailFiltro && emailFiltro.trim()) {
            // El campo en la tabla puede ser correo o email
            q = q.or(`correo.ilike.%${emailFiltro.trim()}%,email.ilike.%${emailFiltro.trim()}%`)
        }
    } else {
        // Filtrar solo las del usuario autenticado
        q = q.or(`correo.ilike.${userEmail},email.ilike.${userEmail}`)
    }

    // Filtrar por mes/año usando el campo periodo (formato "MM/YYYY" o fecha ISO)
    // Se hace filtro client-side después de obtener datos para mayor compatibilidad
    const { data, error } = await q
    if (error) throw new Error(`Error al listar liquidaciones: ${error.message}`)

    let liquidaciones = data || []

    // Filtro de período si se proporcionan mes y año
    if (mes && anio) {
        const mesNum = Number(mes)
        const anioNum = Number(anio)
        liquidaciones = liquidaciones.filter((liq: any) => {
            // Intentar parsear desde campo `periodo` ("MM/YYYY" o "YYYY-MM")
            const periodo = liq.periodo || liq.created_at || ''
            if (!periodo) return true // sin fecha → incluir

            // Formato "MM/YYYY"
            const matchSlash = String(periodo).match(/^(\d{1,2})\/(\d{4})$/)
            if (matchSlash) {
                return parseInt(matchSlash[1]) === mesNum && parseInt(matchSlash[2]) === anioNum
            }

            // Formato ISO desde created_at
            try {
                const d = new Date(periodo)
                return (d.getMonth() + 1) === mesNum && d.getFullYear() === anioNum
            } catch (_) {
                return true
            }
        })
    }

    // Normalizar estructura
    const resultado = liquidaciones.map((liq: any) => ({
        ID:       liq.id       || '',
        CORREO:   liq.correo   || liq.email || '',
        PERIODO:  liq.periodo  || '',
        CC:       liq.cc       || liq.cedula || '',
        DESCUENTOS: liq.descuentos || '',
        VALOR:    liq.valor    || liq.total  || null,
        ESTADO:   liq.estado   || 'PENDIENTE',
        TIPO:     liq.tipo     || 'Rodamiento',
        PRODUCTORA: liq.productora || '',
        FECHA:    liq.created_at || liq.fecha || '',
    }))

    return { success: true, data: resultado }
}

// ================================================================
// OBTENER_REPORTE
// Devuelve el reporte completo por id_reporte + datos del auditor
// desde perfiles (nombre, cedula, firma_svg).
// Solo puede acceder el propio auditor o admin/moderador.
// ================================================================
async function obtenerReporte(adminClient: any, payload: any, userEmail: string, userRol: string) {
    const { id_reporte } = payload
    if (!id_reporte) throw new Error('Se requiere id_reporte')

    // 1. Obtener el reporte
    const { data: rows, error } = await adminClient
        .from('reportes')
        .select('*')
        .eq('id_reporte', id_reporte)
        .limit(1)

    if (error) throw new Error(`Error al obtener reporte: ${error.message}`)
    if (!rows || rows.length === 0) throw new Error('Reporte no encontrado')

    const r = rows[0]

    // 2. Verificar acceso: admin ve todo; el resto solo sus propios reportes
    const esAdmin = ROLES_ADMIN.includes(userRol)
    if (!esAdmin) {
        const correoReporte = (r.correo || '').toLowerCase().trim()
        if (correoReporte !== userEmail) {
            throw new Error('No tienes permiso para ver este reporte')
        }
    }

    // 3. Enriquecer con datos del auditor desde Auth y perfiles
    let auditorCedula = ''
    let auditorNombre = r.auditor || ''
    let auditorFirma = ''

    try {
        const correoBuscado = (r.correo || '').toLowerCase().trim()
        let authUser: any = null

        // A. Buscar usuario en Auth para obtener cédula desde user_metadata
        try {
            const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
            const users = authData?.users || []
            if (correoBuscado) {
                authUser = users.find((u: any) =>
                    (u.email || '').toLowerCase().trim() === correoBuscado
                )
            }
            if (!authUser && r.auditor) {
                const nomBuscado = r.auditor.trim().toLowerCase()
                authUser = users.find((u: any) => {
                    const m = u.user_metadata || {}
                    const nm = (m.full_name || m.name || m.usuario || '').toLowerCase()
                    return nm && (nm.includes(nomBuscado) || nomBuscado.includes(nm))
                })
            }
        } catch (authErr) {
            console.warn('[archivo] Error consultando admin.listUsers:', authErr)
        }

        if (authUser) {
            const meta = authUser.user_metadata || {}
            auditorCedula = meta.cedula || meta.ID_USUARIO || meta.documento || ''
            if (!auditorNombre && (meta.full_name || meta.name || meta.usuario)) {
                auditorNombre = meta.full_name || meta.name || meta.usuario
            }
        }

        // B. Buscar perfil en tabla perfiles para obtener la firma_svg
        let perfil: any = null
        if (authUser?.id) {
            const { data: p } = await adminClient
                .from('perfiles')
                .select('*')
                .eq('auth_user_id', authUser.id)
                .maybeSingle()
            if (p) perfil = p
        }

        if (!perfil && correoBuscado) {
            const { data: p } = await adminClient
                .from('perfiles')
                .select('*')
                .ilike('email', correoBuscado)
                .maybeSingle()
            if (p) perfil = p
        }

        if (!perfil && r.auditor) {
            const { data: p } = await adminClient
                .from('perfiles')
                .select('*')
                .ilike('full_name', `%${r.auditor.trim()}%`)
                .maybeSingle()
            if (p) perfil = p
        }

        if (perfil) {
            if (perfil.firma_svg) auditorFirma = perfil.firma_svg
            if (!auditorCedula && perfil.cedula) auditorCedula = perfil.cedula
            if (!auditorNombre && perfil.full_name) auditorNombre = perfil.full_name
        }
    } catch (err) {
        console.warn('[archivo] Error enriqueciendo auditor:', err)
    }

    // 4. Enriquecer con datos de la productora
    let productoraNombre = r.productora || ''
    let productoraNit = r.nit_productora || r.nit || ''
    if (r.id_productora) {
        try {
            const { data: prod } = await adminClient
                .from('productoras')
                .select('productora, nit')
                .eq('id_productora', r.id_productora)
                .single()
            if (prod?.productora) productoraNombre = `${r.id_productora} — ${prod.productora}`
            if (prod?.nit) productoraNit = prod.nit
        } catch (_) { /* noop */ }
    }

    // 5. Traer curva de producción desde tabla extensiones (op + id_productora)
    let curvaExtensiones: any[] = []
    try {
        const opNum = Number(r.op) || 0
        const idProd = String(r.id_productora || '').trim()
        if (opNum && idProd) {
            const { data: extRows } = await adminClient
                .from('extensiones')
                .select('extensiones')
                .eq('op', opNum)
                .eq('id_productora', idProd)
                .limit(1)
                .single()

            if (extRows?.extensiones) {
                let ext = extRows.extensiones
                if (typeof ext === 'string') {
                    try { ext = JSON.parse(ext) } catch (_) { ext = [] }
                }
                curvaExtensiones = Array.isArray(ext) ? ext : []
            }
        }
    } catch (_) { /* noop — curva opcional */ }

    return {
        success: true,
        data: {
            id_reporte:           r.id_reporte,
            fecha:                r.fecha,
            op:                   r.op,
            referencia:           r.referencia,
            cantidad:             r.cantidad,
            planta:               r.planta,
            salida:               r.salida,
            entrada:              r.entrada,
            linea:                r.linea,
            proceso:              r.proceso,
            prenda:               r.prenda,
            genero:               r.genero,
            correo:               r.correo,
            localizacion:         r.localizacion,
            tipo_visita:          r.tipo_visita,
            conclusion:           r.conclusion,
            observaciones:        r.observaciones,
            soporte:              r.soporte,
            id_productora:        r.id_productora,
            productora:           productoraNombre,
            nit_productora:       productoraNit || '',
            firma_svg:            r.firma_svg,
            destino_proceso:      r.destino_proceso,
            destino_planta:       r.destino_planta,
            avance:               r.avance,
            novedades_auditoria:  r.novedades_auditoria,
            auditor:              r.auditor,
            estado:               r.estado,
            // Datos enriquecidos del auditor
            auditor_nombre:  auditorNombre || r.auditor || '',
            auditor_cedula:  auditorCedula || '',
            auditor_firma:   auditorFirma  || '',
            // Curva de producción desde tabla extensiones
            curva_extensiones: curvaExtensiones,
        }
    }
}

// ================================================================
// SERVIDOR PRINCIPAL
// ================================================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        let payload: any
        try {
            payload = await req.json()
        } catch (_) {
            throw new Error('Body JSON inválido')
        }

        const { accion } = payload
        if (!accion) throw new Error('Se requiere el campo "accion"')

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
        if (!supabaseUrl || !supabaseKey) throw new Error('Configuración de Supabase no disponible')

        // Validar sesión del usuario
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Se requiere autenticación')

        const userClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authError } = await userClient.auth.getUser()
        if (authError || !user) throw new Error('Usuario no autenticado')

        // Cliente admin con SERVICE_ROLE para bypass de RLS
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (!serviceRoleKey) throw new Error('Service role key no disponible')

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // Obtener rol y email del usuario desde perfiles
        const { data: perfil } = await adminClient
            .from('perfiles')
            .select('rol, email')
            .eq('auth_user_id', user.id)
            .single()

        const userEmail = (perfil?.email || user.email || '').toLowerCase().trim()
        const userRol   = (perfil?.rol   || user.user_metadata?.ROL || '').toUpperCase()

        console.log(`[archivo] accion=${accion} email=${userEmail} rol=${userRol}`)

        let result: any

        switch (accion.toUpperCase()) {
            case 'LISTAR_REPORTES':
                result = await listarReportes(adminClient, payload, userEmail, userRol)
                break

            case 'LISTAR_LIQUIDACIONES':
                result = await listarLiquidaciones(adminClient, payload, userEmail, userRol)
                break

            case 'OBTENER_REPORTE':
                result = await obtenerReporte(adminClient, payload, userEmail, userRol)
                break

            case 'LISTAR_PLANTAS':
                result = await listarPlantas(adminClient)
                break

            case 'CREAR_PLANTA':
                result = await crearPlanta(adminClient, payload)
                break

            case 'ACTUALIZAR_PLANTA':
                result = await actualizarPlanta(adminClient, payload)
                break

            default:
                throw new Error(`Acción no reconocida: ${accion}`)
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (err: any) {
        console.error('[archivo] Error:', err.message)
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

// ================================================================
// LISTAR_PLANTAS
// Obtiene todas las plantas con paginación automática
// ================================================================
async function listarPlantas(adminClient: any) {
    let allData: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true

    while (hasMore) {
        const { data, error } = await adminClient
            .from('plantas')
            .select('*')
            .order('planta', { ascending: true })
            .range(from, from + limit - 1)

        if (error) throw new Error(`Error al listar plantas: ${error.message}`)

        if (data && data.length > 0) {
            allData = allData.concat(data)
            from += limit
            hasMore = data.length === limit
        } else {
            hasMore = false
        }
    }

    const normalizedData = allData.map((p: any) => ({
        ID_PLANTA:  p.id_planta?.toString() || '',
        id_planta:  p.id_planta,
        PLANTA:     p.planta || '',
        planta:     p.planta || '',
        CORREO:     p.correo || '',
        EMAIL:      p.correo || '',
        correo:     p.correo || '',
        email:      p.correo || '',
        TELEFONO:   p.telefono?.toString() || '',
        telefono:   p.telefono?.toString() || '',
        tel:        p.telefono?.toString() || '',
        ROL:        p.rol || 'GUEST',
        rol:        p.rol || 'GUEST',
    }))

    return { success: true, data: normalizedData }
}

// ================================================================
// CREAR_PLANTA
// Crea una nueva planta en la tabla plantas
// ================================================================
async function crearPlanta(adminClient: any, payload: any) {
    const plantaNombre = payload.nombre || payload.planta || payload.nombrePlanta;
    const idPlanta = payload.id || payload.id_planta;

    if (!plantaNombre) throw new Error('Nombre de planta requerido');

    const cleanTel = payload.telefono ? Number(String(payload.telefono).replace(/\D/g, '')) || null : null;

    // Verificar si ya existe por nombre
    const { data: existente } = await adminClient
        .from('plantas')
        .select('id_planta')
        .ilike('planta', plantaNombre.trim())
        .limit(1)
        .single();

    if (existente) {
        // Ya existe — actualizar en lugar de fallar
        const updateData: any = {
            correo: payload.email || payload.correo || '',
            telefono: cleanTel,
            rol: payload.rol || 'GUEST',
            updated_at: new Date().toISOString()
        };
        const { error: upErr } = await adminClient
            .from('plantas')
            .update(updateData)
            .eq('id_planta', existente.id_planta);
        if (upErr) throw upErr;
        return {
            success: true,
            message: `Planta "${plantaNombre}" ya existía, datos actualizados.`,
            data: { id_planta: existente.id_planta, planta: plantaNombre.trim().toUpperCase() }
        };
    }

    const insertData: any = {
        planta: plantaNombre.trim().toUpperCase(),
        correo: payload.email || payload.correo || '',
        telefono: cleanTel,
        rol: payload.rol || 'GUEST',
        created_at: new Date().toISOString()
    };

    // Solo incluir id_planta si es válido dentro del rango INT4
    if (idPlanta) {
        const numId = Number(String(idPlanta).replace(/\D/g, ''));
        if (numId > 0 && numId < 2147483647) {
            insertData.id_planta = numId;
        }
    }

    const { data, error } = await adminClient
        .from('plantas')
        .insert([insertData])
        .select()
        .single();

    if (error) throw error;

    return {
        success: true,
        message: `Planta "${plantaNombre}" creada correctamente.`,
        data
    };
}

// ================================================================
// ACTUALIZAR_PLANTA
// Actualiza una planta existente en la tabla plantas
// ================================================================
async function actualizarPlanta(adminClient: any, payload: any) {
    const plantaNombre = payload.nombre || payload.planta || payload.nombrePlanta;
    const idPlanta = payload.id || payload.id_planta;

    if (!plantaNombre) throw new Error('Nombre de planta requerido');

    const cleanTel = payload.telefono ? Number(String(payload.telefono).replace(/\D/g, '')) || null : null;

    const updateData: any = {
        planta: plantaNombre.trim().toUpperCase(),
        correo: payload.email || payload.correo || '',
        telefono: cleanTel,
        rol: payload.rol || 'GUEST',
        updated_at: new Date().toISOString()
    };

    // Campos técnicos adicionales si se proporcionan
    if (payload.encargado !== undefined) updateData.encargado = payload.encargado;
    if (payload.maquinaria !== undefined) updateData.maquinaria = payload.maquinaria ? JSON.stringify(payload.maquinaria) : null;
    if (payload.capacidad !== undefined) updateData.capacidad = payload.capacidad;
    if (payload.gps !== undefined) updateData.gps = payload.gps ? JSON.stringify(payload.gps) : null;
    if (payload.firma !== undefined) updateData.firma = payload.firma;

    // Si se proporciona nuevoId, también actualizar el id_planta
    if (payload.nuevoId) {
        const numId = Number(String(payload.nuevoId).replace(/\D/g, ''));
        if (numId > 0 && numId < 2147483647) {
            updateData.id_planta = numId;
        }
    }

    let query = adminClient.from('plantas').update(updateData);

    // Si se proporciona ID, actualizar por ID; si no, por nombre
    if (idPlanta) {
        query = query.eq('id_planta', Number(idPlanta));
    } else {
        query = query.ilike('planta', plantaNombre.trim());
    }

    const { error: pltErr } = await query;
    if (pltErr) throw pltErr;

    return {
        success: true,
        message: `Datos de la planta "${plantaNombre}" actualizados.`
    };
}
