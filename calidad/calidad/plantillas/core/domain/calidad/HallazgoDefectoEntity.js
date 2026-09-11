/**
 * Entidad de Dominio: HallazgoDefectoEntity
 * Representa una novedad o defecto detectado en la auditoría, con desglose horizontal por tallas.
 */
export class HallazgoDefectoEntity {
  /**
   * @param {Object} params
   * @param {string} params.tipo - Clasificación (SIN CONFECCIONAR, PROMOCIONES, COBROS, LAVADO)
   * @param {string} params.tipoClase - Clase visual (sin-confeccionar, promociones, cobros, lavado)
   * @param {string} params.color - Nombre del color afectado
   * @param {string} params.colorHex - Color en hexadecimal para el punto visual
   * @param {string} params.causa - Causa o descripción técnica de la no conformidad
   * @param {Record<string, number>} params.cantidadesPorTalla - Mapa { '30': 1, '32': 2 }
   */
  constructor({
    tipo = '',
    tipoClase = 'sin-confeccionar',
    color = '',
    colorHex = '#1E293B',
    causa = '',
    cantidadesPorTalla = {}
  } = {}) {
    this.tipo = tipo;
    this.tipoClase = tipoClase;
    this.color = color;
    this.colorHex = colorHex;
    this.causa = causa;
    this.cantidadesPorTalla = cantidadesPorTalla;
  }

  /**
   * Cantidad para una talla dada
   */
  getCantidad(talla) {
    return Number(this.cantidadesPorTalla[talla] || 0);
  }

  /**
   * Total de unidades afectadas por este hallazgo
   */
  getTotalUnidades() {
    return Object.values(this.cantidadesPorTalla).reduce((acc, curr) => acc + Number(curr || 0), 0);
  }
}
