/**
 * ProgramacionEngine — Lógica pura del Módulo NUBE (Programación de Taller).
 * Migrado desde legacy `migracion [ Imput ]/map/js/views/programacionView.js`.
 * Código 100% funcional: sin DOM. Todas las funciones reciben/retornan datos.
 *
 * Mapeo oficial de columnas del tablero pegado (Letra e Índice 0-based):
 *   G (6)  → NUMLOTE   · H (7) → REF   · I (8) → COLOR
 *   J (9)  → COLORES   · K (10)→ TALLA · L (11)→ TOTAL UND
 *
 * Tipos de upload soportados:
 *   - EXTENSIONES: Programación de taller (curva de tallas)
 *   - CONFECCION: Lotes de confección (master)
 *   - PROCESOS: Lotes de procesos (master)
 */

export const MAPPED_COLUMNS = Object.freeze([
    { key: 'numlote',  letter: 'G', defaultIdx: 6,  label: 'NUMLOTE',   required: true,  color: '#4f46e5' },
    { key: 'ref',      letter: 'H', defaultIdx: 7,  label: 'REF',       required: true,  color: '#0284c7' },
    { key: 'colores',  letter: 'J', defaultIdx: 9,  label: 'COLORES',   required: true,  color: '#7c3aed' },
    { key: 'talla',    letter: 'K', defaultIdx: 10, label: 'TALLA',     required: true,  color: '#db2777' },
    { key: 'totalUnd', letter: 'L', defaultIdx: 11, label: 'TOTAL UND', required: true,  color: '#ea580c' }
]);

// Headers de referencia para detección automática de tipo de upload
export const HEADER_SETS = Object.freeze({
    CONFECCION: [
        'Ubicacion', 'Nombre', 'Numlote', 'Marca', 'Ref', 'desclarga', 'Col', 'RefExt', 'Total',
        'FechaSalda', 'FechaEntrada', 'Nombre2', 'Telefono', 'Celular', 'Direccion', 'Ciudad',
        'Encargado', 'NumPed', 'FechaDespacho', 'Cuento', 'Obs Salida', 'Costo Conf+Term',
        'Valor a Pagar', 'Inv Muestras', 'Linea', 'Categoria de Producto'
    ],
    PROCESOS: [
        'Coleccion', 'Ref', 'RefExt', 'NumLote', 'emp', 'Total', 'Vt', 'Planta', 'Proceso',
        'doc', 'Obs', 'FechaSal', 'FechaEntrega', 'Cuento', 'Categoria', 'Linea', 'Cant Minutos'
    ],
    GENERAL_TDM: [
        'OP', 'InvPlanta', 'NombrePlanta', 'FSalidaConf', 'FEntregaConf', 'Proceso', 'Descripcion',
        'Cuento', 'Genero', 'OS', 'TS', 'Costo', 'Ref', 'Tipo Tejido', 'pvp'
    ]
});

const HEADER_PATTERN = /^(ubicacion|nombre2?|telefono|direccion|ciudad|numlote|num(\.|º)?\s*lote|lote|n[ºo]|op|referen|refext|ref|color(es)?|talla|total(\s*und)?|codplanta|coleccion|descarga|f[\s._-]*(salida|entrega)|observacion|emp|zona|categoria|linea|celular|numpedcliente|ordcompped|erp)/i;

/** Filtra filas válidas: descarta títulos, totales y encabezados repetidos. */
export function filterValidDataRows(rows) {
    return rows.filter(row => {
        if (!row || !row.length) return false;
        const nonBlank = row.filter(c => String(c).trim() !== '');
        if (nonBlank.length < 2) return false;

        const fullText = row.join(' ').toLowerCase();
        if (fullText.includes('informaci') || fullText.includes('calculo de capacidad') || fullText.includes('cálculo')) return false;

        const hasNumericValue = row.slice(0, 12).some(c => /^\d{1,6}$/.test(String(c || '').trim()));
        if (!hasNumericValue) return false;

        const firstNonBlank = String(nonBlank[0] || '').trim();
        if (HEADER_PATTERN.test(firstNonBlank)) return false;

        return true;
    });
}

