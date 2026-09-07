/**
 * View: Captura de Programación de Taller — Interfaz tipo Hoja de Cálculo Excel
 *
 * Mapeo Oficial de Columnas del tablero pegado (Letras e Índices):
 *   G (6)  → NUMLOTE
 *   H (7)  → REF
 *   I (8)  → COLOR
 *   J (9)  → COLORES
 *   K (10) → TALLA
 *   L (11) → TOTAL UND
 */

import { DOM } from '../dom.js';
import { showToast } from '../utils.js';
import { asentarProgramacionToGAS } from '../api.js';

export const MAPPED_COLUMNS = [
    { key: 'numlote',  letter: 'G', defaultIdx: 6,  label: 'NUMLOTE',   required: true,  color: '#4f46e5' },
    { key: 'ref',      letter: 'H', defaultIdx: 7,  label: 'REF',       required: true,  color: '#0284c7' },
    { key: 'color',    letter: 'I', defaultIdx: 8,  label: 'COLOR',     required: false, color: '#059669' },
    { key: 'colores',  letter: 'J', defaultIdx: 9,  label: 'COLORES',   required: false, color: '#7c3aed' },
    { key: 'talla',    letter: 'K', defaultIdx: 10, label: 'TALLA',     required: false, color: '#db2777' },
    { key: 'totalUnd', letter: 'L', defaultIdx: 11, label: 'TOTAL UND', required: false, color: '#ea580c' },
];

let rawHeaders = [];       // string[]
let rawGrid    = [];       // string[][] (filas x columnas)
let colMapping = {};       // columnIndex (int) -> key ('numlote', 'ref', etc.)
let jsonData = [];         // JSON agrupado final [{referencia, op, extensiones}]
let dataMode = '';         // 'pegar' | 'excel' | '' (vacío)
let sourceName = '';       // Nombre del archivo Excel cargado
let viewMode = 'lotes';   // Vista activa: 'lotes' | 'plano' | 'json'

/* ─── 1. PARSERS INTELIGENTES (FILTRADO ESTRICTO DE FILAS) ───────────────── */


/**
 * Parsea contenido HTML del portapapeles (Outlook, Gmail, Excel)
 */
/**
 * Filtra filas candidatas asegurando que solo entren registros con Lote/Unidades válido
 * y descartando títulos superiores, encabezados repetidos y totales inferiores.
 */
function filterValidDataRows(rows) {
    // Nombres de columna conocidos del tablero (para descartar encabezados repetidos)
    const headerPattern = /^(ubicacion|nombre2?|telefono|direccion|ciudad|numlote|num(\.|º)?\s*lote|lote|n[ºo]|op|referen|refext|ref|color(es)?|talla|total(\s*und)?|codplanta|coleccion|descarga|f[\s._-]*(salida|entrega)|observacion|emp|zona|categoria|linea|celular|numpedcliente|ordcompped|erp)/i;

    return rows.filter(row => {
        if (!row || !row.length) return false;

        // 1. Debe tener al menos algún dato
        const nonBlank = row.filter(c => String(c).trim() !== '');
        if (nonBlank.length < 2) return false;

        // 2. Descartar filas de títulos superiores o de totales
        const fullText = row.join(' ').toLowerCase();
        if (fullText.includes('informaci') || fullText.includes('calculo de capacidad') || fullText.includes('cálculo')) {
            return false;
        }

        // 3. Verificar que la fila contenga un valor numérico de lote/unidades (1 a 6 dígitos)
        //    dentro de las columnas de interés (Ubicacion..Total Und = índices 0..11)
        const hasNumericValue = row.slice(0, 12).some(c => /^\d{1,6}$/.test(String(c || '').trim()));
        if (!hasNumericValue) return false;

        // 4. Descartar encabezados repetidos (la primera celda con datos es un nombre de columna)
        const firstNonBlank = String(nonBlank[0] || '').trim();
        if (headerPattern.test(firstNonBlank)) {
            return false;
        }

        return true;
    });
}

/**
 * Parsea contenido HTML del portapapeles (Outlook, Gmail, Excel)
 */
function parseFromHTML(htmlString) {
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

        if (matrix.length > bestMatrix.length) {
            bestMatrix = matrix;
        }
    });

    if (bestMatrix.length < 2) return null;

    // Buscar la fila real de encabezados
    let headerIdx = -1;
    for (let i = 0; i < bestMatrix.length; i++) {
        const r = bestMatrix[i];
        if (r.some(c => /^(ubicacion|nombre|telefono|direccion|ciudad|numlote|lote|n[ºo]|op|referen|ref\b|color|talla|total|codplanta|coleccion|descarga|f[\s._-]*(salida|entrega)|observacion|emp|zona|categoria|linea)/i.test(c))) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx >= 0) {
        rawHeaders = bestMatrix[headerIdx];
    } else {
        rawHeaders = bestMatrix[0].map((_, i) => `Columna ${i + 1}`);
    }

    const candidateRows = headerIdx >= 0 ? bestMatrix.slice(headerIdx + 1) : bestMatrix;
    rawGrid = filterValidDataRows(candidateRows);

    if (!rawGrid.length) return false;

    autoDetectMapping();
    return true;
}

