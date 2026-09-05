// ================================================================
// Edge Function: perfiles
// Gestión de perfiles de usuario (CRUD + upload de imágenes)
// ================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ================================================================
// INTERFACES
// ================================================================

interface PerfilPayload {
    accion: string
    auth_user_id?: string
    // Datos personales
    full_name?: string
    cedula?: string
    telefono?: string
    direccion?: string
    fecha_nacimiento?: string
    // Ubicación
    pais?: string
    departamento?: string
    ciudad?: string
    barrio?: string
    comuna?: string
    // Información laboral
    cargo?: string
    area?: string
    fecha_contratacion?: string
    sede?: string
    division?: string
    // Organización
    id_productora?: number | null
    productora?: string | null
    // Contacto emergencia
    contacto_emergencia?: string
    telefono_emergencia?: string
    // Firma y estado
    firma_svg?: string
    estado_personalizado?: string
    disponible?: boolean
    // Preferencias
    email_copia?: boolean
    notificaciones_activas?: boolean
    // Imágenes
    foto_url?: string
    portada_url?: string
}

// ================================================================
// HANDLERS POR ACCIÓN
// ================================================================

/**
 * OBTENER_PERFIL - Obtiene el perfil del usuario actual
 */
async function obtenerPerfil(supabaseClient: any, userId: string) {
    console.log('[perfiles] Obteniendo perfil para usuario:', userId)

    // Usar SERVICE_ROLE_KEY para bypass de RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Service role key no disponible')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    // 1. Obtener usuario de Auth para enriquecer cualquier dato faltante en perfiles
    let authUser: any = null
    try {
        const { data: authRes } = await adminClient.auth.admin.getUserById(userId)
        authUser = authRes?.user || null
    } catch (e) {
        console.warn('[perfiles] Error obteniendo authUser:', e)
    }

    const meta = authUser?.user_metadata || {}

    // 2. Consultar tabla perfiles
    const { data, error } = await adminClient
        .from('perfiles')
        .select('*')
        .eq('auth_user_id', userId)
        .single()

    if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (usuario sin perfil todavía)
        throw new Error(`Error al obtener perfil: ${error.message}`)
    }

    // 3. Fusión inteligente: la BD tiene prioridad, pero si es null/vacío, toma de Auth
    const cedulaFinal = data?.cedula || meta.cedula || meta.ID_USUARIO || ''
    const nombreFinal = data?.full_name || meta.full_name || meta.name || meta.usuario || authUser?.email || ''
    const telefonoFinal = data?.telefono || meta.phone || authUser?.phone || ''
    const idProdFinal = data?.id_productora || meta.id_productora || null
    const prodFinal = data?.productora || meta.productora || null
    const emailFinal = data?.email || authUser?.email || ''

    const perfilFinal = {
        auth_user_id: userId,
        ...(data || {}),
        cedula: cedulaFinal,
        full_name: nombreFinal,
        telefono: telefonoFinal,
        id_productora: idProdFinal,
        productora: prodFinal,
        email: emailFinal,
        pais: data?.pais || 'Colombia',
        disponible: data?.disponible !== false,
        email_copia: data?.email_copia || false,
        notificaciones_activas: data?.notificaciones_activas !== false,
    }

    // 4. Auto-curar registro en la BD si faltaba cédula o datos básicos
    try {
        if (!data?.cedula && cedulaFinal) {
            if (data) {
                await adminClient.from('perfiles').update({
                    cedula: cedulaFinal,
                    full_name: nombreFinal,
                    telefono: telefonoFinal || undefined,
                    id_productora: idProdFinal || undefined,
                    productora: prodFinal || undefined
                }).eq('auth_user_id', userId)
            } else {
                await adminClient.from('perfiles').insert([{
                    auth_user_id: userId,
                    cedula: cedulaFinal,
                    full_name: nombreFinal,
                    telefono: telefonoFinal,
                    id_productora: idProdFinal,
                    productora: prodFinal,
                    pais: 'Colombia',
                    disponible: true,
                    notificaciones_activas: true
                }])
            }
        }
    } catch (syncErr) {
        console.warn('[perfiles] Auto-sync perfiles aviso:', syncErr)
    }

    return { success: true, data: perfilFinal }
}

