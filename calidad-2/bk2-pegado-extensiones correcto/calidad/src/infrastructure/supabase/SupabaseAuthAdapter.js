import { IAuthService } from '../../core/ports/IAuthService.js';
import { getSupabaseClient } from './SupabaseClient.js';
import { User } from '../../core/domain/models/User.js';
import { Session } from '../../core/domain/models/Session.js';

/**
 * Adaptador de Autenticación con Supabase Auth
 */
export class SupabaseAuthAdapter extends IAuthService {
    constructor() {
        super();
        this.sb = getSupabaseClient();
    }

    _getClient() {
        if (!this.sb) this.sb = getSupabaseClient();
        return this.sb;
    }

    async login(email, password) {
        const client = this._getClient();
        if (!client) throw new Error('Cliente Supabase no disponible.');

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const user = this._mapSupabaseUser(data.user);
        return new Session({
            accessToken: data.session.access_token,
            user,
            expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : null
        });
    }

    async logout() {
        const client = this._getClient();
        if (client) {
            try {
                await client.auth.signOut();
            } catch (_) {}
        }
        // Limpieza de almacenamiento local
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (k.includes('-auth-token') || k.startsWith('sb-'))) {
                localStorage.removeItem(k);
            }
        }
        sessionStorage.clear();
    }

    async getSession() {
        const client = this._getClient();
        if (!client) return null;

        const { data } = await client.auth.getSession();
        if (!data?.session) return null;

        const user = this._mapSupabaseUser(data.session.user);
        return new Session({
            accessToken: data.session.access_token,
            user,
            expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : null
        });
    }

    async getCurrentUser() {
        const session = await this.getSession();
        return session ? session.user : null;
    }

    onAuthStateChanged(callback) {
        const client = this._getClient();
        if (!client) return () => {};

        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
            const appSession = session ? new Session({
                accessToken: session.access_token,
                user: this._mapSupabaseUser(session.user),
                expiresAt: session.expires_at ? session.expires_at * 1000 : null
            }) : null;

            callback(event, appSession);
        });

        return () => subscription.unsubscribe();
    }

    _mapSupabaseUser(sbUser) {
        if (!sbUser) return null;
        const meta = sbUser.user_metadata || {};
        return User.fromRecord({
            id: sbUser.id,
            cedula: meta.cedula || '',
            nombre: meta.full_name || meta.name || meta.USUARIO || sbUser.email,
            email: sbUser.email,
            rol: meta.rol || meta.role || 'GUEST',
            planta: meta.planta || '',
            cargo: meta.cargo || '',
            area: meta.area || '',
            foto_url: meta.avatar_url || meta.foto_url || ''
        });
    }
}
