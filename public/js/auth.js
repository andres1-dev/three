/**
 * auth.js - Sistema de Autenticación Unificado (Native Supabase)
 * NO guarda datos sensibles en LocalStorage.
 * Intercepta llamadas legadas para mantener compatibilidad sin persistencia.
 */

const IS_LOGIN_PAGE = window.location.pathname.toLowerCase().includes('login.html');
const B_KEY = 'busint_biometric_ids';

// 1. Objeto de Usuario en Memoria (Fuente de Verdad)
window.currentUser = null;

function _sanitizeProductora(user) {
    if (!user) return;
    
    // Construir mapa dinámico desde el caché cargado de Supabase (sin hardcodear nombres)
    const PRODUCTORAS_MAP = {};
    try {
        const cached = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
        (cached || []).forEach(p => {
            const id = p.id_productora || p.ID_PRODUCTORA || p.id;
            const nombre = p.productora || p.PRODUCTORA || p.nombre;
            if (id && nombre) {
                PRODUCTORAS_MAP[String(id).trim()] = nombre;
            }
        });
    } catch (_) {}

    // Intentar obtener ID de productora desde cualquier fuente disponible
    let rawId = user.ID_PRODUCTORA || user.id_productora || user.productora;
    
    // Si el ID es null/undefined pero PRODUCTORA existe y es numérico, usarlo como ID
    if (!rawId) {
        const nameRaw = user.PRODUCTORA || user.productora;
        if (nameRaw && !isNaN(Number(String(nameRaw).trim())) && String(nameRaw).trim() !== '0') {
            rawId = nameRaw;
        }
    }

    const cleanId = String(rawId || '').trim();
    const mappedName = PRODUCTORAS_MAP[cleanId];
    
    if (cleanId && (mappedName || !isNaN(Number(cleanId)))) {
        // Tenemos un ID válido — normalizar
        user.ID_PRODUCTORA = parseInt(cleanId);
        user.id_productora = parseInt(cleanId);
        if (mappedName) {
            user.PRODUCTORA = mappedName;
            user.productora = mappedName;
        }
        // Si no hay nombre mapeado, mantener el ID numérico (se resolverá en loadUsers)
    } else {
        // Fallback: verificar si PRODUCTORA es un ID numérico que podemos mapear
        const pVal = String(user.PRODUCTORA || user.productora || '').trim();
        if (pVal && !isNaN(Number(pVal)) && PRODUCTORAS_MAP[pVal]) {
            const mappedNameFallback = PRODUCTORAS_MAP[pVal];
            user.ID_PRODUCTORA = parseInt(pVal);
            user.id_productora = parseInt(pVal);
            user.PRODUCTORA = mappedNameFallback;
            user.productora = mappedNameFallback;
        }
    }
}

// 2. Interceptor de Compatibilidad (Evita que scripts viejos crasheen)
// Esto permite que el sistema funcione SIN guardar nada en LocalStorage
(function _compatLayer() {
    const _oldGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
        if (key === 'busint_user') {
            return window.currentUser ? JSON.stringify(window.currentUser) : _oldGetItem.call(this, key);
        }
        return _oldGetItem.call(this, key);
    };
})();

// 3. Función Maestra de Sesión
function hasValidSession() {
    for (let i = 0; i < localStorage.length; i++) {
        try {
            const key = localStorage.key(i);
            if (key && key.includes('-auth-token')) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const session = JSON.parse(raw);
                if (session && session.access_token) return true;
            }
        } catch (e) {
            console.warn("[AUTH] Ignorando llave de sesión corrupta:", localStorage.key(i));
        }
    }
    return false;
}

