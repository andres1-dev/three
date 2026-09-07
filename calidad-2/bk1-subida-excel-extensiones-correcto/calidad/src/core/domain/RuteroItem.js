/**
 * Modelo de Dominio: RuteroItem
 */
export class RuteroItem {
    constructor(data = {}) {
        this.lote = data.lote || '';
        this.op = data.op || this.lote;
        this.planta = data.planta || '';
        this.modulo = data.modulo || '';
        this.linea = data.linea || '';
        this.referencia = data.referencia || '';
        this.cantidad = parseInt(data.cantidad || 0, 10);
        this.fechaVisita = data.fechaVisita || '';
        this.tipoVisita = data.tipoVisita || 'PROGRAMADA';
        this.destino = data.destino || '';
        this.observaciones = data.observaciones || '';
        this.auditor = data.auditor || '';
        this.creadoEn = data.creadoEn || new Date().toISOString();
    }
}
