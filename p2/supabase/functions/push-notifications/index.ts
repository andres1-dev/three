import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Edge Function: Push Notifications (Versión Simplificada)
 * 
 * Por ahora solo registra suscripciones.
 * El envío de notificaciones se implementará después.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    console.log('[PUSH-NOTIFICATIONS] Request recibido')
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    console.log('[PUSH-NOTIFICATIONS] Payload:', JSON.stringify(payload, null, 2))
    
    const { action } = payload

    let result = { success: false, message: "" }

    switch (action) {
      case "subscribe": {
        // Registrar dispositivo para recibir notificaciones
        const { userId, endpoint, p256dh, auth, deviceType, deviceInfo } = payload
        
        console.log('[PUSH-NOTIFICATIONS] Registrando suscripción:', {
          userId,
          endpoint: endpoint?.substring(0, 50),
          deviceType
        })
        
        if (!userId || !endpoint || !p256dh || !auth) {
          throw new Error("userId, endpoint, p256dh y auth son requeridos")
        }

        // Guardar o actualizar suscripción en la base de datos
        const { data, error } = await supabaseClient
          .from('push_subscriptions')
          .upsert({
            user_id: userId,
            endpoint: endpoint,
            p256dh: p256dh,
            auth: auth,
            device_type: deviceType || 'web',
            device_info: deviceInfo || {},
            updated_at: new Date().toISOString(),
            active: true
          }, {
            onConflict: 'user_id,endpoint'
          })
          .select()

        if (error) {
          console.error('[PUSH-NOTIFICATIONS] Error en BD:', error)
          throw error
        }

        console.log('[PUSH-NOTIFICATIONS] Suscripción guardada:', data)

        result = { 
          success: true, 
          message: "Dispositivo registrado correctamente",
          data 
        }
        break
      }

      case "unsubscribe": {
        // Desregistrar dispositivo
        const { userId, endpoint } = payload
        
        console.log('[PUSH-NOTIFICATIONS] Desregistrando:', { userId, endpoint: endpoint?.substring(0, 50) })
        
        const { error } = await supabaseClient
          .from('push_subscriptions')
          .update({ active: false })
          .eq('user_id', userId)
          .eq('endpoint', endpoint)

        if (error) {
          console.error('[PUSH-NOTIFICATIONS] Error desregistrando:', error)
          throw error
        }

        result = { success: true, message: "Dispositivo desregistrado" }
        break
      }

      case "send": {
        // Por ahora, solo simular envío exitoso
        const { userId, title, body } = payload
        
        console.log('[PUSH-NOTIFICATIONS] Simulando envío a:', userId, title)
        
        // TODO: Implementar envío real con Web Push API
        result = { 
          success: true, 
          message: "Notificación simulada (implementación pendiente)",
          note: "El registro funciona, el envío se implementará después"
        }
        break
      }

      default:
        throw new Error(`Acción desconocida: ${action}`)
    }

    console.log('[PUSH-NOTIFICATIONS] Resultado:', result)

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
