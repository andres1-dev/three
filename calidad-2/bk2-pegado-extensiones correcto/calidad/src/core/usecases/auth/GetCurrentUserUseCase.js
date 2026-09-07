/**
 * Caso de Uso: Obtener el usuario autenticado actual y su perfil
 */
export class GetCurrentUserUseCase {
    constructor(authService, dataService) {
        this.authService = authService;
        this.dataService = dataService;
    }

    async execute() {
        const authUser = await this.authService.getCurrentUser();
        if (!authUser) return null;

        let profile = null;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUser.cedula);

        try {
            if (!isUUID && authUser.cedula) {
                profile = await this.dataService.getUserByCedula(authUser.cedula);
            }
        } catch (_) {}

        if (!profile && authUser.email) {
            try {
                profile = await this.dataService.getUserByCedula(authUser.email);
            } catch (_) {}
        }

        if (!profile && authUser.id) {
            try {
                profile = await this.dataService.getUserByCedula(authUser.id);
            } catch (_) {}
        }

        if (profile) {
            if (!profile.email && authUser.email) profile.email = authUser.email;
            if (!profile.fotoUrl && authUser.fotoUrl) profile.fotoUrl = authUser.fotoUrl;
            return profile;
        }

        return authUser;
    }
}
