/**
 * ProgramacionEngine — Lógica pura del Módulo NUBE (Programación de Taller).
 * Migrado desde legacy `migracion [ Imput ]/map/js/views/programacionView.js`.
 * Código 100% funcional: sin DOM. Todas las funciones reciben/retornan datos.
 *
 * Mapeo oficial de columnas del tablero pegado (Letra e Índice 0-based):
 *   G (6)  → NUMLOTE   · H (7) → REF   · I (8) → COLOR
 *   J (9)  → COLORES   · K (10)→ TALLA · L (11)→ TOTAL UND
 */

export const MAPPED_COLUMNS = Object.freeze([
    { key: 'numlote',  letter: 'G', defaultIdx: 6,  label: 'NUMLOTE',   required: true,  color: '#4f46e5' },
    { key: 'ref',      letter: 'H', defaultIdx: 7,  label: 'REF',       required: true,  color: '#0284c7' },
    { key: 'color',    letter: 'I', defaultIdx: 8,  label: 'COLOR',     required: false, color: '#059669' },
    { key: 'colores',  letter: 'J', defaultIdx: 9,  label: 'COLORES',   required: false, color: '#7c3aed' },
    { key: 'talla',    letter: 'K', defaultIdx: 10, label: 'TALLA',     required: false, color: '#db2777' },
    { key: 'totalUnd', letter: 'L', defaultIdx: 11, label: 'TOTAL UND', required: false, color: '#ea580c' }
]);

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