/** Parsea tablas HTML del portapapeles (Gmail, Outlook, Excel Web). */
export function parseHTMLTable(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const tables = doc.querySelectorAll('table');
    if (!tables.length) return null;

    let bestMatrix = [];
    tables.forEach(t => {
        const trs = Array.from(t.querySelectorAll('tr'));
        const matrix = trs.map(tr => {
            const cells = Array.from(tr.querySelectorAll('th, td'));
            return cells.map(c => (c.innerText || c.textContent || '').trim());
        }).filter(r => r.some(c => c !== ''));
        if (matrix.length > bestMatrix.length) bestMatrix = matrix;
    });

    if (bestMatrix.length < 2) return null;

    let headerIdx = -1;
    for (let i = 0; i < bestMatrix.length; i++) {
        const r = bestMatrix[i];
        if (r.some(c => /^(ubicacion|nombre|telefono|direccion|ciudad|numlote|lote|n[ºo]|op|referen|ref\b|color|talla|total|codplanta|coleccion|descarga|f[\s._-]*(salida|entrega)|observacion|emp|zona|categoria|linea)/i.test(c))) {
            headerIdx = i;
            break;
        }
    }

    const headers = headerIdx >= 0 ? bestMatrix[headerIdx] : bestMatrix[0].map((_, i) => `Columna ${i + 1}`);
    const candidateRows = headerIdx >= 0 ? bestMatrix.slice(headerIdx + 1) : bestMatrix;
    const grid = filterValidDataRows(candidateRows);
    if (!grid.length) return null;

    return { headers, grid, mapping: autoDetectMapping(headers, grid) };
}

/** Parsea formato tabular TSV / CSV (tabs o punto y coma). */
export function parseTabularLines(lines) {
    const splitLine = l => l.split(/\t|;/).map(c => c.trim());
    const matrix = lines.map(splitLine).filter(r => r.some(c => c !== ''));
    if (!matrix.length) return null;

    let headerIdx = -1;
    for (let i = 0; i < matrix.length; i++) {
        const r = matrix[i];
        if (r.some(c => /^(ubicacion|numlote|num(\.|º)?\s*lote|lote|n[ºo]\s*(de)?\s*op|referen|ref\b|color|talla|total\s*und|codplanta|coleccion|descarga|observacion|categoria|linea)/i.test(c))) {
            headerIdx = i;
            break;
        }
    }

    let headers;
    if (headerIdx >= 0) {
        headers = matrix[headerIdx];
    } else if (matrix[0].some(c => /^(ubicacion|n[ºo]|op|numlote|lote|ref|color|talla|total|cant|sesgo|muestra|taller)/i.test(c))) {
        headers = matrix[0];
        headerIdx = 0;
    } else {
        headers = matrix[0].map((_, i) => `Columna ${i + 1}`);
    }

    const candidateRows = headerIdx >= 0 ? matrix.slice(headerIdx + 1) : matrix;
    const grid = filterValidDataRows(candidateRows);
    if (!grid.length) return null;

    return { headers, grid, mapping: autoDetectMapping(headers, grid) };
}

/** Detección automática de mapeo de columnas → clave de MAPPED_COLUMNS. */
export function autoDetectMapping(headers, grid) {
    const colMapping = {};
    const usedKeys = new Set();

    // 1. Tablero estándar A..W (15+ columnas): mapa exacto por posición
    if (headers.length >= 15 || grid.some(r => r.length >= 15)) {
        MAPPED_COLUMNS.forEach(col => {
            colMapping[col.defaultIdx] = col.key;
            usedKeys.add(col.key);
        });
        return colMapping;
    }

    // 2. Coincidencia inteligente por texto de encabezado
    headers.forEach((hdr, colIdx) => {
        const h = String(hdr).toLowerCase().trim();
        for (const col of MAPPED_COLUMNS) {
            if (usedKeys.has(col.key)) continue;
            let match = false;
            if (col.key === 'numlote' && (/^numlote$/.test(h) || /^(num(\.|º)?\s*)?lote$/.test(h) || h.includes('lote'))) match = true;
            else if (col.key === 'ref' && (/^ref/.test(h) && !h.includes('refext'))) match = true;
            else if (col.key === 'color' && /^colors?$/.test(h)) match = true;
            else if (col.key === 'colores' && h.includes('colores')) match = true;
            else if (col.key === 'talla' && h.includes('talla')) match = true;
            else if (col.key === 'totalUnd' && (h.includes('total') || h.includes('und'))) match = true;
            if (match) {
                colMapping[colIdx] = col.key;
                usedKeys.add(col.key);
                break;
            }
        }
    });

    // 3. Fallback por posición
    MAPPED_COLUMNS.forEach(col => {
        if (!usedKeys.has(col.key) && col.defaultIdx < headers.length) {
            colMapping[col.defaultIdx] = col.key;
            usedKeys.add(col.key);
        }
    });

    return colMapping;
}

