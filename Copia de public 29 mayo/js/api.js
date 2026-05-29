/* ==========================================================================
   api.js — Comunicación con Supabase
   Depende de: config.js (CONFIG)
   ========================================================================== */

// ── Remapeo específico para tabla master ──
const BUSINT_MAP = {
    'id_master':    'LOTE',
    'referencia':   'REFERENCIA',
    'cantidad':     'CANTIDAD',
    'nombre_planta':'PLANTA',
    'fecha_entrega': 'ENTRADA',
    'fecha_salida': 'SALIDA',
    'proceso':      'PROCESO',
    'descripcion':  'PRENDA',
    'cuento':       'LINEA',
    'genero':       'GENERO',
    'productora':   'PRODUCTORA'
};

// ── Clave anon pública (segura con RLS activo) ──
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";

/**
 * No-op de compatibilidad: CONFIG ya está definido en config.js,
 * no requiere fetch. Se mantiene para no romper llamadas existentes.
 */
async function fetchSecureConfig() {
    return CONFIG;
}

// ── Cliente Supabase singleton ──
let _sbClient = null;
window.getSupabaseClient = function() {
    if (_sbClient) return _sbClient;
    if (typeof supabase === 'undefined' || !supabase.createClient) return null;
    const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
    _sbClient = supabase.createClient(projectUrl, SUPABASE_KEY);
    return _sbClient;
};

// ── Caché en memoria ──
const _memCache = new Map();
const _CACHE_TTL = {
    MASTER:    15 * 60 * 1000,
    BUSINT:    15 * 60 * 1000,
    PLANTAS:   10 * 60 * 1000,
    NOVEDADES:  5 * 60 * 1000,
    REPORTES:   5 * 60 * 1000,
    RUTERO:     5 * 60 * 1000,
    CHAT:       1 * 60 * 1000,
};

// ── Deduplicación de requests en vuelo ──
const _inFlight = new Map();

/**
 * Invalida el caché de una tabla para forzar recarga en el próximo fetch.
 */
function invalidateCache(tableName) {
    _memCache.delete(tableName.toUpperCase());
}

/**
 * Obtiene datos de una tabla directamente via SDK de Supabase.
 * RLS se aplica automáticamente con el token de sesión del usuario.
 * Sin cold start — no usa Edge Functions.
 */
async function fetchSupabaseData(tableName, options = {}) {
    // Forzar minúsculas para todas las tablas en Supabase
    let finalTable = tableName.toLowerCase();
    if (finalTable === 'rutero') finalTable = 'visitas';
    if (finalTable === 'busint') finalTable = 'master';
    const tableUpper = tableName.toUpperCase();
    const isNov = tableUpper === 'NOVEDADES';
    const hasFilters = options.filters && options.filters.length > 0;

    // 1. Caché en memoria
    if (!options.noCache && !hasFilters) {
        const cached = _memCache.get(tableUpper);
        const ttl = _CACHE_TTL[tableUpper] || 5 * 60 * 1000;
        if (cached && (Date.now() - cached.ts) < ttl) {
            return _normalizeSupabaseData(cached.data, tableName);
        }
    }

    // 2. Deduplicación de requests simultáneos
    const flightKey = tableUpper + (options.filters ? JSON.stringify(options.filters) : '');
    if (!options.noCache && _inFlight.has(flightKey)) {
        return _inFlight.get(flightKey);
    }

    // 3. Fetch directo via SDK (sin Edge Function)
    const fetchPromise = (async () => {
        try {
            const sb = getSupabaseClient();
            if (!sb) throw new Error('Supabase client no disponible');

            let allData = [];
            let from = 0;
            const limit = 1000;
            let keepFetching = true;

            while (keepFetching) {
                let query = sb.from(finalTable).select(options.select || '*').range(from, from + limit - 1);

                // Aplicar filtros opcionales
                if (hasFilters) {
                    options.filters.forEach(f => {
                        const col = f.column.toLowerCase();
                        if (f.type === 'eq')  query = query.eq(col, f.value);
                        if (f.type === 'neq') query = query.neq(col, f.value);
                        if (f.type === 'in')  query = query.in(col, f.value.split(','));
                    });
                }

                // Filtro GUEST directo en la query (RLS lo refuerza en el servidor)
                const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
                const skipFilter = ['CHAT'].includes(tableUpper);
                if (!skipFilter && sessionUser && sessionUser.ROL === 'GUEST' && sessionUser.PLANTA) {
                    const plantCol = (tableUpper === 'MASTER' || tableUpper === 'BUSINT') ? 'nombre_planta' : 'planta';
                    query = query.eq(plantCol, sessionUser.PLANTA);
                }
                // Filtro por productora para usuarios internos
                if (!skipFilter && ['MASTER', 'PLANTAS', 'NOVEDADES', 'RUTERO', 'VISITAS', 'REPORTES'].includes(tableUpper) && sessionUser &&
                    ['ADMIN', 'MODERATOR', 'USER-P', 'USER-C', 'USER-I'].includes(sessionUser.ROL) &&
                    sessionUser.ID_PRODUCTORA) {
                    
                    // Excepción: ADMIN y MODERATOR ven todas las productoras SOLO en la tabla REPORTES (Calidad)
                    const isAdminOrMod = ['ADMIN', 'MODERATOR'].includes(sessionUser.ROL);
                    if (!(isAdminOrMod && tableUpper === 'REPORTES')) {
                        query = query.eq('productora', parseInt(sessionUser.ID_PRODUCTORA));
                    }
                }

                const { data, error } = await query;
                if (error) throw error;

                if (data && data.length > 0) {
                    allData = allData.concat(data);
                }

                if (data && data.length === limit) {
                    from += limit;
                } else {
                    keepFetching = false;
                }
            }

            if (!hasFilters) {
                _memCache.set(tableUpper, { data: allData, ts: Date.now() });
            }

            return _normalizeSupabaseData(allData, tableName);
        } catch (error) {
            console.error(`[API] Error en fetchSupabaseData (${tableName}):`, error);
            throw error;
        } finally {
            _inFlight.delete(flightKey);
        }
    })();

    if (!options.noCache) {
        _inFlight.set(flightKey, fetchPromise);
        fetchPromise.finally(() => _inFlight.delete(flightKey));
    }

    return fetchPromise;
}

