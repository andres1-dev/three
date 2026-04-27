/**
 * Table Renderer
 * Renderizado de tabla con Grid.js
 */

export class TableRenderer {
    constructor(domManager) {
        this.dom = domManager;
        this.currentGrid = null;
    }

    /**
     * Renderiza la tabla de preview
     * @param {Array} headers - Headers
     * @param {Array} rows - Filas de datos
     */
    render(headers, rows) {
        const wrapper = this.dom.get('gridWrapper');

        if (!wrapper || headers.length === 0 || rows.length === 0) {
            this.showEmptyMessage();
            return;
        }

        // Limitar a las primeras 12 columnas para preview
        const previewHeaders = headers.slice(0, 12);
        const columns = previewHeaders.map(h => ({
            id: h,
            name: h,
            sort: true,
            width: 'auto'
        }));

        // Limitar a las primeras 50 filas para preview
        const previewRows = rows.slice(0, 50).map(row => {
            const obj = {};
            previewHeaders.forEach((h, idx) => {
                obj[h] = (row[idx] !== undefined) ? String(row[idx]) : '';
            });
            return obj;
        });

        // Destruir grid anterior si existe
        this.clear();

        // Crear nuevo grid
        try {
            this.currentGrid = new gridjs.Grid({
                columns: columns,
                data: previewRows,
                search: true,
                sort: true,
                pagination: {
                    enabled: true,
                    limit: 8,
                    summary: true
                },
                language: {
                    search: '<i class="fas fa-search"></i> Buscar...',
                    pagination: {
                        previous: 'Anterior',
                        next: 'Siguiente',
                        showing: 'Mostrando',
                        of: 'de',
                        to: 'a',
                        results: 'resultados'
                    }
                }
            }).render(wrapper);
        } catch (error) {
            console.error('Error al renderizar tabla:', error);
            this.showEmptyMessage();
        }
    }

    /**
     * Muestra mensaje de tabla vacía
     */
    showEmptyMessage() {
        const wrapper = this.dom.get('gridWrapper');
        if (wrapper) {
            wrapper.innerHTML = 
                '<div class="info-message"><i class="fas fa-database"></i> Vista previa de los datos</div>';
        }
    }

    /**
     * Limpia la tabla
     */
    clear() {
        if (this.currentGrid) {
            try {
                this.currentGrid.destroy();
            } catch (e) {
                console.warn('Error al destruir grid:', e);
            }
            this.currentGrid = null;
        }

        const wrapper = this.dom.get('gridWrapper');
        if (wrapper) {
            wrapper.innerHTML = '';
        }
    }
}
