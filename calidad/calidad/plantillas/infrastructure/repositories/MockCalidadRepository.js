import { IReportRepository }   from '../../core/ports/IReportRepository.js';
import { ReporteCalidadEntity } from '../../core/domain/calidad/ReporteCalidadEntity.js';
import { CurvaProduccionEntity } from '../../core/domain/calidad/CurvaProduccionEntity.js';
import { HallazgoDefectoEntity } from '../../core/domain/calidad/HallazgoDefectoEntity.js';

/**
 * Adaptador de Infraestructura: MockCalidadRepository
 * Provee datos de prueba de alta fidelidad para previsualizar y validar la plantilla.
 */
export class MockCalidadRepository extends IReportRepository {
  async getReportById(idReporte = 'REP-2026-0841') {
    // Curva de Producción de OP 222
    const curva = new CurvaProduccionEntity({
      tallas: ['28', '30', '32', '34', '36', '38'],
      filas: [
        {
          color: 'AZUL OSCURO (INDIGO)',
          hex: '#1E3A8A',
          cantidades: { '28': 15, '30': 35, '32': 60, '34': 45, '36': 25, '38': 10 }
        },
        {
          color: 'AZUL MEDIO (STONE)',
          hex: '#3B82F6',
          cantidades: { '28': 10, '30': 20, '32': 35, '34': 25, '36': 15, '38': 5 }
        },
        {
          color: 'NEGRO CARBÓN',
          hex: '#1E293B',
          cantidades: { '28': 5, '30': 10, '32': 15, '34': 12, '36': 5, '38': 3 }
        }
      ]
    });

    // Hallazgos y Defectos de Auditoría (7 Unidades)
    const hallazgos = [
      new HallazgoDefectoEntity({
        tipo: 'SIN CONFECCIONAR',
        tipoClase: 'sin-confeccionar',
        color: 'AZUL OSCURO (INDIGO)',
        colorHex: '#1E3A8A',
        causa: 'Faltante de ensamble / Pieza pendiente',
        cantidadesPorTalla: { '32': 2 }
      }),
      new HallazgoDefectoEntity({
        tipo: 'SIN CONFECCIONAR',
        tipoClase: 'sin-confeccionar',
        color: 'AZUL MEDIO (STONE)',
        colorHex: '#3B82F6',
        causa: 'Faltante de ensamble / Pieza pendiente',
        cantidadesPorTalla: { '34': 2 }
      }),
      new HallazgoDefectoEntity({
        tipo: 'PROMOCIÓN — COSTURA',
        tipoClase: 'promociones',
        color: 'AZUL OSCURO (INDIGO)',
        colorHex: '#1E3A8A',
        causa: 'Desviación en costura de pespunte posterior',
        cantidadesPorTalla: { '30': 1 }
      }),
      new HallazgoDefectoEntity({
        tipo: 'PROMOCIÓN — COSTURA',
        tipoClase: 'promociones',
        color: 'NEGRO STONE',
        colorHex: '#1E293B',
        causa: 'Desviación en costura de pespunte posterior',
        cantidadesPorTalla: { '32': 2 }
      })
    ];

    return new ReporteCalidadEntity({
      idReporte,
      fecha: '10/09/2026 03:14 PM',
      productora: '4 — EL TEMPLO DE LA MODA S.A.S.',
      tipoVisita: 'AUDITORÍA INICIAL',
      conclusion: 'APROBADO',
      planta: 'CARLOS ANDRÉS MENDOZA ARIAS',
      proceso: 'CONFECCIÓN',
      op: '222',
      referencia: 'REF-9024-DENIM',
      linea: 'DENIM MASCULINO',
      prenda: 'PANTALÓN JEAN',
      genero: 'CABALLERO',
      cantidadTotal: 350,
      destinoProceso: 'LAVANDERÍA',
      destinoPlanta: 'TALLER LAVAMAX (SOPÓ)',
      fechaDespacho: '11/09/2026',
      fechaEntrega: '16/09/2026',
      telefonoPlanta: '316 800 7979',
      correoNotificacion: 'nixandres2@gmail.com',
      avancePorcentaje: 85,
      coordenadas: '4.60971,-74.08175',
      fotoUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=400&q=80',
      curva,
      hallazgos,
      observaciones: 'Se realiza inspección aleatoria sobre el 100% de la Orden de Producción 222. Se evidencia buen manejo de tensiones en costuras y correcta aplicación de hiladillas. Las 7 unidades identificadas con desviación menor en pespunte fueron marcadas y separadas para corrección inmediata antes del envío a lavandería. El lote cumple a cabalidad con la ficha técnica y las especificaciones de calidad del Grupo TDM. Lote liberado con concepto de APROBADO para continuar su ruta hacia el proceso de Lavandería en Taller Lavamax.',
      auditor: {
        nombre: 'JUAN CARLOS RAMÍREZ PÉREZ',
        cedula: '1.098.765.432',
        cargo: 'Auditor de Calidad — Grupo TDM',
        registroDigital: 'AUTH-TDM-OK-2026'
      },
      representantePlanta: {
        nombre: 'CARLOS ANDRÉS MENDOZA ARIAS',
        cedula: '1.144.167.164',
        cargo: 'Representante Planta / Taller Confección',
        firmaSvg: null
      }
    });
  }
}
