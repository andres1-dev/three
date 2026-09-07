/**
 * Constantes de mapeo de tablas en la base de datos y hojas de cálculo.
 */
export const TableNames = Object.freeze({
    USUARIOS: 'usuarios',
    PLANTAS: 'plantas',
    MASTER: 'master',
    VISITAS: 'visitas',
    NOVEDADES: 'novedades',
    REPORTES: 'reportes',
    APROBACIONES: 'aprobaciones'
});

export const MasterFieldMap = Object.freeze({
    id_master: 'LOTE',
    referencia: 'REFERENCIA',
    cantidad: 'CANTIDAD',
    nombre_planta: 'PLANTA',
    fecha_entrega: 'ENTRADA',
    fecha_salida: 'SALIDA',
    proceso: 'PROCESO',
    descripcion: 'PRENDA',
    cuento: 'LINEA',
    genero: 'GENERO',
    productora: 'PRODUCTORA'
});
