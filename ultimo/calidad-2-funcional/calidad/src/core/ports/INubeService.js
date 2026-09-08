/**
 * Puerto: Servicio del módulo NUBE (Programación de Taller).
 * Toda la comunicación con la tabla `extensiones`, `master` y el catálogo `productoras`
 * se canaliza por la Edge Function dedicada `/nube`.
 */
export class INubeService {
    /** Catálogo de productoras desde la tabla `productoras` (vía Edge Function). */
    async getProductoras() {
        throw new Error('INubeService.getProductoras no implementado');
    }

    /** Lista las extensiones guardadas. Filtros: { op, idProductora, fecha, limit }. */
    async listarProgramacion(filtros = {}) {
        throw new Error('INubeService.listarProgramacion no implementado');
    }

    /**
     * Resumen COMPLETO en una sola llamada (rápido, vía RPC SQL).
     * Filtros: { idProductora?: string, limitRows?: number }
     * Devuelve: { extensiones, confeccion, procesos, rows: { confeccion, procesos }, ultima }
     */
    async resumenProgramacion(filtros = {}) {
        throw new Error('INubeService.resumenProgramacion no implementado');
    }

    /**
     * Guarda (upsert) la programación en la tabla `extensiones`.
     * @param {{ rows: Array, idProductora: string, productora: string, usuarioEmail: string }} payload
     */
    async guardarProgramacion(payload) {
        throw new Error('INubeService.guardarProgramacion no implementado');
    }

    /**
     * Sincroniza registros de Confección en la tabla `master`.
     * @param {{ rows: Array, idProductora: string }} payload
     */
    async syncConfeccion(payload) {
        throw new Error('INubeService.syncConfeccion no implementado');
    }

    /**
     * Sincroniza registros de Procesos en la tabla `master`.
     * @param {{ rows: Array, idProductora: string }} payload
     */
    async syncProcesos(payload) {
        throw new Error('INubeService.syncProcesos no implementado');
    }

    /**
     * Lista registros de la tabla `master` (Confección/Procesos).
     * Filtros: { tipo: 'CONFECCION'|'PROCESOS'|'TODO', idProductora, limit }
     */
    async listarMaster(filtros = {}) {
        throw new Error('INubeService.listarMaster no implementado');
    }
}
