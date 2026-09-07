import { INubeService } from '../../core/ports/INubeService.js';
import { getSupabaseClient } from '../supabase/SupabaseClient.js';
import { ENV } from '../config/env.js';

export class NubeService extends INubeService {
    constructor() {
        super();
        this.sb = getSupabaseClient();
    }

    _getClient() {
        if (!this.sb) this.sb = getSupabaseClient();
        return this.sb;
    }

    async _getAccessToken() {
        try {
            const client = this._getClient();
            if (client) {
                const { data } = await client.auth.getSession();
                if (data?.session?.access_token) return data.session.access_token;
            }
        } catch (_) {}

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k) || 'null');
                    if (s?.access_token) return s.access_token;
                }
            }
        } catch (_) {}

        return ENV.SUPABASE_KEY;
    }

    async _callNube(payload = {}) {
        const token = await this._getAccessToken();
        const resp = await fetch(`${ENV.FUNCTIONS_URL}/nube`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': ENV.SUPABASE_KEY
            },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => resp.status);
            throw new Error(`[nube] HTTP ${resp.status}: ${text}`);
        }
        return resp.json();
    }

    async guardarProgramacion(items, usuarioEditor, proveedor) {
        const payload = items.map(item => ({
            proveedor,
            usuario_editor: usuarioEditor,
            numlote: item.numlote,
            ref: item.ref,
            color: item.color,
            colores: item.colores,
            talla: item.talla,
            total_und: item.totalUnd,
            observacion: item.observacion || ''
        }));

        const res = await this._callNube({
            accion: 'GUARDAR_PROGRAMACION',
            items: payload
        });

        if (res && res.success) {
            return {
                success: true,
                message: res.message || 'Programación guardada exitosamente',
                data: res.data
            };
        }

        throw new Error(res?.message || 'Error al guardar la programación');
    }

    async asentarProgramacion(items, fechaPrograma, observacion, usuarioEditor) {
        const payload = items.map(item => ({
            proveedor: item.proveedor || '',
            usuario_editor: usuarioEditor,
            numlote: item.numlote,
            ref: item.ref,
            color: item.color,
            colores: item.colores,
            talla: item.talla,
            total_und: item.totalUnd,
            fecha_programa: fechaPrograma,
            observacion: observacion || ''
        }));

        const res = await this._callNube({
            accion: 'ASENTAR_PROGRAMACION',
            items: payload
        });

        if (res && res.success) {
            return {
                success: true,
                message: res.message || 'Programación asentada exitosamente',
                data: res.data
            };
        }

        throw new Error(res?.message || 'Error al asentar la programación');
    }

    async listarProgramacion(filtros = {}) {
        const res = await this._callNube({
            accion: 'LISTAR_PROGRAMACION',
            ...filtros
        });

        if (res && res.success && Array.isArray(res.data)) {
            return res.data.map(item => ({
                id: item.id,
                proveedor: item.proveedor,
                usuarioEditor: item.usuario_editor,
                numlote: item.numlote,
                ref: item.ref,
                color: item.color,
                colores: item.colores,
                talla: item.talla,
                totalUnd: item.total_und,
                fechaPrograma: item.fecha_programa,
                observacion: item.observacion,
                createdAt: item.created_at,
                updatedAt: item.updated_at
            }));
        }

        return [];
    }
}
