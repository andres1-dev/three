/**
 * Modelo de Dominio: Lote
 * Mapea íntegramente todas las propiedades de la tabla `master` en Supabase y hojas legacy.
 */
export class Lote {
    constructor(data = {}) {
        this.lote = (data.id_master || data.LOTE || data.lote || data.OP || data.op || '').toString().trim();
        this.op = (data.op || data.OP || this.lote).toString().trim();
        this.referencia = (data.referencia || data.REFERENCIA || data.REF || '').toString().trim();
        this.planta = (data.nombre_planta || data.PLANTA || data.planta || '').toString().trim();
        this.descripcion = (data.descripcion || data.DESCRIPCION || data.PRENDA || data.prenda || '').toString().trim();
        this.tipoPrenda = (data.descripcion || data.tipoPrenda || data.TIPO_PRENDA || data.PRENDA || data.prenda || '').toString().trim();
        this.prenda = this.tipoPrenda;
        this.cantidad = parseInt(data.cantidad || data.CANTIDAD || 0, 10);
        this.linea = (data.cuento || data.LINEA || data.linea || data.modulo || data.MODULO || '').toString().trim();
        this.modulo = (data.modulo || data.MODULO || this.linea).toString().trim();
        this.proceso = (data.proceso || data.PROCESO || '').toString().trim();
        this.genero = (data.genero || data.GENERO || '').toString().trim();
        this.tejido = (data.tejido || data.TEJIDO || '').toString().trim();
        this.fechaEntrega = data.fecha_entrega || data.ENTRADA || data.entrada || '';
        this.entrada = this.fechaEntrega;
        this.fechaSalida = data.fecha_salida || data.SALIDA || data.salida || '';
        this.salida = this.fechaSalida;
        this.productora = (data.productora || data.PRODUCTORA || '').toString().trim();
        this.idProductora = (data.productora || data.id_productora || data.ID_PRODUCTORA || '').toString().trim();
        this.sam = parseFloat(data.sam || data.SAM || 0);
        this.cliente = (data.cliente || data.CLIENTE || '').toString().trim();
        this.marca = (data.marca || data.MARCA || '').toString().trim();
        this.estado = (data.estado || data.ESTADO || 'ACTIVO').toString().trim();
        this.raw = data;
    }

    get resumenTexto() {
        return `${this.lote} - ${this.referencia} (${this.planta})`;
    }
}
