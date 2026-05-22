let gsReportes = [];
let gsFilteredReportes = [];
let dateRangePicker = null;
let selectedDateRange = null;

const TIPO_CONFIG = {
    AUDITORIA: { icon: 'fa-clipboard-check', color: '#8b5cf6', bg: '#f5f3ff', label: 'Auditorías' },
    RONDA: { icon: 'fa-route', color: '#06b6d4', bg: '#ecfeff', label: 'Rondas' },
    CONTRAMUESTRA: { icon: 'fa-vial', color: '#f59e0b', bg: '#fffbeb', label: 'Contramuestras' },
    SEGUIMIENTO: { icon: 'fa-tasks', color: '#ec4899', bg: '#fdf2f8', label: 'Seguimientos' }
};

let globalReportesPromise = null;
(function initFastPrefetch() {
    try {
        if (typeof fetchReportesData === 'function') {
            globalReportesPromise = fetchReportesData();
        }
    } catch(e) {}
})();

window.onload = async function() {
    await loadUsers();
    const user = window.currentUser;
    if (!user || user.ROL !== 'USER-C') {
        window.location.replace('index.html');
        return;
    }

    initDateRangePicker();
    await cargarMisReportesLocal(globalReportesPromise);
};

function toggleKPIs() {
    const container = document.getElementById('kpiContainer');
    const btn = document.getElementById('kpiToggleBtn');
    if (container) container.classList.toggle('open');
    if (btn) btn.classList.toggle('open');
}

async function cargarMisReportesLocal(reportesPromise) {
    const loader = document.getElementById('initialLoader');
    const dataSection = document.getElementById('myReportsFeed');
    const controls = document.getElementById('reportsHeaderControls');

    if (loader) loader.style.display = 'block';
    if (controls) controls.style.display = 'none';

    try {
        const rawReportes = await (reportesPromise || fetchReportesData());

        const user = window.currentUser || {};
        const userEmail = (user.EMAIL || user.CORREO || '').toLowerCase().trim();
        gsReportes = (rawReportes || []).filter(r => {
            return (r.EMAIL || '').toLowerCase().trim() === userEmail;
        });

        gsReportes.sort((a, b) => {
            const dateA = parsearFechaLatina(String(a.TIMESTAMP || a.FECHA || '')) || new Date(0);
            const dateB = parsearFechaLatina(String(b.TIMESTAMP || b.FECHA || '')) || new Date(0);
            return dateB - dateA;
        });

        applyFilters();

        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'flex';
        if (controls) controls.style.display = 'block';

    } catch (error) {
        if (loader) {
            loader.innerHTML = `
                <div class="py-5 text-center text-danger">
                    <i class="fas fa-exclamation-circle mb-3" style="font-size: 3.5rem;"></i>
                    <p class="fw-800 mb-1">FALLO AL SINCRONIZAR</p>
                    <p class="small opacity-75 mb-3">Error: ${error.message}</p>
                    <button class="btn btn-primary rounded-pill px-4" onclick="recargarDatos()">REINTENTAR AHORA</button>
                </div>
            `;
        }
    }
}

