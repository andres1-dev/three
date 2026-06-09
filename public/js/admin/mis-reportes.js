let gsReportes = [];
let gsFilteredReportes = [];
let gsPlantas = [];
let gsUsuarios = [];
let dateRangePicker = null;
let selectedDateRange = null;

const TIPO_CONFIG = {
    AUDITORIA: { icon: 'fa-clipboard-check', color: '#8b5cf6', bg: '#f5f3ff', label: 'Auditorías' },
    RONDA: { icon: 'fa-route', color: '#06b6d4', bg: '#ecfeff', label: 'Rondas' },
    CONTRAMUESTRA: { icon: 'fa-vial', color: '#f59e0b', bg: '#fffbeb', label: 'Contramuestras' },
    SEGUIMIENTO: { icon: 'fa-tasks', color: '#ec4899', bg: '#fdf2f8', label: 'Seguimientos' },
    APROBACION: { icon: 'fa-check-circle', color: '#10b981', bg: '#f0fdf4', label: 'Aprobaciones' }
};

let globalReportesPromise = null;
(function initFastPrefetch() {
    try {
        if (typeof fetchReportesData === 'function') {
            globalReportesPromise = fetchReportesData();
        }
    } catch (e) { }
})();

window.onload = async function () {
    await loadUsers();
    const user = window.currentUser;
    if (!user || user.ROL !== 'USER-C') {
        window.location.replace('index.html');
        return;
    }

    // Cargar usuarios en gsUsuarios para uso en envío de correos
    if (window.allUsers) {
        gsUsuarios = window.allUsers;
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
        let rawReportes = [];
        let rawAprobaciones = [];
        try {
            const results = await Promise.all([
                reportesPromise || fetchReportesData(),
                fetchAprobacionesData(),
                fetchPlantasData({ forceEdge: true })
            ]);
            rawReportes = results[0] || [];
            rawAprobaciones = results[1] || [];
            gsPlantas = results[2] || [];
        } catch (ePar) {
            console.warn('[mis-reportes] Error cargando datos en paralelo:', ePar);
            rawReportes = await (reportesPromise || fetchReportesData());
            rawAprobaciones = await fetchAprobacionesData();
            try {
                gsPlantas = await fetchPlantasData({ forceEdge: true });
            } catch (ePl) {
                gsPlantas = [];
            }
        }

        const user = window.currentUser || {};
        const userEmail = (user.EMAIL || user.CORREO || '').toLowerCase().trim();
        
        // Filtrar reportes por email
        gsReportes = (rawReportes || []).filter(r => {
            return (r.EMAIL || '').toLowerCase().trim() === userEmail;
        });

        // Filtrar aprobaciones por email_usuario y normalizar estructura
        const aprobacionesNormalizadas = (rawAprobaciones || []).filter(r => {
            const emailApr = (r.email_usuario || r.EMAIL_USUARIO || '').toLowerCase().trim();
            return emailApr === userEmail;
        }).map(apr => ({
            ...apr,
            ID: apr.id_planta_anexo || apr.ID_PLANTA_ANEXO,
            LOTE: apr.id_planta_anexo || apr.ID_PLANTA_ANEXO,
            REFERENCIA: apr.planta_anexo || apr.PLANTA_ANEXO,
            PLANTA: apr.planta_anexo || apr.PLANTA_ANEXO,
            FECHA: apr.fecha_hora || apr.FECHA_HORA,
            TIPO_VISITA: 'APROBACION',
            CONCLUSION: apr.estado || apr.ESTADO,
            EMAIL: apr.email_usuario || apr.EMAIL_USUARIO,
            PRODUCTORA: apr.productora || apr.PRODUCTORA,
            TELEFONO: apr.telefono || apr.TELEFONO,
            DIRECCION: apr.direccion || apr.DIRECCION,
            DEPARTAMENTO: apr.departamento || apr.DEPARTAMENTO,
            CIUDAD: apr.ciudad || apr.CIUDAD,
            COMUNA: apr.comuna || apr.COMUNA,
            BARRIO: apr.barrio || apr.BARRIO,
            LOCALIZACION: apr.localizacion || apr.LOCALIZACION,
            OPERARIOS: apr.operarios || apr.OPERARIOS,
            MAQUINARIA: apr.maquinaria || apr.MAQUINARIA,
            HORARIOS: apr.horarios || apr.HORARIOS,
            TEJIDO: apr.tejido || apr.TEJIDO,
            FUERTE: apr.fuerte || apr.FUERTE,
            COMENTARIOS: apr.comentarios || apr.COMENTARIOS,
            FIRMA_SVG: apr.firma_svg || apr.FIRMA_SVG,
            SOPORTE: apr.soporte || apr.SOPORTE
        }));

        // Combinar reportes y aprobaciones
        gsReportes = [...gsReportes, ...aprobacionesNormalizadas];

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
        if (typeof invalidateCache === 'function') {
            invalidateCache('REPORTES');
            invalidateCache('PLANTAS');
        }

        let rawReportes = [];
        try {
            const results = await Promise.all([
                fetchReportesData(),
                fetchPlantasData({ forceEdge: true })
            ]);
            rawReportes = results[0] || [];
            gsPlantas = results[1] || [];
        } catch (ePar) {
            console.warn('[mis-reportes] Error recargando datos en paralelo:', ePar);
            rawReportes = await fetchReportesData();
            try {
                gsPlantas = await fetchPlantasData({ forceEdge: true });
            } catch (ePl) {
                gsPlantas = [];
            }
        }

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
        document.getElementById('kpi-aprobacion').textContent = '0';
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
    let aprobaciones = 0;

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
        else if (tipoVisita === 'APROBACION') aprobaciones++;
    });

    document.getElementById('kpi-ok').textContent = aprobados;
    document.getElementById('kpi-rejected').textContent = rechazados;
    document.getElementById('kpi-audit').textContent = auditorias;
    document.getElementById('kpi-ronda').textContent = rondas;
    document.getElementById('kpi-contramuestra').textContent = contramuestras;
    document.getElementById('kpi-seguimiento').textContent = seguimientos;
    document.getElementById('kpi-aprobacion').textContent = aprobaciones;

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
            <div class="modern-empty-state">
                <i class="fas fa-folder-open modern-empty-state-icon"></i>
                <div class="modern-empty-state-title">No se encontraron reportes</div>
                <div class="modern-empty-state-desc">No hay reportes que coincidan con la búsqueda o el rango de fechas seleccionado.</div>
            </div>
        `;
        return;
    }

    const groups = { AUDITORIA: [], RONDA: [], CONTRAMUESTRA: [], SEGUIMIENTO: [], APROBACION: [] };

    gsFilteredReportes.forEach(r => {
        const tipo = (r.TIPO_VISITA || 'RONDA').toUpperCase();
        if (groups[tipo]) groups[tipo].push(r);
        else groups['RONDA'].push(r);
    });

    const tipoOrder = ['AUDITORIA', 'RONDA', 'CONTRAMUESTRA', 'SEGUIMIENTO', 'APROBACION'];

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
            const isAprobacion = (r.TIPO_VISITA || '').toUpperCase() === 'APROBACION';

            const nombreP = (r.PLANTA || r.planta || '').trim().toLowerCase();
            const repProductora = Number(r.PRODUCTORA || r.productora);
            const pObj = gsPlantas.find(p =>
                (p.PLANTA || p.planta || '').trim().toLowerCase() === nombreP &&
                (!repProductora || Number(p.PRODUCTORA || p.productora) === repProductora)
            );
            
            // Para aprobaciones, usar teléfono y correo del propio registro
            // Para reportes, usar teléfono y correo de la tabla de plantas
            const tieneCorreo = isAprobacion ? !!(r.EMAIL || r.email) : !!(pObj && (pObj.CORREO || pObj.EMAIL || pObj.correo || pObj.email));
            const tieneTelefono = isAprobacion ? !!(r.TELEFONO || r.telefono) : !!(pObj && (pObj.TELEFONO || pObj.telefono));

            rowsHtml += `
                <tr class="planta-row-mobile">
                    <td colspan="6"><span>${r.PLANTA || '-'}</span></td>
                </tr>
                <tr>
                    <td><span style="font-weight:600; white-space:nowrap;">${formatFechaCompacta(r.FECHA)}</span></td>
                    <td><span style="font-weight:700; color:#3f51b5;">${isAprobacion ? r.ID || '-' : (r.ID || 'OP')}</span></td>
                    <td>${isAprobacion ? (r.DIRECCION || '-') : (r.REFERENCIA || '-')}</td>
                    <td>${r.PLANTA || '-'}</td>
                    <td><span class="status-badge-sm ${statusInfo.class} text-white">${statusInfo.label}</span></td>
                    <td>
                         <div class="action-btns">
                             <button class="action-btn action-btn-ver" onclick="${isAprobacion ? 'expandAprobacion' : 'expandReport'}(${globalIdx})" title="Ver detalle">
                                 <i class="fas fa-eye"></i>
                             </button>
                             ${isAprobacion ? '' : `
                             <button class="action-btn action-btn-print" onclick="imprimirReporte(${globalIdx})" title="Imprimir">
                                 <i class="fas fa-print"></i>
                             </button>
                             `}
                             <button class="action-btn action-btn-whatsapp" onclick="${isAprobacion ? 'enviarWhatsAppAprobacion' : 'enviarWhatsAppIndividual'}(${globalIdx})" title="Enviar por WhatsApp" ${tieneTelefono ? '' : 'disabled style="opacity: 0.35; cursor: not-allowed;"'}>
                                 <i class="fab fa-whatsapp"></i>
                             </button>
                             <button class="action-btn action-btn-email" onclick="${isAprobacion ? 'enviarCorreoAprobacion' : 'enviarCorreoCalidad'}(${globalIdx})" title="Enviar por Correo" ${tieneCorreo ? '' : 'disabled style="opacity: 0.35; cursor: not-allowed;"'}>
                                 <i class="fas fa-envelope"></i>
                             </button>
                             ${isAprobacion ? '' : `
                             <button class="action-btn action-btn-editar-planta" onclick="abrirModalPlantaReporte(${globalIdx})" title="Validar / Editar Taller">
                                 <i class="fas fa-address-card"></i>
                             </button>
                             `}
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