/**
 * Parsea formato tabular TSV / CSV (tabs o punto y coma)
 */
function parseTabular(lines) {
    const splitLine = l => l.split(/\t|;/).map(c => c.trim());
    const matrix = lines.map(splitLine).filter(r => r.some(c => c !== ''));
    if (!matrix.length) return false;

    // Buscar la fila real de encabezados (ignorando títulos previos)
    let headerIdx = -1;
    for (let i = 0; i < matrix.length; i++) {
        const r = matrix[i];
        if (r.some(c => /^(ubicacion|numlote|num(\.|º)?\s*lote|lote|n[ºo]\s*(de)?\s*op|referen|ref\b|color|talla|total\s*und|codplanta|coleccion|descarga|observacion|categoria|linea)/i.test(c))) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx >= 0) {
        rawHeaders = matrix[headerIdx];
    } else if (matrix[0].some(c => /^(ubicacion|n[ºo]|op|numlote|lote|ref|color|talla|total|cant|sesgo|muestra|taller)/i.test(c))) {
        rawHeaders = matrix[0];
        headerIdx = 0;
    } else {
        rawHeaders = matrix[0].map((_, i) => `Columna ${i + 1}`);
    }

    const candidateRows = headerIdx >= 0 ? matrix.slice(headerIdx + 1) : matrix;
    rawGrid = filterValidDataRows(candidateRows);

    if (!rawGrid.length) return false;

    autoDetectMapping();
    return true;
}

/* ─── 2. DETECCIÓN AUTOMÁTICA DE MAPEO DE COLUMNAS ───────────────────────── */

function autoDetectMapping() {
    colMapping = {};
    const usedKeys = new Set();

    // 1. Si la tabla viene con 15 o más columnas (estándar A..W), aplicar el mapa exacto por letra/índice
    if (rawHeaders.length >= 15 || rawGrid.some(r => r.length >= 15)) {
        MAPPED_COLUMNS.forEach(col => {
            colMapping[col.defaultIdx] = col.key;
            usedKeys.add(col.key);
        });
        return;
    }

    // 2. Coincidencia inteligente por texto de encabezado
    rawHeaders.forEach((hdr, colIdx) => {
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
        if (!usedKeys.has(col.key) && col.defaultIdx < rawHeaders.length) {
            colMapping[col.defaultIdx] = col.key;
            usedKeys.add(col.key);
        }
    });
}

/* ─── 3. RENDERIZADO DE LA HOJA EXCEL ───────────────────────────────────── */

export function renderExcelGrid() {
    const zone = document.getElementById('progExcelZone');
    if (!zone) return;

    if (!rawGrid.length) {
        zone.innerHTML = buildEmptyStateHtml();
        updateUIState(0);
        applyData();   // recalcula vistas derivadas y modo de vista incluso sin datos
        return;
    }

    const colLetter = i => {
        let s = '', n = i + 1;
        while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
        return s;
    };

    const maxCols = Math.max(rawHeaders.length, ...rawGrid.map(r => r.length));

    // Generar Selector de mapeo en cada encabezado
    let theadCells = `<th class="xls-corner-cell" title="Eliminar / Fila"></th>`;
    for (let c = 0; c < maxCols; c++) {
        const letter = colLetter(c);
        const headerName = rawHeaders[c] || `Columna ${c + 1}`;
        const mappedKey = colMapping[c] || '';

        const optionsHtml = [
            `<option value="">(Sin mapear)</option>`,
            ...MAPPED_COLUMNS.map(m =>
                `<option value="${m.key}" ${m.key === mappedKey ? 'selected' : ''}>[${m.letter}] ${m.label}${m.required ? ' *' : ''}</option>`
            )
        ].join('');

        theadCells += `
            <th class="xls-col-header ${mappedKey ? 'is-mapped' : ''}" data-col="${c}">
                <div class="xls-hdr-top">
                    <span class="xls-hdr-letter">${letter}</span>
                    <span class="xls-hdr-name" title="${headerName}">${headerName}</span>
                </div>
                <div class="xls-hdr-mapping">
                    <select class="xls-map-select" data-col="${c}" title="Asignar campo de destino">
                        ${optionsHtml}
                    </select>
                </div>
            </th>`;
    }

    // Generar Filas y Celdas Editables con Botón de Eliminar en el índice
    let tbodyRows = '';
    rawGrid.forEach((row, rIdx) => {
        let rowCells = `
            <td class="xls-row-num" title="Fila ${rIdx + 1}">
                <span class="xls-rn-text">${rIdx + 1}</span>
                <button class="btn-del-row" data-row="${rIdx}" title="Eliminar fila ${rIdx + 1}" aria-label="Eliminar fila">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </td>`;

        for (let c = 0; c < maxCols; c++) {
            const val = row[c] !== undefined ? String(row[c]) : '';
            const mappedKey = colMapping[c];
            const isMappedClass = mappedKey ? 'is-mapped-cell' : '';

            rowCells += `
                <td class="xls-cell ${isMappedClass}" 
                    contenteditable="true" 
                    data-row="${rIdx}" 
                    data-col="${c}" 
                    spellcheck="false">${escapeHtml(val)}</td>`;
        }
        tbodyRows += `<tr data-row="${rIdx}">${rowCells}</tr>`;
    });

    zone.innerHTML = `
        <div class="xls-sheet-container">
            <div class="xls-toolbar">
                <span class="xls-stat-badge">${rawGrid.length} filas</span>
                <span class="xls-stat-badge">${maxCols} columnas</span>
                <span class="xls-stat-mapped">${Object.keys(colMapping).length} de ${MAPPED_COLUMNS.length} mapeadas</span>
                <button id="btnProgAddRow" class="btn-ghost xls-tool-btn" title="Agregar fila al final">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    + Fila
                </button>
            </div>
            <div class="xls-grid-scroll">
                <table class="xls-table">
                    <thead><tr>${theadCells}</tr></thead>
                    <tbody>${tbodyRows}</tbody>
                </table>
            </div>
        </div>`;

    setupGridEvents(zone);

    applyData();
    updateUIState(rawGrid.length);
}

