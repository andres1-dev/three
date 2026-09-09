import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────────
// MASTER KEY: se obtiene desde Supabase Secret (variable de entorno)
// Configurar en Supabase Dashboard → Settings → Edge Functions → Secrets
// Nombre del secret: VAULT_MASTER_KEY
// ──────────────────────────────────────────────────────────────
function getMasterKey(): string {
  const key = Deno.env.get("VAULT_MASTER_KEY");
  if (!key) {
    throw new Error(
      "VAULT_MASTER_KEY no configurado. Agrega el secret en Supabase Dashboard."
    );
  }
  return key;
}

// Cifra texto plano con AES-GCM usando SHA-256 del MASTER_KEY como material
async function encryptText(text: string, masterKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(masterKey)
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(text)
  );
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...combined));
}

// Descifra texto con AES-GCM
async function decryptText(
  encryptedBase64: string,
  masterKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  const binaryStr = atob(encryptedBase64);
  const combined = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(masterKey)
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encryptedData
  );
  return new TextDecoder().decode(decrypted);
}

// ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MASTER_KEY = getMasterKey();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Variables de entorno de Supabase no configuradas.");
    }

    // Cliente admin (bypass RLS) — solo para operaciones internas verificadas
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action, email, password, credential_id } = body;

    if (!action) {
      throw new Error("Parámetro requerido: action.");
    }

    // ── REVOKE: eliminar credenciales biométricas del usuario ──
    // Se procesa primero porque no necesita email ni credential_id en el body
    if (action === "revoke") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Se requiere autenticación para revocar.");

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) throw new Error("Token inválido o expirado.");

      const { error: deleteError } = await adminClient
        .from("biometry_vault")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        throw new Error("Error al revocar biometría: " + deleteError.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REVOKE_BY_CREDENTIAL: borrar por credential_id directo (sin sesión activa) ──
    if (action === "revoke_by_credential") {
      // Borra por credential_id usando adminClient (Service Role)
      // No requiere token de usuario — el credential_id es suficiente lookup key
      const { error: deleteError } = await adminClient
        .from("biometry_vault")
        .delete()
        .eq("credential_id", credential_id);

      if (deleteError) {
        throw new Error("Error al revocar biometría: " + deleteError.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Las demás acciones requieren email y credential_id
    if (!email || !credential_id) {
      throw new Error("Parámetros requeridos: email, credential_id.");
    }

    // ── ENROLL: registrar credencial biométrica ────────────────
    if (action === "enroll") {
      if (!password) throw new Error("Se requiere contraseña para el registro biométrico.");

      // 1. Verificar que las credenciales son válidas
      const { data: authData, error: authError } =
        await adminClient.auth.signInWithPassword({ email, password });

      if (authError || !authData.user) {
        throw new Error("Credenciales inválidas. No se puede registrar la biometría.");
      }

      // 2. Cifrar la contraseña con el vault
      const encryptedPassword = await encryptText(password, MASTER_KEY);

      // 3. Guardar en biometry_vault usando client con token del usuario (respeta RLS INSERT)
      const userClient = createClient(supabaseUrl, anonKey, {
        global: {
          headers: { Authorization: `Bearer ${authData.session!.access_token}` },
        },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: upsertError } = await userClient
        .from("biometry_vault")
        .upsert(
          {
            user_id: authData.user.id,
            credential_id,
            encrypted_password: encryptedPassword,
          },
          { onConflict: "credential_id" }
        );

      if (upsertError) {
        throw new Error("Error al guardar en la bóveda: " + upsertError.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTHENTICATE: autenticar con biometría ─────────────────
    if (action === "authenticate") {
      // 1. Buscar credential_id en la bóveda (admin para bypass RLS SELECT)
      const { data: vaultData, error: vaultError } = await adminClient
        .from("biometry_vault")
        .select("encrypted_password")
        .eq("credential_id", credential_id)
        .single();

      if (vaultError || !vaultData) {
        throw new Error("Credencial biométrica no encontrada o revocada.");
      }

      // 2. Descifrar la contraseña en memoria del servidor
      const decryptedPassword = await decryptText(
        vaultData.encrypted_password,
        MASTER_KEY
      );

      // 3. Generar sesión Supabase con las credenciales descifradas
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: authData, error: authError } =
        await anonClient.auth.signInWithPassword({
          email,
          password: decryptedPassword,
        });

      if (authError || !authData.session) {
        throw new Error(
          "Error de autenticación. La contraseña puede haber cambiado — " +
            "por favor inicia sesión manualmente para actualizar la biometría."
        );
      }

      return new Response(
        JSON.stringify({ success: true, session: authData.session }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    throw new Error(`Acción desconocida: ${action}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