async function recargarDatos() {
    const loader = document.getElementById('initialLoader');
    const dataSection = document.getElementById('myReportsFeed');
    const controls = document.getElementById('reportsHeaderControls');

    if (loader) loader.style.display = 'block';
    if (dataSection) dataSection.style.display = 'none';
    if (controls) controls.style.display = 'none';

    try {
        if (typeof invalidateCache === 'function') invalidateCache('REPORTES');
        const rawReportes = await fetchReportesData();

        const user = window.currentUser || {};
        const userEmail = (user.EMAIL || user.CORREO || '').toLowerCase().trim();
        gsReportes = (rawReportes || []).filter(r => {
            return (r.EMAIL || '').toLowerCase().trim() === userEmail;
        });

        gsReportes.sort((a, b) => {
            const dateA = parsearFechaLatina(String(a.TIMESTAMP || a.FECHA || '')) || new Date(0);
            const dateB = parsearFechaLatina(String(b.TIMESTAMP || b.FECHA || '')) || new Date(0);
            return dateB - dateA;
        });

        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        applyFilters();

        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'flex';
        if (controls) controls.style.display = 'block';

        Swal.fire({
            icon: 'success',
            title: 'Datos Actualizados',
            text: 'Tus reportes se han recargado correctamente',
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
        if (controls) controls.style.display = 'block';
    }
}

function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let s = String(d).trim();
    if (!s) return null;

    const parts = s.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';

    const sep = datePart.includes('/') ? '/' : (datePart.includes('-') ? '-' : null);
    if (!sep) return new Date(d);

    const dateParts = datePart.split(sep);
    if (dateParts.length !== 3) return new Date(d);

    let dia, mes, anio;

    if (dateParts[2].length === 4) {
        dia = parseInt(dateParts[0]);
        mes = parseInt(dateParts[1]) - 1;
        anio = parseInt(dateParts[2]);
    } else if (dateParts[0].length === 4) {
        anio = parseInt(dateParts[0]);
        mes = parseInt(dateParts[1]) - 1;
        dia = parseInt(dateParts[2]);
    } else {
        return new Date(d);
    }

    const timeParts = timePart.split(':');
    const hora = parseInt(timeParts[0]) || 0;
    const minuto = parseInt(timeParts[1]) || 0;
    const segundo = parseInt(timeParts[2]) || 0;

    return new Date(anio, mes, dia, hora, minuto, segundo);
}

function actualizarKPIs() {
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

    document.getElementById('kpi-total').textContent = data.length;

    let aprobados = 0;
    let rechazados = 0;
    let auditorias = 0;
    let rondas = 0;
    let contramuestras = 0;
    let seguimientos = 0;

    data.forEach(r => {
        const conclusion = (r.CONCLUSION || '').toUpperCase().trim();
        if (conclusion.includes('APROBADO') || conclusion.includes('SATISFACTORIO') || conclusion.includes('CUMPLE')) {
            aprobados++;
        } else if (conclusion.includes('RECHAZADO') || conclusion.includes('NO CUMPLE') || conclusion.includes('NO CONFORME')) {
            rechazados++;
        }

        const tipoVisita = (r.TIPO_VISITA || '').toUpperCase().trim();
        if (tipoVisita === 'AUDITORIA') auditorias++;
        else if (tipoVisita === 'RONDA') rondas++;
        else if (tipoVisita === 'CONTRAMUESTRA') contramuestras++;
        else if (tipoVisita === 'SEGUIMIENTO') seguimientos++;
    });

    document.getElementById('kpi-ok').textContent = aprobados;
    document.getElementById('kpi-rejected').textContent = rechazados;
    document.getElementById('kpi-audit').textContent = auditorias;
    document.getElementById('kpi-ronda').textContent = rondas;
    document.getElementById('kpi-contramuestra').textContent = contramuestras;
    document.getElementById('kpi-seguimiento').textContent = seguimientos;

    const plantasUnicas = new Set(
        data.map(r => (r.PLANTA || '').trim()).filter(p => p && p !== '')
    );
    document.getElementById('kpi-plants').textContent = plantasUnicas.size;
}

function getStatusInfo(conclusion) {
    const c = (conclusion || 'PENDIENTE').toLowerCase();
    if (c.includes('satisfactorio') || c.includes('aprobado') || c.includes('ok') || c.includes('cumple') || c.includes('conforme')) {
        return { class: 'bg-success', label: (conclusion || 'APROBADO').toUpperCase() };
    }
    if (c.includes('rechazado') || c.includes('fallido') || c.includes('no cumple') || c.includes('no conforme')) {
        return { class: 'bg-danger', label: (conclusion || 'RECHAZADO').toUpperCase() };
    }
    if (c.includes('observacion') || c.includes('observación') || c.includes('pendiente')) {
        return { class: 'bg-warning text-dark', label: (conclusion || 'PENDIENTE').toUpperCase() };
    }
    return { class: 'bg-secondary', label: (conclusion || 'PENDIENTE').toUpperCase() };
}

function getTipoInfo(tipo) {
    const t = (tipo || 'RONDA').toUpperCase();
    return TIPO_CONFIG[t] || TIPO_CONFIG.RONDA;
}

function formatFechaCompacta(fecha) {
    if (!fecha) return 'S/F';
    let s = fecha.split('T')[0].split(' ')[0];
    if (!s) return fecha;
    const sep = s.includes('/') ? '/' : (s.includes('-') ? '-' : null);
    if (!sep) return fecha;
    const d = s.split(sep);
    if (d.length !== 3) return fecha;
    if (d[2].length === 4) return `${d[0]}/${d[1]}/${d[2].slice(2)}`;
    if (d[0].length === 4) return `${d[2]}/${d[1]}/${d[0].slice(2)}`;
    return fecha;
}

function renderGroupedView() {
    const feed = document.getElementById('myReportsFeed');
    if (!feed) return;

    feed.innerHTML = '';

    if (gsFilteredReportes.length === 0) {
        feed.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-search mb-3" style="font-size: 2.5rem; opacity: 0.3;"></i>
                <p class="fw-bold">No hay reportes que coincidan con la búsqueda o rango de fechas.</p>
            </div>
        `;
        return;
    }

    const groups = { AUDITORIA: [], RONDA: [], CONTRAMUESTRA: [], SEGUIMIENTO: [] };

    gsFilteredReportes.forEach(r => {
        const tipo = (r.TIPO_VISITA || 'RONDA').toUpperCase();
        if (groups[tipo]) groups[tipo].push(r);
        else groups['RONDA'].push(r);
    });

    const tipoOrder = ['AUDITORIA', 'RONDA', 'CONTRAMUESTRA', 'SEGUIMIENTO'];

    tipoOrder.forEach(tipo => {
        const reports = groups[tipo];
        if (reports.length === 0) return;

        const info = getTipoInfo(tipo);
        const section = document.createElement('div');
        section.className = 'report-group';

        let rowsHtml = '';
        reports.forEach(r => {
            const globalIdx = gsFilteredReportes.indexOf(r);
            const statusInfo = getStatusInfo(r.CONCLUSION);
            rowsHtml += `
                <tr class="planta-row-mobile">
                    <td colspan="6"><span>${r.PLANTA || '-'}</span></td>
                </tr>
                <tr>
                    <td><span style="font-weight:600; white-space:nowrap;">${formatFechaCompacta(r.FECHA)}</span></td>
                    <td><span style="font-weight:700; color:#3f51b5;">${r.ID || 'OP'}</span></td>
                    <td>${r.REFERENCIA || '-'}</td>
                    <td>${r.PLANTA || '-'}</td>
                    <td><span class="status-badge-sm ${statusInfo.class} text-white">${statusInfo.label}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn action-btn-ver" onclick="expandReport(${globalIdx})" title="Ver detalle">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn action-btn-print" onclick="imprimirReporte(${globalIdx})" title="Imprimir">
                                <i class="fas fa-print"></i>
                            </button>
                            <button class="action-btn action-btn-whatsapp" onclick="enviarWhatsAppIndividual(${globalIdx})" title="Enviar por WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        section.innerHTML = `
            <div class="group-header">
                <div class="group-header-left">
                    <div class="group-icon" style="background:${info.color};">
                        <i class="fas ${info.icon}"></i>
                    </div>
                    <span class="group-title">${info.label}</span>
                </div>
                <span class="group-count">${reports.length} reporte${reports.length !== 1 ? 's' : ''}</span>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Lote</th>
                        <th>Referencia</th>
                        <th>Planta</th>
                        <th>Conclusión</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        feed.appendChild(section);
    });
}