function buildEmptyStateHtml() {
    return `
        <div class="prog-paste-hint" id="progPasteZonePrompt">
            <!-- Contenido flotante transparente -->
            <div class="prog-hub-card">
                <h3 class="prog-hub-title">Importar Programación de Taller</h3>
                <p class="prog-hub-subtitle">Copia la tabla desde tu correo o archivo y pégala aquí</p>

                <div class="prog-hub-actions">
                    <button id="btnTriggerPaste" class="btn-modal-primary prog-hub-paste-btn">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                        Pegar del portapapeles
                    </button>
                    <button id="btnProgUploadEmpty" class="btn-ghost prog-hub-upload-btn" title="Cargar archivo (.xlsx, .xls o .csv)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Cargar archivo
                    </button>
                </div>


            </div>
        </div>`;
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── 4. EVENTOS Y EDICIÓN EN LA CUADRÍCULA ──────────────────────────────── */

function setupGridEvents(zone) {
    // Cambio en selector de mapeo de columnas
    zone.querySelectorAll('.xls-map-select').forEach(select => {
        select.addEventListener('change', e => {
            const colIdx = parseInt(e.target.dataset.col, 10);
            const val = e.target.value;
            if (val) {
                for (const [k, v] of Object.entries(colMapping)) {
                    if (v === val && parseInt(k, 10) !== colIdx) delete colMapping[k];
                }
                colMapping[colIdx] = val;
            } else {
                delete colMapping[colIdx];
            }
            renderExcelGrid();
        });
    });

    // Eliminar fila individual
    zone.querySelectorAll('.btn-del-row').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const r = parseInt(e.currentTarget.dataset.row, 10);
            if (!isNaN(r) && r >= 0 && r < rawGrid.length) {
                rawGrid.splice(r, 1);
                renderExcelGrid();
            }
        });
    });

    // Edición en vivo de celdas
    zone.querySelectorAll('.xls-cell').forEach(cell => {
        cell.addEventListener('input', e => {
            const r = parseInt(e.target.dataset.row, 10);
            const c = parseInt(e.target.dataset.col, 10);
            if (rawGrid[r]) {
                rawGrid[r][c] = e.target.innerText.trim();
            }
        });
    });

    // Agregar fila
    const btnAddRow = document.getElementById('btnProgAddRow');
    if (btnAddRow) {
        btnAddRow.addEventListener('click', () => {
            const numCols = Math.max(rawHeaders.length, 1);
            rawGrid.push(new Array(numCols).fill(''));
            renderExcelGrid();
        });
    }
}

function updateUIState(count) {
    const counter = document.getElementById('progRowCount');
    if (counter) counter.textContent = `${count} fila${count !== 1 ? 's' : ''}`;

    const hasData = count > 0 || jsonData.length > 0;
    const btnSave = document.getElementById('btnProgSave');
    const btnJSON = document.getElementById('btnProgCopyJSON');
    const btnClear = document.getElementById('btnProgClear');
    const btnAsentar = document.getElementById('btnProgAsentar');

    if (btnSave) btnSave.disabled = !hasData;
    if (btnJSON) btnJSON.disabled = !hasData;
    if (btnClear) btnClear.disabled = !hasData;
    if (btnAsentar) btnAsentar.disabled = !hasData;
}

