/**
 * reportes-analizados.js — Módulo para ver reportes analizados con modal
 * Solo disponible para roles: ADMIN, MODERATOR, USER-I
 */

let gsReportes = [];
let gsFilteredReportes = [];
let dateRangePicker = null;
let selectedDateRange = null;

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
            globalReportesPromise = fetchReportesData();
        }
    } catch (e) { }
})();

window.onload = async function () {
    await loadUsers();
    
    // Role-based access control: Solo ADMIN, MODERATOR, USER-I
    const user = window.currentUser;
    if (!user || !['ADMIN', 'MODERATOR', 'USER-I'].includes(user.ROL)) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Este módulo solo está disponible para roles ADMIN, MODERATOR y USER-I',
            confirmButtonColor: '#8b5cf6'
        }).then(() => {
            window.location.replace('index.html');
        });
        return;
    }
    
    buildAuditorLookup();
    await cargarDatosReportesAnalizados(globalReportesPromise);
};

async function cargarDatosReportesAnalizados(reportesPromise) {
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
                        <p class="small text-muted">La base de datos de reportes está vacía o no es accesible.</p>
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
                    <button class="btn btn-primary rounded-pill px-4" onclick="recargarDatos()">REINTENTAR AHORA</button>
                </div>
            `;
        }
    }
}

async function recargarDatos() {
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

    let parsed = new Date(s);
    if (!isNaN(parsed)) return parsed;

    parsed = new Date(s.replace(' ', 'T'));
    if (!isNaN(parsed)) return parsed;

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

    const auditores = [...new Set(gsReportes.map(r => r._auditorName))].filter(Boolean).sort();
    const selectAuditor = document.getElementById('filterAuditor');
    selectAuditor.innerHTML = '<option value="">Todos los Auditores</option>';
    auditores.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        selectAuditor.appendChild(opt);
    });

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

    renderTable();
};

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

window.handleTableSearch = function () {
    tableSearchTerm = document.getElementById('tableSearch')?.value || '';
    tableCurrentPage = 1;
    renderTable();
};

window.clearTableSearch = function () {
    const input = document.getElementById('tableSearch');
    if (input) input.value = '';
    tableSearchTerm = '';
    tableCurrentPage = 1;
    renderTable();
};

// Modified function to open modal instead of print template
window.verReporteAnalizado = function (index) {
    console.log('verReporteAnalizado called with index:', index);
    const rep = gsTableReportes[index];
    if (!rep) {
        console.log('No reporte found for index:', index);
        return;
    }
    console.log('Reporte found:', rep);
    console.log('Reporte fields:', Object.keys(rep));
    console.log('ID_REPORTE:', rep.ID_REPORTE);
    console.log('id_reporte:', rep.id_reporte);
    console.log('id:', rep.id);
    console.log('ID:', rep.ID);
    console.log('LOTE:', rep.LOTE);
    console.log('lote:', rep.lote);

    // Show modal using simple overlay approach
    const modalElement = document.getElementById('reporteModal');
    console.log('Modal element:', modalElement);
    if (modalElement) {
        // Create a simple overlay
        const overlay = document.createElement('div');
        overlay.id = 'simpleModalOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99999;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding-top: 80px;
            overflow-y: auto;
            font-family: 'Inter', sans-serif;
        `;
        
        // Clone the modal content
        const modalContent = modalElement.querySelector('.modal-content');
        if (modalContent) {
            const contentClone = modalContent.cloneNode(true);
            contentClone.style.cssText = `
                background: white;
                border-radius: 16px;
                max-width: 900px;
                width: 90%;
                margin-bottom: 50px;
                box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
                overflow: hidden;
            `;
            
            // Style the header
            const header = contentClone.querySelector('.modal-header');
            if (header) {
                header.style.cssText = `
                    background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
                    color: white;
                    padding: 1.25rem 1.5rem;
                    border-radius: 16px 16px 0 0;
                    border: none;
                `;
            }
            
            // Style the body
            const body = contentClone.querySelector('.modal-body');
            if (body) {
                body.style.cssText = `
                    padding: 2rem;
                    background: white;
                `;
            }
            
            // Style the footer
            const footer = contentClone.querySelector('.modal-footer');
            if (footer) {
                footer.style.cssText = `
                    padding: 1rem 2rem;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    border-radius: 0 0 16px 16px;
                `;
            }
            
            // Style form labels
            const labels = contentClone.querySelectorAll('.form-label');
            labels.forEach(label => {
                label.style.cssText = `
                    font-weight: 600;
                    color: #3f51b5;
                    font-size: 0.85rem;
                    margin-bottom: 0.5rem;
                `;
            });
            
            // Style form inputs
            const inputs = contentClone.querySelectorAll('.form-control');
            inputs.forEach(input => {
                input.style.cssText = `
                    border-radius: 8px;
                    border-color: #dee2e6;
                    font-size: 0.9rem;
                    padding: 0.5rem 0.75rem;
                `;
            });
            
            overlay.appendChild(contentClone);
            
            // NOW populate the fields in the cloned content
            const clonedIdReporte = contentClone.querySelector('#viewIdReporte');
            if (clonedIdReporte) clonedIdReporte.value = rep.id_reporte || rep.ID_REPORTE || rep.id || rep.ID || '';
            
            const clonedLote = contentClone.querySelector('#viewLote');
            if (clonedLote) clonedLote.value = rep.id || rep.ID || rep.LOTE || rep.lote || '';
            
            const clonedReferencia = contentClone.querySelector('#viewReferencia');
            if (clonedReferencia) clonedReferencia.value = rep.referencia || rep.REFERENCIA || '';
            
            const clonedFecha = contentClone.querySelector('#viewFecha');
            if (clonedFecha) clonedFecha.value = formatFechaDisplay(rep._date);
            
            const clonedPlanta = contentClone.querySelector('#viewPlanta');
            if (clonedPlanta) clonedPlanta.value = rep._planta || '';
            
            const clonedEmail = contentClone.querySelector('#viewEmail');
            if (clonedEmail) clonedEmail.value = rep.email || rep.EMAIL || '';
            
            const clonedLinea = contentClone.querySelector('#viewLinea');
            if (clonedLinea) clonedLinea.value = rep.linea || rep.LINEA || '';
            
            const clonedTipoVisita = contentClone.querySelector('#viewTipoVisita');
            if (clonedTipoVisita) clonedTipoVisita.value = rep._tipo || '';
            
            const clonedGenero = contentClone.querySelector('#viewGenero');
            if (clonedGenero) clonedGenero.value = rep.genero || rep.GENERO || '';
            
            const clonedLocalizacion = contentClone.querySelector('#viewLocalizacion');
            if (clonedLocalizacion) clonedLocalizacion.value = rep.localizacion || rep.LOCALIZACION || '';
            
            const clonedSalida = contentClone.querySelector('#viewSalida');
            if (clonedSalida) clonedSalida.value = rep.salida || rep.SALIDA || '';
            
            const clonedEntrada = contentClone.querySelector('#viewEntrada');
            if (clonedEntrada) clonedEntrada.value = rep.entrada || rep.ENTRADA || '';
            
            const clonedProductora = contentClone.querySelector('#viewProductora');
            if (clonedProductora) clonedProductora.value = rep.productora || rep.PRODUCTORA || '';
            
            const clonedConclusion = contentClone.querySelector('#viewConclusion');
            if (clonedConclusion) clonedConclusion.value = rep._conclusion || '';
            
            const clonedObservaciones = contentClone.querySelector('#viewObservaciones');
            if (clonedObservaciones) clonedObservaciones.value = rep.observaciones || rep.OBSERVACIONES || '';
            
            const clonedProceso = contentClone.querySelector('#viewProceso');
            if (clonedProceso) clonedProceso.value = rep.proceso || rep.PROCESO || '';
            
            const clonedDestino = contentClone.querySelector('#viewDestino');
            if (clonedDestino) clonedDestino.value = rep.destino_proceso || rep.DESTINO_PROCESO || '';
            
            const clonedDestinoPlanta = contentClone.querySelector('#viewDestinoPlanta');
            if (clonedDestinoPlanta) clonedDestinoPlanta.value = rep.destino_planta || rep.DESTINO_PLANTA || '';
            
            const clonedCantidad = contentClone.querySelector('#viewCantidad');
            if (clonedCantidad) clonedCantidad.value = rep._cantidad || '';
            
            const clonedPrenda = contentClone.querySelector('#viewPrenda');
            if (clonedPrenda) clonedPrenda.value = rep.prenda || rep.PRENDA || '';
            
            // Render image in cloned content - like printing template
            const clonedSoporteContainer = contentClone.querySelector('#viewSoporteContainer');
            const soporteUrl = rep.soporte || rep.SOPORTE || '';
            if (clonedSoporteContainer && soporteUrl) {
                clonedSoporteContainer.innerHTML = `
                    <div style="position: relative; width: 100%; height: 100%; cursor: pointer;" onclick="openImageModal('${soporteUrl}')">
                        <img src="${soporteUrl}" alt="Evidencia fotográfica" style="width: 100%; height: 100%; object-fit: cover; border: none; border-radius: 0;">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.4); opacity: 0; transition: opacity 0.2s ease;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                            <i class="fas fa-search-plus" style="color: white; font-size: 24px; background: rgba(15, 23, 42, 0.75); padding: 12px; border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.15);"></i>
                        </div>
                    </div>
                `;
            } else if (clonedSoporteContainer) {
                clonedSoporteContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 0.85rem; font-style: italic;">No hay evidencia fotográfica</div>';
            }
            
            // Render ubicacion in cloned content - like printing template with Google Maps iframe
            const clonedLocalizacionContainer = contentClone.querySelector('#viewLocalizacionContainer');
            const localizacion = rep.localizacion || rep.LOCALIZACION || '';
            if (clonedLocalizacionContainer && localizacion) {
                const coords = localizacion.split(',').map(c => c.trim());
                if (coords.length === 2) {
                    clonedLocalizacionContainer.innerHTML = `
                        <iframe src="https://maps.google.com/maps?q=${encodeURIComponent(localizacion.trim())}&z=16&output=embed" 
                                width="100%" 
                                height="200" 
                                style="border:none;" 
                                allowfullscreen>
                        </iframe>
                    `;
                } else {
                    clonedLocalizacionContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 0.85rem;">Ubicación no válida</div>`;
                }
            } else if (clonedLocalizacionContainer) {
                clonedLocalizacionContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 0.85rem;">Sin geolocalización</div>';
            }
            
            // Render novedades in cloned content
            const clonedNovedadesContainer = contentClone.querySelector('#viewNovedadesContainer');
            const novedadesData = rep.novedades_auditoria || rep.novedades || rep.NOVEDADES || rep.NOVEDADES_AUDITORIA || '';
            
            if (clonedNovedadesContainer && !novedadesData) {
                clonedNovedadesContainer.innerHTML = '<p style="color:#64748b; font-style:italic; margin:0; font-size:0.85rem;">No se registraron novedades cuantitativas.</p>';
            } else if (clonedNovedadesContainer) {
                try {
                    let parsed = novedadesData;
                    if (typeof parsed === 'string') { parsed = JSON.parse(parsed); }
                    if (typeof parsed === 'string') { parsed = JSON.parse(parsed); }

                    if (!Array.isArray(parsed) || parsed.length === 0) {
                        clonedNovedadesContainer.innerHTML = '<p style="color:#64748b; font-style:italic; margin:0; font-size:0.85rem;">No se registraron novedades cuantitativas.</p>';
                    } else {
                        let html = '';
                        parsed.forEach(novedad => {
                            const totalUnidades = novedad.codigos.reduce((sum, c) => sum + (Number(c.cantidad)||0), 0);
                            
                            let bgColor = '#3b82f6';
                            let iconName = 'fa-tag';
                            let displayTipo = novedad.tipo;
                            
                            if (novedad.tipo === 'SIN CONFECCIONAR') { bgColor = '#ef4444'; iconName = 'fa-cut'; }
                            if (novedad.tipo === 'PROMOCIONES') { 
                                if (novedad.sin_proceso) {
                                    bgColor = '#db2777'; 
                                    iconName = 'fa-exclamation-triangle';
                                    displayTipo = 'PROM. SIN PROCESO';
                                } else {
                                    bgColor = '#f59e0b'; 
                                    iconName = 'fa-percentage'; 
                                }
                            }
                            if (novedad.tipo === 'COBROS') { bgColor = '#10b981'; iconName = 'fa-file-invoice-dollar'; }
                            if (novedad.tipo === 'LAVADO') { bgColor = '#6366f1'; iconName = 'fa-water'; }

                            html += `
                                <div class="group-wrapper" style="margin-bottom: 12px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <div class="group-header" style="background-color: ${bgColor}; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 0.85rem;">
                                        <div><i class="fas ${iconName}" style="margin-right:6px;"></i> ${displayTipo}</div>
                                        <div>${totalUnidades} UNDS.</div>
                                    </div>
                                    <table class="nov-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: white;">
                                        <thead>
                                            <tr style="background: #f8fafc;">
                                                <th style="width:40%; padding: 6px 8px; text-align: left; color: #64748b; font-weight: 600; font-size: 0.75rem;">TALLA</th>
                                                <th style="width:40%; padding: 6px 8px; text-align: left; color: #64748b; font-weight: 600; font-size: 0.75rem;">COLOR</th>
                                                <th style="width:20%; padding: 6px 8px; text-align: right; color: #64748b; font-weight: 600; font-size: 0.75rem;">CANTIDAD</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                            `;

                            novedad.codigos.forEach(c => {
                                html += `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 6px 8px;">${c.talla || '-'}</td>
                                        <td style="padding: 6px 8px;">${c.color || '-'}</td>
                                        <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${c.cantidad || '0'}</td>
                                    </tr>
                                `;
                            });

                            html += `
                                        </tbody>
                                    </table>
                                </div>
                            `;
                        });

                        clonedNovedadesContainer.innerHTML = html;
                    }
                } catch (e) {
                    console.error("Error parseando novedades_auditoria", e);
                    clonedNovedadesContainer.innerHTML = `<p style="color:#ef4444; font-size:0.8rem;">Error al leer novedades de auditoría.</p>`;
                }
            }
        }
        
        // Add close button functionality
        const closeBtn = overlay.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.onclick = function() {
                document.body.removeChild(overlay);
            };
        }
        
        // Add click outside to close
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };
        
        document.body.appendChild(overlay);
        console.log('Simple modal overlay created');
    } else {
        console.error('Modal element not found');
    }
};

