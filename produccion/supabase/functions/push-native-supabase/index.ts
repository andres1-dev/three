import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

/**
 * Edge Function: Push Notifications - 100% Supabase Native
 * 
 * Sistema de notificaciones push usando Web Push API estándar
 * SIN FIREBASE - Solo Supabase + Web Push Protocol
 * 
 * Compatible con:
 * - Android (Chrome, Firefox, Edge)
 * - Desktop (Chrome, Firefox, Edge, Opera)
 * - iOS 16.4+ (Safari con PWA instalada)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    const { action } = payload

    let result = { success: false, message: "" }

    switch (action) {
      case "subscribe": {
        // Registrar suscripción Web Push
        const { userId, subscription, deviceType, deviceInfo } = payload
        
        if (!userId || !subscription) {
          throw new Error("userId y subscription son requeridos")
        }

        // Guardar suscripción completa (endpoint + keys)
        const { data, error } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .upsert({
            USER_ID: userId,
            ENDPOINT: subscription.endpoint,
            P256DH_KEY: subscription.keys?.p256dh || '',
            AUTH_KEY: subscription.keys?.auth || '',
            DEVICE_TYPE: deviceType || 'web',
            DEVICE_INFO: deviceInfo || {},
            LAST_UPDATED: new Date().toISOString(),
            ACTIVE: true
          }, {
            onConflict: 'USER_ID,ENDPOINT'
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
        const { userId, endpoint } = payload
        
        const { error } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .update({ ACTIVE: false })
          .eq('USER_ID', userId)
          .eq('ENDPOINT', endpoint)

        if (error) throw error

        result = { success: true, message: "Dispositivo desregistrado" }
        break
      }

      case "send": {
        // Enviar notificación a un usuario
        const { userId, title, body, data: notifData, imageUrl, icon, badge } = payload

        const { data: subscriptions, error: subError } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .select('ENDPOINT, P256DH_KEY, AUTH_KEY, DEVICE_TYPE')
          .eq('USER_ID', userId)
          .eq('ACTIVE', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Usuario sin dispositivos registrados" }
          break
        }

        // Enviar a todos los dispositivos
        const sendResults = await Promise.allSettled(
          subscriptions.map(sub => 
            sendWebPushNotification(
              sub.ENDPOINT,
              sub.P256DH_KEY,
              sub.AUTH_KEY,
              title,
              body,
              notifData,
              imageUrl,
              icon,
              badge
            )
          )
        )

        const successCount = sendResults.filter(r => r.status === 'fulfilled').length
        const failCount = sendResults.filter(r => r.status === 'rejected').length

        result = { 
          success: true, 
          message: `Enviado a ${successCount} dispositivo(s), ${failCount} fallaron`,
          details: { successCount, failCount }
        }
        break
      }

      case "send-batch": {
        // Enviar a múltiples usuarios
        const { userIds, title, body, data: notifData, imageUrl, icon, badge } = payload

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          throw new Error("userIds debe ser un array no vacío")
        }

        const { data: subscriptions, error: subError } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .select('ENDPOINT, P256DH_KEY, AUTH_KEY, USER_ID')
          .in('USER_ID', userIds)
          .eq('ACTIVE', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Ningún usuario tiene dispositivos registrados" }
          break
        }

        const sendResults = await Promise.allSettled(
          subscriptions.map(sub => 
            sendWebPushNotification(
              sub.ENDPOINT,
              sub.P256DH_KEY,
              sub.AUTH_KEY,
              title,
              body,
              notifData,
              imageUrl,
              icon,
              badge
            )
          )
        )

        const successCount = sendResults.filter(r => r.status === 'fulfilled').length

        result = { 
          success: true, 
          message: `Notificación enviada a ${successCount} dispositivo(s)`,
          details: { total: subscriptions.length, success: successCount }
        }
        break
      }

      case "send-to-role": {
        const { role, title, body, data: notifData, imageUrl, icon, badge } = payload

        // Obtener usuarios del rol
        const { data: users, error: userError } = await supabaseClient
          .from('USUARIOS')
          .select('ID_USUARIO')
          .eq('ROL', role)

        if (userError) throw userError

        const userIds = users.map(u => u.ID_USUARIO)

        // Obtener suscripciones
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('PUSH_SUBSCRIPTIONS')
          .select('ENDPOINT, P256DH_KEY, AUTH_KEY')
          .in('USER_ID', userIds)
          .eq('ACTIVE', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Ningún usuario del rol tiene dispositivos" }
          break
        }

        const sendResults = await Promise.allSettled(
          subscriptions.map(sub => 
            sendWebPushNotification(
              sub.ENDPOINT,
              sub.P256DH_KEY,
              sub.AUTH_KEY,
              title,
              body,
              notifData,
              imageUrl,
              icon,
              badge
            )
          )
        )

        const successCount = sendResults.filter(r => r.status === 'fulfilled').length

        result = { 
          success: true, 
          message: `Enviado a ${successCount} dispositivo(s) del rol ${role}`,
        }
        break
      }

      case "get-vapid-key": {
        // Retornar clave pública VAPID
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")
        if (!vapidPublicKey) {
          throw new Error("VAPID_PUBLIC_KEY no configurada")
        }
        result = { success: true, vapidPublicKey }
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
    console.error(`[PUSH-NATIVE ERROR]`, error.message)
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
 * Envía notificación usando Web Push Protocol estándar
 * Compatible con todos los navegadores modernos
 */
async function sendWebPushNotification(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  title: string,
  body: string,
  data?: any,
  imageUrl?: string,
  icon?: string,
  badge?: string
): Promise<any> {
  
  // Obtener claves VAPID del entorno
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@sispro.com"

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("Claves VAPID no configuradas")
  }

  // Construir payload de notificación
  const notificationPayload = {
    title,
    body,
    icon: icon || '/icons/TDM_variable_colors.svg',
    badge: badge || '/icons/TDM_variable_colors.svg',
    image: imageUrl,
    data: {
      ...data,
      timestamp: Date.now(),
      url: data?.url || '/',
    },
    tag: data?.tag || 'sispro-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }

  // Usar librería web-push para Deno
  // Importar dinámicamente
  const webpush = await import("https://esm.sh/web-push@3.6.6")
  
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  )

  const pushSubscription = {
    endpoint,
    keys: {
      p256dh: p256dhKey,
      auth: authKey,
    }
  }

  try {
    const result = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(notificationPayload),
      {
        TTL: 86400, // 24 horas
        urgency: 'high',
      }
    )
    
    return { success: true, statusCode: result.statusCode }
  } catch (error) {
    console.error('[WEB-PUSH] Error enviando:', error.message)
    
    // Si el endpoint ya no es válido (410 Gone), marcar como inactivo
    if (error.statusCode === 410) {
      // Aquí podrías desactivar la suscripción en la BD
      console.log('[WEB-PUSH] Endpoint expirado:', endpoint)
    }
    
    throw error
  }
}
