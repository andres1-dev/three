/**
 * Configuración de entorno y endpoints externos.
 */
export const ENV = Object.freeze({
    SUPABASE_URL: 'https://efocfgjunowtkrgxepbn.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb2NmZ2p1bm93dGtyZ3hlcGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDY4NTMsImV4cCI6MjEwNDAyMjg1M30.zNT_9F-tYTt9_auHFehszbSkq8enCBm0ICheExMuOeM',
    FUNCTIONS_URL: 'https://efocfgjunowtkrgxepbn.supabase.co/functions/v1',
    GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbydiLxcTF1-zNzZoEmqAhPgHuj0GqrdfKYxUmZMQmVLq9XjPz4W7429YqA6DcBxEh_Z/exec',
    SPREADSHEET_ID: '1ZLGG8wfszE6D8vGwCECWguWGUiDXGUGfN87ZukyaCpo',
    /**
     * INTERRUPTOR MAESTRO DE CACHÉ:
     * Si está en false (fase de pruebas / desarrollo), ningún dato de usuarios,
     * plantas ni perfiles se guardará en memoria ni en sessionStorage.
     * Siempre se traerán datos frescos directamente de las Edge Functions / BD.
     */
    ENABLE_CACHE: false
});