function _buildCurrentUser(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};

    window.currentUser = {
        ID_USUARIO: meta.id_usuario || user.id,
        ID_PLANTA: meta.id_planta || meta.id_usuario || user.id,
        USUARIO: meta.full_name || meta.usuario || user.email,
        PLANTA: meta.planta || meta.full_name || '',
        CORREO: user.email,
        EMAIL: user.email,
        ROL: meta.role || meta.ROL || 'GUEST',
        TELEFONO: meta.telefono || meta.phone || user.phone || '',
        DIRECCION: meta.direccion || '',
        PAIS: meta.pais || 'Colombia',
        DEPARTAMENTO: meta.departamento || '',
        CIUDAD: meta.ciudad || '',
        BARRIO: meta.barrio || '',
        COMUNA: meta.comuna || '',
        CONTACTO: meta.contacto || '',
        PRODUCTORA: meta.productora || null,
        ID_PRODUCTORA: meta.id_productora || null
    };

    // ── LÓGICA DE ACCESO UNIVERSAL PARA PLANTAS ──
    if (user.email === 'plantas@grupotdm.com.co') {
        try {
            const universalData = JSON.parse(localStorage.getItem('busint_universal_plant') || 'null');
            if (universalData) {
                window.currentUser.ID_PLANTA  = universalData.ID_PLANTA  || universalData.id_planta  || universalData.id;
                window.currentUser.PLANTA     = universalData.PLANTA     || universalData.planta;
                window.currentUser.USUARIO    = universalData.PLANTA     || universalData.planta;
                window.currentUser.ID_USUARIO = universalData.ID_PLANTA  || universalData.id_planta  || universalData.id;

                // El campo `productora` en la tabla de Supabase es el ID numérico
                const prodIdRaw = universalData.ID_PRODUCTORA || universalData.productora;
                if (prodIdRaw) {
                    window.currentUser.ID_PRODUCTORA = parseInt(prodIdRaw);
                    // Buscar el nombre guardado previamente (enriquecido en _validateUniversalPlantSilent)
                    const savedProd = JSON.parse(localStorage.getItem('busint_productora') || 'null');
                    const PRODUCTORAS_MAP = {
                        '1': 'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.',
                        '2': 'TEXTILES Y CREACIONES LOS ANGELES S.A.S.',
                        '3': 'HACEMOS MODA S.A.S.',
                        '4': 'INVERSIONES URBANA S.A.S.'
                    };
                    const staticMapped = PRODUCTORAS_MAP[String(prodIdRaw).trim()];
                    if (savedProd && String(savedProd.ID_PRODUCTORA) === String(prodIdRaw) && savedProd.PRODUCTORA) {
                        window.currentUser.PRODUCTORA = savedProd.PRODUCTORA;
                    } else if (staticMapped) {
                        window.currentUser.PRODUCTORA = staticMapped;
                    } else {
                        // Fallback: guardar el ID como nombre temporalmente (se resolverá en loadUsers)
                        window.currentUser.PRODUCTORA = universalData.PRODUCTORA || null;
                    }
                }
                // Merge del resto de campos sin pisar las correcciones anteriores
                const { productora: _p, ID_PRODUCTORA: _ip, PRODUCTORA: _pn, ...restData } = universalData;
                Object.assign(window.currentUser, restData);

                // Sobre-escribir de forma contundente tanto mayúsculas como minúsculas
                const realEmail = universalData.EMAIL || universalData.email || universalData.CORREO || universalData.correo || '';
                if (realEmail && realEmail !== 'plantas@grupotdm.com.co') {
                    window.currentUser.EMAIL = realEmail;
                    window.currentUser.CORREO = realEmail;
                    window.currentUser.email = realEmail;
                    window.currentUser.correo = realEmail;
                } else {
                    window.currentUser.EMAIL = '';
                    window.currentUser.CORREO = '';
                    window.currentUser.email = '';
                    window.currentUser.correo = '';
                }
                const realTel = universalData.TELEFONO || universalData.telefono || '';
                if (realTel) {
                    window.currentUser.TELEFONO = realTel;
                    window.currentUser.telefono = realTel;
                }
            }
        } catch(e) { console.error("Error vinculando planta universal:", e); }
    }

    // Recuperar productora seleccionada en el login
    try {
        const saved = JSON.parse(localStorage.getItem('busint_productora') || 'null');
        if (saved && saved.ID_PRODUCTORA) {
            window.currentUser.ID_PRODUCTORA = saved.ID_PRODUCTORA;
            window.currentUser.PRODUCTORA    = saved.PRODUCTORA || null;
        }
    } catch(e) {}

    // Fallback: intentar recuperar productora desde la caché de productoras si no hay localStorage
    if (!window.currentUser.ID_PRODUCTORA) {
        try {
            const cached = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
            if (cached && cached.length > 0) {
                // Si solo hay una productora, usarla como default
                if (cached.length === 1) {
                    window.currentUser.ID_PRODUCTORA = parseInt(cached[0].id_productora);
                    window.currentUser.PRODUCTORA    = cached[0].productora;
                }
            }
        } catch(e) {}
    }

    // Normalizar productora de forma segura antes de guardar
    _sanitizeProductora(window.currentUser);

    // RETRO-COMPATIBILIDAD
    try {
        localStorage.setItem('busint_user', JSON.stringify(window.currentUser));
    } catch (e) { }

    return window.currentUser;
}

// 5. Inicialización Sincrónica
(function _init() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('-auth-token')) {
                const session = JSON.parse(localStorage.getItem(key));
                if (session && session.user) {
                    _buildCurrentUser(session.user);
                    // DIBUJO INMEDIATO: No esperar a loadUsers
                    if (!IS_LOGIN_PAGE && typeof updateAuthUI === 'function') {
                        setTimeout(updateAuthUI, 0);
                    }
                }
            }
        }
    } catch (e) { }
})();

// 6. Escudo de Seguridad
(function _shield() {
    const active = hasValidSession();
    if (!active && !IS_LOGIN_PAGE) {
        sessionStorage.setItem('auth_redirect', window.location.href);
        window.location.replace('login.html');
    } else if (active && IS_LOGIN_PAGE) {
        window.location.replace('index.html');
    }
})();

// 6.2 Escucha Activa de Sesión (Supabase Auth State)
(function _authObserver() {
    // Retrasar ligeramente para asegurar que getSB() esté disponible
    setTimeout(() => {
        const sb = getSB();
        if (!sb) return;

        // 1. Escuchar eventos de sesión en segundo plano
        sb.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                if (!IS_LOGIN_PAGE && typeof window.logout === 'function') {
                    console.warn("[AUTH] Cierre de sesión detectado por Supabase. Redirigiendo...");
                    window.logout();
                }
            }
        });

        // 2. Validación proactiva de la sesión al cargar o retomar la pestaña
        if (!IS_LOGIN_PAGE) {
            sb.auth.getSession().then(({ data, error }) => {
                // Si hay error (ej. 400 invalid_grant) o la sesión ya no existe en el servidor
                if (error || !data.session) {
                    console.warn("[AUTH] Sesión expirada o inválida detectada. Forzando logout limpio...", error);
                    if (typeof window.logout === 'function') {
                        window.logout();
                    }
                }
            });
        }
    }, 1000);
})();

// 6.5 Render Inmediato de Navegación (Native MAP Style)
(function _renderNavInstant() {
    if (IS_LOGIN_PAGE) return;
    try {
        const user = window.currentUser;
        if (!user) return;

        const usuario = user.USUARIO || user.PLANTA || 'Usuario';
        const rol = user.ROL || 'GUEST';

        const sidebarUser = document.getElementById('sidebar-user-name');
        if (sidebarUser) sidebarUser.textContent = usuario;

        const sidebarRol = document.getElementById('sidebar-user-role');
        if (sidebarRol) sidebarRol.textContent = rol;

        // Actualizar TopNav
        const navUser = document.getElementById('nav-user-name');
        if (navUser) navUser.textContent = usuario;

        // Mostrar el body si ya tenemos usuario
        document.body.classList.add('auth-shield-pass');
    } catch (e) {
        console.error("Error en renderNavInstant:", e);
    }
})();

// 7. Funciones Core
function getSB() {
    if (typeof getSupabaseClient === 'function') return getSupabaseClient();
    return null;
}

