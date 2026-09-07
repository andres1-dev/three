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
        this.destino = data.destino || '';
        this.destinoOtro = data.destinoOtro || '';
        this.avanceCorte = data.avanceCorte || 0;
        this.avanceConfeccion = data.avanceConfeccion || 0;
        this.avanceTerminacion = data.avanceTerminacion || 0;
        this.observaciones = data.observaciones || '';
        this.mapaPuntos = data.mapaPuntos || []; // [{ x, y, defecto, lado }]
        this.fotos = data.fotos || [];
        this.auditor = data.auditor || '';
        this.fecha = data.fecha || new Date().toISOString();
    }
}
