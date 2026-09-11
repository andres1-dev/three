/**
 * Entidad de Dominio: CurvaProduccionEntity
 * Modela la matriz de distribución por Talla y Color de un lote de confección.
 */
export class CurvaProduccionEntity {
  /**
   * @param {Object} params
   * @param {string[]} params.tallas - Lista de tallas (ej. ['28', '30', '32', '34', '36', '38'])
   * @param {Array<{color: string, hex: string, cantidades: Record<string, number>}>} params.filas - Filas por color
   */
  constructor({ tallas = [], filas = [] } = {}) {
    this.tallas = tallas;
    this.filas = filas;
  }

  /**
   * Obtiene la cantidad para un color y talla específicos
   */
  getCantidad(colorNombre, talla) {
    const fila = this.filas.find(f => f.color.toLowerCase() === colorNombre.toLowerCase());
    if (!fila || !fila.cantidades) return 0;
    return Number(fila.cantidades[talla] || 0);
  }

  /**
   * Suma total de unidades de un color determinado
   */
  getTotalColor(colorNombre) {
    const fila = this.filas.find(f => f.color.toLowerCase() === colorNombre.toLowerCase());
    if (!fila || !fila.cantidades) return 0;
    return Object.values(fila.cantidades).reduce((acc, curr) => acc + Number(curr || 0), 0);
  }

  /**
   * Suma total de unidades de una talla a través de todos los colores
   */
  getTotalTalla(talla) {
    return this.filas.reduce((acc, f) => acc + Number(f.cantidades?.[talla] || 0), 0);
  }

  /**
   * Gran total de unidades de la curva
   */
  getGranTotal() {
    return this.filas.reduce((acc, f) => {
      const subtotal = Object.values(f.cantidades || {}).reduce((s, c) => s + Number(c || 0), 0);
      return acc + subtotal;
    }, 0);
  }
}
