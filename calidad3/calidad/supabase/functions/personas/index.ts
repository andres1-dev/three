// ================================================================
// Edge Function: personas
// Gestión modular de usuarios y plantas (talleres)
// ================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers para permitir requests desde el frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ================================================================
// INTERFACES
// ================================================================

interface PersonaPayload {
  accion: string
  // Crear
  id?: string
  cedula?: string
  usuario?: string
  nombrePlanta?: string
  planta?: string
  correo?: string
  email?: string
  telefono?: string
  direccion?: string
  rol?: string
  password?: string
  id_productora?: number | null
  productora?: string | null
  // Actualizar
  nuevoId?: string
  // Firma
  firma_svg?: string
  email_copia?: boolean
}

interface SupabaseUser {
  id?: string
  ID_USUARIO?: string
  usuario?: string
  USUARIO?: string
  correo?: string
  CORREO?: string
  email?: string
  EMAIL?: string
  telefono?: string
  TELEFONO?: string
  rol?: string
  ROL?: string
  password?: string
  PASSWORD?: string
  CONTRASEÑA?: string
  id_productora?: number | null
  ID_PRODUCTORA?: number | null
  productora?: string | null
  PRODUCTORA?: string | null
  firma_svg?: string | null
  FIRMA_SVG?: string | null
  email_copia?: boolean
  EMAIL_COPIA?: boolean
}

interface SupabasePlanta {
  id?: string
  ID_PLANTA?: string
  planta?: string
  PLANTA?: string
  correo?: string
  CORREO?: string
  email?: string
  EMAIL?: string
  telefono?: string
  TELEFONO?: string
  direccion?: string
  DIRECCION?: string
  ciudad?: string
  CIUDAD?: string
  rol?: string
  ROL?: string
  password?: string
  PASSWORD?: string
  CONTRASEÑA?: string
  email_copia?: boolean
  EMAIL_COPIA?: boolean
}

// ================================================================
// FUNCIONES AUXILIARES
// ================================================================

/**
 * Normaliza el ROL a valores válidos
 */
function normalizarRol(rol: string | undefined): string {
  const rolesValidos = ['ADMIN', 'MODERATOR', 'USER-P', 'USER-C', 'USER-I', 'GUEST', 'PENDIENTE', 'DESHABILITADO']
  const rolUpper = (rol || 'GUEST').toUpperCase().trim()
  return rolesValidos.includes(rolUpper) ? rolUpper : 'GUEST'
}

/**
 * Genera un hash simple de contraseña (para demo - usar bcrypt en producción)
 */
function hashPassword(password: string): string {
  // En producción, usar bcrypt o similar
  // Por ahora retornamos la contraseña como está (DEMO ONLY)
  return password
}

// ================================================================
// HANDLERS POR ACCIÓN
// ================================================================

/**
 * LISTAR_USUARIOS - Obtiene todos los usuarios desde Auth
 */
