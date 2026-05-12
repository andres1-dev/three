/**
 * calidad.js — Lógica para Dashboard de Calidad con Infinite Scroll e Instagram Style Grid
 */

let gsReportes = [];
let gsFilteredReportes = [];
let itemsToShow = 12; // Cantidad inicial
const batchSize = 12; // Cuántos cargar en cada scroll
let isLoadingMore = false;
let dateRangePicker = null;
let selectedDateRange = null;

/**
 * Se inicializa cuando carga la página calidad.html
 */
window.onload = async function() {
    // Disparar fetch de reportes en paralelo con loadUsers para no esperar auth
    const reportesPromise = fetchReportesData();

    await loadUsers();

    await cargarDatosCalidadLocal(reportesPromise);
    setupInfiniteScroll();
    initDateRangePicker();
};

/**
 * Toggle de KPIs en móvil
 */
function toggleKPIs() {
    const container = document.getElementById('kpiContainer');
    const btn = document.getElementById('kpiToggleBtn');
    if (container) container.classList.toggle('open');
    if (btn) btn.classList.toggle('open');
}

/**
 * Carga inicial de datos desde Sheets con optimización de velocidad
 */
async function cargarDatosCalidadLocal(reportesPromise) {
    const loader = document.getElementById('initialLoader');
    const dataSection = document.getElementById('qualityFeed');
    
    if (loader) loader.style.display = 'block';

    try {
        gsReportes = await (reportesPromise || fetchReportesData());
        
        if (!gsReportes || gsReportes.length === 0) {
            if (loader) {
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-database mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">La base de datos de calidad está vacía o no es accesible.</p>
                    </div>
                `;
            }
            return;
        }

        // Ordenar por fecha recíproca (más nuevos primero) usando motor resiliente
        gsReportes.sort((a, b) => {
            const dateA = parsearFechaLatina(String(a.TIMESTAMP || a.FECHA || '')) || new Date(0);
            const dateB = parsearFechaLatina(String(b.TIMESTAMP || b.FECHA || '')) || new Date(0);
            return dateB - dateA;
        });

        gsFilteredReportes = [...gsReportes];
        
        actualizarKPIs();
        renderReportGrid(true); // true para resetear vista
        
        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'grid';
        
        // Reinicializar el date picker si existe
        if (dateRangePicker) {
            dateRangePicker.clear();
            selectedDateRange = null;
        }
        
    } catch (error) {
        if (loader) {
            loader.innerHTML = `
                <div class="py-5 text-center text-danger">
                    <i class="fas fa-exclamation-circle mb-3" style="font-size: 3.5rem;"></i>
                    <p class="fw-800 mb-1">FALLO AL SINCRONIZAR</p>
                    <p class="small opacity-75 mb-3">Error: ${error.message}</p>
                    <button class="btn btn-primary rounded-pill px-4" onclick="recargarDatosCalidad()">REINTENTAR AHORA</button>
                </div>
            `;
        }
    }
}

/**
 * Función para recargar datos manualmente (botón RECARGAR)
 */
async function recargarDatosCalidad() {
    const loader = document.getElementById('initialLoader');
    const dataSection = document.getElementById('qualityFeed');
    
    if (loader) loader.style.display = 'block';
    if (dataSection) dataSection.style.display = 'none';
    
    try {
        if (typeof invalidateCache === 'function') invalidateCache('REPORTES');
        gsReportes = await fetchReportesData();
        
        if (!gsReportes || gsReportes.length === 0) {
            if (loader) {
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-database mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">La base de datos de calidad está vacía o no es accesible.</p>
                    </div>
                `;
            }
            return;
        }

        gsReportes.sort((a, b) => {
            const dateA = parsearFechaLatina(String(a.TIMESTAMP || a.FECHA || '')) || new Date(0);
            const dateB = parsearFechaLatina(String(b.TIMESTAMP || b.FECHA || '')) || new Date(0);
            return dateB - dateA;
        });

        // Limpiar filtros
        if (dateRangePicker) {
            dateRangePicker.clear();
            selectedDateRange = null;
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        gsFilteredReportes = [...gsReportes];
        
        actualizarKPIs();
        renderReportGrid(true);
        
        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'grid';
        
        Swal.fire({
            icon: 'success',
            title: 'Datos Actualizados',
            text: 'Los reportes se han recargado correctamente',
            timer: 1500,
            showConfirmButton: false
        });
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error al Recargar',
            text: error.message || 'No se pudieron cargar los datos',
            confirmButtonColor: '#3F51B5'
        });
        if (loader) loader.style.display = 'none';
    }
}