/**
 * ACTUALIZAR_PERFIL - Actualiza o crea el perfil del usuario
 */
async function actualizarPerfil(supabaseClient: any, userId: string, payload: PerfilPayload) {
    console.log('[perfiles] Actualizando perfil para usuario:', userId)

    // Usar SERVICE_ROLE_KEY para bypass de RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Service role key no disponible')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    // Verificar si ya existe el perfil
    const { data: existente } = await adminClient
        .from('perfiles')
        .select('id')
        .eq('auth_user_id', userId)
        .single()

    // Construir objeto de actualización (solo campos que vengan en el payload)
    const updates: any = {}

    if (payload.full_name !== undefined) updates.full_name = payload.full_name
    if (payload.cedula !== undefined) updates.cedula = payload.cedula
    if (payload.telefono !== undefined) updates.telefono = payload.telefono
    if (payload.direccion !== undefined) updates.direccion = payload.direccion

    if (payload.pais !== undefined) updates.pais = payload.pais
    if (payload.departamento !== undefined) updates.departamento = payload.departamento
    if (payload.ciudad !== undefined) updates.ciudad = payload.ciudad
    if (payload.barrio !== undefined) updates.barrio = payload.barrio
    if (payload.comuna !== undefined) updates.comuna = payload.comuna

    if (payload.cargo !== undefined) updates.cargo = payload.cargo
    if (payload.area !== undefined) updates.area = payload.area
    if (payload.fecha_contratacion !== undefined) updates.fecha_contratacion = payload.fecha_contratacion ? payload.fecha_contratacion : null
    if (payload.sede !== undefined) updates.sede = payload.sede
    if (payload.division !== undefined) updates.division = payload.division

    if (payload.id_productora !== undefined) {
        updates.id_productora = (payload.id_productora !== null && payload.id_productora !== '') ? Number(payload.id_productora) : null
    }
    if (payload.productora !== undefined) updates.productora = payload.productora

    if (payload.contacto_emergencia !== undefined) updates.contacto_emergencia = payload.contacto_emergencia
    if (payload.telefono_emergencia !== undefined) updates.telefono_emergencia = payload.telefono_emergencia

    if (payload.fecha_nacimiento !== undefined) updates.fecha_nacimiento = payload.fecha_nacimiento ? payload.fecha_nacimiento : null
    if (payload.firma_svg !== undefined) updates.firma_svg = payload.firma_svg
    if (payload.estado_personalizado !== undefined) updates.estado_personalizado = payload.estado_personalizado
    if (payload.disponible !== undefined) updates.disponible = payload.disponible

    if (payload.email_copia !== undefined) updates.email_copia = payload.email_copia
    if (payload.notificaciones_activas !== undefined) updates.notificaciones_activas = payload.notificaciones_activas

    if (payload.foto_url !== undefined) updates.foto_url = payload.foto_url
    if (payload.portada_url !== undefined) updates.portada_url = payload.portada_url

    let dataRes: any = null
    if (existente) {
        // Actualizar registro existente
        const { data, error } = await adminClient
            .from('perfiles')
            .update(updates)
            .eq('auth_user_id', userId)
            .select()
            .single()

        if (error) {
            throw new Error(`Error al actualizar perfil: ${error.message}`)
        }

        dataRes = data
    } else {
        // Crear nuevo registro
        const newRecord = {
            auth_user_id: userId,
            ...updates
        }

        const { data, error } = await adminClient
            .from('perfiles')
            .insert([newRecord])
            .select()
            .single()

        if (error) {
            throw new Error(`Error al crear perfil: ${error.message}`)
        }

        dataRes = data
    }

    // Sincronizar también en Auth (user_metadata y teléfono) para que no se desincronicen
    try {
        let authUser: any = null
        try {
            const { data: aRes } = await adminClient.auth.admin.getUserById(userId)
            authUser = aRes?.user || null
        } catch (_) { }

        const meta = authUser?.user_metadata || {}
        const metaUpdates: any = {}
        if (updates.full_name) metaUpdates.full_name = updates.full_name
        if (updates.cedula) metaUpdates.cedula = updates.cedula
        if (updates.productora !== undefined) metaUpdates.productora = updates.productora
        if (updates.id_productora !== undefined) metaUpdates.id_productora = updates.id_productora
        if (updates.telefono) metaUpdates.phone = String(updates.telefono).replace(/\D/g, '').slice(0, 10)

        const authPayload: any = {
            user_metadata: {
                ...meta,
                ...metaUpdates
            }
        }

        if (updates.telefono) {
            const limpio = String(updates.telefono).replace(/\D/g, '')
            if (limpio.length === 10) {
                authPayload.phone = `+57${limpio}`
                authPayload.phone_confirm = true
            }
        }

        await adminClient.auth.admin.updateUserById(userId, authPayload)
    } catch (syncAuthErr) {
        console.warn('[perfiles] Aviso al sincronizar auth:', syncAuthErr)
    }

    return { success: true, message: 'Perfil actualizado correctamente', data: dataRes }
}

