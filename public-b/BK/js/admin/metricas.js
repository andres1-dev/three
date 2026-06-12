/* ==========================================================================
   metricas.js — Lógica para el Dashboard Analítico
   ========================================================================== */

let rawData = [];
let filteredData = [];
let chartArea = null;
let chartTrend = null;
let chartItems = null;
let activeWeek = null;
let fpInstance = null;
let gsPlantas = []; // para enriquecer los csv si es posible
let resizeTimer = null;
let metricsResizeObserver = null;
let lastResponsiveIsMobile = null;
let areaChartMode = 'doughnut';

window.onload = async function() {
    // 1. Iniciar Auth si es necesario (ya lo hace auth.js y loadUsers)
    if (typeof loadUsers === 'function') {
        await loadUsers();
    }

    try {
        if (typeof fetchSecureConfig === 'function') await fetchSecureConfig();

        // 2. Cargar datos completos (activas y finalizadas)
        const [novedades, plantas] = await Promise.all([
            fetchNovedadesData(false, true), // incluirTodos = true
            typeof fetchPlantasData === 'function' ? fetchPlantasData() : Promise.resolve([])
        ]);

        rawData = novedades || [];
        filteredData = [...rawData];
        gsPlantas = plantas || [];
        
        console.log("[METRICAS] Datos cargados:", rawData.length);
        
        // 3. Ocultar loader y mostrar dashboard
        document.getElementById('loaderOverlay').style.display = 'none';
        document.getElementById('mainDashboard').style.display = 'block';

        initDashboard();
    } catch (error) {
        console.error("Error al cargar métricas:", error);
        document.getElementById('loaderOverlay').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
            <h3 style="font-weight: 700; color: #1e293b; margin: 0;">Error de Carga</h3>
            <p style="color: #64748b;">${error.message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Reintentar</button>
        `;
    }
};

function initDashboard() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    fpInstance = flatpickr("#dateRangePicker", {
        mode: "range",
        dateFormat: "Y-m-d",
        defaultDate: [firstDay, today],
        locale: "es",
        onChange: function(selectedDates) {
            // Filtrar automáticamente al seleccionar las dos fechas del rango
            if (selectedDates.length === 2) {
                window.applyFilters();
            }
        }
    });
    
    // Cerrar el FAB al tocar fuera de él
    document.addEventListener('click', function(e) {
        const container = document.querySelector('.actions-container');
        if (container && container.classList.contains('open') && !container.contains(e.target)) {
            container.classList.remove('open');
        }
    });

    window.applyFilters();
    initResponsiveCharts();
}

window.viewAllData = function() {
    if (!rawData || rawData.length === 0) return;
    
    const dates = rawData.map(n => new Date(n.FECHA)).filter(d => !isNaN(d));
    if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        if (fpInstance) {
            fpInstance.setDate([minDate, maxDate]);
        }
        
        window.applyFilters();
    }
};

window.setAreaChartMode = function(mode) {
    if (!['doughnut', 'radar'].includes(mode) || areaChartMode === mode) return;
    areaChartMode = mode;
    updateAreaModeButtons();
    updateCharts();
};

window.applyFilters = function() {
    let start = null;
    let end = null;
    
    if (fpInstance && fpInstance.selectedDates.length > 0) {
        start = new Date(fpInstance.selectedDates[0]);
        if (fpInstance.selectedDates.length > 1) {
            end = new Date(fpInstance.selectedDates[1]);
        } else {
            end = new Date(fpInstance.selectedDates[0]);
        }
    }
    
    if (end) end.setHours(23, 59, 59);

    filteredData = rawData.filter(n => {
        const d = new Date(n.FECHA);
        const matchDate = (!start || isNaN(start) || d >= start) && (!end || isNaN(end) || d <= end);
        return matchDate;
    });

    updateDashboard();
};

function updateDashboard() {
    updateCharts();
}

function updateCharts() {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    updateAreaModeButtons();

    // --- 1. PROCESAR TENDENCIA SEMANAL ---
    const weekMap = {};
    filteredData.forEach(n => {
        const date = new Date(n.FECHA);
        if(isNaN(date)) return;
        const week = "Sem " + _getISOWeek(date);
        if (!weekMap[week]) weekMap[week] = 0;
        weekMap[week] += parseFloat(n.CANTIDAD_SOLICITADA || 0);
    });

    const sortedWeeks = Object.keys(weekMap).sort();
    
    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(document.getElementById('chartTrend'), {
        type: 'bar',
        data: {
            labels: sortedWeeks,
            datasets: [{
                label: 'Unidades',
                data: sortedWeeks.map(w => weekMap[w]),
                backgroundColor: sortedWeeks.map(w => w === activeWeek ? 'rgba(16, 185, 129, 0.32)' : 'rgba(59, 130, 246, 0.24)'),
                borderColor: sortedWeeks.map(w => w === activeWeek ? 'rgba(16, 185, 129, 0.52)' : 'rgba(59, 130, 246, 0.42)'),
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { maxTicksLimit: isMobile ? 5 : 8 }
                },
                x: {
                    grid: { color: 'rgba(15, 23, 42, 0.08)' },
                    ticks: {
                        maxRotation: isMobile ? 45 : 0,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: isMobile ? 6 : 12
                    }
                }
            },
            plugins: { legend: { display: false } },
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const week = sortedWeeks[index];
                    activeWeek = (activeWeek === week) ? null : week;
                    updateCharts();
                }
            }
        }
    });

    // --- 2. PROCESAR ESTADISTICAS PRINCIPALES Y PESO VOLUMÉTRICO ---
    const areaData = activeWeek 
        ? filteredData.filter(n => {
            const d = new Date(n.FECHA);
            return !isNaN(d) && ("Sem " + _getISOWeek(d) === activeWeek);
        })
        : filteredData;

    // Actualizar Stats con la info de la semana activa (o global)
    document.getElementById('statTotal').innerText = areaData.length;
    
    const totalUnits = areaData.reduce((s, n) => s + parseFloat(n.CANTIDAD_SOLICITADA || 0), 0);
    const totalLotUnits = areaData.reduce((s, n) => s + parseFloat(n.CANTIDAD || 0), 0);
    
    document.getElementById('statUnits').innerText = totalUnits.toLocaleString('es-CO');
    const elLot = document.getElementById('statUnitsTotalLot');
    if (elLot) elLot.innerText = `De ${totalLotUnits.toLocaleString('es-CO')} totales en lote`;
    
    const areasSet = new Set(areaData.filter(n => n.AREA).map(n => n.AREA));
    document.getElementById('statAreas').innerText = areasSet.size;
    
    const lotsSet = new Set(areaData.filter(n => n.LOTE || n.ID || n.id).map(n => n.LOTE || n.ID || n.id));
    document.getElementById('statLots').innerText = lotsSet.size;

    const areaMap = {};
    const itemsByArea = {};
    const areasInItems = new Set();
    let totalItemsUnits = 0;

    areaData.forEach(n => {
        const a = n.AREA || 'OTRO';
        areaMap[a] = (areaMap[a] || 0) + parseFloat(n.CANTIDAD_SOLICITADA || 0);

        // Parsear TIPO_DETALLE para consolidado
        let detalle = n.TIPO_DETALLE;
        if (typeof detalle === 'string') {
            try { detalle = JSON.parse(detalle); } catch (e) { detalle = null; }
        }

        if (detalle && detalle.items && Array.isArray(detalle.items)) {
            detalle.items.forEach(item => {
                const tipoItem = item.tipo || 'Desconocido';
                const cantItem = parseFloat(item.cantidad) || 0;
                
                if (!itemsByArea[tipoItem]) itemsByArea[tipoItem] = { total: 0 };
                itemsByArea[tipoItem][a] = (itemsByArea[tipoItem][a] || 0) + cantItem;
                itemsByArea[tipoItem].total += cantItem;
                totalItemsUnits += cantItem;
                areasInItems.add(a);
            });
        }
    });

    const filteredAreaKeys = Object.keys(areaMap).filter(k => areaMap[k] > 0);
    const totalAreaUnits = filteredAreaKeys.reduce((s, k) => s + areaMap[k], 0);
    
    const labelsWithPerc = filteredAreaKeys.map(k => {
        const perc = totalAreaUnits > 0 ? ((areaMap[k] / totalAreaUnits) * 100).toFixed(1) : 0;
        return k + ' (' + perc + '%)';
    });
    const areaValues = filteredAreaKeys.map(k => areaMap[k]);
    const areaPalette = [
        'rgba(59, 130, 246, 0.28)',
        'rgba(16, 185, 129, 0.28)',
        'rgba(245, 158, 11, 0.28)',
        'rgba(239, 68, 68, 0.28)',
        'rgba(139, 92, 246, 0.28)',
        'rgba(100, 116, 139, 0.28)',
        'rgba(20, 184, 166, 0.28)',
        'rgba(244, 63, 94, 0.28)'
    ];

    if (chartArea) chartArea.destroy();
    chartArea = new Chart(document.getElementById('chartArea'), {
        type: areaChartMode,
        data: {
            labels: areaChartMode === 'radar' ? filteredAreaKeys : labelsWithPerc,
            datasets: [{
                label: 'Unidades',
                data: areaValues,
                backgroundColor: areaChartMode === 'radar' ? 'rgba(59, 130, 246, 0.18)' : areaPalette,
                borderColor: areaChartMode === 'radar' ? 'rgba(59, 130, 246, 0.58)' : 'rgba(255, 255, 255, 0.5)',
                pointBackgroundColor: areaChartMode === 'radar' ? 'rgba(59, 130, 246, 0.8)' : undefined,
                pointBorderColor: areaChartMode === 'radar' ? '#fff' : undefined,
                pointRadius: areaChartMode === 'radar' ? (isMobile ? 3 : 4) : undefined,
                borderWidth: areaChartMode === 'radar' ? 2 : 1
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false, 
            plugins: { 
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: isMobile ? 10 : 12,
                        font: { size: isMobile ? 10 : 12 }
                    }
                },
                title: {
                    display: true,
                    text: activeWeek ? 'Distribución: ' + activeWeek : 'Distribución Global',
                    color: activeWeek ? '#10b981' : '#64748b',
                    font: { size: isMobile ? 12 : 14, weight: 'bold' }
                }
            }, 
            cutout: areaChartMode === 'doughnut' ? (isMobile ? '62%' : '70%') : undefined,
            scales: areaChartMode === 'radar'
                ? {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            backdropColor: 'transparent',
                            maxTicksLimit: isMobile ? 4 : 6,
                            font: { size: isMobile ? 9 : 11 }
                        },
                        pointLabels: {
                            color: '#64748b',
                            font: { size: isMobile ? 10 : 12, weight: '600' }
                        },
                        grid: { color: 'rgba(15, 23, 42, 0.08)' },
                        angleLines: { color: 'rgba(15, 23, 42, 0.08)' }
                    }
                }
                : undefined
        }
    });

    // --- 3. PROCESAR DETALLE CONSOLIDADO DE ITEMS ---
    const sortedItems = Object.keys(itemsByArea).sort((a, b) => itemsByArea[b].total - itemsByArea[a].total);
    
    const itemsLabelsWithPerc = sortedItems.map(k => {
        const perc = totalItemsUnits > 0 ? ((itemsByArea[k].total / totalItemsUnits) * 100).toFixed(1) : 0;
        return k + ' (' + perc + '%)';
    });

    const areaColors = {
        'CORTE': '#ef4444', 
        'INSUMOS': '#3b82f6', 
        'TELAS': '#10b981', 
        'CALIDAD': '#f59e0b',
        'OTRO': '#64748b'
    };
    const fallbackColors = ['#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];
    let colorIdx = 0;

    const datasets = Array.from(areasInItems).sort().map(area => {
        let bg = areaColors[area.toUpperCase()];
        if (!bg) {
            bg = fallbackColors[colorIdx % fallbackColors.length];
            colorIdx++;
        }
        const transparentMap = {
            '#ef4444': 'rgba(239, 68, 68, 0.28)',
            '#3b82f6': 'rgba(59, 130, 246, 0.28)',
            '#10b981': 'rgba(16, 185, 129, 0.28)',
            '#f59e0b': 'rgba(245, 158, 11, 0.28)',
            '#64748b': 'rgba(100, 116, 139, 0.28)'
        };
        const bgTransparent = transparentMap[bg] || 'rgba(99, 102, 241, 0.24)';
        return {
            label: area,
            data: sortedItems.map(item => itemsByArea[item][area] || 0),
            backgroundColor: bgTransparent,
            borderColor: bgTransparent,
            borderWidth: 1,
            borderRadius: 4
        };
    });

    const itemsContainer = document.getElementById('chartItemsContainer');
    if (itemsContainer) {
        // Calcular altura dinámica: min 350px, +30px por cada ítem extra si hay muchos
        const minHeight = isMobile ? 360 : 350;
        const rowHeight = isMobile ? 34 : 30;
        const newHeight = Math.max(minHeight, sortedItems.length * rowHeight);
        itemsContainer.style.height = newHeight + 'px';
    }

    if (chartItems) chartItems.destroy();
    chartItems = new Chart(document.getElementById('chartItems'), {
        type: 'bar',
        data: {
            labels: itemsLabelsWithPerc,
            datasets: datasets
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Gráfico de barras horizontal
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: isMobile ? 10 : 12,
                        font: { size: isMobile ? 10 : 12 }
                    }
                }, // Mostrar leyenda para identificar áreas
                title: { 
                    display: true, 
                    text: activeWeek ? 'Detalle Consolidado de Items: ' + activeWeek : 'Detalle Consolidado de Items (Global)', 
                    color: activeWeek ? '#10b981' : '#64748b', 
                    font: { size: isMobile ? 11 : 13, weight: 'bold' } 
                }
            },
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { maxTicksLimit: isMobile ? 5 : 8 }
                },
                y: {
                    stacked: true,
                    ticks: {
                        autoSkip: false,
                        font: { size: isMobile ? 10 : 12 }
                    }
                }
            }
        }
    });
}

function updateAreaModeButtons() {
    const doughnutBtn = document.getElementById('areaChartDoughnutBtn');
    const radarBtn = document.getElementById('areaChartRadarBtn');

    if (doughnutBtn) {
        doughnutBtn.classList.toggle('active', areaChartMode === 'doughnut');
        doughnutBtn.setAttribute('aria-pressed', String(areaChartMode === 'doughnut'));
    }

    if (radarBtn) {
        radarBtn.classList.toggle('active', areaChartMode === 'radar');
        radarBtn.setAttribute('aria-pressed', String(areaChartMode === 'radar'));
    }
}

function initResponsiveCharts() {
    const dashboard = document.getElementById('mainDashboard');
    if (!dashboard) return;
    lastResponsiveIsMobile = window.matchMedia('(max-width: 767px)').matches;

    const scheduleResize = function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const nextIsMobile = window.matchMedia('(max-width: 767px)').matches;
            [chartArea, chartTrend, chartItems].forEach(function(chart) {
                if (chart) chart.resize();
            });

            if (nextIsMobile !== lastResponsiveIsMobile) {
                lastResponsiveIsMobile = nextIsMobile;
                updateCharts();
            }
        }, 180);
    };

    window.addEventListener('resize', scheduleResize);

    if (typeof ResizeObserver === 'function') {
        if (metricsResizeObserver) metricsResizeObserver.disconnect();
        metricsResizeObserver = new ResizeObserver(scheduleResize);
        dashboard.querySelectorAll('.chart-frame, .charts-grid').forEach(function(el) {
            metricsResizeObserver.observe(el);
        });
    }
}

function _getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ============================================================================
// FUNCIONES DE DESCARGA
// ============================================================================

window.descargarData = function(formato) {
    if (!filteredData || filteredData.length === 0) {
        Swal.fire('Sin datos', 'No hay registros en la vista actual para exportar.', 'info');
        return;
    }

    let targetBtn = formato === 'csv' ? document.getElementById('btnDescCSV') : document.getElementById('btnDescJSON');
    
    const origHtml = targetBtn ? targetBtn.innerHTML : '';
    if (targetBtn) {
        targetBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        targetBtn.disabled = true;
    }

    try {
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename  = `novedades_dashboard_${timestamp}`;

        if (formato === 'csv') {
            _descargarCSV(filteredData, filename + '.csv');
        } else {
            _descargarJSON(filteredData, filename + '.json');
        }

        Swal.fire({
            icon: 'success',
            title: '¡Descarga Completa!',
            text: `Se generó el reporte en formato ${formato.toUpperCase()}.`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch (e) {
        console.error('Error exportando:', e);
        Swal.fire('Error', 'Hubo un error al generar el archivo.', 'error');
    } finally {
        if (targetBtn) {
            targetBtn.innerHTML = origHtml;
            targetBtn.disabled = false;
        }
    }
};

function _descargarCSV(datos, filename) {
    const COLUMNAS = [
        'ID_NOVEDAD', 'FECHA', 'SEMANA', 'SALIDA', 'PLANTA', 'LOTE', 'REFERENCIA',
        'PRENDA', 'GENERO', 'TEJIDO', 'LINEA', 'AREA', 'TIPO_NOVEDAD',
        'CANTIDAD_LOTE', 'CANTIDAD_AFECTADA', 'DETALLE_ITEMS', 'DESCRIPCION',
        'ESTADO', 'COBRO'
    ];

    let csv = COLUMNAS.join(';') + '\r\n';

    datos.forEach(row => {
        let detalleItems = '';
        let detalle = row.TIPO_DETALLE;
        if (typeof detalle === 'string') {
            try { detalle = JSON.parse(detalle); } catch(e) { detalle = null; }
        }
        if (detalle && detalle.items && Array.isArray(detalle.items)) {
            detalleItems = detalle.items.map(i => `${i.tipo || 'N/A'}: ${i.cantidad || 0}`).join(' | ');
        } else if (typeof row.TIPO_DETALLE === 'string') {
            detalleItems = row.TIPO_DETALLE;
        }

        const d = new Date(row.FECHA);
        const semanaStr = !isNaN(d) ? `Sem ${_getISOWeek(d)}` : '';

        const filaObj = {
            'ID_NOVEDAD': row.ID_NOVEDAD || row.id || '',
            'FECHA': row.FECHA || '',
            'SEMANA': semanaStr,
            'SALIDA': row.SALIDA || '',
            'PLANTA': row.PLANTA || '',
            'LOTE': row.LOTE || row.ID || row.id || '',
            'REFERENCIA': row.REFERENCIA || '',
            'PRENDA': row.PRENDA || '',
            'GENERO': row.GENERO || '',
            'TEJIDO': row.TEJIDO || '',
            'LINEA': row.LINEA || '',
            'AREA': row.AREA || '',
            'TIPO_NOVEDAD': row.TIPO_NOVEDAD || '',
            'CANTIDAD_LOTE': row.CANTIDAD || 0,
            'CANTIDAD_AFECTADA': row.CANTIDAD_SOLICITADA || 0,
            'DETALLE_ITEMS': detalleItems,
            'DESCRIPCION': row.DESCRIPCION || '',
            'ESTADO': row.ESTADO || '',
            'COBRO': row.COBRO || ''
        };

        const fila = COLUMNAS.map(col => {
            let val = filaObj[col];
            if (val === null || val === undefined) val = '';
            const str = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
            return str.includes(';') || str.includes('"') ? `"${str}"` : str;
        });
        csv += fila.join(';') + '\r\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    _triggerDownload(blob, filename);
}

function _descargarJSON(datos, filename) {
    const payload = {
        exportado_el: new Date().toISOString(),
        total_registros: datos.length,
        registros: datos
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    _triggerDownload(blob, filename);
}

function _triggerDownload(blob, filename) {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
