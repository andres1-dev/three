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

    async resumenProgramacion() {
        const res = await this._call({ accion: 'RESUMEN_PROGRAMACION' });
        return res || { resumen: [], ultima: null };
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