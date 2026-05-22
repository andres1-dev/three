/* ==========================================================================
   ui.js — Manipulación del DOM, utilidades de presentación
   ========================================================================== */

/* ── Referencias de elementos del DOM ── */
const DOM = {
    loader: () => document.getElementById('loader'),
    mainForm: () => document.getElementById('mainForm'),
    loteInput: () => document.getElementById('loteInput'),
    loteSuggestions: () => document.getElementById('loteSuggestions'),
    detailsSection: () => document.getElementById('detailsSection'),
    errorMessage: () => document.getElementById('errorMessage'),
    plantaSelect: () => document.getElementById('planta'),
    lineaInput: () => document.getElementById('linea'),
    accionesSelect: () => document.getElementById('acciones'),
    novedadesSection: () => document.getElementById('novedadesSection'),
    calidadSection: () => document.getElementById('calidadSection'),
    actualizarDatosSection: () => document.getElementById('actualizarDatosSection'),
    ruteroSection: () => document.getElementById('ruteroSection'),
    fecha: () => document.getElementById('fecha'),
    logo: () => document.getElementById('logo'),
    localizacion: () => document.getElementById('localizacion'),
    nombrePlanta: () => document.getElementById('nombrePlanta'),
    editPlantaBtn: () => document.getElementById('editPlantaBtn'),
};

/* ── Utilidades genéricas ── */

/**
 * Formatea un string de fecha a dd/mm/yyyy.
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Si el campo tiene valor, lo deshabilita. Si no, lo habilita.
 * @param {HTMLElement} element
 */
function toggleReadonly(element) {
    if (element.value.trim() !== '') {
        element.setAttribute('disabled', 'disabled');
    } else {
        element.removeAttribute('disabled');
    }
}

/* ── Funciones de visibilidad ── */

/** Limpia la lista de sugerencias de lotes. */
function clearSuggestions() {
    const el = DOM.loteSuggestions();
    el.innerHTML = '';
    el.classList.add('hidden');
}

/** Muestra el mensaje de estado vacío */
function showEmptyState() {
    const emptyMsg = document.getElementById('emptyStateMessage');
    if (emptyMsg) emptyMsg.classList.remove('hidden');
}

/** Oculta el mensaje de estado vacío */
function hideEmptyState() {
    const emptyMsg = document.getElementById('emptyStateMessage');
    if (emptyMsg) emptyMsg.classList.add('hidden');
}

/** Oculta todas las secciones dinámicas del formulario y colapsa los detalles del lote. */
function hideSections() {
    DOM.detailsSection().classList.add('hidden');
    DOM.novedadesSection().classList.add('hidden');
    DOM.calidadSection().classList.add('hidden');
    DOM.actualizarDatosSection().classList.add('hidden');
    DOM.ruteroSection()?.classList.add('hidden');
    DOM.errorMessage().classList.add('hidden');

    const previosSection = document.getElementById('previosCalidadSection');
    if (previosSection) previosSection.classList.add('hidden');

    // Limpiar campos del formulario de novedades
    const area = document.getElementById('area');
    const cantidadSolicitada = document.getElementById('cantidadSolicitada');
    const observacionesNovedad = document.getElementById('observacionesNovedad');
    const imagen = document.getElementById('imagen');
    const imagenName = document.getElementById('imagenName');
    const imagenDropzone = document.getElementById('imagenDropzone');
    if (area) area.value = '';
    if (cantidadSolicitada) cantidadSolicitada.value = '';
    if (observacionesNovedad) observacionesNovedad.value = '';
    if (imagen) imagen.value = '';
    if (imagenName) imagenName.textContent = '';
    if (imagenDropzone) imagenDropzone.classList.remove('has-file');

    // Limpiar select de acciones
    const acciones = DOM.accionesSelect();
    if (acciones) acciones.value = '';

    // Asegurar que los datos del lote se contraigan
    const collapseHeader = document.getElementById('lotCollapseToggle');
    const collapseBody = document.getElementById('lotCollapseBody');
    if (collapseHeader && collapseBody) {
        collapseHeader.classList.remove('open');
        collapseBody.classList.remove('open');
        collapseHeader.setAttribute('aria-expanded', 'false');
    }

    clearSuggestions();
    showEmptyState(); // Mostrar mensaje vacío cuando se ocultan las secciones
}

/**
 * Muestra el indicador de sincronización y oculta el error.
 */
function showLoader() {
    const el = document.getElementById('index-skeleton');
    if (el) el.style.display = 'block';
    const form = DOM.mainForm();
    if (form) form.style.display = 'none';
    const err = DOM.errorMessage();
    if (err) err.classList.add('hidden');
}

/**
 * Oculta el indicador de sincronización.
 */
function hideLoaderShowForm() {
    const el = document.getElementById('index-skeleton');
    if (el) el.style.display = 'none';
    const form = DOM.mainForm();
    if (form) form.style.display = 'block';
}

/**
 * Muestra un mensaje de error al usuario.
 * @param {string} message
 */
function showError(message) {
    const el = DOM.errorMessage();
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    }
    const skel = document.getElementById('index-skeleton');
    if (skel) skel.style.display = 'block';
}

/* ── Poblar elementos del DOM ── */

/**
 * Llena el select de planta con valores únicos de los registros.
 * @param {Object[]} lots
 */
function populatePlantaOptions(lots) {
    const datalist = document.getElementById('plantasDatalist');
    if (!datalist) return;

    let nombres = [];
    // 1. Agregar plantas registradas
    if (typeof currentPlantas !== 'undefined' && Array.isArray(currentPlantas)) {
        currentPlantas.forEach(p => {
            const nombre = p.PLANTA || p.planta || p.nombre || p.nombre_planta;
            if (nombre) nombres.push(nombre.trim().toUpperCase());
        });
    }
    // 2. Agregar plantas de los lotes (por si hay alguna que no esté en currentPlantas)
    if (Array.isArray(lots)) {
        lots.forEach(l => {
            if (l.PLANTA) nombres.push(l.PLANTA.trim().toUpperCase());
        });
    }
    // 3. CDI por defecto siempre debe existir
    nombres.push('CDI');

    const uniqueNombres = [...new Set(nombres)].sort();

    datalist.innerHTML = '';
    uniqueNombres.forEach((planta) => {
        const option = document.createElement('option');
        option.value = planta;
        datalist.appendChild(option);
    });

    // Configurar el input para auto-llenar CDI
    const plantaInput = document.getElementById('planta');
    if (plantaInput) {
        if (!plantaInput.value) {
            plantaInput.value = 'CDI';
        }

        // Listener de blur para asegurar que CDI sea el valor por defecto
        if (!plantaInput.dataset.hasCDIListener) {
            plantaInput.addEventListener('blur', () => {
                if (!plantaInput.value.trim()) {
                    plantaInput.value = 'CDI';
                }
            });
            plantaInput.dataset.hasCDIListener = 'true';
        }
    }
}

/**
 * Rellena los campos de detalle con los datos de un lote seleccionado.
 * @param {Object} lotData
 */
