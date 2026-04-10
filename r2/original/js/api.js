/* ==========================================================================
   api.js — Comunicación con Google Sheets API y Seguridad
   Depende de: config.js (CONFIG, SHEET_SISPRO, GAS_ENDPOINT)
   ========================================================================== */

/**
 * Recupera las llaves de API desde Google Apps Script (GAS)
 * para evitar que estén hardcodeadas en el frontend.
 */
let secureConfigPromise = null;

/**
 * Recupera las llaves de API desde Google Apps Script (GAS).
 * Singleton pattern — evita múltiples llamadas paralelas.
 * Almacenamiento en localStorage con TTL de 6h.
 */
async function fetchSecureConfig() {
    if (secureConfigPromise) return secureConfigPromise;

    secureConfigPromise = (async () => {
        try {
            const stored = localStorage.getItem('app_secure_config');
            const now = Date.now();

            if (stored) {
                const parsed = JSON.parse(stored);
                // TTL: 6 horas
                if (now - parsed.timestamp < 6 * 3600 * 1000 && parsed.API_KEY) {
                    CONFIG.API_KEY   = parsed.API_KEY;
                    CONFIG.GEMINI_KEY = parsed.GEMINI_KEY;
                    return CONFIG;
                }
            }

            const res = await fetch(GAS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ accion: 'GET_CONFIG' })
            });

            if (!res.ok) throw new Error(`GAS config HTTP ${res.status}`);

            const data = await res.json();
            if (data?.API_KEY) {
                CONFIG.API_KEY    = data.API_KEY;
                CONFIG.GEMINI_KEY = data.GEMINI_KEY;
                localStorage.setItem('app_secure_config', JSON.stringify({
                    API_KEY:   data.API_KEY,
                    GEMINI_KEY: data.GEMINI_KEY,
                    timestamp: now
                }));
            }
            return CONFIG;
        } catch (error) {
            secureConfigPromise = null; // Permitir reintento en la próxima llamada
            throw error;
        }
    })();

    return secureConfigPromise;
}

/**
 * Obtiene los datos de una hoja específica del spreadsheet.
 * Reintenta hasta 3 veces con backoff exponencial.
 * Si falla por key inválida (401/403), limpia almacenamiento y refresca la key.
 */
async function fetchSheetData(sheetName, indices, headers) {
    if (!CONFIG.API_KEY) await fetchSecureConfig();

    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const url =
                `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
                `/values/${sheetName}!A:AF?key=${CONFIG.API_KEY}&majorDimension=ROWS`;

            const response = await fetch(url);

            // Key inválida o expirada — limpiar cache y refrescar antes del próximo intento
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('app_secure_config');
                CONFIG.API_KEY = null;
                secureConfigPromise = null;
                await fetchSecureConfig();
                lastError = new Error(`HTTP ${response.status} — key refrescada, reintentando`);
                continue;
            }

            if (!response.ok) throw new Error(`HTTP ${response.status} al obtener ${sheetName}`);

            const { values = [] } = await response.json();
            if (values.length <= 1) return [];

            let records = values.slice(1).map((row) => {
                const record = {};
                indices.forEach((colIndex, i) => {
                    record[headers[i]] = colIndex < row.length ? row[colIndex] : '';
                });
                return record;
            });

            // Filtro de seguridad: GUEST solo ve su propia planta
            const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
            if (sessionUser && sessionUser.ROL === 'GUEST' && sessionUser.PLANTA && headers.includes('PLANTA')) {
                const userPlanta = String(sessionUser.PLANTA).trim().toUpperCase();
                records = records.filter(r => String(r.PLANTA || '').trim().toUpperCase() === userPlanta);
            }

            return records;

        } catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
                // Backoff: 500ms, 1500ms
                await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt)));
            }
        }
    }

    throw lastError;
}

/**
 * Carga todos los datos necesarios (lotes y plantas).
 *
 * @returns {Promise<{lots: Object[], plantas: Object[]}>}
 * @throws {Error} Propaga errores de red/API.
 */
async function fetchAllData() {
    const [lots, plantas] = await Promise.all([
        fetchSheetData(SHEET_SISPRO.name, SHEET_SISPRO.indices, SHEET_SISPRO.headers),
        fetchPlantasData()
    ]);

    return { lots, plantas };
}

/**
 * Obtiene el listado completo de novedades para el módulo de resolución.
 */
async function fetchNovedadesData() {
    return fetchSheetData(
        SHEET_NOVEDADES.name,
        SHEET_NOVEDADES.indices,
        SHEET_NOVEDADES.headers,
    );
}

/**
 * Obtiene el listado de actualizaciones de plantas para cruzar datos en las impresiones.
 */
async function fetchPlantasData() {
    return fetchSheetData(
        SHEET_PLANTAS.name,
        SHEET_PLANTAS.indices,
        SHEET_PLANTAS.headers,
    );
}
/**
 * Obtiene el listado de usuarios para el sistema de login.
 */
async function fetchUsuariosData() {
    return fetchSheetData(
        SHEET_USUARIOS.name,
        SHEET_USUARIOS.indices,
        SHEET_USUARIOS.headers,
    );
}

/**
 * Obtiene el listado completo de reportes de calidad.
 */
async function fetchReportesData() {
    return fetchSheetData(
        SHEET_REPORTES.name,
        SHEET_REPORTES.indices,
        SHEET_REPORTES.headers,
    );
}
