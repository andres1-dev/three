import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

/**
 * Supabase Configuration
 * Configuración de conexión a Supabase
 */

// Exportar constantes individuales para uso directo
export const SUPABASE_URL = 'https://zpikjjcbievfpzegupmw.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g'

// Exportar cliente ya inicializado
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// También exportar como objeto para compatibilidad con código existente
export const SUPABASE_CONFIG = {
    projectUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    functionUrl: `${SUPABASE_URL}/functions/v1/upload-data`
}