/* ─── 5. PROCESADOR DE ENTRADA CLIPBOARD ─────────────────────────────────── */

export function handleIncomingPaste(clipboardData) {
    if (!clipboardData) return;

    // Un pegado exitoso cambia la fuente a 'pegar'
    dataMode = 'pegar';
    sourceName = '';

    // 1. Intentar HTML primero (Gmail, Outlook, Excel Web)
    const html = clipboardData.getData('text/html');
    if (html && parseFromHTML(html)) {
        renderExcelGrid();
        return;
    }

    // 2. Intentar Texto plano
    const text = clipboardData.getData('text/plain') || '';
    if (!text.trim()) return;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    const isTabular = lines.some(l => l.includes('\t') || (l.match(/;/g) || []).length >= 2);
    if (isTabular) {
        if (parseTabular(lines)) {
            renderExcelGrid();
            return;
        }
    }

    parseTabular(lines);
    renderExcelGrid();
}

/* ─── 6. EXPORTACIÓN Y ASENTAMIENTO ──────────────────────────────────────── */

function exportMappedRows() {
    const exportMap = [];
    MAPPED_COLUMNS.forEach(col => {
        const colIdx = Object.keys(colMapping).find(idx => colMapping[idx] === col.key);
        if (colIdx !== undefined) {
            exportMap.push({ key: col.key, label: col.label, colIdx: parseInt(colIdx, 10) });
        }
    });

    return rawGrid.map(row => {
        const obj = {};
        exportMap.forEach(m => {
            obj[m.label] = row[m.colIdx] !== undefined ? row[m.colIdx] : '';
        });
        return obj;
    });
}

/**
 * Construye el JSON de programación agrupado (mismo formato que genera el sistema destino):
 *   [{ referencia, op, extensiones: [{ color, talla, cantidad }] }]
 * - Agrupa las filas pegadas por OP (Numlote) + Referencia.
 * - Cada fila se convierte en una extensión: color = COLORES, talla = TALLA, cantidad = TOTAL UND (número).
 * - Si un mismo color+talla se repite dentro del mismo OP, las cantidades se suman.
 */
function buildProgramacionJSON() {
    const flat = exportMappedRows();
    const result = [];
    const groups = new Map();

    flat.forEach(row => {
        const opNum = parseInt(String(row['NUMLOTE'] || '').trim(), 10);
        const op = isNaN(opNum) ? 0 : opNum;
        const referencia = String(row['REF'] || '').trim();
        const color = String(row['COLORES'] || '').trim();
        const talla = String(row['TALLA'] || '').trim();
        const cantNum = parseInt(String(row['TOTAL UND'] || '').trim(), 10);
        const cantidad = isNaN(cantNum) ? 0 : cantNum;

        const groupKey = op + '|' + referencia.toUpperCase();
        if (!groups.has(groupKey)) {
            const group = { referencia: referencia, op: op, extensiones: [] };
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
            group.extensiones.push({ color: color, talla: talla, cantidad: cantidad });
        }
    });

    // Orden consistente con la ruta Excel (colección): grupos por referencia/op, extensiones por color/talla
    result.forEach(g => g.extensiones.sort((a, b) => (a.color !== b.color) ? a.color.localeCompare(b.color) : a.talla.localeCompare(b.talla)));
    result.sort((a, b) => (a.referencia !== b.referencia) ? a.referencia.localeCompare(b.referencia) : a.op - b.op);
    return result;
}

/**
 * Convierte el JSON agrupado al modelo de matriz para la vista de lotes:
 *   [{ referencia, op, colores: [{color, curva:{talla:cantidad}}], tallas: [] }]
 */
function jsonDataToGroups(data) {
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

        return { referencia: item.referencia, op: item.op, colores: colores, tallas: tallas };
    });
}

/* ─── 6b. INGESTA EXCEL DE COLECCIÓN (Administrador de Colección) ──────────
 * Mapeo posicional del libro (índices 0-based):
 *   REFERENCIA = columna B (1)  ·  OP = columna D (3)  ·  COLOR = columna M (12)
 *   TALLAS (curva) = columnas O (14) a AS (45), el header es el nombre de la talla
 */
const COLEC_COL_REFERENCIA = 1;
const COLEC_COL_OP = 3;
const COLEC_COL_COLOR = 12;
const COLEC_COL_TALLAS_INICIO = 14;
const COLEC_COL_TALLAS_FIN = 45;

