/**
 * Caso de Uso: Sincronizar registros de Confección en la tabla master.
 */
export class SyncConfeccionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(payload) {
        try {
            return await this.nubeService.syncConfeccion(payload);
        } catch (err) {
            console.error('[Confeccion] Error al sincronizar:', err);
            throw err;
        }
    }
}
