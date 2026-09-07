import { Store } from '../state/Store.js';

/**
 * Enrutador SPA Moderno con ciclo de vida (mount, unmount) y Guardias
 */
export class Router {
    constructor(viewportElement, { authService } = {}) {
        this.viewport = viewportElement;
        this.authService = authService;
        this.routes = new Map();
        this.activeRoute = null;
        this.activeInstance = null;

        window.addEventListener('popstate', (e) => {
            const routeId = e.state?.route || 'apps';
            this.navigate(routeId, { pushState: false });
        });
    }

    register(routeId, moduleFactory) {
        this.routes.set(routeId, moduleFactory);
        return this;
    }

    async navigate(routeId, { pushState = true, params = {} } = {}) {
        if (!this.routes.has(routeId)) {
            console.warn(`[Router] Ruta no registrada: ${routeId}, redirigiendo a apps.`);
            routeId = 'apps';
        }

        // Guardia de navegación SPA: No llamar a Supabase por red en cada cambio de ruta.
        // La validación principal de token se realiza de forma síncrona en index.html y main.js.

        // Si ya estamos en la misma ruta, no re-montar
        if (this.activeRoute === routeId && this.activeInstance) {
            return;
        }

        // Desmontar módulo anterior si cuenta con hook unmount
        if (this.activeInstance && typeof this.activeInstance.unmount === 'function') {
            try {
                this.activeInstance.unmount();
            } catch (err) {
                console.error('[Router] Error al desmontar módulo:', err);
            }
        }

        this.viewport.scrollTop = 0;

        const ModuleClass = this.routes.get(routeId);
        const moduleInstance = new ModuleClass({ router: this, params });

        try {
            await moduleInstance.mount(this.viewport);
            this.activeRoute = routeId;
            this.activeInstance = moduleInstance;

            Store.setState({ currentRoute: routeId });

            if (pushState) {
                history.pushState({ route: routeId }, '', `#${routeId}`);
            }

            this._updateNavUI(routeId);
        } catch (err) {
            console.error(`[Router] Error al montar módulo "${routeId}":`, err);
            this.viewport.innerHTML = `
                <div style="padding: 24px; text-align: center;">
                    <p style="color: var(--color-danger); font-weight: bold;">Error al cargar el módulo ${routeId}</p>
                    <button class="btn btn-secondary" style="margin-top: 12px;" onclick="window.location.reload()">Reintentar</button>
                </div>
            `;
        }
    }

    _updateNavUI(routeId) {
        const NAV_FIXED = new Set(['inicio', 'chats', 'apps', 'notificaciones', 'perfil']);
        document.querySelectorAll('.nav-btn, .nav-item').forEach(btn => {
            const target = btn.dataset.route || btn.dataset.nav || btn.dataset.module;
            if (NAV_FIXED.has(routeId)) {
                btn.classList.toggle('active', target === routeId);
            } else {
                btn.classList.toggle('active', target === 'apps');
            }
        });
    }


    getCurrentRoute() {
        return this.activeRoute;
    }
}
