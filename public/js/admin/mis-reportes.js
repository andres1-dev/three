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

    const reportNormalized = {};
    for (const key in rep) {
        reportNormalized[key.toLowerCase()] = rep[key];
    }
    reportNormalized._autoPrint = false;
    reportNormalized._autoprint = false;

    localStorage.setItem('printReporteCalidad', JSON.stringify(reportNormalized));
    window.open('plantilla-impresion-calidad.html', '_blank');
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

function enviarWhatsApp() {

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
    // AGRUPAR REPORTES
    // =========================

    const groups = {
        AUDITORIA: [],
        RONDA: [],
        CONTRAMUESTRA: [],
        SEGUIMIENTO: []
    };

    gsFilteredReportes.forEach(r => {

        const tipo =
            (r.TIPO_VISITA || 'RONDA')
            .toUpperCase()
            .trim();

        if (groups[tipo]) {

            groups[tipo].push(r);

        } else {

            groups.RONDA.push(r);
        }
    });

    // =========================
    // LABELS
    // =========================

    const tipoLabels = {
        AUDITORIA: 'AUDITORÍAS',
        RONDA: 'RONDAS',
        CONTRAMUESTRA: 'CONTRAMUESTRAS',
        SEGUIMIENTO: 'SEGUIMIENTOS'
    };

    // =========================
    // RENDER REPORTES
    // =========================

    Object.keys(groups).forEach(tipo => {

        const reports = groups[tipo];

        if (reports.length === 0) return;

        // =========================
        // TITULO DEL GRUPO
        // =========================

        message += `*${tipoLabels[tipo]} (${reports.length})*\n\n`;

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

window.toggleKPIs = toggleKPIs;
window.handleSearch = handleSearch;
window.expandReport = expandReport;
window.recargarDatos = recargarDatos;
window.imprimirReporte = imprimirReporte;
window.enviarWhatsApp = enviarWhatsApp;
