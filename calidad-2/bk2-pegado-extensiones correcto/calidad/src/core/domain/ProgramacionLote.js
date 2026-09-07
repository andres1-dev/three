/**
 * Modelo de Dominio: Programación de Lote (Módulo NUBE).
 * Agrupa las extensiones (color × talla × cantidad) por Referencia + OP.
 */
export class ProgramacionLote {
    constructor({
        referencia = '',
        op = 0,
        extensiones = []
    } = {}) {
        this.referencia = String(referencia || '').trim();
        this.op = Number(op || 0);
        this.extensiones = (extensiones || []).map(e => ({
            color: String(e.color || '').trim(),
            talla: String(e.talla || '').trim(),
            cantidad: Number(e.cantidad || 0)
        }));
    }

    get totalUnidades() {
        return this.extensiones.reduce((acc, e) => acc + e.cantidad, 0);
    }

    get totalColores() {
        return new Set(this.extensiones.map(e => e.color)).size;
    }

    get tallas() {
        return [...new Set(this.extensiones.map(e => e.talla))];
    }

    static fromRecord(raw) {
        return new ProgramacionLote(raw);
    }
}