function imprimirReporte(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    const reportNormalized = {};
    for (const key in rep) {
        reportNormalized[key.toLowerCase()] = rep[key];
    }
    reportNormalized._autoPrint = true;
    reportNormalized._autoprint = true;

    localStorage.setItem('printReporteCalidad', JSON.stringify(reportNormalized));
    window.open('plantilla-impresion-calidad.html', '_blank');
}

function applyFilters() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const hasSearch = searchTerm.length > 0;

    gsFilteredReportes = gsReportes.filter(r => {
        const matchesSearch = !searchTerm ||
            (r.ID || '').toLowerCase().includes(searchTerm) ||
            (r.REFERENCIA || '').toLowerCase().includes(searchTerm) ||
            (r.PLANTA || '').toLowerCase().includes(searchTerm) ||
            (r.CONCLUSION || '').toLowerCase().includes(searchTerm);

        if (hasSearch) return matchesSearch;

        let matchesDate = true;
        if (selectedDateRange) {
            const reportDate = parsearFechaLatina(r.FECHA);
            if (reportDate && reportDate instanceof Date && !isNaN(reportDate)) {
                const reportDateOnly = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
                const startDateOnly = new Date(selectedDateRange.start.getFullYear(), selectedDateRange.start.getMonth(), selectedDateRange.start.getDate());
                const endDateOnly = new Date(selectedDateRange.end.getFullYear(), selectedDateRange.end.getMonth(), selectedDateRange.end.getDate());
                matchesDate = reportDateOnly >= startDateOnly && reportDateOnly <= endDateOnly;
            } else {
                matchesDate = false;
            }
        }

        return matchesSearch && matchesDate;
    });

    actualizarKPIs();
    renderGroupedView();
}

function handleSearch() {
    applyFilters();
}