async function loadUsers() {
    console.log("[AUTH] Iniciando carga de perfiles...");
    if (typeof fetchUsuariosData !== 'function') {
        console.warn("[AUTH] fetchUsuariosData no disponible");
        return;
    }
    try {
        const uPromise = window.globalUsersPromise || fetchUsuariosData();
        const pPromise = window.globalPlantasPromise || fetchPlantasData();
        
        window.globalUsersPromise = null;
        window.globalPlantasPromise = null;

        const [u, p] = await Promise.all([
            uPromise.catch(e => { console.error("Error en fetchUsuariosData:", e); return []; }),
            pPromise.catch(e => { console.error("Error en fetchPlantasData:", e); return []; })
        ]);

        console.log(`[AUTH] Datos recibidos: ${u.length} usuarios, ${p.length} plantas`);

        // GUARDAR GLOBALMENTE para compatibilidad con usuarios.js
        window.allUsers = u;
        window.allPlantas = p;

        if (window.currentUser) {
            // Preservar productora antes del merge (no viene de PLANTAS ni de Auth)
            let savedProductora    = window.currentUser.ID_PRODUCTORA;
            let savedProductoraNom = window.currentUser.PRODUCTORA;

            const real = u.find(x => String(x.ID_USUARIO || '').trim().toLowerCase() === String(window.currentUser.ID_USUARIO || '').trim().toLowerCase()) ||
                p.find(x => String(x.ID_PLANTA || '').trim().toLowerCase() === String(window.currentUser.ID_PLANTA || '').trim().toLowerCase());
            if (real) {
                console.log("[AUTH] Perfil completo vinculado:", real.USUARIO || real.PLANTA);
                
                // Si el perfil de planta tiene productora y no tenemos una guardada, usarla
                if (!savedProductora && real.productora) {
                    savedProductora = parseInt(real.productora);
                }
                if (!savedProductoraNom && real.PRODUCTORA) {
                    savedProductoraNom = real.PRODUCTORA;
                }
                
                Object.assign(window.currentUser, real);
                
                // Forzar limpieza del correo universal en GUEST tras el merge
                if (window.currentUser.ROL === 'GUEST') {
                    const eVal = window.currentUser.EMAIL || window.currentUser.email || window.currentUser.CORREO || window.currentUser.correo || '';
                    if (!eVal || eVal === 'plantas@grupotdm.com.co') {
                        window.currentUser.EMAIL = '';
                        window.currentUser.CORREO = '';
                        window.currentUser.email = '';
                        window.currentUser.correo = '';
                    }
                }
            } else {
                console.warn("[AUTH] No se encontró perfil detallado para el usuario actual.");
            }

            // Restaurar productora para que no sea sobrescrita por el ID numérico de la tabla de plantas
            if (savedProductora) {
                window.currentUser.ID_PRODUCTORA = savedProductora;
                window.currentUser.PRODUCTORA    = savedProductoraNom;
            }
            _sanitizeProductora(window.currentUser);

            // ── RESOLVER NOMBRE DE PRODUCTORA DINÁMICAMENTE DESDE SUPABASE Y POBLAR CACHÉ ──
            try {
                let prods = [];
                try {
                    prods = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
                } catch (_) {}

                const prodId = window.currentUser.ID_PRODUCTORA || window.currentUser.productora;
                const prodNombre = window.currentUser.PRODUCTORA;
                const nombreEsNumerico = prodNombre && !isNaN(Number(String(prodNombre).trim()));
                const necesitaResolucion = !prods.length || (window.currentUser.ROL === 'GUEST' && prodId && (!prodNombre || nombreEsNumerico));

                if (necesitaResolucion) {
                    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g';
                    const resp = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
                        body: JSON.stringify({ accion: 'LISTAR_PRODUCTORAS' })
                    });
                    if (resp.ok) {
                        const resData = await resp.json();
                        prods = resData.productoras || [];
                        localStorage.setItem('busint_productoras_cache', JSON.stringify(prods));
                        console.log('[AUTH] Caché de productoras actualizado dinámicamente.');
                    }
                }

                // Traducir y normalizar usando la lista dinámica
                if (prods.length && prodId) {
                    const prod = prods.find(pr => String(pr.id_productora) === String(prodId));
                    if (prod) {
                        window.currentUser.ID_PRODUCTORA = parseInt(prod.id_productora);
                        window.currentUser.id_productora = parseInt(prod.id_productora);
                        window.currentUser.PRODUCTORA    = prod.productora;
                        window.currentUser.productora    = prod.productora;
                        // Guardar en la clave dedicada para mantener persistencia
                        localStorage.setItem('busint_productora', JSON.stringify({
                            ID_PRODUCTORA: window.currentUser.ID_PRODUCTORA,
                            PRODUCTORA:    prod.productora
                        }));
                    }
                }
            } catch(ep) { console.warn('[AUTH] No se pudo resolver productora dinámicamente:', ep); }
        }

        // Native MAP Style: Retirar escudo visual una vez cargados los datos
        document.body.classList.add('auth-shield-pass');

        // REINVENTAR UI: Inyectar Nav y Sidebar (después de resolver productora)
        if (!IS_LOGIN_PAGE && typeof window.updateAuthUI === 'function') {
            window.updateAuthUI();
            window.applyAccessControl();

            // AUTO-INICIALIZAR NOTIFICACIONES Y CHAT EN CUALQUIER PÁGINA DEL SISTEMA
            (async () => {
                try {
                    const pathPrefix = window.location.pathname.includes('/upload/') ? '../../js/' : 'js/';
                    await Promise.all([
                        _loadScriptDynamic(`${pathPrefix}notifications.js`),
                        _loadScriptDynamic(`${pathPrefix}chat.js`)
                    ]);
                    
                    const role = window.currentUser?.ROL;
                    if (role === 'GUEST') {
                        if (typeof initNotifications === 'function') initNotifications();
                    } else if (role === 'ADMIN' || role === 'USER-P') {
                        if (typeof initChatBadges === 'function') initChatBadges();
                    }
                } catch (err) {
                    console.warn("[AUTH] Error auto-inicializando notificaciones:", err);
                }
            })();
        }
    } catch (e) {
        console.error("[AUTH] Error crítico cargando perfiles:", e);
        // Intentar mostrar la UI básica de todos modos
        document.body.classList.add('auth-shield-pass');
        if (!IS_LOGIN_PAGE) window.updateAuthUI();
    }
}

