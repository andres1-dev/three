/**
 * Data Parser
 * Parseo de datos desde texto a matriz
 * MANTIENE los tabuladores EXACTAMENTE como vienen de Excel
 */

export class DataParser {
    /**
     * Parsea texto crudo a matriz de headers y filas
     * @param {string} rawText - Texto crudo con tabuladores de Excel
     * @returns {Object} { headers, rows }
     */
    parse(rawText) {
        if (!rawText || !rawText.trim()) {
            return { headers: [], rows: [] };
        }

        // Dividir en líneas
        const lines = rawText.split(/\r?\n/);

        if (lines.length === 0) {
            return { headers: [], rows: [] };
        }

        // Parsear cada línea manteniendo TODOS los tabuladores
        const matrix = lines.map(line => this.parseLine(line));

        // Filtrar líneas completamente vacías
        const nonEmptyMatrix = matrix.filter(row => {
            return row.some(cell => cell && cell.trim().length > 0);
        });

        if (nonEmptyMatrix.length === 0) {
            return { headers: [], rows: [] };
        }

        // Primera fila = headers
        const headers = nonEmptyMatrix[0].map(h => String(h || '').trim());
        
        // Resto = filas de datos
        const rows = nonEmptyMatrix.slice(1);

        // Normalizar todas las filas al mismo número de columnas que el header
        const normalizedRows = rows.map(row => this.normalizeRow(row, headers.length));

        return { headers, rows: normalizedRows };
    }

    /**
     * Parsea una línea dividiendo por tabuladores
     * MANTIENE las celdas vacías (tabuladores consecutivos)
     * @param {string} line - Línea de texto
     * @returns {Array} Array de celdas
     */
    parseLine(line) {
        // Dividir por tabulador manteniendo vacíos
        // IMPORTANTE: No usar filter() para no eliminar vacíos
        const cells = line.split('\t');
        
        // Trim cada celda pero mantener estructura
        // Si una celda es solo espacios, convertir a string vacío
        return cells.map(cell => {
            const trimmed = cell.trim();
            return trimmed;
        });
    }

    /**
     * Normaliza una fila al número de columnas esperado
     * @param {Array} row - Fila de datos
     * @param {number} expectedLength - Número de columnas esperado
     * @returns {Array} Fila normalizada
     */
    normalizeRow(row, expectedLength) {
        // Si la fila tiene menos columnas, rellenar con vacíos
        if (row.length < expectedLength) {
            const missing = expectedLength - row.length;
            return [...row, ...Array(missing).fill('')];
        }
        
        // Si la fila tiene más columnas, truncar
        if (row.length > expectedLength) {
            return row.slice(0, expectedLength);
        }
        
        return row;
    }
}