function initDateRangePicker() {
    const input = document.getElementById('dateRangePicker');
    if (!input || typeof flatpickr === 'undefined') return;

    const today = new Date();
    dateRangePicker = flatpickr(input, {
        mode: 'range',
        dateFormat: 'd/m/Y',
        locale: 'es',
        allowInput: false,
        defaultDate: [today, today],
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
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

    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    selectedDateRange = { start: startDate, end: endDate };
}

function expandReport(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Normalizar claves
    const reportNormalized = {};
    for (const key in rep) {
        reportNormalized[key.toLowerCase()] = rep[key];
    }

    // Función auxiliar para verificar si un valor está vacío o es 0
    const isEmpty = (value) => {
        if (value === null || value === undefined || value === '' || value === 'N/A') return true;
        if (typeof value === 'number' && value === 0) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        return false;
    };

    // Función auxiliar para ocultar/mostrar contenedores
    const toggleContainer = (containerId, show) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = show ? '' : 'none';
        }
    };

    // Llenar el modal con todos los datos del reporte
    document.getElementById('editReporteIndex').value = index;
    
    // ID Reporte y Lote
    const idReporte = reportNormalized.id_reporte || reportNormalized.ID_REPORTE || '';
    const lote = reportNormalized.id || reportNormalized.ID || '';
    document.getElementById('editIdReporte').value = idReporte || 'N/A';
    document.getElementById('editLote').value = lote || 'N/A';
    toggleContainer('containerIdReporte', !isEmpty(idReporte) || !isEmpty(lote));
    
    // Referencia y Fecha
    const referencia = reportNormalized.referencia || reportNormalized.REFERENCIA || '';
    const fecha = reportNormalized.fecha || reportNormalized.FECHA || '';
    document.getElementById('editReferencia').value = referencia || 'N/A';
    document.getElementById('editFecha').value = fecha || 'N/A';
    toggleContainer('containerReferencia', !isEmpty(referencia) || !isEmpty(fecha));
    
    // Planta y Email
    const planta = reportNormalized.planta || reportNormalized.PLANTA || '';
    const email = reportNormalized.email || reportNormalized.EMAIL || '';
    document.getElementById('editPlanta').value = planta || 'N/A';
    document.getElementById('editEmail').value = email || 'N/A';
    toggleContainer('containerPlanta', !isEmpty(planta) || !isEmpty(email));
    
    // Línea, Tipo Visita y Género
    const linea = reportNormalized.linea || reportNormalized.LINEA || '';
    const tipoVisita = reportNormalized.tipo_visita || reportNormalized.TIPO_VISITA || '';
    const genero = reportNormalized.genero || reportNormalized.GENERO || '';
    document.getElementById('editLinea').value = linea || 'N/A';
    document.getElementById('editTipoVisita').value = tipoVisita || 'N/A';
    document.getElementById('editGenero').value = genero || 'N/A';
    toggleContainer('containerLinea', !isEmpty(linea) || !isEmpty(tipoVisita) || !isEmpty(genero));
    
    // Campos del formulario de calidad
    const conclusion = (reportNormalized.conclusion || reportNormalized.CONCLUSION || 'PENDIENTE').toUpperCase();
    const observaciones = reportNormalized.observaciones || reportNormalized.OBSERVACIONES || '';
    document.getElementById('editConclusion').value = conclusion;
    document.getElementById('editObservaciones').value = observaciones;
    toggleContainer('containerConclusion', !isEmpty(conclusion));
    toggleContainer('containerObservaciones', !isEmpty(observaciones));
    
    // Proceso, Cantidad y Prenda
    const proceso = reportNormalized.proceso || '';
    const cantidad = reportNormalized.cantidad || '';
    const prenda = reportNormalized.prenda || '';
    document.getElementById('editProceso').value = proceso || 'N/A';
    document.getElementById('editCantidad').value = cantidad || 'N/A';
    document.getElementById('editPrenda').value = prenda || 'N/A';
    toggleContainer('containerProceso', !isEmpty(proceso) || !isEmpty(cantidad) || !isEmpty(prenda));
    
    // Destino Proceso y Destino Planta
    const destinoProceso = reportNormalized.destino_proceso || '';
    const destinoPlanta = reportNormalized.destino_planta || '';
    document.getElementById('editDestinoProceso').value = destinoProceso || 'N/A';
    document.getElementById('editDestinoPlanta').value = destinoPlanta || 'N/A';
    toggleContainer('containerDestino', !isEmpty(destinoProceso) || !isEmpty(destinoPlanta));
    
    // Avance - ocultar si es 0
    const avance = reportNormalized.avance || '';
    document.getElementById('editAvance').value = avance || 'N/A';
    // Ocultar si es 0 o vacío
    const avanceNum = Number(avance);
    toggleContainer('containerAvance', !isEmpty(avance) && avanceNum !== 0);
    
    // Salida, Entrada y Productora
    const salida = reportNormalized.salida || '';
    const entrada = reportNormalized.entrada || '';
    const productora = reportNormalized.productora || '';
    document.getElementById('editSalida').value = salida || 'N/A';
    document.getElementById('editEntrada').value = entrada || 'N/A';
    document.getElementById('editProductora').value = productora || 'N/A';
    toggleContainer('containerFechas', !isEmpty(salida) || !isEmpty(entrada) || !isEmpty(productora));
    
    // Localización - mostrar mapa de Google Maps
    const localizacion = reportNormalized.localizacion || '';
    const localizacionContainer = document.getElementById('editLocalizacionContainer');
    if (localizacion && !isEmpty(localizacion) && localizacion.includes(',')) {
        localizacionContainer.innerHTML = `
            <div style="width: 100%; height: 200px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                <iframe src="https://maps.google.com/maps?q=${encodeURIComponent(localizacion.trim())}&z=16&output=embed"
                        width="100%"
                        height="200"
                        style="border: none;"
                        allowfullscreen>
                </iframe>
            </div>
        `;
        toggleContainer('containerLocalizacion', true);
    } else if (localizacion && !isEmpty(localizacion)) {
        localizacionContainer.innerHTML = `
            <input type="text" class="form-control" value="${localizacion}" readonly>
        `;
        toggleContainer('containerLocalizacion', true);
    } else {
        localizacionContainer.innerHTML = '';
        toggleContainer('containerLocalizacion', false);
    }
    
    // Tejido - ocultar si es N/A o vacío
    const tejido = reportNormalized.tejido || '';
    document.getElementById('editTejido').value = tejido || 'N/A';
    toggleContainer('containerTejido', !isEmpty(tejido) && tejido !== 'N/A');
    
    // Soporte (imagen) - expandida con lightbox como en plantilla de impresión
    const soporteUrl = reportNormalized.soporte || reportNormalized.SOPORTE;
    const soporteContainer = document.getElementById('editSoporteContainer');
    if (soporteUrl && !isEmpty(soporteUrl)) {
        soporteContainer.innerHTML = `
            <div class="zoom-container" onclick="abrirLightbox('${soporteUrl}')" style="width: 100%; height: 200px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; cursor: pointer;">
                <img src="${soporteUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Soporte visual">
                <div class="zoom-overlay">
                    <i class="fas fa-search-plus"></i>
                </div>
            </div>
        `;
        toggleContainer('containerSoporte', true);
    } else {
        soporteContainer.innerHTML = '';
        toggleContainer('containerSoporte', false);
    }
    
    // Novedades auditoría - mostrar como inputs estéticos
    let novedadesText = reportNormalized.novedades_auditoria || reportNormalized.NOVEDADES_AUDITORIA || '';
    const novedadesContainer = document.getElementById('editNovedadesContainer');
    
    if (novedadesText && !isEmpty(novedadesText)) {
        let novedadesHtml = '';
        if (typeof novedadesText === 'string') {
            try {
                const parsed = JSON.parse(novedadesText);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach((nov, idx) => {
                        const tipo = nov.tipo || nov.TIPO || 'N/A';
                        novedadesHtml += `<div class="mb-3 p-3" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0;">`;
                        novedadesHtml += `<label class="form-label fw-bold" style="color: #3f51b5; margin-bottom: 12px;">
                            <i class="fas fa-exclamation-triangle me-1"></i>${tipo}
                        </label>`;
                        
                        if (nov.codigos && Array.isArray(nov.codigos)) {
                            nov.codigos.forEach((codigo, cIdx) => {
                                const talla = codigo.talla || codigo.TALLA || 'N/A';
                                const color = codigo.color || codigo.COLOR || 'N/A';
                                const cantidad = codigo.cantidad || codigo.CANTIDAD || '0';
                                
                                novedadesHtml += `<div class="row mb-2" style="margin-left: -8px; margin-right: -8px;">`;
                                novedadesHtml += `<div class="col-md-4 px-2" style="margin-bottom: 8px;">`;
                                novedadesHtml += `<label class="form-label small text-muted" style="font-size: 0.75rem; margin-bottom: 2px;">Talla</label>`;
                                novedadesHtml += `<input type="text" class="form-control" value="${talla}" readonly style="font-size: 0.875rem; padding: 6px 10px;">`;
                                novedadesHtml += `</div>`;
                                novedadesHtml += `<div class="col-md-4 px-2" style="margin-bottom: 8px;">`;
                                novedadesHtml += `<label class="form-label small text-muted" style="font-size: 0.75rem; margin-bottom: 2px;">Color</label>`;
                                novedadesHtml += `<input type="text" class="form-control" value="${color}" readonly style="font-size: 0.875rem; padding: 6px 10px;">`;
                                novedadesHtml += `</div>`;
                                novedadesHtml += `<div class="col-md-4 px-2" style="margin-bottom: 8px;">`;
                                novedadesHtml += `<label class="form-label small text-muted" style="font-size: 0.75rem; margin-bottom: 2px;">Cantidad</label>`;
                                novedadesHtml += `<input type="text" class="form-control" value="${cantidad}" readonly style="font-size: 0.875rem; padding: 6px 10px;">`;
                                novedadesHtml += `</div>`;
                                novedadesHtml += `</div>`;
                            });
                        } else {
                            const sinProceso = nov.sin_proceso !== undefined ? (nov.sin_proceso ? 'Sí' : 'No') : '';
                            novedadesHtml += `<div class="text-muted" style="font-style: italic;">${sinProceso ? 'Sin proceso' : 'Sin códigos'}</div>`;
                        }
                        novedadesHtml += `</div>`;
                    });
                } else {
                    novedadesHtml = '<div class="p-3 bg-light rounded"><pre class="mb-0" style="font-size: 0.8rem;">' + JSON.stringify(parsed, null, 2) + '</pre></div>';
                }
            } catch (e) {
                novedadesHtml = '<div class="p-3 bg-light rounded"><pre class="mb-0" style="font-size: 0.8rem;">' + novedadesText + '</pre></div>';
            }
        } else if (typeof novedadesText === 'object') {
            novedadesHtml = '<div class="p-3 bg-light rounded"><pre class="mb-0" style="font-size: 0.8rem;">' + JSON.stringify(novedadesText, null, 2) + '</pre></div>';
        }
        novedadesContainer.innerHTML = novedadesHtml;
        toggleContainer('containerNovedades', true);
    } else {
        novedadesContainer.innerHTML = '';
        toggleContainer('containerNovedades', false);
    }

    // Mostrar el modal
    const modalEl = document.getElementById('reporteModal');
    modalEl.style.display = 'flex';
    modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarModalReporte() {
    const modalEl = document.getElementById('reporteModal');
    modalEl.style.display = 'none';
    modalEl.classList.remove('show');
    document.body.style.overflow = '';
}

