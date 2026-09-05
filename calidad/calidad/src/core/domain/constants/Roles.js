/**
 * Roles del sistema y sus metadatos visuales/jerárquicos.
 * Totalmente puro y sin dependencias de librerías.
 */
export const Roles = Object.freeze({
    ADMIN: 'ADMIN',
    MODERATOR: 'MODERATOR',
    USER_P: 'USER-P',    // Producción
    USER_C: 'USER-C',    // Calidad
    USER_I: 'USER-I',    // Ingreso
    GUEST: 'GUEST',      // Taller
    PENDIENTE: 'PENDIENTE',
    DESHABILITADO: 'DESHABILITADO'
});

export const RoleMetadata = Object.freeze({
    [Roles.ADMIN]: {
        label: 'Administrador',
        badgeClass: 'badge-admin',
        gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#6366f1'
    },
    [Roles.MODERATOR]: {
        label: 'Moderador',
        badgeClass: 'badge-moderator',
        gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
        color: '#3b82f6'
    },
    [Roles.USER_P]: {
        label: 'Producción',
        badgeClass: 'badge-production',
        gradient: 'linear-gradient(135deg, #10b981, #059669)',
        color: '#10b981'
    },
    [Roles.USER_C]: {
        label: 'Calidad',
        badgeClass: 'badge-quality',
        gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
        color: '#06b6d4'
    },
    [Roles.USER_I]: {
        label: 'Ingreso',
        badgeClass: 'badge-production',
        gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
        color: '#22c55e'
    },
    [Roles.GUEST]: {
        label: 'Taller / Planta',
        badgeClass: 'badge-guest',
        gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: '#f59e0b'
    },
    [Roles.PENDIENTE]: {
        label: 'Pendiente',
        badgeClass: 'badge-inactive',
        gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
        color: '#f97316'
    },
    [Roles.DESHABILITADO]: {
        label: 'Inactivo',
        badgeClass: 'badge-inactive',
        gradient: 'linear-gradient(135deg, #94a3b8, #64748b)',
        color: '#94a3b8'
    }
});
