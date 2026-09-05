import { Lote } from '../../domain/Lote.js';

/**
 * Caso de Uso: Obtener Lotes y Resumen de Producción (On-Demand)
 */
export class GetLotesUseCase {
    constructor(dataService, cacheService = null) {
        this.dataService = dataService;
        this.cacheService = cacheService;
    }

    /**
     * Obtiene las productoras disponibles
     */
    async getProductoras() {
        if (typeof this.dataService.getProductoras === 'function') {
            return await this.dataService.getProductoras();
        }
        return [];
    }

    /**
     * Obtiene los lotes disponibles aplicando filtros on-demand
     * @param {Object} params
     * @param {string} params.query
     * @param {string} params.planta
     * @param {string} params.productora
     * @param {number} params.limit
     * @returns {Promise<Lote[]>}
     */
    async execute({ query = '', planta = '', productora = '', limit = 40 } = {}) {
        try {
            if (typeof this.dataService.getLotes === 'function') {
                const raw = await this.dataService.getLotes({ query, planta, productora, limit });
                return (raw || []).map(l => l instanceof Lote ? l : new Lote(l));
            }
            return [];
        } catch (e) {
            console.warn('[GetLotesUseCase] Error obteniendo lotes on-demand:', e);
            return [];
        }
    }
}