function abrirLightbox(imageUrl) {
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImage = document.getElementById('lightboxImage');
    lightboxImage.src = imageUrl;
    lightboxModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarLightbox() {
    const lightboxModal = document.getElementById('lightboxModal');
    lightboxModal.classList.remove('show');
    document.body.style.overflow = '';
}

async function guardarCambiosReporte() {
    const index = parseInt(document.getElementById('editReporteIndex').value);
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Obtener valores del formulario
    const conclusion = document.getElementById('editConclusion').value.toUpperCase();
    const observaciones = document.getElementById('editObservaciones').value;
    const proceso = document.getElementById('editProceso').value;
    const cantidad = document.getElementById('editCantidad').value;
    const prenda = document.getElementById('editPrenda').value;
    const destinoProceso = document.getElementById('editDestinoProceso').value;
    const destinoPlanta = document.getElementById('editDestinoPlanta').value;

    // Actualizar el reporte en el array local
    rep.CONCLUSION = conclusion;
    rep.OBSERVACIONES = observaciones;
    rep.PROCESO = proceso;
    rep.CANTIDAD = cantidad;
    rep.PRENDA = prenda;
    rep.DESTINO_PROCESO = destinoProceso;
    rep.DESTINO_PLANTA = destinoPlanta;

    try {
        // Mostrar indicador de carga
        Swal.fire({
            title: 'Guardando cambios...',
            text: 'Por favor espera',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Preparar datos para enviar a Supabase
        const updateData = {
            conclusion: conclusion,
            observaciones: observaciones,
            proceso: proceso,
            cantidad: cantidad,
            prenda: prenda,
            destino_proceso: destinoProceso,
            destino_planta: destinoPlanta
        };

        // Enviar actualización a Supabase
        const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";
        const sb = supabase.createClient("https://zpikjjcbievfpzegupmw.supabase.co", SUPABASE_KEY);
        
        const { error } = await sb
            .from('reportes_calidad')
            .update(updateData)
            .eq('id_reporte', rep.ID_REPORTE || rep.id_reporte);

        if (error) throw error;

        // Cerrar modal
        cerrarModalReporte();

        // Recargar datos
        await recargarDatos();

        // Mostrar éxito
        Swal.fire({
            icon: 'success',
            title: 'Cambios guardados',
            text: 'El reporte se ha actualizado correctamente',
            confirmButtonColor: '#3F51B5'
        });

    } catch (error) {
        console.error('Error al guardar cambios:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: error.message || 'No se pudieron guardar los cambios',
            confirmButtonColor: '#3F51B5'
        });
    }
}

function escapeWhatsAppFormatting(text) {
    if (!text) return '';
    const str = String(text);
    return str
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/~/g, '\\~')
        .replace(/`/g, '\\`')
        .replace(/\./g, '\\.');
}

async function obtenerProductoras() {
    try {
        const cached = localStorage.getItem('busint_productoras_cache');
        if (cached) {
            return JSON.parse(cached);
        }
        const res = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: JSON.stringify({ accion: 'LISTAR_PRODUCTORAS' })
        });
        if (!res.ok) return [];
        const r = await res.json();
        const productoras = r.productoras || [];
        localStorage.setItem('busint_productoras_cache', JSON.stringify(productoras));
        return productoras;
    } catch(e) {
        return [];
    }
}

