import { RuteroItem } from '../../domain/RuteroItem.js';

/**
 * Caso de Uso: Validar y Registrar Visita en Rutero
 */
export class SubmitRuteroUseCase {
    constructor(dataService) {
        this.dataService = dataService;
    }

    /**
     * @param {Object} data
     * @returns {Promise<{ success: boolean, message: string }>}
     */
    async execute(data) {
        const item = new RuteroItem(data);

        if (!item.lote) {
            throw new Error('Debe especificar un Lote / OP para programar la visita.');
        }
        if (!item.fechaVisita) {
            throw new Error('Debe especificar la fecha de la visita.');
        }

        if (typeof this.dataService.submitRutero === 'function') {
            return await this.dataService.submitRutero(item);
        }

        throw new Error('El servicio de datos no tiene implementado el envío de visitas de rutero.');
    }
}