async function enviarCorreoCalidad(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Buscar el correo REGISTRADO de la planta (no el del auditor)
    // En Supabase el campo se llama 'correo' → normalizado queda 'CORREO'
    let emailPlanta = '';
    let plantaObj = null;
    try {
        const plantas = await fetchPlantasData();
        const nombrePlanta = (rep.PLANTA || rep.planta || '').trim().toLowerCase();
        const repProductora = Number(rep.PRODUCTORA || rep.productora);
        plantaObj = plantas.find(p =>
            (p.PLANTA || p.planta || '').trim().toLowerCase() === nombrePlanta &&
            (!repProductora || Number(p.PRODUCTORA || p.productora) === repProductora)
        );

        // Si no se encuentra con la consulta rápida/caché habitual, forzamos por la Edge Function (Bypass RLS)
        if (!plantaObj) {
            console.log('[mis-reportes] Planta no encontrada por RLS/SDK. Buscando por Edge Function...');
            const plantasEdge = await fetchPlantasData({ forceEdge: true });
            plantaObj = plantasEdge.find(p =>
                (p.PLANTA || p.planta || '').trim().toLowerCase() === nombrePlanta &&
                (!repProductora || Number(p.PRODUCTORA || p.productora) === repProductora)
            );
        }

        // El campo puede venir como CORREO (Supabase) o EMAIL (hoja legado) tanto en mayúsculas como en minúsculas
        emailPlanta = plantaObj ? (plantaObj.CORREO || plantaObj.EMAIL || plantaObj.correo || plantaObj.email || '') : '';
    } catch (e) {
        console.warn('[mis-reportes] No se pudo obtener email de planta:', e);
    }

    if (!emailPlanta) {
        await Swal.fire({
            icon: 'info',
            title: 'Taller sin correo o no registrado',
            text: 'Para enviar este reporte por correo, primero debe registrar o completar los datos del taller. Se abrirá el formulario de gestión.',
            confirmButtonText: 'Completar Datos',
            confirmButtonColor: '#3F51B5'
        });

        abrirModalPlantaReporte(index);
        return;
    }


    try {
        Swal.fire({
            title: 'Enviando correo...',
            text: 'Por favor espere mientras se procesa la solicitud.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Obtener copias de usuarios ADMIN/MODERATOR con email_copia activado
        let ccEmails = [];
        if (gsUsuarios && gsUsuarios.length > 0) {
            ccEmails = gsUsuarios
                .filter(u => {
                    const rol = (u.ROL || u.rol || '').toUpperCase();
                    const emailCopia = u.EMAIL_COPIA || u.email_copia || false;
                    const correo = u.CORREO || u.correo || '';
                    return (rol === 'ADMIN' || rol === 'MODERATOR') && emailCopia === true && correo;
                })
                .map(u => u.CORREO || u.correo)
                .filter(email => email);
        }

        const payload = {
            accion: 'REPORTE_CALIDAD',
            email: emailPlanta,
            cc: ccEmails.length > 0 ? ccEmails : [],
            reporte: {
                ...rep,
                fecha_entrega: rep.fecha_entrega || rep.FECHA_ENTREGA || rep.entrada || rep.ENTRADA || '',
                fecha_salida: rep.fecha_salida || rep.FECHA_SALIDA || rep.salida || rep.SALIDA || ''
            }
        };

        const resData = await sendToSupabase(payload);

        if (resData && resData.success === true) {
            Swal.fire({
                icon: 'success',
                title: 'Correo Enviado',
                html: `El reporte fue enviado al correo registrado de <b>${rep.PLANTA}</b>.`,
                timer: 2500,
                showConfirmButton: false
            });
        } else {
            throw new Error((resData && resData.message) || 'Error al enviar el correo a través de Supabase');
        }

    } catch (error) {
        console.error('Error al enviar correo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de Envío',
            text: error.message || 'Ocurrió un problema de red. Por favor intente nuevamente más tarde.',
            confirmButtonColor: '#3F51B5'
        });
    }
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
        onChange: function (selectedDates) {
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
        onClose: function (selectedDates) {
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

function expandAprobacion(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Crear modal específico para aprobaciones con el mismo diseño que reportes
    const modalHtml = `
        <div class="modal fade" id="aprobacionModal" tabindex="-1" style="display: none;">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold">
                            <i class="fas fa-check-circle me-2"></i>Ver Aprobación
                        </h5>
                        <button type="button" class="btn-close" onclick="cerrarModalAprobacion()"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-hashtag me-1"></i>ID Planta Anexo</label>
                                <input type="text" class="form-control" value="${rep.ID || rep.id_planta_anexo || 'N/A'}" readonly>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-calendar-alt me-1"></i>Fecha</label>
                                <input type="text" class="form-control" value="${formatFechaCompacta(rep.FECHA)}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-industry me-1"></i>Nombre de Planta</label>
                                <input type="text" class="form-control" value="${rep.PLANTA || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-envelope me-1"></i>Email Usuario</label>
                                <input type="text" class="form-control" value="${rep.EMAIL || 'N/A'}" readonly>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-phone me-1"></i>Teléfono</label>
                                <input type="text" class="form-control" value="${rep.TELEFONO || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-4">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-map me-1"></i>Departamento</label>
                                <input type="text" class="form-control" value="${rep.DEPARTAMENTO || 'N/A'}" readonly>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-city me-1"></i>Ciudad</label>
                                <input type="text" class="form-control" value="${rep.CIUDAD || 'N/A'}" readonly>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-users me-1"></i>Operarios</label>
                                <input type="text" class="form-control" value="${rep.OPERARIOS || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-road me-1"></i>Dirección</label>
                                <input type="text" class="form-control" value="${rep.DIRECCION || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-map-marked-alt me-1"></i>Comuna</label>
                                <input type="text" class="form-control" value="${rep.COMUNA || 'N/A'}" readonly>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-home me-1"></i>Barrio</label>
                                <input type="text" class="form-control" value="${rep.BARRIO || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-map-marker-alt me-1"></i>Localización</label>
                                <input type="text" class="form-control" value="${rep.LOCALIZACION || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-tshirt me-1"></i>Tipo de Tejido</label>
                                <input type="text" class="form-control" value="${Array.isArray(rep.TEJIDO) ? rep.TEJIDO.join(', ') : (rep.TEJIDO || 'N/A')}" readonly>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-tag me-1"></i>Tipos de Prendas</label>
                                <input type="text" class="form-control" value="${Array.isArray(rep.FUERTE) ? rep.FUERTE.join(', ') : (rep.FUERTE || 'N/A')}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-clipboard-check me-1"></i>Estado</label>
                                <input type="text" class="form-control" value="${rep.CONCLUSION || 'N/A'}" readonly>
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-comment me-1"></i>Comentarios</label>
                                <textarea class="form-control" rows="2" readonly>${rep.COMENTARIOS || 'N/A'}</textarea>
                            </div>
                        </div>
                        ${rep.SOPORTE ? `
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-camera me-1"></i>Soporte Fotográfico</label>
                                <div class="zoom-container" onclick="abrirLightbox('${rep.SOPORTE}')" style="width: 100%; height: 200px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; cursor: pointer;">
                                    <img src="${rep.SOPORTE}" style="width: 100%; height: 100%; object-fit: cover;" alt="Soporte visual">
                                    <div class="zoom-overlay">
                                        <i class="fas fa-search-plus"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        ${rep.FIRMA_SVG ? `
                        <div class="row mb-3">
                            <div class="col-md-12">
                                <label class="form-label small fw-bold" style="color: #64748b;"><i class="fas fa-signature me-1"></i>Firma Digital</label>
                                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                    ${rep.FIRMA_SVG}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                        <div class="d-flex gap-2 w-100">
                            <button type="button" class="btn flex-1" onclick="cerrarModalAprobacion()" style="background: #e2e8f0; border: none; color: #475569; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 500;">
                                <i class="fas fa-times me-1"></i>Cerrar
                            </button>
                            <button type="button" class="btn flex-1 text-white" onclick="imprimirAprobacion('${rep.ID || rep.id_planta_anexo}')" style="background: #3f51b5; border: none; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 500;">
                                <i class="fas fa-print me-1"></i>Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Eliminar modal anterior si existe
    const existingModal = document.getElementById('aprobacionModal');
    if (existingModal) existingModal.remove();

    // Agregar nuevo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal - misma lógica que expandReport
    const modalEl = document.getElementById('aprobacionModal');
    modalEl.style.display = 'flex';
    modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarModalAprobacion() {
    const modal = document.getElementById('aprobacionModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 200);
    }
    document.body.style.overflow = '';
}

function imprimirAprobacion(id) {
    const rep = gsReportes.find(r => (r.ID || r.id_planta_anexo) === id);
    if (!rep) return;

    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    
    // Obtener nombre de productora
    const productoraNombre = rep.PRODUCTORA ? obtenerNombreProductora(rep.PRODUCTORA, gsProductoras) : 'N/A';

    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Aprobación - ${rep.PLANTA || 'N/A'}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #3f51b5;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #3f51b5;
                    margin: 0;
                }
                .section {
                    margin-bottom: 25px;
                }
                .section-title {
                    font-weight: bold;
                    color: #3f51b5;
                    font-size: 16px;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 5px;
                }
                .field {
                    margin-bottom: 10px;
                }
                .field-label {
                    font-weight: 600;
                    color: #64748b;
                }
                .field-value {
                    color: #212529;
                }
                .status-badge {
                    display: inline-block;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-weight: bold;
                    color: white;
                }
                .status-aprobado { background: #10b981; }
                .status-rechazado { background: #ef4444; }
                .status-pendiente { background: #f59e0b; }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    color: #64748b;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏭 APROBACIÓN DE PLANTA</h1>
                <p style="margin: 5px 0 0 0; color: #64748b;">ID: ${rep.ID || rep.id_planta_anexo || 'N/A'}</p>
            </div>

            <div class="section">
                <div class="section-title">📋 DATOS GENERALES</div>
                <div class="field">
                    <span class="field-label">Planta:</span> <span class="field-value">${rep.PLANTA || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Fecha:</span> <span class="field-value">${formatFechaCompacta(rep.FECHA)}</span>
                </div>
                <div class="field">
                    <span class="field-label">Estado:</span> 
                    <span class="status-badge ${getStatusInfo(rep.CONCLUSION).class}">${rep.CONCLUSION || 'N/A'}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">📍 UBICACIÓN</div>
                <div class="field">
                    <span class="field-label">Departamento:</span> <span class="field-value">${rep.DEPARTAMENTO || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Ciudad:</span> <span class="field-value">${rep.CIUDAD || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Comuna:</span> <span class="field-value">${rep.COMUNA || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Barrio:</span> <span class="field-value">${rep.BARRIO || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Dirección:</span> <span class="field-value">${rep.DIRECCION || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Localización:</span> <span class="field-value">${rep.LOCALIZACION || 'N/A'}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">👥 CONTACTO</div>
                <div class="field">
                    <span class="field-label">Email:</span> <span class="field-value">${rep.EMAIL || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Teléfono:</span> <span class="field-value">${rep.TELEFONO || 'N/A'}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">👷 CAPACIDAD</div>
                <div class="field">
                    <span class="field-label">Operarios:</span> <span class="field-value">${rep.OPERARIOS || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">Tipo de Tejido:</span> <span class="field-value">${Array.isArray(rep.TEJIDO) ? rep.TEJIDO.join(', ') : (rep.TEJIDO || 'N/A')}</span>
                </div>
                <div class="field">
                    <span class="field-label">Tipos de Prendas:</span> <span class="field-value">${Array.isArray(rep.FUERTE) ? rep.FUERTE.join(', ') : (rep.FUERTE || 'N/A')}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">💬 OBSERVACIONES</div>
                <div class="field">
                    <span class="field-value">${rep.COMENTARIOS || 'Sin comentarios'}</span>
                </div>
            </div>

            <div class="footer">
                <p>Productora: ${productoraNombre || 'N/A'}</p>
                <p>Fecha de impresión: ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

async function enviarWhatsAppAprobacion(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Usar el teléfono directamente del reporte de aprobación
    const phoneNumber = rep.TELEFONO || rep.telefono || '';

    if (!phoneNumber) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin número de teléfono',
            text: 'Esta aprobación no tiene un número de teléfono registrado.',
            confirmButtonColor: '#3F51B5'
        });
        return;
    }

    // Obtener nombre de productora
    const productorasList = await obtenerProductoras();
    const productoraNombre = obtenerNombreProductora(rep.PRODUCTORA || rep.productora, productorasList);

    // Parsear maquinaria y horarios
    let maquinariaText = 'N/A';
    let horariosText = 'N/A';
    
    console.log('[WhatsApp Aprobacion] Datos del rep:', rep);
    console.log('[WhatsApp Aprobacion] maquinaria:', rep.maquinaria, rep.MAQUINARIA);
    console.log('[WhatsApp Aprobacion] horarios:', rep.horarios, rep.HORARIOS);
    
    // Maquinaria - puede ser string JSON o objeto JSONB
    try {
        const maquinariaRaw = rep.maquinaria || rep.MAQUINARIA;
        console.log('[WhatsApp Aprobacion] maquinariaRaw:', maquinariaRaw, typeof maquinariaRaw);
        if (maquinariaRaw) {
            let maquinariaData;
            if (typeof maquinariaRaw === 'string') {
                maquinariaData = JSON.parse(maquinariaRaw);
            } else {
                maquinariaData = maquinariaRaw;
            }
            console.log('[WhatsApp Aprobacion] maquinariaData:', maquinariaData);
            if (maquinariaData.items && maquinariaData.items.length > 0) {
                maquinariaText = maquinariaData.items.map(item => `${item.tipo} (x${item.cantidad})`).join(', ');
            }
        }
    } catch (e) {
        console.warn('Error al parsear maquinaria:', e);
    }
    
    // Horarios - puede ser string JSON o objeto JSONB
    try {
        const horariosRaw = rep.horarios || rep.HORARIOS;
        console.log('[WhatsApp Aprobacion] horariosRaw:', horariosRaw, typeof horariosRaw);
        if (horariosRaw) {
            let horariosData;
            if (typeof horariosRaw === 'string') {
                horariosData = JSON.parse(horariosRaw);
            } else {
                horariosData = horariosRaw;
            }
            console.log('[WhatsApp Aprobacion] horariosData:', horariosData);
            
            // Convertir hora a formato AM/PM
            const formatHora = (hora) => {
                if (!hora) return 'N/A';
                const [h, m] = hora.split(':');
                const horaNum = parseInt(h);
                const ampm = horaNum >= 12 ? 'PM' : 'AM';
                const hora12 = horaNum % 12 || 12;
                return `${hora12}:${m} ${ampm}`;
            };
            
            // Obtener días laborales
            const diasLaborales = (dias) => {
                switch(parseInt(dias)) {
                    case 5: return 'Lunes a Viernes';
                    case 6: return 'Lunes a Sábado';
                    case 7: return 'Lunes a Domingo';
                    default: return `${dias} días`;
                }
            };
            
            horariosText = `${formatHora(horariosData.inicio)} - ${formatHora(horariosData.fin)} (${diasLaborales(horariosData.dias)})`;
            horariosText += `\n*Desayuno:* ${horariosData.desayuno} min`;
            horariosText += `\n*Almuerzo:* ${horariosData.almuerzo} min`;
            horariosText += `\n*Operación diaria:* ${horariosData.minutos_dia} min`;
            horariosText += `\n*Operación semanal:* ${horariosData.minutos_semanales} min`;
        }
    } catch (e) {
        console.warn('Error al parsear horarios:', e);
    }

    // FECHA LARGA
    let fechaLarga = '';
    try {
        const fechaObj = parsearFechaLatina(rep.FECHA);
        fechaLarga = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        fechaLarga = fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1);
    } catch (e) {
        fechaLarga = formatFechaCompacta(rep.FECHA);
    }

    // Crear mensaje de WhatsApp siguiendo estructura de reportes (sin emojis)
    let message = '';
    
    message += '*APROBACIÓN DE PLANTA*\n';
    message += `*\`${(rep.PLANTA || productoraNombre || 'N/A').toUpperCase()}\`*\n`;
    message += `*${fechaLarga}*\n\n`;
    
    // DATOS GENERALES
    message += '*Conclusión:*\n';
    message += `> ${(rep.CONCLUSION || 'N/A').toUpperCase()}\n\n`;
    
    message += `*ID:* ${rep.ID || rep.id_planta_anexo || 'N/A'}\n`;
    message += `*Operarios:* ${rep.OPERARIOS || 'N/A'}\n`;
    message += `*Tipo de Tejido:* ${Array.isArray(rep.TEJIDO) ? rep.TEJIDO.join(', ') : (rep.TEJIDO || 'N/A')}\n`;
    message += `*Tipos de Prendas:* ${Array.isArray(rep.FUERTE) ? rep.FUERTE.join(', ') : (rep.FUERTE || 'N/A')}\n\n`;
    
    // UBICACIÓN
    message += '*Ubicación:*\n';
    message += `*Departamento:* ${rep.DEPARTAMENTO || 'N/A'}\n`;
    message += `*Ciudad:* ${rep.CIUDAD || 'N/A'}\n`;
    message += `*Comuna:* ${rep.COMUNA || 'N/A'}\n`;
    message += `*Barrio:* ${rep.BARRIO || 'N/A'}\n`;
    message += `*Dirección:* ${rep.DIRECCION || 'N/A'}\n`;
    message += `*Localización:* ${rep.LOCALIZACION || 'N/A'}\n\n`;
    
    // MAQUINARIA
    message += `*Maquinaria:* ${maquinariaText}\n`;
    message += `*Horarios:* ${horariosText}\n\n`;
    
    // CONTACTO
    message += '*Contacto:*\n';
    message += `*Correo:* ${rep.CORREO || rep.correo || 'N/A'}\n`;
    message += `*Teléfono:* ${rep.TELEFONO || 'N/A'}\n\n`;
    
    // OBSERVACIONES
    if (rep.COMENTARIOS) {
        message += '*Observaciones:*\n';
        message += `> ${rep.COMENTARIOS}\n\n`;
    }
    
    message += `*Productora:* ${productoraNombre || 'N/A'}\n`;

    // Abrir WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

async function enviarCorreoAprobacion(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Buscar la planta correspondiente a esta aprobación
    const nombrePlanta = (rep.PLANTA || rep.planta || '').trim().toLowerCase();
    const repProductora = Number(rep.PRODUCTORA || rep.productora);

    let plantaObj;
    try {
        const plantasEdge = await fetchPlantasData({ forceEdge: true });
        plantaObj = plantasEdge.find(p =>
            (p.PLANTA || p.planta || '').trim().toLowerCase() === nombrePlanta &&
            (!repProductora || Number(p.PRODUCTORA || p.productora) === repProductora)
        );
    } catch (e) {
        console.warn('[mis-reportes] No se pudo obtener email de planta:', e);
    }

    const emailPlanta = plantaObj ? (plantaObj.CORREO || plantaObj.EMAIL || plantaObj.correo || plantaObj.email || '') : '';

    if (!emailPlanta) {
        await Swal.fire({
            icon: 'info',
            title: 'Taller sin correo o no registrado',
            text: 'Para enviar esta aprobación por correo, primero debe registrar o completar los datos del taller.',
            confirmButtonColor: '#3F51B5'
        });
        return;
    }

    try {
        Swal.fire({
            title: 'Enviando correo...',
            text: 'Por favor espere mientras se procesa la solicitud.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Obtener copias de usuarios ADMIN/MODERATOR con email_copia activado
        let ccEmails = [];
        if (gsUsuarios && gsUsuarios.length > 0) {
            ccEmails = gsUsuarios
                .filter(u => {
                    const rol = (u.ROL || u.rol || '').toUpperCase();
                    const emailCopia = u.EMAIL_COPIA || u.email_copia || false;
                    const correo = u.CORREO || u.correo || '';
                    return (rol === 'ADMIN' || rol === 'MODERATOR') && emailCopia === true && correo;
                })
                .map(u => u.CORREO || u.correo)
                .filter(email => email);
        }

        const payload = {
            accion: 'APROBACION_PLANTA',
            email: emailPlanta,
            cc: ccEmails.length > 0 ? ccEmails : [],
            aprobacion: rep
        };

        const resData = await sendToSupabase(payload);

        if (resData && resData.success === true) {
            Swal.fire({
                icon: 'success',
                title: 'Correo Enviado',
                html: `La aprobación fue enviada al correo registrado de <b>${rep.PLANTA}</b>.`,
                timer: 2500,
                showConfirmButton: false
            });
        } else {
            throw new Error((resData && resData.message) || 'Error al enviar el correo a través de Supabase');
        }

    } catch (error) {
        console.error('Error al enviar correo:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de Envío',
            text: error.message || 'Ocurrió un problema de red. Por favor intente nuevamente más tarde.',
            confirmButtonColor: '#3F51B5'
        });
    }
}

function expandReport(index) {
    salirModoEdicion();
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
        let parsed = null;

        // Intentar parsear el JSON, manejando ambos formatos (compacto y con formato)
        if (typeof novedadesText === 'string') {
            try {
                parsed = JSON.parse(novedadesText);
            } catch (e) {
                // Si falla, intentar limpiar el string y volver a intentar
                try {
                    const cleaned = novedadesText.trim().replace(/\n/g, '').replace(/\s+/g, ' ');
                    parsed = JSON.parse(cleaned);
                } catch (e2) {
                    // Si aún falla, mostrar el JSON crudo
                    novedadesHtml = '<div class="p-3 bg-light rounded"><pre class="mb-0" style="font-size: 0.8rem;">' + novedadesText + '</pre></div>';
                }
            }
        } else if (typeof novedadesText === 'object') {
            parsed = novedadesText;
        }

        // Si se pudo parsear, renderizar como tabla
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
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
        } else if (!novedadesHtml) {
            // Si no se pudo renderizar como tabla y no hay HTML, mostrar JSON crudo
            novedadesHtml = '<div class="p-3 bg-light rounded"><pre class="mb-0" style="font-size: 0.8rem;">' + JSON.stringify(parsed || novedadesText, null, 2) + '</pre></div>';
        }

        novedadesContainer.innerHTML = novedadesHtml;
        toggleContainer('containerNovedades', true);
    } else {
        novedadesContainer.innerHTML = '';
        // Siempre mostrar el contenedor para permitir agregar novedades
        toggleContainer('containerNovedades', true);
    }

    // Mostrar el modal
    const modalEl = document.getElementById('reporteModal');
    modalEl.style.display = 'flex';
    modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Validar si han pasado 24 horas para deshabilitar botón de edición
    const fechaReporte = reportNormalized.fecha || reportNormalized.FECHA || '';
    const btnEditar = modalEl.querySelector('button[onclick="entrarModoEdicion()"]');
    if (btnEditar && fechaReporte) {
        const fechaReporteDate = new Date(fechaReporte);
        const ahora = new Date();
        const horasDiferencia = (ahora - fechaReporteDate) / (1000 * 60 * 60);

        if (horasDiferencia > 24) {
            btnEditar.disabled = true;
            btnEditar.style.opacity = '0.5';
            btnEditar.style.cursor = 'not-allowed';
            btnEditar.title = 'Tiempo de edición expirado (más de 24 horas)';
        } else {
            btnEditar.disabled = false;
            btnEditar.style.opacity = '1';
            btnEditar.style.cursor = 'pointer';
            btnEditar.title = 'Editar reporte';
        }
    }
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

let selectedSoporteFile = null;
let _listenersInitialized = false;

const CODIGOS_TALLAS_LIST = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
    '2', '4', '6', '8', '10', '12', '14', '16', '18',
    '28', '30', '32', '34', '36', '38', '40', '42',
    'UNICA', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'
];

const CODIGOS_COLORES_LIST = [
    'AGUA', 'AGUA MARINA', 'ALMENDRA', 'AMARILLO', 'AMARILLO CIELO', 'AMARILLO CLARO', 'AMARILLO MEDIO', 'AMARILLO NEON',
    'ARENA', 'AVENA', 'AZUL', 'AZUL AGUAMARINA', 'AZUL CELESTE', 'AZUL CIELO', 'AZUL CLARO',
    'AZUL DENIM', 'AZUL ELECTRICO', 'AZUL HORTENSIA', 'AZUL INDIGO', 'AZUL MEDIO', 'AZUL OSCURO', 'AZUL PETROLEO', 'AZUL REY',
    'AZULTURQUI', 'BABY BLUE', 'BEIGE', 'BERENJENA', 'BLANCO', 'BLANCO/AZUL', 'BLANCO/DORADO', 'BLANCO/NAVY', 'BLANCO/NEGRO',
    'BLANCO/PLATEADO', 'BLANCO/ROJO', 'BLANCO/ROSADO', 'BLANCO-FUCSIA', 'CAFÉ', 'CAFÉ CLARO', 'CAFÉ OSCURO', 'CAMEL',
    'CARAMELO', 'COBRE', 'COCOA', 'CORAL', 'CORAL NEON', 'CREMA', 'CRUDO', 'CRUDO/NEGRO', 'CURUBA', 'DORADO', 'DORADO PERLA',
    'DORADO/NEGRO', 'ESMERALDA', 'FUCSIA', 'FUCSIA BRILLANT', 'FUCSIA NEON', 'GRIS', 'GRIS / MILITAR', 'GRIS CLARO',
    'GRIS CLARO JASP', 'GRIS CROSS', 'GRIS FUSIL', 'GRIS JASPE', 'GRIS JASPE CLARO', 'GRIS JASPE MEDIO', 'GRIS JASPE OSC',
    'GRIS MEDIO', 'GRIS MELANGE CL', 'GRIS MELANGE OS', 'GRIS OSC JASPE', 'GRISOSCURO', 'HABANO', 'IVORY', 'JADE', 'JADE JASPE',
    'KAKY', 'KAKY CLARO', 'KAKY OSCURO', 'LILA', 'LILA CLARO', 'LILA OSCURO', 'MAGENTA', 'MANDARINA', 'MANDARINA NEON',
    'MARFIL', 'MARRON', 'MORA LECHE', 'MORADO', 'MORADO CLARO', 'MORADO OSCURO', 'MOSTAZA', 'NARANJA', 'NARANJA NEON',
    'NAVY', 'NEGRO', 'NEGRO CROSS', 'NEGRO JASPE', 'NEGRO/AMARILLO', 'NEGRO/AZUL', 'NEGRO/BLANCO', 'NEGRO/DORADO',
    'NEGRO/PLATEADO', 'NEGRO-ROJO', 'NEW BLU', 'NIQUEL', 'NUDE', 'OCRE', 'OFFWHITE', 'ORO ROSA', 'PACIFICO', 'PALO DE ROSA',
    'PALO ROSA JASPE', 'PAVON', 'PAVONADO', 'PETROLEO', 'PLATA/DORADO', 'PLATA/NEGRO', 'PLATEADO', 'PLOMO', 'PPT', 'PROMOCION',
    'ROJO', 'ROJO ESCARLATA', 'ROJO FIESTA', 'ROJO VERDE', 'ROJO/NEGRO', 'ROJO-AZUL', 'ROSA', 'ROSA CLARO', 'ROSA LILA',
    'ROSADO', 'ROSADO CLARO', 'ROSADO NEON', 'ROSADO/NEGRO', 'ROSAMORA', 'ROSANEON', 'ROSEQUARZ', 'RUBOR', 'SALMON', 'TAUPE',
    'TERRACOTA', 'TORNASOL', 'TRANSPARENTE', 'TRICOLOR', 'TURQUEZA', 'TURQUI', 'VAINILLA', 'VERDE', 'VERDE AGUA', 'VERDE BOTELLA',
    'VERDE CALI', 'VERDE CLARO', 'VERDE ESMERALDA', 'VERDE FOLLAGE', 'VERDE JADE', 'VERDE JASPE', 'VERDE LIMON', 'VERDE MANZANA',
    'VERDE MENTA', 'VERDE MILITAR', 'VERDE NEON', 'VERDE OLIVA', 'VERDE PINO', 'VERDE SALVIA', 'VERDE SELVA', 'VINO TINTO',
    'WHITE', 'ZAPOTE'
];

function entrarModoEdicion() {
    const modalEl = document.getElementById('reporteModal');
    if (!modalEl) return;

    const index = parseInt(document.getElementById('editReporteIndex').value);
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Normalizar
    const reportNormalized = {};
    for (const key in rep) {
        reportNormalized[key.toLowerCase()] = rep[key];
    }

    // Validar que hayan pasado menos de 24 horas desde el reporte
    const fechaReporte = reportNormalized.fecha || reportNormalized.FECHA || '';
    if (fechaReporte) {
        const fechaReporteDate = new Date(fechaReporte);
        const ahora = new Date();
        const horasDiferencia = (ahora - fechaReporteDate) / (1000 * 60 * 60);

        if (horasDiferencia > 24) {
            Swal.fire({
                icon: 'error',
                title: 'Tiempo de edición expirado',
                text: 'Solo puedes editar reportes dentro de las 24 horas posteriores a su creación.',
                confirmButtonColor: '#3F51B5'
            });
            return;
        }
    }

    modalEl.classList.add('is-editing');
    document.getElementById('editReporteModalTitle').innerHTML = '<i class="fas fa-edit me-2"></i>Editar Reporte <span class="badge bg-warning ms-2" style="font-size: 0.75rem; vertical-align: middle;">Modo Edición</span>';

    // Inicializar listeners si no están listos
    initEditModeListeners();

    // 1. Tipo de Visita
    const tipoVisita = reportNormalized.tipo_visita || '';
    document.getElementById('editTipoVisitaSelect').value = tipoVisita;

    // 2. Conclusión
    const conclusion = reportNormalized.conclusion || '';
    document.getElementById('editConclusionSelect').value = conclusion;

    // 3. Observaciones
    const observaciones = reportNormalized.observaciones || '';
    document.getElementById('editObservacionesEditable').value = observaciones;

    // 4. Avance
    const avance = reportNormalized.avance || '0';
    document.getElementById('editAvanceSlider').value = Number(avance) || 0;
    document.getElementById('editAvanceValor').textContent = (Number(avance) || 0) + '%';
    document.getElementById('editAvancePorcentaje').value = Number(avance) || 0;

    // 5. Destino
    const destinoProceso = reportNormalized.destino_proceso || '';
    const destinoPlanta = reportNormalized.destino_planta || '';

    if (destinoProceso === 'CDI') {
        document.getElementById('editDestinoTipo').value = 'CDI';
    } else if (destinoProceso) {
        document.getElementById('editDestinoTipo').value = 'PROCESO';
        const selectProc = document.getElementById('editDestinoProcesoSelect');
        const standardOptions = Array.from(selectProc.options).map(o => o.value);
        if (standardOptions.includes(destinoProceso)) {
            selectProc.value = destinoProceso;
            document.getElementById('editDestinoOtroSection').style.display = 'none';
            document.getElementById('editDestinoOtro').value = '';
        } else {
            selectProc.value = 'OTROS';
            document.getElementById('editDestinoOtroSection').style.display = '';
            document.getElementById('editDestinoOtro').value = destinoProceso;
        }
    } else {
        document.getElementById('editDestinoTipo').value = '';
    }
    document.getElementById('editDestinoPlantaInput').value = destinoPlanta;

    // Llenar plantas datalist
    const listEl = document.getElementById('plantasDatalistModal');
    if (listEl && gsPlantas) {
        listEl.innerHTML = gsPlantas.map(p => `<option value="${p.PLANTA || p.planta}"></option>`).join('');
    }

    // 6. Novedades auditoría
    window._novedadesCalidadState = [];
    const novedadesText = reportNormalized.novedades_auditoria || '';
    if (novedadesText) {
        try {
            window._novedadesCalidadState = typeof novedadesText === 'string' ? JSON.parse(novedadesText) : novedadesText;
        } catch (e) {
            window._novedadesCalidadState = [];
        }
    }
    renderTarjetasNovedadesCalidadModal();

    // 7. Soporte (Imagen)
    selectedSoporteFile = null;
    const nameSpan = document.getElementById('editSoporteName');
    if (nameSpan) nameSpan.textContent = '';
    const fileInput = document.getElementById('editSoporteInput');
    if (fileInput) fileInput.value = '';

    // Actualizar campos visibles reactivamente
    actualizarCamposEdicionCalidad();
}

function salirModoEdicion() {
    const modalEl = document.getElementById('reporteModal');
    if (!modalEl) return;

    if (!modalEl.classList.contains('is-editing')) return;

    modalEl.classList.remove('is-editing');
    document.getElementById('editReporteModalTitle').innerHTML = '<i class="fas fa-eye me-2"></i>Ver Reporte';
    selectedSoporteFile = null;

    // Ocultar botón de restauración de IA observaciones
    const restoreBtn = document.getElementById('btnRestoreTextModal');
    if (restoreBtn) restoreBtn.style.display = 'none';

    // Volver a renderizar la vista de sólo lectura con los datos actuales
    const index = parseInt(document.getElementById('editReporteIndex').value);
    if (!isNaN(index)) {
        expandReport(index);
    }
}

function initEditModeListeners() {
    if (_listenersInitialized) return;
    _listenersInitialized = true;

    initAvanceSliderModal();
    initDestinoReactivityModal();
    initSoporteUploaderModal();
}

function initAvanceSliderModal() {
    const slider = document.getElementById('editAvanceSlider');
    const valor = document.getElementById('editAvanceValor');
    const pct = document.getElementById('editAvancePorcentaje');

    if (!slider || !valor || !pct) return;

    slider.oninput = () => {
        valor.textContent = slider.value + '%';
        pct.value = slider.value;
    };
}

function initDestinoReactivityModal() {
    const destinoTipo = document.getElementById('editDestinoTipo');
    const destinoProcesoContainer = document.getElementById('editDestinoProcesoContainer');
    const destinoProcesoSelect = document.getElementById('editDestinoProcesoSelect');
    const destinoOtroSection = document.getElementById('editDestinoOtroSection');
    const destinoOtro = document.getElementById('editDestinoOtro');
    const destinoPlanta = document.getElementById('editDestinoPlantaInput');

    if (!destinoTipo) return;

    destinoTipo.onchange = () => {
        actualizarCamposEdicionCalidad();
    };

    if (destinoProcesoSelect) {
        destinoProcesoSelect.onchange = () => {
            if (destinoProcesoSelect.value === 'OTROS') {
                if (destinoOtroSection) destinoOtroSection.style.display = '';
                if (destinoOtro) destinoOtro.required = true;
            } else {
                if (destinoOtroSection) destinoOtroSection.style.display = 'none';
                if (destinoOtro) {
                    destinoOtro.required = false;
                    destinoOtro.value = '';
                }
            }
        };
    }
    
    if (destinoPlanta) {
        destinoPlanta.onblur = () => {
            if (destinoPlanta.required && !destinoPlanta.value.trim()) {
                destinoPlanta.value = 'CDI';
            }
        };
    }
}

function initSoporteUploaderModal() {
    const dropzone = document.getElementById('editSoporteDropzone');
    const fileInput = document.getElementById('editSoporteInput');
    const nameSpan = document.getElementById('editSoporteName');

    if (!dropzone || !fileInput) return;

    dropzone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedSoporteFile = file;
            if (nameSpan) nameSpan.textContent = file.name;
        }
    };

    dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#3F51B5';
        dropzone.style.background = '#f1f5f9';
    };

    dropzone.ondragleave = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = 'none';
    };

    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = 'none';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            selectedSoporteFile = file;
            if (nameSpan) nameSpan.textContent = file.name;
            fileInput.files = e.dataTransfer.files;
        }
    };
}

