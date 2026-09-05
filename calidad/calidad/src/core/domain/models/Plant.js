/**
 * Entidad de Dominio: Planta / Taller Satélite
 */
export class Plant {
    constructor({
        id,
        nombre,
        nit = '',
        contacto = '',
        telefono = '',
        direccion = '',
        municipio = '',
        productora = '',
        email = '',
        correo = '',
        rol = 'GUEST',
        activo = true
    }) {
        this.id = String(id || nit || '');
        this.nombre = String(nombre || '').trim();
        this.nit = String(nit || id || '').trim();
        this.contacto = String(contacto || '').trim();
        this.telefono = String(telefono || '').trim();
        this.direccion = String(direccion || '').trim();
        this.municipio = String(municipio || '').trim();
        this.productora = String(productora || '').trim();
        this.email = String(email || correo || '').trim();
        this.correo = this.email;
        this.rol = String(rol || 'GUEST').trim();
        this.activo = Boolean(activo);
    }

    get displayName() {
        return this.nombre || 'Taller sin nombre';
    }

    static fromRecord(raw) {
        if (!raw) return null;
        return new Plant({
            id: raw.id || raw.ID || raw.id_planta || raw.ID_PLANTA,
            nombre: raw.nombre || raw.PLANTA || raw.planta || '',
            nit: raw.nit || raw.NIT || raw.id_planta || raw.ID_PLANTA || '',
            contacto: raw.contacto || raw.CONTACTO || '',
            telefono: raw.telefono || raw.TELEFONO || raw.tel || '',
            direccion: raw.direccion || raw.DIRECCION || raw.dir || '',
            municipio: raw.municipio || raw.MUNICIPIO || raw.ciudad || raw.CIUDAD || '',
            productora: raw.productora || raw.PRODUCTORA || raw.id_productora || raw.ID_PRODUCTORA || '',
            email: raw.email || raw.EMAIL || raw.correo || raw.CORREO || '',
            correo: raw.correo || raw.CORREO || raw.email || raw.EMAIL || '',
            rol: raw.rol || raw.ROL || 'GUEST',
            activo: raw.activo !== false && raw.ESTADO !== 'INACTIVO' && raw.rol !== 'DESHABILITADO'
        });
    }
}
