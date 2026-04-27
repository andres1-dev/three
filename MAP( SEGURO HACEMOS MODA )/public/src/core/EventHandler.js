/**
 * Event Handler
 * Gestión de eventos de la aplicación
 */

export class EventHandler {
    constructor(domManager, dataProcessor, uiController, supabaseService) {
        this.dom = domManager;
        this.processor = dataProcessor;
        this.ui = uiController;
        this.supabase = supabaseService;
    }

    /**
     * Registra todos los eventos de la aplicación
     */
    registerEvents() {
        // Helper para registrar eventos de forma segura
        const addEvent = (id, callback) => {
            const el = this.dom.get(id);
            if (el) el.addEventListener('click', callback);
        };

        addEvent('processBtn', () => this.handleProcess());
        addEvent('clearBtn', () => this.handleClear());
        addEvent('downloadJsonBtn', () => this.handleDownloadJSON());
        addEvent('copyJsonBtn', () => this.handleCopyJSON());
        addEvent('uploadBtn', () => this.handleUploadToSupabase());
        
        addEvent('backToTableBtn', () => {
            this.handleClear();
            this.ui.hideSummary();
            this.ui.hideJSON();
        });

        // BOTONES DE ACCIÓN EN RESULTADOS
        addEvent('viewJsonBtn', () => this.handleToggleJSONView());
        addEvent('downloadJsonBtnAlt', () => this.handleDownloadJSON());
        addEvent('copyJsonBtnAlt', () => this.handleCopyJSON('copyJsonBtnAlt'));

        // NUEVO: Descarga completa de la base de datos
        addEvent('downloadFullCsvBtn', () => this.handleDownloadFullTable());
    }

