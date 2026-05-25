/**
 * calidad.js — Lógica para Dashboard de Calidad (Analítico)
 */

let gsReportes = [];
let gsFilteredReportes = [];
let dateRangePicker = null;
let selectedDateRange = null;

// Chart instances
let chartConformidad, chartTiposVisita, chartAuditor, chartPlantas;

let globalReportesPromise = null;
const auditorNameByEmail = new Map();
let gsTableReportes = [];
let tableSearchTerm = '';
let tableCurrentPage = 1;
const TABLE_PAGE_SIZE = 20;

function resolveUserDisplayName(u) {
    if (!u) return '';
    const fromParts = [u.NOMBRES, u.APELLIDOS].filter(Boolean).map(String).join(' ').trim();
    const candidates = [
        u.NOMBRE,
        u.USUARIO,
        u.FULL_NAME,
        u.full_name,
        fromParts || null
    ];
    return candidates.map(v => v && String(v).trim()).find(Boolean) || '';
}

function buildAuditorLookup() {
    auditorNameByEmail.clear();
    (window.allUsers || []).forEach(u => {
        const email = String(u.CORREO || u.correo || u.EMAIL || u.email || '').toLowerCase().trim();
        if (!email) return;
        const name = resolveUserDisplayName(u);
        if (name) auditorNameByEmail.set(email, name);
    });
}

function getAuditorName(email) {
    if (!email) return 'Desconocido';
    const lowEmail = String(email).toLowerCase().trim();
    if (auditorNameByEmail.has(lowEmail)) return auditorNameByEmail.get(lowEmail);

    const u = (window.allUsers || []).find(x => {
        const correo = String(x.CORREO || x.correo || x.EMAIL || x.email || '').toLowerCase().trim();
        return correo === lowEmail;
    });
    const name = resolveUserDisplayName(u);
    if (name) {
        auditorNameByEmail.set(lowEmail, name);
        return name;
    }
    return lowEmail.split('@')[0];
}

function enrichReporteRecord(r) {
    r._date = parsearFechaLatina(String(r.TIMESTAMP || r.FECHA || r.fecha || '')) || new Date(0);
    r._auditorName = getAuditorName(r.email || r.EMAIL);
    r._productora = getProductoraName(String(r.productora || r.PRODUCTORA || '1'));
    r._conclusion = String(r.conclusion || r.CONCLUSION || '').toUpperCase();
    r._tipo = String(r.tipo_visita || r.TIPO_VISITA || 'OTRO').toUpperCase();
    r._planta = String(r.planta || r.PLANTA || 'NO DEFINIDA').toUpperCase();
    r._cantidad = parseInt(r.cantidad || r.CANTIDAD || 0, 10) || 0;
}
(function initFastPrefetch() {
    try {
        if (typeof fetchReportesData === 'function') {
            console.log('[FAST-LOAD] 🚀 Ejecutando prefetch de calidad...');
            globalReportesPromise = fetchReportesData();
        }
    } catch (e) { }
})();

window.onload = async function () {
    await loadUsers(); // Cargar usuarios primero para mapear correos a nombres
    buildAuditorLookup();
    await cargarDatosCalidadLocal(globalReportesPromise);
};

async function cargarDatosCalidadLocal(reportesPromise) {
    const loader = document.getElementById('loaderOverlay');
    const dataSection = document.getElementById('dashboardContent');

    if (loader) loader.style.display = 'flex';
    if (dataSection) dataSection.style.display = 'none';

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

        gsReportes.forEach(enrichReporteRecord);

        gsReportes.sort((a, b) => b._date - a._date);
        gsFilteredReportes = [...gsReportes];

        initFilters();
        initDateRangePicker();
        initCharts();
        window.applyFilters();

        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'block';

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

async function recargarDatosCalidad() {
    const loader = document.getElementById('loaderOverlay');
    const dataSection = document.getElementById('dashboardContent');

    if (loader) loader.style.display = 'flex';
    if (dataSection) dataSection.style.display = 'none';

    try {
        if (typeof invalidateCache === 'function') invalidateCache('REPORTES');
        gsReportes = await fetchReportesData();

        gsReportes.forEach(enrichReporteRecord);

        gsReportes.sort((a, b) => b._date - a._date);

        if (dateRangePicker) {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            dateRangePicker.setDate([firstDay, today]);
            selectedDateRange = [firstDay, today];
        }
        const filterProductora = document.getElementById('filterProductora');
        if (filterProductora && !filterProductora.disabled) {
            filterProductora.value = '';
        }
        document.getElementById('filterAuditor').value = '';
        if (document.getElementById('filterEstado')) document.getElementById('filterEstado').value = '';
        document.getElementById('filterTipo').value = '';

        window.applyFilters();

        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'block';

        Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1500, showConfirmButton: false });

    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error al Recargar', text: error.message });
        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'block';
    }
}