/** Filas planas mapeadas: [{ NUMLOTE, REF, COLOR, COLORES, TALLA, 'TOTAL UND' }] */
export function exportMappedRows(headers, grid, mapping) {
    const exportMap = [];
    MAPPED_COLUMNS.forEach(col => {
        const colIdx = Object.keys(mapping).find(idx => mapping[idx] === col.key);
        if (colIdx !== undefined) {
            exportMap.push({ key: col.key, label: col.label, colIdx: parseInt(colIdx, 10) });
        }
    });

    return grid.map(row => {
        const obj = {};
        exportMap.forEach(m => {
            obj[m.label] = row[m.colIdx] !== undefined ? row[m.colIdx] : '';
        });
        return obj;
    });
}

/**
 * Construye el JSON agrupado: [{ referencia, op, extensiones: [{ color, talla, cantidad }] }]
 * Agrupa por OP (Numlote) + Referencia; suma repeticiones de color+talla.
 */
export function buildProgramacionJSON(headers, grid, mapping) {
    const flat = exportMappedRows(headers, grid, mapping);
    const result = [];
    const groups = new Map();

    flat.forEach(row => {
        const opNum = parseInt(String(row['NUMLOTE'] || '').trim(), 10);
        const op = isNaN(opNum) ? 0 : opNum;
        const referencia = String(row['REF'] || '').trim();
        const color = String(row['COLORES'] || row['COLOR'] || '').trim();
        const talla = String(row['TALLA'] || '').trim();
        const cantNum = parseInt(String(row['TOTAL UND'] || '').trim(), 10);
        const cantidad = isNaN(cantNum) ? 0 : cantNum;

        const groupKey = op + '|' + referencia.toUpperCase();
        if (!groups.has(groupKey)) {
            const group = { referencia, op, extensiones: [] };
            groups.set(groupKey, group);
            result.push(group);
        }

        const group = groups.get(groupKey);
        const existing = group.extensiones.find(e =>
            e.color.toUpperCase() === color.toUpperCase() && e.talla.toUpperCase() === talla.toUpperCase()
        );

        if (existing) {
            existing.cantidad += cantidad;
        } else {
            group.extensiones.push({ color, talla, cantidad });
        }
    });

    result.forEach(g => g.extensiones.sort((a, b) => (a.color !== b.color) ? a.color.localeCompare(b.color) : a.talla.localeCompare(b.talla)));
    result.sort((a, b) => (a.referencia !== b.referencia) ? a.referencia.localeCompare(b.referencia) : a.op - b.op);
    return result;
}

/**
 * Valida la posición de las columnas obligatorias del portapapeles (o CSV tabular):
 *   - Columna G (índice 6)  → NUMLOTE / OP
 *   - Columna H (índice 7)  → REF / Referencia
 *   - Columna I/J (índices 8/9) → COLOR / COLORES
 *   - Columna K (índice 10) → TALLA
 *   - Columna L (índice 11) → TOTAL UND
 */
export function validateClipboardPositions(headers, grid) {
    if (!headers || !headers.length) {
        return { valid: false, error: 'No se detectaron datos ni encabezados en el portapapeles.' };
    }

    // Debe tener al menos 12 columnas (A..L)
    const totalCols = Math.max(headers.length, ...(grid && grid.length ? [grid[0].length] : [0]));
    if (totalCols < 12) {
        return {
            valid: false,
            error: `La tabla pegada tiene solo ${totalCols} columna(s). Se requieren mínimo 12 columnas (A..L) para la posición oficial del tablero.`
        };
    }

    const isAutoGenerated = headers.every((h, i) => h === `Columna ${i + 1}`);
    if (isAutoGenerated) {
        return {
            valid: false,
            error: 'No se detectó la fila de encabezados en la tabla pegada. Copia la tabla incluyendo los encabezados (Col. G=NUMLOTE, Col. H=REF, etc.).'
        };
    }

    const hNumlote = String(headers[6] || '').trim();
    const hRef = String(headers[7] || '').trim();
    const hColor = String(headers[8] || '').trim();
    const hColores = String(headers[9] || '').trim();
    const hTalla = String(headers[10] || '').trim();
    const hTotalUnd = String(headers[11] || '').trim();

    const isNumloteValid = /^(num(\.|º)?\s*lote|numlote|lote|op|n[ºo]?\s*op)/i.test(hNumlote) || hNumlote.toLowerCase().includes('lote') || hNumlote.toLowerCase().includes('op');
    const isRefValid = /^(ref|referencia)/i.test(hRef) || hRef.toLowerCase().includes('ref');
    const isColorValid = /color/i.test(hColor) || /color/i.test(hColores);
    const isTallaValid = /talla/i.test(hTalla);
    const isTotalUndValid = /^(total(\s*und)?|total\s*unidades|cant(idad)?|und)/i.test(hTotalUnd) || hTotalUnd.toLowerCase().includes('total') || hTotalUnd.toLowerCase().includes('und');

    const fallos = [];
    if (!isNumloteValid) fallos.push(`Columna G (índice 6): Se esperaba 'NUMLOTE' u 'OP' (se encontró: "${hNumlote || 'vacío'}")`);
    if (!isRefValid) fallos.push(`Columna H (índice 7): Se esperaba 'REF' (se encontró: "${hRef || 'vacío'}")`);
    if (!isColorValid) fallos.push(`Columna I/J (índice 8/9): Se esperaba 'COLOR' o 'COLORES' (se encontró: I="${hColor || 'vacío'}", J="${hColores || 'vacío'}")`);
    if (!isTallaValid) fallos.push(`Columna K (índice 10): Se esperaba 'TALLA' (se encontró: "${hTalla || 'vacío'}")`);
    if (!isTotalUndValid) fallos.push(`Columna L (índice 11): Se esperaba 'TOTAL UND' (se encontró: "${hTotalUnd || 'vacío'}")`);

    if (fallos.length > 0) {
        return {
            valid: false,
            error: `Posición de columnas inválida en los datos pegados:\n• ${fallos.join('\n• ')}`
        };
    }

    return { valid: true };
}