/** Normaliza claves y aplica mapeos legacy */
function _normalizeSupabaseData(records, tableName) {
    const tableUpper = tableName.toUpperCase();
    
    if (tableUpper === 'RUTERO' || tableUpper === 'VISITAS') {
        return records.map(r => {
            const obj = {};
            for (const key in r) {
                const val = r[key];
                let k = key.toUpperCase();
                if (k === 'ID_VISITAS' || k === 'ID_RUTERO') {
                    obj['ID_VISITA'] = (val === null || val === undefined) ? '' : String(val);
                }
                obj[k] = (val !== null && val !== undefined && typeof val === 'object')
                    ? val
                    : (val === null || val === undefined) ? '' : String(val);
            }
            return obj;
        });
    }

    const isMaster = tableUpper === 'BUSINT' || tableUpper === 'MASTER';

    return records.map(r => {
        if (isMaster) {
            const remapped = { ...r };
            for (const [col, alias] of Object.entries(BUSINT_MAP)) {
                if (col in r) {
                    const v = r[col];
                    remapped[alias] = (v === null || v === undefined) ? '' : String(v);
                }
            }
            return remapped;
        } else {
            const obj = {};
            for (const key in r) {
                const val = r[key];
                const k = key.toUpperCase();
                obj[k] = (val !== null && val !== undefined && typeof val === 'object')
                    ? val
                    : (val === null || val === undefined) ? '' : String(val);
            }
            return obj;
        }
    });
}

/**
 * Carga todos los datos necesarios (lotes y plantas) en paralelo.
 */
async function fetchAllData() {
    const [lots, plantas] = await Promise.all([
        fetchSupabaseData('master'),
        fetchPlantasData()
    ]);
    return { lots, plantas };
}

/**
 * Obtiene novedades directamente via SDK.
 */