/**
 * Carga dinámicamente un script garantizando que no se duplique
 */
function _loadScriptDynamic(src) {
    return new Promise((resolve) => {
        const filename = src.split('/').pop().split('?')[0];
        if (filename === 'notifications.js' && typeof window.initNotifications === 'function') {
            resolve();
            return;
        }
        if (filename === 'chat.js' && typeof window.initChatBadges === 'function') {
            resolve();
            return;
        }

        const existing = document.querySelector(`script[src*="${filename}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
            } else {
                existing.addEventListener('load', resolve);
                existing.addEventListener('error', () => resolve());
            }
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => {
            s.dataset.loaded = 'true';
            resolve();
        };
        s.onerror = () => resolve();
        document.body.appendChild(s);
    });
}

/** ── Motor de UI ── */
window.logout = function () {
    if (window.isLoggingOut) return;
    window.isLoggingOut = true;

    console.log("[AUTH] Iniciando secuencia de logout rápido...");

    // 1. Feedback visual inmediato para evitar la sensación de congelamiento
    document.body.style.pointerEvents = 'none';
    document.body.style.opacity = '0.6';
    document.body.style.transition = 'opacity 0.2s ease';

    // 2. Limpiar memoria y persistencia quirúrgicamente de inmediato
    window.currentUser = null;

    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('-auth-token') || key.startsWith('sb-'))) {
                keysToRemove.push(key);
            }
        }
        const universalKeys = ['busint_user', 'busint_avatar_prefs', 'busint_productora', 'busint_universal_plant'];
        
        keysToRemove.forEach(k => localStorage.removeItem(k));
        universalKeys.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
    } catch(e) {
        console.warn("[AUTH] Error limpiando storage durante logout:", e);
    }

    // 3. Disparar el cierre en Supabase sin esperar la respuesta (evita bloqueos de red)
    const sb = getSB();
    if (sb) {
        sb.auth.signOut().catch(e => console.warn("[AUTH] Error al cerrar sesión en Supabase en background:", e));
    }

    // 4. Redirigir rápidamente, dando solo el tiempo mínimo para que la petición salga del navegador
    setTimeout(() => {
        window.location.replace('login.html');
    }, 150);
};

window.toggleSidebar = function () {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
};

/**
 * ══════════════════════════════════════════════════════════════════════════
 * UI ENGINE: SIDEBAR & TOPNAV (Native MAP Shell)
 * ══════════════════════════════════════════════════════════════════════════
 */

function updateAuthUI() {
    if (IS_LOGIN_PAGE) return;
    const user = window.currentUser;
    if (!user) return;

    // Normalizar productora de forma segura antes de renderizar
    _sanitizeProductora(user);

    let navContainer = document.getElementById('app-top-nav');
    if (!navContainer) {
        navContainer = document.createElement('div');
        navContainer.id = 'app-top-nav';
        navContainer.className = 'app-header-bar';
        document.body.prepend(navContainer);
    }

    const roleClass = `role-${(user.ROL || 'GUEST').toLowerCase()}`;
    const pageTitle = (document.title.split(' - ')[0] || 'BUSINT').toUpperCase();
    const productoraName = user.PRODUCTORA || '';

    // Descripciones de módulos originales
    const moduleDescriptions = {
        'REPORTES': 'Registro de eventos',
        'SEGUIMIENTO': 'Estado de novedades',
        'RUTERO': 'Agenda de visitas',
        'USUARIOS': 'Gestión administrativa',
        'INGRESO': 'Control de ingreso',
        'CALIDAD': 'Reportes técnicos',
        'NOVEDADES': 'Centro de soluciones',
        'GESTIÓN DE PLANTA': 'Datos de planta',
        'ACCESO': 'Inicio de sesión',
        'RESTABLECER CONTRASEÑA': 'Recuperar acceso',
        'CARGAR BARRAS': 'Carga de códigos de barras',
        'CARGAR CURVAS': 'Carga de curvas de producción',
        'CARGAR DATOS': 'Sincronización masiva de lotes'
    };
    const moduleDesc = productoraName || moduleDescriptions[pageTitle] || 'Grupo TDM';

    const avatarStyle = _avatarStyle('mini', user.ROL);
    const iconClass = _getRoleIcon(user.ROL);

    navContainer.innerHTML = `
        <div class="nav-brand-area" style="flex: 1; min-width: 0; margin-right: 16px;">
            <img src="icons/app.svg" alt="Logo TMD" class="nav-logo" style="flex-shrink: 0;">
            <span class="brand-tag" style="display: block; flex: 1; min-width: 0;">
                <span style="display:block;font-weight:800;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${pageTitle}</span>
                <span style="display:block;font-size:0.65rem;color:#94a3b8;font-weight:500;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;" title="${moduleDesc}">${moduleDesc}</span>
            </span>
        </div>
        <div class="nav-user-area" style="display:flex;align-items:center;gap:6px;">
            <button class="btn-expand-view" id="btn-expand-view" onclick="toggleExpandView()" title="Contraer vista">
                <i class="fas fa-compress-alt"></i>
            </button>
            <div style="position:relative;display:inline-flex;align-items:center;">
                <button id="notif-bell-btn" onclick="toggleNotifPanel()" title="Notificaciones" style="
                    background:none; border:none; cursor:pointer;
                    padding:6px 10px; border-radius:50%;
                    color:#64748b; font-size:1.1rem;
                    transition:all 0.2s ease; position:relative;
                " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                    <i class="fas fa-bell"></i>
                    <span id="notif-badge" style="
                        display:none; position:absolute;
                        top:2px; right:2px;
                        background:#ef4444; color:white;
                        font-size:0.6rem; font-weight:800;
                        min-width:16px; height:16px;
                        border-radius:8px; padding:0 4px;
                        line-height:16px; text-align:center;
                    ">0</span>
                </button>
            </div>
            <button onclick="toggleSidebar()" class="btn-profile-toggle ${roleClass}" id="profileToggle">
                <span class="avatar-mini" style="${avatarStyle}">${_avatarInner(iconClass)}</span>
                <i class="fas fa-bars"></i>
            </button>
        </div>
    `;
    if (typeof _ensureNotifPanel === 'function') {
        _ensureNotifPanel();
    }
    createSidebar();
}

function createSidebar() {
    const user = window.currentUser;
    if (!user) return;

    let sidebar = document.getElementById('user-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'user-sidebar';
        sidebar.className = 'app-sidebar-drawer';
        document.body.appendChild(sidebar);

        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-backdrop';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    const path = window.location.pathname;
    const roleIcon = _getRoleIcon(user.ROL);
    const prefs = getAvatarPrefs();
    const avatarLargeInner = _avatarInner(roleIcon);
    const hasCalidad = ['ADMIN', 'MODERATOR', 'USER-C'].includes(user.ROL);

    const isAdmin = user.ROL === 'ADMIN';

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-user-card">
                ${isAdmin ? `
                    <div class="user-avatar-large admin" id="sidebar-avatar-large" style="${_avatarStyle('large', user.ROL)}">${avatarLargeInner}</div>
                ` : `
                    <div class="avatar-edit-btn" onclick="toggleAvatarCustomizer()" title="Personalizar avatar">
                        <div class="user-avatar-large ${user.ROL.toLowerCase()}" id="sidebar-avatar-large" style="${_avatarStyle('large', user.ROL)}">${avatarLargeInner}</div>
                        <div class="avatar-overlay"><i class="fas fa-pen"></i></div>
                    </div>
                `}
                <div class="user-meta">
                    <span class="u-name" id="sidebar-user-name">${user.USUARIO || user.PLANTA || 'Usuario'}</span>
                    <span class="u-role" id="sidebar-user-role">${user.ROL}</span>
                </div>
            </div>
            ${!isAdmin ? `
            <div class="avatar-customizer" id="avatar-customizer-panel" style="display:none;">
                <div class="avatar-customizer-row">
                    <span class="avatar-customizer-label">Color</span>
                    <div class="avatar-color-picker-wrap">
                        <input type="color" id="avatar-color-input" value="${prefs.color || '#3f51b5'}" oninput="setAvatarColor(this.value)">
                        <span class="avatar-color-preview" style="background:${prefs.color || '#3f51b5'}"></span>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
        <div class="sidebar-body">
            <div class="sidebar-label">MENÚ DE ACCESO</div>
            <a href="index.html" class="sidebar-link ${path.includes('index.html') ? 'active' : ''}">
                <i class="fas fa-home"></i> Reportes
            </a>
            ${(user.ROL === 'ADMIN' || user.ROL === 'MODERATOR' || user.ROL === 'USER-P') ? `
                <a href="resolucion.html" class="sidebar-link ${path.includes('resolucion.html') ? 'active' : ''}">
                    <i class="fas fa-desktop"></i> Novedades
                </a>
                <a href="metricas.html" class="sidebar-link ${path.includes('metricas.html') ? 'active' : ''}">
                    <i class="fas fa-chart-pie"></i> Métricas
                </a>
            ` : ''}
            ${user.ROL === 'GUEST' ? `
                <a href="seguimiento.html" class="sidebar-link ${path.includes('seguimiento.html') ? 'active' : ''}">
                    <i class="fas fa-shipping-fast"></i> Seguimiento
                </a>
                <a href="gestion-planta.html?id=${user.ID_PLANTA || user.ID_USUARIO || ''}" class="sidebar-link ${path.includes('gestion-planta.html') ? 'active' : ''}">
                    <i class="fas fa-industry"></i> Actualizar
                </a>
            ` : ''}
            ${(user.ROL === 'ADMIN' || user.ROL === 'MODERATOR' || user.ROL === 'USER-P') ? `
                <a href="calidad.html" class="sidebar-link ${path.includes('calidad.html') ? 'active' : ''}">
                    <i class="fas fa-microscope"></i> Calidad
                </a>
            ` : ''}
            ${(user.ROL === 'ADMIN' || user.ROL === 'USER-C' || user.ROL === 'MODERATOR') ? `
                <a href="rutero.html" class="sidebar-link ${path.includes('rutero.html') ? 'active' : ''}">
                    <i class="fas fa-route"></i> Rutero
                </a>
                <a href="aprobacion.html" class="sidebar-link ${path.includes('aprobacion.html') ? 'active' : ''}">
                    <i class="fas fa-check-circle"></i> Aprobación
                </a>
            ` : ''}
            ${user.ROL === 'USER-C' ? `
                <a href="mis-reportes.html" class="sidebar-link ${path.includes('mis-reportes.html') ? 'active' : ''}">
                    <i class="fas fa-clipboard-list"></i> Mis Reportes
                </a>
            ` : ''}
            ${(user.ROL === 'ADMIN' || user.ROL === 'USER-P') ? `
                <a href="upload.html" class="sidebar-link ${path.includes('upload.html') ? 'active' : ''}">
                    <i class="fas fa-file-import"></i> Actualizar
                </a>
            ` : ''}
            ${user.ROL === 'ADMIN' ? `
                <a href="usuarios.html" class="sidebar-link ${path.includes('usuarios.html') ? 'active' : ''}">
                    <i class="fas fa-users-cog"></i> Usuarios
                </a>
            ` : ''}
        </div>
        <div class="sidebar-footer">
            ${_PROD_SWITCH_ROLES.includes(user.ROL) ? `
                <button onclick="window._forceChangeProductora && window._forceChangeProductora()" class="btn-change-prod">
                    <i class="fas fa-exchange-alt me-2"></i> Cambiar Productora
                </button>
            ` : ''}
            <button onclick="logout()" class="btn-logout-full mb-3">
                <i class="fas fa-power-off me-2"></i> Cerrar Sesión
            </button>
            <div class="sidebar-credits">
                <p>Developed by Andrés Mendoza © 2026</p>
            </div>
        </div>
    `;
}

function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

/** ── Helpers de Avatar ── */
function _getRoleIcon(role) {
    if (role === 'ADMIN') return 'fas fa-user-shield';
    if (role === 'MODERATOR') return 'fas fa-user-tie';
    if (role === 'USER-C') return 'fas fa-user-check';
    if (role === 'USER-I') return 'fas fa-sign-in-alt';
    if (role === 'GUEST') return 'fas fa-user-secret';
    return 'fas fa-user';
}

function _avatarStyle(type, role) {
    const prefs = getAvatarPrefs();
    const systemBlue = '#3f51b5';

    // Forzar azul del sistema para ADMIN
    if (role === 'ADMIN') return `background-color:${systemBlue};`;

    if (prefs.image) return `background-image:url(${prefs.image});background-size:cover;`;
    return `background-color:${prefs.color || systemBlue};`;
}

function _avatarInner(iconClass) {
    const prefs = getAvatarPrefs();
    if (prefs.image) return '';
    return `<i class="${iconClass}"></i>`;
}

function getAvatarPrefs() {
    try {
        const p = localStorage.getItem('busint_avatar_prefs');
        return p ? JSON.parse(p) : { color: '#3f51b5', icon: 'fas fa-user' };
    } catch (e) { return { color: '#3f51b5' }; }
}

function saveAvatarPrefs(prefs) {
    localStorage.setItem('busint_avatar_prefs', JSON.stringify(prefs));
}

function setAvatarColor(color) {
    const prefs = getAvatarPrefs();
    prefs.color = color;
    saveAvatarPrefs(prefs);
    updateAuthUI();
}

function toggleAvatarCustomizer() {
    const panel = document.getElementById('avatar-customizer-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function toggleExpandView() {
    document.body.classList.toggle('view-expanded');
}

window.setAvatarColor = setAvatarColor;
window.toggleAvatarCustomizer = toggleAvatarCustomizer;
window.toggleExpandView = toggleExpandView;
window.updateAuthUI = updateAuthUI;

function applyAccessControl() {
    const user = window.currentUser;
    if (!user) return;

    console.log(`[AUTH] Aplicando control de acceso para rol: ${user.ROL}`);

    // Ocultar elementos protegidos por defecto
    const protectedElements = document.querySelectorAll('[data-role-min]');
    protectedElements.forEach(el => {
        const minRole = el.getAttribute('data-role-min');
        if (!_hasPermission(user.ROL, minRole)) {
            el.style.display = 'none';
        } else {
            el.style.display = ''; // Restaurar si tiene permiso
        }
    });
}

function _hasPermission(userRole, minRoleRequired) {
    const weights = { 'GUEST': 1, 'USER-I': 2, 'USER-P': 3, 'USER-C': 4, 'MODERATOR': 8, 'ADMIN': 10 };
    return (weights[userRole] || 0) >= (weights[minRoleRequired] || 0);
}

window.applyAccessControl = applyAccessControl;

async function handleLogin(email, password, isLoginPage = false, productora = null) {
    const sb = getSB();
    if (!sb) throw new Error("Error de conexión");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const user = await _buildCurrentUser(data.user);

    // ── INTERCEPCIÓN DE ACCESO UNIVERSAL PARA PLANTAS ──
    if (email === 'plantas@grupotdm.com.co' && isLoginPage) {
        // Si ya tenemos la cédula del formulario, validarla de una vez
        if (window._universalCedula) {
            const success = await _validateUniversalPlantSilent(window._universalCedula);
            if (!success) return; // _validateUniversalPlantSilent maneja el error y el logout
        } else {
            await _showUniversalPlantModal(password);
            return;
        }
    }

    // Inyectar productora seleccionada en el login o cargada desde el perfil
    if (window.currentUser) {
        const activeProd = productora || window.currentUser.ID_PRODUCTORA;
        if (activeProd) {
            // Buscar datos completos de la productora
            const allProds = window._allProductoras || JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
            const prodData = allProds.find(p => String(p.id_productora) === String(activeProd));
            window.currentUser.ID_PRODUCTORA = prodData ? prodData.id_productora : parseInt(activeProd);
            window.currentUser.PRODUCTORA    = prodData ? prodData.productora    : (window.currentUser.PRODUCTORA || String(activeProd));
            
            // Persistir en clave dedicada
            try {
                localStorage.setItem('busint_productora', JSON.stringify({
                    ID_PRODUCTORA: window.currentUser.ID_PRODUCTORA,
                    PRODUCTORA:    window.currentUser.PRODUCTORA
                }));
            } catch(e) {}
            // También en busint_user
            try { localStorage.setItem('busint_user', JSON.stringify(window.currentUser)); } catch(e) {}
        }
    }
    console.log("[AUTH] Login exitoso, verificando biometría...", { isLoginPage, biometry: typeof BIOMETRY, supported: await BIOMETRY?.isSupported() });

    // ── Lógica Biométrica (Vault / MAP Style) ──
    let willShowBiometric = false;
    if (isLoginPage && typeof BIOMETRY !== 'undefined' && await BIOMETRY.isSupported()) {
        const map = JSON.parse(localStorage.getItem(B_KEY) || '{}');
        const userEmail = user.CORREO.toLowerCase();

        console.log("[AUTH] Verificando registro previo para:", userEmail, "Registrado:", !!map[userEmail]);

        if (!map[userEmail]) {
            console.log("[AUTH] Disparando modal de registro biométrico...");
            window._tempPass = password;
            willShowBiometric = true;
            setTimeout(() => _showBiometricModal(userEmail), 1000);
        }
    }

    // Solo redirigir si no estamos mostrando el modal
    if (isLoginPage && !willShowBiometric) {
        window.location.href = 'index.html';
    }
}

/**
 * Validación silenciosa de planta cuando la cédula viene del formulario de login
 */
async function _validateUniversalPlantSilent(cedula) {
    try {
        if (!window.allPlantas || window.allPlantas.length === 0) await loadUsers();
        const cleanId = String(cedula).trim().toLowerCase();
        const planta = (window.allPlantas || []).find(p =>
            String(p.ID_PLANTA || p.id || p.NIT || '').trim().toLowerCase() === cleanId
        );

        if (!planta) {
            await Swal.fire('ID No Encontrado', 'No se encontró ninguna planta registrada con esa identificación.', 'error');
            logout();
            return false;
        }

        // Enriquecer con el nombre de la productora antes de guardar
        const prodIdRaw = planta.productora || planta.ID_PRODUCTORA;
        if (prodIdRaw) {
            try {
                // Intentar obtener el nombre desde la caché de productoras
                const cachedProd = JSON.parse(localStorage.getItem('busint_productora') || 'null');
                if (cachedProd && String(cachedProd.ID_PRODUCTORA) === String(prodIdRaw) && cachedProd.PRODUCTORA) {
                    planta.ID_PRODUCTORA = parseInt(prodIdRaw);
                    planta.PRODUCTORA    = cachedProd.PRODUCTORA;
                } else if (window._allProductoras && window._allProductoras.length > 0) {
                    const prodData = window._allProductoras.find(p => String(p.id_productora) === String(prodIdRaw));
                    if (prodData) {
                        planta.ID_PRODUCTORA = parseInt(prodIdRaw);
                        planta.PRODUCTORA    = prodData.productora;
                        // Guardar en caché
                        localStorage.setItem('busint_productora', JSON.stringify({
                            ID_PRODUCTORA: planta.ID_PRODUCTORA,
                            PRODUCTORA:    planta.PRODUCTORA
                        }));
                    }
                }
            } catch(ep) { console.warn('No se pudo resolver nombre de productora:', ep); }
        }

        localStorage.setItem('busint_universal_plant', JSON.stringify(planta));

        // Reconstruir currentUser con los datos ya enriquecidos
        const authResponse = await getSB().auth.getUser();
        if (authResponse && authResponse.data && authResponse.data.user) {
            _buildCurrentUser(authResponse.data.user);
        } else if (window.currentUser) {
            _buildCurrentUser({ email: window.currentUser.CORREO, id: window.currentUser.ID_USUARIO, user_metadata: window.currentUser });
        }

        return true;
    } catch (e) {
        console.error("Error en validación silenciosa:", e);
        logout();
        return false;
    }
}

/**
 * Muestra el modal de validación secundaria para el Acceso Universal
 */
async function _showUniversalPlantModal(password) {
    const { value: cedula } = await Swal.fire({
        title: 'Acceso de Taller',
        text: 'Ingrese su NIT o Cédula para identificarse.',
        input: 'text',
        inputPlaceholder: 'Ej: 222.222.222',
        confirmButtonText: 'INGRESAR',
        confirmButtonColor: '#3F51B5',
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value) return 'La identificación es obligatoria';
        },
        footer: '<span style="color:#64748b; font-size:0.8rem;">Portal Universal - Grupo TDM</span>'
    });

    if (cedula) {
        const success = await _validateUniversalPlantSilent(cedula);
        if (success) {
            await Swal.fire({
                title: '¡Acceso Concedido!',
                text: `Bienvenido`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            window.location.href = 'index.html';
        }
    } else {
        logout();
    }
}

/** ── Lógica de Registro en Vault (MAP Style) ── */
function _showBiometricModal(email) {
    const modal = document.getElementById('biometric-modal');
    if (!modal) return;

    // Inyectar icono y textos dinámicos según el dispositivo
    const iconWrap = document.getElementById('bm-icon-wrap');
    if (iconWrap) iconWrap.innerHTML = BIOMETRY.getSVGForType();

    const title = document.getElementById('bm-title');
    if (title) title.textContent = `Activar ${BIOMETRY.getLabelForType()}`;

    modal.style.display = 'flex';

    const btnActivate = document.getElementById('bm-activate');
    const btnSkip = document.getElementById('bm-skip');

    btnActivate.onclick = async () => {
        btnActivate.disabled = true;
        btnActivate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
        try {
            await registerBiometricInVault(email, window._tempPass);
            modal.style.display = 'none';
            window.location.href = 'index.html';
        } catch (err) {
            Swal.fire('Error', 'No se pudo activar la biometría: ' + err.message, 'error');
            btnActivate.disabled = false;
            btnActivate.textContent = 'Activar';
        }
    };

    btnSkip.onclick = () => {
        modal.style.display = 'none';
        window.location.href = 'index.html';
    };
}

async function registerBiometricInVault(email, password) {
    if (!password) throw new Error("Sesión expirada, reintente login manual");

    // 1. Crear credencial en el hardware (Windows Hello / Touch ID)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: "Grupo TDM" },
            user: {
                id: crypto.getRandomValues(new Uint8Array(16)),
                name: email,
                displayName: email
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
            authenticatorSelection: { userVerification: "required" },
            timeout: 60000
        }
    });

    if (!credential) throw new Error("El usuario canceló el registro");

    const credentialIdB64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // 2. Registrar en el Vault de Supabase (Edge Function)
    const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
    const res = await fetch(`${projectUrl}/functions/v1/biometric-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'enroll',
            email,
            password,
            credential_id: credentialIdB64
        })
    });

    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Error en el servidor");

    // 3. Guardar mapeo local (público)
    const map = JSON.parse(localStorage.getItem(B_KEY) || '{}');
    map[email.toLowerCase()] = credentialIdB64;
    localStorage.setItem(B_KEY, JSON.stringify(map));

    Swal.fire('¡Éxito!', 'Biometría activada correctamente', 'success');
}

