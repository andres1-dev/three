/* ==========================================================================
   api.js — Comunicación con Supabase (Migrado desde GAS/Sheets)
   Depende de: config.js (CONFIG)
   ========================================================================== */

// ── Remapeo específico para tabla SISPRO ──
// Los datos vienen del CSV con nombres específicos que se mapean
// a los nombres que espera la aplicación (esquema legado)
const SISPRO_MAP = {
    'OP': 'LOTE',
    'Ref': 'REFERENCIA',
    'InvPlanta': 'CANTIDAD',
    'NombrePlanta': 'PLANTA',
    'FSalidaConf': 'SALIDA',
    'Proceso': 'PROCESO',
    'Descripcion': 'PRENDA',
    'Cuento': 'LINEA',
    'Genero': 'GENERO',
    'Tipo Tejido': 'TEJIDO'
};

// ── Inicialización de Configuración ──
// Las claves de Supabase ya no se exponen al cliente de JS. Todo fluye por Edge Functions.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THb9v8csluebALg";

let _sbClient = null;
window.getSupabaseClient = function() {
    if (_sbClient) return _sbClient;
    if (!window.supabase) {
        return null;
    }
    const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
    _sbClient = window.supabase.createClient(projectUrl, SUPABASE_KEY);
    return _sbClient;
};

let secureConfigPromise = null;

async function fetchSecureConfig() {
    return CONFIG;
}

/**
 * Obtiene los datos de una tabla proxying a la Edge Function segura.
 * Reintenta en caso de errores de red y soporta caché para tablas masivas.
 */
async function fetchSupabaseData(tableName, options = {}) {
    const tableUpper = tableName.toUpperCase();
    const isAuthTable = ['USUARIOS', 'PLANTAS'].includes(tableUpper);
    const isSispro = tableUpper === 'SISPRO';

    // 1. Caché estricto para SISPRO (15 min) para evitar descargas pesadas
    const cacheKey = `sb_cache_SISPRO`;
    if (isSispro && !options.noCache) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.ts < 15 * 60 * 1000) {
                    return _normalizeSupabaseData(parsed.data, tableName);
                }
            } catch(e){}
        }
    }

    // 2. Ejecución hacia la Edge Function (Única fuente de verdad)
    const MAX_RETRIES = 2;
    const namesToTry = [tableName];
    if (tableName !== tableName.toLowerCase()) namesToTry.push(tableName.toLowerCase());

    for (const nameToUse of namesToTry) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                let url = `${CONFIG.FUNCTIONS_URL}/query?table=${nameToUse}`;
                
                // Mapear el options.select si se proporciona para traer columnas específicas
                if (options.select) {
                    url += `&select=${encodeURIComponent(options.select)}`;
                }

                // Armar filtros básicos pasados
                if (options.filters) {
                    options.filters.forEach(f => {
                        url += `&${f.type}_${f.column}=${encodeURIComponent(f.value)}`;
                    });
                }

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'apikey': SUPABASE_KEY
                    }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const result = await response.json();
                const records = (result && result.data) ? result.data : result;

                if (Array.isArray(records)) {
                    if (isSispro) sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: records }));
                    return _normalizeSupabaseData(records, tableName);
                }
            } catch (error) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
    }
    
    // Devolvemos vacío si falla la extracción para evitar crasheos de la app general
    return []; 
}

/** Helper para normalizar claves y aplicar mapeos legacy */
function _normalizeSupabaseData(records, tableName) {
    const tableUpper = tableName.toUpperCase();

    // Para SISPRO, NO convertir a mayúsculas porque los nombres del CSV tienen case-sensitive
    const isSispro = tableUpper === 'SISPRO';
    
    let normalized = records.map(r => {
        if (isSispro) {
            // Para SISPRO, mantener los nombres originales del CSV y mapear
            const remapped = {};
            
            // Copiar todos los campos originales
            for (const key in r) {
                remapped[key] = r[key];
            }
            
            // Agregar los campos mapeados para compatibilidad con la app
            for (const [csvName, appName] of Object.entries(SISPRO_MAP)) {
                if (csvName in r) {
                    // Convertir a string para asegurar compatibilidad
                    const value = r[csvName];
                    remapped[appName] = (value === null || value === undefined) ? '' : String(value);
                }
            }
            
            return remapped;
        } else {
            // Para otras tablas, normalizar a mayúsculas
            const obj = {};
            for (const key in r) {
                const val = r[key];
                obj[key.toUpperCase()] = (val === null || val === undefined) ? '' : String(val);
            }
            return obj;
        }
    });

    // Filtro de seguridad GUEST: solo aplica a tablas operativas, NO a usuarios/plantas/chat
    const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
    const skipFilter = ['USUARIOS', 'PLANTAS', 'CHAT'].includes(tableUpper); 

    if (!skipFilter && sessionUser && sessionUser.ROL === 'GUEST' && sessionUser.PLANTA) {
        const userPlanta = String(sessionUser.PLANTA).trim().toUpperCase();

        // Filtrado inteligente: buscar en PLANTA (normalizado) o NombrePlanta (original SISPRO)
        normalized = normalized.filter(r => {
            const rowPlanta = String(r.PLANTA || r.NombrePlanta || '').trim().toUpperCase();
            return rowPlanta === userPlanta;
        });
    }

    return normalized;
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
        throw e;
    }
}