/* ─── INGESTA EXCEL DE COLECCIÓN (Administrador de Colección) ─────────────
 * Mapeo posicional del libro (índices 0-based):
 *   REFERENCIA = columna B (1)  ·  OP = columna D (3)  ·  COLOR = columna M (12)
 *   TALLAS (curva) = columnas O (14) a AS (45), el header es el nombre de la talla
 */
export const COLEC_COL_REFERENCIA = 1;
export const COLEC_COL_OP = 3;
export const COLEC_COL_COLOR = 12;
export const COLEC_COL_TALLAS_INICIO = 14;
export const COLEC_COL_TALLAS_FIN = 45;

/**
 * Valida los encabezados obligatorios del Excel de Colección antes de construir:
 *   - B (índice 1)  → Referencia
 *   - D (índice 3)  → OP
 *   - M (índice 12) → Color
 *   - O..AS (índices 14..45) → Curva de tallas
 */
export function validateExcelColeccionHeaders(matrix) {
    if (!matrix || !Array.isArray(matrix) || matrix.length < 2) {
        return { valid: false, error: 'El archivo Excel no contiene suficientes filas de datos.' };
    }

    let headers = matrix[1];
    if (!headers || !headers.length) {
        headers = matrix[0] || [];
    }

    const hRef = String(headers[COLEC_COL_REFERENCIA] || '').trim();
    const hOp = String(headers[COLEC_COL_OP] || '').trim();
    const hColor = String(headers[COLEC_COL_COLOR] || '').trim();

    const isRefValid = /^(ref|referencia)/i.test(hRef) || hRef.toLowerCase().includes('ref');
    const isOpValid = /^(op|n[ºo]?\s*op|num(\.|º)?\s*op|lote|numlote|orden)/i.test(hOp) || /^op$/i.test(hOp) || hOp.toLowerCase().includes('op');
    const isColorValid = /^colou?r/i.test(hColor) || hColor.toLowerCase().includes('color');

    const fallos = [];
    if (!isRefValid) fallos.push(`Columna B (índice 1): Se esperaba 'Referencia' (se encontró: "${hRef || 'vacío'}")`);
    if (!isOpValid) fallos.push(`Columna D (índice 3): Se esperaba 'OP' (se encontró: "${hOp || 'vacío'}")`);
    if (!isColorValid) fallos.push(`Columna M (índice 12): Se esperaba 'Color' (se encontró: "${hColor || 'vacío'}")`);

    if (fallos.length > 0) {
        return {
            valid: false,
            error: `Encabezados no válidos en el archivo Excel:\n• ${fallos.join('\n• ')}`
        };
    }

    let tallasCount = 0;
    for (let i = COLEC_COL_TALLAS_INICIO; i <= COLEC_COL_TALLAS_FIN && i < headers.length; i++) {
        if (String(headers[i] || '').trim()) tallasCount++;
    }
    if (tallasCount === 0) {
        return {
            valid: false,
            error: 'El Excel no contiene encabezados de tallas en las columnas O a AS (índices 14 a 45).'
        };
    }

    return { valid: true };
}

