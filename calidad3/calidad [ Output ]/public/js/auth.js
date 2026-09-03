/**
 * auth.js — Sistema de Autenticación Modular · RRHH Mobile
 * ──────────────────────────────────────────────────────────
 * Responsabilidades:
 *   1. Escudo de seguridad (auth guard) — sin sesión → login.html
 *   2. Construcción de window.currentUser desde el token de Supabase
 *   3. Motor de UI: TopNav + Sidebar (se inyectan en cualquier página)
 *   4. Logout limpio
 *   5. Compatibilidad con scripts legados que lean localStorage 'busint_user'
 *
 * Dependencias (deben cargarse ANTES que este archivo):
 *   - @supabase/supabase-js (CDN)
 *   - js/config.js  →  SUPABASE_URL, SUPABASE_KEY, CONFIG
 */

'use strict';

/* ── Constantes de ruta ──────────────────────────────────── */
const IS_LOGIN_PAGE = (function() {
    const path = window.location.pathname.toLowerCase();
    const href = window.location.href.toLowerCase();
    return path.includes('login.html') || href.includes('login.html');
})();

/* ── Usuario en memoria (fuente de verdad) ───────────────── */
window.currentUser = null;

/* ================================================================
   1. CLIENTE SUPABASE
   ================================================================ */

/** Devuelve (o crea) el cliente Supabase singleton */
function getSupabaseClient() {
    if (window._sbClient) return window._sbClient;
    if (typeof window.supabase === 'undefined') {
        console.warn('[AUTH] SDK de Supabase no cargado todavía.');
        return null;
    }
    window._sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
    return window._sbClient;
}

/* Alias corto usado internamente */
function getSB() { return getSupabaseClient(); }

/* ================================================================
   2. INTERCEPCIÓN DE COMPATIBILIDAD CON SCRIPTS LEGADOS
      Permite que código antiguo que lea localStorage('busint_user')
      reciba el usuario en memoria sin que nosotros lo persitamos.
   ================================================================ */
(function _compatLayer() {
    const _orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
        if (key === 'busint_user') {
            return window.currentUser
                ? JSON.stringify(window.currentUser)
                : _orig.call(this, key);
        }
        return _orig.call(this, key);
    };
})();

/* ================================================================
   3. DETECCIÓN DE SESIÓN ACTIVA
   ================================================================ */
function hasValidSession() {
    for (let i = 0; i < localStorage.length; i++) {
        try {
            const key = localStorage.key(i);
            if (!key || !key.includes('-auth-token')) continue;
            const raw = localStorage.getItem(key);
            if (!raw || raw === 'null') continue;
            const session = JSON.parse(raw);
            if (session && session.access_token) return true;
        } catch (_) { /* clave corrupta, ignorar */ }
    }
    return false;
}

/* ================================================================
   4. CONSTRUCCIÓN DE window.currentUser
   ================================================================ */
function _buildCurrentUser(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};

    window.currentUser = {
        ID_USUARIO:   meta.id_usuario   || user.id,
        ID_PLANTA:    meta.id_planta    || meta.id_usuario || user.id,
        USUARIO:      meta.full_name    || meta.usuario   || user.email,
        PLANTA:       meta.planta       || meta.full_name || '',
        CORREO:       user.email,
        EMAIL:        user.email,
        ROL:          meta.role         || meta.ROL       || 'GUEST',
        TELEFONO:     meta.telefono     || meta.phone     || user.phone || '',
        DIRECCION:    meta.direccion    || '',
        PAIS:         meta.pais         || 'Colombia',
        DEPARTAMENTO: meta.departamento || '',
        CIUDAD:       meta.ciudad       || '',
        BARRIO:       meta.barrio       || '',
        COMUNA:       meta.comuna       || '',
        CONTACTO:     meta.contacto     || '',
        PRODUCTORA:   meta.productora   || null,
        ID_PRODUCTORA:meta.id_productora|| null,
    };

    /* ── Normalizar productora ── */
    _sanitizeProductora(window.currentUser);

    /* Retrocompatibilidad: guardar en localStorage para scripts legados */
    try { localStorage.setItem('busint_user', JSON.stringify(window.currentUser)); } catch (_) {}

    return window.currentUser;
}

