/**
 * UI Controller
 * Controlador de la interfaz de usuario
 */

import { TableRenderer } from '../utils/TableRenderer.js';

export class UIController {
    constructor(domManager) {
        this.dom = domManager;
        this.tableRenderer = new TableRenderer(domManager);
    }

    /**
     * Inicializa la interfaz de usuario
     */
    initialize() {
        this.updateStatus('idle', 'Esperando datos');
    }

    /**
     * Actualiza el estado de la aplicación
     * @param {string} status - Estado: idle, processing, success, error
     * @param {string} message - Mensaje a mostrar
     */
    updateStatus(status, message) {
        const badge = this.dom.get('statusBadge');
        if (!badge) return;
        
        // Remover clases previas
        badge.classList.remove('status-idle', 'status-success', 'status-error', 'status-processing');
        
        switch (status) {
            case 'idle':
                badge.classList.add('status-idle');
                badge.innerHTML = `<i class="fas fa-circle" style="font-size: 0.6rem;"></i><span>${message}</span>`;
                this.hideStats();
                this.hideJSON();
                this.disableJSONButtons();
                break;
                
            case 'processing':
                badge.classList.add('status-processing');
                badge.innerHTML = `<i class="fas fa-spinner fa-pulse"></i><span>${message}</span>`;
                break;
                
            case 'success':
                badge.classList.add('status-success');
                badge.innerHTML = `<i class="fas fa-check-circle"></i><span>${message}</span>`;
                break;
                
            case 'error':
                badge.classList.add('status-error');
                badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${message}</span>`;
                this.hideStats();
                this.hideJSON();
                this.disableJSONButtons();
                break;
        }
    }

    /**
     * Muestra los resultados del procesamiento
     * @param {Object} result - Resultado del procesamiento
     */
    displayResults(result) {
        const { headers, rows, jsonData, detectedType } = result;
        
        // Actualizar estadísticas
        const originalRowCount = rows.length;
        const validRowCount = jsonData.length;
        const skippedRows = originalRowCount - validRowCount;
        
        this.showStats(headers.length, validRowCount, detectedType, skippedRows);
        
        // Preparar JSON internamente pero NO mostrar el contenedor por defecto
        this.showJSON(jsonData, false);
        
        // Habilitar botones
        this.enableJSONButtons();
        
        // Actualizar estado
        const typeLabel = detectedType === 'CONFECCION' ? 'Confección' : 'Procesos';
        let statusMsg = `Listo: ${validRowCount} filas procesadas | ${typeLabel}`;
        this.updateStatus('success', statusMsg);
    }

    /**
     * Muestra las estadísticas
     */
    showStats(colCount, rowCount, headerType, skippedRows = 0) {
        const elCol = this.dom.get('colCount');
        const elRow = this.dom.get('rowCount');
        const elType = this.dom.get('headerType');
        
        if (elCol) elCol.textContent = colCount;
        if (elRow) elRow.textContent = rowCount;
        
        if (elType) {
            const typeLabel = headerType === 'CONFECCION' 
                ? 'Formato Confección (26 cols)' 
                : 'Formato Procesos (17 cols)';
            elType.textContent = typeLabel;
        }
        
        // Mostrar filas omitidas si hay
        const statsArea = this.dom.get('statsArea');
        if (statsArea) {
            const existingSkipped = statsArea.querySelector('.skipped-rows');
            if (existingSkipped) {
                existingSkipped.remove();
            }
            
            if (skippedRows > 0) {
                const skippedSpan = document.createElement('span');
                skippedSpan.className = 'skipped-rows';
                skippedSpan.innerHTML = `<i class="fas fa-exclamation-circle" style="color:#ffc107;"></i> ${skippedRows} filas vacías omitidas`;
                statsArea.appendChild(skippedSpan);
            }
            
            statsArea.style.display = 'flex';
        }
    }

    /**
     * Oculta las estadísticas
     */
    hideStats() {
        const el = this.dom.get('statsArea');
        if (el) el.style.display = 'none';
    }

    /**
     * Muestra el JSON generado
     * @param {Array|Object} jsonData - Datos procesados
     * @param {boolean} autoShow - Si debe mostrar el contenedor automáticamente
     */
    showJSON(jsonData, autoShow = true) {
        const jsonString = JSON.stringify(jsonData, null, 2);
        const elContent = this.dom.get('jsonContent');
        const elCount = this.dom.get('jsonCount');
        const elPreview = this.dom.get('jsonPreview');

        if (elContent) elContent.textContent = jsonString;
        if (elCount) elCount.textContent = `${jsonData.length} registros`;
        
        // Solo mostrar si se pide explícitamente
        if (elPreview && autoShow) {
            elPreview.style.display = 'block';
        }
    }

    /**
     * Oculta el JSON
     */
    hideJSON() {
        const el = this.dom.get('jsonPreview');
        if (el) el.style.display = 'none';
    }

    /**
     * Muestra el resumen de la operación
     * @param {Object} stats - Estadísticas { updated, inserted, errors }
     */
    showSummary(stats) {
        const spreadsheetSection = this.dom.get('spreadsheetSection');
        const resultsView = this.dom.get('resultsView');
        
        if (spreadsheetSection) spreadsheetSection.style.display = 'none';
        if (resultsView) resultsView.style.display = 'block';
        
        // Actualizar números con animación simple o directa
        if (this.dom.get('resUpdated')) this.dom.get('resUpdated').textContent = stats.updated || 0;
        if (this.dom.get('resInserted')) this.dom.get('resInserted').textContent = stats.inserted || 0;
        if (this.dom.get('resErrors')) this.dom.get('resErrors').textContent = stats.errors || 0;

        this.hideStats();
        this.hideJSON();
    }

    /**
     * Oculta el resumen y vuelve a la tabla
     */
    hideSummary() {
        const spreadsheetSection = this.dom.get('spreadsheetSection');
        const resultsView = this.dom.get('resultsView');
        
        if (spreadsheetSection) spreadsheetSection.style.display = 'block';
        if (resultsView) resultsView.style.display = 'none';
    }

    /**
     * Habilita los botones de JSON y Supabase
     */
    enableJSONButtons() {
        const tools = document.getElementById('action-tools');
        if (tools) {
            tools.style.opacity = '1';
            tools.style.pointerEvents = 'auto';
        }
    }

    /**
     * Deshabilitar los botones de JSON y Supabase
     */
    disableJSONButtons() {
        const tools = document.getElementById('action-tools');
        if (tools) {
            tools.style.opacity = '0';
            tools.style.pointerEvents = 'none';
        }
    }

    /**
     * Resetea la interfaz
     */
    reset() {
        this.hideSummary();
        this.initialize();
    }
}

