export class ProgramacionItem {
    constructor(data = {}) {
        this.id = data.id || null;
        this.proveedor = data.proveedor || '';
        this.usuarioEditor = data.usuarioEditor || '';
        this.numlote = data.numlote || '';
        this.ref = data.ref || '';
        this.color = data.color || '';
        this.colores = data.colores || '';
        this.talla = data.talla || '';
        this.totalUnd = data.totalUnd || 0;
        this.fechaPrograma = data.fechaPrograma || null;
        this.observacion = data.observacion || '';
        this.createdAt = data.createdAt || null;
        this.updatedAt = data.updatedAt || null;
    }

    static fromRecord(record) {
        return new ProgramacionItem({
            id: record.id,
            proveedor: record.proveedor,
            usuarioEditor: record.usuario_editor,
            numlote: record.numlote,
            ref: record.ref,
            color: record.color,
            colores: record.colores,
            talla: record.talla,
            totalUnd: record.total_und,
            fechaPrograma: record.fecha_programa,
            observacion: record.observacion,
            createdAt: record.created_at,
            updatedAt: record.updated_at
        });
    }

    toJSON() {
        return {
            id: this.id,
            proveedor: this.proveedor,
            usuarioEditor: this.usuarioEditor,
            numlote: this.numlote,
            ref: this.ref,
            color: this.color,
            colores: this.colores,
            talla: this.talla,
            totalUnd: this.totalUnd,
            fechaPrograma: this.fechaPrograma,
            observacion: this.observacion,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}
