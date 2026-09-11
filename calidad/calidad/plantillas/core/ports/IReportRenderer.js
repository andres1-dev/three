/**
 * Puerto: IReportRenderer
 * Define el contrato que debe implementar cualquier renderizador de reportes (HTML, Canvas, PDF).
 * Sirve a todas las plantillas: calidad, novedad, y futuras.
 */
export class IReportRenderer {
  /**
   * @param {object} entity - Entidad de dominio a renderizar (ReporteCalidadEntity, NovedadEntity, etc.)
   * @returns {string} Código HTML renderizado
   */
  render(entity) {
    throw new Error('Método render(entity) no implementado');
  }
}