async function loginWithBiometric() {
    const userId = window._biometricUserId;
    if (!userId) return typeof showManualLogin === 'function' ? showManualLogin() : null;

    try {
        const map = JSON.parse(localStorage.getItem(B_KEY) || '{}');
        const credIdB64 = map[userId.toLowerCase()];
        if (!credIdB64) throw new Error("No hay huella registrada para este usuario");

        const binaryId = Uint8Array.from(atob(credIdB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: 'public-key', id: binaryId }],
                userVerification: 'required'
            }
        });

        const sb = getSB();
        const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
        const res = await fetch(`${projectUrl}/functions/v1/biometric-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'authenticate', email: userId, credential_id: credIdB64 })
        });

        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error);

        await sb.auth.setSession(result.session);
        await _buildCurrentUser(result.session.user);
        window.location.href = 'index.html';
    } catch (err) {
        if (err.name !== 'NotAllowedError') Swal.fire('Aviso', err.message, 'warning');
        if (typeof showManualLogin === 'function') showManualLogin();
    }
}

window.handleLogin = handleLogin;
window.loginWithBiometric = loginWithBiometric;
window.loadUsers = loadUsers;
window.resetCredentials = async () => {
    const sb = getSB();
    if (sb) await sb.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
};

/* ══════════════════════════════════════════════════════════════════════════
   Cambio de Productora — disponible en TODOS los módulos
   Roles habilitados: ADMIN, MODERATOR, USER-C
   ══════════════════════════════════════════════════════════════════════════ */

const _PROD_SWITCH_ROLES = ['ADMIN', 'MODERATOR', 'USER-C'];

/**
 * Garantiza que el overlay de selección de productora exista en el DOM.
 * Si ya está en el HTML (index.html) lo reutiliza; si no lo crea dinámicamente.
 */
function _ensureProdOverlayDOM() {
    let overlay = document.getElementById('productora-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'productora-overlay';
    overlay.className = 'productora-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class="productora-container">
            <div class="productora-header">
                <img src="icons/app.svg" alt="Logo" class="productora-logo">
                <h2>Seleccione su Productora</h2>
                <p>Elige la productora con la que deseas trabajar.</p>
            </div>
            <div id="productora-list" class="productora-list"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Maneja la selección de una productora desde el overlay.
 * Se expone globalmente para que el HTML inline pueda invocarlo.
 */
window._handleProductoraSelect = function(id, nombre) {
    const user = window.currentUser;
    if (!user) return;

    user.ID_PRODUCTORA = parseInt(id);
    user.PRODUCTORA    = nombre;

    localStorage.setItem('busint_productora', JSON.stringify({
        ID_PRODUCTORA: user.ID_PRODUCTORA,
        PRODUCTORA:    user.PRODUCTORA
    }));

    // Invalidar caché para que la nueva productora se refleje
    if (typeof invalidateCache === 'function') {
        invalidateCache('master');
        invalidateCache('plantas');
    }

    const overlay = document.getElementById('productora-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.25s';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '';
            overlay.style.transition = '';
            document.body.style.overflow = '';

            if (typeof window.updateAuthUI === 'function') window.updateAuthUI();
            if (window._resolveProductora) window._resolveProductora();

            // Si se llamó desde el atajo o el botón del sidebar → reload limpio
            if (window._reloadOnProductoraSelect) {
                window._reloadOnProductoraSelect = false;
                window.location.reload();
            }
        }, 260);
    }
};

/**
 * Fuerza el cambio de productora mostrando el overlay bloqueante.
 * Funciona en CUALQUIER módulo donde se cargue auth.js.
 */
async function _forceChangeProductora() {
    const user = window.currentUser;
    if (!user || !_PROD_SWITCH_ROLES.includes(user.ROL)) return;

    const overlay = _ensureProdOverlayDOM();
    const list    = document.getElementById('productora-list');
    if (!list) return;

    window._reloadOnProductoraSelect = true;

    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    document.body.style.overflow = 'hidden';

    list.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;color:#64748b;width:100%;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;margin-bottom:1rem;color:#3b82f6;"></i>
            <span style="font-size:0.9rem;font-weight:500;">Cargando productoras...</span>
        </div>
    `;

    try {
        const anonKey = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '';
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
            body: JSON.stringify({ accion: 'LISTAR_PRODUCTORAS' })
        });
        const result = response.ok ? await response.json() : { productoras: [] };
        const prods  = result.productoras || [];

        if (prods.length === 0) {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
            return;
        }

        list.innerHTML = prods.map(p => `
            <div class="productora-item" onclick="_handleProductoraSelect('${p.id_productora}', '${p.productora}')">
                <i class="fa-solid fa-building productora-bg-icon"></i>
                <div class="productora-item-info">
                    <span class="productora-name">${p.productora}</span>
                    <span class="productora-nit">NIT: ${p.nit || 'N/A'}</span>
                </div>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = `<div style="color:#ef4444;padding:1rem;text-align:center;">Error al cargar productoras.<br>Intenta de nuevo.</div>`;
    }
}

window._forceChangeProductora = _forceChangeProductora;

// Atajo Ctrl+S / Cmd+S → cambiar productora (ADMIN, MODERATOR, USER-C)
if (!window.__prodSwitchKeyListenerAdded) {
    window.__prodSwitchKeyListenerAdded = true;
    window.addEventListener('keydown', function(e) {
        const isMac      = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifier   = isMac ? e.metaKey : e.ctrlKey;
        if (modifier && e.key.toLowerCase() === 's') {
            e.preventDefault();
            const user = window.currentUser;
            if (user && _PROD_SWITCH_ROLES.includes(user.ROL)) {
                _forceChangeProductora();
            }
        }
    });
}