function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let s = String(d).trim();
    if (!s) return null;

    // Intentar parseo nativo primero (con o sin T)
    let parsed = new Date(s);
    if (!isNaN(parsed)) return parsed;

    parsed = new Date(s.replace(' ', 'T'));
    if (!isNaN(parsed)) return parsed;

    // Fallback para fechas invertidas como DD/MM/YYYY
    const parts = s.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts.length > 1 ? parts.slice(1).join(' ') : '00:00:00';

    const sep = datePart.includes('/') ? '/' : (datePart.includes('-') ? '-' : null);
    if (!sep) return new Date(d);

    const dParts = datePart.split(sep);
    if (dParts.length < 3) return new Date(d);

    let year, month, day;
    if (dParts[0].length === 4) { year = dParts[0]; month = dParts[1]; day = dParts[2]; }
    else { day = dParts[0]; month = dParts[1]; year = dParts[2]; }

    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
}

function getProductoraName(prodId) {
    if (!prodId) return 'Desconocida';
    const allProds = window._allProductoras || JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
    const p = allProds.find(x => String(x.id_productora) === String(prodId));
    return p ? p.productora : `Productora ${prodId}`;
}

function initFilters() {
    // Populate Productora
    const selectProd = document.getElementById('filterProductora');
    const containerProd = document.getElementById('filterProductoraContainer');
    if (containerProd) containerProd.style.display = 'block';

    const isUserP = window.currentUser && window.currentUser.ROL === 'USER-P';
    const userProdId = isUserP ? (window.currentUser.ID_PRODUCTORA || window.currentUser.id_productora || null) : null;
    const userProdName = isUserP ? (window.currentUser.PRODUCTORA || window.currentUser.productora || (userProdId ? getProductoraName(userProdId) : '')) : null;

    if (isUserP && userProdName) {
        selectProd.innerHTML = `<option value="${escAttr(userProdName)}">${escAttr(userProdName)}</option>`;
        selectProd.value = userProdName;
        selectProd.disabled = true;
        selectProd.title = 'Filtrado por la productora del usuario';
    } else {
        selectProd.disabled = false;
        selectProd.title = '';
        const productoras = [...new Set(gsReportes.map(r => r._productora))].filter(Boolean);
        selectProd.innerHTML = '<option value="">Todas</option>';
        productoras.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            selectProd.appendChild(opt);
        });
    }

    // Populate Auditor
    const auditores = [...new Set(gsReportes.map(r => r._auditorName))].filter(Boolean).sort();
    const selectAuditor = document.getElementById('filterAuditor');
    selectAuditor.innerHTML = '<option value="">Todos los Auditores</option>';
    auditores.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        selectAuditor.appendChild(opt);
    });

    // Populate Estado (Aprobado / Rechazado)
    const selectEstado = document.getElementById('filterEstado');
    if (selectEstado) {
        selectEstado.innerHTML = '<option value="">Todos</option>' +
            '<option value="APROBADO">Aprobado</option>' +
            '<option value="RECHAZADO">Rechazado</option>';
    }
}

function initDateRangePicker() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    selectedDateRange = [firstDay, today];

    dateRangePicker = flatpickr("#dateRangePicker", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "es",
        defaultDate: [firstDay, today],
        onChange: function (selectedDates) {
            if (selectedDates.length === 2) {
                selectedDateRange = selectedDates;
                window.applyFilters();
            } else if (selectedDates.length === 0) {
                selectedDateRange = null;
                window.applyFilters();
            }
        }
    });
}

window.applyFilters = function () {
    const prod = document.getElementById('filterProductora').value;
    const aud = document.getElementById('filterAuditor').value;
    const tipo = document.getElementById('filterTipo').value;
    const estado = (document.getElementById('filterEstado') && document.getElementById('filterEstado').value) || '';

    gsFilteredReportes = gsReportes.filter(r => {
        let okProd = !prod || r._productora === prod;
        let okAud = !aud || r._auditorName === aud;
        let okTipo = !tipo || r._tipo === tipo;

        let okDate = true;
        if (selectedDateRange && selectedDateRange.length === 2) {
            const start = new Date(selectedDateRange[0]); start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDateRange[1]); end.setHours(23, 59, 59, 999);
            const rDate = r._date;
            okDate = (rDate >= start && rDate <= end);
        }
        let okEstado = !estado || (String(r._conclusion || '').toUpperCase() === String(estado || '').toUpperCase());

        return okProd && okAud && okTipo && okDate && okEstado;
    });

    updateDashboard();
};