async function listarUsuarios(supabaseClient: any) {
  try {
    // Para listar usuarios de Auth necesitamos crear un cliente con service_role
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

    // Obtener usuarios de auth.users usando admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers()
    
    if (authError) {
      console.error('[personas] Error listando usuarios de Auth:', authError)
      throw new Error(`Error al listar usuarios de Auth: ${authError.message}`)
    }

    // Obtener datos complementarios de la tabla perfiles
    const { data: perfilesData, error: perfilesError } = await supabaseClient
      .from('perfiles')
      .select('*')

    if (perfilesError) {
      console.log('[personas] Tabla perfiles no disponible o vacía:', perfilesError.message)
    }

    // Combinar datos de Auth con datos de perfiles
    const users = (authData?.users || []).map((authUser: any) => {
      const perfil = (perfilesData || []).find((p: any) => 
        p.auth_user_id === authUser.id
      )
      
      const meta = authUser.user_metadata || {}

      return {
        // Identificadores
        ID_USUARIO: perfil?.cedula || meta.cedula || authUser.id,
        id: authUser.id,
        auth_user_id: authUser.id,
        cedula: perfil?.cedula || meta.cedula || '',
        
        // Datos básicos
        USUARIO: perfil?.full_name || meta.full_name || authUser.email,
        full_name: perfil?.full_name || meta.full_name || '',
        CORREO: authUser.email,
        EMAIL: authUser.email,
        email: authUser.email,
        TELEFONO: perfil?.telefono || meta.phone || authUser.phone || '',
        phone: perfil?.telefono || meta.phone || authUser.phone || '',
        telefono: perfil?.telefono || meta.phone || authUser.phone || '',
        
        // Rol y permisos
        ROL: meta.role || 'GUEST',
        role: meta.role || 'GUEST',
        
        // Imágenes
        foto_url: perfil?.foto_url || '',
        portada_url: perfil?.portada_url || '',
        
        // Ubicación
        DIRECCION: perfil?.direccion || '',
        direccion: perfil?.direccion || '',
        PAIS: perfil?.pais || 'Colombia',
        pais: perfil?.pais || 'Colombia',
        DEPARTAMENTO: perfil?.departamento || '',
        departamento: perfil?.departamento || '',
        CIUDAD: perfil?.ciudad || '',
        ciudad: perfil?.ciudad || '',
        BARRIO: perfil?.barrio || '',
        barrio: perfil?.barrio || '',
        COMUNA: perfil?.comuna || '',
        comuna: perfil?.comuna || '',
        
        // Información laboral
        CARGO: perfil?.cargo || '',
        cargo: perfil?.cargo || '',
        AREA: perfil?.area || '',
        area: perfil?.area || '',
        FECHA_CONTRATACION: perfil?.fecha_contratacion || '',
        fecha_contratacion: perfil?.fecha_contratacion || '',
        SEDE: perfil?.sede || '',
        sede: perfil?.sede || '',
        DIVISION: perfil?.division || '',
        division: perfil?.division || '',
        
        // Organización
        ID_PRODUCTORA: perfil?.id_productora || meta.id_productora || null,
        id_productora: perfil?.id_productora || meta.id_productora || null,
        PRODUCTORA: perfil?.productora || meta.productora || null,
        productora: perfil?.productora || meta.productora || null,
        
        // Contacto emergencia
        CONTACTO_EMERGENCIA: perfil?.contacto_emergencia || '',
        contacto_emergencia: perfil?.contacto_emergencia || '',
        TELEFONO_EMERGENCIA: perfil?.telefono_emergencia || '',
        telefono_emergencia: perfil?.telefono_emergencia || '',
        
        // Firma y estado
        FIRMA_SVG: perfil?.firma_svg || null,
        firma_svg: perfil?.firma_svg || null,
        estado_personalizado: perfil?.estado_personalizado || '',
        disponible: perfil?.disponible !== false,
        
        // Preferencias
        EMAIL_COPIA: perfil?.email_copia || false,
        email_copia: perfil?.email_copia || false,
        notificaciones_activas: perfil?.notificaciones_activas !== false,
        
        // Timestamps
        email_verified: authUser.email_confirmed_at ? true : false,
        created_at: authUser.created_at,
        updated_at: perfil?.updated_at || authUser.updated_at,
      }
    })

    // Ordenar por nombre
    const sortedUsers = users.sort((a: any, b: any) => {
      const nameA = (a.USUARIO || '').toString().toLowerCase()
      const nameB = (b.USUARIO || '').toString().toLowerCase()
      return nameA.localeCompare(nameB)
    })

    console.log('[personas] Usuarios listados:', sortedUsers.length)
    return { success: true, data: sortedUsers }
  } catch (error) {
    console.error('[personas] Error en listarUsuarios:', error)
    throw error
  }
}

/**
 * LISTAR_PLANTAS - Obtiene todas las plantas (talleres) con paginación
 */