function buildColeccionJSON(matrix) {
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
            grupos.set(key, { referencia: referencia, op: op, colores: new Map(), tallasSet: new Set() });
        }
        const grupo = grupos.get(key);

        if (!grupo.colores.has(color)) grupo.colores.set(color, { color: color, curva: {} });
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
                extensiones.push({ color: ext.color, talla: talla, cantidad: cantidad });
            }
        }
        extensiones.sort((a, b) => (a.color !== b.color) ? a.color.localeCompare(b.color) : a.talla.localeCompare(b.talla));
        result.push({ referencia: grupo.referencia, op: grupo.op, extensiones: extensiones });
    }
    result.sort((a, b) => (a.referencia !== b.referencia) ? a.referencia.localeCompare(b.referencia) : a.op - b.op);
    return result;
}

/* ─── 6c. VISTAS DERIVADAS (LOTES + JSON) ────────────────────────────────── */

/**
 * Recalcula el JSON desde la fuente activa y refresca las vistas derivadas.
 * Se ejecuta al final de cada renderExcelGrid().
 */
function applyData() {
    if (dataMode === 'excel') {
        // Los datos vienen del Excel de colección; la hoja pegada no manda
        refreshDerivedViews();
        return;
    }
    jsonData = buildProgramacionJSON();
    if (jsonData.length) {
        dataMode = 'pegar';
        sourceName = '';
    }
    refreshDerivedViews();
}

function refreshDerivedViews() {
    const filterInput = document.getElementById('progFilterOp');
    const filterVal = filterInput ? filterInput.value.trim() : '';
    let filtered = jsonData;
    const opNum = parseInt(filterVal, 10);
    if (filterVal && !isNaN(opNum)) {
        filtered = jsonData.filter(item => item.op === opNum);
    }
    renderLotes(jsonDataToGroups(filtered));
    renderJSONView(filtered);
    updateLotesStats(filtered);
    applyViewMode();
}

/**
 * Muestra únicamente la sección del modo activo:
 *   'lotes' → vista de lotes (+ zona de pegado vacía si aún no hay datos)
 *   'plano' → solo la hoja de datos pegada
 *   'json'  → solo el JSON generado
 */
function applyViewMode() {
    const zone = document.getElementById('progExcelZone');
    const lotesBar = document.querySelector('.lotes-top-bar');
    const lotesContainer = document.getElementById('lotesContainer');
    const jsonSection = document.getElementById('jsonSection');
    const hasAny = jsonData.length > 0 || rawGrid.length > 0;

    if (zone) {
        const showZone = viewMode === 'plano' || (viewMode === 'lotes' && !hasAny);
        zone.classList.toggle('hidden', !showZone);
    }
    if (lotesBar) lotesBar.classList.toggle('hidden', viewMode !== 'lotes' || !hasAny);
    if (lotesContainer) lotesContainer.classList.toggle('hidden', viewMode !== 'lotes' || !hasAny);
    if (jsonSection) jsonSection.classList.toggle('hidden', viewMode !== 'json');

    const btnPlano = document.getElementById('btnProgToggleSheet');
    if (btnPlano) {
        const label = btnPlano.querySelector('span');
        if (label) label.textContent = viewMode === 'plano' ? 'Ocultar Plano' : 'Ver Plano';
        btnPlano.classList.toggle('hidden', !hasAny);
        btnPlano.classList.toggle('btn-active', viewMode === 'plano');
    }
    const btnJson = document.getElementById('btnProgToggleJson');
    if (btnJson) {
        const label = btnJson.querySelector('span');
        if (label) label.textContent = viewMode === 'json' ? 'Ocultar JSON' : 'Ver JSON';
        btnJson.classList.toggle('hidden', !hasAny);
        btnJson.classList.toggle('btn-active', viewMode === 'json');
    }

    // Acciones que solo aplican con datos cargados o pegados
    ['btnProgClear', 'btnProgCopyJSON', 'btnProgSave', 'btnProgAsentar'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.classList.toggle('hidden', !hasAny);
    });
}

/**
 * Vista de lotes estilo MAP DE COLECCIÓN: matriz color × talla con totales
 * por color, por talla y total general, agrupada por OP + Referencia.
 */