function _sanitizeProductora(user) {
    if (!user) return;
    let prods = [];
    try { prods = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]'); } catch (_) {}

    let rawId = user.ID_PRODUCTORA || user.id_productora || user.productora;
    if (!rawId) {
        const nameRaw = user.PRODUCTORA || user.productora;
        if (nameRaw && !isNaN(Number(String(nameRaw).trim())) && String(nameRaw).trim() !== '0') {
            rawId = nameRaw;
        }
    }

    const cleanId = String(rawId || '').trim();
    if (!cleanId) return;

    const mapped = prods.find(p => String(p.id_productora || p.ID_PRODUCTORA || '').trim() === cleanId);
    if (mapped) {
        user.ID_PRODUCTORA = parseInt(cleanId);
        user.id_productora = parseInt(cleanId);
        user.PRODUCTORA    = mapped.productora || mapped.PRODUCTORA || user.PRODUCTORA;
        user.productora    = user.PRODUCTORA;
    } else if (!isNaN(Number(cleanId))) {
        user.ID_PRODUCTORA = parseInt(cleanId);
        user.id_productora = parseInt(cleanId);
    }
}

/* ================================================================
   5. INICIALIZACIÓN SINCRÓNICA
      Lee el token del localStorage al arrancar para hidratar
      window.currentUser antes de que se pinte nada en pantalla.
   ================================================================ */
(function _initSync() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.includes('-auth-token')) continue;
            const raw = localStorage.getItem(key);
            if (!raw || raw === 'null') continue;
            const session = JSON.parse(raw);
            if (session && session.user) {
                _buildCurrentUser(session.user);
                break;
            }
        }
    } catch (e) { console.warn('[AUTH] Error en init sincrónico:', e); }
})();

/* ================================================================
   6. AUTH GUARD  ← el escudo de seguridad
      Sin sesión activa → redirige a login.html
      En login.html con sesión activa → redirige a index.html
   ================================================================ */
(function _authGuard() {
    /* Protección anti-loop: si ya se está redirigiendo, no volver a hacerlo */
    if (window._authGuardRan) return;
    window._authGuardRan = true;

    const redirecting = sessionStorage.getItem('_auth_redirecting') === 'true';
    if (redirecting) {
        sessionStorage.removeItem('_auth_redirecting');
        return;
    }

    const active = hasValidSession();

    if (!active && !IS_LOGIN_PAGE) {
        console.log('[AUTH] Sin sesión — redirigiendo a login.html');
        sessionStorage.setItem('auth_redirect', window.location.href);
        sessionStorage.setItem('_auth_redirecting', 'true');
        window.location.replace('login.html');
        return;
    }

    if (active && IS_LOGIN_PAGE) {
        console.log('[AUTH] Sesión activa en login — redirigiendo a index.html');
        sessionStorage.setItem('_auth_redirecting', 'true');
        window.location.replace('index.html');
        return;
    }

    /* Render inmediato si ya tenemos usuario */
    if (!IS_LOGIN_PAGE && window.currentUser) {
        document.body.classList.add('auth-shield-pass');
        /* Quitar el estilo de ocultamiento del <head> */
        const hideStyle = document.getElementById('auth-hide');
        if (hideStyle) hideStyle.textContent = '';
        document.body.style.visibility = '';
    }

    /* Timeout de seguridad: si loadUsers tarda mucho, mostrar igualmente */
    if (!IS_LOGIN_PAGE) {
        setTimeout(() => {
            const hs = document.getElementById('auth-hide');
            if (hs) hs.textContent = '';
            document.body.style.visibility = '';
        }, 4000);
    }
})();

/* ================================================================
   7. OBSERVADOR DE ESTADO DE SESIÓN (Supabase onAuthStateChange)
   ================================================================ */
(function _authObserver() {
    setTimeout(() => {
        const sb = getSB();
        if (!sb) return;

        sb.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                _buildCurrentUser(session.user);
                if (!IS_LOGIN_PAGE && typeof window.updateAuthUI === 'function') {
                    window.updateAuthUI();
                }
            } else if (event === 'SIGNED_OUT') {
                if (!IS_LOGIN_PAGE && typeof window.logout === 'function') {
                    window.logout();
                }
            } else if (event === 'TOKEN_REFRESHED' && session) {
                _buildCurrentUser(session.user);
            }
        });
    }, 500);
})();

/* ================================================================
   8. CARGA DE PERFILES (enriquece currentUser con datos de tablas)
      IMPORTANTE: Esta función NO bloquea el render de la página.
      Se ejecuta en background y actualiza window.allUsers/allPlantas
      cuando los datos estén listos.
   ================================================================ */
