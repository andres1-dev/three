import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Clave maestra proporcionada por el usuario
const MASTER_KEY = Deno.env.get('VAULT_MASTER_KEY') || 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEp0cwjHBd3PjQHwPxIciaiuil8I1VuMq3aglSEXR8UM/8MuupoBxClsfNw/ypxOw9EvhrJh0pyeJDiT0F5NvEeg==';

// Función para encriptar la contraseña
async function encryptText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Usar SHA-256 para derivar una llave de 256 bits desde el MASTER_KEY
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(MASTER_KEY));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  // Combinar IV y data encriptada y convertir a base64
  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Función para desencriptar
async function decryptText(encryptedBase64: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  const binaryStr = atob(encryptedBase64);
  const combined = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    combined[i] = binaryStr.charCodeAt(i);
  }
  
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(MASTER_KEY));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedData
  );
  
  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    // Cliente Admin para interactuar con la base de datos (ignora RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { action, email, password, credential_id } = await req.json();

    if (!action || !email || !credential_id) {
      throw new Error('Faltan parámetros requeridos');
    }

    if (action === 'enroll') {
      if (!password) throw new Error('Se requiere contraseña para enrolamiento');

      // 1. Verificar credenciales reales en Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        throw new Error('Credenciales inválidas');
      }

      // 2. Encriptar contraseña y guardar en la bóveda
      const encryptedPassword = await encryptText(password);

      // Usar cliente con el token del usuario para pasar la política RLS de INSERT
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { error: insertError } = await userClient
        .from('biometry_vault')
        .upsert({
          user_id: authData.user.id,
          credential_id: credential_id,
          encrypted_password: encryptedPassword
        }, { onConflict: 'credential_id' });

      if (insertError) throw new Error('Error al guardar en la bóveda: ' + insertError.message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } 
    
    else if (action === 'authenticate') {
      // 1. Buscar el credential_id en la bóveda
      const { data: vaultData, error: vaultError } = await supabaseAdmin
        .from('biometry_vault')
        .select('encrypted_password')
        .eq('credential_id', credential_id)
        .single();

      if (vaultError || !vaultData) {
        throw new Error('Credencial biométrica no encontrada o revocada');
      }

      // 2. Desencriptar la contraseña en el servidor
      const decryptedPassword = await decryptText(vaultData.encrypted_password);

      // 3. Iniciar sesión usando el cliente normal de Auth para generar sesión
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password: decryptedPassword
      });

      if (authError || !authData.session) {
        throw new Error('Error de autenticación. La contraseña pudo haber cambiado.');
      }

      // 4. Devolver la sesión al frontend (Tokens seguros)
      return new Response(JSON.stringify({ 
        success: true, 
        session: authData.session 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Acción inválida');

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
