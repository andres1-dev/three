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

// ── Caché en memoria para todas las tablas ──
// Evita re-fetches al cambiar de módulo dentro de la misma sesión de página.
// TTL por tabla (ms): SISPRO 15min, auth tables 10min, operativas 5min.
const _memCache = new Map(); // key → { data, ts }
const _CACHE_TTL = {
    SISPRO:    15 * 60 * 1000,
    USUARIOS:  10 * 60 * 1000,
    PLANTAS:   10 * 60 * 1000,
    NOVEDADES:  5 * 60 * 1000,
    REPORTES:   5 * 60 * 1000,
    RUTERO:     5 * 60 * 1000,
    CHAT:       1 * 60 * 1000,
};

// Promesas en vuelo para evitar fetches duplicados simultáneos (deduplicación)
const _inFlight = new Map();

/**
 * Invalida el caché de una tabla para forzar recarga en el próximo fetch.
 * Útil después de insertar/actualizar registros.
 */
function invalidateCache(tableName) {
    const key = tableName.toUpperCase();
    _memCache.delete(key);
    // También limpiar sessionStorage legacy de SISPRO
    if (key === 'SISPRO') sessionStorage.removeItem('sb_cache_SISPRO');
}

/**
 * Warm-up de la edge function /query para evitar cold start en la primera carga real.
 * Se llama sin await para no bloquear nada.
 */
function _warmUpQuery() {
    fetch(`${CONFIG.FUNCTIONS_URL}/query?table=USUARIOS`, {
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
    }).catch(() => {});
}

/**
 * Obtiene los datos de una tabla proxying a la Edge Function segura.
 * Incluye caché en memoria, deduplicación de requests y warm-up automático.
 */
async function fetchSupabaseData(tableName, options = {}) {
    const tableUpper = tableName.toUpperCase();
    const isSispro = tableUpper === 'SISPRO';
    const hasFilters = options.filters && options.filters.length > 0;

    // 1. Caché en memoria (solo para consultas sin filtros dinámicos)
    if (!options.noCache && !hasFilters) {
        const cached = _memCache.get(tableUpper);
        const ttl = _CACHE_TTL[tableUpper] || 5 * 60 * 1000;
        if (cached && (Date.now() - cached.ts) < ttl) {
            return _normalizeSupabaseData(cached.data, tableName);
        }

        // Fallback: caché sessionStorage legacy para SISPRO
        if (isSispro) {
            const raw = sessionStorage.getItem('sb_cache_SISPRO');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Date.now() - parsed.ts < ttl) {
                        _memCache.set(tableUpper, { data: parsed.data, ts: parsed.ts });
                        return _normalizeSupabaseData(parsed.data, tableName);
                    }
                } catch(e) {}
            }
        }
    }

    // 2. Deduplicación: si ya hay un fetch en vuelo para esta tabla, reutilizarlo
    const flightKey = tableUpper + (options.filters ? JSON.stringify(options.filters) : '');
    if (!options.noCache && _inFlight.has(flightKey)) {
        return _inFlight.get(flightKey);
    }

    // 3. Fetch real hacia la Edge Function
    const fetchPromise = (async () => {
        const namesToTry = [tableName];
        if (tableName !== tableName.toLowerCase()) namesToTry.push(tableName.toLowerCase());

        for (const nameToUse of namesToTry) {
            try {
                let url = `${CONFIG.FUNCTIONS_URL}/query?table=${nameToUse}`;

                if (options.select) url += `&select=${encodeURIComponent(options.select)}`;
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
                    // Guardar en caché solo si no tiene filtros dinámicos
                    if (!hasFilters) {
                        _memCache.set(tableUpper, { data: records, ts: Date.now() });
                        if (isSispro) {
                            sessionStorage.setItem('sb_cache_SISPRO', JSON.stringify({ ts: Date.now(), data: records }));
                        }
                    }
                    return _normalizeSupabaseData(records, tableName);
                }
            } catch (error) {
                // Solo reintentar una vez con delay mínimo
                await new Promise(r => setTimeout(r, 300));
                try {
                    const url = `${CONFIG.FUNCTIONS_URL}/query?table=${nameToUse}`;
                    const response = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const result = await response.json();
                    const records = (result && result.data) ? result.data : result;
                    if (Array.isArray(records)) {
                        if (!hasFilters) _memCache.set(tableUpper, { data: records, ts: Date.now() });
                        return _normalizeSupabaseData(records, tableName);
                    }
                } catch(_) {}
            }
        }
        return [];
    })();

    if (!options.noCache) {
        _inFlight.set(flightKey, fetchPromise);
        fetchPromise.finally(() => _inFlight.delete(flightKey));
    }

    return fetchPromise;
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
                const keyUpper = key.toUpperCase();
                
                // Preservar objetos JSONB (no convertir a string)
                if (val !== null && val !== undefined && typeof val === 'object') {
                    obj[keyUpper] = val;
                } else {
                    obj[keyUpper] = (val === null || val === undefined) ? '' : String(val);
                }
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
 * Obtiene el listado de novedades con filtro opcional por estado.
 * @param {boolean} soloFinalizados - Si es true, trae solo FINALIZADOS. Si es false, trae todo excepto FINALIZADOS.
 */
async function fetchNovedadesData(soloFinalizados = false) {
    const filters = [];
    
    if (soloFinalizados) {
        // Traer solo los finalizados
        filters.push({ type: 'eq', column: 'ESTADO', value: 'FINALIZADO' });
    } else {
        // Traer todo excepto finalizados (PENDIENTE y ELABORACION)
        filters.push({ type: 'neq', column: 'ESTADO', value: 'FINALIZADO' });
    }
    
    return fetchSupabaseData('NOVEDADES', { filters, noCache: true });
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
        const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THb9v8csluebALg";
        
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/ai`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({ text, promptType, context })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Error de conexión' }));
            throw new Error(err.error || 'Error en la IA');
        }

        return await response.json();
    } catch (e) {
        console.error('[API] Error en callSupabaseAI:', e);
        throw e;
    }
}