async function listarPlantas(supabaseClient: any) {
  console.log('[personas] Iniciando listado de plantas...')
  
  // Intentar con service role para evitar problemas de RLS
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  let clientToUse = supabaseClient
  
  if (supabaseUrl && serviceRoleKey) {
    console.log('[personas] Usando service role para plantas')
    clientToUse = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  
  // Cargar todas las plantas con paginación automática (1000 por lote)
  let allData: any[] = []
  let from = 0
  const limit = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await clientToUse
      .from('plantas')
      .select('*')
      .order('planta', { ascending: true })
      .range(from, from + limit - 1)

    if (error) {
      console.error('[personas] Error al listar plantas:', error)
      throw new Error(`Error al listar plantas: ${error.message}`)
    }

    if (data && data.length > 0) {
      allData = allData.concat(data)
      from += limit
      hasMore = data.length === limit
    } else {
      hasMore = false
    }
  }

  console.log('[personas] Plantas encontradas:', allData.length)

  // Normalizar datos al formato esperado por el frontend
  const normalizedData = allData.map((planta: any) => ({
    ID_PLANTA: planta.id_planta?.toString() || '',
    id_planta: planta.id_planta,
    PLANTA: planta.planta || '',
    planta: planta.planta || '',
    CORREO: planta.correo || '',
    EMAIL: planta.correo || '',
    correo: planta.correo || '',
    email: planta.correo || '',
    TELEFONO: planta.telefono?.toString() || '',
    telefono: planta.telefono?.toString() || '',
    tel: planta.telefono?.toString() || '',
    ROL: planta.rol || 'GUEST',
    rol: planta.rol || 'GUEST',
    PRODUCTORA: planta.productora || null,
    productora: planta.productora || null,
    ID_PRODUCTORA: planta.productora || null,
    id_productora: planta.productora || null,
    // Campos adicionales que puede esperar el frontend
    DIRECCION: '',
    direccion: '',
    dir: '',
    CIUDAD: '',
    ciudad: '',
    PASSWORD: '',
    password: '',
    email_copia: false,
    EMAIL_COPIA: false,
  }))

  return { success: true, data: normalizedData }
}

/**
 * CREAR_USUARIO - Crea un nuevo usuario en Auth y opcionalmente en tabla complementaria
 */
async function crearUsuario(supabaseClient: any, payload: PersonaPayload) {
  const { id, cedula, usuario, correo, telefono, rol, password, id_productora, productora } = payload

  if (!correo) {
    throw new Error('Se requiere correo')
  }
  if (!password) {
    throw new Error('Se requiere contraseña')
  }
  if (!usuario) {
    throw new Error('Se requiere nombre de usuario')
  }

  // Crear cliente admin con service role
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

  // Crear usuario en Auth (cédula en user_metadata)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: correo,
    password: password,
    email_confirm: true,
    user_metadata: {
      full_name: usuario,
      role: normalizarRol(rol),
      phone: telefono || '',
      id_productora: id_productora || null,
      productora: productora || null,
      cedula: cedula || id || '',
    }
  })

  if (authError) {
    throw new Error(`Error al crear usuario en Auth: ${authError.message}`)
  }

  // Guardar datos complementarios en tabla usuarios (si existe)
  try {
    const complementData = {
      auth_user_id: authData.user.id,
      email: correo,
      role: normalizarRol(rol),
      full_name: usuario,
      cedula: cedula || id || '',
      phone: telefono || '',
      id_productora: id_productora || null,
      productora: productora || null,
      email_copia: payload.email_copia || false,
      email_verified: true,
    }

    const { error: complementError } = await supabaseClient
      .from('usuarios')
      .insert([complementData])

    if (complementError) {
      console.warn('[personas] No se pudo guardar datos complementarios:', complementError.message)
    }
  } catch (e) {
    console.warn('[personas] Tabla usuarios no disponible para complemento')
  }

  return { success: true, message: 'Usuario creado correctamente', data: authData.user }
}

/**
 * UPDATE_USER - Actualiza un usuario existente en Auth y tabla complementaria
 */