async function loadUsers() {
    /* Desbloquear UI inmediatamente — no esperar a que terminen las llamadas */
    document.body.classList.add('auth-shield-pass');
    const hs = document.getElementById('auth-hide');
    if (hs) hs.textContent = '';
    document.body.style.visibility = '';
    console.log('[AUTH] UI desbloqueada — cargando datos en background...');

    if (typeof fetchUsuariosData !== 'function') {
        console.warn('[AUTH] fetchUsuariosData no disponible');
        return;
    }
    
    try {
        const [u, p] = await Promise.all([
            (window.globalUsersPromise  || fetchUsuariosData()).catch(e  => { console.error('[AUTH] fetchUsuariosData:', e);  return []; }),
            (window.globalPlantasPromise|| fetchPlantasData()).catch(e   => { console.error('[AUTH] fetchPlantasData:',  e);  return []; }),
        ]);
        window.globalUsersPromise  = null;
        window.globalPlantasPromise = null;
        window.allUsers   = u;
        window.allPlantas = p;
        console.log(`[AUTH] Datos cargados: ${u.length} usuarios, ${p.length} plantas`);

        if (window.currentUser) {
            const savedProdId  = window.currentUser.ID_PRODUCTORA;
            const savedProdNom = window.currentUser.PRODUCTORA;

            const real =
                u.find(x => String(x.ID_USUARIO || '').trim().toLowerCase() === String(window.currentUser.ID_USUARIO || '').trim().toLowerCase()) ||
                p.find(x => String(x.ID_PLANTA  || '').trim().toLowerCase() === String(window.currentUser.ID_PLANTA  || '').trim().toLowerCase());

            if (real) {
                Object.assign(window.currentUser, real);
            } else {
                console.warn('[AUTH] Perfil detallado no encontrado para el usuario.');
            }

            /* Restaurar productora (no debe ser pisada por merge) */
            if (savedProdId) {
                window.currentUser.ID_PRODUCTORA = savedProdId;
                window.currentUser.PRODUCTORA    = savedProdNom;
            }
            _sanitizeProductora(window.currentUser);
        }

        if (!IS_LOGIN_PAGE && typeof window.updateAuthUI === 'function') {
            window.updateAuthUI();
            if (typeof window.applyAccessControl === 'function') window.applyAccessControl();
        }
    } catch (e) {
        console.error('[AUTH] Error crítico en loadUsers:', e);
        document.body.classList.add('auth-shield-pass');
        const hs2 = document.getElementById('auth-hide');
        if (hs2) hs2.textContent = '';
        document.body.style.visibility = '';
        if (!IS_LOGIN_PAGE && typeof window.updateAuthUI === 'function') window.updateAuthUI();
    }
}

/* ================================================================
   9. LOGOUT
   ================================================================ */
window.logout = function () {
    if (window._isLoggingOut) return;
    window._isLoggingOut = true;

    /* Feedback visual inmediato */
    document.body.style.pointerEvents = 'none';
    document.body.style.opacity = '0.6';
    document.body.style.transition = 'opacity .2s ease';

    /* Limpiar memoria */
    window.currentUser = null;

    /* Limpiar storage quirúrgicamente */
    try {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.includes('-auth-token') || k.startsWith('sb-'))) toRemove.push(k);
        }
        [...toRemove, 'busint_user', 'busint_avatar_prefs', 'busint_productora', 'busint_universal_plant']
            .forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
        sessionStorage.clear();
    } catch (_) {}

    /* Cierre en Supabase en background (no bloquear la UI) */
    const sb = getSB();
    if (sb) sb.auth.signOut().catch(() => {});

    /* Redirigir */
    setTimeout(() => window.location.replace('login.html'), 150);
};

/* ================================================================
   10. UI ENGINE — TopNav + Sidebar
   ================================================================ */

/* Render inmediato del nombre en nav antes de loadUsers */
(function _renderNavInstant() {
    if (IS_LOGIN_PAGE) return;
    const user = window.currentUser;
    if (!user) return;
    const el = document.getElementById('sidebar-user-name');
    if (el) el.textContent = user.USUARIO || user.PLANTA || 'Usuario';
    const rol = document.getElementById('sidebar-user-role');
    if (rol) rol.textContent = user.ROL || 'GUEST';
    document.body.classList.add('auth-shield-pass');
})();

/* ── Helpers de avatar ────────────────────────────────────── */
function _avatarInitials(user) {
    const name = user.USUARIO || user.PLANTA || '';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || 'US';
}

function _avatarGradient(rol) {
    const g = {
        'ADMIN':     'linear-gradient(135deg,#6366f1,#8b5cf6)',
        'MODERATOR': 'linear-gradient(135deg,#3b82f6,#06b6d4)',
        'USER-P':    'linear-gradient(135deg,#10b981,#059669)',
        'GUEST':     'linear-gradient(135deg,#f59e0b,#d97706)',
    };
    return g[rol] || 'linear-gradient(135deg,#64748b,#475569)';
}

function _avatarMini(user) {
    const initials = _avatarInitials(user);
    const grad     = _avatarGradient(user.ROL);
    return `<span style="width:32px;height:32px;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#fff;letter-spacing:0;">${initials}</span>`;
}

