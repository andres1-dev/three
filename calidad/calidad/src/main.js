/**
 * ============================================================
 * MAIN.JS — Composition Root (Raíz de Composición)
 * Aquí se crean todos los adaptadores, casos de uso y el router,
 * y se inyectan las dependencias hacia la presentación.
 * NINGÚN módulo de presentación importa directamente de infrastructure/.
 * ============================================================
 */

// ── Infraestructura ──────────────────────────────────────────
import { SupabaseAuthAdapter }      from './infrastructure/supabase/SupabaseAuthAdapter.js';
import { SupabaseDataRepository }   from './infrastructure/supabase/SupabaseDataRepository.js';
import { SupabaseStorageAdapter }   from './infrastructure/supabase/SupabaseStorageAdapter.js';
import { BrowserCacheAdapter }      from './infrastructure/cache/BrowserCacheAdapter.js';
import { ENV }                      from './infrastructure/config/env.js';


// ── Casos de Uso ─────────────────────────────────────────────
import { LoginUseCase }             from './core/usecases/auth/LoginUseCase.js';
import { LogoutUseCase }            from './core/usecases/auth/LogoutUseCase.js';
import { GetCurrentUserUseCase }    from './core/usecases/auth/GetCurrentUserUseCase.js';
import { GetDirectoryUseCase }      from './core/usecases/personas/GetDirectoryUseCase.js';
import { GetProfileUseCase, UpdateProfileUseCase } from './core/usecases/perfil/GetProfileUseCase.js';
import { GetLotesUseCase }          from './core/usecases/formularios/GetLotesUseCase.js';
import { SubmitNovedadUseCase }     from './core/usecases/formularios/SubmitNovedadUseCase.js';
import { SubmitCalidadUseCase }     from './core/usecases/formularios/SubmitCalidadUseCase.js';
import { SubmitRuteroUseCase }      from './core/usecases/formularios/SubmitRuteroUseCase.js';

// ── Router y Estado ──────────────────────────────────────────
import { Router }   from './presentation/router/Router.js';
import { Store }    from './presentation/state/Store.js';
import { Toast }    from './presentation/components/Toast.js';

// ── Módulos de Presentación ──────────────────────────────────
import { AppsModule }        from './presentation/modules/apps/AppsModule.js';
import { InicioModule }      from './presentation/modules/inicio/InicioModule.js';
import { PersonasModule }    from './presentation/modules/personas/PersonasModule.js';
import { PerfilModule }      from './presentation/modules/perfil/PerfilModule.js';
import { FormulariosModule } from './presentation/modules/formularios/FormulariosModule.js';