async function fetchNovedadesData(soloFinalizados = false, incluirTodos = false) {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client no disponible');

    // ── GUEST / USER-P: leer via Edge Function para evitar restricciones de RLS ──
    const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
    if (sessionUser?.ROL === 'GUEST' || sessionUser?.ROL === 'USER-P') {
        const isGuest = sessionUser.ROL === 'GUEST';
        const plantaNombre = isGuest ? (sessionUser.PLANTA || sessionUser.planta) : null;
        const prodId       = sessionUser.ID_PRODUCTORA || sessionUser.productora;

        // Fallback a localStorage si currentUser no tiene los datos
        let filtroPlanta = plantaNombre, filtroProductora = prodId;
        if (!filtroPlanta && !filtroProductora) {
            try {
                const univ = JSON.parse(localStorage.getItem('busint_universal_plant') || 'null');
                filtroPlanta    = univ?.planta || univ?.PLANTA;
                filtroProductora = univ?.productora || univ?.ID_PRODUCTORA;
            } catch(e) {}
        }

        // Si sigue sin estar la productora y es USER-P, intentar buscarla en busint_productora
        if (!filtroProductora && sessionUser.ROL === 'USER-P') {
            try {
                const prodRaw = localStorage.getItem('busint_productora');
                if (prodRaw) {
                    const prodObj = JSON.parse(prodRaw);
                    filtroProductora = prodObj?.ID_PRODUCTORA || prodObj?.id_productora;
                }
            } catch(e) {}
        }

        const body = { accion: 'LISTAR_NOVEDADES' };
        if (filtroPlanta)     body.planta    = filtroPlanta;
        else if (filtroProductora) body.productora = filtroProductora;

        let sessionToken = SUPABASE_KEY;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch(e) {}

        const resp = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error('Error al obtener novedades');
        const resJson = await resp.json();
        let novedades = resJson.novedades || [];

        // Aplicar filtro de estado en el cliente si es necesario
        if (!incluirTodos) {
            if (soloFinalizados) {
                novedades = novedades.filter(n => n.estado === 'FINALIZADO');
            } else {
                novedades = novedades.filter(n => n.estado !== 'FINALIZADO');
            }
        }
        return _normalizeSupabaseData(novedades, 'novedades');
    }

    // ── Roles internos: Usar fetchSupabaseData que ya maneja paginación y filtros de productora/GUEST ──
    const filters = [];
    if (!incluirTodos) {
        if (soloFinalizados) {
            filters.push({ column: 'estado', type: 'eq', value: 'FINALIZADO' });
        } else {
            filters.push({ column: 'estado', type: 'neq', value: 'FINALIZADO' });
        }
    }
    return fetchSupabaseData('novedades', { filters, noCache: true });
}

/**
 * Obtiene el listado de plantas.
 * Si no hay sesión activa (ej: página de login), usa la Edge Function
 * para evitar el 401 de RLS.
 */
async function fetchPlantasData(options = {}) {
    const sb = getSupabaseClient();
    let hasSession = false;
    if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        hasSession = !!session;
    }

    // Con sesión: SDK directo (rápido, sin cold start)
    // Pero si forceEdge es true, se va por la Edge Function para saltarse RLS
    if (hasSession && !options.forceEdge) {
        return fetchSupabaseData('plantas');
    }

    // Sin sesión (login page): Edge Function con service_role
    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({ accion: 'LISTAR_PLANTAS' })
        });
        if (!response.ok) return [];
        const result = await response.json();
        return _normalizeSupabaseData(result.plantas || [], 'PLANTAS');
    } catch (e) {
        console.error('[API] Error en fetchPlantasData (sin sesión):', e);
        return [];
    }
}

/**
 * Obtiene usuarios para resolución de email en login (acción pública)
 * o listado completo para admin (requiere sesión).
 */
async function fetchUsuariosData() {
    try {
        const sb = getSupabaseClient();
        let token = SUPABASE_KEY;
        let hasSession = false;
        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) { token = session.access_token; hasSession = true; }
        }

        // Determinar rol para elegir la acción correcta
        let isAdmin = false;
        if (hasSession && typeof currentUser !== 'undefined' && currentUser) {
            isAdmin = ['ADMIN', 'MODERATOR'].includes(currentUser.ROL);
        }

        // Solo administradores pueden listar TODO. Otros usan la resolución de login.
        const accion = isAdmin ? 'LISTAR_USUARIOS' : 'RESOLVER_USUARIOS_LOGIN';

        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({ accion })
        });
        if (!response.ok) throw new Error('Error al listar usuarios');
        const result = await response.json();
        return result.users || [];
    } catch (e) {
        console.error('[API] Error al listar usuarios de Auth:', e);
        return [];
    }
}

/**
 * Obtiene reportes de calidad.
 */
