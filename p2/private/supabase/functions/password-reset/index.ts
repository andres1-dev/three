import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Función de limpieza automática de tokens
 * Elimina tokens expirados inmediatamente cuando se cumple expires_at
 */
async function cleanupExpiredTokens(supabaseClient: any) {
  try {
    const now = new Date().toISOString()
    
    // Eliminar tokens que ya expiraron (expires_at <= ahora)
    const { error: expiredError, count } = await supabaseClient
      .from('RESTABLECER')
      .delete()
      .lte('expires_at', now)
      .select('*', { count: 'exact', head: true })

    if (expiredError) {
      console.error('Error limpiando tokens expirados:', expiredError)
    } else {
      console.log(`Tokens expirados eliminados: ${count || 0}`)
    }

    // Eliminar tokens que ya fueron usados (used = true)
    const { error: usedError, count: usedCount } = await supabaseClient
      .from('RESTABLECER')
      .delete()
      .eq('used', true)
      .select('*', { count: 'exact', head: true })

    if (usedError) {
      console.error('Error limpiando tokens usados:', usedError)
    } else {
      console.log(`Tokens usados eliminados: ${usedCount || 0}`)
    }

  } catch (error) {
    console.error('Error en limpieza automática:', error)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, id, email, token, newPassword, hoja } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Ejecutar limpieza automática en cada llamada
    await cleanupExpiredTokens(supabaseClient)

    if (action === 'SOLICITAR_RESETEO') {
      // Buscar usuario por ID
      let userData = null
      let tableName = ''
      
      if (hoja === 'PLANTAS') {
        const { data, error } = await supabaseClient
          .from('PLANTAS')
          .select('*')
          .eq('ID_PLANTA', id)
          .single()
        
        if (error || !data) {
          return new Response(
            JSON.stringify({ success: false, message: 'No se encontró una cuenta con esta identificación.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }
        userData = data
        tableName = 'plantas'
      } else {
        const { data, error } = await supabaseClient
          .from('USUARIOS')
          .select('*')
          .eq('ID_USUARIO', id)
          .single()
        
        if (error || !data) {
          return new Response(
            JSON.stringify({ success: false, message: 'No se encontró una cuenta con esta identificación.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }
        userData = data
        tableName = 'usuarios'
      }

      const userEmail = userData.EMAIL || userData.CORREO
      if (!userEmail) {
        return new Response(
          JSON.stringify({ success: false, message: 'Esta cuenta no tiene un correo electrónico asociado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Generar token seguro (UUID + timestamp)
      const resetToken = crypto.randomUUID().replace(/-/g, '') + Date.now()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos

      // Guardar token en tabla RESTABLECER
      const { error: insertError } = await supabaseClient
        .from('RESTABLECER')
        .insert({
          user_id: String(id),  // Convertir a string para consistencia
          table_name: tableName,
          token: resetToken,
          expires_at: expiresAt,
          email: userEmail
        })

      if (insertError) {
        console.error('Error guardando token:', insertError)
        return new Response(
          JSON.stringify({ success: false, message: 'Error al generar el token de recuperación.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Generar URL de reseteo
      const APP_URL = Deno.env.get('APP_URL') || 'http://127.0.0.1:5500'
      const resetUrl = `${APP_URL}/reset.html?token=${encodeURIComponent(resetToken)}`

      // Enviar email con el token usando Google Apps Script
      const userName = userData.USUARIO || userData.PLANTA || 'Usuario'
      
      const GAS_EMAIL_URL = Deno.env.get('GAS_EMAIL_URL')
      if (!GAS_EMAIL_URL) {
        console.error('GAS_EMAIL_URL no configurada')
        return new Response(
          JSON.stringify({ success: false, message: 'Servicio de correo no configurado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const emailResponse = await fetch(GAS_EMAIL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userName: userName,
          userEmail: userEmail,
          resetUrl: resetUrl
        })
      })

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text()
        console.error('Error enviando email:', errorText)
        return new Response(
          JSON.stringify({ success: false, message: 'Error al enviar el correo de recuperación.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const emailResult = await emailResponse.json()
      if (!emailResult.success) {
        return new Response(
          JSON.stringify({ success: false, message: emailResult.message || 'Error al enviar el correo.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: `Enlace enviado a ${userEmail}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'VALIDAR_TOKEN') {
      // Solo validar si el token existe y no ha expirado
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('RESTABLECER')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single()

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ success: false, message: 'El código es inválido o ya fue utilizado.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Verificar expiración
      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, message: 'El código ha expirado. Solicite uno nuevo.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Token válido.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'CONFIRMAR_RESETEO') {
      // Validar token
      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('RESTABLECER')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single()

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ success: false, message: 'El código es inválido o ya expiró.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Verificar expiración
      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, message: 'El código ha expirado. Solicite uno nuevo.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Actualizar contraseña
      const tableName = tokenData.table_name
      const userId = tokenData.user_id
      const passwordField = 'CONTRASEÑA'  // Ambas tablas usan CONTRASEÑA
      const tableNameUpper = tableName === 'plantas' ? 'PLANTAS' : 'USUARIOS'
      const idField = tableName === 'plantas' ? 'ID_PLANTA' : 'ID_USUARIO'
      
      console.log('Actualizando contraseña:', {
        tableName,
        tableNameUpper,
        userId,
        idField,
        passwordField
      })
      
      const { error: updateError, data: updateData } = await supabaseClient
        .from(tableNameUpper)
        .update({ [passwordField]: newPassword })
        .eq(idField, userId)
        .select()

      if (updateError) {
        console.error('Error actualizando contraseña:', updateError)
        console.error('Detalles del error:', JSON.stringify(updateError))
        return new Response(
          JSON.stringify({ success: false, message: 'Error al actualizar la contraseña: ' + updateError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      console.log('Contraseña actualizada exitosamente:', updateData)

      // Eliminar el token usado inmediatamente (en lugar de marcarlo como usado)
      await supabaseClient
        .from('RESTABLECER')
        .delete()
        .eq('id', tokenData.id)

      console.log('Token eliminado después de uso exitoso')

      return new Response(
        JSON.stringify({ success: true, message: 'Contraseña actualizada correctamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Acción no válida.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error: any) {
    console.error('Error en password-reset:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error?.message || 'Error desconocido',
        error: error?.toString() 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