function obtenerNombreProductora(productoraId, productorasList) {
    if (!productoraId) return 'SIN PRODUCTORA';
    const prod = productorasList.find(p => String(p.id_productora) === String(productoraId));
    return prod ? prod.productora : productoraId;
}

async function enviarWhatsApp() {

    const user = window.currentUser || {};

    const phoneNumber =
        user.TELEFONO ||
        user.phone ||
        user.PHONE ||
        user.CELULAR ||
        user.telefono ||
        '';

    // =========================
    // VALIDAR TELEFONO
    // =========================

    if (!phoneNumber) {

        Swal.fire({
            icon: 'warning',
            title: 'Sin número de teléfono',
            text: 'No tienes un número registrado.',
            confirmButtonColor: '#3F51B5'
        });

        return;
    }

    // =========================
    // VALIDAR REPORTES
    // =========================

    if (gsFilteredReportes.length === 0) {

        Swal.fire({
            icon: 'warning',
            title: 'Sin reportes',
            text: 'No hay reportes para enviar.',
            confirmButtonColor: '#3F51B5'
        });

        return;
    }

    // =========================
    // OBTENER PRODUCTORAS
    // =========================

    const productorasList = await obtenerProductoras();

    // =========================
    // HEADER
    // =========================

    let message = '*MI REPORTE DIARIO:*\n\n';

    // =========================
    // USUARIO
    // =========================

    message += `*\`${user.NOMBRE || user.NAME || 'Usuario'}\`*\n`;

    // =========================
    // FECHAS DINAMICAS
    // =========================

    if (selectedDateRange) {

        const start =
            selectedDateRange.start;

        const end =
            selectedDateRange.end;

        const startDate =
            start.toLocaleDateString(
                'es-ES',
                {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }
            );

        const endDate =
            end.toLocaleDateString(
                'es-ES',
                {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }
            );

        // =========================
        // MISMO DIA
        // =========================

        const sameDay =
            start.getDate() === end.getDate() &&
            start.getMonth() === end.getMonth() &&
            start.getFullYear() === end.getFullYear();

        if (sameDay) {

            const fechaLarga =
                start.toLocaleDateString(
                    'es-ES',
                    {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    }
                );

            const fechaCapitalizada =
                fechaLarga.charAt(0).toUpperCase() +
                fechaLarga.slice(1);

            message += `*${fechaCapitalizada}*\n\n`;

        } else {

            message += `*Periodo:* ${startDate} - ${endDate}\n\n`;
        }

    } else {

        const today = new Date();

        const fechaLarga =
            today.toLocaleDateString(
                'es-ES',
                {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }
            );

        const fechaCapitalizada =
            fechaLarga.charAt(0).toUpperCase() +
            fechaLarga.slice(1);

        message += `*${fechaCapitalizada}*\n\n`;
    }

    // =========================
    // TOTAL REPORTES
    // =========================

    message += `*Total Reportes:*\n`;

    message += `> ${gsFilteredReportes.length}\n\n`;

    // =========================
    // AGRUPAR REPORTES POR PRODUCTORA
    // =========================

    const productoraGroups = {};

    gsFilteredReportes.forEach(r => {

        const productoraId = r.PRODUCTORA || r.productora || 'SIN PRODUCTORA';
        const productoraNombre = obtenerNombreProductora(productoraId, productorasList);

        if (!productoraGroups[productoraNombre]) {
            productoraGroups[productoraNombre] = [];
        }

        productoraGroups[productoraNombre].push(r);
    });

    // =========================
    // RENDER REPORTES POR PRODUCTORA
    // =========================

    Object.keys(productoraGroups).forEach(productoraNombre => {

        const reports = productoraGroups[productoraNombre];

        if (reports.length === 0) return;

        // =========================
        // TITULO DEL GRUPO PRODUCTORA
        // =========================

        message += `*${productoraNombre} (${reports.length})*\n\n`;

        reports.forEach((r, idx) => {

            const planta =
                r.PLANTA ||
                'SIN PLANTA';

            const lote =
                r.ID ||
                'N/A';

            const referencia =
                r.REFERENCIA ||
                'N/A';

            const cantidad =
                r.CANTIDAD ||
                r.CANT ||
                r.QTY ||
                'N/A';

            const conclusion =
                r.CONCLUSION ||
                'PENDIENTE';

            const comentarios =
                r.COMENTARIOS ||
                r.COMENTARIO ||
                r.OBSERVACIONES ||
                '';

            // =========================
            // TITULO REPORTE
            // =========================

            message += `*${idx + 1}.* *${planta}*\n`;

            // =========================
            // DATOS
            // =========================

            message += `*Lote:* ${lote}\n`;

            message += `*Referencia:* ${referencia}\n`;

            message += `*Cantidad:* ${cantidad}\n\n`;

            // =========================
            // CONCLUSION
            // =========================

            message += `*Conclusión:*\n`;

            message += `> ${conclusion.toUpperCase()}\n\n`;

            // =========================
            // COMENTARIOS
            // =========================

            if (comentarios) {

                message += `*Comentarios:*\n`;

                message += `_${comentarios.trim()}_\n`;
            }

            // =========================
            // SEPARADOR ENTRE REPORTES
            // =========================

            message += `\n━━━━━━━━━━━━━━━━━━\n\n`;
        });
    });

    // =========================
    // CIERRE
    // =========================

    message += `Muchas gracias por la atención prestada.`;

    // =========================
    // LIMPIAR NUMERO
    // =========================

    const cleanPhone =
        phoneNumber.replace(
            /[\s\-\(\)]/g,
            ''
        );

    // =========================
    // ENCODE URL
    // =========================

    const encodedMessage =
        encodeURIComponent(message);

    // =========================
    // URL WHATSAPP
    // =========================

    const whatsappUrl =
        `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // =========================
    // ABRIR WHATSAPP
    // =========================

    window.open(
        whatsappUrl,
        '_blank'
    );
}

async function enviarWhatsAppIndividual(index) {

    const rep = gsFilteredReportes[index];

    if (!rep) return;

    const user = window.currentUser || {};

    // =========================
    // TELEFONO
    // =========================

    const phoneNumber =
        user.TELEFONO ||
        user.phone ||
        user.PHONE ||
        user.CELULAR ||
        user.telefono ||
        '';

    if (!phoneNumber) {

        Swal.fire({
            icon: 'warning',
            title: 'Sin número de teléfono',
            text: 'No tienes un número registrado.',
            confirmButtonColor: '#3F51B5'
        });

        return;
    }

    // =========================
    // PRODUCTORAS
    // =========================

    const productorasList =
        await obtenerProductoras();

    const productoraNombre =
        obtenerNombreProductora(
            rep.PRODUCTORA || rep.productora,
            productorasList
        );

    // =========================
    // NORMALIZAR
    // =========================

    const reportNormalized = {};

    for (const key in rep) {
        reportNormalized[key.toLowerCase()] = rep[key];
    }

    // =========================
    // VARIABLES
    // =========================

    const conclusion =
        (
            reportNormalized.conclusion ||
            reportNormalized.CONCLUSION ||
            'PENDIENTE'
        )
        .toUpperCase();

    const proceso =
        (
            reportNormalized.proceso ||
            'N/A'
        )
        .toUpperCase();

    const referencia =
        reportNormalized.referencia ||
        reportNormalized.REFERENCIA ||
        'N/A';

    const lote =
        reportNormalized.id ||
        reportNormalized.ID ||
        'N/A';

    const cantidad =
        reportNormalized.cantidad ||
        reportNormalized.CANTIDAD ||
        reportNormalized.CANT ||
        reportNormalized.QTY ||
        '0';

    const destino =
        (
            reportNormalized.destino_proceso ||
            'N/A'
        )
        .toUpperCase();

    const lugar =
        String(
            reportNormalized.destino_planta || ''
        ).toUpperCase() === 'CDI'
            ? 'CDI (CENTRO DE DISTRIBUCION)'
            : (
                reportNormalized.destino_planta ||
                'N/A'
            ).toUpperCase();

    // =========================
    // FECHA LARGA
    // =========================

    let fechaLarga = '';

    try {

        const fechaObj =
            parsearFechaLatina(
                reportNormalized.fecha ||
                reportNormalized.FECHA
            );

        fechaLarga =
            fechaObj.toLocaleDateString(
                'es-ES',
                {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }
            );

        fechaLarga =
            fechaLarga.charAt(0).toUpperCase() +
            fechaLarga.slice(1);

    } catch(e) {

        fechaLarga =
            formatFechaCompacta(
                reportNormalized.fecha ||
                reportNormalized.FECHA
            );
    }

    // =========================
    // MENSAJE
    // =========================

    let message = '';

    message += '*REPORTE DE AUDITORÍA*\n';

    message += `*\`${(reportNormalized.planta || reportNormalized.PLANTA || productoraNombre || 'N/A').toUpperCase()}\`*\n`;

    message += `*${fechaLarga}*\n\n`;

    // =========================
    // CONCLUSION
    // =========================

    message += '*Conclusión:*\n';

    message += `> ${conclusion}\n\n`;

    // =========================
    // DETALLES
    // =========================

    message += `*Proceso:* ${proceso}\n`;

    message += `*Referencia:* ${referencia}\n`;

    message += `*OP / Lote:* ${lote}\n`;

    message += `*Cantidad:* ${cantidad}\n`;

    // DESTINO
    if (destino && destino !== 'N/A') {

        message += `*Destino:* ${destino}\n`;
    }

    // LUGAR
    if (lugar && lugar !== 'N/A') {

        message += `*Lugar:* ${lugar}\n`;
    }

    message += '\n';

    // =========================
    // HALLAZGOS CUANTITATIVOS
    // =========================

    const novedades =
        reportNormalized.novedades_auditoria ||
        reportNormalized.NOVEDADES_AUDITORIA;

    if (novedades) {

        try {

            let parsed = novedades;

            if (typeof parsed === 'string') {
                parsed = JSON.parse(parsed);
            }

            if (typeof parsed === 'string') {
                parsed = JSON.parse(parsed);
            }

            if (
                Array.isArray(parsed) &&
                parsed.length > 0
            ) {

                message += '*HALLAZGOS CUANTITATIVOS:*\n\n';

                parsed.forEach((nov, idx) => {

                    const totalUnidades =
                        nov.codigos.reduce(
                            (sum, c) =>
                                sum + (Number(c.cantidad) || 0),
                            0
                        );

                    message += `*${idx + 1}. ${nov.tipo.toUpperCase()}* *(${totalUnidades} unds.)*\n`;

                    // =========================
                    // CALCULAR TAMAÑOS DINÁMICOS
                    // =========================

                    const maxColorLength = Math.max(
                        ...nov.codigos.map(c =>
                            String(c.color || '-').length
                        )
                    );

                    const maxTallaLength = Math.max(
                        ...nov.codigos.map(c =>
                            String(c.talla || '-').length
                        )
                    );

                    // =========================
                    // FILAS
                    // =========================

                    nov.codigos.forEach(c => {

                        const talla =
                            String(c.talla || '-')
                            .padEnd(maxTallaLength, ' ');

                        const color =
                            String(c.color || '-')
                            .padEnd(maxColorLength, ' ');

                        const cantidad =
                            String(c.cantidad || '0');

                        message += `\`${talla} | ${color} | ${cantidad}\`\n`;

                    });

                    message += '\n';
                });
            }

        } catch(e) {

            console.error(
                'Error parseando novedades:',
                e
            );
        }
    }

    // =========================
    // OBSERVACIONES
    // =========================

    const observaciones =
        reportNormalized.observaciones ||
        reportNormalized.OBSERVACIONES ||
        reportNormalized.comentarios ||
        reportNormalized.COMENTARIOS ||
        '';

    message += '*OBSERVACIONES GENERALES:*\n\n';

    if (observaciones) {

        message += `_${observaciones.trim()}_`;

    } else {

        message += '_Sin observaciones adicionales._';
    }

    // =========================
    // NUMERO
    // =========================

    const cleanPhone =
        phoneNumber.replace(
            /[\s\-\(\)]/g,
            ''
        );

    // =========================
    // URL
    // =========================

    const encodedMessage =
        encodeURIComponent(message);

    const whatsappUrl =
        `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // =========================
    // OPEN
    // =========================

    window.open(
        whatsappUrl,
        '_blank'
    );
}

window.toggleKPIs = toggleKPIs;
window.handleSearch = handleSearch;
window.expandReport = expandReport;
window.recargarDatos = recargarDatos;
window.imprimirReporte = imprimirReporte;
window.enviarWhatsApp = enviarWhatsApp;
window.enviarWhatsAppIndividual = enviarWhatsAppIndividual;
window.cerrarModalReporte = cerrarModalReporte;
window.guardarCambiosReporte = guardarCambiosReporte;
