/**
 * Caso de Uso: Iniciar Sesión
 */
export class LoginUseCase {
    constructor(authService) {
        this.authService = authService;
    }

    async execute({ email, password }) {
        if (!email || !password) {
            throw new Error('Debes ingresar correo y contraseña.');
        }

        const cleanEmail = email.trim().toLowerCase();
        const session = await this.authService.login(cleanEmail, password);
        return session;
    }
}