function actualizarCamposEdicionCalidad() {
    const tipo = (document.getElementById('editTipoVisitaSelect')?.value || '').toUpperCase();
    const conclusion = document.getElementById('editConclusionSelect')?.value || '';

    const esAuditoria = tipo === 'AUDITORIA';
    const esRonda = tipo === 'RONDA';
    const esContramuestra = tipo === 'CONTRAMUESTRA';

    // Conclusión
    const mostrarConclusion = esAuditoria || esRonda || esContramuestra;
    const conclusionWrap = document.getElementById('containerConclusion');
    if (conclusionWrap) {
        conclusionWrap.style.display = mostrarConclusion ? '' : 'none';
        const select = document.getElementById('editConclusionSelect');
        if (select) {
            select.required = mostrarConclusion;
            
            // Pausado sólo disponible para ronda
            Array.from(select.options).forEach(opt => {
                if (opt.value === 'PAUSADO') {
                    if (esRonda) {
                        opt.hidden = false;
                        opt.disabled = false;
                    } else {
                        opt.hidden = true;
                        opt.disabled = true;
                        if (select.value === 'PAUSADO') {
                            select.value = '';
                        }
                    }
                }
            });
        }
    }

    // Avance
    const esPausado = conclusion === 'PAUSADO';
    const mostrarAvance = (esRonda || esContramuestra) && !esPausado;
    const avanceSection = document.getElementById('containerAvanceEdit');
    const avanceSlider = document.getElementById('editAvanceSlider');
    
    if (avanceSection) {
        avanceSection.style.display = mostrarAvance ? '' : 'none';
    }
    if (avanceSlider) {
        avanceSlider.required = esRonda && !esPausado;
    }

    // Destino
    const destinoSection = document.getElementById('editDestinoSection');
    const destinoTipo = document.getElementById('editDestinoTipo');
    const destinoProcesoContainer = document.getElementById('editDestinoProcesoContainer');
    const destinoProceso = document.getElementById('editDestinoProcesoSelect');
    const destinoPlanta = document.getElementById('editDestinoPlantaInput');

    if (destinoSection) {
        if (esAuditoria && conclusion === 'APROBADO') {
            destinoSection.style.display = '';
            if (destinoTipo) destinoTipo.required = true;

            const isProc = destinoTipo && destinoTipo.value === 'PROCESO';
            if (destinoProcesoContainer) destinoProcesoContainer.style.display = isProc ? '' : 'none';
            if (destinoProceso) destinoProceso.required = isProc;
            if (destinoPlanta) destinoPlanta.required = isProc;
        } else {
            destinoSection.style.display = 'none';
            if (destinoTipo) destinoTipo.required = false;
            if (destinoProcesoContainer) destinoProcesoContainer.style.display = 'none';
            if (destinoProceso) destinoProceso.required = false;
            if (destinoPlanta) destinoPlanta.required = false;
        }
    }

    // Novedades - Siempre mostrar dropzone en modo edición
    const editNovedadesDropzone = document.getElementById('editNovedadesDropzone');
    if (editNovedadesDropzone) {
        editNovedadesDropzone.style.display = '';
    }
}