window.cerrarModalReporte = function () {
    const overlay = document.getElementById('simpleModalOverlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
};

// Add click outside to close modal functionality
document.addEventListener('click', function(e) {
    const modalElement = document.getElementById('reporteModal');
    if (modalElement && modalElement.classList.contains('show')) {
        const modalDialog = modalElement.querySelector('.modal-dialog');
        if (modalDialog && !modalDialog.contains(e.target) && e.target !== modalElement) {
            cerrarModalReporte();
        }
    }
});

// Function to open image modal with rotation option
window.openImageModal = function(imageUrl) {
    const overlay = document.createElement('div');
    overlay.id = 'imageModalOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        max-width: 90%;
        max-height: 90%;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.id = 'modalImage';
    img.style.cssText = `
        max-width: 100%;
        max-height: 90vh;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        transition: transform 0.3s ease;
    `;
    
    // Rotation controls
    const controls = document.createElement('div');
    controls.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 10px;
        z-index: 100001;
    `;
    
    const rotateLeftBtn = document.createElement('button');
    rotateLeftBtn.innerHTML = '<i class="fas fa-undo"></i>';
    rotateLeftBtn.style.cssText = `
        background: rgba(63, 81, 181, 0.9);
        color: white;
        border: none;
        border-radius: 50%;
        width: 45px;
        height: 45px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: background 0.2s;
    `;
    rotateLeftBtn.onmouseover = function() { this.style.background = 'rgba(63, 81, 181, 1)'; };
    rotateLeftBtn.onmouseout = function() { this.style.background = 'rgba(63, 81, 181, 0.9)'; };
    
    const rotateRightBtn = document.createElement('button');
    rotateRightBtn.innerHTML = '<i class="fas fa-redo"></i>';
    rotateRightBtn.style.cssText = `
        background: rgba(63, 81, 181, 0.9);
        color: white;
        border: none;
        border-radius: 50%;
        width: 45px;
        height: 45px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: background 0.2s;
    `;
    rotateRightBtn.onmouseover = function() { this.style.background = 'rgba(63, 81, 181, 1)'; };
    rotateRightBtn.onmouseout = function() { this.style.background = 'rgba(63, 81, 181, 0.9)'; };
    
    let rotation = 0;
    
    rotateLeftBtn.onclick = function(e) {
        e.stopPropagation();
        rotation -= 90;
        img.style.transform = `rotate(${rotation}deg)`;
    };
    
    rotateRightBtn.onclick = function(e) {
        e.stopPropagation();
        rotation += 90;
        img.style.transform = `rotate(${rotation}deg)`;
    };
    
    controls.appendChild(rotateLeftBtn);
    controls.appendChild(rotateRightBtn);
    
    container.appendChild(img);
    container.appendChild(controls);
    overlay.appendChild(container);
    
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
    
    document.body.appendChild(overlay);
};

// Function to open map modal
window.openMapModal = function(lat, lng) {
    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(mapUrl, '_blank');
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

function formatFechaDisplay(date) {
    if (!date || isNaN(date)) return '—';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear());
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
            onclick="changeTablePage(${tableCurrentPage - 1})" title="Anterior">
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
            onclick="changeTablePage(${p})">${p}</button>`;
        last = p;
    });

    html += `
        <button type="button" class="btn-page" ${tableCurrentPage >= totalPages ? 'disabled' : ''}
            onclick="changeTablePage(${tableCurrentPage + 1})" title="Siguiente">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    btns.innerHTML = html;
}

window.changeTablePage = function (page) {
    const totalPages = Math.max(1, Math.ceil(gsTableReportes.length / TABLE_PAGE_SIZE));
    if (page < 1 || page > totalPages) return;
    tableCurrentPage = page;
    renderTable(false);
};

function renderTable(resetPage = true) {
    const tbody = document.getElementById('tableBody');
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
                    <button type="button" class="btn-ver-reporte" onclick="verReporteAnalizado(${globalIndex})" title="Ver reporte">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderTablePagination(totalTable, totalPages);
}
