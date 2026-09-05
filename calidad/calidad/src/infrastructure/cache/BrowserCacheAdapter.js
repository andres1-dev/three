import { ICacheService } from '../../core/ports/ICacheService.js';
import { ENV } from '../config/env.js';

/**
 * Adaptador de Caché con TTL (Time-to-Live) en memoria y sessionStorage
 * Cuenta con interruptor maestro (ENV.ENABLE_CACHE) para modo pruebas/desarrollo.
 */
export class BrowserCacheAdapter extends ICacheService {
    constructor(prefix = 'CALIDAD2_CACHE_') {
        super();
        this.prefix = prefix;
        this.memory = new Map();

        // Si el caché está deshabilitado, limpiar almacenamiento de residuos anteriores
        if (!this.isEnabled()) {
            this.clear();
            console.info('[BrowserCacheAdapter] Caché DESHABILITADO por configuración (modo pruebas).');
        }
    }

    /**
     * Comprueba si el caché está habilitado globalmente.
     * Puede ser sobreescrito en tiempo de ejecución con window.__CALIDAD_ENABLE_CACHE__ = true/false
     */
    isEnabled() {
        if (typeof window !== 'undefined' && typeof window.__CALIDAD_ENABLE_CACHE__ === 'boolean') {
            return window.__CALIDAD_ENABLE_CACHE__;
        }
        return Boolean(ENV.ENABLE_CACHE);
    }

    get(key) {
        if (!this.isEnabled()) return null;

        const fullKey = this.prefix + key;
        const entry = this.memory.get(fullKey);


        if (!entry) {
            // Intentar recuperar de sessionStorage
            try {
                const stored = sessionStorage.getItem(fullKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
                        sessionStorage.removeItem(fullKey);
                        return null;
                    }
                    this.memory.set(fullKey, parsed);
                    return parsed.value;
                }
            } catch (_) {}
            return null;
        }

        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.delete(key);
            return null;
        }

        return entry.value;
    }

    set(key, value, ttlMs = 5 * 60 * 1000) {
        if (!this.isEnabled()) {
            this.delete(key);
            return;
        }

        const fullKey = this.prefix + key;
        const expiresAt = ttlMs ? Date.now() + ttlMs : null;

        const entry = { value, expiresAt };

        this.memory.set(fullKey, entry);

        try {
            sessionStorage.setItem(fullKey, JSON.stringify(entry));
        } catch (_) {}
    }

    delete(key) {
        const fullKey = this.prefix + key;
        this.memory.delete(fullKey);
        try {
            sessionStorage.removeItem(fullKey);
        } catch (_) {}
    }

    clear() {
        this.memory.clear();
        try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(this.prefix)) {
                    sessionStorage.removeItem(k);
                }
            }
        } catch (_) {}
    }
}
