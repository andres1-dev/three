/**
 * Caso de Uso: Listar la programación guardada en la tabla `extensiones`.
 * @param {Object} filtros - { op, idProductora, fecha, limit }
 */
export class ListarProgramacionUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute(filtros = {}) {
        return await this.nubeService.listarProgramacion(filtros || {});
    }
}