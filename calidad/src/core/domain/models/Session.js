/**
 * Entidad de Dominio: Sesión de Usuario
 */
export class Session {
    constructor({ accessToken, user = null, expiresAt = null }) {
        this.accessToken = accessToken;
        this.user = user;
        this.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    get isValid() {
        if (!this.accessToken) return false;
        if (this.expiresAt && this.expiresAt.getTime() <= Date.now()) return false;
        return true;
    }
}
