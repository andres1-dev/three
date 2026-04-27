/**
 * DOM Manager
 * Gestión centralizada de elementos del DOM
 */

export class DOMManager {
    constructor() {
        this.elements = this.cacheElements();
        this.spreadsheet = null; // Instancia de jspreadsheet
    }

    /**
     * Cachea referencias a elementos del DOM
     * @returns {Object} Objeto con referencias a elementos
     */
    cacheElements() {
        return {
            // Spreadsheet container
            spreadsheetContainer: document.getElementById('spreadsheet'),
            
            // Buttons
            processBtn: document.getElementById('processBtn'),
            clearBtn: document.getElementById('clearBtn'),
            downloadJsonBtn: document.getElementById('downloadJsonBtn'),
            copyJsonBtn: document.getElementById('copyJsonBtn'),
            uploadBtn: document.getElementById('uploadBtn'),
            
            // Status
            statusBadge: document.getElementById('statusBadge'),
            statsArea: document.getElementById('statsArea'),
            
            // Stats
            colCount: document.getElementById('colCount'),
            rowCount: document.getElementById('rowCount'),
            headerType: document.getElementById('headerType'),
            
            // JSON Preview
            jsonPreview: document.getElementById('jsonPreview'),
            jsonContent: document.getElementById('jsonContent'),
            jsonCount: document.getElementById('jsonCount'),
            
            // Table
            gridWrapper: document.getElementById('gridjs-wrapper'),

            // Results View
            spreadsheetSection: document.getElementById('spreadsheet-section'),
            resultsView: document.getElementById('results-view'),
            resUpdated: document.getElementById('res-updated'),
            resInserted: document.getElementById('res-inserted'),
            resErrors: document.getElementById('res-errors'),
            backToTableBtn: document.getElementById('backToTableBtn'),
            
            // JSON Actions
            viewJsonBtn: document.getElementById('viewJsonBtn'),
            downloadJsonBtnAlt: document.getElementById('downloadJsonBtnAlt'),
            copyJsonBtnAlt: document.getElementById('copyJsonBtnAlt'),
            downloadFullCsvBtn: document.getElementById('downloadFullCsvBtn')
        };
    }

    /**
     * Inicializa el spreadsheet tipo Excel
     * @param {Function} onPasteCallback - Callback opcional para el evento paste
     */
    initSpreadsheet(onPasteCallback = null) {
        const container = this.elements.spreadsheetContainer;
        
        // Configuración del spreadsheet
        this.spreadsheet = jspreadsheet(container, {
            data: [[]],
            minDimensions: [26, 10], // Mínimo 26 columnas (CONFECCION), 10 filas
            tableOverflow: true,
            tableWidth: '100%',
            tableHeight: '400px',
            columnSorting: false,
            allowInsertRow: true,
            allowInsertColumn: true,
            allowDeleteRow: true,
            allowDeleteColumn: true,
            allowRenameColumn: false,
            allowComments: false,
            wordWrap: true,
            csvFileName: 'datos',
            text: {
                noRecordsFound: 'Pegue datos desde Excel aquí (Ctrl+V o Cmd+V)',
                showingPage: 'Mostrando página {0} de {1}',
                show: 'Mostrar',
                entries: 'registros',
                insertANewColumnBefore: 'Insertar columna antes',
                insertANewColumnAfter: 'Insertar columna después',
                deleteSelectedColumns: 'Eliminar columnas',
                renameThisColumn: 'Renombrar columna',
                orderAscending: 'Orden ascendente',
                orderDescending: 'Orden descendente',
                insertANewRowBefore: 'Insertar fila antes',
                insertANewRowAfter: 'Insertar fila después',
                deleteSelectedRows: 'Eliminar filas',
                editComments: 'Editar comentarios',
                addComments: 'Agregar comentarios',
                comments: 'Comentarios',
                clearComments: 'Limpiar comentarios',
                copy: 'Copiar',
                paste: 'Pegar',
                saveAs: 'Guardar como',
                about: 'Acerca de',
                areYouSureToDeleteTheSelectedRows: '¿Eliminar las filas seleccionadas?',
                areYouSureToDeleteTheSelectedColumns: '¿Eliminar las columnas seleccionadas?',
                thisActionWillDestroyAnyExistingMergedCellsAreYouSure: 'Esta acción destruirá las celdas combinadas. ¿Continuar?',
                thisActionWillClearYourSearchResultsAreYouSure: 'Esta acción limpiará los resultados de búsqueda. ¿Continuar?',
                thereIsAConflictWithAnotherMergedCell: 'Conflicto con otra celda combinada',
                invalidMergeProperties: 'Propiedades de combinación inválidas',
                cellAlreadyMerged: 'Celda ya combinada',
                noCellsSelected: 'No hay celdas seleccionadas'
            },
            onpaste: (instance, data) => {
                
                if (onPasteCallback) {
                    // Dar un pequeño respiro para que el DOM se actualice con los datos pegados
                    setTimeout(() => onPasteCallback(), 100);
                }
            }
        });
        
        
    }

    /**
     * Obtiene un elemento del DOM
     * @param {string} key - Clave del elemento
     * @returns {HTMLElement}
     */
    get(key) {
        return this.elements[key];
    }

    /**
     * Obtiene los datos del spreadsheet en formato texto con tabuladores
     * PRESERVA todas las celdas vacías correctamente
     * @returns {string}
     */
    getSpreadsheetData() {
        if (!this.spreadsheet) {
            return '';
        }
        
        // Obtener todos los datos del spreadsheet
        const data = this.spreadsheet.getData();
        
        // Filtrar filas completamente vacías
        const nonEmptyRows = data.filter(row => {
            return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        });
        
        if (nonEmptyRows.length === 0) {
            return '';
        }
        
        // Convertir a formato TSV preservando TODAS las celdas vacías
        const tsvData = nonEmptyRows.map(row => {
            // Convertir cada celda, manteniendo vacíos como string vacío
            return row.map(cell => {
                // Si la celda es null, undefined o vacía, retornar string vacío
                if (cell === null || cell === undefined || cell === '') {
                    return '';
                }
                // Convertir a string y hacer trim
                return String(cell).trim();
            }).join('\t'); // Unir con tabulador
        }).join('\n'); // Unir filas con salto de línea
        
        return tsvData;
    }

    /**
     * Limpia el spreadsheet
     */
    clearSpreadsheet() {
        if (this.spreadsheet) {
            this.spreadsheet.setData([[]]);
        }
    }

    /**
     * Muestra u oculta un elemento
     * @param {string} key - Clave del elemento
     * @param {boolean} show - Mostrar u ocultar
     */
    toggleElement(key, show) {
        const element = this.get(key);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Habilita o deshabilita un botón
     * @param {string} key - Clave del botón
     * @param {boolean} enabled - Habilitar o deshabilitar
     */
    toggleButton(key, enabled) {
        const button = this.get(key);
        if (button) {
            button.disabled = !enabled;
            button.style.opacity = enabled ? '1' : '0.5';
        }
    }
}
