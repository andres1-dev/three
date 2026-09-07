/**
 * Caso de Uso: Sincronizar registros de Procesos en la tabla master.
 */
export class SyncProcesosUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(payload) {
        try {
            return await this.nubeService.syncProcesos(payload);
        } catch (err) {
            console.error('[Procesos] Error al sincronizar:', err);
            throw err;
        }
    }
}