function renderLotes(groups) {
    const container = document.getElementById('lotesContainer');
    if (!container) return;

    if (!groups.length) {
        container.innerHTML = '<div class="lotes-empty">Pega la tabla o sube el Excel de colección para ver los lotes</div>';
        return;
    }

    let html = '';
    for (const grupo of groups) {
        const tallas = grupo.tallas;
        const colores = grupo.colores;

        html += '<table class="lotes-table"><thead><tr class="group-header"><td colspan="' + (tallas.length + 2) + '">' +
            '<span class="badge-op">OP ' + escapeHtml(String(grupo.op)) + '</span>' +
            escapeHtml(grupo.referencia) +
            '</td></tr><tr><th class="lotes-color-h">Color</th>';

        for (const talla of tallas) {
            html += '<th>' + escapeHtml(talla) + '</th>';
        }
        html += '<th class="lotes-total-h">Total</th></tr></thead><tbody>';

        let totalGral = 0;
        for (const color of colores) {
            html += '<tr><td class="color-cell">' + escapeHtml(color.color) + '</td>';
            let totalColor = 0;
            for (const talla of tallas) {
                const cantidad = color.curva[talla] || 0;
                totalColor += cantidad;
                totalGral += cantidad;
                html += '<td class="' + (cantidad > 0 ? 'cantidad-cell' : 'cantidad-0') + '">' + (cantidad > 0 ? cantidad : '-') + '</td>';
            }
            html += '<td class="lotes-total-cell">' + totalColor + '</td></tr>';
        }

        html += '<tr class="lotes-grand-total"><td>TOTAL</td>';
        for (const talla of tallas) {
            let totalTalla = 0;
            for (const color of colores) {
                totalTalla += color.curva[talla] || 0;
            }
            html += '<td>' + totalTalla + '</td>';
        }
        html += '<td>' + totalGral + '</td></tr></tbody></table>';
    }
    container.innerHTML = html;
}

/**
 * Resalta el JSON con colores usando la paleta del diseño de la página:
 * llaves (índigo), strings (verde), números (ámbar), booleanos (rojo), null (gris).
 */
function highlightJSON(jsonText) {
    return jsonText.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
            let cls = 'json-num';
            let out = match;
            if (match.charAt(0) === '"') {
                cls = /:$/.test(match) ? 'json-key' : 'json-str';
                out = escapeHtml(match);
            } else if (match === 'true' || match === 'false') {
                cls = 'json-bool';
            } else if (match === 'null') {
                cls = 'json-null';
            }
            return '<span class="' + cls + '">' + out + '</span>';
        }
    );
}

function renderJSONView(filtered) {
    const pre = document.getElementById('jsonContent');
    if (pre) pre.innerHTML = highlightJSON(JSON.stringify(filtered || [], null, 2));
}

function updateLotesStats(filtered) {
    const opsEl = document.getElementById('lotesStatOps');
    const extEl = document.getElementById('lotesStatExt');
    const srcEl = document.getElementById('lotesSource');

    let totalExt = 0;
    (filtered || []).forEach(g => { totalExt += g.extensiones.length; });

    if (opsEl) opsEl.textContent = String((filtered || []).length);
    if (extEl) extEl.textContent = String(totalExt);
    if (srcEl) {
        if (!jsonData.length) srcEl.textContent = 'Sin datos';
        else if (dataMode === 'excel') srcEl.textContent = 'Excel: ' + sourceName;
        else if (dataMode === 'csv') srcEl.textContent = 'CSV: ' + sourceName;
        else srcEl.textContent = 'Pegado';
    }
}

/**
 * Procesa un archivo de datos (.xlsx / .xls / .csv) y lo convierte al MISMO JSON.
 * - Excel: mapeo posicional de colección (Ref B · OP D · Color M · Curva O→AS).
 * - CSV:   mismos encabezados que el pegado (Numlote · Ref · Color · Colores · Talla · Total Und).
 */
function handleExcelFile(file) {
    if (!file) return;
    if (/\.csv$/i.test(file.name)) {
        handleCsvFile(file);
        return;
    }
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
        showToast('Solo archivos .xlsx, .xls o .csv', 'error');
        return;
    }
    if (typeof XLSX === 'undefined') {
        showToast('No se pudo cargar el lector de Excel (CDN). Revisa tu conexión.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

            const parsed = buildColeccionJSON(matrix);
            if (!parsed.length) {
                showToast('El Excel no contiene lotes con curva válida (Ref B · OP D · Color M · Tallas O→AS).', 'error');
                return;
            }

            jsonData = parsed;
            dataMode = 'excel';
            sourceName = file.name;

            rawHeaders = [];
            rawGrid = [];
            colMapping = {};
            renderExcelGrid();
            refreshDerivedViews();
            showToast('Excel procesado: ' + jsonData.length + ' OP(s).', 'success');
        } catch (err) {
            console.error('Error al procesar el Excel:', err);
            showToast('Error al procesar el Excel: ' + err.message, 'error');
        }
    };
    reader.onerror = function () {
        showToast('Error al leer el archivo.', 'error');
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Procesa un archivo CSV con el mismo flujo que el pegado de tabla:
 * separadores \t o ;, encabezados Numlote · Ref · Color · Colores · Talla · Total Und.
 */
function handleCsvFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const text = String(e.target.result || '');
            const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim() !== '');
            if (!lines.length) {
                showToast('El archivo CSV está vacío.', 'error');
                return;
            }

            rawHeaders = [];
            rawGrid = [];
            colMapping = {};
            const ok = parseTabular(lines);
            if (!ok || !rawGrid.length) {
                showToast('El CSV no contiene datos válidos (encabezados: Numlote · Ref · Color · Colores · Talla · Total Und).', 'error');
                return;
            }

            dataMode = 'csv';
            sourceName = file.name;
            renderExcelGrid();
            refreshDerivedViews();
            showToast('CSV procesado: ' + jsonData.length + ' OP(s).', 'success');
        } catch (err) {
            console.error('Error al procesar el CSV:', err);
            showToast('Error al procesar el CSV: ' + err.message, 'error');
        }
    };
    reader.onerror = function () {
        showToast('Error al leer el archivo.', 'error');
    };
    reader.readAsText(file);
}

