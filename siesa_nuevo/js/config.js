// Configuración global del sistema SIESA 
const SiesaConfig = {
  // URL de las Edge Functions de Supabase
  FUNCTIONS_URL: 'https://djgnfyglyvlfhnhvpzxy.supabase.co/functions/v1',
  
  // Configuración de archivos
  FILES: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: {
      CSV: ['text/csv', '.csv'],
      XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx']
    }
  },
  
  // Configuración de procesamiento
  PROCESSING: {
    BATCH_SIZE: 250, // Registros por lote para enviar a Supabase
    DELAY_BETWEEN_BATCHES: 100 // ms entre lotes
  }
};
