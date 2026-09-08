/**
 * Tiempos Estándar de Producción por Tipo de Prenda (dominio puro).
 * Migrado 1:1 desde legacy `migracion [ Imput ]/public/js/config.js` (TIEMPOS_ESTANDAR).
 * Unidad: minutos por unidad (min/ud). Usado para calcular la duración estimada de producción.
 *
 * Regla de dependencia: código puro — sin DOM ni framework (core/domain).
 */

export const TIEMPOS_ESTANDAR = Object.freeze({
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
 * Resuelve el tiempo estándar (min/ud) de un tipo de prenda.
 * Si no hay coincidencia exacta en la tabla, usa el PONDERADO general (igual que legacy).
 * @param {string} prenda - Tipo de prenda (ej. 'CAMISETAS')
 * @returns {{ minPorUnidad: number, exacto: boolean, clave: string }}
 */
export function getTiempoPrenda(prenda) {
    if (!prenda) {
        return { minPorUnidad: TIEMPOS_ESTANDAR['PONDERADO'], exacto: false, clave: 'PONDERADO' };
    }
    const clave = prenda.toString().trim().toUpperCase();
    const valor = TIEMPOS_ESTANDAR[clave];
    if (valor) {
        return { minPorUnidad: valor, exacto: true, clave };
    }
    return { minPorUnidad: TIEMPOS_ESTANDAR['PONDERADO'], exacto: false, clave: 'PONDERADO' };
}

/**
 * Calcula la duración estimada de producción (fórmula legacy):
 * totalMinutos = (tiempoPorPrenda × cantidad) / 60
 *
 * @param {string} prenda - Tipo de prenda
 * @param {number} cantidad - Cantidad de unidades
 * @returns {{ dias: number, horas: number, minutos: number, segundos: number, totalMinutos: number, texto: string }}
 */
export function calcularDuracionProduccion(prenda, cantidad) {
    if (!prenda || !cantidad || cantidad <= 0) {
        return { dias: 0, horas: 0, minutos: 0, segundos: 0, totalMinutos: 0, texto: 'N/A' };
    }

    const { minPorUnidad } = getTiempoPrenda(prenda);
    const totalMinutos = (minPorUnidad * cantidad) / 60;

    const dias = Math.floor(totalMinutos / 1440);
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = Math.floor(totalMinutos % 60);
    const segundos = Math.floor((totalMinutos % 1) * 60);

    const partes = [];
    if (dias > 0) partes.push(`${dias} d`);
    if (horas > 0) partes.push(`${horas} h`);
    if (minutos > 0) partes.push(`${minutos} min`);
    const texto = partes.length ? partes.join(' ') : `${segundos} seg`;

    return {
        dias,
        horas,
        minutos,
        segundos,
        totalMinutos: Math.round(totalMinutos * 100) / 100,
        texto
    };
}