/**
 * Adaptador: Módulo NUBE (Programación de Taller).
 * Comunica la presentación con la Edge Function dedicada `/nube`.
 */
import { INubeService } from '../../core/ports/INubeService.js';
import { ENV } from '../config/env.js';
import { getSupabaseClient } from './SupabaseClient.js';

export class SupabaseNubeAdapter extends INubeService {
    constructor() {
        super();
        this.url = `${ENV.FUNCTIONS_URL}/nube`;
    }

    async _getAccessToken() {
        try {
            const sb = getSupabaseClient();
            const { data } = await sb.auth.getSession();
            if (data?.session?.access_token) return data.session.access_token;
        } catch (_) { /* fallback abajo */ }
        // Fallback: leer el token directamente de localStorage (patrón del proyecto)
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k) || 'null');
                    if (s?.access_token) return s.access_token;
                }
            }
        } catch (_) { /* noop */ }
        return '';
    }

    async _call(payload) {
        const token = await this._getAccessToken();
        const resp = await fetch(this.url, {
            method: 'POST',
            // no-store: el resumen SIEMPRE debe ser fresco (nunca caché).
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': ENV.SUPABASE_KEY
            },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => String(resp.status));
            throw new Error(`[nube] HTTP ${resp.status}: ${text}`);
        }
        return resp.json();
    }

    async getProductoras() {
        const res = await this._call({ accion: 'LISTAR_PRODUCTORAS' });
        return res?.productoras || [];
    }

    async listarProgramacion(filtros = {}) {
        const res = await this._call({ accion: 'LISTAR_PROGRAMACION', ...filtros });
        return res?.rows || [];
    }

    async resumenProgramacion(filtros = {}) {
        // ── VÍA RÁPIDA: RESUMEN_COMPLETO (RPC SQL, una sola llamada) ──
        try {
            const res = await this._call({ accion: 'RESUMEN_COMPLETO', ...filtros });
            if (res && (Array.isArray(res.extensiones) || Array.isArray(res.confeccion) || Array.isArray(res.procesos))) {
                const totalResumen = (res.extensiones?.length || 0) + (res.confeccion?.length || 0) + (res.procesos?.length || 0);
                if (totalResumen > 0) return res;
                // Arrays vacíos: los RPC del SQL aún no están desplegados o la BD está
                // vacía → intentar la ruta legacy antes de mostrar "Sin registros".
            }
        } catch (_) { /* RESUMEN_COMPLETO no desplegado aún → legacy abajo */ }

        // ── FALLBACK: RESUMEN_PROGRAMACION (acción legacy, siempre disponible) ──
        // Solo trae el resumen de `extensiones`; Confección/Procesos los completa
        // el módulo vía LISTAR_MASTER.
        try {
            const res2 = await this._call({ accion: 'RESUMEN_PROGRAMACION' });
            return {
                extensiones: res2?.resumen || [],
                confeccion: [],
                procesos: [],
                rows: {},
                ultima: res2?.ultima || null,
                _legacy: true
            };
        } catch (_) {
            return { extensiones: [], confeccion: [], procesos: [], rows: {}, ultima: null, _legacy: true };
        }
    }

    async guardarProgramacion(payload) {
        return this._call({ accion: 'GUARDAR_PROGRAMACION', ...payload });
    }

    async syncConfeccion(payload) {
        return this._call({ accion: 'SYNC_CONFECCION', ...payload });
    }

    async syncProcesos(payload) {
        return this._call({ accion: 'SYNC_PROCESOS', ...payload });
    }

    async listarMaster(filtros = {}) {
        const res = await this._call({ accion: 'LISTAR_MASTER', ...filtros });
        return res?.rows || [];
    }
}