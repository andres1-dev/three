import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Edge Function: Push Notifications
 * 
 * Maneja el envío de notificaciones push nativas usando FCM (Firebase Cloud Messaging)
 * Compatible con Android, iOS, y Web Push
 * 
 * Endpoints:
 * - POST /subscribe: Registra un dispositivo para recibir notificaciones
 * - POST /send: Envía una notificación push
 * - POST /send-batch: Envía notificaciones a múltiples dispositivos
 * - POST /unsubscribe: Desregistra un dispositivo
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    const { action } = payload

    // FCM Server Key (configurar en Supabase Dashboard)
    const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")
    if (!FCM_SERVER_KEY && action !== 'subscribe' && action !== 'unsubscribe') {
      throw new Error("FCM_SERVER_KEY no configurada")
    }

    let result = { success: false, message: "" }

    switch (action) {
      case "subscribe": {
        // Registrar dispositivo para recibir notificaciones
        const { userId, token, deviceType, deviceInfo } = payload
        
        if (!userId || !token) {
          throw new Error("userId y token son requeridos")
        }

        // Guardar o actualizar token en la base de datos
        const { data, error } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .upsert({
            USER_ID: userId,
            FCM_TOKEN: token,
            DEVICE_TYPE: deviceType || 'web',
            DEVICE_INFO: deviceInfo || {},
            LAST_UPDATED: new Date().toISOString(),
            ACTIVE: true
          }, {
            onConflict: 'USER_ID,FCM_TOKEN'
          })
          .select()

        if (error) throw error

        result = { 
          success: true, 
          message: "Dispositivo registrado correctamente",
          data 
        }
        break
      }

      case "unsubscribe": {
        // Desregistrar dispositivo
        const { userId, token } = payload
        
        const { error } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .update({ ACTIVE: false })
          .eq('USER_ID', userId)
          .eq('FCM_TOKEN', token)

        if (error) throw error

        result = { success: true, message: "Dispositivo desregistrado" }
        break
      }

      case "send": {
        // Enviar notificación a un usuario específico
        const { userId, title, body, data: notifData, imageUrl } = payload

        // Obtener tokens activos del usuario
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .select('FCM_TOKEN, DEVICE_TYPE')
          .eq('USER_ID', userId)
          .eq('ACTIVE', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Usuario sin dispositivos registrados" }
          break
        }

        // Enviar a todos los dispositivos del usuario
        const tokens = subscriptions.map(s => s.FCM_TOKEN)
        const sendResult = await sendFCMNotification(
          FCM_SERVER_KEY!,
          tokens,
          title,
          body,
          notifData,
          imageUrl
        )

        result = { 
          success: true, 
          message: `Notificación enviada a ${tokens.length} dispositivo(s)`,
          details: sendResult
        }
        break
      }

      case "send-batch": {
        // Enviar notificaciones a múltiples usuarios
        const { userIds, title, body, data: notifData, imageUrl } = payload

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          throw new Error("userIds debe ser un array no vacío")
        }

        // Obtener todos los tokens activos de los usuarios
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .select('FCM_TOKEN, USER_ID, DEVICE_TYPE')
          .in('USER_ID', userIds)
          .eq('ACTIVE', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Ningún usuario tiene dispositivos registrados" }
          break
        }

        const tokens = subscriptions.map(s => s.FCM_TOKEN)
        const sendResult = await sendFCMNotification(
          FCM_SERVER_KEY!,
          tokens,
          title,
          body,
          notifData,
          imageUrl
        )

        result = { 
          success: true, 
          message: `Notificación enviada a ${tokens.length} dispositivo(s) de ${userIds.length} usuario(s)`,
          details: sendResult
        }
        break
      }

      case "send-to-role": {
        // Enviar notificación a todos los usuarios de un rol específico
        const { role, title, body, data: notifData, imageUrl } = payload

        // Obtener usuarios del rol
        const { data: users, error: userError } = await supabaseClient
          .from('USUARIOS')
          .select('ID_USUARIO')
          .eq('ROL', role)

        if (userError) throw userError

        const userIds = users.map(u => u.ID_USUARIO)

        // Obtener tokens
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .select('FCM_TOKEN')
          .in('USER_ID', userIds)
          .eq('ACTIVE', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Ningún usuario del rol tiene dispositivos registrados" }
          break
        }

        const tokens = subscriptions.map(s => s.FCM_TOKEN)
        const sendResult = await sendFCMNotification(
          FCM_SERVER_KEY!,
          tokens,
          title,
          body,
          notifData,
          imageUrl
        )

        result = { 
          success: true, 
          message: `Notificación enviada a ${tokens.length} dispositivo(s) del rol ${role}`,
          details: sendResult
        }
        break
      }

      default:
        throw new Error(`Acción desconocida: ${action}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error(`[PUSH-NOTIFICATIONS ERROR]`, error.message)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})

/**
 * Envía notificación usando FCM (Firebase Cloud Messaging)
 */
async function sendFCMNotification(
  serverKey: string,
  tokens: string[],
  title: string,
  body: string,
  data?: any,
  imageUrl?: string
): Promise<any> {
  const fcmPayload: any = {
    registration_ids: tokens,
    notification: {
      title,
      body,
      icon: '/icons/TDM_variable_colors.svg',
      badge: '/icons/TDM_variable_colors.svg',
      click_action: data?.url || '/',
      tag: data?.tag || 'sispro-notification',
    },
    data: {
      ...data,
      timestamp: Date.now().toString(),
    },
    priority: 'high',
    content_available: true,
  }

  // Agregar imagen si está disponible
  if (imageUrl) {
    fcmPayload.notification.image = imageUrl
  }

  // Configuración específica para Android
  fcmPayload.android = {
    priority: 'high',
    notification: {
      sound: 'default',
      channel_id: 'sispro_notifications',
    }
  }

  // Configuración específica para iOS (APNs)
  fcmPayload.apns = {
    payload: {
      aps: {
        alert: {
          title,
          body,
        },
        sound: 'default',
        badge: 1,
        'content-available': 1,
      }
    },
    headers: {
      'apns-priority': '10',
    }
  }

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Authorization': `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fcmPayload),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`FCM Error: ${result.error || 'Unknown error'}`)
  }

  return result
}