/**
 * SUBIR_FOTO - Genera URL firmada para subir foto de perfil
 */
async function subirFoto(supabaseClient: any, userId: string, tipo: 'foto' | 'portada') {
    console.log('[perfiles] Generando URL de subida para:', tipo)

    // Usar SERVICE_ROLE_KEY para bypass de RLS en Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Service role key no disponible')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    // Generar nombre de archivo único
    const timestamp = Date.now()
    const fileName = `${userId}/${tipo}_${timestamp}.jpg`

    // Crear URL firmada para upload (válida por 1 hora)
    const { data, error } = await adminClient
        .storage
        .from('perfiles')
        .createSignedUploadUrl(fileName)

    if (error) {
        throw new Error(`Error al generar URL de subida: ${error.message}`)
    }

    // Generar URL pública para leer la imagen después
    const { data: publicData } = adminClient
        .storage
        .from('perfiles')
        .getPublicUrl(fileName)

    return {
        success: true,
        data: {
            uploadUrl: data.signedUrl,
            publicUrl: publicData.publicUrl,
            fileName: fileName,
            tipo: tipo
        }
    }
}

/**
 * ELIMINAR_FOTO - Elimina foto de perfil del storage
 */
async function eliminarFoto(supabaseClient: any, fileName: string) {
    console.log('[perfiles] Eliminando archivo:', fileName)

    // Usar SERVICE_ROLE_KEY para bypass de RLS en Storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Service role key no disponible')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    const { error } = await adminClient
        .storage
        .from('perfiles')
        .remove([fileName])

    if (error) {
        throw new Error(`Error al eliminar archivo: ${error.message}`)
    }

    return { success: true, message: 'Archivo eliminado correctamente' }
}

// ================================================================
// SERVIDOR PRINCIPAL
// ================================================================

serve(async (req) => {
    // Manejar OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parsear body
        let payload: PerfilPayload
        try {
            payload = await req.json()
        } catch (e) {
            throw new Error('Body JSON inválido')
        }

        const { accion } = payload
        console.log('[perfiles] Acción recibida:', accion)

        if (!accion) {
            throw new Error('Se requiere el campo "accion"')
        }

        // Obtener variables de entorno
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Configuración de Supabase no disponible')
        }

        // Crear cliente Supabase con auth del request
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Se requiere autenticación')
        }

        const supabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: { Authorization: authHeader },
            },
        })

        // Obtener usuario actual
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            throw new Error('Usuario no autenticado')
        }

        // Enrutar según acción
        let result

        switch (accion.toUpperCase()) {
            case 'OBTENER_PERFIL':
                result = await obtenerPerfil(supabaseClient, user.id)
                break

            case 'ACTUALIZAR_PERFIL':
                result = await actualizarPerfil(supabaseClient, user.id, payload)
                break

            case 'SUBIR_FOTO':
                result = await subirFoto(supabaseClient, user.id, payload.tipo as 'foto' | 'portada')
                break

            case 'ELIMINAR_FOTO':
                if (!payload.fileName) throw new Error('Se requiere fileName')
                result = await eliminarFoto(supabaseClient, payload.fileName)
                break

            default:
                throw new Error(`Acción no reconocida: ${accion}`)
        }

        console.log('[perfiles] Resultado exitoso para:', accion)

        // Respuesta exitosa
        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        console.error('[perfiles] Error:', errorMessage)

        return new Response(
            JSON.stringify({
                success: false,
                message: errorMessage,
                error: errorMessage,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