function fillLotDetails(lotData) {
    // Ocultar mensaje vacío cuando se selecciona un lote
    hideEmptyState();

    document.getElementById('lote').value = lotData.LOTE || '';
    document.getElementById('referencia').value = lotData.REFERENCIA || '';
    document.getElementById('cantidad').value = lotData.CANTIDAD || '';
    DOM.plantaSelect().value = lotData.PLANTA || '';
    document.getElementById('entrada').value = formatDate(lotData.ENTRADA) || '';
    document.getElementById('salida').value = formatDate(lotData.SALIDA) || '';
    DOM.lineaInput().value = lotData.LINEA || '';
    document.getElementById('proceso').value = lotData.PROCESO || '';
    document.getElementById('prenda').value = lotData.PRENDA || '';
    document.getElementById('genero').value = lotData.GENERO || '';
    document.getElementById('tejido').value = lotData.TEJIDO || '';

    // Calcular y mostrar duración estimada
    const duracion = calcularDuracionProduccion(lotData.PRENDA, lotData.CANTIDAD);
    const duracionField = document.getElementById('duracionEstimada');
    if (duracionField) {
        if (duracion.totalMinutos > 0) {
            // Formato: X días, Y horas, Z minutos
            let partes = [];
            if (duracion.dias > 0) partes.push(`${duracion.dias} día${duracion.dias !== 1 ? 's' : ''}`);
            if (duracion.horas > 0) partes.push(`${duracion.horas} hora${duracion.horas !== 1 ? 's' : ''}`);
            if (duracion.minutos > 0) partes.push(`${duracion.minutos} min`);
            if (duracion.segundos > 0 && duracion.dias === 0) partes.push(`${duracion.segundos} seg`);

            const textoFormateado = partes.length > 0 ? partes.join(', ') : '< 1 segundo';
            duracionField.value = `${textoFormateado} (${duracion.totalMinutos} min totales)`;
        } else {
            duracionField.value = 'No disponible';
        }
    }

    toggleReadonly(DOM.plantaSelect());
    toggleReadonly(DOM.lineaInput());

    // Auto-fill ruteroCantidad if the rutero form is visible
    const ruteroCantidad = document.getElementById('ruteroCantidad');
    if (ruteroCantidad) ruteroCantidad.value = lotData.CANTIDAD || '';

    DOM.detailsSection().classList.remove('hidden');

    // Cargar y mostrar reportes previos de calidad
    if (typeof fetchAndRenderPreviousReports === 'function') {
        fetchAndRenderPreviousReports(lotData.LOTE);
    }
}

let _loadedPreviousReports = []; // Cache en memoria para ver/descargar rápido

async function fetchAndRenderPreviousReports(loteNum) {
    const listContainer = document.getElementById('previosCalidadList');
    const countBadge = document.getElementById('previosCalidadCount');
    const sectionContainer = document.getElementById('previosCalidadSection');

    if (!listContainer || !sectionContainer) return;

    // Mostrar estado de carga inicial
    sectionContainer.classList.remove('hidden');
    countBadge.textContent = '...';
    listContainer.innerHTML = `
        <div class="skeleton-previous-reports" style="padding:10px 0; width:100%; display:flex; flex-direction:column; gap:10px;">
            <style>
                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .skeleton-report-card {
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    padding: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .skeleton-line {
                    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    animation: skeleton-loading 1.5s infinite;
                    border-radius: 4px;
                }
            </style>
            <div class="skeleton-report-card">
                <div style="flex:1;">
                    <div class="skeleton-line" style="width:60%; height:14px; margin-bottom:6px;"></div>
                    <div class="skeleton-line" style="width:40%; height:11px;"></div>
                </div>
                <div class="skeleton-line" style="width:70px; height:20px; border-radius:12px;"></div>
            </div>
            <div class="skeleton-report-card">
                <div style="flex:1;">
                    <div class="skeleton-line" style="width:50%; height:14px; margin-bottom:6px;"></div>
                    <div class="skeleton-line" style="width:30%; height:11px;"></div>
                </div>
                <div class="skeleton-line" style="width:70px; height:20px; border-radius:12px;"></div>
            </div>
        </div>
    `;

    try {
        // Consultar reportes para este Lote/OP
        const reports = await fetchSupabaseData('reportes', {
            filters: [{ column: 'id', type: 'eq', value: String(loteNum) }],
            noCache: true
        });

        if (!reports || reports.length === 0) {
            sectionContainer.classList.add('hidden');
            _loadedPreviousReports = [];
            return;
        }

        // Guardar en cache local para acceso rápido
        _loadedPreviousReports = reports;

        // Ordenar por fecha descendente
        reports.sort((a, b) => {
            const dateA = new Date(a.FECHA || a.fecha || 0);
            const dateB = new Date(b.FECHA || b.fecha || 0);
            return dateB - dateA;
        });

        countBadge.textContent = reports.length;
        listContainer.innerHTML = '';

        reports.forEach(report => {
            const conclusion = (report.CONCLUSION || 'APROBADO').toUpperCase();
            let bgConclusion = '#e8f5e9';
            let colorConclusion = '#2e7d32';
            let iconConclusion = 'fa-check-circle';

            if (conclusion.includes('RECHAZADO')) {
                bgConclusion = '#ffebee';
                colorConclusion = '#c62828';
                iconConclusion = 'fa-times-circle';
            } else if (conclusion.includes('CONDICION') || conclusion.includes('PENDIENTE')) {
                bgConclusion = '#fff3e0';
                colorConclusion = '#ef6c00';
                iconConclusion = 'fa-exclamation-circle';
            }

            const rawFecha = report.FECHA || report.fecha || '';
            let fechaFormateada = rawFecha;
            try {
                if (rawFecha) {
                    const dateObj = new Date(rawFecha);
                    const options = {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    };
                    fechaFormateada = dateObj.toLocaleString('es-CO', options);
                }
            } catch (e) { }

            const item = document.createElement('div');
            item.className = 'previo-reporte-item';
            item.style.cssText = 'border-bottom: 1px solid #e2e8f0; padding: 15px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; transition: background 0.2s; cursor: pointer;';
            item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 200px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${bgConclusion}; color: ${colorConclusion}; font-size: 1.1rem; flex-shrink: 0;">
                        <i class="fas ${iconConclusion}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem; line-height: 1.2; display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                            ${report.TIPO_VISITA || 'AUDITORÍA'} 
                            <span class="badge" style="background: ${bgConclusion}; color: ${colorConclusion}; border-radius: 12px; font-size: 0.65rem; padding: 3px 8px; font-weight: 700; border: 1px solid ${colorConclusion}40;">
                                ${conclusion}
                            </span>
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                            <i class="far fa-clock"></i> ${fechaFormateada}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding-right: 5px;">
                    <button type="button" onclick="verDescargarReportePrevio('${report.ID_REPORTE}')" style="background: transparent; border: none; padding: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.2s; cursor: pointer; outline: none;" title="Ver Reporte" onmouseover="this.style.color='#3b82f6'; this.style.transform='scale(1.1)';" onmouseout="this.style.color='#94a3b8'; this.style.transform='none';">
                        <i class="fas fa-eye" style="font-size: 1.2rem;"></i>
                    </button>
                    <button type="button" onclick="verDescargarReportePrevio('${report.ID_REPORTE}', true)" style="background: transparent; border: none; padding: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.2s; cursor: pointer; outline: none;" title="Imprimir" onmouseover="this.style.color='#10b981'; this.style.transform='scale(1.1)';" onmouseout="this.style.color='#94a3b8'; this.style.transform='none';">
                        <i class="fas fa-print" style="font-size: 1.2rem;"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });

    } catch (error) {
        console.error('[Previos Calidad] Error al cargar reportes:', error);
        listContainer.innerHTML = `
            <div class="p-3 text-center text-danger" style="font-size: 0.8rem;">
                <i class="fas fa-triangle-exclamation"></i> Error al cargar reportes previos
            </div>
        `;
    }
}

async function uiObtenerDatosPlanta(plantaNombre) {
    if (!plantaNombre) return { nombre: 'N/A', cedula: 'N/A' };
    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                accion: 'GET_DATOS_PLANTA',
                planta: plantaNombre
            })
        });
        if (!response.ok) throw new Error('Error HTTP ' + response.status);
        const result = await response.json();
        if (result.success && result.data) {
            return {
                nombre: result.data.nombre || plantaNombre,
                cedula: result.data.nit_cedula || 'N/A'
            };
        }
        return { nombre: plantaNombre, cedula: 'N/A' };
    } catch(e) {
        console.error("Error al obtener datos de la planta:", e);
        return { nombre: plantaNombre, cedula: 'N/A' };
    }
}

async function uiObtenerDatosAuditor(email) {
    if (!email) return { nombre: 'N/A', cedula: 'N/A' };
    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({ accion: 'RESOLVER_USUARIOS_LOGIN' })
        });
        if (!response.ok) throw new Error('Error HTTP ' + response.status);
        const result = await response.json();
        const users = result.users || [];
        const foundUser = users.find(u => String(u.CORREO || '').toLowerCase() === String(email).toLowerCase());
        if (foundUser) {
            return {
                nombre: foundUser.NOMBRE || email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                cedula: foundUser.ID_USUARIO || 'N/A'
            };
        }
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { nombre: username, cedula: 'N/A' };
    } catch(e) {
        console.error("Error al obtener datos de auditor:", e);
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { nombre: username, cedula: 'N/A' };
    }
}

