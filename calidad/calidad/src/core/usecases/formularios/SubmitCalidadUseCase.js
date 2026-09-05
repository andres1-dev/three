import { CalidadReport } from '../../domain/CalidadReport.js';

/**
 * Caso de Uso: Validar y Registrar Reporte de Calidad
 */
export class SubmitCalidadUseCase {
    constructor(dataService) {
        this.dataService = dataService;
    }

    /**
     * @param {Object} data
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async execute(data) {
        const report = new CalidadReport(data);

        if (!report.lote) {
            throw new Error('Debe especificar un Lote / OP para el reporte de calidad.');
        }
        if (!report.tipoVisita) {
            throw new Error('Debe indicar el tipo de visita.');
        }
        if (!report.conclusion) {
            throw new Error('Debe seleccionar el estado o conclusión de la auditoría.');
        }

        if (typeof this.dataService.submitCalidad === 'function') {
            return await this.dataService.submitCalidad(report);
        }

        throw new Error('El servicio de datos no tiene implementado el envío de reportes de calidad.');
    }
}