function updateDashboard() {
    tableCurrentPage = 1;
    actualizarKPIs();
    updateCharts();
    renderTable();
}

function getReportSearchText(r) {
    return [
        r.referencia, r.REFERENCIA, r.id, r.ID, r.lote, r.LOTE,
        r._planta, r.planta, r.PLANTA, r._auditorName,
        r.email, r.EMAIL, r._tipo, r._conclusion, r._productora,
        r.observaciones, r.OBSERVACIONES
    ].map(v => String(v || '').toLowerCase()).join(' ');
}

function applyTableSearchFilter() {
    const q = tableSearchTerm.toLowerCase().trim();
    gsTableReportes = q
        ? gsFilteredReportes.filter(r => getReportSearchText(r).includes(q))
        : [...gsFilteredReportes];
}

window.handleCalidadTableSearch = function () {
    tableSearchTerm = document.getElementById('calidadTableSearch')?.value || '';
    tableCurrentPage = 1;
    renderTable();
};

window.clearCalidadTableSearch = function () {
    const input = document.getElementById('calidadTableSearch');
    if (input) input.value = '';
    tableSearchTerm = '';
    tableCurrentPage = 1;
    renderTable();
};

window.verReporteCalidad = function (index) {
    const rep = gsTableReportes[index];
    if (!rep) return;

    const reportNormalized = {};
    for (const key in rep) {
        if (key.startsWith('_')) continue;
        reportNormalized[key.toLowerCase()] = rep[key];
    }
    reportNormalized._autoprint = false;

    localStorage.setItem('printReporteCalidad', JSON.stringify(reportNormalized));
    window.open('plantilla-impresion-calidad.html', '_blank');
};