async function uiObtenerNombreProductora(productoraId) {
    if (!productoraId) return 'N/A';
    try {
        const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
        const response = await fetch(`${projectUrl}/rest/v1/productoras?select=productora&id_productora=eq.${parseInt(productoraId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            }
        });
        if (!response.ok) throw new Error('Error HTTP ' + response.status);
        const result = await response.json();
        return result[0]?.productora || 'N/A';
    } catch(e) {
        console.error("Error al obtener productora:", e);
        return 'N/A';
    }
}

async function generarHtmlStandalone(reportObj) {
    const reportNormalized = {};
    for (const key in reportObj) {
        reportNormalized[key.toLowerCase()] = reportObj[key];
    }
    
    // Pre-fetch all metadata details
    const productoraNombre = await uiObtenerNombreProductora(reportObj.PRODUCTORA || reportObj.productora);
    const auditorDatos = await uiObtenerDatosAuditor(reportObj.EMAIL || reportObj.email);
    const plantaDatos = await uiObtenerDatosPlanta(reportObj.PLANTA || reportObj.planta);
    
    // 1. Fetch & Base64-encode the logo to make it offline-safe and loadable in iframe
    let logoBase64 = 'icons/app.svg';
    try {
        const logoResp = await fetch('icons/app.svg');
        if (logoResp.ok) {
            const logoBlob = await logoResp.blob();
            logoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(logoBlob);
            });
        }
    } catch(e) {
        console.error("Error al obtener logo Base64:", e);
    }
    
    // 2. Fetch & Base64-encode the static map if coordinates exist, bypassing CORS/Iframe canvas issues
    let mapBase64 = '';
    const locStr = String(reportObj.LOCALIZACION || reportObj.localizacion || '');
    if (locStr && locStr.includes(',')) {
        const coords = locStr.split(',');
        const lat = coords[0]?.trim();
        const lon = coords[1]?.trim();
        if (lat && lon) {
            try {
                const mapUrl = `https://static-maps.yandex.ru/1.x/?ll=${lon},${lat}&z=16&l=map&size=650,300&pt=${lon},${lat},pm2rdl`;
                const mapResp = await fetch(mapUrl);
                if (mapResp.ok) {
                    const mapBlob = await mapResp.blob();
                    mapBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(mapBlob);
                    });
                }
            } catch(e) {
                console.error("Error al obtener mapa estático Base64:", e);
            }
        }
    }
    
    const preloadedDatos = {
        productoraNombre: productoraNombre,
        auditorNombre: auditorDatos.nombre,
        auditorCedula: auditorDatos.cedula,
        plantaNombre: plantaDatos.nombre,
        plantaCedula: plantaDatos.cedula,
        mapImageBase64: mapBase64
    };
    
    const response = await fetch('plantilla-impresion-calidad.html');
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de impresión.");
    let htmlText = await response.text();
    
    // Inyectar el logo Base64
    htmlText = htmlText.replace('src="icons/app.svg"', `src="${logoBase64}"`);
    
    // Inject the actual static report data instead of localStorage
    const replacement = `const dataRaw = ${JSON.stringify(JSON.stringify(reportNormalized))};`;
    htmlText = htmlText.replace("const dataRaw = localStorage.getItem('printReporteCalidad');", replacement);
    
    // Inject the preloadedDatos script tag right before </head>
    const preloadedScript = `<script>window.preloadedDatos = ${JSON.stringify(preloadedDatos)};</script>`;
    htmlText = htmlText.replace("</head>", `${preloadedScript}\n</head>`);
    
    return htmlText;
}

async function descargarReporteHTMLDirecto(idReporte) {
    const reportObj = _loadedPreviousReports.find(r => r.ID_REPORTE === idReporte);
    if (!reportObj) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontraron los datos del reporte.' });
        return;
    }
    
    try {
        Swal.fire({
            title: 'Generando HTML...',
            html: 'Por favor espere mientras compilamos el reporte...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        
        const htmlContent = await generarHtmlStandalone(reportObj);
        
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Calidad_OP_${reportObj.OP || reportObj.ID || 'Novedad'}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Swal.close();
    } catch(e) {
        console.error(e);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo generar el reporte en HTML: ' + e.message
        });
    }
}

async function descargarReportePDFDirecto(idReporte) {
    const reportObj = _loadedPreviousReports.find(r => r.ID_REPORTE === idReporte);
    if (!reportObj) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontraron los datos del reporte.' });
        return;
    }
    
    try {
        Swal.fire({
            title: 'Generando PDF...',
            html: 'Renderizando reporte en alta definición...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        
        // Cargar html2canvas y jsPDF si no están presentes
        if (typeof html2canvas === 'undefined') {
            await new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            await new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        
        const htmlContent = await generarHtmlStandalone(reportObj);
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '800px';
        iframe.style.height = '1600px'; 
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();
        
        setTimeout(async () => {
            const element = doc.getElementById('reporteContenedor');
            if (!element) {
                iframe.remove();
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo encontrar el contenedor del reporte.' });
                return;
            }
            
            const buttons = doc.querySelectorAll('.no-print, button, .print-btn-area');
            buttons.forEach(b => b.style.display = 'none');
            
            element.style.boxShadow = 'none';
            element.style.margin = '0';
            element.style.padding = '4px';
            element.style.background = '#ffffff';
            
            try {
                const canvas = await html2canvas(element, {
                    scale: 2.5,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = imgWidth / imgHeight;
                
                const pdfWidth = 215.9; // Ancho carta estándar (8.5 pulgadas en mm)
                const margin = 5; // Margen mínimo de 5mm alrededor del reporte
                
                const printableWidth = pdfWidth - (margin * 2);
                const printableHeight = printableWidth / ratio;
                const pdfHeight = printableHeight + (margin * 2);
                
                const { jsPDF } = window.jspdf || window;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: [pdfWidth, pdfHeight] // Tamaño de lienzo proporcional + márgenes mínimos
                });
                
                pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, printableHeight, undefined, 'FAST');
                
                pdf.save(`Reporte_Calidad_OP_${reportObj.OP || reportObj.ID || 'Novedad'}.pdf`);
                
                iframe.remove();
                Swal.close();
                
            } catch (err) {
                console.error(err);
                iframe.remove();
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al generar la imagen del PDF: ' + err.message
                });
            }
        }, 3000);
        
    } catch(e) {
        console.error(e);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo generar el reporte en PDF: ' + e.message
        });
    }
}

function verDescargarReportePrevio(idReporte, autoPrint = false) {
    const reportObj = _loadedPreviousReports.find(r => r.ID_REPORTE === idReporte);
    if (!reportObj) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el detalle del reporte.',
            timer: 2000
        });
        return;
    }

    // Normalizar a minúsculas para que la plantilla lo lea correctamente
    const reportNormalized = {};
    for (const key in reportObj) {
        reportNormalized[key.toLowerCase()] = reportObj[key];
    }
    
    if (autoPrint) {
        reportNormalized._autoPrint = true;
    }

    // Guardar en localStorage con el formato esperado por la plantilla
    localStorage.setItem('printReporteCalidad', JSON.stringify(reportNormalized));

    // Abrir plantilla en pestaña nueva
    window.open('plantilla-impresion-calidad.html', '_blank');
}

// Exponer funciones globalmente
window.fetchAndRenderPreviousReports = fetchAndRenderPreviousReports;
window.verDescargarReportePrevio = verDescargarReportePrevio;
window.generarHtmlStandalone = generarHtmlStandalone;
window.descargarReporteHTMLDirecto = descargarReporteHTMLDirecto;
window.descargarReportePDFDirecto = descargarReportePDFDirecto;


/**
 * Renderiza las sugerencias filtradas.
 * @param {Object[]} filteredLots
 */
