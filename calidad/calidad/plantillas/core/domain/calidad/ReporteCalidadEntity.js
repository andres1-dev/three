import { CurvaProduccionEntity } from './CurvaProduccionEntity.js';
import { HallazgoDefectoEntity } from './HallazgoDefectoEntity.js';

/**
 * Entidad Raíz de Dominio: ReporteCalidadEntity
 * Agrega toda la información de auditoría, logística, curva de producción, evidencias y firmas.
 */
export class ReporteCalidadEntity {
  constructor(data = {}) {
    this.idReporte = data.idReporte || 'S/N';
    this.fecha = data.fecha || new Date().toISOString();
    this.productora = data.productora || '4 — EL TEMPLO DE LA MODA S.A.S.';
    this.tipoVisita = data.tipoVisita || 'AUDITORÍA INICIAL';
    this.conclusion = (data.conclusion || 'APROBADO').toUpperCase();

    // Planta y Proceso
    this.planta = data.planta || 'N/A';
    this.proceso = data.proceso || 'CONFECCIÓN';
    this.op = data.op || data.lote || 'N/A';
    this.referencia = data.referencia || 'N/A';
    this.linea = data.linea || 'DENIM MASCULINO';
    this.prenda = data.prenda || 'PANTALÓN JEAN';
    this.genero = data.genero || 'CABALLERO';
    this.cantidadTotal = Number(data.cantidadTotal || 0);

    // Destino y Logística
    this.destinoProceso = data.destinoProceso || 'LAVANDERÍA';
    this.destinoPlanta = data.destinoPlanta || 'N/A';
    this.fechaDespacho = data.fechaDespacho || 'N/A';
    this.fechaEntrega = data.fechaEntrega || 'N/A';
    this.telefonoPlanta = data.telefonoPlanta || 'N/A';
    this.correoNotificacion = data.correoNotificacion || 'N/A';
    this.avancePorcentaje = Number(data.avancePorcentaje || 0);

    // Geolocalización y Evidencia
    this.coordenadas = data.coordenadas || null; // { lat, lng } o string "4.60971,-74.08175"
    this.fotoUrl = data.fotoUrl || '';

    // Curva de Producción
    this.curva = data.curva instanceof CurvaProduccionEntity 
      ? data.curva 
      : new CurvaProduccionEntity(data.curva || {});

    // Hallazgos y Defectos
    this.hallazgos = Array.isArray(data.hallazgos)
      ? data.hallazgos.map(h => (h instanceof HallazgoDefectoEntity ? h : new HallazgoDefectoEntity(h)))
      : [];

    // Observaciones y Términos
    this.observaciones = data.observaciones || '';

    // Firmas
    this.auditor = {
      nombre: data.auditor?.nombre || 'N/A',
      cedula: data.auditor?.cedula || 'N/A',
      cargo: data.auditor?.cargo || 'Auditor de Calidad — Grupo TDM',
      registroDigital: data.auditor?.registroDigital || 'AUTH-TDM-OK-2026'
    };

    this.representantePlanta = {
      nombre: data.representantePlanta?.nombre || 'N/A',
      cedula: data.representantePlanta?.cedula || 'N/A',
      cargo: data.representantePlanta?.cargo || 'Representante Planta / Taller Confección',
      firmaSvg: data.representantePlanta?.firmaSvg || null
    };
  }

  /**
   * Suma total de unidades con defecto
   */
  getTotalDefectos() {
    return this.hallazgos.reduce((acc, h) => acc + h.getTotalUnidades(), 0);
  }

  /**
   * Tasa de afectación porcentual del lote
   */
  getTasaAfectacion() {
    const total = this.cantidadTotal || this.curva.getGranTotal();
    if (!total) return 0;
    return ((this.getTotalDefectos() / total) * 100).toFixed(1);
  }

  /**
   * Total de defectos para una talla determinada
   */
  getTotalDefectosPorTalla(talla) {
    return this.hallazgos.reduce((acc, h) => acc + h.getCantidad(talla), 0);
  }

  /**
   * Verifica si el reporte está aprobado
   */
  isAprobado() {
    return this.conclusion === 'APROBADO';
  }
}