function _avatarLarge(user) {
    const initials = _avatarInitials(user);
    const grad     = _avatarGradient(user.ROL);
    return `<span style="width:56px;height:56px;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:700;color:#fff;">${initials}</span>`;
}

/* SVG helpers reutilizables */
function _svg(path, extra) {
    return `<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;${extra||''}">${path}</svg>`;
}

/* ── TopNav ───────────────────────────────────────────────── */
function updateAuthUI() {
    if (IS_LOGIN_PAGE) return;
    const user = window.currentUser;
    if (!user) return;

    _sanitizeProductora(user);

    /* Eliminar app-top-nav si existe (no lo usamos) */
    const old = document.getElementById('app-top-nav');
    if (old) old.remove();

    createSidebar();
}

/* ── Sidebar ──────────────────────────────────────────────── */
function createSidebar() {
    const user = window.currentUser;
    if (!user) return;

    let sidebar = document.getElementById('user-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id        = 'user-sidebar';
        sidebar.className = 'app-sidebar-drawer';
        document.body.appendChild(sidebar);

        const overlay     = document.createElement('div');
        overlay.id        = 'sidebar-overlay';
        overlay.className = 'sidebar-backdrop';
        overlay.onclick   = toggleSidebar;
        document.body.appendChild(overlay);
    }

    const isAdmin = user.ROL === 'ADMIN';
    const isMod   = user.ROL === 'MODERATOR';

    /* Ítems de navegación con SVG inline */
    const navItem = (svg, label, action) =>
        `<button class="sidebar-nav-item" onclick="${action}" style="display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;padding:10px 20px;cursor:pointer;font-size:.875rem;color:#374151;text-align:left;border-radius:0;transition:background .15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='none'">
            ${_svg(svg,'flex-shrink:0;color:#64748b;')}
            <span>${label}</span>
         </button>`;

    const dangerItem = (svg, label, action) =>
        `<button class="sidebar-nav-item" onclick="${action}" style="display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;padding:10px 20px;cursor:pointer;font-size:.875rem;color:#dc2626;text-align:left;border-radius:0;transition:background .15s;" onmouseover="this.style.background='#fff1f2'" onmouseout="this.style.background='none'">
            ${_svg(svg,'flex-shrink:0;color:#dc2626;')}
            <span>${label}</span>
         </button>`;

    const sectionLabel = (text) =>
        `<div style="padding:12px 20px 4px;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;">${text}</div>`;

    sidebar.innerHTML = `
        <!-- Header usuario -->
        <div style="padding:20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;">
            ${_avatarLarge(user)}
            <div style="min-width:0;flex:1;">
                <div id="sidebar-user-name" style="font-size:.875rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.USUARIO || user.PLANTA || 'Usuario'}</div>
                <div id="sidebar-user-role" style="font-size:.7rem;color:#64748b;margin-top:2px;">${user.ROL || 'GUEST'}</div>
                ${user.PRODUCTORA ? `<div style="font-size:.68rem;color:#94a3b8;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.PRODUCTORA}</div>` : ''}
            </div>
            <button onclick="toggleSidebar()" style="background:none;border:none;cursor:pointer;padding:4px;color:#94a3b8;flex-shrink:0;" aria-label="Cerrar">
                ${_svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}
            </button>
        </div>

        <!-- Navegación -->
        <nav style="padding:8px 0;flex:1;overflow-y:auto;">
            ${sectionLabel('Principal')}
            ${navItem('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
                'Inicio', "if(window.AppRouter)AppRouter.navigate('inicio');toggleSidebar();")}
            ${navItem('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
                'Mi Perfil', "if(window.AppRouter)AppRouter.navigate('perfil');toggleSidebar();")}
            ${navItem('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
                'Apps', "if(window.AppRouter)AppRouter.navigate('apps');toggleSidebar();")}

            ${(isAdmin || isMod) ? `
            ${sectionLabel('Administración')}
            ${navItem('<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
                'Estadísticas', "if(window.AppRouter)AppRouter.navigate('estadisticas');toggleSidebar();")}
            ` : ''}

            ${sectionLabel('Cuenta')}
            ${dangerItem('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
                'Cerrar sesión', 'window.logout()')}
        </nav>

        <!-- Footer -->
        <div style="padding:12px 20px;border-top:1px solid #f1f5f9;font-size:.65rem;color:#cbd5e1;text-align:center;">
            RRHH Mobile · Grupo TDM
        </div>`;
}

/* ── Toggles ──────────────────────────────────────────────── */
window.toggleSidebar = function () {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
};

window.applyAccessControl = function () { /* por ROL según necesidad */ };

/* Exponer para uso externo */
window.updateAuthUI      = updateAuthUI;
window.getSupabaseClient = getSupabaseClient;
window.loadUsers         = loadUsers;

