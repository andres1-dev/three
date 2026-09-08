export class ResumenProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    /**
     * Resumen COMPLETO en una sola llamada a la Edge Function:
     * { extensiones, confeccion, procesos, rows: { confeccion, procesos }, ultima }
     * @param {{ idProductora?: string, limitRows?: number }} filtros
     */
    async execute(filtros = {}) {
        return await this.nubeService.resumenProgramacion(filtros || {});
    }
}