/**
 * Motor de parseo de fechas robusto que maneja fechas con hora
 */
function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let s = String(d).trim();
    if (!s) return null;

    // Separar fecha y hora si existe
    const parts = s.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';
    
    // Detectar separador de fecha
    const sep = datePart.includes('/') ? '/' : (datePart.includes('-') ? '-' : null);
    if (!sep) return new Date(d);
    
    const dateParts = datePart.split(sep);
    if (dateParts.length !== 3) return new Date(d);
    
    let dia, mes, anio;
    
    // Formato dd/mm/yyyy o dd-mm-yyyy
    if (dateParts[2].length === 4) {
        dia = parseInt(dateParts[0]);
        mes = parseInt(dateParts[1]) - 1;
        anio = parseInt(dateParts[2]);
    } 
    // Formato yyyy/mm/dd o yyyy-mm-dd
    else if (dateParts[0].length === 4) {
        anio = parseInt(dateParts[0]);
        mes = parseInt(dateParts[1]) - 1;
        dia = parseInt(dateParts[2]);
    } else {
        return new Date(d);
    }
    
    // Parsear hora si existe
    const timeParts = timePart.split(':');
    const hora = parseInt(timeParts[0]) || 0;
    const minuto = parseInt(timeParts[1]) || 0;
    const segundo = parseInt(timeParts[2]) || 0;
    
    return new Date(anio, mes, dia, hora, minuto, segundo);
}

/**
 * Actualiza los indicadores KPIs del dashboard basándose en los datos reales de REPORTES
 */
function actualizarKPIs() {
    // Usar siempre los datos filtrados para los KPIs
    const data = gsFilteredReportes;
    
    if (!data || data.length === 0) {
        document.getElementById('kpi-total').textContent = '0';
        document.getElementById('kpi-ok').textContent = '0';
        document.getElementById('kpi-rejected').textContent = '0';
        document.getElementById('kpi-audit').textContent = '0';
        document.getElementById('kpi-ronda').textContent = '0';
        document.getElementById('kpi-contramuestra').textContent = '0';
        document.getElementById('kpi-seguimiento').textContent = '0';
        document.getElementById('kpi-plants').textContent = '0';
        return;
    }

    // Total de reportes
    const total = data.length;
    document.getElementById('kpi-total').textContent = total;

    // Contar por CONCLUSION (campo real de la tabla)
    let aprobados = 0;
    let rechazados = 0;

    data.forEach(r => {
        const conclusion = (r.CONCLUSION || '').toUpperCase().trim();
        
        // Aprobados: APROBADO, SATISFACTORIO, CUMPLE
        if (conclusion.includes('APROBADO') || 
            conclusion.includes('SATISFACTORIO') || 
            conclusion.includes('CUMPLE')) {
            aprobados++;
        } 
        // Rechazados: RECHAZADO, NO CUMPLE, NO CONFORME
        else if (conclusion.includes('RECHAZADO') || 
                 conclusion.includes('NO CUMPLE') || 
                 conclusion.includes('NO CONFORME')) {
            rechazados++;
        }
    });

    document.getElementById('kpi-ok').textContent = aprobados;
    document.getElementById('kpi-rejected').textContent = rechazados;

    // Contar por TIPO_VISITA (campo real de la tabla)
    // Los valores exactos del formulario son: AUDITORIA, RONDA, CONTRAMUESTRA, SEGUIMIENTO
    let auditorias = 0;
    let rondas = 0;
    let contramuestras = 0;
    let seguimientos = 0;

    data.forEach(r => {
        const tipoVisita = (r.TIPO_VISITA || '').toUpperCase().trim();
        
        if (tipoVisita === 'AUDITORIA') {
            auditorias++;
        } else if (tipoVisita === 'RONDA') {
            rondas++;
        } else if (tipoVisita === 'CONTRAMUESTRA') {
            contramuestras++;
        } else if (tipoVisita === 'SEGUIMIENTO') {
            seguimientos++;
        }
    });

    document.getElementById('kpi-audit').textContent = auditorias;
    document.getElementById('kpi-ronda').textContent = rondas;
    document.getElementById('kpi-contramuestra').textContent = contramuestras;
    document.getElementById('kpi-seguimiento').textContent = seguimientos;

    // Contar PLANTAS únicas (campo real de la tabla)
    const plantasUnicas = new Set(
        data.map(r => (r.PLANTA || '').trim())
            .filter(p => p && p !== '')
    );
    document.getElementById('kpi-plants').textContent = plantasUnicas.size;
}

