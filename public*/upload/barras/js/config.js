// Configuración del administrador

const AdminConfig = {
  // URLs de las Edge Functions
  FUNCTIONS_URL: "https://doqsurxxxaudnutsydlk.supabase.co/functions/v1",
  
  // Columnas del Excel
  COLUMNS: {
    REFERENCIA: 0,  // Columna A
    TALLA: 1,       // Columna B
    ID_COLOR: 2,    // Columna C
    BARCODE: 11     // Columna L
  },
  
  // Configuración de carga
  BATCH_SIZE: 500,  // Registros por lote (optimizado)
  DELAY_BETWEEN_BATCHES: 50  // ms entre lotes (optimizado)
};