async function fetchReportesData() {
    const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
    
    // Si el rol es USER-C, leer via Edge Function para evitar restricciones de RLS
    if (sessionUser && sessionUser.ROL === 'USER-C') {
        let sessionToken = SUPABASE_KEY;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch(e) {}

        const resp = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                accion: 'LISTAR_REPORTES',
                email: sessionUser.EMAIL || sessionUser.CORREO
            })
        });
        if (!resp.ok) throw new Error('Error al obtener mis reportes');
        const resJson = await resp.json();
        const reportes = resJson.reportes || [];
        return _normalizeSupabaseData(reportes, 'reportes');
    }

    // Si el rol es USER-P, intentar leer por productora via Edge Function (asegura scoped data)
    if (sessionUser && sessionUser.ROL === 'USER-P') {
        let sessionToken = SUPABASE_KEY;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch(e) {}

        try {
            const resp = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ accion: 'LISTAR_REPORTES', productora: sessionUser.ID_PRODUCTORA })
            });
            if (resp.ok) {
                const resJson = await resp.json();
                const reportes = resJson.reportes || [];
                return _normalizeSupabaseData(reportes, 'reportes');
            }
        } catch (e) {
            console.warn('[API] LISTAR_REPORTES falló para USER-P:', e);
            // fallback a fetchSupabaseData
        }
    }

    return fetchSupabaseData('reportes');
}

/**
 * Obtiene el rutero.
 */
async function fetchRuteroData() {
    return fetchSupabaseData('RUTERO');
}

/**
 * Llama a la Edge Function de IA.
 * Requiere Edge Function (modelo de IA en servidor).
 */
async function callSupabaseAI(text, promptType = 'CHAT_CORRECTION', context = null) {
    try {
        const sb = getSupabaseClient();
        let token = SUPABASE_KEY;
        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) token = session.access_token;
        }
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
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

/**
 * Realiza un ping OPTIONS súper ligero a la Edge Function de IA para calentarla (warm-up).
 * Esto evita el retraso de "Cold Start" de Supabase Edge Functions para que responda al instante.
 */
async function warmUpSupabaseAI() {
    try {
        console.log('[API] Calentando Edge Function de IA...');
        fetch(`${CONFIG.FUNCTIONS_URL}/ai`, {
            method: 'OPTIONS',
            headers: { 'apikey': SUPABASE_KEY }
        }).catch(() => {});
    } catch (_) {}
}

/**
 * Sube imagen a Storage.
 * Requiere Edge Function (service_role para Storage).
 */
async function uploadToSupabase(file, productoraId = null, hoja = null) {
    try {
        const compressedBlob = await compressImage(file);
        const base64Data = await blobToBase64(compressedBlob);

        const sb = getSupabaseClient();
        let token = SUPABASE_KEY;
        let pId = productoraId;

        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                token = session.access_token;
                // Si no se pasó productoraId, intentar obtenerlo de la sesión
                if (!pId) {
                    const user = session.user;
                    pId = user.user_metadata?.id_productora || user.user_metadata?.productora || user.user_metadata?.ID_PRODUCTORA;
                }
            }
        }

        console.log(`[API UPLOAD] Enviando con Productora ID: ${pId} | Hoja: ${hoja}`);

        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                accion: 'SUBIR_ARCHIVO',
                productora: pId,
                hoja: hoja,
                imagen: {
                    base64: base64Data,
                    mimeType: 'image/jpeg',
                    fileName: file.name.replace(/\.[^.]+$/, '.jpg')
                }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Error de servidor' }));
            throw new Error(err.message || 'Error en la subida');
        }

        const result = await response.json();
        if (!result.success || !result.url) throw new Error(result.message || 'No se recibió la URL');
        return result.url;
    } catch (e) {
        console.error('[UPLOAD] Error crítico:', e);
        throw e;
    }
}

/** Comprime imagen antes de subir (~150KB) */
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const MAX_W = 1024;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(b => b ? resolve(b) : reject('Error Blob'), 'image/jpeg', 0.7);
            } catch (e) { reject(e); }
        };
        img.onerror = () => reject('Error Carga');
        img.src = url;
    });
}

/** Convierte Blob a Base64 (sin prefijo) */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Obtiene tallas y colores disponibles para una OP.
 * Reemplaza la lógica de barras/curva en el formulario de novedad.
 * @param {string|number} idMaster - El id_master (OP)
 * @returns {Promise<{op, tallas, colores, hasCurva}>}
 */
async function fetchTallasColores(idMaster) {
    const sb = getSupabaseClient();
    let token = SUPABASE_KEY;
    if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session) token = session.access_token;
    }
    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ accion: 'GET_TALLAS_COLORES', id_master: idMaster })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Error de servidor' }));
        throw new Error(err.message || `HTTP ${response.status}`);
    }
    return await response.json();
}

window.fetchTallasColores = fetchTallasColores;

window.uploadToSupabase = uploadToSupabase;