function renderSuggestions(filteredLots) {
    const container = DOM.loteSuggestions();
    container.innerHTML = '';

    filteredLots.forEach((lot) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `${lot.LOTE || ''} - ${lot.PROCESO || 'SIN PROCESO'} - ${lot.PLANTA || 'SIN PLANTA'}`;
        li.dataset.lot = JSON.stringify(lot);
        container.appendChild(li);
    });

    if (filteredLots.length > 0) {
        container.classList.remove('hidden');
    }
}

/**
 * Muestra / oculta las secciones según la acción seleccionada.
 * @param {string} action — 'NOVEDADES' | 'CALIDAD' | 'ACTUALIZAR_DATOS' | ''
 */
function toggleActionSections(action) {
    const novedades = DOM.novedadesSection();
    const calidad = DOM.calidadSection();
    const actualizarDatos = DOM.actualizarDatosSection();
    const rutero = DOM.ruteroSection();

    novedades.classList.toggle('hidden', action !== 'NOVEDADES');
    calidad.classList.toggle('hidden', action !== 'CALIDAD');
    actualizarDatos.classList.toggle('hidden', action !== 'ACTUALIZAR_DATOS');
    if (rutero) rutero.classList.toggle('hidden', action !== 'RUTERO');

    if (action === 'RUTERO') {
        initRuteroForm();
    }

    // Auto-llenar nombre de planta al abrir formulario de actualización
    if (action === 'ACTUALIZAR_DATOS') {
        console.log('[toggleActionSections] Abriendo formulario ACTUALIZAR_DATOS');
        console.log('[toggleActionSections] currentUser:', currentUser);
        console.log('[toggleActionSections] currentPlantas:', currentPlantas);
        fillPlantaName();
    }

    // Auto-llenar el correo y la localización GPS en el formulario de Calidad
    if (action === 'CALIDAD') {
        const emailInput = document.getElementById('email');
        if (emailInput && typeof currentUser !== 'undefined' && currentUser) {
            emailInput.value = currentUser.CORREO || '';
            emailInput.readOnly = true;
            emailInput.classList.add('bg-light');
        }
        // Capturar coordenadas GPS en el momento de abrir el formulario
        requestCalidadLocation();
        // Inicializar lógica dinámica del formulario
        initCalidadForm();
    }

    // Limpiar historial de IA al cambiar de sección o cerrar
    if (typeof clearVersionHistory === 'function') clearVersionHistory();
}

/* ── GPS Permission Manager ── */

/**
 * Clave única de preferencia GPS por usuario.
 */
function getGpsKey() {
    const userId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.ID : 'guest';
    return `gps_calidad_${userId}`;
}

/**
 * Habilita o deshabilita todos los campos del formulario de Calidad.
 * @param {boolean} disabled — true si el GPS no está activo
 */
function setCalidadFieldsDisabled(disabled) {
    const ids = ['email', 'tipoVisita', 'conclusion', 'observacionesCalidad', 'soporte'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = disabled;
        if (disabled) {
            el.style.opacity = '0.45';
            el.style.cursor = 'not-allowed';
        } else {
            el.style.opacity = '';
            el.style.cursor = '';
        }
    });
    const submitBtn = document.querySelector('#calidadForm button[type="submit"]');
    if (submitBtn) submitBtn.disabled = disabled;
}

/**
 * Aplica el estado visual ON/OFF del toggle GPS con estilo minimalista (dot + texto).
 * @param {boolean} enabled
 */
function applyGpsToggleUI(enabled) {
    const label = document.getElementById('gps-status-label');
    const slider = document.getElementById('gps-toggle-slider');
    const knob = document.getElementById('gps-toggle-knob');
    if (!label || !slider || !knob) return;

    if (enabled) {
        // Dot verde sin texto
        label.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#16a34a;display:inline-block;box-shadow:0 0 0 2px #bbf7d0;"></span>`;
        slider.style.background = '#16a34a';
        knob.style.transform = 'translateX(20px)';
        setCalidadFieldsDisabled(false);
        const rb = document.getElementById('gps-refresh-btn');
        if (rb) rb.style.display = 'inline-block';
    } else {
        // Dot rojo sin texto
        label.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#dc2626;display:inline-block;box-shadow:0 0 0 2px #fecaca;"></span>`;
        slider.style.background = '#dc2626';
        knob.style.transform = 'translateX(0)';
        setCalidadFieldsDisabled(true);
        const rb = document.getElementById('gps-refresh-btn');
        if (rb) rb.style.display = 'none';
    }
}

/**
 * Muestra el bloqueo del mapa cuando GPS está desactivado.
 */
