import { IReportRepository } from '../../core/ports/IReportRepository.js';
import { NovedadEntity }      from '../../core/domain/novedad/NovedadEntity.js';

/**
 * Adaptador de Infraestructura: MockNovedadRepository
 * Provee datos de alta fidelidad para previsualizar la plantilla de novedades.
 * En producción, esto sería sustituido por FirestoreNovedadRepository u otro adaptador real.
 */
export class MockNovedadRepository extends IReportRepository {
  async getReportById(idNovedad = 'NOV-2026-0394') {
    return new NovedadEntity({
      idNovedad,
      estado:     'ELABORACION',
      fecha:      '10/09/2026 02:45 PM',
      salida:     null,

      // Producción
      op:         '222',
      referencia: 'REF-9024-DENIM',
      prenda:     'PANTALÓN JEAN',
      genero:     'CABALLERO',
      tejido:     'DENIM 12 OZ',
      linea:      'DENIM MASCULINO',
      proceso:    'CONFECCIÓN',
      cantidad:   350,

      // Novedad
      area:               'CÓDIGOS',
      tipoNovedad:        'CAMBIO DE TALLA',
      descripcion:        'Se detecta diferencia de talla en unidades del lote 222. Cliente solicita ajuste de marquillas y re-etiquetado de las unidades afectadas antes del despacho.',
      comentarios:        'Coordinar con el área de terminación para el proceso de re-etiquetado.',
      cantidadSolicitada: 7,
      cobro:              'TALLER',

      // Detalle específico (tipo unidades por talla/color)
      tipoDetalle: {
        tipo_solicitud: 'UNIDADES',
        items: [
          { talla: '32', color: 'AZUL OSCURO (INDIGO)', cantidad: 2 },
          { talla: '34', color: 'AZUL MEDIO (STONE)',   cantidad: 2 },
          { talla: '30', color: 'AZUL OSCURO (INDIGO)', cantidad: 1 },
          { talla: '32', color: 'NEGRO CARBÓN',          cantidad: 2 },
        ]
      },

      // Planta / Taller
      planta: {
        nombre:   '4 — EL TEMPLO DE LA MODA S.A.S.',
        idPlanta: '900456789',
        telefono: '3168007979',
        correo:   'nixandres2@gmail.com',
      },

      imagen: idNovedad,
    });
  }
}