async function bootstrap() {
    // ── 1. GUARD ULTRARRÁPIDO (antes del router) ─────────────
    let hasToken = false;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.includes('-auth-token')) continue;
            const s = JSON.parse(localStorage.getItem(k) || 'null');
            if (s && s.access_token) { hasToken = true; break; }
        }
    } catch (_) {}

    if (!hasToken) {
        window.location.replace('login.html');
        return;
    }

    // ── 2. INSTANCIAR ADAPTADORES DE INFRAESTRUCTURA ─────────
    const cache         = new BrowserCacheAdapter('CALIDAD2_');
    const authService   = new SupabaseAuthAdapter();
    const dataService   = new SupabaseDataRepository();
    const storageService = new SupabaseStorageAdapter('archivos');

    // ── 3. INSTANCIAR CASOS DE USO ───────────────────────────
    const loginUseCase          = new LoginUseCase(authService);
    const logoutUseCase         = new LogoutUseCase(authService, cache);
    const getCurrentUserUseCase = new GetCurrentUserUseCase(authService, dataService);
    const getDirectoryUseCase   = new GetDirectoryUseCase(dataService, cache);
    const getProfileUseCase     = new GetProfileUseCase(dataService, authService);
    const updateProfileUseCase  = new UpdateProfileUseCase(dataService, storageService);
    const getLotesUseCase       = new GetLotesUseCase(dataService, cache);
    const submitNovedadUseCase  = new SubmitNovedadUseCase(dataService);
    const submitCalidadUseCase  = new SubmitCalidadUseCase(dataService);
    const submitRuteroUseCase   = new SubmitRuteroUseCase(dataService);

    // ── 4. CARGAR USUARIO ACTUAL EN EL STORE ─────────────────
    try {
        const user = await getCurrentUserUseCase.execute();
        Store.setState({ currentUser: user });
        if (user) {
            console.log(`[Calidad] Sesión activa: ${user.displayName} (${user.rol})`);
        }
    } catch (err) {
        console.error('[Main] Error al obtener usuario:', err);
    }

    // ── 5. CONSTRUIR Y REGISTRAR EL ROUTER ───────────────────
    const viewport = document.getElementById('module-viewport') || document.getElementById('app-viewport');
    if (!viewport) {
        console.error('[Main] No se encontró #module-viewport ni #app-viewport en el DOM.');
        return;
    }

    const router = new Router(viewport, { authService });

    // Fábricas de módulos (inyección de dependencias via constructor)
    router.register('apps', class extends AppsModule {
        constructor({ router, params }) {
            super({ router });
        }
    });

    router.register('inicio', class {
        constructor({ router, params }) {
            this._mod = new InicioModule({ router });
        }
        async mount(vp) { await this._mod.mount(vp); }
        unmount() { this._mod.unmount(); }
    });

    router.register('personas', class {
        constructor({ router, params }) {
            this._mod = new PersonasModule({ router, getDirectoryUseCase, dataService });
        }
        async mount(vp) { await this._mod.mount(vp); }
        unmount() { this._mod.unmount(); }
    });

    router.register('perfil', class {
        constructor({ router, params }) {
            this._mod = new PerfilModule({
                router,
                getProfileUseCase,
                updateProfileUseCase,
                logoutUseCase
            });
        }
        async mount(vp) { await this._mod.mount(vp); }
        unmount() { this._mod.unmount(); }
    });

    router.register('formularios', class {
        constructor({ router, params }) {
            this._mod = new FormulariosModule({
                router,
                getLotesUseCase,
                submitNovedadUseCase,
                submitCalidadUseCase,
                submitRuteroUseCase,
                dataService
            });
        }
        async mount(vp) { await this._mod.mount(vp); }
        unmount() { this._mod.unmount(); }
    });

    router.register('chats', class {
        async mount(vp) {
            vp.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Chats</h1>
                    <button class="icon-btn" aria-label="Nuevo chat">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#64748b" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
                <div class="empty-state" style="padding: 60px 24px; text-align: center; color: var(--color-text-muted);">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin: 0 auto 12px; display: block;">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p style="font-weight: 600;">Sin conversaciones recientes</p>
                </div>
            `;
        }
    });

    router.register('notificaciones', class {
        async mount(vp) {
            vp.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">Notificaciones</h1>
                </div>
                <div class="empty-state" style="padding: 60px 24px; text-align: center; color: var(--color-text-muted);">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#6366f1" stroke-width="1.5" style="margin: 0 auto 12px; display: block;">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <p style="font-weight: 600;">Notificaciones</p>
                    <span style="font-size: 13px;">Sin notificaciones pendientes</span>
                </div>
            `;
        }
    });

    // ── 6. EXPONER ROUTER Y CONTROL DE CACHÉ GLOBALMENTE ────

    window.AppRouter = {
        navigate: (id, opts) => router.navigate(id, opts),
        current: () => router.getCurrentRoute()
    };

    window.setCacheEnabled = (enabled) => {
        window.__CALIDAD_ENABLE_CACHE__ = Boolean(enabled);
        if (!enabled) cache.clear();
        console.log(`%c[CALIDAD2] Caché ${enabled ? 'HABILITADO' : 'DESHABILITADO'}`, 'color: #0284c7; font-weight: bold;');
    };
    window.isCacheEnabled = () => cache.isEnabled();

    console.log(
        `%c[CALIDAD2] Sistema iniciado. Caché: ${cache.isEnabled() ? 'HABILITADO' : 'DESHABILITADO (Modo Pruebas)'}`,
        `color: ${cache.isEnabled() ? '#10b981' : '#f59e0b'}; font-weight: bold; font-size: 11px;`
    );

    // ── 7. INICIAR EN LA RUTA INICIAL ────────────────────────

    const hash = window.location.hash.replace('#', '') || 'apps';
    await router.navigate(hash, { pushState: false });

    // ── 8. ACTUALIZAR UI DE AUTH (BARRA NAV) ─────────────────
    _updateNavAuthUI(Store.getState().currentUser);

    // Reaccionar a cambios de usuario en el Store
    Store.subscribe('currentUser', (user) => {
        _updateNavAuthUI(user);
    });
}

function _updateNavAuthUI(user) {
    const avatarEl = document.getElementById('nav-avatar');
    if (!avatarEl || !user) return;

    if (user.fotoUrl) {
        avatarEl.innerHTML = `<img src="${user.fotoUrl}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;" />`;
    } else {
        avatarEl.style.background = user.roleMetadata?.gradient || '#64748b';
        avatarEl.textContent = user.initials;
        avatarEl.style.cssText += `
            width: 22px;
            height: 22px;
            border-radius: 50%;
            color: #fff;
            font-size: 9px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
    }
}

// ── Iniciar cuando el DOM esté listo ─────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
