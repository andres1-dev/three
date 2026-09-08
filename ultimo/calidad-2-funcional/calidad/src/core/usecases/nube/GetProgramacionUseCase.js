export class GetProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(filtros = {}) {
        if (!this.nubeService) {
            throw new Error('Servicio de nube no disponible');
        }
        return await this.nubeService.listarProgramacion(filtros);
    }
}