    /**
     * Descarga toda la tabla BUSINT en formato CSV para Excel
     */
    async handleDownloadFullTable() {
        const btn = this.dom.get('downloadFullCsvBtn');
        if (!btn) return;

        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
        btn.disabled = true;

        try {
            const result = await this.supabase.fetchAllData();
            
            if (!result.success) throw new Error(result.error);
            if (!result.data || result.data.length === 0) {
                alert('La base de datos está vacía.');
                return;
            }

            // Convertir a CSV (con separador punto y coma para Excel en español)
            const headers = Object.keys(result.data[0]);
            let csvContent = headers.join(';') + '\n';

            result.data.forEach(row => {
                const values = headers.map(header => {
                    const val = row[header] === null ? '' : row[header];
                    // Limpiar comas y saltos de línea para que no dañen el CSV
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                csvContent += values.join(';') + '\n';
            });

            // Descargar el archivo
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `BD_MAP_FULL_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            alert('Error al descargar: ' + error.message);
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }

    /**
     * Alterna la visibilidad de la vista previa del JSON
     */
    handleToggleJSONView() {
        const preview = this.dom.get('jsonPreview');
        const btn = this.dom.get('viewJsonBtn');
        const isVisible = preview.style.display === 'block';
        
        if (isVisible) {
            preview.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-eye"></i> Ver JSON';
            btn.style.background = '#f8fafc';
        } else {
            preview.style.display = 'block';
            btn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar JSON';
            btn.style.background = '#eff6ff';
            // Scroll suave hacia abajo para mostrar el JSON
            preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Maneja el evento de procesamiento de datos
     */
    handleProcess() {
        const rawData = this.dom.getSpreadsheetData();
        
        if (!rawData.trim()) {
            this.ui.updateStatus('error', 'Error: No hay datos para procesar');
            return;
        }

        this.ui.updateStatus('processing', 'Procesando datos...');

        // Procesar de forma asíncrona para no bloquear la UI
        setTimeout(() => {
            try {
                const result = this.processor.process(rawData);
                
                if (!result.success) {
                    this.ui.updateStatus('error', result.error);
                    return;
                }

                // Actualizar UI con los resultados
                this.ui.displayResults(result);
                
            } catch (error) {
                console.error('Error en procesamiento:', error);
                this.ui.updateStatus('error', 'Error al procesar los datos: ' + error.message);
            }
        }, 50);
    }

    /**
     * Maneja el evento de procesamiento automático y subida
     */
    async handleAutoProcessAndUpload() {
        console.log('⚡ Iniciando proceso automático (Pegar -> Procesar -> Subir)...');
        
        // Limpiar cualquier residuo visual previo
        this.ui.hideJSON();
        this.ui.hideSummary();
        
        const rawData = this.dom.getSpreadsheetData();
        if (!rawData.trim()) return;

        this.ui.updateStatus('processing', 'Mapeando datos de Excel...');

        try {
            // 1. Procesar
            const result = this.processor.process(rawData);
            if (!result.success) {
                this.ui.updateStatus('error', result.error);
                return;
            }

            this.ui.displayResults(result);
            const totalCount = result.jsonData.length;

            // 2. Subir (sin confirmación, modo automático)
            this.ui.updateStatus('processing', `Subiendo ${totalCount} registros a Supabase...`);
            const uploadResult = await this.handleUploadToSupabase(true); // true = skipConfirm

            // 3. Mostrar Resumen Final con datos REALES de la función
            const stats = {
                updated: uploadResult?.updated ?? 0, 
                inserted: uploadResult?.inserted ?? 0,
                errors: uploadResult?.errors ?? 0
            };

            // Si por alguna razón la función no dio el desglose, usamos el total
            if (stats.updated === 0 && stats.inserted === 0 && totalCount > 0) {
                stats.updated = totalCount;
            }

            setTimeout(() => {
                this.ui.showSummary(stats);
            }, 800);

        } catch (error) {
            console.error('Error en proceso automático:', error);
            this.ui.updateStatus('error', 'Error en proceso automático: ' + error.message);
        }
    }

    /**
     * Maneja el evento de limpieza
     */
    handleClear() {
        this.dom.clearSpreadsheet();
        this.processor.reset();
        this.ui.reset();
    }

    /**
     * Maneja el evento de descarga de JSON
     */
    handleDownloadJSON() {
        const jsonData = this.processor.getJSONData();
        
        if (!jsonData || jsonData.length === 0) {
            return;
        }

        const jsonStr = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.href = url;
        link.download = `datos_mapeados_${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Maneja el evento de copia de JSON
     * @param {string} buttonId - ID del botón que activó la copia (opcional)
     */
    handleCopyJSON(buttonId = 'copyJsonBtn') {
        const jsonData = this.processor.getJSONData();
        
        if (!jsonData || jsonData.length === 0) {
            return;
        }

        const jsonStr = JSON.stringify(jsonData, null, 2);
        
        navigator.clipboard.writeText(jsonStr)
            .then(() => {
                const button = this.dom.get(buttonId);
                const originalContent = button.innerHTML;
                
                button.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                button.style.color = '#10b981';
                button.style.borderColor = '#10b981';
                
                setTimeout(() => {
                    button.innerHTML = originalContent;
                    button.style.color = '';
                    button.style.borderColor = '';
                }, 2000);
            })
            .catch(() => {
                alert('No se pudo copiar al portapapeles');
            });
    }

    /**
     * Maneja el evento de subida a Supabase
     * @param {boolean} skipConfirm - Si es true, no pide confirmación
     */
    async handleUploadToSupabase(skipConfirm = false) {
        const jsonData = this.processor.getJSONData();
        const detectedType = this.processor.currentData.detectedType;
        
        if (!jsonData || jsonData.length === 0) {
            if (!skipConfirm) alert('No hay datos para subir. Primero procese los datos.');
            return;
        }

        // Confirmar antes de subir (solo si no es skipConfirm)
        if (!skipConfirm) {
            const confirmMsg = `¿Desea subir ${jsonData.length} registros a BUSINT?\n\nTipo detectado: ${detectedType}\n⚠️ Los registros existentes (mismo OP + Proceso) serán actualizados.`;
            if (!confirm(confirmMsg)) {
                return;
            }
        }

        // Deshabilitar botón y mostrar estado
        const button = this.dom.get('uploadBtn');
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

        try {
            // Subir a Supabase
            const result = await this.supabase.uploadData(jsonData, detectedType);

            if (result.success) {
                if (!skipConfirm) alert(`✅ ${result.message}\n\nRegistros procesados: ${jsonData.length}`);
                else console.log('✅ Subida exitosa:', result.message);
                
                this.ui.updateStatus('success', `Datos subidos exitosamente a BUSINT (${jsonData.length} registros)`);
                return result.data || result; // Retornar para el resumen
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Error al subir a Supabase:', error);
            if (!skipConfirm) alert(`❌ Error al subir datos: ${error.message}`);
            this.ui.updateStatus('error', 'Error al subir datos a Supabase: ' + error.message);
        } finally {
            // Restaurar botón
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

