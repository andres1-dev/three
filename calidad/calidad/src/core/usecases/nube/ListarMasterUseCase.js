/**
 * Caso de Uso: Listar registros de la tabla master (Confección/Procesos).
 */
export class ListarMasterUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(filtros = {}) {
        try {
            return await this.nubeService.listarMaster(filtros);
        } catch (err) {
            console.error('[Master] Error al listar:', err);
            return [];
        }
    }
}
