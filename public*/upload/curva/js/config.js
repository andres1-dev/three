// Configuración del administrador de curvas

const CurvaConfig = {
  // URLs de las Edge Functions (sin API keys expuestas)
  FUNCTIONS_URL: "https://doqsurxxxaudnutsydlk.supabase.co/functions/v1",
  
  // Configuración del Excel
  HEADER_ROW: 1,  // Fila 2 (índice 1) contiene los headers
  DATA_START_ROW: 2,  // Datos empiezan en fila 3 (índice 2)
  
  // Columnas del Excel (índices base 0)
  COLUMNS: {
    REFERENCIA: 1,    // Columna B
    DESCRIPCION: 2,   // Columna C
    OP: 3,            // Columna D
    CANTIDAD: 8,      // Columna I
    ID_COLOR: 11,     // Columna L
    COLOR: 12,        // Columna M
    TALLAS_START: 14  // Columna O (índice 14)
  },
  
  // Configuración de carga
  BATCH_SIZE: 50,  // Registros por lote
  DELAY_BETWEEN_BATCHES: 100  // ms entre lotes
};