async function mejorarRedaccionReporte(fieldId) {
    const textarea = document.getElementById(fieldId);
    if (!textarea) return;

    let textoOriginal = textarea.value.trim();
    if (!textoOriginal) {
        Swal.fire({
            icon: 'warning',
            title: 'Campo Vacío',
            text: 'Escribe primero el texto para que la IA pueda mejorarlo',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    if (!window._versionHistoryReporte) window._versionHistoryReporte = {};
    if (!window._versionHistoryReporte[fieldId]) window._versionHistoryReporte[fieldId] = [];
    window._versionHistoryReporte[fieldId].unshift(textoOriginal);

    const restoreBtn = document.getElementById('btnRestoreTextModal');
    const wrapper = textarea.closest('.ai-textarea-wrapper');
    if (wrapper) {
        wrapper.classList.add('ai-animating');
    }
    textarea.disabled = true;
    textarea.style.cursor = 'wait';

    try {
        const index = parseInt(document.getElementById('editReporteIndex').value);
        const rep = gsFilteredReportes[index];
        const context = rep ? {
            prenda: rep.PRENDA || rep.prenda || 'No especificada',
            genero: rep.GENERO || rep.genero || 'No especificado',
            tejido: rep.TEJIDO || rep.tejido || 'No especificado',
            proceso: rep.PROCESO || rep.proceso || 'No especificado',
            conclusion: document.getElementById('editConclusionSelect')?.value || 'NO_ESPECIFICADA',
            tipoVisita: document.getElementById('editTipoVisitaSelect')?.value || 'AUDITORIA',
            avance: document.getElementById('editAvancePorcentaje')?.value || ''
        } : null;

        const data = await callSupabaseAI(textoOriginal, 'CALIDAD_OBSERVATION', context);

        if (data.success && data.improvedText) {
            textarea.value = data.improvedText;
            if (restoreBtn) {
                restoreBtn.style.display = 'inline-flex';
            }
        } else {
            throw new Error(data.error || 'No se pudo procesar el texto');
        }

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo procesar el texto',
            timer: 2000,
            showConfirmButton: false
        });
    } finally {
        setTimeout(() => {
            if (wrapper) {
                wrapper.classList.remove('ai-animating');
            }
            textarea.disabled = false;
            textarea.style.cursor = '';
        }, 1200);
    }
}

function restaurarTextoOriginalReporte(fieldId) {
    const textarea = document.getElementById(fieldId);
    if (!textarea || !window._versionHistoryReporte || !window._versionHistoryReporte[fieldId]) return;
    const history = window._versionHistoryReporte[fieldId];
    if (history.length === 0) return;
    
    const prevText = history.shift();
    textarea.value = prevText;
    
    if (history.length === 0) {
        const restoreBtn = document.getElementById('btnRestoreTextModal');
        if (restoreBtn) restoreBtn.style.display = 'none';
    }
}

/* Novedades modal constructor functions inside mis-reportes */
function agregarBloqueNovedadCalidadModal(editIndex = null, subEditIndex = null) {
    window._novedadEditIndex = editIndex;
    window._novedadSubEditIndex = subEditIndex;
    const modal = document.getElementById('novedadesCalidadModal');
    const title = document.getElementById('novedadesModalTitle');
    const selectTipo = document.getElementById('novedadModalTipo');
    const sinProcesoCheck = document.getElementById('novedadModalSinProcesoCheck');
    const codigosList = document.getElementById('novedadModalCodigosList');

    selectTipo.value = '';
    selectTipo.disabled = false;
    sinProcesoCheck.checked = false;
    codigosList.innerHTML = '';
    handleModalCalidadNovedadTipoChange();

    if (editIndex !== null) {
        const data = window._novedadesCalidadState[editIndex];
        selectTipo.value = data.tipo;

        handleModalCalidadNovedadTipoChange();
        if (data.tipo === 'PROMOCIONES') {
            sinProcesoCheck.checked = data.sin_proceso;
        }

        if (subEditIndex !== null) {
            title.textContent = 'Editar Detalle';
            agregarFilaModalNovedad(data.codigos[subEditIndex]);
        } else {
            title.textContent = 'Editar Grupo';
            data.codigos.forEach(c => agregarFilaModalNovedad(c));
        }
    } else {
        title.textContent = 'Reportar Novedad';
        agregarFilaModalNovedad();
    }

    modal.style.display = 'flex';
}

function cerrarModalNovedadCalidad() {
    const modal = document.getElementById('novedadesCalidadModal');
    if (modal) modal.style.display = 'none';
}

function handleModalCalidadNovedadTipoChange() {
    const tipo = document.getElementById('novedadModalTipo').value;
    const sinProcesoDiv = document.getElementById('novedadModalSinProceso');
    if (sinProcesoDiv) {
        if (tipo === 'PROMOCIONES') {
            sinProcesoDiv.style.display = 'block';
        } else {
            sinProcesoDiv.style.display = 'none';
            const chk = document.getElementById('novedadModalSinProcesoCheck');
            if (chk) chk.checked = false;
        }
    }
}

function agregarFilaModalNovedad(datosIniciales = null) {
    const listContainer = document.getElementById('novedadModalCodigosList');
    if (!listContainer) return;
    const fila = document.createElement('div');
    fila.className = 'insumo-fila mb-3 fila-3-cols';

    const tallasFiltradas = CODIGOS_TALLAS_LIST || [];
    const coloresFiltrados = CODIGOS_COLORES_LIST || [];

    const valTalla = datosIniciales ? datosIniciales.talla : '';
    const valColor = datosIniciales ? datosIniciales.color : '';
    const valCant = datosIniciales ? datosIniciales.cantidad : '';

    fila.innerHTML = `
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline" style="font-size:0.7rem;">Talla: <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-mobile"
                    onclick="eliminarFilaModalNovedad(this)" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-ruler input-icon"></i>
                <input type="text" class="form-control form-control-sm codigo-talla" 
                    placeholder="Talla..." autocomplete="off" value="${valTalla}" list="calidad-tallas-list-${Date.now()}">
                <datalist id="calidad-tallas-list-${Date.now()}">
                    ${tallasFiltradas.map(t => `<option value="${t}"></option>`).join('')}
                </datalist>
            </div>
        </div>
        <div class="campo-dinamico">
            <label class="form-label-inline" style="font-size:0.7rem;">Color: <span style="color:#ef4444;">*</span></label>
            <div class="input-with-icon">
                <i class="fas fa-palette input-icon"></i>
                <input type="text" class="form-control form-control-sm codigo-color" 
                    placeholder="Color..." autocomplete="off" value="${valColor}" list="calidad-colores-list-${Date.now()}">
                <datalist id="calidad-colores-list-${Date.now()}">
                    ${coloresFiltrados.map(c => `<option value="${c}"></option>`).join('')}
                </datalist>
            </div>
        </div>
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline" style="font-size:0.7rem;">Cantidad: <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-desktop"
                    onclick="eliminarFilaModalNovedad(this)" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control form-control-sm codigo-cantidad" min="1" placeholder="Cant." value="${valCant}">
            </div>
        </div>`;

    listContainer.appendChild(fila);
    _actualizarBotonesEliminarModalNovedad();
}

function eliminarFilaModalNovedad(btn) {
    const listContainer = document.getElementById('novedadModalCodigosList');
    if (!listContainer || listContainer.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminarModalNovedad();
}

function _actualizarBotonesEliminarModalNovedad() {
    const filas = document.querySelectorAll('#novedadModalCodigosList .insumo-fila');
    const hayMultiples = filas.length > 1;
    filas.forEach(fila => {
        fila.querySelectorAll('.btn-eliminar-insumo').forEach(btn => {
            btn.style.display = hayMultiples ? 'flex' : 'none';
        });
    });
}

function _compactarCodigosNovedad(codigosArray) {
    const map = {};
    codigosArray.forEach(c => {
        const key = `${c.talla.trim().toUpperCase()}|${c.color.trim().toUpperCase()}`;
        if (!map[key]) {
            map[key] = { talla: c.talla.trim().toUpperCase(), color: c.color.trim().toUpperCase(), cantidad: c.cantidad };
        } else {
            map[key].cantidad += c.cantidad;
        }
    });
    return Object.values(map);
}

function guardarNovedadCalidad() {
    const tipo = document.getElementById('novedadModalTipo').value;
    if (!tipo) {
        Swal.fire({ icon: 'warning', title: 'Falta Tipo', text: 'Selecciona el tipo de novedad.', confirmButtonColor: '#3F51B5' });
        return;
    }

    const sinProceso = document.getElementById('novedadModalSinProcesoCheck').checked;
    const filas = document.querySelectorAll('#novedadModalCodigosList .insumo-fila');
    const codigos = [];

    let valido = true;
    filas.forEach(fila => {
        const talla = fila.querySelector('.codigo-talla')?.value?.trim() || '';
        const color = fila.querySelector('.codigo-color')?.value?.trim() || '';
        const cant = fila.querySelector('.codigo-cantidad')?.value || '';
        if (!talla || !color || !cant) { valido = false; }
        else { codigos.push({ talla, color, cantidad: Number(cant) }); }
    });

    if (!valido || codigos.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'Completa talla, color y cantidad en todas las filas.', confirmButtonColor: '#3F51B5' });
        return;
    }

    const codigosCompactados = _compactarCodigosNovedad(codigos);
    const nuevaNovedad = { tipo, sin_proceso: (tipo === 'PROMOCIONES' && sinProceso), codigos: codigosCompactados };

    if (window._novedadEditIndex !== null && window._novedadEditIndex !== undefined) {
        const grupoOriginal = window._novedadesCalidadState[window._novedadEditIndex];
        if (window._novedadSubEditIndex !== null && window._novedadSubEditIndex !== undefined) {
            grupoOriginal.codigos.splice(window._novedadSubEditIndex, 1);
        } else {
            grupoOriginal.codigos = [];
        }
    }

    const isSinProceso = (tipo === 'PROMOCIONES' && sinProceso);
    const destinoIndex = window._novedadesCalidadState.findIndex(n => n.tipo === tipo && !!n.sin_proceso === !!isSinProceso);

    if (destinoIndex >= 0) {
        const destino = window._novedadesCalidadState[destinoIndex];
        const combinados = destino.codigos.concat(codigosCompactados);
        destino.codigos = _compactarCodigosNovedad(combinados);
    } else {
        window._novedadesCalidadState.push(nuevaNovedad);
    }

    window._novedadesCalidadState = window._novedadesCalidadState.filter(g => g.codigos && g.codigos.length > 0);

    cerrarModalNovedadCalidad();
    renderTarjetasNovedadesCalidadModal();
}

