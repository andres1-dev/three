/* ==========================================================================
   config.js — Constantes globales y configuración de la aplicación
   ========================================================================== */

/**
 * Configuración dinámica: Las llaves se recuperan desde GAS para mayor seguridad.
 */
let CONFIG = {
    API_KEY: null,
    GEMINI_KEY: null,
    SPREADSHEET_ID: '1ZLGG8wfszE6D8vGwCECWguWGUiDXGUGfN87ZukyaCpo',
    FUNCTIONS_URL: 'https://doqsurxxxaudnutsydlk.supabase.co/functions/v1',
};

/**
 * Endpoint de Google Apps Script para guardar datos de formularios.
 * @readonly
 */
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbydiLxcTF1-zNzZoEmqAhPgHuj0GqrdfKYxUmZMQmVLq9XjPz4W7429YqA6DcBxEh_Z/exec';

/**
 * Definición de la hoja SISPRO (lectura de lotes).
 * - indices: posiciones de columna en la hoja original (A=0, B=1 …).
 * - headers: nombres lógicos que se asignan a cada índice.
 * @readonly
 */
const SHEET_SISPRO = Object.freeze({
    name: 'SISPRO',
    indices: [0, 1, 4, 9, 10, 12, 15, 16, 17, 18],
    headers: ['LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'PROCESO', 'PRENDA', 'LINEA', 'GENERO', 'TEJIDO'],
});

/**
 * Hojas destino para escritura de reportes vía GAS.
 * @readonly
 */
const SHEETS_DESTINO = Object.freeze({
    NOVEDADES: 'NOVEDADES',
    CALIDAD: 'REPORTES',
    PLANTAS: 'PLANTAS',
    RUTERO: 'RUTERO',
});

/**
 * Definición de lectura de datos de resultados (Novedades).
 * @readonly
 */
const SHEET_NOVEDADES = Object.freeze({
    name: 'NOVEDADES',
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    headers: ['ID_NOVEDAD', 'FECHA', 'LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'LINEA', 'PROCESO', 'PRENDA', 'GENERO', 'TEJIDO', 'AREA', 'DESCRIPCION', 'CANTIDAD_SOLICITADA', 'IMAGEN', 'ESTADO', 'CHAT', 'CHAT_READ', 'HISTORIAL_ESTADOS'],
});

/**
 * Definición de lectura de datos de Plantas.
 * @readonly
 */
const SHEET_PLANTAS = Object.freeze({
    name: 'PLANTAS',
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    headers: ['ID_PLANTA', 'PLANTA', 'DIRECCION', 'TELEFONO', 'EMAIL', 'ROL', 'PASSWORD', 'PAIS', 'DEPARTAMENTO', 'CIUDAD', 'BARRIO', 'COMUNA', 'CONTACTO', 'LOCALIZACION'],
});

/**
 * Definición de la hoja de Usuarios para control de acceso.
 * @readonly
 */
const SHEET_USUARIOS = Object.freeze({
    name: 'USUARIOS',
    indices: [0, 1, 2, 3, 4, 5],
    headers: ['ID_USUARIO', 'USUARIO', 'CORREO', 'TELEFONO', 'ROL', 'PASSWORD'],
});

/**
 * Definición de lectura de datos del Rutero (agenda de visitas).
 * @readonly
 */
const SHEET_RUTERO = Object.freeze({
    name: 'RUTERO',
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    headers: ['ID_VISITA', 'FECHA_VISITA', 'AUDITOR', 'PLANTA', 'LOTE', 'REFERENCIA', 'PROCESO', 'TIPO_VISITA', 'DESTINO', 'CANTIDAD', 'PRIORIDAD', 'ESTADO'],
});

/**
 * Definición de la hoja de Chat para trazabilidad profesional.
 * @readonly
 */
const SHEET_CHAT = Object.freeze({
    name: 'CHAT',
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    headers: ['ID_MSG', 'ID_NOVEDAD', 'LOTE', 'AUTOR_ID', 'AUTOR_NOMBRE', 'AUTOR_ROL', 'ENTIDAD', 'MENSAJE', 'IMAGEN_URL', 'IS_READ', 'READ_AT', 'TS'],
});

/**
 * Definición de lectura de datos de Reportes de Calidad.
 * @readonly
 */
const SHEET_REPORTES = Object.freeze({
    name: 'REPORTES',
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    headers: ['ID_REPORTE', 'FECHA', 'LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'LINEA', 'PROCESO', 'PRENDA', 'GENERO', 'TEJIDO', 'EMAIL', 'LOCALIZACION', 'TIPO_VISITA', 'CONCLUSION', 'OBSERVACIONES', 'SOPORTE'],
});

/* ── Hojas inactivas (reservadas para uso futuro) ──────────────────────── */
// const SHEET_PLANTA  = { name: 'PLANTA',  indices: [0,1,11,12,13,27], headers: [...] };
// const SHEET_PROCESO = { name: 'PROCESO', indices: [3,1,5,7,11,13,8], headers: [...] };

/**
 * Logos disponibles para el carrusel de logo.
 * @readonly
 */
const LOGOS = Object.freeze([
    'icons/icon-any.svg',
    'https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif',
    'https://i.ibb.co/jr1GBKy/ORCAGIFS-imageonline-co-47703-1.png',
]);

/**
 * Tabla de tiempos estándar por tipo de prenda (en minutos por unidad).
 * Usado para calcular la duración estimada de producción.
 * @readonly
 */
const TIEMPOS_ESTANDAR = Object.freeze({
    'PONDERADO': 3.305529098,
    'BERMUDAS': 4.017798947,
    'BLUSAS': 2.515552488,
    'BLUSON': 4.306159420,
    'BODYS': 2.262587461,
    'BOXER': 2.591673447,
    'BUSOS': 2.538940810,
    'CACHETEROS': 3.221211615,
    'CAMISAS': 3.999113475,
    'CAMISERAS': 3.344144775,
    'CAMISETAS': 3.016851856,
    'CAMISILLA': 2.759092546,
    'CAPRIS': 3.315842583,
    'CHALECOS': 5.219512195,
    'CHAQUETAS': 5.360796240,
    'COBIJAS': 5.716312057,
    'CONJUNTOS': 2.688240656,
    'DRIL': 4.590707737,
    'ENTERIZO': 2.700751151,
    'FALDA SHORT': 3.565884477,
    'FALDAS': 4.169666427,
    'JARDINERAS, BRAGAS,': 6.453628669,
    'JEANS': 5.875752866,
    'JOGGERS': 3.895650107,
    'PANTALONES': 4.590707737,
    'PANTALONETAS': 3.666817156,
    'PIJAMAS': 2.828299070,
    'ROPA_INTERIOR': 2.231779086,
    'SHORT': 3.886782776,
    'SOBREPUESTOS': 2.611275043,
    'SUDADERA': 4.012906625,
    'TOP CROP': 1.570914479,
    'TRAJE_DE_BAÑO': 3.565270936,
    'VESTIDOS': 3.565270936
});

/**
 * Calcula la duración estimada de producción basada en el tipo de prenda y cantidad.
 * Fórmula: (PONDERADO × CANTIDAD) / 60 = minutos totales
 * 
 * @param {string} prenda - Tipo de prenda
 * @param {number} cantidad - Cantidad de unidades
 * @returns {Object} Objeto con días, horas, minutos, segundos y totalMinutos
 */
function calcularDuracionProduccion(prenda, cantidad) {
    if (!prenda || !cantidad || cantidad <= 0) {
        return { dias: 0, horas: 0, minutos: 0, segundos: 0, totalMinutos: 0 };
    }

    // Normalizar nombre de prenda (mayúsculas, sin espacios extra)
    const prendaNormalizada = prenda.toString().trim().toUpperCase();
    
    // Buscar tiempo estándar exacto
    let ponderado = TIEMPOS_ESTANDAR[prendaNormalizada];
    
    // Si no encuentra coincidencia exacta, usar PONDERADO por defecto
    if (!ponderado) {
        ponderado = TIEMPOS_ESTANDAR['PONDERADO'];
    }

    // Calcular duración total en minutos: (PONDERADO × CANTIDAD) / 60
    const totalMinutos = (ponderado * cantidad) / 60;
    
    // Convertir a días, horas, minutos, segundos
    const dias = Math.floor(totalMinutos / 1440); // 1440 min = 1 día
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = Math.floor(totalMinutos % 60);
    const segundos = Math.floor((totalMinutos % 1) * 60);

    return {
        dias,
        horas,
        minutos,
        segundos,
        totalMinutos: Math.round(totalMinutos * 100) / 100 // Redondear a 2 decimales
    };
}

/* ==========================================================================
   Sistema de notificaciones push eliminado - ya no se usa en la aplicación
   ========================================================================== */