/** Convierte la matriz del Excel de colección al JSON agrupado. */
export function buildColeccionJSON(matrix) {
    if (!matrix || matrix.length < 3) return [];

    const headers = matrix[1];
    const rows = matrix.slice(2);

    const tallaIndices = [];
    const tallaNombres = [];
    for (let i = COLEC_COL_TALLAS_INICIO; i <= COLEC_COL_TALLAS_FIN && i < headers.length; i++) {
        const h = String(headers[i] || '').trim();
        if (h) {
            tallaIndices.push(i);
            tallaNombres.push(h);
        }
    }

    const grupos = new Map();

    for (const row of rows) {
        const referencia = String(row[COLEC_COL_REFERENCIA] || '').trim();
        if (!referencia || referencia === 'Totales') continue;

        const op = parseFloat(row[COLEC_COL_OP]) || 0;
        const color = String(row[COLEC_COL_COLOR] || '').trim();
        if (!op || !color) continue;

        const key = referencia + '|' + op;
        if (!grupos.has(key)) {
            grupos.set(key, { referencia, op, colores: new Map(), tallasSet: new Set() });
        }
        const grupo = grupos.get(key);

        if (!grupo.colores.has(color)) grupo.colores.set(color, { color, curva: {} });
        const ext = grupo.colores.get(color);

        for (let i = 0; i < tallaIndices.length; i++) {
            const cantidad = parseFloat(row[tallaIndices[i]]) || 0;
            if (cantidad > 0) {
                const talla = tallaNombres[i];
                ext.curva[talla] = (ext.curva[talla] || 0) + Math.round(cantidad);
                grupo.tallasSet.add(talla);
            }
        }
    }

    const result = [];
    for (const grupo of grupos.values()) {
        const extensiones = [];
        for (const ext of grupo.colores.values()) {
            for (const [talla, cantidad] of Object.entries(ext.curva)) {
                extensiones.push({ color: ext.color, talla, cantidad });
            }
        }
        extensiones.sort((a, b) => (a.color !== b.color) ? a.color.localeCompare(b.color) : a.talla.localeCompare(b.talla));
        result.push({ referencia: grupo.referencia, op: grupo.op, extensiones });
    }
    result.sort((a, b) => (a.referencia !== b.referencia) ? a.referencia.localeCompare(b.referencia) : a.op - b.op);
    return result;
}

/**
 * Convierte el JSON agrupado al modelo de matriz para la vista de lotes:
 *   [{ referencia, op, colores: [{color, curva:{talla:cantidad}}], tallas: [] }]
 */
export function jsonDataToGroups(data) {
    return (data || []).map(item => {
        const coloresMap = new Map();
        const tallasSet = new Set();

        item.extensiones.forEach(ext => {
            if (!coloresMap.has(ext.color)) coloresMap.set(ext.color, { color: ext.color, curva: {} });
            const c = coloresMap.get(ext.color);
            c.curva[ext.talla] = (c.curva[ext.talla] || 0) + ext.cantidad;
            tallasSet.add(ext.talla);
        });

        const colores = Array.from(coloresMap.values()).sort((a, b) => a.color.localeCompare(b.color));
        const tallas = Array.from(tallasSet).sort((a, b) => {
            const aIsNum = /^\d/.test(a);
            const bIsNum = /^\d/.test(b);
            if (aIsNum && !bIsNum) return 1;
            if (!aIsNum && bIsNum) return -1;
            return a.localeCompare(b);
        });

        return { referencia: item.referencia, op: item.op, colores, tallas };
    });
}

/* ─── NORMALIZACIONES PARA CONFECCION/PROCESOS ─────────────────────────────── */

function _normProceso(v) {
    if (!v) return '';
    const u = v.toUpperCase().trim();
    if (u.startsWith('SERVICIODE')) return v.substring(10).trim();
    if (u.startsWith('SERVICIO ')) return v.substring(9).trim();
    return u === 'SERVICIO' ? '' : v.trim();
}

function _normCuento(v) {
    if (!v) return '';
    return v.toUpperCase().trim().replace(/\s*S2\s*$/i, '').replace(/\s+/g, ' ').trim();
}

function _normGenero(v) {
    if (!v) return '';
    const u = v.toUpperCase().trim();
    if (u.includes('FEMENINA') || u.includes('MUJER') || u.includes('DAMA')) return 'DAMA';
    if (u.includes('MASCULINA') || u.includes('HOMBRE') || u.includes('CABALLERO')) return 'CABALLERO';
    if (u.includes('NIÑA') || u.includes('NINA')) return 'NIÑA';
    if (u.includes('NIÑO') || u.includes('NINO')) return 'NIÑO';
    return (u.includes('UNISEX') || u.includes('MIXTO')) ? 'UNISEX' : v.trim();
}

