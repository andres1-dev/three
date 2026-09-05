/**
 * Puerto de Salida: Servicio de Autenticación
 * Define el contrato que cualquier proveedor de auth (Supabase, Firebase, mock) debe cumplir.
 */
export class IAuthService {
    async login(email, password) {
        throw new Error('Method not implemented: login');
    }

    async logout() {
        throw new Error('Method not implemented: logout');
    }

    async getSession() {
        throw new Error('Method not implemented: getSession');
    }

    async getCurrentUser() {
        throw new Error('Method not implemented: getCurrentUser');
    }

    onAuthStateChanged(callback) {
        throw new Error('Method not implemented: onAuthStateChanged');
    }
}