async function actualizarUsuario(supabaseClient: any, payload: PersonaPayload) {
  const { id, cedula, usuario, correo, telefono, rol, password, id_productora, productora, firma_svg, email_copia } = payload

  const userId = id || cedula
  if (!userId) {
    throw new Error('Se requiere ID para actualizar')
  }

  // Crear cliente admin con service role
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

  // Construir metadata para actualizar (incluye cédula en Auth)
  const metadataUpdates: any = {}
  if (usuario) metadataUpdates.full_name = usuario
  if (rol) metadataUpdates.role = normalizarRol(rol)
  if (telefono !== undefined) metadataUpdates.phone = telefono
  if (id_productora !== undefined) metadataUpdates.id_productora = id_productora
  if (productora !== undefined) metadataUpdates.productora = productora
  if (cedula !== undefined) metadataUpdates.cedula = cedula

  // Actualizar en Auth
  const updatePayload: any = {}
  if (correo) updatePayload.email = correo
  if (password) updatePayload.password = password
  if (Object.keys(metadataUpdates).length > 0) {
    updatePayload.user_metadata = metadataUpdates
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    updatePayload
  )

  if (authError) {
    throw new Error(`Error al actualizar usuario en Auth: ${authError.message}`)
  }

  // Actualizar o crear registro en tabla complementaria (si existe)
  try {
    const complementUpdates: any = {}
    if (usuario) complementUpdates.full_name = usuario
    if (correo) complementUpdates.email = correo
    if (telefono !== undefined) complementUpdates.phone = telefono
    if (rol) complementUpdates.role = normalizarRol(rol)
    if (id_productora !== undefined) complementUpdates.id_productora = id_productora
    if (productora !== undefined) complementUpdates.productora = productora
    if (firma_svg !== undefined) complementUpdates.firma_svg = firma_svg
    if (email_copia !== undefined) complementUpdates.email_copia = email_copia
    if (cedula !== undefined) complementUpdates.cedula = cedula

    // Verificar si existe registro complementario
    const { data: existente } = await supabaseClient
      .from('usuarios')
      .select('id')
      .eq('auth_user_id', userId)
      .single()

    if (existente) {
      // Actualizar registro existente
      const { error: updateError } = await supabaseClient
        .from('usuarios')
        .update(complementUpdates)
        .eq('auth_user_id', userId)

      if (updateError) {
        console.warn('[personas] Error actualizando datos complementarios:', updateError.message)
      }
    } else {
      // Crear nuevo registro complementario
      const newRecord = {
        auth_user_id: userId,
        email: correo || authData.user.email,
        ...complementUpdates
      }
      
      const { error: insertError } = await supabaseClient
        .from('usuarios')
        .insert([newRecord])

      if (insertError) {
        console.warn('[personas] Error creando datos complementarios:', insertError.message)
      }
    }
  } catch (e) {
    console.warn('[personas] Error en tabla complementaria:', e)
  }

  return { success: true, message: 'Usuario actualizado correctamente', data: authData.user }
}

/**
 * CREAR_PLANTA - Crea una nueva planta (taller)
 */
async function crearPlanta(supabaseClient: any, payload: PersonaPayload) {
  const { id, cedula, nombrePlanta, planta, correo, email, telefono, rol } = payload

  if (!id && !cedula) {
    throw new Error('Se requiere ID o NIT')
  }
  if (!nombrePlanta && !planta) {
    throw new Error('Se requiere nombre de la planta')
  }
  if (!correo && !email) {
    throw new Error('Se requiere correo')
  }

  const nuevaPlanta = {
    id_planta: parseInt(id || cedula || '0'),
    planta: nombrePlanta || planta,
    correo: correo || email,
    telefono: telefono ? parseInt(telefono.replace(/\D/g, '')) : null,
    rol: normalizarRol(rol) === 'DESHABILITADO' ? 'DESHABILITADO' : 'GUEST',
    productora: payload.id_productora || null,
  }

  // Verificar si ya existe
  const { data: existente } = await supabaseClient
    .from('plantas')
    .select('id_planta')
    .eq('id_planta', nuevaPlanta.id_planta)
    .single()

  if (existente) {
    throw new Error(`Ya existe una planta con ID: ${nuevaPlanta.id_planta}`)
  }

  // Insertar
  const { data, error } = await supabaseClient
    .from('plantas')
    .insert([nuevaPlanta])
    .select()
    .single()

  if (error) {
    throw new Error(`Error al crear planta: ${error.message}`)
  }

  return { success: true, message: 'Planta creada correctamente', data }
}

