/**
 * Modelo de Dominio: CalidadReport
 */
export class CalidadReport {
    constructor(data = {}) {
        this.lote = data.lote || '';
        this.op = data.op || this.lote;
        this.planta = data.planta || '';
        this.modulo = data.modulo || '';
        this.linea = data.linea || '';
        this.referencia = data.referencia || '';
        this.tipoPrenda = data.tipoPrenda || '';
        this.cantidadTotal = parseInt(data.cantidadTotal || 0, 10);
        this.tipoVisita = data.tipoVisita || '';
        this.conclusion = data.conclusion || 'APROBADO'; // APROBADO, RECHAZADO, CONDICIONAL
        this.nivelInspeccion = data.nivelInspeccion || 'II';
        this.aqlNivel = data.aqlNivel || '4.0';
        this.tamanoMuestra = parseInt(data.tamanoMuestra || 0, 10);
        this.acLimite = parseInt(data.acLimite || 0, 10);
        this.reLimite = parseInt(data.reLimite || 1, 10);
        this.defectosCriticos = parseInt(data.defectosCriticos || 0, 10);
        this.defectosMayores = parseInt(data.defectosMayores || 0, 10);
        this.defectosMenores = parseInt(data.defectosMenores || 0, 10);
        this.destino = data.destino || data.destinoTipo || '';
        this.destinoTipo = data.destinoTipo || data.destino || '';
        this.destinoProceso = data.destinoProceso || data.DESTINO_PROCESO || '';
        this.destinoOtro = data.destinoOtro || data.DESTINO_OTRO || '';
        this.destinoPlanta = data.destinoPlanta || data.DESTINO_PLANTA || '';
        this.avanceCorte = data.avanceCorte || 0;
        this.avanceConfeccion = data.avanceConfeccion || 0;
        this.avanceTerminacion = data.avanceTerminacion || 0;
        this.avanceProduccion = parseInt(data.avanceProduccion || data.avance || 0, 10);
        this.observaciones = data.observaciones || '';
        this.mapaPuntos = data.mapaPuntos || []; // [{ x, y, defecto, lado }]
        this.fotos = data.fotos || [];
        this.auditor = data.auditor || '';
        this.email = data.email || data.correo || '';
        this.fecha = data.fecha || new Date().toISOString();
        this.firma = data.firma || data.firma_svg || '';
        this.gps = data.gps || null;
        this.localizacion = data.localizacion || (data.gps && typeof data.gps === 'object' ? JSON.stringify(data.gps) : '');
        this.aql = data.aql || null;
        this.novedadesAsociadas = parseNovedadesArray(data.novedadesAsociadas || data.novedades_auditoria);
        // Datos del Lote (maestro) que deben persistir en el reporte
        this.cuento = data.cuento || data.modulo || data.linea || '';
        this.linea = data.linea || data.cuento || data.modulo || '';
        this.proceso = data.proceso || data.PROCESO || '';
        this.prenda = data.prenda || data.tipoPrenda || data.descripcion || '';
        this.tipoPrenda = this.prenda;
        this.genero = data.genero || data.GENERO || '';
        this.tejido = data.tejido || data.TEJIDO || '';
        this.fechaSalida = data.fechaSalida || data.fecha_salida || data.salida || '';
        this.salida = this.fechaSalida;
        this.fechaEntrega = data.fechaEntrega || data.fecha_entrega || data.entrada || '';
        this.entrada = this.fechaEntrega;
        this.productora = data.productora || data.idProductora || '';
        this.idProductora = data.idProductora || data.productora || '';
    }
}

function tryParseJson(str, fallback) {
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

/**
 * Normaliza el valor de novedades de auditoría a un ARRAY plano de objetos.
 * Soporta:
 *   - Array JS directo
 *   - String JSON simple  `[{...}]`
 *   - String JSON doble-encodeado `"[{\"...}]"` (comillas externas escapadas)
 */
function parseNovedadesArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || raw.trim() === '') return [];
    let current = raw.trim();
    for (let i = 0; i < 3; i++) {
        try {
            const parsed = JSON.parse(current);
            if (Array.isArray(parsed)) return parsed;
            if (typeof parsed === 'string') {
                current = parsed; // una capa más de encoding → seguir desenrollando
                continue;
            }
            return [parsed];
        } catch (_) {
            return [];
        }
    }
    return [];
}
