/**
 * Modelo de Dominio: Novedad
 */
export class Novedad {
    constructor(data = {}) {
        this.lote = data.lote || '';
        this.op = data.op || this.lote;
        this.planta = data.planta || '';
        this.modulo = data.modulo || '';
        this.linea = data.linea || '';
        this.referencia = data.referencia || '';
        this.proceso = data.proceso || '';
        this.area = data.area || '';
        this.tipoNovedad = data.tipoNovedad || '';
        this.cantidadTotal = Number(data.cantidadTotal || data.cantidad_total || data.cantidad || 0);
        this.cantidadSolicitada = Number(data.cantidadSolicitada || data.cantidad_solicitada || 0);
        this.cantidad = this.cantidadTotal;
        this.prenda = data.prenda || data.tipoPrenda || data.descripcion || '';
        this.genero = data.genero || '';
        this.tejido = data.tejido || null;
        this.cuento = data.cuento || data.modulo || data.linea || null;
        this.salida = data.salida || data.fecha_salida || null;
        this.productora = data.productora || 1;
        this.causa = data.causa || '';
        this.solicitud = data.solicitud || '';
        this.insumos = data.insumos || [];       // [{ tipo, cantidad }]
        this.cortes = data.cortes || [];         // [{ tipo, cantidad }]
        this.telas = data.telas || [];           // [{ tipo, cantidad }]
        this.codigos = data.codigos || [];       // [{ talla, color, cantidad }]
        this.codigosTipoSolicitud = data.codigosTipoSolicitud || '';
        this.observaciones = data.observaciones || '';
        this.fotos = data.fotos || [];           // [{ base64, mimeType, fileName }]
        this.auditor = data.auditor || '';
        this.fecha = data.fecha || '';
    }
}
