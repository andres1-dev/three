import { ENV } from '../config/env.js';

let _client = null;

/**
 * Proveedor Singleton para el cliente de Supabase.
 * Se apoya en window.supabase cargado via CDN o import dinámico.
 */
export function getSupabaseClient() {
    if (_client) return _client;

    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
        _client = window.supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        return _client;
    }

    console.warn('[SupabaseClient] Supabase SDK no encontrado en window.supabase.');
    return null;
}