function _normFecha(v) {
    if (!v) return null;
    const m = { ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12' };
    const match = v.trim().match(/^(\d{1,2})-([a-zA-Z]+)-(\d{2})$/);
    if (match) {
        const mes = m[match[2].toLowerCase().substring(0, 3)];
        if (mes) return `20${match[3]}-${mes}-${match[1].padStart(2, '0')}`;
    }
    return v.trim() || null;
}

/* ─── DETECCIÓN DE TIPO DE UPLOAD ────────────────────────────────────────── */

/**
 * Detecta el tipo de upload basándose en los headers presentes.
 * Retorna: 'EXTENSIONES', 'CONFECCION', 'PROCESOS', o 'UNKNOWN'
 */
export function detectUploadType(headers) {
    if (!headers || !Array.isArray(headers)) return 'UNKNOWN';
    const h = headers.map(x => String(x || '').toLowerCase());

    // 0) TABLERO DE EXTENSIONES POR POSICIÓN EXACTA (G..L = índices 6..11):
    //    Numlote(6) · Ref(7) · Color(8) · Colores(9) · Talla(10) · Total Und(11).
    //    Prioridad ABSOLUTA: el tablero real de taller trae además Ubicacion/Nombre/
    //    Telefono/Direccion/Ciudad/desclarga (marcas de confección) y era desviado a
    //    CONFECCION. El master de confección nunca tiene este layout exacto
    //    (su Numlote está en índice 2 y no trae Color+Colores+Talla juntas).
    const at = (i) => String(headers[i] || '').trim();
    const exactTablero =
        /^(numlote|num(\.|º)?\s*lote|lote|n[ºo])$/i.test(at(6)) &&
        /^(ref|referencia)$/i.test(at(7)) &&
        /^colores$/i.test(at(9)) &&
        /^talla$/i.test(at(10)) &&
        /^total(\s*und)?$/i.test(at(11));
    if (exactTablero) return 'EXTENSIONES';

    // 1) Confección: requiere marcas específicas de confección
    const confeccionUnicos = ['nombre', 'marca', 'desclarga', 'col', 'fechasalda', 'fechaentrada', 'nombre2', 'telefono', 'celular', 'direccion', 'ciudad', 'encargado', 'fechadespacho', 'obs salida', 'costo conf+term', 'valor a pagar', 'inv muestras', 'categoria de producto'];
    const confeccionMatches = confeccionUnicos.filter(req => h.includes(req));
    if (confeccionMatches.length >= 2) return 'CONFECCION';

    // 2) Extensiones: tablero de programación (G NUMLOTE · H REF · I/J COLOR · K TALLA · L TOTAL UND).
    //    Restaurado desde bk2-pegado-extensiones: se evalúa ANTES del chequeo genérico de master,
    //    porque el tablero trae 'total und' y matcheaba el patrón base de PROCESOS desviando el pegado.
    const hasNumlote = h.some(x => /^(numlote|num(\.|º)?\s*lote|lote|op|n[ºo])/i.test(x));
    const hasRef = h.some(x => /^(ref|referencia)/i.test(x));
    const hasColor = h.some(x => /color/i.test(x));
    const hasTalla = h.some(x => /talla/i.test(x));
    if (hasNumlote && hasRef && (hasColor || hasTalla)) return 'EXTENSIONES';

    // 3) Procesos: si no es confección ni extensiones pero tiene estructura base de master
    //    (el master de procesos no tiene columnas de color ni talla).
    const baseHeaders = ['numlote', 'ref', 'referencia', 'total', 'planta', 'proceso'];
    const baseMatches = baseHeaders.filter(req => h.some(x => x.includes(req)));
    if (baseMatches.length >= 2) return 'PROCESOS';

    return 'UNKNOWN';
}

/* ─── MAPEO DE CONFECCION ─────────────────────────────────────────────────── */

/**
 * Mapea una fila de datos de Confección al formato de la tabla master.
 */
export function mapConfeccionRow(row, idxMap, idProductora) {
    const get = (key) => {
        const idx = idxMap[key];
        if (idx === undefined || idx >= row.length) return '';
        const s = String(row[idx] ?? '').trim();
        return (s === '' || s.toLowerCase() === 'null' || s === 'n/a' || s === '-') ? '' : s;
    };

    return {
        id_master: parseInt(get('Numlote')) || null,
        id_productora: idProductora,
        referencia: get('Ref'),
        cantidad: parseInt(get('Total')) || 0,
        nombre_planta: get('Nombre'),
        fecha_salida: _normFecha(get('FechaSalda')),
        fecha_entrega: _normFecha(get('FechaEntrada')),
        proceso: get('Proceso') || 'CONFECCION',
        descripcion: get('Categoria de Producto'),
        cuento: _normCuento(get('Cuento')),
        genero: _normGenero(get('Linea')),
        observaciones: get('Obs Salida'),
        costo: get('Costo Conf+Term'),
        productora: idProductora
    };
}

/* ─── MAPEO DE PROCESOS ──────────────────────────────────────────────────── */

/**
 * Mapea una fila de datos de Procesos al formato de la tabla master.
 */
export function mapProcesosRow(row, idxMap, idProductora) {
    const get = (key) => {
        const idx = idxMap[key];
        if (idx === undefined || idx >= row.length) return '';
        const s = String(row[idx] ?? '').trim();
        return (s === '' || s.toLowerCase() === 'null' || s === 'n/a' || s === '-') ? '' : s;
    };

    return {
        id_master: parseInt(get('NumLote')) || null,
        id_productora: idProductora,
        referencia: get('Ref'),
        cantidad: parseInt(get('Total')) || 0,
        nombre_planta: get('Planta'),
        fecha_salida: _normFecha(get('FechaSal')),
        fecha_entrega: _normFecha(get('FechaEntrega')),
        proceso: _normProceso(get('Proceso')),
        descripcion: get('Categoria'),
        cuento: _normCuento(get('Cuento')),
        genero: _normGenero(get('Linea')),
        observaciones: get('Obs'),
        costo: get('Cant Minutos'),
        productora: idProductora
    };
}

/* ─── CONSTRUCCIÓN DE JSON PARA CONFECCION/PROCESOS ──────────────────────── */

/**
 * Convierte la matriz parseada (headers + grid) al JSON para CONFECCION o PROCESOS.
 * Retorna array de objetos para upsert en tabla master.
 */
export function buildMasterJSON(headers, grid, type, idProductora) {
    if (!headers || !grid || !grid.length) return [];

    const idxMap = {};
    headers.forEach((h, i) => { idxMap[h] = i; });

    const mapper = type === 'CONFECCION' ? mapConfeccionRow : mapProcesosRow;
    const result = [];

    for (const row of grid) {
        const mapped = mapper(row, idxMap, idProductora);
        if (mapped.id_master && mapped.referencia) {
            result.push(mapped);
        }
    }

    return result;
}

/**
 * Detecta la productora correcta a partir de la moda del campo `cuento`
 * en las filas ya mapeadas (output de buildMasterJSON).
 *
 * Mapa de términos de CUENTO → fragmento a buscar en productoras:
 *   "HACEMOS MODA S2" | "HACEMOS MODA" → productora que contenga "HACEMOS MODA"
 *   "ANGELES"                           → productora que contenga "ANGELES"
 *
 * @param {Array} rows        - Array de objetos mapeados (tienen campo `cuento`)
 * @param {Array} productoras - Catálogo completo de productoras
 * @returns {{ idProductora: string, productoraNombre: string } | null}
 */
export function detectProductoraDesdeCuento(rows, productoras) {
    if (!rows || !rows.length || !productoras || !productoras.length) return null;

    // Normaliza: mayúsculas, quita tildes, quita "S2" final, colapsa espacios.
    // BÁSICO→BASICO · BOGOTÁ→BOGOTA · ÍNTIMA→INTIMA · MODAFRESCA S2→MODAFRESCA
    const norm = (v) => String(v || '').toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s*S2\s*$/i, '')
        .replace(/\s+/g, ' ').trim();

    const CUENTO_MAP = [
        { terms: ['HACEMOS MODA'], searchFor: 'HACEMOS MODA' },
        { terms: ['ANGELES'], searchFor: 'ANGELES' },
        // UNIVERSO: cuentos de las líneas del Universo (confirmado por negocio).
        // Regla: con que aparezca 1 o más de estos cuentos, la productora es UNIVERSO.
        { terms: ['MODAFRESCA', 'BASICO', 'URBANO', 'DEPORTIVO', 'ESPECIALES', 'INTIMA', 'BOGOTA', 'EL UNIVERSO', 'UNIVERSO'], searchFor: 'UNIVERSO' },
    ];

    // 1. Contar cuántas filas matchean cada productora (la primera que aplique).
    const counts = new Map();
    let total = 0;
    for (const r of rows) {
        const raw = String(r.cuento || '').trim();
        if (!raw) continue;
        total++;
        const c = norm(raw);
        for (const entry of CUENTO_MAP) {
            if (entry.terms.some(t => c.includes(norm(t)))) {
                counts.set(entry.searchFor, (counts.get(entry.searchFor) || 0) + 1);
                break;
            }
        }
    }
    if (!total || !counts.size) return null;

    // 2. Productora con más coincidencias. Si hay empate entre dos, no arriesgar.
    let bestSearchFor = null;
    let bestCount = 0;
    for (const [sf, cnt] of counts) {
        if (cnt > bestCount) { bestCount = cnt; bestSearchFor = sf; }
    }
    const top = [...counts.entries()].filter(([, cnt]) => cnt === bestCount);
    if (top.length !== 1) return null;

    // 3. Buscar en el catálogo de productoras
    const found = productoras.find(p => {
        const nombre = norm(p.productora || p.nombre_corto || p.nombre || '');
        return nombre.includes(bestSearchFor);
    });

    if (!found) return null;

    return {
        idProductora: String(found.id_productora ?? found.nit ?? found.id ?? ''),
        productoraNombre: String(found.productora || found.nombre_corto || '').toUpperCase()
    };
}

