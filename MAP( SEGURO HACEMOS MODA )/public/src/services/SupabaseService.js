import { supabase, SUPABASE_CONFIG } from '../config/supabase.js';

export class SupabaseService {
    constructor() {
        this.functionUrl = SUPABASE_CONFIG.functionUrl;
        this.anonKey = SUPABASE_CONFIG.anonKey;
    }

    /**
     * Sube datos a Supabase con Validación de Identidad (Nivel 10)
     */
    async uploadData(data, type) {
        try {
            // 1. Obtener el token real del usuario logueado
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || this.anonKey;

            // 2. Ejecutar petición firmada
            const response = await fetch(this.functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data, type })
            });

            const result = await response.json();

            if (!response.ok) {
                // Si el servidor rechaza por rol, el error vendrá en el JSON
                throw new Error(result.error || 'Acceso denegado o error de servidor');
            }

            return { success: true, message: result.message, data: result.data };

        } catch (error) {
            console.error('🛡️ Seguridad:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene todos los registros de la tabla BUSINT
     * @returns {Promise<Array>}
     */
    async fetchAllData() {
        try {
            const { data, error } = await supabase
                .from('BUSINT')
                .select('*');

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error al descargar base de datos:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verifica la conexión de forma segura
     */
    async testConnection() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || this.anonKey;

            const response = await fetch(this.functionUrl, {
                method: 'OPTIONS',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}
