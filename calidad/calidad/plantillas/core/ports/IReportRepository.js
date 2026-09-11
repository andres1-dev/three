/**
 * Puerto: IReportRepository
 * Contrato para acceder a la fuente de datos del reporte (Mock, Firestore, Supabase, etc.)
 * Sirve a todas las plantillas: calidad, novedad, y futuras.
 */
export class IReportRepository {
  /**
   * @param {string|number} id - Identificador del documento (ID de reporte, ID de novedad, etc.)
   * @returns {Promise<object>} Entidad de dominio correspondiente
   */
  async getReportById(id) {
    throw new Error('Método getReportById(id) no implementado');
  }
}