/**
 * ACTUALIZAR_PLANTA - Actualiza una planta existente
 */
async function actualizarPlanta(supabaseClient: any, payload: PersonaPayload) {
  const { id, cedula, nuevoId, nombrePlanta, correo, email, telefono, rol } = payload

  const idActual = parseInt(id || cedula || '0')
  if (!idActual) {
    throw new Error('Se requiere ID para actualizar')
  }

  // Construir objeto de actualización
  const updates: any = {}

  if (nombrePlanta) updates.planta = nombrePlanta
  if (correo || email) updates.correo = correo || email
  if (telefono !== undefined) updates.telefono = telefono ? parseInt(telefono.replace(/\D/g, '')) : null
  if (rol) updates.rol = normalizarRol(rol) === 'DESHABILITADO' ? 'DESHABILITADO' : 'GUEST'
  if (payload.id_productora !== undefined) updates.productora = payload.id_productora

  // Si hay cambio de ID
  if (nuevoId && parseInt(nuevoId) !== idActual) {
    const nuevoIdNum = parseInt(nuevoId)
    
    // Verificar que el nuevo ID no exista
    const { data: existente } = await supabaseClient
      .from('plantas')
      .select('id_planta')
      .eq('id_planta', nuevoIdNum)
      .single()

    if (existente) {
      throw new Error(`Ya existe una planta con ID: ${nuevoIdNum}`)
    }

    updates.id_planta = nuevoIdNum
  }

  // Actualizar
  const { data, error } = await supabaseClient
    .from('plantas')
    .update(updates)
    .eq('id_planta', idActual)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar planta: ${error.message}`)
  }

  return { success: true, message: 'Planta actualizada correctamente', data }
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
    let payload: PersonaPayload
    try {
      payload = await req.json()
    } catch (e) {
      console.error('[personas] Error parseando JSON:', e)
      throw new Error('Body JSON inválido')
    }

    const { accion } = payload
    console.log('[personas] Acción recibida:', accion)

    if (!accion) {
      throw new Error('Se requiere el campo "accion"')
    }

    // Obtener variables de entorno
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[personas] Variables de entorno no configuradas')
      throw new Error('Configuración de Supabase no disponible')
    }

    // Crear cliente Supabase con las credenciales del request
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    })

    // Enrutar según acción
    let result

    switch (accion.toUpperCase()) {
      case 'LISTAR_USUARIOS':
        console.log('[personas] Ejecutando LISTAR_USUARIOS')
        result = await listarUsuarios(supabaseClient)
        break

      case 'LISTAR_PLANTAS':
        console.log('[personas] Ejecutando LISTAR_PLANTAS')
        result = await listarPlantas(supabaseClient)
        break

      case 'CREAR_USUARIO':
        console.log('[personas] Ejecutando CREAR_USUARIO')
        result = await crearUsuario(supabaseClient, payload)
        break

      case 'UPDATE_USER':
        console.log('[personas] Ejecutando UPDATE_USER')
        result = await actualizarUsuario(supabaseClient, payload)
        break

      case 'CREAR_PLANTA':
        console.log('[personas] Ejecutando CREAR_PLANTA')
        result = await crearPlanta(supabaseClient, payload)
        break

      case 'ACTUALIZAR_PLANTA':
        console.log('[personas] Ejecutando ACTUALIZAR_PLANTA')
        result = await actualizarPlanta(supabaseClient, payload)
        break

      case 'UPDATE_USER_PROFILE':
        console.log('[personas] Ejecutando UPDATE_USER_PROFILE')
        result = await actualizarPerfilUsuario(supabaseClient, payload)
        break

      default:
        throw new Error(`Acción no reconocida: ${accion}`)
    }

    console.log('[personas] Resultado exitoso para:', accion)

    // Respuesta exitosa
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[personas] Error:', errorMessage, error)

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