function escAttr(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatFechaTabla(date) {
    if (!date || isNaN(date)) return '—';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
}

function renderEstadoCell(conclusion) {
    const label = String(conclusion || '—').toUpperCase();
    const c = label.replace(/—/g, '');
    if (c === 'APROBADO') {
        return `<span class="estado-badge aprobado">${label}</span>`;
    }
    if (c === 'RECHAZADO') {
        return `<span class="estado-badge rechazado">${label}</span>`;
    }
    return label || '—';
}

function renderTablePagination(totalItems, totalPages) {
    const pagination = document.getElementById('tablePagination');
    const info = document.getElementById('tablePaginationInfo');
    const btns = document.getElementById('tablePaginationBtns');
    if (!pagination || !info || !btns) return;

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    const start = (tableCurrentPage - 1) * TABLE_PAGE_SIZE + 1;
    const end = Math.min(tableCurrentPage * TABLE_PAGE_SIZE, totalItems);
    info.textContent = `Mostrando ${start}–${end} de ${totalItems.toLocaleString('es-CO')} reportes`;

    let html = `
        <button type="button" class="btn-page" ${tableCurrentPage <= 1 ? 'disabled' : ''}
            onclick="changeCalidadTablePage(${tableCurrentPage - 1})" title="Anterior">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - tableCurrentPage) <= 1) pages.push(p);
    }
    let last = 0;
    pages.forEach(p => {
        if (last && p - last > 1) {
            html += `<span style="padding:0 4px;color:#94a3b8;">…</span>`;
        }
        html += `<button type="button" class="btn-page ${p === tableCurrentPage ? 'active' : ''}"
            onclick="changeCalidadTablePage(${p})">${p}</button>`;
        last = p;
    });

    html += `
        <button type="button" class="btn-page" ${tableCurrentPage >= totalPages ? 'disabled' : ''}
            onclick="changeCalidadTablePage(${tableCurrentPage + 1})" title="Siguiente">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    btns.innerHTML = html;
}

window.changeCalidadTablePage = function (page) {
    const totalPages = Math.max(1, Math.ceil(gsTableReportes.length / TABLE_PAGE_SIZE));
    if (page < 1 || page > totalPages) return;
    tableCurrentPage = page;
    renderTable(false);
};

function sumCantidad(reportes) {
    return reportes.reduce((s, r) => s + r._cantidad, 0);
}

function pctUnidades(parte, total) {
    if (!total || total <= 0) return '0.0';
    return ((parte / total) * 100).toFixed(1);
}

function actualizarKPIs() {
    const total = gsFilteredReportes.length;
    const totalUnidades = sumCantidad(gsFilteredReportes);

    document.getElementById('kpi-total').innerText = totalUnidades.toLocaleString('es-CO');
    document.getElementById('kpi-total-sub').innerText =
        `${total.toLocaleString('es-CO')} reporte${total === 1 ? '' : 's'} en el periodo`;

    const oksReports = gsFilteredReportes.filter(r => r._conclusion === 'APROBADO');
    const rejsReports = gsFilteredReportes.filter(r => r._conclusion === 'RECHAZADO');
    const oks = oksReports.length;
    const rejs = rejsReports.length;
    const oksUnits = sumCantidad(oksReports);
    const rejsUnits = sumCantidad(rejsReports);

    document.getElementById('kpi-ok').innerText = oksUnits.toLocaleString('es-CO');
    document.getElementById('kpi-ok-sub').innerText = totalUnidades > 0
        ? `${oks.toLocaleString('es-CO')} reportes · ${pctUnidades(oksUnits, totalUnidades)}% unidades`
        : `${oks.toLocaleString('es-CO')} reportes`;

    document.getElementById('kpi-rejected').innerText = rejsUnits.toLocaleString('es-CO');
    document.getElementById('kpi-rejected-sub').innerText = totalUnidades > 0
        ? `${rejs.toLocaleString('es-CO')} reportes · ${pctUnidades(rejsUnits, totalUnidades)}% unidades`
        : `${rejs.toLocaleString('es-CO')} reportes`;

    const plantas = new Set(gsFilteredReportes.map(r => r._planta));
    document.getElementById('kpi-plants').innerText = totalUnidades.toLocaleString('es-CO');
    document.getElementById('kpi-plants-sub').innerText =
        `${plantas.size} planta${plantas.size === 1 ? '' : 's'} · ${total.toLocaleString('es-CO')} reportes`;
}

function chartBarOpts(horizontal = false) {
    return {
        maintainAspectRatio: false,
        ...(horizontal ? { indexAxis: 'y' } : {}),
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1e293b',
                padding: 12,
                cornerRadius: 8,
                titleFont: { size: 12, weight: '700' },
                bodyFont: { size: 11 },
                callbacks: {
                    label(ctx) {
                        const units = horizontal ? ctx.parsed.x : ctx.parsed.y;
                        const reports = ctx.dataset.reportCounts?.[ctx.dataIndex];
                        const lines = [`Unidades: ${Number(units || 0).toLocaleString('es-CO')}`];
                        if (reports !== undefined) {
                            lines.push(`Reportes: ${Number(reports).toLocaleString('es-CO')}`);
                        }
                        return lines;
                    }
                }
            }
        },
        scales: {
            x: { beginAtZero: true, stacked: false, grid: { color: 'rgba(0,0,0,0.05)' } },
            y: {
                beginAtZero: true,
                stacked: false,
                grid: horizontal ? { display: false } : { color: 'rgba(0,0,0,0.05)' },
                ticks: horizontal ? { font: { size: 10 } } : undefined
            }
        }
    };
}

function setUnitsDataset(chart, unitsData, reportCounts, color) {
    chart.data.datasets = [{
        label: 'Unidades',
        data: unitsData,
        reportCounts: reportCounts,
        backgroundColor: color,
        borderRadius: horizontalRadius(chart),
        maxBarThickness: 42
    }];
}

function setConformidadChart(oksReports, rejsReports) {
    chartConformidad.data.labels = ['Aprobadas', 'Rechazadas'];
    chartConformidad.data.datasets = [{
        label: 'Unidades',
        data: [sumCantidad(oksReports), sumCantidad(rejsReports)],
        reportCounts: [oksReports.length, rejsReports.length],
        backgroundColor: ['rgba(16, 185, 129, 0.32)', 'rgba(239, 68, 68, 0.32)'],
        borderRadius: 6,
        maxBarThickness: 48
    }];
}

function horizontalRadius(chart) {
    return chart?.options?.indexAxis === 'y' ? 4 : 6;
}

function initCharts() {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    chartConformidad = new Chart(document.getElementById('chartConformidad'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: chartBarOpts(false)
    });

    chartTiposVisita = new Chart(document.getElementById('chartTiposVisita'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: chartBarOpts(false)
    });

    chartAuditor = new Chart(document.getElementById('chartAuditor'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: chartBarOpts(true)
    });

    chartPlantas = new Chart(document.getElementById('chartPlantas'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: chartBarOpts(true)
    });
}

