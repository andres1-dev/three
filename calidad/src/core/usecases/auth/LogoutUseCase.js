/**
 * Caso de Uso: Cerrar Sesión
 */
export class LogoutUseCase {
    constructor(authService, cacheService = null) {
        this.authService = authService;
        this.cacheService = cacheService;
    }

    async execute() {
        if (this.cacheService) {
            this.cacheService.clear();
        }
        await this.authService.logout();
    }
}