function showGpsBlockedOverlay() {
    const mapaCard = document.getElementById('mapa-calidad-card');
    if (mapaCard) {
        mapaCard.innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <div style="
                    width:48px; height:48px; border-radius:50%;
                    background:#fef2f2; border:1.5px solid #fecaca;
                    display:flex; align-items:center; justify-content:center;
                    margin:0 auto 12px;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 9-9c2.52 0 4.8 1.04 6.44 2.72"></path>
                    </svg>
                </div>
                <p style="margin:0; font-weight:700; color:#374151; font-size:0.88rem;">Ubicación desactivada</p>
                <p style="margin:6px 0 0; color:#9ca3af; font-size:0.78rem; line-height:1.5;">
                    Active la ubicación GPS con el toggle<br>para poder registrar la visita.
                </p>
            </div>
        `;
    }
    document.getElementById('localizacion').value = '';
    setCalidadFieldsDisabled(true);
}

/**
 * Toggle manual: activa o desactiva el GPS para este usuario y actualiza la UI.
 */
function toggleGpsPermission() {
    const key = getGpsKey();
    const current = localStorage.getItem(key);
    const newState = (current === 'enabled') ? 'disabled' : 'enabled';
    localStorage.setItem(key, newState);
    applyGpsToggleUI(newState === 'enabled');

    if (newState === 'enabled') {
        const submitBtn = document.querySelector('#calidadForm button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
        requestCalidadLocation(); // Cargar el mapa tras reactivar
    } else {
        showGpsBlockedOverlay();
    }
}

// Clave de almacenamiento de coordenadas globales (compartida por sesión, no por usuario)
const GPS_COORDS_STORAGE_KEY = 'gps_coords_storage';
const GPS_COORDS_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 horas

/**
 * Muestra el mapa con las coordenadas dadas sin hacer ninguna petición al navegador.
 */
function _renderMapCard(lat, lng, locInput, mapaCard) {
    locInput.value = `${lat}, ${lng}`;
    const mapSrc = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
    mapaCard.innerHTML = `
        <div style="width:100%; position:relative;">
            <iframe
                src="${mapSrc}"
                width="100%" height="220"
                style="border:0; display:block;"
                allowfullscreen="" loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
            <div style="
                position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
                background:rgba(38,82,219,0.88); color:#fff;
                font-size:0.72rem; font-weight:700; padding:4px 12px;
                border-radius:20px; pointer-events:none; white-space:nowrap;
                box-shadow:0 2px 8px rgba(0,0,0,0.25);
            ">
                <i class="fas fa-crosshairs me-1"></i> ${lat}, ${lng}
            </div>
        </div>
    `;
    // Mostrar botón de refrescar
    const refreshBtn = document.getElementById('gps-refresh-btn');
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
}

/**
 * Solicita la ubicación GPS cuando el usuario lo activa voluntariamente.
 * Solo se llama al abrir CALIDAD por primera vez (sin cache) o al hacer clic en "Actualizar".
 */
function requestCalidadLocation() {
    const locInput = document.getElementById('localizacion');
    const mapaCard = document.getElementById('mapa-calidad-card');
    const submitBtn = document.querySelector('#calidadForm button[type="submit"]');
    if (!locInput || !mapaCard) return;

    const key = getGpsKey();
    const pref = localStorage.getItem(key);

    // Si el usuario desactivó manualmente → bloquear módulo
    if (pref === 'disabled') {
        applyGpsToggleUI(false);
        showGpsBlockedOverlay();
        return;
    }

    applyGpsToggleUI(true);
    if (submitBtn) submitBtn.disabled = false;

    // ── ESTRATEGIA STORAGE-FIRST ──
    // Buscar coordenadas guardadas previamente en localStorage
    try {
        const stored = JSON.parse(localStorage.getItem(GPS_COORDS_STORAGE_KEY));
        const age = Date.now() - (stored?.ts || 0);
        if (stored && stored.lat && stored.lng && age < GPS_COORDS_MAX_AGE_MS) {
            // Coords guardadas vigentes → mostrar mapa directamente, sin tocar el navegador
            _renderMapCard(stored.lat, stored.lng, locInput, mapaCard);
            return;
        }
    } catch (_) { /* almacenamiento corrupto, ignorar */ }

    // Sin caché vigente → mostrar botón para que el usuario active consciente
    if (!navigator.geolocation) {
        mapaCard.innerHTML = `<span><i class="fas fa-exclamation-triangle me-2 text-warning"></i> Geolocalización no soportada.</span>`;
        locInput.value = 'No soportado';
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    mapaCard.innerHTML = `
        <div style="text-align:center; padding:2rem;">
            <i class="fas fa-map-location-dot" style="font-size:2.5rem; color:#3b82f6; margin-bottom:12px;"></i>
            <p style="margin:0 0 14px; color:#475569; font-size:0.9rem; font-weight:600;">
                Activa la ubicación para registrar la visita de Calidad.
            </p>
            <button onclick="activarGpsManual()" style="
                background:linear-gradient(135deg,#3b82f6,#6366f1);
                color:#fff; border:none; padding:10px 24px;
                border-radius:10px; font-weight:700; font-size:0.85rem;
                cursor:pointer; box-shadow:0 4px 12px rgba(59,130,246,0.35);
            ">
                <i class="fas fa-location-crosshairs me-2"></i> Activar GPS
            </button>
            <p style="margin:10px 0 0; font-size:0.72rem; color:#94a3b8;">
                Solo se pedirá una vez. La ubicación se guarda automáticamente.
            </p>
        </div>
    `;
}

/**
 * Llamado desde el botón "Activar GPS" o "Actualizar".
 * El usuario hace clic conscientemente → navegador solo pregunta si es la primera vez.
 */
function activarGpsManual() {
    const locInput = document.getElementById('localizacion');
    const mapaCard = document.getElementById('mapa-calidad-card');
    const submitBtn = document.querySelector('#calidadForm button[type="submit"]');
    const key = getGpsKey();

    mapaCard.innerHTML = `<span><i class="fas fa-spinner fa-spin me-2"></i> Obteniendo coordenadas...</span>`;
    if (submitBtn) submitBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);

            // Guardar en localStorage con timestamp para no volver a pedir permiso
            localStorage.setItem(GPS_COORDS_STORAGE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
            localStorage.setItem(key, 'enabled');
            applyGpsToggleUI(true);

            _renderMapCard(lat, lng, locInput, mapaCard);
        },
        (error) => {
            console.warn('[GPS]', error.message);
            if (submitBtn) submitBtn.disabled = false;
            if (error.code === error.PERMISSION_DENIED) {
                localStorage.setItem(key, 'disabled');
                applyGpsToggleUI(false);
                showGpsBlockedOverlay();
            } else {
                locInput.value = 'No disponible';
                mapaCard.innerHTML = `
                    <div style="text-align:center; padding:1.5rem;">
                        <i class="fas fa-map-marker-alt" style="font-size:2rem; color:#cbd5e1; margin-bottom:10px;"></i>
                        <p style="margin:0; color:#94a3b8; font-size:0.85rem;">
                            No se pudo obtener la ubicación.<br>
                            <small>Verifique los permisos del navegador e intente de nuevo.</small>
                        </p>
                    </div>
                `;
            }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
}



/**
 * Llena automáticamente los campos del formulario de Actualizar Datos
 * con los datos del usuario GUEST en sesión.
 */
function fillPlantaName() {
    // Para usuarios GUEST, usar el nombre de planta del currentUser
    let plantaValue = '';
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.ROL === 'GUEST') {
        plantaValue = currentUser.PLANTA || '';
    } else {
        plantaValue = DOM.plantaSelect().value;
    }

    DOM.nombrePlanta().value = plantaValue || '';

    const cedulaInput = document.getElementById('cedulaPlanta');
    const direccionInput = document.getElementById('direccionPlanta');
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput = document.getElementById('emailPlanta');

    // Nuevos campos de ubicación
    const paisInput = document.getElementById('paisPlanta');
    const departamentoInput = document.getElementById('departamentoPlanta');
    const ciudadInput = document.getElementById('ciudadPlanta');
    const barrioInput = document.getElementById('barrioPlanta');
    const barrioManualInput = document.getElementById('barrioPlantaManual');
    const comunaInput = document.getElementById('comunaPlanta');
    const contactoInput = document.getElementById('contactoPlanta');
    const localizacionInput = document.getElementById('localizacionPlanta');

    // Pre-llenar cédula desde currentUser (bloqueado, no editable)
    if (cedulaInput && typeof currentUser !== 'undefined' && currentUser) {
        const id = String(currentUser.ID_PLANTA || currentUser.ID_USUARIO || '').trim();
        cedulaInput.value = id;
    }

    // Pre-llenar datos existentes si los hay
    let plantaData = null;
    if (typeof currentPlantas !== 'undefined' && plantaValue) {
        plantaData = currentPlantas.find(p =>
            (p.PLANTA || '').toString().trim().toLowerCase() === plantaValue.trim().toLowerCase()
        );

        if (!plantaData) {
            // Planta no encontrada en currentPlantas
        }
    }

    if (plantaData) {
        // Datos básicos
        if (direccionInput) {
            direccionInput.value = plantaData.DIRECCION || '';
            // NO parsear ni mostrar constructor automáticamente
            // Solo mostrar el input con la dirección guardada y el icono de edición
        }
        if (emailInput) emailInput.value = plantaData.EMAIL || '';

        const tel = String(plantaData.TELEFONO || '').replace(/\D/g, '');
        if (telefonoInput) {
            telefonoInput.value = tel.length === 10
                ? `(${tel.slice(0, 3)}) ${tel.slice(3, 6)}-${tel.slice(6, 10)}`
                : tel;
        }

        // Pre-llenar campos de ubicación con timeouts escalonados
        if (paisInput) paisInput.value = plantaData.PAIS || 'Colombia';

        if (contactoInput) contactoInput.value = plantaData.CONTACTO || '';

        // Departamento
        if (departamentoInput && plantaData.DEPARTAMENTO) {
            departamentoInput.value = plantaData.DEPARTAMENTO;
            departamentoInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Ciudad (esperar a que se carguen las opciones)
            if (plantaData.CIUDAD) {
                setTimeout(() => {
                    if (ciudadInput) {
                        ciudadInput.value = plantaData.CIUDAD;
                        ciudadInput.dispatchEvent(new Event('change', { bubbles: true }));

                        // Barrio (esperar a que se carguen las opciones)
                        if (plantaData.BARRIO) {
                            setTimeout(() => {
                                if (barrioInput) {
                                    // Verificar si el barrio existe en el selector
                                    const barrioExists = Array.from(barrioInput.options).some(opt => opt.value === plantaData.BARRIO);

                                    if (barrioExists) {
                                        barrioInput.value = plantaData.BARRIO;
                                        barrioInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    } else if (barrioManualInput) {
                                        // Si no existe, usar entrada manual
                                        barrioInput.style.display = 'none';
                                        barrioInput.required = false;
                                        barrioManualInput.style.display = 'block';
                                        barrioManualInput.required = true;
                                        barrioManualInput.value = plantaData.BARRIO;

                                        // Si hay comuna y la ciudad la maneja, hacer el campo editable
                                        if (plantaData.COMUNA && typeof ciudadTieneComunas !== 'undefined' && ciudadTieneComunas(plantaData.CIUDAD)) {
                                            if (comunaInput) {
                                                comunaInput.readOnly = false;
                                                comunaInput.required = true;
                                            }
                                        }
                                    }
                                }

                                // Comuna
                                if (comunaInput && plantaData.COMUNA) {
                                    comunaInput.value = plantaData.COMUNA;
                                }
                            }, 300);
                        }
                    }
                }, 150);
            }
        } else {
            // Si no hay departamento guardado, usar valores por defecto
            if (departamentoInput) {
                departamentoInput.value = 'Valle del Cauca';
                departamentoInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            setTimeout(() => {
                if (ciudadInput) {
                    ciudadInput.value = 'Cali';
                    ciudadInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, 150);
        }

        // Coordenadas GPS y mapa
        if (localizacionInput) localizacionInput.value = plantaData.LOCALIZACION || '';

        // Pre-llenar checkbox de notificaciones si existe el dato
        const checkNotificaciones = document.getElementById('checkNotificaciones');
        if (checkNotificaciones && plantaData.NOTIFICACIONES !== undefined) {
            checkNotificaciones.checked = plantaData.NOTIFICACIONES === true || plantaData.NOTIFICACIONES === 'true';
        }

        // Si hay coordenadas GPS guardadas, mostrarlas en el mapa
        if (plantaData.LOCALIZACION) {
            setTimeout(() => {
                const locInputContainer = document.getElementById('localizacionInputContainer');
                const preguntaCard = document.getElementById('gps-pregunta-card');
                const mapaCard = document.getElementById('gps-planta-card');

                if (locInputContainer) locInputContainer.style.display = 'block';
                if (preguntaCard) preguntaCard.style.display = 'none';

                // Parsear coordenadas y mostrar mapa
                const coords = plantaData.LOCALIZACION.split(',').map(c => c.trim());
                if (coords.length === 2 && mapaCard) {
                    const lat = coords[0];
                    const lng = coords[1];

                    const delta = 0.0045;
                    const minLng = (parseFloat(lng) - delta).toFixed(6);
                    const minLat = (parseFloat(lat) - delta).toFixed(6);
                    const maxLng = (parseFloat(lng) + delta).toFixed(6);
                    const maxLat = (parseFloat(lat) + delta).toFixed(6);

                    mapaCard.style.display = 'block';
                    mapaCard.innerHTML = `
                        <div style="text-align:center;">
                            <div style="margin-bottom:8px;">
                                <i class="fas fa-check-circle" style="color:#10b981; font-size:1.5rem;"></i>
                                <p style="margin:4px 0 0; color:#10b981; font-weight:600; font-size:0.85rem;">Ubicación guardada</p>
                            </div>
                            <div style="border-radius:8px; overflow:hidden; border:2px solid #e2e8f0;">
                                <iframe 
                                    width="100%" 
                                    height="200" 
                                    frameborder="0" 
                                    style="border:0; display:block;" 
                                    src="https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                            <p style="margin:8px 0 0; font-size:0.72rem; color:#64748b;">
                                <i class="fas fa-map-marker-alt me-1"></i> ${lat}, ${lng}
                            </p>
                            <button type="button" onclick="activarGpsPlanta()" style="
                                margin-top:8px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;
                                padding:6px 16px; border-radius:6px; font-size:0.75rem; cursor:pointer;
                            ">
                                <i class="fas fa-sync-alt me-1"></i> Actualizar ubicación
                            </button>
                        </div>
                    `;
                }
            }, 500);
        }
    } else {
        // Si no hay datos, establecer valores por defecto
        if (departamentoInput) {
            departamentoInput.value = 'Valle del Cauca';
            departamentoInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setTimeout(() => {
            if (ciudadInput) {
                ciudadInput.value = 'Cali';
                ciudadInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, 150);

        // Checkbox de notificaciones sin marcar por defecto
        const checkNotificaciones = document.getElementById('checkNotificaciones');
        if (checkNotificaciones) {
            checkNotificaciones.checked = false;
        }
    }
}

/** Actualiza el campo de fecha/hora con la fecha actual en formato ISO. */
function updateDateTime() {
    // Usar formato ISO compatible con PostgreSQL: YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    DOM.fecha().value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Cambia el logo al siguiente en el carrusel.
 * Depende de la constante LOGOS (config.js).
 */
/**
 * Cicla los logos de la empresa.
 */
function cycleLogo() {
    const logo = DOM.logo();
    const currentIndex = LOGOS.findIndex((l) =>
        logo.src.includes(l.split('/').pop()),
    );
    const nextIndex = (currentIndex + 1) % LOGOS.length;
    logo.src = LOGOS[nextIndex];
}

/** 
 * HISTORIAL DE VERSIONES (Volátil)
 * Estructura: { fieldId: [str1, str2, ...] }
 */
let versionHistory = {};

/**
 * Limpia el historial de versiones de todos los campos.
 * Se llama al enviar formularios o cambiar de sección.
 */
function clearVersionHistory() {
    versionHistory = {};

    // Ocultar todos los botones de restaurar y menús
    document.querySelectorAll('.btn-restore-text').forEach(btn => btn.style.display = 'none');
    document.querySelectorAll('.ai-history-menu').forEach(menu => menu.remove());
}

/**
 * Agrega una versión al historial de un campo.
 * @param {string} fieldId 
 * @param {string} text 
 */
function addToHistory(fieldId, text) {
    if (!text) return;
    if (!versionHistory[fieldId]) versionHistory[fieldId] = [];

    // Mantenemos solo las últimas 5 versiones
    if (versionHistory[fieldId].includes(text)) return;
    versionHistory[fieldId].unshift(text);
    if (versionHistory[fieldId].length > 5) versionHistory[fieldId].pop();
}

/**
 * Muestra el menú de historial de versiones.
 */
function showHistoryMenu(fieldId, buttonEl) {
    // Remover menús previos existentes
    document.querySelectorAll('.ai-history-menu').forEach(menu => menu.remove());

    const history = versionHistory[fieldId] || [];
    if (history.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'ai-history-menu';

    // Posicionamiento dinámico cerca del botón
    const rect = buttonEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    menu.style.left = `${rect.left + window.scrollX - 100}px`;

    let html = '<div class="ai-history-header"><i class="fas fa-clock-rotate-left"></i> Versiones anteriores</div>';
    history.forEach((text, index) => {
        const preview = text.length > 35 ? text.substring(0, 35) + '...' : text;
        html += `<div class="ai-history-item" onclick="restaurarVersion('${fieldId}', ${index})">
                    <span class="ai-history-num">${index + 1}</span>
                    <span class="ai-history-text">${preview}</span>
                 </div>`;
    });

    menu.innerHTML = html;
    document.body.appendChild(menu);

    // Cerrar al hacer click fuera
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== buttonEl) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 10);
}

/**
 * Restaura una versión específica del historial.
 */
function restaurarVersion(fieldId, index) {
    const textarea = document.getElementById(fieldId);
    if (!textarea || !versionHistory[fieldId]) return;

    const selectedText = versionHistory[fieldId][index];

    // Antes de pisar, guardamos la actual en el historial si no es igual
    const current = textarea.value.trim();
    if (current && current !== selectedText) {
        addToHistory(fieldId, current);
    }

    textarea.value = selectedText;

    // Limpiar menú
    document.querySelectorAll('.ai-history-menu').forEach(menu => menu.remove());
}

/**
 * Asistente de Redacción con IA (Integración Interna)
 * Conecta con el motor de procesamiento AI para una corrección profesional.
 * @param {string} fieldId
 */
async function mejorarRedaccion(fieldId) {
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

    // Guardar en historial antes de cambiar
    addToHistory(fieldId, textoOriginal);

    // Buscar el botón de restaurar
    const restoreBtn = textarea.parentElement.parentElement.querySelector('.btn-restore-text');

    // Aplicar efecto de IA en el textarea wrapper
    const wrapper = textarea.closest('.ai-textarea-wrapper');
    if (wrapper) {
        wrapper.classList.add('ai-animating');
    }
    textarea.disabled = true;
    textarea.style.cursor = 'wait';

    try {
        const isCalidad = fieldId === 'observacionesCalidad';
        const context = isCalidad ? {
            prenda: document.getElementById('prenda')?.value || 'No especificada',
            genero: document.getElementById('genero')?.value || 'No especificado',
            tejido: document.getElementById('tejido')?.value || 'No especificado',
            proceso: document.getElementById('proceso')?.value || 'No especificado',
            conclusion: document.getElementById('conclusion')?.value || 'NO_ESPECIFICADA',
            tipoVisita: document.getElementById('tipoVisita')?.value || 'AUDITORIA',
            avance: document.getElementById('avancePorcentaje')?.value || ''
        } : null;

        const data = await callSupabaseAI(textoOriginal, isCalidad ? 'CALIDAD_OBSERVATION' : 'GENERIC_CORRECTION', context);

        if (data.success && data.improvedText) {
            // Guardar el texto original en un atributo data
            textarea.setAttribute('data-original-text', textoOriginal);
            textarea.value = data.improvedText;
            // Expandir el textarea al tamaño del contenido
            _autoResizeTextarea(textarea);

            // Mostrar el botón de restaurar
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
        // Remover efecto de IA después de 1.2 segundos
        setTimeout(() => {
            const wrapper = textarea.closest('.ai-textarea-wrapper');
            if (wrapper) {
                wrapper.classList.remove('ai-animating');
            }
            textarea.disabled = false;
            textarea.style.cursor = '';
        }, 1200);
    }
}

/**
 * Restaura el texto original antes de la corrección de IA
 */
/**
 * Abre el menú de historial para el campo especificado.
 */
function restaurarTextoOriginal(fieldId) {
    const btn = event.currentTarget;
    showHistoryMenu(fieldId, btn);
}


/* ══════════════════════════════════════════════════════════════════════════
   Vista de Tarjetas para GUEST
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inicializa la vista de tarjetas para usuarios GUEST
 * Muestra el toggle y renderiza las tarjetas de lotes
 */
function initGuestCardsView() {
    const toggle = document.getElementById('viewToggle');
    const plantaFilter = document.getElementById('plantaFilter');

    // Mostrar u ocultar el toggle y filtro según el rol (inmediatamente)
    if (currentUser && currentUser.ROL === 'GUEST') {
        if (toggle) toggle.style.display = 'flex';
        if (plantaFilter) plantaFilter.style.display = 'none';
        // Renderizar tarjetas con los lotes del GUEST (solo si hay datos)
        if (typeof currentLots !== 'undefined' && currentLots && currentLots.length > 0) {
            renderLotesCards();
        }
    } else if (currentUser) {
        // Para ADMIN y otros usuarios - mostrar inmediatamente
        if (toggle) toggle.style.display = 'flex';
        if (plantaFilter) plantaFilter.style.display = 'flex';
    } else {
        if (toggle) toggle.style.display = 'none';
        if (plantaFilter) plantaFilter.style.display = 'none';
    }
}

// Ejecutar inmediatamente al cargar el script para mostrar el filtro sin esperar datos
if (typeof currentUser !== 'undefined' && currentUser) {
    initGuestCardsView();
}

/**
 * Maneja la búsqueda de plantas con autocompletado
 */
function handlePlantaFilterSearch() {
    const input = document.getElementById('plantaFilterInput');
    const suggestions = document.getElementById('plantaSuggestions');
    const summaryPanel = document.getElementById('summaryPanel');

    if (!input || !suggestions) return;

    const query = input.value.toLowerCase().trim();

    // Validar que currentLots esté disponible
    if (typeof currentLots === 'undefined' || !currentLots || currentLots.length === 0) {
        suggestions.classList.add('hidden');
        return;
    }

    // Si no hay query, limpiar sugerencias y NO mostrar tarjetas
    if (!query) {
        suggestions.classList.add('hidden');
        suggestions.innerHTML = '';

        // Ocultar panel de resumen
        if (summaryPanel) summaryPanel.classList.add('hidden');

        // Limpiar tarjetas también
        const container = document.getElementById('lotesCards');
        if (container) container.innerHTML = '';

        // Mostrar mensajes según el rol
        const isGuest = currentUser && currentUser.ROL === 'GUEST';
        const welcomeCollapse = document.querySelector('.welcome-collapse');
        const emptyStateAdmin = document.getElementById('emptyStateMessageAdmin');

        if (isGuest) {
            if (emptyStateAdmin) emptyStateAdmin.style.display = 'none';
        } else {
            // Para ADMIN mostrar mensaje fijo
            if (emptyStateAdmin) emptyStateAdmin.style.display = 'flex';
        }

        return;
    }

    // Obtener plantas únicas
    const todasPlantas = [...new Set(currentLots.map(l => l.PLANTA || l.nombre_planta).filter(Boolean))];

    // Filtrar por coincidencias
    const plantasFiltradas = todasPlantas.filter(planta =>
        planta.toLowerCase().includes(query)
    ).sort();

    // Mostrar sugerencias
    if (plantasFiltradas.length > 0) {
        suggestions.innerHTML = plantasFiltradas.map(planta =>
            `<li onclick="selectPlantaFromSuggestion('${planta}')">${planta}</li>`
        ).join('');
        suggestions.classList.remove('hidden');
    } else {
        suggestions.innerHTML = '<li style="color: #94a3b8; cursor: default;">No se encontraron plantas</li>';
        suggestions.classList.remove('hidden');
    }
}

/**
 * Muestra todas las sugerencias de plantas al hacer focus
 */
function showPlantaSuggestions() {
    const input = document.getElementById('plantaFilterInput');
    const suggestions = document.getElementById('plantaSuggestions');

    if (!input || !suggestions) return;

    // Validar que currentLots esté disponible
    if (typeof currentLots === 'undefined' || !currentLots || currentLots.length === 0) {
        return;
    }

    // Solo mostrar sugerencias si hay texto en el input
    const query = input.value.trim();
    if (query) {
        handlePlantaFilterSearch();
    }
}

/**
 * Selecciona una planta desde las sugerencias
 */
function selectPlantaFromSuggestion(planta) {
    const input = document.getElementById('plantaFilterInput');
    const suggestions = document.getElementById('plantaSuggestions');

    if (input) input.value = planta;
    if (suggestions) {
        suggestions.classList.add('hidden');
        suggestions.innerHTML = '';
    }

    // Renderizar tarjetas filtradas
    renderLotesCards(planta);
}

// Cerrar sugerencias al hacer click fuera
document.addEventListener('click', function (e) {
    const suggestions = document.getElementById('plantaSuggestions');
    const input = document.getElementById('plantaFilterInput');

    if (suggestions && input && !input.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.classList.add('hidden');
    }
});

// Exponer funciones globalmente
window.handlePlantaFilterSearch = handlePlantaFilterSearch;
window.showPlantaSuggestions = showPlantaSuggestions;
window.selectPlantaFromSuggestion = selectPlantaFromSuggestion;

/**
 * Cambia entre vista de búsqueda y vista de tarjetas
 * @param {string} view - 'search' o 'cards'
 */
function switchLoteView(view) {
    const searchView = document.getElementById('searchView');
    const cardsView = document.getElementById('cardsView');
    const emptyState = document.getElementById('emptyStateMessage');
    const buttons = document.querySelectorAll('.view-toggle-btn');
    const emptyStateAdmin = document.getElementById('emptyStateMessageAdmin');

    // Actualizar botones activos
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'search') {
        // Mostrar búsqueda
        searchView.style.display = 'block';
        cardsView.style.display = 'none';

        // Solo mostrar mensaje vacío si el input está vacío
        const loteInput = DOM.loteInput();
        if (loteInput && loteInput.value.trim()) {
            emptyState.classList.add('hidden');
            // Si hay un lote seleccionado, mostrar sus secciones de nuevo
            DOM.detailsSection().classList.remove('hidden');
            // Restaurar la sección de acción que estaba activa
            const prevAccion = cardsView?.dataset?.prevAccion || '';
            if (prevAccion) {
                toggleActionSections(prevAccion);
            }
        } else {
            emptyState.classList.remove('hidden');
        }

        // Hacer focus en el input de búsqueda de lote
        setTimeout(() => {
            if (loteInput) loteInput.focus();
        }, 100);
    } else {
        // Mostrar tarjetas — ocultar formularios sin limpiarlos
        searchView.style.display = 'none';
        cardsView.style.display = 'block';
        emptyState.classList.add('hidden');

        // Guardar qué acción estaba activa para restaurarla al volver
        const accionActiva = DOM.accionesSelect()?.value || '';
        cardsView.dataset.prevAccion = accionActiva;

        // Ocultar secciones sin limpiar campos
        DOM.detailsSection().classList.add('hidden');
        DOM.novedadesSection().classList.add('hidden');
        DOM.calidadSection().classList.add('hidden');
        DOM.actualizarDatosSection().classList.add('hidden');
        DOM.ruteroSection()?.classList.add('hidden');

        // Mostrar/ocultar mensajes según el rol
        const isGuest = currentUser && currentUser.ROL === 'GUEST';

        if (isGuest) {
            // GUEST: ocultar mensaje de ADMIN
            if (emptyStateAdmin) emptyStateAdmin.style.display = 'none';
            // Renderizar sus lotes directamente
            renderLotesCards();
        } else {
            // ADMIN y otros: mostrar mensaje fijo
            if (emptyStateAdmin) emptyStateAdmin.style.display = 'flex';

            // Limpiar tarjetas
            const container = document.getElementById('lotesCards');
            if (container) container.innerHTML = '';

            // Hacer focus en el input de filtro de planta para ADMIN
            setTimeout(() => {
                const plantaInput = document.getElementById('plantaFilterInput');
                if (plantaInput) plantaInput.focus();
            }, 100);
        }
    }
}

/**
 * Renderiza las tarjetas de lotes para el GUEST o filtradas por planta
 * @param {string} plantaFilter - Nombre de la planta para filtrar (opcional)
 */
function renderLotesCards(plantaFilter = null) {
    const container = document.getElementById('lotesCards');
    if (!container) return;

    // Validar que currentLots esté disponible
    if (typeof currentLots === 'undefined' || !currentLots) {
        container.innerHTML = '';
        return;
    }

    // Obtener lotes (ya filtrados por planta para GUEST en api.js)
    let lotesToShow = currentLots || [];

    // Si hay filtro de planta (para ADMIN), aplicarlo
    if (plantaFilter) {
        lotesToShow = currentLots.filter(lote => {
            const lotePlanta = lote.PLANTA || lote.nombre_planta || '';
            return lotePlanta.trim().toUpperCase() === plantaFilter.trim().toUpperCase();
        });
    }

    // Referencias a los mensajes
    const emptyStateAdmin = document.getElementById('emptyStateMessageAdmin');
    const isGuest = currentUser && currentUser.ROL === 'GUEST';

    if (lotesToShow.length === 0) {
        // Limpiar el contenedor de tarjetas
        container.innerHTML = '';

        // Solo mostrar mensaje si NO hay filtro de planta activo
        if (!plantaFilter) {
            if (isGuest) {
                if (emptyStateAdmin) emptyStateAdmin.style.display = 'none';
            } else {
                // Para ADMIN: mostrar mensaje fijo
                if (emptyStateAdmin) emptyStateAdmin.style.display = 'flex';
            }
        } else {
            // Si hay filtro pero no hay resultados, ocultar mensajes
            if (emptyStateAdmin) emptyStateAdmin.style.display = 'none';
        }
        return;
    }

    // Si hay tarjetas, OCULTAR mensajes
    if (emptyStateAdmin) emptyStateAdmin.style.display = 'none';

    // Actualizar resumen
    updateSummaryPanel(lotesToShow);

    // Generar HTML de tarjetas
    container.innerHTML = lotesToShow.map(lote => {
        const lotNum = lote.LOTE || lote.OP || 'N/A';
        const ref = lote.REFERENCIA || lote.referencia || 'Sin ref';
        const prenda = lote.PRENDA || lote.descripcion || 'Sin especificar';
        const cantidad = lote.CANTIDAD || lote.cantidad || '0';
        const proceso = lote.PROCESO || lote.proceso || 'Sin proceso';
        const salida = lote.SALIDA || lote.fecha_salida || '';
        const salidaFormatted = salida ? formatDate(salida) : 'Sin fecha';

        return `
            <div class="lote-card" onclick="selectLoteFromCard('${lotNum}')">
                <div class="lote-card-header">
                    <div class="lote-card-lote">OP ${lotNum}</div>
                    <div class="lote-card-badge">${proceso}</div>
                </div>
                <div class="lote-card-body">
                    <div class="lote-card-row">
                        <i class="fas fa-tshirt lote-card-icon"></i>
                        <span class="lote-card-label">Prenda:</span>
                        <span class="lote-card-value">${prenda}</span>
                    </div>
                    <div class="lote-card-row">
                        <i class="fas fa-barcode lote-card-icon"></i>
                        <span class="lote-card-label">Referencia:</span>
                        <span class="lote-card-value">${ref}</span>
                    </div>
                    <div class="lote-card-row">
                        <i class="fas fa-hashtag lote-card-icon"></i>
                        <span class="lote-card-label">Cantidad:</span>
                        <span class="lote-card-value">${cantidad}</span>
                    </div>
                </div>
                <div class="lote-card-footer">
                    <div class="lote-card-date">
                        <i class="fas fa-calendar-check"></i>
                        <span>${salidaFormatted}</span>
                    </div>
                    <div class="lote-card-action">
                        <span>Seleccionar</span>
                        <i class="fas fa-arrow-right"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Actualiza el panel de resumen con totales de OPs y unidades
 * @param {Array} lotes - Array de lotes a resumir
 */
function updateSummaryPanel(lotes) {
    const summaryPanel = document.getElementById('summaryPanel');
    const totalOPs = document.getElementById('totalOPs');
    const totalUnidades = document.getElementById('totalUnidades');

    if (!summaryPanel || !totalOPs || !totalUnidades) return;

    // Si no hay lotes, ocultar el panel
    if (!lotes || lotes.length === 0) {
        summaryPanel.classList.add('hidden');
        return;
    }

    // Mostrar el panel
    summaryPanel.classList.remove('hidden');

    // Calcular total de OPs
    totalOPs.textContent = lotes.length;

    // Calcular total de unidades
    const sumaUnidades = lotes.reduce((sum, lote) => {
        const cantidad = parseInt(lote.CANTIDAD || lote.cantidad || 0);
        return sum + cantidad;
    }, 0);

    totalUnidades.textContent = sumaUnidades.toLocaleString();
}

/**
 * Selecciona un lote desde una tarjeta
 * @param {string} loteNum - Número de lote a seleccionar
 */
function selectLoteFromCard(loteNum) {
    // Buscar el lote en currentLots
    const lot = currentLots.find(l => {
        const lotId = l.LOTE || l.OP || '';
        return String(lotId).trim() === String(loteNum).trim();
    });

    if (!lot) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Lote no encontrado',
            timer: 2000
        });
        return;
    }

    // Llenar el input de búsqueda
    DOM.loteInput().value = loteNum;

    // Ocultar emptyStateMessage ya que hay contenido
    hideEmptyState();

    // Llenar detalles del lote
    fillLotDetails(lot);

    // Verificar registro de planta
    verificarRegistroPlanta(lot.PLANTA);

    // Si es GUEST, activar automáticamente NOVEDADES
    if (currentUser && currentUser.ROL === 'GUEST') {
        setTimeout(() => {
            DOM.accionesSelect().value = 'NOVEDADES';
            toggleActionSections('NOVEDADES');
        }, 100);
    }

    // Cambiar a vista de búsqueda para mostrar el formulario
    switchLoteView('search');

    // Scroll suave al formulario
    setTimeout(() => {
        const novedadesSection = document.getElementById('novedadesSection');
        if (novedadesSection && !novedadesSection.classList.contains('hidden')) {
            novedadesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            const detailsSection = DOM.detailsSection();
            if (detailsSection && !detailsSection.classList.contains('hidden')) {
                detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, 200);
}

// Exponer funciones globalmente
window.switchLoteView = switchLoteView;
window.selectLoteFromCard = selectLoteFromCard;

/* ── Auto-resize textarea ── */
function _autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// Aplicar auto-resize a los textareas de la app al escribir
document.addEventListener('DOMContentLoaded', () => {
    ['observacionesNovedad', 'observacionesCalidad'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.overflow = 'hidden';
            el.style.resize = 'none';
            el.addEventListener('input', () => _autoResizeTextarea(el));
        }
    });
});


// Exponer función globalmente
window.toggleWelcomeCollapse = () => { };
