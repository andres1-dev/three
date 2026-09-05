/**
 * Utilidad de Generación de Plantillas de Redacción para Calidad
 * Traducido y optimizado desde plantillasCalidad.js legacy
 */

export function normalizarPrenda(prenda) {
    if (!prenda) return "prenda";
    let p = prenda.trim().toLowerCase();

    const normas = {
        'bodys': 'body', 'body': 'body',
        'pantalones': 'pantalón', 'pantalon': 'pantalón', 'pantalón': 'pantalón',
        'croptops': 'croptop', 'croptop': 'croptop',
        'camisetas': 'camiseta', 'camiseta': 'camiseta',
        'blusas': 'blusa', 'blusa': 'blusa',
        'faldas': 'falda', 'falda': 'falda',
        'chaquetas': 'chaqueta', 'chaqueta': 'chaqueta',
        'shorts': 'short', 'short': 'short',
        'pantalonetas': 'pantaloneta', 'pantaloneta': 'pantaloneta',
        'jeans': 'jean', 'jean': 'jean',
        'enterizos': 'enterizo', 'enterizo': 'enterizo',
        'buzos': 'buzo', 'buzo': 'buzo',
        'vestidos': 'vestido', 'vestido': 'vestido',
        'sacos': 'saco', 'saco': 'saco',
        'leggings': 'legging', 'legging': 'legging',
        'tops': 'top', 'top': 'top',
        'camisas': 'camisa', 'camisa': 'camisa',
        'overoles': 'overol', 'overol': 'overol',
        'pajamas': 'pijama', 'pijama': 'pijama', 'pijamas': 'pijama'
    };

    if (normas[p]) return normas[p];

    if (p.endsWith('s') && p.length > 3) {
        if (p.endsWith('es') && !p.endsWith('les')) return p.slice(0, -2);
        return p.slice(0, -1);
    }

    return p;
}

export function generarTextoPlantillaCalidad({
    tipoVisita = 'AUDITORIA',
    conclusion = 'APROBADO',
    lote = null,
    avance = 50,
    muestra = 0,
    destino = ''
}) {
    const pNom = lote?.planta || 'la planta';
    const op = lote?.lote || lote?.op || 'OP';
    const ref = lote?.referencia || 'referencia';
    const prenda = normalizarPrenda(lote?.tipoPrenda || 'prenda');

    if (tipoVisita === 'AUDITORIA') {
        if (conclusion === 'APROBADO') {
            return `Se realiza auditoría final de calidad a la OP ${op} (${ref} - ${prenda}) en ${pNom}. Se inspecciona un muestreo representativo de ${muestra || 50} unidades bajo norma AQL, encontrando conformidades en costuras, simetría y acabados. El lote queda APROBADO ${destino ? 'con destino a ' + destino : 'para continuar su flujo operativo'}.`;
        } else if (conclusion === 'RECHAZADO') {
            return `Se realiza auditoría a la OP ${op} (${ref}) en ${pNom}. Tras la inspección del muestreo de ${muestra || 50} prendas, se identifican no conformidades que superan el límite de aceptación AQL. El lote queda RECHAZADO y retenido en planta para reproceso y corrección.`;
        } else {
            return `Se realiza auditoría a la OP ${op} en ${pNom}. La inspección queda en estado PAUSADO a la espera de ajustes en confección y verificación de insumos.`;
        }
    } else if (tipoVisita === 'RONDA') {
        return `Se realiza visita de ronda y seguimiento a la OP ${op} (${ref} - ${prenda}) en ${pNom}. Se evidencia un avance de producción aproximado del ${avance}%. Se verifican operaciones críticas de ensamble y calibración de maquinaria.`;
    } else if (tipoVisita === 'CONTRAMUESTRA') {
        return `Se realiza revisión de contramuestra para la OP ${op} (${ref}) en ${pNom}. Se evalúa confección de primeras prendas cotejando medidas y ficha técnica con un avance de línea del ${avance}%.`;
    } else {
        return `Se realiza visita de seguimiento técnico a la OP ${op} en ${pNom}, revisando compromisos y estado general del lote.`;
    }
}
