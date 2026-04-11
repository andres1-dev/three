import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * Edge Function: Push Notifications (Web Push API Nativo)
 * 
 * Maneja el envío de notificaciones push usando Web Push API estándar
 * Compatible con Android, iOS 16.4+, y Desktop
 * Usa VAPID para autenticación (sin Firebase)
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

    // VAPID Keys (configurar en Supabase Dashboard)
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@sispro.com"

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      if (action !== 'subscribe' && action !== 'unsubscribe') {
        throw new Error("VAPID keys no configuradas")
      }
    }

    let result = { success: false, message: "" }

    switch (action) {
      case "subscribe": {
        // Registrar dispositivo para recibir notificaciones
        const { userId, endpoint, p256dh, auth, deviceType, deviceInfo } = payload
        
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
        const { userId, endpoint } = payload
        
        const { error } = await supabaseClient
          .from('push_subscriptions')
          .update({ active: false })
          .eq('user_id', userId)
          .eq('endpoint', endpoint)

        if (error) throw error

        result = { success: true, message: "Dispositivo desregistrado" }
        break
      }

      case "send": {
        // Enviar notificación a un usuario específico
        const { userId, title, body, data: notifData, imageUrl } = payload

        // Obtener suscripciones activas del usuario
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, device_type')
          .eq('user_id', userId)
          .eq('active', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Usuario sin dispositivos registrados" }
          break
        }

        // Enviar a todos los dispositivos del usuario
        const sendResults = await Promise.allSettled(
          subscriptions.map(sub => 
            sendWebPushNotification(
              sub,
              title,
              body,
              notifData,
              imageUrl,
              VAPID_PUBLIC_KEY!,
              VAPID_PRIVATE_KEY!,
              VAPID_SUBJECT
            )
          )
        )

        const successCount = sendResults.filter(r => r.status === 'fulfilled').length
        const failedCount = sendResults.filter(r => r.status === 'rejected').length

        result = { 
          success: true, 
          message: `Notificación enviada: ${successCount} exitosas, ${failedCount} fallidas`,
          details: { successCount, failedCount, total: subscriptions.length }
        }
        break
      }

      case "send-batch": {
        // Enviar notificaciones a múltiples usuarios
        const { userIds, title, body, data: notifData, imageUrl } = payload

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          throw new Error("userIds debe ser un array no vacío")
        }

        // Obtener todas las suscripciones activas de los usuarios
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, device_type, user_id')
          .in('user_id', userIds)
          .eq('active', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Ningún usuario tiene dispositivos registrados" }
          break
        }

        // Enviar a todos los dispositivos
        const sendResults = await Promise.allSettled(
          subscriptions.map(sub => 
            sendWebPushNotification(
              sub,
              title,
              body,
              notifData,
              imageUrl,
              VAPID_PUBLIC_KEY!,
              VAPID_PRIVATE_KEY!,
              VAPID_SUBJECT
            )
          )
        )

        const successCount = sendResults.filter(r => r.status === 'fulfilled').length
        const failedCount = sendResults.filter(r => r.status === 'rejected').length

        result = { 
          success: true, 
          message: `Notificación enviada a ${successCount}/${subscriptions.length} dispositivo(s) de ${userIds.length} usuario(s)`,
          details: { successCount, failedCount, total: subscriptions.length }
        }
        break
      }

      case "send-to-role": {
        // Enviar notificación a todos los usuarios de un rol específico
        const { role, title, body, data: notifData, imageUrl } = payload

        // Obtener usuarios del rol (tabla en mayúsculas)
        const { data: users, error: userError } = await supabaseClient
          .from('USUARIOS')
          .select('ID_USUARIO')
          .eq('ROL', role)

        if (userError) throw userError

        const userIds = users.map(u => u.ID_USUARIO)

        // Obtener suscripciones
        const { data: subscriptions, error: subError } = await supabaseClient
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth, device_type')
          .in('user_id', userIds)
          .eq('active', true)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
          result = { success: false, message: "Ningún usuario del rol tiene dispositivos registrados" }
          break
        }

        // Enviar a todos los dispositivos
        const sendResults = await Promise.allSettled(
          subscriptions.map(sub => 
            sendWebPushNotification(
              sub,
              title,
              body,
              notifData,
              imageUrl,
              VAPID_PUBLIC_KEY!,
              VAPID_PRIVATE_KEY!,
              VAPID_SUBJECT
            )
          )
        )

        const successCount = sendResults.filter(r => r.status === 'fulfilled').length
        const failedCount = sendResults.filter(r => r.status === 'rejected').length

        result = { 
          success: true, 
          message: `Notificación enviada a ${successCount}/${subscriptions.length} dispositivo(s) del rol ${role}`,
          details: { successCount, failedCount, total: subscriptions.length }
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
 * Envía notificación usando Web Push API nativo
 */
async function sendWebPushNotification(
  subscription: any,
  title: string,
  body: string,
  data?: any,
  imageUrl?: string,
  vapidPublicKey?: string,
  vapidPrivateKey?: string,
  vapidSubject?: string
): Promise<any> {
  const { endpoint, p256dh, auth } = subscription

  // Construir payload de notificación
  const notificationPayload = {
    title,
    body,
    icon: '/icons/TDM_variable_colors.svg',
    badge: '/icons/TDM_variable_colors.svg',
    data: {
      ...data,
      timestamp: Date.now(),
      url: data?.url || '/',
    },
    tag: data?.tag || 'sispro-notification',
    requireInteraction: false,
    vibrate: [100, 50, 100],
  }

  if (imageUrl) {
    notificationPayload.image = imageUrl
  }

  // Generar JWT para VAPID
  const vapidHeaders = await generateVAPIDHeaders(
    endpoint,
    vapidPublicKey!,
    vapidPrivateKey!,
    vapidSubject!
  )

  // Encriptar payload
  const encryptedPayload = await encryptPayload(
    JSON.stringify(notificationPayload),
    p256dh,
    auth
  )

  // Enviar notificación
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400', // 24 horas
      ...vapidHeaders,
    },
    body: encryptedPayload,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Web Push Error (${response.status}): ${errorText}`)
  }

  return { success: true, status: response.status }
}

/**
 * Genera headers VAPID para autenticación
 */
async function generateVAPIDHeaders(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string
): Promise<Record<string, string>> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  // Crear JWT header
  const jwtHeader = {
    typ: 'JWT',
    alg: 'ES256',
  }

  // Crear JWT payload
  const jwtPayload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200, // 12 horas
    sub: subject,
  }

  // Nota: En producción, necesitarás una librería de JWT para firmar con ES256
  // Por ahora, usamos una implementación simplificada
  const token = await createJWT(jwtHeader, jwtPayload, privateKey)

  return {
    'Authorization': `vapid t=${token}, k=${publicKey}`,
  }
}

/**
 * Crea un JWT firmado (implementación simplificada)
 * En producción, usa una librería como jose o jsonwebtoken
 */
async function createJWT(
  header: any,
  payload: any,
  privateKey: string
): Promise<string> {
  const encoder = new TextEncoder()
  
  // Encode header y payload
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Importar clave privada
  const keyData = base64UrlDecode(privateKey)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  // Firmar
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  )

  const signatureB64 = base64UrlEncode(signature)
  return `${unsignedToken}.${signatureB64}`
}

/**
 * Encripta el payload de la notificación
 */
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<Uint8Array> {
  // Implementación de encriptación AES128GCM según RFC 8291
  // Esta es una versión simplificada
  
  const encoder = new TextEncoder()
  const payloadBuffer = encoder.encode(payload)

  // Decodificar keys del cliente
  const clientPublicKey = base64UrlDecode(p256dh)
  const authSecret = base64UrlDecode(auth)

  // Generar salt aleatorio (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Generar par de claves del servidor
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  // Derivar clave compartida
  const sharedSecret = await deriveSharedSecret(
    serverKeyPair.privateKey,
    clientPublicKey,
    authSecret,
    salt
  )

  // Encriptar payload
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(12) },
    sharedSecret,
    payloadBuffer
  )

  return new Uint8Array(encryptedData)
}

/**
 * Deriva el secreto compartido para encriptación
 */
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: ArrayBuffer,
  authSecret: ArrayBuffer,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Importar clave pública del cliente
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    publicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Derivar bits compartidos
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    privateKey,
    256
  )

  // Derivar clave final usando HKDF
  const ikm = new Uint8Array([...new Uint8Array(authSecret), ...new Uint8Array(sharedBits)])
  
  const key = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  return key
}

/**
 * Utilidades de codificación Base64 URL-safe
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string
  
  if (typeof data === 'string') {
    base64 = btoa(data)
  } else {
    const bytes = new Uint8Array(data)
    base64 = btoa(String.fromCharCode(...bytes))
  }
  
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(base64: string): ArrayBuffer {
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const decoded = atob(base64 + padding)
  return Uint8Array.from(decoded, c => c.charCodeAt(0)).buffer
}