/**
 * Renderiza la cuadrícula (Infinity Scroll enabled)
 */
function renderReportGrid(reset = false) {
    const feed = document.getElementById('qualityFeed');
    if (!feed) return;

    if (reset) {
        feed.innerHTML = '';
        itemsToShow = batchSize;
    }

    const currentCount = feed.children.length;
    const dataToRender = gsFilteredReportes.slice(currentCount, itemsToShow);

    if (dataToRender.length === 0 && currentCount === 0) {
        feed.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="fas fa-search mb-3" style="font-size: 2.5rem; opacity: 0.3;"></i>
                <p class="fw-bold">No hay reportes que coincidan con la búsqueda.</p>
            </div>
        `;
        return;
    }

    dataToRender.forEach((rep, i) => {
        // Pasamos el índice global del array filtrado para localizar el reporte al expandir
        feed.appendChild(createReportCard(rep, currentCount + i));
    });
}

/**
 * Crea el componente DOM para cada reporte usando los campos reales de REPORTES
 */
function createReportCard(rep, globalIndex) {
    const div = document.createElement('div');
    div.className = 'report-card-lux';
    
    // SOPORTE: imagen o video del reporte
    const soporteUrl = rep.SOPORTE || 'https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif';
    const esVideo = soporteUrl.includes('/preview') || soporteUrl.includes('drive.google.com/file');
    
    // FECHA: fecha del reporte
    const fecha = rep.FECHA || 'S/F';
    
    // CONCLUSION: estado del reporte
    const conclusion = (rep.CONCLUSION || 'PENDIENTE').toUpperCase();
    
    let statusClass = 'bg-secondary';
    const conclusionLower = conclusion.toLowerCase();
    if (conclusionLower.includes('satisfactorio') || 
        conclusionLower.includes('aprobado') || 
        conclusionLower.includes('ok') ||
        conclusionLower.includes('cumple') ||
        conclusionLower.includes('conforme')) {
        statusClass = 'bg-success';
    } else if (conclusionLower.includes('rechazado') || 
               conclusionLower.includes('fallido') || 
               conclusionLower.includes('no cumple') ||
               conclusionLower.includes('no conforme')) {
        statusClass = 'bg-danger';
    } else if (conclusionLower.includes('observacion') || 
               conclusionLower.includes('observación') || 
               conclusionLower.includes('pendiente')) {
        statusClass = 'bg-warning text-dark';
    }

    // Contenido multimedia (imagen o video)
    let mediaContent;
    if (esVideo) {
        mediaContent = `
            <iframe src="${soporteUrl}" 
                style="width:100%; height:100%; border:0;" 
                allow="autoplay" 
                loading="lazy">
            </iframe>
        `;
    } else {
        mediaContent = `
            <img src="${soporteUrl}" 
                alt="Calidad" 
                loading="lazy" 
                onerror="this.src='https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif'">
        `;
    }

    div.innerHTML = `
        <span class="lote-tag-lux">${rep.LOTE || 'LOTE'}</span>
        <div class="report-img-container">
            ${mediaContent}
        </div>
        <div class="report-content-lux">
            <h3 class="report-title-lux">${rep.REFERENCIA || 'REFERENCIA'}</h3>
            <div class="report-info-row">
                <span><i class="far fa-calendar-alt me-1"></i> ${fecha}</span>
                <span><i class="fas fa-industry me-1"></i> ${rep.PLANTA || 'S/P'}</span>
            </div>
            <p class="report-summary-lux">${rep.OBSERVACIONES || 'Sin observaciones.'}</p>
            <div class="report-footer-lux">
                <span class="status-badge-lux ${statusClass} text-white">${conclusion}</span>
                <button class="btn btn-sm btn-link text-primary fw-800 p-0 text-decoration-none" 
                    onclick="expandReport(${globalIndex})">
                    VER <i class="fas fa-arrow-right ms-1"></i>
                </button>
            </div>
        </div>
    `;
    return div;
}

/**
 * Configuración del scroll infinito
 */
function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoadingMore) return;
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
            if (gsFilteredReportes.length > document.getElementById('qualityFeed')?.children.length) {
                loadMore();
            }
        }
    });
}

async function loadMore() {
    isLoadingMore = true;
    const loader = document.getElementById('scrollLoader');
    if (loader) loader.style.display = 'block';

    itemsToShow += batchSize;
    renderReportGrid(false);

    if (loader) loader.style.display = 'none';
    isLoadingMore = false;
}

/**
 * Inicializa el selector de rango de fechas con Flatpickr
 * Configurado para trabajar con fechas que incluyen hora
 */
function initDateRangePicker() {
    const input = document.getElementById('dateRangePicker');
    if (!input || typeof flatpickr === 'undefined') return;

    dateRangePicker = flatpickr(input, {
        mode: 'range',
        dateFormat: 'd/m/Y',
        locale: 'es',
        allowInput: false,
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                // Establecer el rango completo del día
                const startDate = new Date(selectedDates[0]);
                startDate.setHours(0, 0, 0, 0);
                
                const endDate = new Date(selectedDates[1]);
                endDate.setHours(23, 59, 59, 999);
                
                selectedDateRange = {
                    start: startDate,
                    end: endDate
                };
                applyFilters();
            }
        },
        onClose: function(selectedDates) {
            if (selectedDates.length === 0) {
                selectedDateRange = null;
                applyFilters();
            }
        }
    });
}

/**
 * Aplica todos los filtros activos (búsqueda + fechas)
 */
function applyFilters() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    
    gsFilteredReportes = gsReportes.filter(r => {
        // Filtro de búsqueda por texto
        const matchesSearch = !searchTerm || 
            (r.LOTE || '').toLowerCase().includes(searchTerm) ||
            (r.REFERENCIA || '').toLowerCase().includes(searchTerm) ||
            (r.PLANTA || '').toLowerCase().includes(searchTerm) ||
            (r.CONCLUSION || '').toLowerCase().includes(searchTerm);

        // Filtro de rango de fechas
        let matchesDate = true;
        if (selectedDateRange) {
            // Intentar parsear la fecha del reporte (puede tener hora)
            const reportDate = parsearFechaLatina(r.FECHA);
            if (reportDate && reportDate instanceof Date && !isNaN(reportDate)) {
                // Comparar solo las fechas, ignorando la hora
                const reportDateOnly = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
                const startDateOnly = new Date(selectedDateRange.start.getFullYear(), selectedDateRange.start.getMonth(), selectedDateRange.start.getDate());
                const endDateOnly = new Date(selectedDateRange.end.getFullYear(), selectedDateRange.end.getMonth(), selectedDateRange.end.getDate());
                
                matchesDate = reportDateOnly >= startDateOnly && reportDateOnly <= endDateOnly;
            } else {
                // Si no se puede parsear la fecha, no filtrar por fecha
                matchesDate = true;
            }
        }

        return matchesSearch && matchesDate;
    });

    actualizarKPIs();
    renderReportGrid(true);
}

/**
 * Filtrado dinámico por texto
 */
function handleSearch() {
    applyFilters();
}

/**
 * Detalle expandido con SweetAlert2 mostrando todos los campos de REPORTES
 */
function expandReport(index) {
    // index es la posición en gsFilteredReportes al momento de renderizar la tarjeta
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Formatear tipo de visita con icono específico
    const tipoVisita = (rep.TIPO_VISITA || 'No especificado').toUpperCase();
    let tipoIcon = 'fa-clipboard-check';
    let tipoColor = '#8b5cf6';
    
    if (tipoVisita === 'AUDITORIA') {
        tipoIcon = 'fa-clipboard-check';
        tipoColor = '#8b5cf6';
    } else if (tipoVisita === 'RONDA') {
        tipoIcon = 'fa-route';
        tipoColor = '#06b6d4';
    } else if (tipoVisita === 'CONTRAMUESTRA') {
        tipoIcon = 'fa-vial';
        tipoColor = '#f59e0b';
    } else if (tipoVisita === 'SEGUIMIENTO') {
        tipoIcon = 'fa-tasks';
        tipoColor = '#ec4899';
    }

    // Detectar si el soporte es video o imagen
    const soporteUrl = rep.SOPORTE || '';
    const esVideo = soporteUrl.includes('/preview') || soporteUrl.includes('drive.google.com/file');
    
    let mediaHTML = '';
    if (soporteUrl) {
        if (esVideo) {
            mediaHTML = `
                <div class="mt-4 overflow-hidden rounded-4 border shadow-sm" style="position: relative; padding-bottom: 56.25%; height: 0;">
                    <iframe src="${soporteUrl}" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" 
                        allow="autoplay; fullscreen" 
                        allowfullscreen>
                    </iframe>
                </div>
            `;
        } else {
            mediaHTML = `<div class="mt-4 overflow-hidden rounded-4 border shadow-sm"><img src="${soporteUrl}" style="width:100%;"></div>`;
        }
    }

    Swal.fire({
        title: null,
        html: `
            <style>
                .modal-detail-container {
                    font-family: 'Inter', sans-serif;
                    padding: 0;
                    text-align: left;
                }
                
                .modal-header-lux {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 24px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f1f5f9;
                }
                
                .modal-icon-box {
                    background: linear-gradient(135deg, #3f51b5, #6366f1);
                    color: white;
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    flex-shrink: 0;
                    box-shadow: 0 8px 16px rgba(63, 81, 181, 0.25);
                }
                
                .modal-title-group {
                    flex: 1;
                    min-width: 0;
                }
                
                .modal-title-lux {
                    margin: 0 0 4px 0;
                    font-size: 1.3rem;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1.2;
                }
                
                .modal-subtitle-lux {
                    color: #64748b;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin: 0;
                }
                
                .modal-grid-lux {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                
                .field-group-lux {
                    background: #f8fafc;
                    padding: 14px 16px;
                    border-radius: 12px;
                    border: 1px solid #f1f5f9;
                    transition: all 0.2s ease;
                }
                
                .field-group-lux:hover {
                    background: #f1f5f9;
                    border-color: #e2e8f0;
                }
                
                .field-label-lux {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #94a3b8;
                    margin-bottom: 6px;
                    letter-spacing: 0.5px;
                }
                
                .field-value-lux {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #1e293b;
                    word-break: break-word;
                }
                
                .field-highlight {
                    background: ${tipoColor}10;
                    border: 1.5px solid ${tipoColor}30;
                    padding: 16px;
                }
                
                .field-highlight .field-value-lux {
                    color: ${tipoColor};
                    font-size: 1.05rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .conclusion-box {
                    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                    border: 1.5px solid #93c5fd;
                    padding: 16px;
                }
                
                .conclusion-box .field-value-lux {
                    color: #1e40af;
                    font-size: 1.05rem;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .observations-box {
                    background: white;
                    border: 1.5px solid #e2e8f0;
                    padding: 16px;
                    border-radius: 12px;
                    margin-top: 8px;
                }
                
                .observations-box .field-value-lux {
                    font-weight: 500;
                    line-height: 1.6;
                    color: #475569;
                    white-space: pre-wrap;
                }
                
                .media-container-lux {
                    margin-top: 20px;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }
                
                .media-container-lux img,
                .media-container-lux video {
                    width: 100%;
                    display: block;
                }
                
                /* Desktop: 2 columnas */
                @media (min-width: 768px) {
                    .modal-grid-lux {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    
                    .field-group-full {
                        grid-column: 1 / -1;
                    }
                    
                    .modal-title-lux {
                        font-size: 1.5rem;
                    }
                }
                
                /* Mobile: optimización */
                @media (max-width: 767px) {
                    .modal-header-lux {
                        gap: 12px;
                        margin-bottom: 20px;
                        padding-bottom: 16px;
                    }
                    
                    .modal-icon-box {
                        width: 48px;
                        height: 48px;
                        font-size: 1.3rem;
                    }
                    
                    .modal-title-lux {
                        font-size: 1.1rem;
                    }
                    
                    .modal-subtitle-lux {
                        font-size: 0.75rem;
                    }
                    
                    .field-group-lux {
                        padding: 12px 14px;
                    }
                    
                    .field-value-lux {
                        font-size: 0.9rem;
                    }
                }
            </style>
            
            <div class="modal-detail-container">
                <div class="modal-header-lux">
                    <div class="modal-icon-box">
                        <i class="fas fa-microscope"></i>
                    </div>
                    <div class="modal-title-group">
                        <h4 class="modal-title-lux">Reporte de Calidad</h4>
                        <p class="modal-subtitle-lux">ID: ${rep.ID_REPORTE || rep.TIMESTAMP || 'N/A'}</p>
                    </div>
                </div>

                <div class="modal-grid-lux">
                    <div class="field-group-lux">
                        <span class="field-label-lux">Lote</span>
                        <div class="field-value-lux" style="color: #3f51b5;">${rep.LOTE || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Fecha</span>
                        <div class="field-value-lux">${rep.FECHA || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Referencia</span>
                        <div class="field-value-lux">${rep.REFERENCIA || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Cantidad</span>
                        <div class="field-value-lux">${rep.CANTIDAD || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Planta</span>
                        <div class="field-value-lux">${rep.PLANTA || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Línea</span>
                        <div class="field-value-lux">${rep.LINEA || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux field-group-full">
                        <span class="field-label-lux">Proceso</span>
                        <div class="field-value-lux">${rep.PROCESO || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Prenda</span>
                        <div class="field-value-lux">${rep.PRENDA || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Género</span>
                        <div class="field-value-lux">${rep.GENERO || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux field-group-full">
                        <span class="field-label-lux">Tejido</span>
                        <div class="field-value-lux">${rep.TEJIDO || 'N/A'}</div>
                    </div>
                    
                    <div class="field-group-lux field-group-full field-highlight">
                        <span class="field-label-lux">
                            <i class="fas ${tipoIcon}"></i> Tipo de Visita
                        </span>
                        <div class="field-value-lux">
                            <i class="fas ${tipoIcon}"></i>
                            ${tipoVisita}
                        </div>
                    </div>
                    
                    <div class="field-group-lux field-group-full conclusion-box">
                        <span class="field-label-lux">Conclusión Final</span>
                        <div class="field-value-lux">
                            <i class="fas fa-award"></i>
                            ${rep.CONCLUSION || 'N/A'}
                        </div>
                    </div>
                    
                    <div class="field-group-lux field-group-full observations-box">
                        <span class="field-label-lux">Observaciones</span>
                        <div class="field-value-lux">${rep.OBSERVACIONES || 'Sin observaciones registradas'}</div>
                    </div>
                    
                    <div class="field-group-lux">
                        <span class="field-label-lux">Inspector</span>
                        <div class="field-value-lux">
                            <i class="fas fa-user-check" style="color: #3f51b5; margin-right: 6px;"></i>
                            ${rep.EMAIL || 'N/A'}
                        </div>
                    </div>
                    
                    ${rep.LOCALIZACION ? `
                    <div class="field-group-lux">
                        <span class="field-label-lux">Ubicación GPS</span>
                        <div class="field-value-lux">
                            <i class="fas fa-map-marker-alt" style="color: #ef4444; margin-right: 6px;"></i>
                            ${rep.LOCALIZACION}
                        </div>
                    </div>
                    ` : ''}
                </div>

                ${mediaHTML ? `<div class="media-container-lux">${mediaHTML}</div>` : ''}
            </div>
        `,
        confirmButtonText: 'CERRAR',
        confirmButtonColor: '#3f51b5',
        width: '800px',
        customClass: { 
            popup: 'rounded-5',
            confirmButton: 'rounded-pill px-5 fw-800'
        },
        didOpen: () => {
            // Ajustar ancho en móvil
            if (window.innerWidth < 768) {
                document.querySelector('.swal2-popup').style.width = '95%';
            }
        }
    });
}
