import { Novedad } from '../../domain/Novedad.js';

/**
 * Caso de Uso: Validar y Enviar Reporte de Novedad
 */
export class SubmitNovedadUseCase {
    constructor(dataService) {
        this.dataService = dataService;
    }

    /**
     * @param {Object} data
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async execute(data) {
        const novedad = new Novedad(data);

        if (!novedad.lote) {
            throw new Error('Debe especificar o seleccionar un Lote / OP válido.');
        }
        if (!novedad.planta) {
            throw new Error('Debe especificar la planta correspondiente.');
        }
        if (!novedad.tipoNovedad) {
            throw new Error('Debe seleccionar el tipo de novedad.');
        }

        if (typeof this.dataService.submitNovedad === 'function') {
            return await this.dataService.submitNovedad(novedad);
        }

        throw new Error('El servicio de datos no tiene implementado el envío de novedades.');
    }
}