function renderTarjetasNovedadesCalidadModal() {
    const lista = document.getElementById('editNovedadesContainer');
    if (!lista) return;

    lista.innerHTML = '';

    if (!window._novedadesCalidadState || window._novedadesCalidadState.length === 0) {
        lista.innerHTML = '<div class="text-muted p-2" style="font-style: italic; font-size: 0.85rem;">Sin novedades reportadas.</div>';
        return;
    }

    window._novedadesCalidadState.forEach((novedad, index) => {
        const totalUnidades = novedad.codigos.reduce((sum, c) => sum + Number(c.cantidad), 0);

        let colorTheme = '#3b82f6';
        let bgTheme = '#eff6ff';
        let iconName = 'fa-tag';
        let displayTipo = novedad.tipo;

        if (novedad.tipo === 'SIN CONFECCIONAR') { colorTheme = '#ef4444'; bgTheme = '#fef2f2'; iconName = 'fa-cut'; }
        if (novedad.tipo === 'PROMOCIONES') {
            if (novedad.sin_proceso) {
                colorTheme = '#db2777';
                bgTheme = '#fdf2f8';
                iconName = 'fa-exclamation-triangle';
                displayTipo = 'PROM. SIN PROCESO';
            } else {
                colorTheme = '#f59e0b';
                bgTheme = '#fffbeb';
                iconName = 'fa-percentage';
            }
        }
        if (novedad.tipo === 'COBROS') { colorTheme = '#10b981'; bgTheme = '#ecfdf5'; iconName = 'fa-file-invoice-dollar'; }
        if (novedad.tipo === 'LAVADO') { colorTheme = '#6366f1'; bgTheme = '#eef2ff'; iconName = 'fa-water'; }

        let codigosHtml = '';
        novedad.codigos.forEach((c, codigoIndex) => {
            const isLast = codigoIndex === novedad.codigos.length - 1;
            const borderBottom = isLast ? '' : 'border-bottom:1px solid #f1f5f9;';
            codigosHtml += `
                <div style="display:grid; grid-template-columns: 2fr 4fr 2fr 2fr; align-items:center; padding:10px 14px; ${borderBottom} transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                     <div style="font-size:0.75rem; font-weight:800; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.talla}">${c.talla}</div>
                     <div style="font-size:0.75rem; color:#334155; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:8px;" title="${c.color}">${c.color}</div>
                     <div style="font-size:0.7rem; font-weight:700; color:${colorTheme}; text-align:center; background:${bgTheme}; border-radius:4px; padding:2px 0; margin-right:8px;">${c.cantidad}</div>
                     <div style="display:flex; gap:8px; justify-content:flex-end;">
                         <!-- Botones interactivos que se muestran/ocultan por CSS con nov-action-btn -->
                         <button type="button" class="nov-action-btn" onclick="agregarBloqueNovedadCalidadModal(${index}, ${codigoIndex})" title="Editar detalle" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px;" onmouseover="this.style.color='${colorTheme}';" onmouseout="this.style.color='#94a3b8';"><i class="fas fa-pen" style="font-size:0.8rem;"></i></button>
                         <button type="button" class="nov-action-btn" onclick="eliminarSubNovedadCalidadModal(${index}, ${codigoIndex})" title="Eliminar detalle" style="background:none; border:none; color:#fca5a5; cursor:pointer; padding:2px;" onmouseover="this.style.color='#ef4444';" onmouseout="this.style.color='#fca5a5';"><i class="fas fa-trash" style="font-size:0.8rem;"></i></button>
                     </div>
                </div>
            `;
        });

        const tarjeta = document.createElement('div');
        tarjeta.style.cssText = `background:#ffffff; border:1px solid #e2e8f0; border-top:4px solid ${colorTheme}; border-radius:12px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02); overflow:hidden;`;

        tarjeta.innerHTML = `
            <!-- HEADER -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:${bgTheme}; padding:10px 14px; border-bottom:1px solid #e2e8f0;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fas ${iconName}" style="color:${colorTheme}; font-size:1.1rem;"></i>
                    <span style="font-weight:800; font-size:0.85rem; color:#1e293b; text-transform:uppercase; letter-spacing:0.3px;">${displayTipo}</span>
                </div>
                <div style="font-size:0.75rem; font-weight:800; color:${colorTheme};">
                    ${totalUnidades} UNDS.
                </div>
            </div>
            
            <!-- BODY / TABLE -->
            <div style="padding:0;">
                <div style="display:grid; grid-template-columns: 2fr 4fr 2fr 2fr; padding:8px 14px; background:#f8fafc; border-bottom:1px solid #f1f5f9; font-size:0.6rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">
                    <div>Talla</div>
                    <div>Color</div>
                    <div style="text-align:center;">Cant.</div>
                    <div style="text-align:right;">Acción</div>
                </div>
                ${codigosHtml}
            </div>
        `;
        lista.appendChild(tarjeta);
    });
}

