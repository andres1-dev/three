/* ==========================================================================
   api.js — Comunicación con Supabase (Migrado desde GAS/Sheets)
   Depende de: config.js (CONFIG)
   ========================================================================== */

// ── Remapeo específico para tabla SISPRO ──
// Los datos vienen de SIESA con nombres de columna distintos a los que
// espera la aplicación (esquema legado). Se aplica DESPUÉS de normalizar
// claves a mayúsculas, por eso las claves aquí están en MAYÚSCULAS.
const SISPRO_MAP = {
    'OP':           'LOTE',
    'REF':          'REFERENCIA',
    'UNDPROG':      'CANTIDAD',
    'NOMBREPLANTA': 'PLANTA',
    'FSALIDACONF':  'SALIDA',
    'PROCESO':      'PROCESO',        // ya coincide, pero lo incluimos por claridad
    'DESCRIPCION':  'PRENDA',
    'CUENTO':       'LINEA',
    'GENERO':       'GENERO',         // ya coincide
    'TIPO TEJIDO':  'TEJIDO',
    'COLECCION':    'COLECCION',      // extra útil
    'FENTREGACONF': 'FECHA_ENTREGA',  // fecha de entrega confirmada
};


/**
 * Singleton para asegurar la configuración inicial si fuera necesaria.
 */
let secureConfigPromise = null;

async function fetchSecureConfig() {
    // En Supabase, las llaves de cliente suelen ser seguras o manejadas via Edge Functions
    // Si necesitasemos recuperar algo dinámico, lo haríamos aquí.
    return CONFIG;
}

/**
 * Obtiene los datos de una tabla de Supabase via Edge Function.
 * Reintenta hasta 3 veces en caso de errores de red.
 */
async function fetchSupabaseData(tableName) {
    const MAX_RETRIES = 3;
    let lastError;

    // Intentar primero con el nombre tal cual, luego con minúsculas como fallback
    const namesToTry = [tableName];
    if (tableName !== tableName.toLowerCase()) namesToTry.push(tableName.toLowerCase());

    for (const nameToUse of namesToTry) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const url = `${CONFIG.FUNCTIONS_URL}/query?table=${nameToUse}`;
                const response = await fetch(url);

                if (!response.ok) {
                    const errBody = await response.text().catch(() => '');
                    throw new Error(`HTTP ${response.status} al obtener ${nameToUse}: ${errBody}`);
                }

                const result = await response.json();

                // Edge Function devuelve { error: "..." } en algunos casos con status 200
                if (result && result.error) {
                    throw new Error(`Supabase: ${result.error}`);
                }

                // Supabase puede devolver el array directamente o envuelto en { data: [...] }
                let records = result;
                if (result && !Array.isArray(result) && result.data) {
                    records = result.data;
                }

                if (!Array.isArray(records)) {
                    console.warn(`[API] Respuesta inválida para ${nameToUse}:`, typeof records, records);
                    records = [];
                }

                // Normalizar claves a MAYÚSCULAS y valores a STRING para compatibilidad total.
                // Supabase devuelve números como number, pero el resto del código espera strings
                // (usa .replace, .toLowerCase, .includes, etc.). NULL se convierte a cadena vacía.
                records = records.map(r => {
                    const normalized = {};
                    for (const key in r) {
                        const val = r[key];
                        normalized[key.toUpperCase()] = (val === null || val === undefined) ? '' : String(val);
                    }
                    return normalized;
                });

                // ── Remapeo SISPRO: traducir columnas SIESA al esquema legado ──
                // SIESA usa 'OP', 'Ref', 'NombrePlanta', 'UndProg', etc.
                // La app espera 'LOTE', 'REFERENCIA', 'PLANTA', 'CANTIDAD', etc.
                const isSispro = tableName.toUpperCase() === 'SISPRO';
                if (isSispro) {
                    records = records.map(r => {
                        const remapped = { ...r }; // conservar todos los campos originales
                        for (const [siesa, legacy] of Object.entries(SISPRO_MAP)) {
                            if (siesa in remapped) {
                                remapped[legacy] = remapped[siesa];
                            }
                        }
                        return remapped;
                    });
                }

                // Filtro de seguridad: GUEST solo ve su propia planta
                const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
                if (sessionUser && sessionUser.ROL === 'GUEST' && sessionUser.PLANTA) {
                    const userPlanta = String(sessionUser.PLANTA).trim().toUpperCase();
                    records = records.filter(r => String(r.PLANTA || '').trim().toUpperCase() === userPlanta);
                }

                if (nameToUse !== tableName) {
                    console.info(`[API] Tabla "${tableName}" no encontrada, usando "${nameToUse}" (minúsculas).`);
                }

                return records;

            } catch (error) {
                lastError = error;
                console.warn(`[API] ${nameToUse} intento ${attempt + 1}/${MAX_RETRIES}:`, error.message);
                if (attempt < MAX_RETRIES - 1) {
                    await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt)));
                }
            }
        }
    }

    throw lastError;
}

/**
 * Carga todos los datos necesarios (lotes y plantas).
 */
async function fetchAllData() {
    const [lots, plantas] = await Promise.all([
        fetchSupabaseData('SISPRO'),
        fetchPlantasData()
    ]);

    return { lots, plantas };
}

/**
 * Obtiene el listado completo de novedades.
 */
async function fetchNovedadesData() {
    return fetchSupabaseData('NOVEDADES');
}

/**
 * Obtiene el listado de plantas.
 */
async function fetchPlantasData() {
    return fetchSupabaseData('PLANTAS');
}

/**
 * Obtiene el listado de usuarios para el sistema de login.
 */
async function fetchUsuariosData() {
    return fetchSupabaseData('USUARIOS');
}

/**
 * Obtiene el listado completo de reportes de calidad.
 */
async function fetchReportesData() {
    return fetchSupabaseData('REPORTES');
}

/**
 * Obtiene el listado del rutero.
 */
async function fetchRuteroData() {
    return fetchSupabaseData('RUTERO');
}
/**
 * Llama a la Edge Function de IA para procesar texto.
 */
async function callSupabaseAI(text, promptType = 'CHAT_CORRECTION', context = null) {
    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, promptType, context })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error en la IA');
        }

        return await response.json();
    } catch (e) {
        console.error('[API AI] Error:', e);
        throw e;
    }
}