function aggregateByKey(reportes, keyFn) {
    const map = {};
    reportes.forEach(r => {
        const key = keyFn(r);
        if (!map[key]) map[key] = { count: 0, units: 0 };
        map[key].count++;
        map[key].units += r._cantidad;
    });
    return map;
}

function updateCharts() {
    const oksReports = gsFilteredReportes.filter(r => r._conclusion === 'APROBADO');
    const rejsReports = gsFilteredReportes.filter(r => r._conclusion === 'RECHAZADO');

    setConformidadChart(oksReports, rejsReports);
    chartConformidad.update();

    const tiposMap = aggregateByKey(gsFilteredReportes, r => r._tipo);
    const tiposSorted = Object.entries(tiposMap).sort((a, b) => b[1].units - a[1].units);
    chartTiposVisita.data.labels = tiposSorted.map(i => i[0]);
    setUnitsDataset(
        chartTiposVisita,
        tiposSorted.map(i => i[1].units),
        tiposSorted.map(i => i[1].count),
        'rgba(6, 182, 212, 0.28)'
    );
    chartTiposVisita.update();

    const audSorted = Object.entries(aggregateByKey(gsFilteredReportes, r => r._auditorName))
        .sort((a, b) => b[1].units - a[1].units);
    chartAuditor.data.labels = audSorted.map(i => i[0]);
    setUnitsDataset(
        chartAuditor,
        audSorted.map(i => i[1].units),
        audSorted.map(i => i[1].count),
        'rgba(245, 158, 11, 0.28)'
    );
    chartAuditor.update();

    const plantSorted = Object.entries(aggregateByKey(gsFilteredReportes, r => r._planta))
        .sort((a, b) => b[1].units - a[1].units).slice(0, 10);
    chartPlantas.data.labels = plantSorted.map(i => i[0]);
    setUnitsDataset(
        chartPlantas,
        plantSorted.map(i => i[1].units),
        plantSorted.map(i => i[1].count),
        'rgba(236, 72, 153, 0.28)'
    );
    chartPlantas.update();
}

function renderTable(resetPage = true) {
    const tbody = document.getElementById('calidadTableBody');
    const emptyState = document.getElementById('tableEmpty');
    const meta = document.getElementById('tableResultsMeta');
    const tableWrap = document.querySelector('.reports-table-wrap table');

    if (resetPage) tableCurrentPage = 1;
    applyTableSearchFilter();

    const totalFiltered = gsFilteredReportes.length;
    const totalTable = gsTableReportes.length;

    if (meta) {
        const q = tableSearchTerm.trim();
        meta.textContent = q
            ? `${totalTable.toLocaleString('es-CO')} de ${totalFiltered.toLocaleString('es-CO')} reportes (búsqueda activa)`
            : `${totalTable.toLocaleString('es-CO')} reporte${totalTable === 1 ? '' : 's'} en el periodo`;
    }

    if (!tbody || !emptyState) return;

    if (totalTable === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        if (tableWrap) tableWrap.style.display = 'none';
        renderTablePagination(0, 0);
        return;
    }

    emptyState.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';

    const totalPages = Math.max(1, Math.ceil(totalTable / TABLE_PAGE_SIZE));
    if (tableCurrentPage > totalPages) tableCurrentPage = totalPages;

    const start = (tableCurrentPage - 1) * TABLE_PAGE_SIZE;
    const pageItems = gsTableReportes.slice(start, start + TABLE_PAGE_SIZE);

    tbody.innerHTML = pageItems.map((r, i) => {
        const globalIndex = start + i;
        const ref = r.referencia || r.REFERENCIA || r.id || r.ID || '—';
        const lote = r.lote || r.LOTE || r.id || r.ID || '—';
        const cantFmt = r._cantidad > 0 ? r._cantidad.toLocaleString('es-CO') : '—';
        return `
            <tr>
                <td class="cell-date">${formatFechaTabla(r._date)}</td>
                <td class="cell-lote" title="${escAttr(lote)}">${lote}</td>
                <td class="cell-ref" title="${escAttr(ref)}">${ref}</td>
                <td class="cell-planta" title="${escAttr(r._planta)}">${r._planta}</td>
                <td class="cell-auditor" title="${escAttr(r._auditorName)}">${r._auditorName}</td>
                <td class="cell-tipo">${r._tipo}</td>
                <td class="cell-qty">${cantFmt}</td>
                <td>${renderEstadoCell(r._conclusion)}</td>
                <td style="text-align:center;">
                    <button type="button" class="btn-ver-reporte" onclick="verReporteCalidad(${globalIndex})" title="Ver reporte">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderTablePagination(totalTable, totalPages);
}