function eliminarSubNovedadCalidadModal(tipoIndex, codigoIndex) {
    const novedad = window._novedadesCalidadState[tipoIndex];
    novedad.codigos.splice(codigoIndex, 1);
    if (novedad.codigos.length === 0) {
        window._novedadesCalidadState.splice(tipoIndex, 1);
    }
    renderTarjetasNovedadesCalidadModal();
}

async function guardarCambiosReporte() {
    const index = parseInt(document.getElementById('editReporteIndex').value);
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    const tipoVisita = document.getElementById('editTipoVisitaSelect').value;
    const conclusion = document.getElementById('editConclusionSelect').value;
    const observaciones = document.getElementById('editObservacionesEditable').value;

    if (!tipoVisita) {
        Swal.fire({ icon: 'warning', title: 'Falta Tipo de Visita', text: 'Seleccione un tipo de visita.', confirmButtonColor: '#3F51B5' });
        return;
    }

    const requiereConclusion = ['AUDITORIA', 'RONDA', 'CONTRAMUESTRA'].includes(tipoVisita);
    if (requiereConclusion && !conclusion) {
        Swal.fire({ icon: 'warning', title: 'Falta Conclusión', text: 'Seleccione una conclusión.', confirmButtonColor: '#3F51B5' });
        return;
    }

    let avance = '';
    const esPausado = conclusion === 'PAUSADO';
    if ((tipoVisita === 'RONDA' || tipoVisita === 'CONTRAMUESTRA') && !esPausado) {
        avance = document.getElementById('editAvancePorcentaje').value || '0';
        if (tipoVisita === 'RONDA' && Number(avance) === 0) {
            Swal.fire({ icon: 'warning', title: 'Avance requerido', text: 'Para una Ronda debes registrar el porcentaje de avance de producción.', confirmButtonColor: '#3F51B5' });
            return;
        }
    }

    const destinoTipoVal = document.getElementById('editDestinoTipo')?.value || '';
    const destinoProcesoVal = document.getElementById('editDestinoProcesoSelect')?.value || '';
    const destinoOtroVal = document.getElementById('editDestinoOtro')?.value || '';
    const destinoPlantaVal = document.getElementById('editDestinoPlantaInput')?.value || '';

    let destino_proceso = "";
    let destino_planta = "";

    if (tipoVisita === 'AUDITORIA' && conclusion === 'APROBADO') {
        if (destinoTipoVal === 'CDI') {
            destino_proceso = 'CDI';
            destino_planta = 'CDI';
        } else if (destinoTipoVal === 'PROCESO' && destinoProcesoVal) {
            destino_proceso = (destinoProcesoVal === 'OTROS') ? destinoOtroVal.trim() : destinoProcesoVal;
            destino_planta = destinoPlantaVal.trim() || "CDI";
        }
    }

    try {
        Swal.fire({
            title: 'Guardando cambios...',
            text: 'Por favor espera',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        let finalSoporteUrl = rep.SOPORTE || rep.soporte || '';
        if (selectedSoporteFile) {
            Swal.update({ title: 'Subiendo soporte...', text: 'Subiendo soporte digital' });
            try {
                const uploadedUrl = await uploadToSupabase(selectedSoporteFile, rep.PRODUCTORA || rep.productora, 'REPORTES');
                if (uploadedUrl) {
                    finalSoporteUrl = uploadedUrl;
                }
            } catch (upErr) {
                console.error("Error subiendo soporte:", upErr);
                throw new Error("No se pudo subir la imagen de soporte: " + upErr.message);
            }
        }

        const updateData = {
            tipo_visita: tipoVisita,
            conclusion: conclusion,
            observaciones: observaciones,
            avance: avance ? Number(avance) : null,
            destino_proceso: destino_proceso,
            destino_planta: destino_planta,
            novedades_auditoria: (tipoVisita === 'AUDITORIA' && window._novedadesCalidadState && window._novedadesCalidadState.length > 0) ? JSON.stringify(window._novedadesCalidadState) : null,
            soporte: finalSoporteUrl
        };

        let sessionToken = '';
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch(e) {}

        const res = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                accion: 'UPDATE_REPORTE',
                idReporte: rep.ID_REPORTE || rep.id_reporte,
                tipoVisita: tipoVisita,
                conclusion: conclusion,
                observaciones: observaciones,
                avance: avance ? Number(avance) : null,
                destinoProceso: destino_proceso,
                destinoPlanta: destino_planta,
                novedadesAuditoria: (tipoVisita === 'AUDITORIA' && window._novedadesCalidadState && window._novedadesCalidadState.length > 0) ? window._novedadesCalidadState : null,
                soporte: finalSoporteUrl
            })
        });

        if (!res.ok) {
            const errRes = await res.json().catch(() => ({}));
            throw new Error(errRes.message || `Error del servidor (${res.status})`);
        }

        const resData = await res.json();
        if (!resData.success) {
            throw new Error(resData.message || 'No se pudieron guardar los cambios');
        }

        cerrarModalReporte();
        salirModoEdicion();

        await recargarDatos();

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
    } catch (e) {
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

    let cleanPhone =
        phoneNumber.replace(
            /[\s\-\(\)\+]/g,
            ''
        );

    // =========================
    // ASEGURAR PREFIJO 57 (COLOMBIA)
    // =========================

    if (cleanPhone && !cleanPhone.startsWith('57')) {
        cleanPhone = '57' + cleanPhone;
    }

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

    // Buscar la planta correspondiente a este reporte
    const nombrePlanta = (rep.PLANTA || rep.planta || '').trim().toLowerCase();
    const repProductora = Number(rep.PRODUCTORA || rep.productora);

    const plantaObj = gsPlantas.find(p =>
        (p.PLANTA || p.planta || '').trim().toLowerCase() === nombrePlanta &&
        (!repProductora || Number(p.PRODUCTORA || p.productora) === repProductora)
    );

    const phoneNumber = plantaObj ? (plantaObj.TELEFONO || plantaObj.telefono || '') : '';

    if (!phoneNumber) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin número de teléfono',
            text: 'Este taller no tiene un número registrado.',
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

    } catch (e) {

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

        } catch (e) {

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

    let cleanPhone =
        phoneNumber.replace(
            /[\s\-\(\)\+]/g,
            ''
        );

    // =========================
    // ASEGURAR PREFIJO 57 (COLOMBIA)
    // =========================

    if (cleanPhone && !cleanPhone.startsWith('57')) {
        cleanPhone = '57' + cleanPhone;
    }

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

async function abrirModalPlantaReporte(index) {
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    // Búsqueda instantánea en el caché local en memoria
    const nombrePlanta = (rep.PLANTA || rep.planta || '').trim().toLowerCase();
    const repProductora = Number(rep.PRODUCTORA || rep.productora);

    const plantaObj = gsPlantas.find(p =>
        (p.PLANTA || p.planta || '').trim().toLowerCase() === nombrePlanta &&
        (!repProductora || Number(p.PRODUCTORA || p.productora) === repProductora)
    );

    document.getElementById('plantaModalIndex').value = index;
    document.getElementById('plantaModalProductora').value = repProductora || '';

    const inputId = document.getElementById('plantaModalId');
    const inputNombre = document.getElementById('plantaModalNombre');
    const inputTelefono = document.getElementById('plantaModalTelefono');
    const inputEmail = document.getElementById('plantaModalEmail');

    inputNombre.readOnly = true;

    if (plantaObj) {
        inputId.value = plantaObj.ID_PLANTA || plantaObj.id_planta || plantaObj.ID || plantaObj.id || '';
        inputId.readOnly = true;
        inputNombre.value = (plantaObj.PLANTA || plantaObj.planta || rep.PLANTA || '').trim().toUpperCase();
        inputTelefono.value = plantaObj.TELEFONO || plantaObj.telefono || '';
        inputEmail.value = plantaObj.CORREO || plantaObj.EMAIL || plantaObj.correo || plantaObj.email || '';
    } else {
        inputId.value = '';
        inputId.readOnly = false;
        inputNombre.value = (rep.PLANTA || '').trim().toUpperCase();
        inputTelefono.value = '';
        inputEmail.value = '';
    }

    const modal = document.getElementById('plantaModal');
    if (modal) modal.classList.add('show');
}

function cerrarModalPlanta() {
    const modal = document.getElementById('plantaModal');
    if (modal) modal.classList.remove('show');
}

async function guardarDatosPlantaModal(event) {
    event.preventDefault();

    const index = document.getElementById('plantaModalIndex').value;
    const rep = gsFilteredReportes[index];
    if (!rep) return;

    const productora = Number(document.getElementById('plantaModalProductora').value) || null;
    const id = document.getElementById('plantaModalId').value.trim();
    const nombre = document.getElementById('plantaModalNombre').value.trim().toUpperCase();
    const telefono = document.getElementById('plantaModalTelefono').value.trim();
    const email = document.getElementById('plantaModalEmail').value.trim();

    const isEdit = document.getElementById('plantaModalId').readOnly;

    Swal.fire({
        title: isEdit ? 'Actualizando taller...' : 'Creando taller...',
        text: 'Por favor espere mientras se procesa la solicitud.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const payload = {
            accion: isEdit ? 'ACTUALIZAR_PLANTA' : 'CREAR_PLANTA',
            id: id,
            planta: nombre,
            nombrePlanta: nombre,
            telefono: telefono,
            email: email,
            productora: productora
        };

        const result = await sendToSupabase(payload);
        if (!result || !result.success) {
            throw new Error(result?.message || 'Error en la respuesta de la base de datos');
        }

        if (typeof invalidateCache === 'function') {
            invalidateCache('PLANTAS');
        }

        gsPlantas = await fetchPlantasData({ forceEdge: true });

        cerrarModalPlanta();

        await Swal.fire({
            icon: 'success',
            title: isEdit ? '¡Taller actualizado!' : '¡Taller registrado!',
            text: 'Los datos han sido guardados exitosamente.',
            timer: 2000,
            showConfirmButton: false
        });

        renderGroupedView();

    } catch (err) {
        console.error('Error al guardar taller:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: err.message || 'No se pudo guardar la información del taller.',
            confirmButtonColor: '#3F51B5'
        });
    }
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
window.abrirModalPlantaReporte = abrirModalPlantaReporte;
window.cerrarModalPlanta = cerrarModalPlanta;
window.guardarDatosPlantaModal = guardarDatosPlantaModal;
