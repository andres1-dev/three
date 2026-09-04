/**
 * Store Reactivo Ligero (Observer / Pub-Sub)
 * Maneja el estado global sin librerías pesadas y sin contaminar window.
 */
class AppStore {
    constructor() {
        this.state = {
            currentUser: null,
            currentRoute: 'apps',
            themePalette: localStorage.getItem('calidad2_palette') || 'Azul',
            iconConfig: this._loadIconConfig(),
            isLoading: false,
            notificationsCount: 0
        };
        this.listeners = new Map();
    }

    _loadIconConfig() {
        try {
            return JSON.parse(localStorage.getItem('calidad2_icon_config') || '{}');
        } catch (_) {
            return {};
        }
    }

    getState() {
        return { ...this.state };
    }

    setState(partialState) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...partialState };

        Object.keys(partialState).forEach(key => {
            if (this.listeners.has(key)) {
                this.listeners.get(key).forEach(cb => cb(this.state[key], prevState[key]));
            }
        });

        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(cb => cb(this.state, prevState));
        }
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        // Retornar función para desuscribirse
        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }
}

export const Store = new AppStore();
