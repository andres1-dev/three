import { Roles, RoleMetadata } from '../constants/Roles.js';

/**
 * Entidad de Dominio: Usuario
 */
export class User {
    constructor({
        id,
        cedula,
        nombre,
        email,
        rol = Roles.GUEST,
        planta = '',
        productora = '',
        cargo = '',
        area = '',
        telefono = '',
        cumpleanos = '',
        fotoUrl = '',
        portadaUrl = '',
        activo = true,
        fechaIngreso = '',
        departamento = '',
        ciudad = '',
        pais = 'Colombia',
        sede = '',
        direccion = '',
        barrio = '',
        antiguedad = '',
        estadoPersonalizado = '',
        idProductora = null
    }) {
        this.id = id || cedula;
        this.cedula = String(cedula || '').trim();
        this.nombre = (nombre || '').trim();
        this.email = (email || '').toLowerCase().trim();
        this.rol = (rol || Roles.GUEST).toUpperCase();
        this.planta = (planta || '').trim();
        this.productora = (productora || '').trim();
        this.cargo = (cargo || '').trim();
        this.area = (area || '').trim();
        this.telefono = (telefono || '').trim();
        this.cumpleanos = cumpleanos;
        this.fotoUrl = fotoUrl;
        this.portadaUrl = portadaUrl;
        this.activo = Boolean(activo);
        this.fechaIngreso = fechaIngreso;
        this.departamento = departamento;
        this.ciudad = ciudad;
        this.pais = pais || 'Colombia';
        this.sede = sede;
        this.direccion = direccion;
        this.barrio = barrio;
        this.antiguedad = antiguedad;
        this.estadoPersonalizado = estadoPersonalizado || '';
        this.idProductora = idProductora;
    }

    get displayName() {
        return this.nombre || this.email.split('@')[0] || 'Usuario';
    }

    get initials() {
        const parts = this.displayName.split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return this.displayName.slice(0, 2).toUpperCase();
    }

    get roleMetadata() {
        return RoleMetadata[this.rol] || RoleMetadata[Roles.GUEST] || {
            label: this.rol || 'Colaborador',
            badgeClass: 'badge-guest',
            gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#6366f1'
        };
    }

    get isAdmin() {
        return this.rol === Roles.ADMIN;
    }

    get isModerator() {
        return this.rol === Roles.MODERATOR || this.rol === Roles.ADMIN;
    }

    get canManageUsers() {
        return this.isAdmin || this.isModerator;
    }

    /**
     * Factory para construir usuario desde registro Supabase / Edge Functions / Legacy
     */
    static fromRecord(raw) {
        if (!raw) return null;

        // La cédula es el documento de identidad colombiano (nunca el UUID de Auth)
        let candidateCedula = raw.cedula ?? raw.CEDULA ?? '';
        if (typeof candidateCedula === 'string') {
            candidateCedula = candidateCedula.trim();
            if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(candidateCedula) || candidateCedula.length > 20) {
                candidateCedula = '';
            }
        } else {
            candidateCedula = String(candidateCedula);
        }

        const authId = raw.id || raw.ID || raw.auth_user_id || '';

        return new User({
            id: authId || candidateCedula,
            cedula: candidateCedula,
            nombre: raw.nombre || raw.USUARIO || raw.full_name || raw.name || '',
            email: raw.email || raw.EMAIL || raw.correo || raw.CORREO || '',
            rol: raw.rol || raw.ROL || raw.role || Roles.GUEST,
            planta: raw.planta || raw.PLANTA || raw.nombrePlanta || '',
            productora: raw.productora || raw.PRODUCTORA || '',
            cargo: raw.cargo || raw.CARGO || '',
            area: raw.area || raw.AREA || '',
            telefono: raw.telefono || raw.TELEFONO || raw.phone || '',
            cumpleanos: raw.cumpleanos || raw.CUMPLEAÑOS || raw.cumpleaños || raw.fecha_nacimiento || raw.FECHA_NACIMIENTO || '',
            fotoUrl: raw.foto_url || raw.FOTO_URL || raw.avatar_url || raw.avatar || '',
            portadaUrl: raw.portada_url || raw.PORTADA_URL || '',
            activo: raw.activo !== false && raw.ESTADO !== 'DESHABILITADO',
            fechaIngreso: raw.fecha_ingreso || raw.FECHA_INGRESO || raw.fecha_contratacion || raw.FECHA_CONTRATACION || '',
            departamento: raw.departamento || raw.DEPARTAMENTO || '',
            ciudad: raw.ciudad || raw.CIUDAD || '',
            pais: raw.pais || raw.PAIS || 'Colombia',
            sede: raw.sede || raw.SEDE || '',
            direccion: raw.direccion || raw.DIRECCION || '',
            barrio: raw.barrio || raw.BARRIO || '',
            antiguedad: raw.antiguedad || raw.ANTIGUEDAD || '',
            estadoPersonalizado: raw.estado_personalizado || raw.estadoPersonalizado || '',
            idProductora: raw.id_productora || raw.ID_PRODUCTORA || null
        });
    }
}