/**
 * Valida que los headers de Confección/Procesos sean válidos.
 * Retorna { valid: boolean, error: string }
 */
export function validateMasterHeaders(headers, type) {
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
        return { valid: false, error: 'No se detectaron encabezados en los datos.' };
    }

    const h = headers.map(x => String(x || '').toLowerCase());
    const requiredSet = type === 'CONFECCION' ? HEADER_SETS.CONFECCION : HEADER_SETS.PROCESOS;
    const matches = requiredSet.filter(req => h.includes(req.toLowerCase()));

    if (matches.length < 3) {
        return {
            valid: false,
            error: `Formato de ${type} no válido. Se requieren al menos 3 de los siguientes encabezados: ${requiredSet.slice(0, 8).join(', ')}...`
        };
    }

    const hasNumlote = h.some(x => /^(numlote|num(\.|º)?\s*lote|lote|n[ºo])/i.test(x));
    const hasRef = h.some(x => /^(ref|referencia)/i.test(x));
    const hasTotal = h.some(x => /total/i.test(x));

    if (!hasNumlote || !hasRef || !hasTotal) {
        return {
            valid: false,
            error: `Faltan columnas obligatorias para ${type}: Numlote, Ref y Total.`
        };
    }

    return { valid: true };
}

/* ─── GENERAL_TDM — CSV legacy de Confección (migracion upload.js) ───────── */
/**
 * Detecta el formato GENERAL_TDM (CSV de Confección del legacy upload.js):
 * requiere TODOS los encabezados del set (comparación insensible a mayúsculas).
 */
