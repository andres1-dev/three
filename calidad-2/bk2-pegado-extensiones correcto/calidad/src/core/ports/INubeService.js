/**
 * Puerto: Servicio del módulo NUBE (Programación de Taller).
 * Toda la comunicación con la tabla `extensiones` y el catálogo `productoras`
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

    /** Resumen de la última actualización: { resumen: por productora, ultima: { fecha, updated_at, usuario, registros } }. */
    async resumenProgramacion() {
        throw new Error('INubeService.resumenProgramacion no implementado');
    }

    /**
     * Guarda (upsert) la programación en la tabla `extensiones`.
     * @param {{ rows: Array, idProductora: string, productora: string, usuarioEmail: string }} payload
     */
    async guardarProgramacion(payload) {
        throw new Error('INubeService.guardarProgramacion no implementado');
    }
}
