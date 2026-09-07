/**
 * Caso de Uso: Catálogo de productoras desde la tabla `productoras` (vía Edge Function `/nube`).
 * El usuario mantiene esta tabla actualizada en Supabase.
 */
export class GetProductorasNubeUseCase {
    constructor(nubeService) {
        this.nubeService = nubeService;
    }

    async execute() {
        try {
            return await this.nubeService.getProductoras();
        } catch (err) {
            console.error('[Nube] Error al obtener productoras:', err);
            return [];
        }
    }
}