function downloadCSV() {
    if (!jsonData.length) return;

    const lines = ['REFERENCIA;OP;COLOR;TALLA;CANTIDAD'];
    jsonData.forEach(g => {
        g.extensiones.forEach(e => {
            lines.push(`"${String(g.referencia).replace(/"/g, '""')}";${g.op};"${String(e.color).replace(/"/g, '""')}";"${String(e.talla).replace(/"/g, '""')}";${e.cantidad}`);
        });
    });
    const csvContent = `\uFEFF${lines.join('\n')}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programacion_taller_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyJSON() {
    if (!jsonData.length) return;
    const data = jsonData;

    navigator.clipboard.writeText(JSON.stringify(data, null, '\t')).then(() => {
        const btn = document.getElementById('btnProgCopyJSON');
        if (btn) {
            const prev = btn.innerHTML;
            btn.innerHTML = 'Copiado';
            setTimeout(() => { btn.innerHTML = prev; }, 2000);
        }
    });
}

function clearData() {
    rawHeaders = [];
    rawGrid = [];
    colMapping = {};
    jsonData = [];
    dataMode = '';
    sourceName = '';
    viewMode = 'lotes';

    const filterInput = document.getElementById('progFilterOp');
    if (filterInput) filterInput.value = '';

    renderExcelGrid();
    refreshDerivedViews();
    applyViewMode();
    showToast('Todos los datos fueron limpiados.', 'success');
}

/* ─── MODAL ASENTAR PROGRAMACIÓN (CALENDARIO COMPACTO) ──────────── */

let calCurrentYear = new Date().getFullYear();
let calCurrentMonth = new Date().getMonth();
let selectedDateStr = new Date().toISOString().slice(0, 10);

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function renderCalendar() {
    const label = document.getElementById('calCurrentMonthLabel');
    const grid = document.getElementById('calDaysGrid');
    const inputHidden = document.getElementById('inputAsentarProgDate');
    if (!grid) return;

    if (label) {
        label.textContent = `${MONTH_NAMES[calCurrentMonth]} ${calCurrentYear}`;
    }

    if (inputHidden) {
        inputHidden.value = selectedDateStr;
    }

    // Calcular días y posición de inicio
    const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
    const startCol = (firstDayIndex + 6) % 7; // Lunes = 0 .. Domingo = 6
    const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    let html = '';
    for (let i = 0; i < startCol; i++) {
        html += `<div class="cal-day-cell is-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dStr === todayStr;
        const isSelected = dStr === selectedDateStr;

        let classes = 'cal-day-cell';
        if (isToday) classes += ' is-today';
        if (isSelected) classes += ' is-selected';

        html += `<div class="${classes}" data-date="${dStr}">${d}</div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.cal-day-cell:not(.is-empty)').forEach(cell => {
        cell.addEventListener('click', () => {
            selectedDateStr = cell.dataset.date;
            renderCalendar();
        });
    });
}

export function openAsentarModal() {
    if (!rawGrid.length) {
        showToast('Primero pega o ingresa datos para asentar.', 'error');
        return;
    }

    const today = new Date();
    selectedDateStr = today.toISOString().slice(0, 10);
    calCurrentYear = today.getFullYear();
    calCurrentMonth = today.getMonth();

    renderCalendar();

    if (DOM.asentarProgModal) {
        DOM.asentarProgModal.classList.remove('hidden');
    }
}

export function closeAsentarModal() {
    if (DOM.asentarProgModal) {
        DOM.asentarProgModal.classList.add('hidden');
    }
}

export async function submitAsentarModal() {
    const fechaProg = selectedDateStr || document.getElementById('inputAsentarProgDate')?.value;
    if (!fechaProg) {
        showToast('Por favor selecciona la fecha de programación.', 'error');
        return;
    }

    const rows = jsonData;
    if (!rows.length) {
        showToast('No hay datos válidos para asentar.', 'error');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitAsentarProgModal');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Asentando...</span>`;
    }

    try {
        await asentarProgramacionToGAS(rows, fechaProg, '');
        const totalExtensiones = rows.reduce((acc, r) => acc + r.extensiones.length, 0);
        showToast(`Se asentaron ${rows.length} OP(s) con ${totalExtensiones} extensiones en DESPACHOS_N.`, 'success');
        clearData();
        closeAsentarModal();
    } catch (err) {
        console.error('Error al asentar:', err);
        showToast('Error al conectar con Google Sheets.', 'error');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Asentar</span>`;
        }
    }
}

/* ─── 7. INICIALIZACIÓN ──────────────────────────────────────────────────── */

export function initProgramacionView() {
    const zone = document.getElementById('progExcelZone');
    if (!zone) return;

    document.addEventListener('paste', e => {
        // Programación es la única vista de la app: el pegado global siempre está activo
        const activeTab = 'programacion';
        if (activeTab === 'programacion') {
            if (e.target.classList.contains('xls-cell')) return;
            e.preventDefault();
            handleIncomingPaste(e.clipboardData);
        }
    });

    zone.addEventListener('paste', e => {
        if (e.target.classList.contains('xls-cell')) return;
        e.preventDefault();
        handleIncomingPaste(e.clipboardData);
    });

    document.addEventListener('click', e => {
        if (e.target.closest('#btnTriggerPaste')) {
            navigator.clipboard.read().then(items => {
                for (const item of items) {
                    if (item.types.includes('text/html')) {
                        item.getType('text/html').then(blob => blob.text()).then(html => {
                            parseFromHTML(html);
                            renderExcelGrid();
                        });
                        return;
                    } else if (item.types.includes('text/plain')) {
                        item.getType('text/plain').then(blob => blob.text()).then(text => {
                            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            parseTabular(lines);
                            renderExcelGrid();
                        });
                        return;
                    }
                }
            }).catch(() => {
                alert('Presiona Ctrl + V directamente en el recuadro para pegar.');
            });
        }

        if (e.target.closest('#btnProgUploadEmpty')) {
            document.getElementById('progFileInput')?.click();
        }
    });

    // Botones de acción
    document.getElementById('btnProgSave')?.addEventListener('click', downloadCSV);
    document.getElementById('btnProgCopyJSON')?.addEventListener('click', copyJSON);
    document.getElementById('btnProgClear')?.addEventListener('click', clearData);
    document.getElementById('btnProgAsentar')?.addEventListener('click', openAsentarModal);

    // Cargar archivo (Excel/CSV) — input compartido
    document.getElementById('progFileInput')?.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) handleExcelFile(e.target.files[0]);
        e.target.value = '';
    });

    // Ver / Ocultar el plano (reemplaza la vista completa)
    document.getElementById('btnProgToggleSheet')?.addEventListener('click', () => {
        viewMode = viewMode === 'plano' ? 'lotes' : 'plano';
        applyViewMode();
    });

    // Ver / Ocultar el JSON (reemplaza la vista completa)
    document.getElementById('btnProgToggleJson')?.addEventListener('click', () => {
        viewMode = viewMode === 'json' ? 'lotes' : 'json';
        applyViewMode();
    });
    document.getElementById('btnProgCopyJsonView')?.addEventListener('click', copyJSON);

    // Filtro de OP en la vista de lotes
    document.getElementById('progFilterOp')?.addEventListener('input', refreshDerivedViews);
    document.getElementById('btnProgClearFilter')?.addEventListener('click', () => {
        const inp = document.getElementById('progFilterOp');
        if (inp) { inp.value = ''; refreshDerivedViews(); inp.focus(); }
    });

    // Drag & drop de Excel sobre la zona de pegado
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            if (/\.(xlsx|xls)$/i.test(files[0].name)) {
                handleExcelFile(files[0]);
            } else {
                showToast('Solo archivos .xlsx o .xls', 'error');
            }
        } else if (e.dataTransfer.getData('text/html') || e.dataTransfer.getData('text/plain')) {
            handleIncomingPaste(e.dataTransfer);
        }
    });

    // Eventos del Modal Asentar (Calendario)
    DOM.btnCloseAsentarProgModal?.addEventListener('click', closeAsentarModal);
    document.getElementById('btnSubmitAsentarProgModal')?.addEventListener('click', submitAsentarModal);

    // Navegación de meses del calendario
    document.getElementById('btnCalPrevMonth')?.addEventListener('click', () => {
        calCurrentMonth--;
        if (calCurrentMonth < 0) {
            calCurrentMonth = 11;
            calCurrentYear--;
        }
        renderCalendar();
    });

    document.getElementById('btnCalNextMonth')?.addEventListener('click', () => {
        calCurrentMonth++;
        if (calCurrentMonth > 11) {
            calCurrentMonth = 0;
            calCurrentYear++;
        }
        renderCalendar();
    });

    renderExcelGrid();
}