export function isGeneralTdmHeaders(headers) {
    if (!headers || !Array.isArray(headers) || !headers.length) return false;
    const h = headers.map(x => String(x || '').trim().toLowerCase());
    return HEADER_SETS.GENERAL_TDM.every(req => h.includes(req.toLowerCase()));
}

/**
 * Convierte la matriz parseada de un CSV GENERAL_TDM al formato master.
 * Mapeo idéntico al legacy (migracion upload.js → _mapGeneralTDM):
 *   OP→id_master · Ref→referencia · InvPlanta→cantidad · NombrePlanta→nombre_planta
 *   FSALIDACONF→fecha_salida · FENTREGACONF→fecha_entrega · Proceso→proceso (default CONFECCION)
 *   Descripcion→descripcion · Cuento→cuento · Genero→genero
 *   OS→observaciones ("OS: x") · Costo→costo
 *   TS / Tipo Tejido / pvp se IGNORAN (igual que el legacy).
 * Solo se aceptan filas con OP numérica > 0 (equivalente a _validMaster del legacy).
 */
export function buildGeneralTdmJSON(headers, grid, idProductora) {
    if (!headers || !grid || !grid.length) return [];

    const idxMap = {};
    headers.forEach((h, i) => { idxMap[String(h || '').trim().toLowerCase()] = i; });

    const result = [];
    for (const row of grid) {
        const get = (key) => {
            const idx = idxMap[key.toLowerCase()];
            if (idx === undefined || idx >= row.length) return '';
            const s = String(row[idx] ?? '').trim();
            return (s === '' || s.toLowerCase() === 'null' || s === 'n/a' || s === '-') ? '' : s;
        };

        const mapped = {
            id_master: parseInt(get('OP')) || null,
            id_productora: idProductora,
            referencia: get('Ref'),
            cantidad: parseInt(get('InvPlanta')) || 0,
            nombre_planta: get('NombrePlanta'),
            fecha_salida: _normFecha(get('FSalidaConf')),
            fecha_entrega: _normFecha(get('FEntregaConf')),
            proceso: get('Proceso') || 'CONFECCION',
            descripcion: get('Descripcion'),
            cuento: _normCuento(get('Cuento')),
            genero: _normGenero(get('Genero')),
            observaciones: get('OS') ? `OS: ${get('OS')}` : '',
            costo: get('Costo'),
            productora: idProductora
        };

        if (mapped.id_master && mapped.id_master > 0) result.push(mapped);
    }
    return result;
}