/**
 * auditorias.js — Módulo para ver auditorías con modal
 * Solo disponible para roles: ADMIN, MODERATOR, USER-I
 * Modo de consulta: búsqueda bajo demanda por OP (no precarga)
 */

let gsReportes = [];
let gsFilteredReportes = [];

const auditorNameByEmail = new Map();
let gsTableReportes = [];
let tableSearchTerm = '';
let tableCurrentPage = 1;
const TABLE_PAGE_SIZE = 20;

// OP actualmente consultada
let currentSearchOP = '';

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

    // Normalizar estado: api.js convierte todo a string, manejar "false" string y false boolean
    const estadoRaw = r.estado || r.ESTADO;
    if (estadoRaw === false || estadoRaw === 'false' || estadoRaw === 'FALSE') {
        r._estado = false;
    } else {
        r._estado = true;
    }
}

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
    initFiltersUI();
    mostrarEstadoBusqueda();

    // Ocultar loader, mostrar contenido vacío listo para buscar
    const loader = document.getElementById('loaderOverlay');
    const dataSection = document.getElementById('dashboardContent');
    if (loader) loader.style.display = 'none';
    if (dataSection) dataSection.style.display = 'block';

    // Soportar entrada con Enter en el input de OP
    const inputOP = document.getElementById('searchOP');
    if (inputOP) {
        inputOP.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') window.buscarPorOP();
        });
    }
};

// ─── Búsqueda bajo demanda por OP ────────────────────────────────────────────

/**
 * Ejecuta la búsqueda de reportes por OP ingresada en el input #searchOP.
 */
window.buscarPorOP = async function () {
    const inputOP = document.getElementById('searchOP');
    const lote = inputOP ? inputOP.value.trim() : '';

    if (!lote) {
        Swal.fire({
            icon: 'warning',
            title: 'Ingresa una OP',
            text: 'Escribe el número de OP ó Lote que deseas consultar.',
            confirmButtonColor: '#3f51b5'
        });
        return;
    }

    mostrarLoadingBusqueda(lote);

    try {
        const resultados = await fetchReportesByLote(lote);
        currentSearchOP = lote;
        gsReportes = resultados;
        gsReportes.forEach(enrichReporteRecord);
        gsReportes.sort((a, b) => b._date - a._date);
        gsFilteredReportes = [...gsReportes];

        // Poblar filtros secundarios con los datos obtenidos
        populateSecondaryFilters();

        ocultarLoadingBusqueda();

        if (gsReportes.length === 0) {
            mostrarEstadoSinResultados(lote);
        } else {
            mostrarContenedoresConsulta();
            actualizarHeaderResultados(lote, gsReportes.length);
            window.applyFilters();
        }

    } catch (error) {
        ocultarLoadingBusqueda();
        Swal.fire({
            icon: 'error',
            title: 'Error al consultar',
            text: error.message,
            confirmButtonColor: '#3f51b5'
        });
    }
};

/**
 * Reinicia la búsqueda: limpia resultados y vuelve al estado inicial.
 */
window.limpiarBusqueda = function () {
    const inputOP = document.getElementById('searchOP');
    if (inputOP) inputOP.value = '';
    currentSearchOP = '';
    gsReportes = [];
    gsFilteredReportes = [];
    gsTableReportes = [];
    tableSearchTerm = '';
    tableCurrentPage = 1;
    populateSecondaryFilters();
    ocultarContenedoresConsulta();
    mostrarEstadoBusqueda();
    const tbody = document.getElementById('tableBody');
    if (tbody) tbody.innerHTML = '';
    const emptyState = document.getElementById('tableEmpty');
    if (emptyState) emptyState.style.display = 'none';
    const pagination = document.getElementById('tablePagination');
    if (pagination) pagination.style.display = 'none';
    const meta = document.getElementById('tableResultsMeta');
    if (meta) meta.textContent = '';
    const resultsHeader = document.getElementById('resultsHeader');
    if (resultsHeader) resultsHeader.style.display = 'none';
};

// ─── UI helpers de búsqueda ───────────────────────────────────────────────────

function mostrarContenedoresConsulta() {
    const secFilters = document.getElementById('secondaryFiltersContainer');
    if (secFilters) secFilters.style.display = 'flex';
    const reportsCard = document.getElementById('reportsCard');
    if (reportsCard) reportsCard.style.display = 'block';
}

function ocultarContenedoresConsulta() {
    const secFilters = document.getElementById('secondaryFiltersContainer');
    if (secFilters) secFilters.style.display = 'none';
    const reportsCard = document.getElementById('reportsCard');
    if (reportsCard) reportsCard.style.display = 'none';
    const resultsHeader = document.getElementById('resultsHeader');
    if (resultsHeader) resultsHeader.style.display = 'none';
}

function mostrarLoadingBusqueda(lote) {
    ocultarContenedoresConsulta();
    const searchStateBox = document.getElementById('searchStateBox');
    if (searchStateBox) {
        searchStateBox.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: #64748b;">
                <div style="display:inline-block; width:40px; height:40px; border:3px solid #e2e8f0; border-top-color:#3f51b5; border-radius:50%; animation:spin 0.8s linear infinite; margin-bottom:16px;"></div>
                <div style="font-weight:700; color:#1e293b; font-size:1rem;">Consultando OP <span style="color:#3f51b5; font-family:monospace;">${lote}</span>...</div>
                <div style="font-size:0.82rem; margin-top:6px;">Buscando todos los reportes de esta orden de producción</div>
            </div>
        `;
        searchStateBox.style.display = 'block';
    }
    const tbody = document.getElementById('tableBody');
    if (tbody) tbody.innerHTML = '';
    const emptyState = document.getElementById('tableEmpty');
    if (emptyState) emptyState.style.display = 'none';
    const resultsHeader = document.getElementById('resultsHeader');
    if (resultsHeader) resultsHeader.style.display = 'none';
    // deshabilitar botón mientras carga
    const btn = document.getElementById('btnBuscarOP');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
}

function ocultarLoadingBusqueda() {
    const searchStateBox = document.getElementById('searchStateBox');
    if (searchStateBox) searchStateBox.style.display = 'none';
    const btn = document.getElementById('btnBuscarOP');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Buscar'; }
}

function mostrarEstadoBusqueda() {
    ocultarContenedoresConsulta();
    const searchStateBox = document.getElementById('searchStateBox');
    if (searchStateBox) {
        searchStateBox.innerHTML = `
            <div style="text-align:center; padding: 50px 20px; color:#94a3b8;">
                <i class="fas fa-search" style="font-size:3rem; margin-bottom:16px; opacity:0.35; display:block;"></i>
                <div style="font-weight:700; color:#64748b; font-size:1rem; margin-bottom:6px;">Consulta por OP</div>
                <div style="font-size:0.85rem;">Ingresa un número de OP ó Lote y presiona <strong>Buscar</strong> para ver todos sus reportes.</div>
            </div>
        `;
        searchStateBox.style.display = 'block';
    }
}

function mostrarEstadoSinResultados(lote) {
    ocultarContenedoresConsulta();
    const searchStateBox = document.getElementById('searchStateBox');
    if (searchStateBox) {
        searchStateBox.innerHTML = `
            <div style="text-align:center; padding: 50px 20px; color:#94a3b8;">
                <i class="fas fa-folder-open" style="font-size:3rem; margin-bottom:16px; opacity:0.35; display:block;"></i>
                <div style="font-weight:700; color:#64748b; font-size:1rem; margin-bottom:6px;">Sin resultados para <span style="color:#3f51b5; font-family:monospace;">${lote}</span></div>
                <div style="font-size:0.85rem;">No se encontraron reportes de auditoría para esta OP. Verifica el número e intenta de nuevo.</div>
            </div>
        `;
        searchStateBox.style.display = 'block';
    }
}

function actualizarHeaderResultados(lote, total) {
    const searchStateBox = document.getElementById('searchStateBox');
    if (searchStateBox) searchStateBox.style.display = 'none';
    const resultsHeader = document.getElementById('resultsHeader');
    if (resultsHeader) {
        resultsHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <i class="fas fa-check-circle" style="color:#10b981; font-size:1.1rem;"></i>
                <span>OP consultada: <strong style="font-family:monospace; color:#3f51b5; font-size:1rem;">${lote}</strong></span>
                <span class="badge" style="background:rgba(63,81,181,0.1); color:#3f51b5; padding:3px 10px; border-radius:12px; font-size:0.78rem; font-weight:700;">${total} reporte${total === 1 ? '' : 's'}</span>
            </div>
        `;
        resultsHeader.style.display = 'flex';
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

/**
 * Inicializa los selects de filtros secundarios.
 * Se llama una vez al cargar la página.
 */
function initFiltersUI() {
    // Productora: visible solo para ADMIN/MODERATOR
    const containerProd = document.getElementById('filterProductoraContainer');
    const user = window.currentUser;
    const isAdminOrMod = user && ['ADMIN', 'MODERATOR'].includes(user.ROL);
    if (containerProd) containerProd.style.display = isAdminOrMod ? 'block' : 'none';

    ocultarContenedoresConsulta();
}

/**
 * Actualiza los selects de Auditor, Productora, Tipo de Visita y Estado
 * estrictamente con los datos de la OP consultada.
 */
function populateSecondaryFilters() {
    // 1. Auditor
    const selectAuditor = document.getElementById('filterAuditor');
    if (selectAuditor) {
        const auditores = [...new Set(gsReportes.map(r => r._auditorName))].filter(Boolean).sort();
        selectAuditor.innerHTML = '<option value="">Todos los auditores</option>';
        auditores.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a; opt.textContent = a;
            selectAuditor.appendChild(opt);
        });
    }

    // 2. Productora (solo ADMIN/MODERATOR)
    const user = window.currentUser;
    const isAdminOrMod = user && ['ADMIN', 'MODERATOR'].includes(user.ROL);
    const selectProd = document.getElementById('filterProductora');
    if (selectProd && isAdminOrMod) {
        const productoras = [...new Set(gsReportes.map(r => r._productora))].filter(Boolean).sort();
        selectProd.innerHTML = '<option value="">Todas las productoras</option>';
        productoras.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            selectProd.appendChild(opt);
        });
    }

    // 3. Tipo de Visita (dinámico según la consulta)
    const selectTipo = document.getElementById('filterTipo');
    if (selectTipo) {
        const tipos = [...new Set(gsReportes.map(r => r._tipo))].filter(Boolean).sort();
        selectTipo.innerHTML = '<option value="">Todos los tipos</option>';
        tipos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t.charAt(0) + t.slice(1).toLowerCase();
            selectTipo.appendChild(opt);
        });
    }

    // 4. Estado / Conclusión (dinámico según la consulta)
    const selectEstado = document.getElementById('filterEstado');
    if (selectEstado) {
        const estados = [...new Set(gsReportes.map(r => r._conclusion))].filter(Boolean).sort();
        selectEstado.innerHTML = '<option value="">Todos los estados</option>';
        estados.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e;
            opt.textContent = e.charAt(0) + e.slice(1).toLowerCase();
            selectEstado.appendChild(opt);
        });
    }
}

async function recargarDatos() {
    if (currentSearchOP) {
        await window.buscarPorOP();
    }
}
window.recargarDatos = recargarDatos;

// initDateRangePicker eliminado — el módulo ahora es búsqueda por OP bajo demanda

window.applyFilters = function () {
    // Si no se ha hecho ninguna búsqueda, no hay nada que filtrar
    if (!currentSearchOP) return;

    const prod = (document.getElementById('filterProductora') && document.getElementById('filterProductora').value) || '';
    const aud = (document.getElementById('filterAuditor') && document.getElementById('filterAuditor').value) || '';
    const tipo = (document.getElementById('filterTipo') && document.getElementById('filterTipo').value) || '';
    const estado = (document.getElementById('filterEstado') && document.getElementById('filterEstado').value) || '';

    gsFilteredReportes = gsReportes.filter(r => {
        const okProd = !prod || r._productora === prod;
        const okAud = !aud || r._auditorName === aud;
        const okTipo = !tipo || r._tipo === tipo;
        const okEstado = !estado || (String(r._conclusion || '').toUpperCase() === String(estado || '').toUpperCase());
        return okProd && okAud && okTipo && okEstado;
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

// Función de impresión desde la tabla - usa el índice directo
window.imprimirReporteDesdeTabla = async function (index) {
    const rep = gsTableReportes[index];
    if (!rep) {
        return;
    }

    // Función para formatear fecha en español con día y hora
    const formatearFechaCompleta = (fechaStr) => {
        if (!fechaStr) return '';
        try {
            const fecha = new Date(fechaStr);
            if (isNaN(fecha.getTime())) return fechaStr;

            const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

            const diaSemana = dias[fecha.getDay()];
            const dia = fecha.getDate();
            const mes = meses[fecha.getMonth()];
            const año = fecha.getFullYear();

            let horas = fecha.getHours();
            const minutos = fecha.getMinutes().toString().padStart(2, '0');
            const segundos = fecha.getSeconds().toString().padStart(2, '0');
            const ampm = horas >= 12 ? 'p.m.' : 'a.m.';
            horas = horas % 12;
            horas = horas ? horas : 12;

            return `${diaSemana}, ${dia} de ${mes} del ${año} ${horas}:${minutos}:${segundos} ${ampm}`;
        } catch (e) {
            return fechaStr;
        }
    };

    // Extraer datos del reporte
    const reporteData = {
        id_reporte: rep.id_reporte || rep.ID_REPORTE || '',
        lote: rep.id || rep.ID || rep.lote || rep.LOTE || '',
        referencia: rep.referencia || rep.REFERENCIA || '',
        fecha: rep.fecha || rep.FECHA || rep._date ? formatFechaTabla(rep._date) : '',
        fecha_completa: rep.fecha || rep.FECHA || rep._date ? formatearFechaCompleta(rep.fecha || rep.FECHA || rep._date) : '',
        planta: rep.planta || rep.PLANTA || rep._planta || '',
        auditor: rep._auditorName || rep.auditor || rep.AUDITOR || '',
        linea: rep.linea || rep.LINEA || '',
        tipo_visita: rep.tipo || rep.TIPO || rep._tipo || '',
        genero: rep.genero || rep.GENERO || '',
        salida: rep.salida || rep.SALIDA || '',
        entrada: rep.entrada || rep.ENTRADA || '',
        productora: rep._productora || '',
        conclusion: rep.conclusion || rep.CONCLUSION || rep._conclusion || '',
        observaciones: rep.observaciones || rep.OBSERVACIONES || '',
        proceso: rep.proceso || rep.PROCESO || '',
        destino_proceso: rep.destino || rep.DESTINO || '',
        destino_planta: rep.destino_planta || rep.DESTINO_PLANTA || '',
        cantidad: rep.cantidad || rep.CANTIDAD || rep._cantidad || '',
        prenda: rep.prenda || rep.PRENDA || '',
        firma_planta: rep.firma_svg || rep.FIRMA_SVG || ''
    };

    // Obtener firma del auditor usando la API de Supabase (igual que la plantilla de calidad)
    let firma_auditor = '';
    try {
        const email = rep.email || rep.EMAIL || '';
        if (email) {
            const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";
            const response = await fetch("https://zpikjjcbievfpzegupmw.supabase.co/functions/v1/operations", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ accion: 'RESOLVER_USUARIOS_LOGIN' })
            });
            if (response.ok) {
                const result = await response.json();
                const users = result.users || [];
                const foundUser = users.find(u => String(u.CORREO || '').toLowerCase() === String(email).toLowerCase());
                if (foundUser && foundUser.FIRMA_SVG) {
                    firma_auditor = foundUser.FIRMA_SVG;
                }
            }
        }
    } catch (e) {
        console.error('Error al obtener firma del auditor via API:', e);
    }

    // Obtener novedades
    let novedadesHTML = '';
    if (rep.novedades_auditoria || rep.novedades || rep.NOVEDADES || rep.NOVEDADES_AUDITORIA) {
        const novedades = rep.novedades_auditoria || rep.novedades || rep.NOVEDADES || rep.NOVEDADES_AUDITORIA;

        // Render novedades similar a modal logic
        if (Array.isArray(novedades) && novedades.length > 0) {
            novedadesHTML = renderNovedadesForPrint(novedades);
        } else if (typeof novedades === 'string') {
            // Intentar parsear si es string
            try {
                const parsed = JSON.parse(novedades);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    novedadesHTML = renderNovedadesForPrint(parsed);
                }
            } catch (e) {
                console.error('No se pudo parsear novedades como JSON:', e);
            }
        }
    }

    // Llamar a la función de impresión con el tipo de visita
    imprimirReporteConTipoVisita(reporteData, novedadesHTML, firma_auditor);
};

// Función para renderizar novedades para impresión
function renderNovedadesForPrint(novedades) {
    if (!novedades || novedades.length === 0) return '';

    let html = '';
    novedades.forEach(novedad => {
        const tipo = novedad.tipo || novedad.TIPO || 'GENERAL';
        const displayTipo = tipo.charAt(0) + tipo.slice(1).toLowerCase();
        let bgColor = '#64748b';
        let iconName = 'fa-exclamation-triangle';

        if (tipo === 'COSTURA') { bgColor = '#dc2626'; iconName = 'fa-cut'; }
        else if (tipo === 'ACABADOS') { bgColor = '#f59e0b'; iconName = 'fa-check-circle'; }
        else if (tipo === 'LAVADO') { bgColor = '#6366f1'; iconName = 'fa-water'; }
        else if (tipo === 'SIN CONFECCIONAR') { bgColor = '#ef4444'; iconName = 'fa-cut'; }
        else if (tipo === 'PROMOCIONES') { bgColor = '#f59e0b'; iconName = 'fa-percentage'; }
        else if (tipo === 'COBROS' || tipo.startsWith('COBRO -')) {
            if (novedad.proceso) {
                bgColor = '#8b5cf6'; // Purple for Cobros con proceso
                iconName = 'fa-money-bill-wave';
            } else {
                bgColor = '#10b981'; // Green for Cobros normal
                iconName = 'fa-file-invoice-dollar';
            }
        }

        // Manejar estructura con codigos (como en el ejemplo del usuario)
        const codigos = novedad.codigos || novedad.CODIGOS || [];
        const items = novedad.items || novedad.ITEMS || codigos;

        const totalUnidades = items.reduce((sum, item) => sum + (item.cantidad || item.CANTIDAD || 0), 0);

        html += `
            <div class="group-wrapper">
                <div class="group-header" style="background-color: ${bgColor};">
                    <div><i class="fas ${iconName}"></i> ${displayTipo}</div>
                    <div>${totalUnidades} UNDS.</div>
                </div>
                <table class="nov-table">
                    <thead>
                        <tr>
                            <th>${codigos.length > 0 ? 'Talla' : 'Defecto'}</th>
                            <th>${codigos.length > 0 ? 'Color' : 'Descripción'}</th>
                            <th class="text-right">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => {
            if (codigos.length > 0) {
                // Estructura con codigos (talla, color, cantidad)
                return `
                                    <tr>
                                        <td>${item.talla || item.TALLA || ''}</td>
                                        <td>${item.color || item.COLOR || ''}</td>
                                        <td class="text-right">${item.cantidad || item.CANTIDAD || 0}</td>
                                    </tr>
                                `;
            } else {
                // Estructura con items (defecto, descripcion, cantidad)
                return `
                                    <tr>
                                        <td>${item.defecto || item.DEFECTO || ''}</td>
                                        <td>${item.descripcion || item.DESCRIPCION || ''}</td>
                                        <td class="text-right">${item.cantidad || item.CANTIDAD || 0}</td>
                                    </tr>
                                `;
            }
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });

    return html;
}

// Función de impresión con tipo de visita dinámico
window.imprimirReporteConTipoVisita = function (reporteData, novedadesHTML, firmaAuditor = '') {
    // Función helper para verificar si un campo tiene datos
    const hasData = (value) => value && value.trim() !== '' && value !== 'No hay evidencia' && value !== 'Sin geolocalización';

    // Generar título dinámico basado en tipo de visita
    const tipoVisita = reporteData.tipo_visita || '';
    let tituloImpresion = 'REPORTE DE CALIDAD';

    if (tipoVisita) {
        const tipoUpper = tipoVisita.toUpperCase();
        if (tipoUpper.includes('RONDA')) {
            tituloImpresion = 'RONDA DE CALIDAD';
        } else if (tipoUpper.includes('AUDITORIA')) {
            tituloImpresion = 'AUDITORÍA DE CALIDAD';
        } else if (tipoUpper.includes('CONTRAMUESTRA')) {
            tituloImpresion = 'CONTRAMUESTRA DE CALIDAD';
        } else if (tipoUpper.includes('APROBACION') || tipoUpper.includes('APROBACIÓN')) {
            tituloImpresion = 'APROBACIÓN DE CALIDAD';
        } else if (tipoUpper.includes('SEGUIMIENTO')) {
            tituloImpresion = 'SEGUIMIENTO DE CALIDAD';
        } else {
            tituloImpresion = `${tipoVisita.toUpperCase()} DE CALIDAD`;
        }
    }

    // Generar HTML basado en plantilla de calidad
    let sectionsHTML = '';

    // Sección: Información General
    const generalFields = [
        { label: 'ID REPORTE', value: reporteData.id_reporte },
        { label: 'LOTE / OP', value: reporteData.lote },
        { label: 'REFERENCIA', value: reporteData.referencia },
        { label: 'FECHA', value: reporteData.fecha },
        { label: 'PLANTA', value: reporteData.planta },
        { label: 'AUDITOR', value: reporteData.auditor }
    ];

    const generalFieldsWithData = generalFields.filter(f => hasData(f.value));
    if (generalFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-info-circle"></i> Información General
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${generalFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Detalles de Visita
    const visitaFields = [
        { label: 'LÍNEA', value: reporteData.linea },
        { label: 'TIPO VISITA', value: reporteData.tipo_visita },
        { label: 'GÉNERO', value: reporteData.genero }
    ];

    const visitaFieldsWithData = visitaFields.filter(f => hasData(f.value));
    if (visitaFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-clipboard-check"></i> Detalles de Visita
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${visitaFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Fechas y Productora
    const fechasFields = [
        { label: 'SALIDA', value: reporteData.salida },
        { label: 'ENTREGA', value: reporteData.entrada },
        { label: 'PRODUCTORA', value: reporteData.productora }
    ];

    const fechasFieldsWithData = fechasFields.filter(f => hasData(f.value));
    if (fechasFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-calendar-alt"></i> Fechas y Productora
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${fechasFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Observaciones
    if (hasData(reporteData.observaciones)) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-comment-alt"></i> Observaciones Generales
                </div>
                <div class="section-content">
                    <div class="obs-box">${reporteData.observaciones}</div>
                </div>
            </div>
        `;
    }

    // Sección: Conclusión y Proceso
    const procesoFields = [
        { label: 'CONCLUSIÓN', value: reporteData.conclusion },
        { label: 'PROCESO', value: reporteData.proceso },
        { label: 'PRENDA', value: reporteData.prenda }
    ];

    const procesoFieldsWithData = procesoFields.filter(f => hasData(f.value));
    if (procesoFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-cogs"></i> Conclusión y Proceso
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${procesoFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Destino y Cantidad
    const destinoFields = [
        { label: 'DESTINO PROCESO', value: reporteData.destino_proceso },
        { label: 'DESTINO PLANTA', value: reporteData.destino_planta },
        { label: 'CANTIDAD', value: reporteData.cantidad }
    ];

    const destinoFieldsWithData = destinoFields.filter(f => hasData(f.value));
    if (destinoFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-map-marker-alt"></i> Destino y Cantidad
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${destinoFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Novedades
    if (novedadesHTML && novedadesHTML.trim() !== '' && !novedadesHTML.includes('No se registraron novedades')) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-exclamation-circle"></i> Novedades Auditoría
                </div>
                <div class="section-content">
                    ${novedadesHTML}
                </div>
            </div>
        `;
    }

    // Generar HTML completo basado en plantilla de calidad - versión compacta
    const printHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${tituloImpresion} - Impresión</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --primary: #3F51B5;
            --text-dark: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --bg-light: #f8fafc;
        }

        body {
            font-family: 'Inter', sans-serif;
            color: var(--text-dark);
            margin: 0;
            padding: 5px;
            background: #fff;
            line-height: 1.2;
            font-size: 9px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            position: relative;
        }

        /* Watermark logo en el fondo */
        body::before {
            content: '';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 400px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='99 88 826 842'%3E%3Cdefs%3E%3ClinearGradient id='grad' gradientUnits='userSpaceOnUse' x1='433.52756' y1='929' x2='500' y2='94'%3E%3Cstop offset='0' stop-color='%233f51b5'/%3E%3Cstop offset='1' stop-color='%233f51b5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23grad)' d='M501.29 94.22C502.23 94.18 503.17 94.14 504.11 94.12C610.95 90.39 714.86 129.47 792.76 202.68C874.77 279.04 922.28 385.41 924.41 497.45C927.94 610.9 886.34 721.12 808.73 803.95C735.84 880.85 628.02 926.37 522.38 929.03C415.75 931.76 312.19 893.19 233.33 821.37C147.09 742.19 103.37 637.2 99.56 521.11C97.15 417.07 135.16 308.02 205.34 230.91C285.17 143.21 383.61 99.15 501.29 94.22Z'/%3E%3Cpath fill='url(%23grad)' d='M426.33 154.08C431.45 149.93 470.37 144.28 478.06 144.29C493.6 144.31 511.27 140.43 526.43 142.84L526.05 142.87C528.52 143.6 538.76 143.93 542.62 144.48L542.9 145.34C590.46 150.07 630.89 160.44 674.28 181.54C683.92 182.53 702.83 193.82 710.49 199.47C756.29 225.96 812.88 288.53 836.35 338.09C836.52 338.45 836.62 340.12 836.65 340.55C837.08 341.98 841.18 350.22 842.02 351.99C845.51 359.13 848.7 366.43 851.56 373.84C865.26 409.89 873.53 447.76 876.12 486.24C877.68 507.61 876.43 530.03 873.9 551.29C865.2 628.47 832.97 701.1 781.58 759.34C654.1 906.04 420.5 918.78 275.08 791.32C216.44 740.15 175.56 671.7 158.32 595.81C153.45 573.29 150.3 550.43 148.91 527.43C147.98 513.34 148.62 500.36 149.48 486.32C154.25 409.18 186.54 328.14 237.67 269.84C241.59 264.43 251.37 254.42 256.21 249.54C287.76 217.42 325.27 191.75 366.65 173.98C375.73 170.05 388.39 164.92 397.97 162.32C403.22 159.73 419.84 156.03 426.33 154.08Z'/%3E%3Cpath fill='url(%23grad)' d='M674.28 181.54C683.92 182.53 702.83 193.82 710.49 199.47C756.29 225.96 812.88 288.53 836.35 338.09C836.52 338.45 836.62 340.12 836.65 340.55C835.47 338.85 834.08 336.24 833.07 334.38C826.41 322.04 819.19 310.62 811.06 299.18C790.65 270.64 766.57 244.91 739.44 222.67C734.02 218.27 728.46 214.04 722.77 209.98C720.4 208.31 714.89 204.93 712.99 203.31L712.41 202.82C708.35 200.78 700.78 195.84 696.53 193.35C689.25 189.18 681.83 185.23 674.28 181.54Z'/%3E%3Cpath fill='url(%23grad)' d='M426.33 154.08C431.45 149.93 470.37 144.28 478.06 144.29C493.6 144.31 511.27 140.43 526.43 142.84L526.05 142.87C528.52 143.6 538.76 143.93 542.62 144.48L542.9 145.34C497.25 142.81 470.71 144.81 426.33 154.08Z'/%3E%3Cpath fill='%23ffffff' d='M510.87 287.56C527.52 288.88 525.41 303.77 525.84 316.38C528.13 382.25 623.34 399.94 619.09 467.96C617.74 489.49 608.71 505.94 592.93 520.23C604.6 532.92 603.67 539.23 591.4 550.72C591.81 562.3 591.05 574.53 591.73 586.02C600.19 586.5 609.92 586.3 618.47 586.31C630.02 586.4 641.56 586.31 653.1 586.04C653.82 580.16 653.75 565.84 653.44 559.88C647.17 552.63 646.74 549.39 653.01 542.34C642.17 531.17 635.91 522.68 634.62 506.26C631.52 469.09 670.72 455.69 686.32 428.35C690.95 420.24 689.24 403.06 691.36 393.95C692.41 389.46 696.25 384.77 701.29 385.11C714.3 386 711.67 402.81 713.15 411.8C714.16 419.04 715.9 426.11 720.92 431.77C741.72 455.22 782.51 475.25 773.53 512.71C770.39 525.8 764.82 532.35 755.16 541.29C761.85 548.54 761.98 552.26 755.47 559.41C754.7 567.95 755.03 581.69 755.03 590.51L755.03 645.47C755.03 654.76 755.29 664.18 754.62 673.44C754.28 678.15 750.38 682.18 745.61 682.38C737.49 682.72 729.27 682.55 721.12 682.54L672.32 682.48L514.25 682.48L348.91 682.47L301.32 682.5C293.69 682.51 285.38 682.77 277.8 682.26C274.06 682.01 272.15 678.75 270.07 675.87C269.1 664.49 269.69 649.89 269.56 638.28C269.25 612.39 269.96 586.14 269.51 560.28C267.14 557.17 265.62 555.39 264.04 551.82C265.78 546.92 266.21 546.13 269.62 542.54C258.93 532.49 251.34 523.21 250.02 508.09C246.73 470.66 288.25 455.03 306.15 429.27C313.73 418.35 308.54 398.31 316.05 388.61C317.6 386.78 319.6 385.7 321.91 385.55C333.45 384.78 333.13 398.3 332.88 406.71C332.16 431.12 345.62 440.58 362.21 455.64C375.82 468 390.73 482.69 390.86 502.65C391.01 521.53 383.15 530.76 371.14 543.41C377.71 550.4 376.97 552.81 371.25 559.95C370.8 568.12 371.04 577.96 371.06 586.25C378.09 586.35 429.76 587.2 431.74 585.21C434.47 582.47 433.44 555.82 433.31 550.62L429.86 547.16C419.91 537.21 422.74 529.06 432.01 520.39C420.23 508.05 412.29 497.75 408.42 480.77C393.16 413.94 462.62 396.06 490.08 347.94C495.17 338.89 496.25 328.71 497.34 318.62C498.63 306.63 495.7 291.04 510.87 287.56Z'/%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            opacity: 0.03;
            z-index: 0;
            pointer-events: none;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        @media print {
            body { padding: 0; font-size: 9px; }
            .container { max-width: 100%; width: 100%; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body::before { opacity: 0.05; }
        }

        .header-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid var(--primary);
            padding-bottom: 6px;
            margin-bottom: 10px;
        }

        .header-logo-area {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-logo-area svg {
            width: 32px;
            height: 32px;
        }

        .header-title-area {
            text-align: center;
            flex: 1;
        }

        .header-title-area h1 {
            margin: 0;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: var(--primary);
        }

        .header-title-area p {
            margin: 2px 0 0;
            font-size: 9px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .report-id {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 800;
            color: var(--text-dark);
            margin: 0;
        }

        .report-date {
            font-size: 8px;
            color: var(--text-muted);
            margin: 2px 0 0;
        }

        .section {
            margin-bottom: 8px;
            border: 1px solid var(--border);
            border-radius: 4px;
            overflow: hidden;
        }

        .section-header {
            background: var(--bg-light);
            padding: 4px 8px;
            font-weight: 700;
            font-size: 9px;
            border-bottom: 1px solid var(--border);
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 6px;
            text-transform: uppercase;
        }

        .section-content {
            padding: 6px 8px;
        }

        .data-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }

        .data-grid.grid-3 { grid-template-columns: repeat(3, 1fr); }
        .data-grid.grid-2 { grid-template-columns: repeat(2, 1fr); }

        .data-item {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .data-label {
            font-size: 7px;
            text-transform: uppercase;
            color: var(--text-muted);
            font-weight: 600;
        }

        .data-value {
            font-size: 9px;
            font-weight: 600;
            color: var(--text-dark);
            word-break: break-word;
        }

        .obs-box {
            background: #f1f5f9;
            padding: 8px 10px;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
            border-left: 3px solid var(--primary);
            font-size: 9px;
            font-weight: 500;
            line-height: 1.3;
            white-space: pre-wrap;
            color: var(--text-dark);
        }

        .nov-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }

        .nov-table th, .nov-table td {
            border: 1px solid var(--border);
            padding: 3px 6px;
            text-align: left;
        }

        .nov-table th {
            font-weight: 700;
            color: var(--text-muted);
            background: #f1f5f9;
            text-transform: uppercase;
            font-size: 7px;
        }

        .nov-table td {
            font-weight: 500;
        }

        .nov-table .text-right { text-align: right; }

        .group-header {
            padding: 4px 6px;
            font-weight: 800;
            font-size: 8px;
            color: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 3px 3px 0 0;
        }

        .group-wrapper {
            border-radius: 3px;
            margin-bottom: 6px;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
        }

        .footer-info {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--border);
            text-align: center;
            color: var(--text-muted);
            font-size: 8px;
        }

        /* Firmas */
        .firma-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            height: 120px;
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            padding: 10px;
            background: #f8fafc;
            position: relative;
        }

        .firma-svg {
            max-width: 100%;
            max-height: 80px;
            margin-bottom: 8px;
        }

        .firma-line {
            width: 80%;
            border-top: 1px solid #1e293b;
            margin: 8px 0 4px;
        }

        .firma-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-main">
            <div class="header-logo-area">
                <img src="icons/app.svg" alt="Logo Grupo TDM" style="width: 32px; height: 32px; object-fit: contain;">
            </div>
            <div class="header-title-area">
                <h1>${tituloImpresion}</h1>
                <p>${reporteData.productora}</p>
            </div>
            <div style="text-align: right;">
                <p class="report-id">${reporteData.id_reporte}</p>
                <p class="report-date">${reporteData.fecha_completa}</p>
            </div>
        </div>
        
        ${sectionsHTML}
        
        <!-- Firmas de Conformidad -->
        <div class="section" style="margin-top: 15px;">
            <div class="section-header">
                <i class="fas fa-file-signature"></i> Firmas de Conformidad
            </div>
            <div class="section-content firma-grid">
                <!-- Firma Auditor -->
                <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; border-right: 1px dashed #cbd5e1; padding-right: 15px;">
                    <div style="height: 80px; display: flex; align-items: center; justify-content: center; width: 100%;">
                        ${firmaAuditor ? firmaAuditor.replace(/<svg/g, '<svg class="firma-svg"') : `
                            <div style="border: 2px dashed #22c55e; border-radius: 6px; padding: 6px 12px; background: #f0fdf4; color: #15803d; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="fas fa-certificate" style="margin-right: 4px;"></i> Certificado Digital
                                <div style="font-family: monospace; font-size: 8px; color: #166534; margin-top: 3px; font-weight: 400;">
                                    AUDITOR: ${reporteData.auditor}<br>
                                    REGISTRO: OK-AUTH
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="firma-line"></div>
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-dark); text-transform: uppercase;">${reporteData.auditor}</span>
                    <span style="font-size: 8px; font-weight: 600; color: var(--text-muted);">AUDITOR DE CALIDAD</span>
                </div>

                <!-- Firma Recibido Taller -->
                <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; padding-left: 15px;">
                    <div style="height: 80px; display: flex; align-items: center; justify-content: center; width: 100%;">
                        ${reporteData.firma_planta ? reporteData.firma_planta.replace(/<svg/g, '<svg class="firma-svg"') : '<span style="color:#94a3b8; font-style:italic; font-size: 9px;">Firma Responsable Planta</span>'}
                    </div>
                    <div class="firma-line"></div>
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-dark); text-transform: uppercase;">${reporteData.planta}</span>
                    <span style="font-size: 8px; font-weight: 600; color: var(--text-muted);">RESPONSABLE PLANTA</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Esperar a que cargue y luego imprimir
    printWindow.onload = function () {
        printWindow.print();
    };
};

// Función de impresión rápida - genera HTML simple para impresión basado en plantilla de calidad
window.imprimirReporteRapido = function () {
    const overlay = document.getElementById('simpleModalOverlay');
    if (!overlay) return;

    // Obtener el reporte actual del modal
    const contentClone = overlay.querySelector('.modal-content');
    if (!contentClone) return;

    // Extraer datos del modal
    const getFieldValue = (id) => {
        const el = contentClone.querySelector('#' + id);
        return el ? el.value : '';
    };

    const reporteData = {
        id_reporte: getFieldValue('viewIdReporte'),
        lote: getFieldValue('viewLote'),
        referencia: getFieldValue('viewReferencia'),
        fecha: getFieldValue('viewFecha'),
        planta: getFieldValue('viewPlanta'),
        email: getFieldValue('viewEmail'),
        linea: getFieldValue('viewLinea'),
        tipo_visita: getFieldValue('viewTipoVisita'),
        genero: getFieldValue('viewGenero'),
        salida: getFieldValue('viewSalida'),
        entrada: getFieldValue('viewEntrada'),
        productora: getFieldValue('viewProductora'),
        conclusion: getFieldValue('viewConclusion'),
        observaciones: getFieldValue('viewObservaciones'),
        proceso: getFieldValue('viewProceso'),
        destino_proceso: getFieldValue('viewDestino'),
        destino_planta: getFieldValue('viewDestinoPlanta'),
        cantidad: getFieldValue('viewCantidad'),
        prenda: getFieldValue('viewPrenda')
    };

    // Obtener novedades
    const novedadesContainer = contentClone.querySelector('#viewNovedadesContainer');
    let novedadesHTML = '';
    if (novedadesContainer) {
        novedadesHTML = novedadesContainer.innerHTML;
    }

    // Función helper para verificar si un campo tiene datos
    const hasData = (value) => value && value.trim() !== '' && value !== 'No hay evidencia' && value !== 'Sin geolocalización';

    // Generar HTML basado en plantilla de calidad
    let sectionsHTML = '';

    // Sección: Información General
    const generalFields = [
        { label: 'ID REPORTE', value: reporteData.id_reporte },
        { label: 'LOTE / OP', value: reporteData.lote },
        { label: 'REFERENCIA', value: reporteData.referencia },
        { label: 'FECHA', value: reporteData.fecha },
        { label: 'PLANTA', value: reporteData.planta },
        { label: 'AUDITOR', value: reporteData.auditor }
    ];

    const generalFieldsWithData = generalFields.filter(f => hasData(f.value));
    if (generalFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-info-circle"></i> Información General
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${generalFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Detalles de Visita
    const visitaFields = [
        { label: 'LÍNEA', value: reporteData.linea },
        { label: 'TIPO VISITA', value: reporteData.tipo_visita },
        { label: 'GÉNERO', value: reporteData.genero }
    ];

    const visitaFieldsWithData = visitaFields.filter(f => hasData(f.value));
    if (visitaFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-clipboard-check"></i> Detalles de Visita
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${visitaFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Fechas y Productora
    const fechasFields = [
        { label: 'SALIDA', value: reporteData.salida },
        { label: 'ENTREGA', value: reporteData.entrada },
        { label: 'PRODUCTORA', value: reporteData.productora }
    ];

    const fechasFieldsWithData = fechasFields.filter(f => hasData(f.value));
    if (fechasFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-calendar-alt"></i> Fechas y Productora
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${fechasFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Observaciones
    if (hasData(reporteData.observaciones)) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-comment-alt"></i> Observaciones Generales
                </div>
                <div class="section-content">
                    <div class="obs-box">${reporteData.observaciones}</div>
                </div>
            </div>
        `;
    }

    // Sección: Conclusión y Proceso
    const procesoFields = [
        { label: 'CONCLUSIÓN', value: reporteData.conclusion },
        { label: 'PROCESO', value: reporteData.proceso },
        { label: 'PRENDA', value: reporteData.prenda }
    ];

    const procesoFieldsWithData = procesoFields.filter(f => hasData(f.value));
    if (procesoFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-cogs"></i> Conclusión y Proceso
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${procesoFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Destino y Cantidad
    const destinoFields = [
        { label: 'DESTINO PROCESO', value: reporteData.destino_proceso },
        { label: 'DESTINO PLANTA', value: reporteData.destino_planta },
        { label: 'CANTIDAD', value: reporteData.cantidad }
    ];

    const destinoFieldsWithData = destinoFields.filter(f => hasData(f.value));
    if (destinoFieldsWithData.length > 0) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-map-marker-alt"></i> Destino y Cantidad
                </div>
                <div class="section-content">
                    <div class="data-grid grid-3">
                        ${destinoFieldsWithData.map(f => `
                            <div class="data-item">
                                <div class="data-label">${f.label}</div>
                                <div class="data-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Sección: Novedades
    if (novedadesHTML && novedadesHTML.trim() !== '' && !novedadesHTML.includes('No se registraron novedades')) {
        sectionsHTML += `
            <div class="section">
                <div class="section-header">
                    <i class="fas fa-exclamation-circle"></i> Novedades Auditoría
                </div>
                <div class="section-content">
                    ${novedadesHTML}
                </div>
            </div>
        `;
    }

    // Generar HTML completo basado en plantilla de calidad - versión compacta
    const printHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Calidad - Impresión</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --primary: #3F51B5;
            --text-dark: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --bg-light: #f8fafc;
        }

        body {
            font-family: 'Inter', sans-serif;
            color: var(--text-dark);
            margin: 0;
            padding: 5px;
            background: #fff;
            line-height: 1.2;
            font-size: 9px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            position: relative;
        }

        /* Watermark logo en el fondo */
        body::before {
            content: '';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 400px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='99 88 826 842'%3E%3Cdefs%3E%3ClinearGradient id='grad' gradientUnits='userSpaceOnUse' x1='433.52756' y1='929' x2='500' y2='94'%3E%3Cstop offset='0' stop-color='%233f51b5'/%3E%3Cstop offset='1' stop-color='%233f51b5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23grad)' d='M501.29 94.22C502.23 94.18 503.17 94.14 504.11 94.12C610.95 90.39 714.86 129.47 792.76 202.68C874.77 279.04 922.28 385.41 924.41 497.45C927.94 610.9 886.34 721.12 808.73 803.95C735.84 880.85 628.02 926.37 522.38 929.03C415.75 931.76 312.19 893.19 233.33 821.37C147.09 742.19 103.37 637.2 99.56 521.11C97.15 417.07 135.16 308.02 205.34 230.91C285.17 143.21 383.61 99.15 501.29 94.22Z'/%3E%3Cpath fill='url(%23grad)' d='M426.33 154.08C431.45 149.93 470.37 144.28 478.06 144.29C493.6 144.31 511.27 140.43 526.43 142.84L526.05 142.87C528.52 143.6 538.76 143.93 542.62 144.48L542.9 145.34C590.46 150.07 630.89 160.44 674.28 181.54C683.92 182.53 702.83 193.82 710.49 199.47C756.29 225.96 812.88 288.53 836.35 338.09C836.52 338.45 836.62 340.12 836.65 340.55C837.08 341.98 841.18 350.22 842.02 351.99C845.51 359.13 848.7 366.43 851.56 373.84C865.26 409.89 873.53 447.76 876.12 486.24C877.68 507.61 876.43 530.03 873.9 551.29C865.2 628.47 832.97 701.1 781.58 759.34C654.1 906.04 420.5 918.78 275.08 791.32C216.44 740.15 175.56 671.7 158.32 595.81C153.45 573.29 150.3 550.43 148.91 527.43C147.98 513.34 148.62 500.36 149.48 486.32C154.25 409.18 186.54 328.14 237.67 269.84C241.59 264.43 251.37 254.42 256.21 249.54C287.76 217.42 325.27 191.75 366.65 173.98C375.73 170.05 388.39 164.92 397.97 162.32C403.22 159.73 419.84 156.03 426.33 154.08Z'/%3E%3Cpath fill='url(%23grad)' d='M674.28 181.54C683.92 182.53 702.83 193.82 710.49 199.47C756.29 225.96 812.88 288.53 836.35 338.09C836.52 338.45 836.62 340.12 836.65 340.55C835.47 338.85 834.08 336.24 833.07 334.38C826.41 322.04 819.19 310.62 811.06 299.18C790.65 270.64 766.57 244.91 739.44 222.67C734.02 218.27 728.46 214.04 722.77 209.98C720.4 208.31 714.89 204.93 712.99 203.31L712.41 202.82C708.35 200.78 700.78 195.84 696.53 193.35C689.25 189.18 681.83 185.23 674.28 181.54Z'/%3E%3Cpath fill='url(%23grad)' d='M426.33 154.08C431.45 149.93 470.37 144.28 478.06 144.29C493.6 144.31 511.27 140.43 526.43 142.84L526.05 142.87C528.52 143.6 538.76 143.93 542.62 144.48L542.9 145.34C497.25 142.81 470.71 144.81 426.33 154.08Z'/%3E%3Cpath fill='%23ffffff' d='M510.87 287.56C527.52 288.88 525.41 303.77 525.84 316.38C528.13 382.25 623.34 399.94 619.09 467.96C617.74 489.49 608.71 505.94 592.93 520.23C604.6 532.92 603.67 539.23 591.4 550.72C591.81 562.3 591.05 574.53 591.73 586.02C600.19 586.5 609.92 586.3 618.47 586.31C630.02 586.4 641.56 586.31 653.1 586.04C653.82 580.16 653.75 565.84 653.44 559.88C647.17 552.63 646.74 549.39 653.01 542.34C642.17 531.17 635.91 522.68 634.62 506.26C631.52 469.09 670.72 455.69 686.32 428.35C690.95 420.24 689.24 403.06 691.36 393.95C692.41 389.46 696.25 384.77 701.29 385.11C714.3 386 711.67 402.81 713.15 411.8C714.16 419.04 715.9 426.11 720.92 431.77C741.72 455.22 782.51 475.25 773.53 512.71C770.39 525.8 764.82 532.35 755.16 541.29C761.85 548.54 761.98 552.26 755.47 559.41C754.7 567.95 755.03 581.69 755.03 590.51L755.03 645.47C755.03 654.76 755.29 664.18 754.62 673.44C754.28 678.15 750.38 682.18 745.61 682.38C737.49 682.72 729.27 682.55 721.12 682.54L672.32 682.48L514.25 682.48L348.91 682.47L301.32 682.5C293.69 682.51 285.38 682.77 277.8 682.26C274.06 682.01 272.15 678.75 270.07 675.87C269.1 664.49 269.69 649.89 269.56 638.28C269.25 612.39 269.96 586.14 269.51 560.28C267.14 557.17 265.62 555.39 264.04 551.82C265.78 546.92 266.21 546.13 269.62 542.54C258.93 532.49 251.34 523.21 250.02 508.09C246.73 470.66 288.25 455.03 306.15 429.27C313.73 418.35 308.54 398.31 316.05 388.61C317.6 386.78 319.6 385.7 321.91 385.55C333.45 384.78 333.13 398.3 332.88 406.71C332.16 431.12 345.62 440.58 362.21 455.64C375.82 468 390.73 482.69 390.86 502.65C391.01 521.53 383.15 530.76 371.14 543.41C377.71 550.4 376.97 552.81 371.25 559.95C370.8 568.12 371.04 577.96 371.06 586.25C378.09 586.35 429.76 587.2 431.74 585.21C434.47 582.47 433.44 555.82 433.31 550.62L429.86 547.16C419.91 537.21 422.74 529.06 432.01 520.39C420.23 508.05 412.29 497.75 408.42 480.77C393.16 413.94 462.62 396.06 490.08 347.94C495.17 338.89 496.25 328.71 497.34 318.62C498.63 306.63 495.7 291.04 510.87 287.56Z'/%3E%3C/svg%3E");
            background-size: contain;
            background-repeat: no-repeat;
            opacity: 0.03;
            z-index: 0;
            pointer-events: none;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        @media print {
            body { padding: 0; font-size: 9px; }
            .container { max-width: 100%; width: 100%; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body::before { opacity: 0.05; }
        }

        .header-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid var(--primary);
            padding-bottom: 6px;
            margin-bottom: 10px;
        }

        .header-logo-area {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-logo-area svg {
            width: 32px;
            height: 32px;
        }

        .header-title-area {
            text-align: center;
            flex: 1;
        }

        .header-title-area h1 {
            margin: 0;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: var(--primary);
        }

        .header-title-area p {
            margin: 2px 0 0;
            font-size: 9px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .report-id {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 800;
            color: var(--text-dark);
            margin: 0;
        }

        .report-date {
            font-size: 8px;
            color: var(--text-muted);
            margin: 2px 0 0;
        }

        .section {
            margin-bottom: 8px;
            border: 1px solid var(--border);
            border-radius: 4px;
            overflow: hidden;
        }

        .section-header {
            background: var(--bg-light);
            padding: 4px 8px;
            font-weight: 700;
            font-size: 9px;
            border-bottom: 1px solid var(--border);
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 6px;
            text-transform: uppercase;
        }

        .section-content {
            padding: 6px 8px;
        }

        .data-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }

        .data-grid.grid-3 { grid-template-columns: repeat(3, 1fr); }
        .data-grid.grid-2 { grid-template-columns: repeat(2, 1fr); }

        .data-item {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .data-label {
            font-size: 7px;
            text-transform: uppercase;
            color: var(--text-muted);
            font-weight: 600;
        }

        .data-value {
            font-size: 9px;
            font-weight: 600;
            color: var(--text-dark);
            word-break: break-word;
        }

        .obs-box {
            background: #f1f5f9;
            padding: 8px 10px;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
            border-left: 3px solid var(--primary);
            font-size: 9px;
            font-weight: 500;
            line-height: 1.3;
            white-space: pre-wrap;
            color: var(--text-dark);
        }

        .nov-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
        }

        .nov-table th, .nov-table td {
            border: 1px solid var(--border);
            padding: 3px 6px;
            text-align: left;
        }

        .nov-table th {
            font-weight: 700;
            color: var(--text-muted);
            background: #f1f5f9;
            text-transform: uppercase;
            font-size: 7px;
        }

        .nov-table td {
            font-weight: 500;
        }

        .nov-table .text-right { text-align: right; }

        .group-header {
            padding: 4px 6px;
            font-weight: 800;
            font-size: 8px;
            color: #fff;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 3px 3px 0 0;
        }

        .group-wrapper {
            border-radius: 3px;
            margin-bottom: 6px;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
        }

        .footer-info {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--border);
            text-align: center;
            color: var(--text-muted);
            font-size: 8px;
        }

        /* Firmas */
        .firma-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            height: 120px;
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            padding: 10px;
            background: #f8fafc;
            position: relative;
        }

        .firma-svg {
            max-width: 100%;
            max-height: 80px;
            margin-bottom: 8px;
        }

        .firma-line {
            width: 80%;
            border-top: 1px solid #1e293b;
            margin: 8px 0 4px;
        }

        .firma-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-main">
            <div class="header-logo-area">
                <img src="icons/app.svg" alt="Logo Grupo TDM" style="width: 32px; height: 32px; object-fit: contain;">
            </div>
            <div class="header-title-area">
                <h1>REPORTE DE CALIDAD</h1>
                <p>${reporteData.productora}</p>
            </div>
            <div style="text-align: right;">
                <p class="report-id">${reporteData.id_reporte}</p>
                <p class="report-date">${reporteData.fecha_completa}</p>
            </div>
        </div>
        
        ${sectionsHTML}
        
        <!-- Firmas de Conformidad -->
        <div class="section" style="margin-top: 15px;">
            <div class="section-header">
                <i class="fas fa-file-signature"></i> Firmas de Conformidad
            </div>
            <div class="section-content firma-grid">
                <!-- Firma Auditor -->
                <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; border-right: 1px dashed #cbd5e1; padding-right: 15px;">
                    <div style="height: 80px; display: flex; align-items: center; justify-content: center; width: 100%;">
                        ${firmaAuditor ? firmaAuditor.replace(/<svg/g, '<svg class="firma-svg"') : `
                            <div style="border: 2px dashed #22c55e; border-radius: 6px; padding: 6px 12px; background: #f0fdf4; color: #15803d; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="fas fa-certificate" style="margin-right: 4px;"></i> Certificado Digital
                                <div style="font-family: monospace; font-size: 8px; color: #166534; margin-top: 3px; font-weight: 400;">
                                    AUDITOR: ${reporteData.auditor}<br>
                                    REGISTRO: OK-AUTH
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="firma-line"></div>
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-dark); text-transform: uppercase;">${reporteData.auditor}</span>
                    <span style="font-size: 8px; font-weight: 600; color: var(--text-muted);">AUDITOR DE CALIDAD</span>
                </div>

                <!-- Firma Recibido Taller -->
                <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; padding-left: 15px;">
                    <div style="height: 80px; display: flex; align-items: center; justify-content: center; width: 100%;">
                        ${reporteData.firma_planta ? reporteData.firma_planta.replace(/<svg/g, '<svg class="firma-svg"') : '<span style="color:#94a3b8; font-style:italic; font-size: 9px;">Firma Responsable Planta</span>'}
                    </div>
                    <div class="firma-line"></div>
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-dark); text-transform: uppercase;">${reporteData.planta}</span>
                    <span style="font-size: 8px; font-weight: 600; color: var(--text-muted);">RESPONSABLE PLANTA</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Esperar a que cargue y luego imprimir
    printWindow.onload = function () {
        printWindow.print();
    };
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
                            const totalUnidades = novedad.codigos.reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);

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
                            if (novedad.tipo_base === 'COBROS' || novedad.tipo.startsWith('COBRO -')) {
                                if (novedad.proceso) {
                                    bgColor = '#8b5cf6'; // Purple for Cobros con proceso
                                    iconName = 'fa-money-bill-wave';
                                    displayTipo = novedad.tipo; // Ya viene formateado como "COBRO - PROCESO"
                                } else {
                                    bgColor = '#10b981'; // Green for Cobros normal
                                    iconName = 'fa-file-invoice-dollar';
                                }
                            }
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
            // Add close button functionality
            const closeBtn = overlay.querySelector('.btn-close');
            if (closeBtn) {
                closeBtn.onclick = function () {
                    document.body.removeChild(overlay);
                };
            }

            // Add click outside to close
            overlay.onclick = function (e) {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            };

            document.body.appendChild(overlay);
            console.log('Simple modal overlay created');
        } else {
            console.error('Modal content not found');
        }
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
document.addEventListener('click', function (e) {
    const modalElement = document.getElementById('reporteModal');
    if (modalElement && modalElement.classList.contains('show')) {
        const modalDialog = modalElement.querySelector('.modal-dialog');
        if (modalDialog && !modalDialog.contains(e.target) && e.target !== modalElement) {
            cerrarModalReporte();
        }
    }
});

// Function to open image modal with rotation option
window.openImageModal = function (imageUrl) {
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
    rotateLeftBtn.onmouseover = function () { this.style.background = 'rgba(63, 81, 181, 1)'; };
    rotateLeftBtn.onmouseout = function () { this.style.background = 'rgba(63, 81, 181, 0.9)'; };

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
    rotateRightBtn.onmouseover = function () { this.style.background = 'rgba(63, 81, 181, 1)'; };
    rotateRightBtn.onmouseout = function () { this.style.background = 'rgba(63, 81, 181, 0.9)'; };

    let rotation = 0;

    rotateLeftBtn.onclick = function (e) {
        e.stopPropagation();
        rotation -= 90;
        img.style.transform = `rotate(${rotation}deg)`;
    };

    rotateRightBtn.onclick = function (e) {
        e.stopPropagation();
        rotation += 90;
        img.style.transform = `rotate(${rotation}deg)`;
    };

    controls.appendChild(rotateLeftBtn);
    controls.appendChild(rotateRightBtn);

    container.appendChild(img);
    container.appendChild(controls);
    overlay.appendChild(container);

    overlay.onclick = function (e) {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };

    document.body.appendChild(overlay);
};

// Function to open map modal
window.openMapModal = function (lat, lng) {
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

function renderEstadoCell(conclusion, esAnulado = false) {
    const label = String(conclusion || '—').toUpperCase();
    const c = label.replace(/—/g, '');

    // Si está anulado, mostrar badge gris con opacidad
    if (esAnulado) {
        const badgeStyle = 'background: rgba(100, 116, 139, 0.15); color: #64748b; opacity: 0.7;';
        return `<span class="estado-badge" style="${badgeStyle}">${label}</span>`;
    }

    if (c === 'APROBADO') {
        return `<span class="estado-badge aprobado">${label}</span>`;
    }
    if (c === 'RECHAZADO') {
        return `<span class="estado-badge rechazado">${label}</span>`;
    }
    return label || '—';
}

function renderBotonesEdicion(r, globalIndex) {
    const currentUserRole = window.currentUser?.ROL || '';
    const isAdminOrMod = ['ADMIN', 'MODERATOR'].includes(currentUserRole);

    if (!isAdminOrMod) return '';

    // Validar 24 horas para edición
    const fechaReporte = r.fecha || r.FECHA || '';
    let puedeEditar = false;
    if (fechaReporte) {
        const fechaReporteDate = new Date(fechaReporte);
        const ahora = new Date();
        const horasDiferencia = (ahora - fechaReporteDate) / (1000 * 60 * 60);
        puedeEditar = horasDiferencia <= 24;
    }

    return `
        ${puedeEditar ? `
        <button type="button" class="btn-ver-reporte" onclick="window.editarReporteAnalizado(${globalIndex})" title="Editar reporte" style="margin-right: 4px; background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
            <i class="fas fa-edit"></i>
        </button>
        ` : ''}
        <button type="button" class="btn-ver-reporte" onclick="window.anularReporteAnalizado(${globalIndex})" title="Anular reporte" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
            <i class="fas fa-ban"></i>
        </button>
    `;
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

        // Verificar si el reporte está anulado
        const esAnulado = !r._estado;
        const trStyle = esAnulado ? ' style="background-color: rgba(239, 68, 68, 0.08);"' : '';
        const tdStyle = esAnulado ? ' style="color: #dc2626; opacity: 0.7;"' : '';

        return `
            <tr${trStyle}>
                <td class="cell-date"${tdStyle}>${formatFechaTabla(r._date)}</td>
                <td class="cell-lote"${tdStyle} title="${escAttr(lote)}">${lote}</td>
                <td class="cell-ref"${tdStyle} title="${escAttr(ref)}">${ref}</td>
                <td class="cell-planta"${tdStyle} title="${escAttr(r._planta)}">${r._planta}</td>
                <td class="cell-auditor"${tdStyle} title="${escAttr(r._auditorName)}">${r._auditorName}</td>
                <td class="cell-tipo"${tdStyle}>${r._tipo}</td>
                <td class="cell-qty"${tdStyle}>${cantFmt}</td>
                <td${tdStyle}>${renderEstadoCell(r._conclusion, esAnulado)}</td>
                <td style="text-align:center;">
                    ${esAnulado ? '<span style="color: #dc2626; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">ANULADO</span>' : `
                    <button type="button" class="btn-ver-reporte" onclick="window.verReporteAnalizado(${globalIndex})" title="Ver reporte" style="margin-right: 4px;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn-ver-reporte" onclick="window.imprimirReporteDesdeTabla(${globalIndex})" title="Imprimir reporte" style="margin-right: 4px;">
                        <i class="fas fa-print"></i>
                    </button>
                    ${renderBotonesEdicion(r, globalIndex)}
                    `}
                </td>
            </tr>
        `;
    }).join('');

    renderTablePagination(totalTable, totalPages);
}


// ═══════════════════════════════════════════════════════════════════
// ANULAR Y EDITAR REPORTE
// ═══════════════════════════════════════════════════════════════════

async function anularReporteAnalizado(index) {
    const rep = gsTableReportes[index];
    if (!rep) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró el reporte seleccionado',
            confirmButtonColor: '#3f51b5'
        });
        return;
    }

    // Validar permisos del usuario actual
    const currentUserRole = window.currentUser?.ROL || '';
    if (!['ADMIN', 'MODERATOR'].includes(currentUserRole)) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo ADMIN y MODERATOR pueden anular reportes',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    // Preguntar: ¿Solo anular o anular + crear copia?
    const idReporte = rep.id_reporte || rep.ID_REPORTE || 'N/A';
    const lote = rep.lote || rep.LOTE || rep.id || rep.ID || 'N/A';
    const referencia = rep.referencia || rep.REFERENCIA || '';
    const planta = rep.planta || rep.PLANTA || rep._planta || 'N/A';

    const result = await Swal.fire({
        title: 'Anular Reporte',
        html: `
            <div style="text-align: left; padding: 0 20px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 12px; font-size: 0.95rem;">
                        <i class="fas fa-file-alt" style="color: #3f51b5; margin-right: 6px;"></i> Reporte Seleccionado
                    </div>
                    <div style="font-size: 0.9rem; color: #475569; line-height: 1.6;">
                        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin-bottom: 6px;">
                            <span style="font-weight: 600;">ID Reporte:</span>
                            <span style="font-family: monospace; color: #1e293b;">${idReporte}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin-bottom: 6px;">
                            <span style="font-weight: 600;">Lote:</span>
                            <span style="color: #1e293b;">${lote}</span>
                        </div>
                        ${referencia ? `
                        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; margin-bottom: 6px;">
                            <span style="font-weight: 600;">Referencia:</span>
                            <span style="color: #1e293b;">${referencia}</span>
                        </div>
                        ` : ''}
                        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px;">
                            <span style="font-weight: 600;">Planta:</span>
                            <span style="color: #1e293b;">${planta}</span>
                        </div>
                    </div>
                </div>
                
                <p style="margin-bottom: 16px; color: #475569; font-size: 0.95rem; font-weight: 500;">
                    <i class="fas fa-question-circle" style="color: #3f51b5; margin-right: 6px;"></i>
                    ¿Qué deseas hacer con este reporte?
                </p>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="btnSoloAnular" type="button" class="swal2-confirm swal2-styled" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); width: 100%; margin: 0; padding: 14px 16px; font-size: 0.95rem; box-shadow: 0 2px 8px rgba(100, 116, 139, 0.3); border: none;">
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-ban" style="margin-right: 10px; font-size: 1.1rem;"></i>
                            <div style="text-align: left;">
                                <div style="font-weight: 600;">Solo Anular</div>
                                <div style="font-size: 0.75rem; opacity: 0.95; margin-top: 2px; font-weight: 400;">Reporte creado por error o duplicado</div>
                            </div>
                        </div>
                    </button>
                    
                    <button id="btnAnularYCopiar" type="button" class="swal2-confirm swal2-styled" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); width: 100%; margin: 0; padding: 14px 16px; font-size: 0.95rem; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3); border: none;">
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-copy" style="margin-right: 10px; font-size: 1.1rem;"></i>
                            <div style="text-align: left;">
                                <div style="font-weight: 600;">Anular y Crear Copia Editable</div>
                                <div style="font-size: 0.75rem; opacity: 0.95; margin-top: 2px; font-weight: 400;">Corregir errores en los datos del reporte</div>
                            </div>
                        </div>
                    </button>
                </div>
                
                <div style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; border-radius: 4px; margin-top: 16px;">
                    <div style="font-size: 0.8rem; color: #92400e; line-height: 1.5;">
                        <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
                        <strong>Importante:</strong> Los reportes anulados se mostrarán en rojo en la lista.
                    </div>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        showConfirmButton: false,
        cancelButtonColor: '#94a3b8',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        width: '600px',
        didOpen: () => {
            const popup = Swal.getPopup();

            popup.querySelector('#btnSoloAnular').addEventListener('click', async () => {
                Swal.close();
                await ejecutarSoloAnular(rep);
            });

            popup.querySelector('#btnAnularYCopiar').addEventListener('click', async () => {
                Swal.close();
                await ejecutarAnularYCopiar(rep);
            });
        }
    });
}

async function ejecutarSoloAnular(rep) {
    const confirmResult = await Swal.fire({
        title: '¿Confirmar Anulación?',
        html: `
            <div style="text-align: left; padding: 0 20px;">
                <p style="margin-bottom: 15px; color: #475569;">Esta acción marcará el reporte como <strong>ANULADO</strong> sin crear copia.</p>
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px;">
                    <div style="font-weight: 600; color: #dc2626; margin-bottom: 6px;">
                        <i class="fas fa-exclamation-triangle"></i> Advertencia
                    </div>
                    <div style="font-size: 0.85rem; color: #991b1b;">
                        El reporte quedará marcado como anulado y no se podrá editar.
                    </div>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, solo anular',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        let sessionToken = SUPABASE_KEY;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch (e) { }

        const idReporte = rep.id_reporte || rep.ID_REPORTE;

        const respAnular = await fetch(`${getFunctionsUrl()}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                accion: 'ANULAR_REPORTE',
                id_reporte: idReporte
            })
        });

        if (!respAnular.ok) throw new Error('Error al anular el reporte en el servidor');
        const resAnular = await respAnular.json();
        if (!resAnular.success) throw new Error(resAnular.message || 'Error al anular reporte');

        Swal.fire({
            icon: 'success',
            title: 'Reporte Anulado',
            text: 'El reporte ha sido marcado como anulado.',
            confirmButtonColor: '#10b981'
        });

        await recargarDatos();

    } catch (error) {
        console.error('Error al anular reporte:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo anular el reporte: ${error.message}`,
            confirmButtonColor: '#ef4444'
        });
    }
}

async function ejecutarAnularYCopiar(rep) {
    const confirmResult = await Swal.fire({
        title: '¿Anular y Crear Copia?',
        html: `
            <div style="text-align: left; padding: 0 20px;">
                <p style="margin-bottom: 15px; color: #475569;">Esta acción:</p>
                <ul style="color: #64748b; font-size: 0.9rem; padding-left: 20px; margin-bottom: 15px;">
                    <li style="margin-bottom: 6px;">Marcará el reporte original como <strong>ANULADO</strong></li>
                    <li style="margin-bottom: 6px;">Creará una <strong>copia exacta</strong> con nuevo ID</li>
                    <li style="margin-bottom: 6px;">La copia será <strong>editable durante 24 horas</strong></li>
                </ul>
                <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px;">
                    <div style="font-size: 0.85rem; color: #1e40af;">
                        <i class="fas fa-lightbulb"></i> La copia aparecerá en "Mis Reportes" para editarla.
                    </div>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, anular y copiar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        let sessionToken = SUPABASE_KEY;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch (e) { }

        const idReporte = rep.id_reporte || rep.ID_REPORTE;

        // 1. Anular reporte original
        const respAnular = await fetch(`${getFunctionsUrl()}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                accion: 'ANULAR_REPORTE',
                id_reporte: idReporte
            })
        });

        if (!respAnular.ok) throw new Error('Error al anular el reporte en el servidor');
        const resAnular = await respAnular.json();
        if (!resAnular.success) throw new Error(resAnular.message || 'Error al anular reporte');

        // 2. Duplicar reporte
        const respDup = await fetch(`${getFunctionsUrl()}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                accion: 'DUPLICAR_REPORTE',
                id_reporte: idReporte
            })
        });

        if (!respDup.ok) {
            const errData = await respDup.json();
            throw new Error(`Error al crear el reporte duplicado: ${errData.message || 'desconocido'}`);
        }

        const resDup = await respDup.json();
        if (!resDup.success) throw new Error(resDup.message || 'Error al duplicar reporte');

        Swal.fire({
            icon: 'success',
            title: 'Reporte Anulado y Copiado',
            html: `
                <div style="text-align: left; padding: 0 20px;">
                    <p style="margin-bottom: 12px; color: #475569;">✓ El reporte original ha sido <strong>anulado</strong>.</p>
                    <p style="margin-bottom: 12px; color: #475569;">✓ Se ha creado una copia editable.</p>
                    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin-top: 15px;">
                        <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">
                            Nuevo ID de Reporte:
                        </div>
                        <div style="font-size: 1.1rem; color: #15803d; font-family: monospace;">
                            ${resDup.id_reporte}
                        </div>
                    </div>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 12px;">
                        <i class="fas fa-clock"></i> Editable durante las próximas 24 horas.
                    </p>
                </div>
            `,
            confirmButtonColor: '#10b981'
        }).then(() => {
            window.location.href = `mis-reportes.html?edit=${resDup.id_reporte}`;
        });

    } catch (error) {
        console.error('Error al anular y copiar reporte:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo completar la operación: ${error.message}`,
            confirmButtonColor: '#ef4444'
        });
    }
}

async function editarReporteAnalizado(index) {
    const rep = gsTableReportes[index];
    if (!rep) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró el reporte seleccionado',
            confirmButtonColor: '#3f51b5'
        });
        return;
    }

    // Validar permisos del usuario actual
    const currentUserRole = window.currentUser?.ROL || '';
    if (!['ADMIN', 'MODERATOR'].includes(currentUserRole)) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo ADMIN y MODERATOR pueden editar reportes',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    // Validar 24 horas
    const fechaReporte = rep.fecha || rep.FECHA || '';
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

    const idReporte = rep.id_reporte || rep.ID_REPORTE || rep.id || rep.ID || '';
    if (!idReporte) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'El reporte no tiene un ID válido para edición',
            confirmButtonColor: '#3f51b5'
        });
        return;
    }

    window.location.href = `mis-reportes.html?edit=${idReporte}`;
}

window.anularReporteAnalizado = anularReporteAnalizado;
window.editarReporteAnalizado = editarReporteAnalizado;

let selectedSoporteFileAnalizado = null;
let _listenersInitializedAnalizado = false;

function entrarModoEdicionReporteAnalizado() {
    // Obtener overlay y modal clonado
    const overlay = document.getElementById('simpleModalOverlay');
    if (!overlay) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Modal no encontrado',
            confirmButtonColor: '#3f51b5'
        });
        return;
    }

    const modalContent = overlay.querySelector('.modal-content');
    if (!modalContent) return;

    // Marcar modal como en modo edición
    modalContent.classList.add('is-editing');

    // Cambiar título
    const modalTitle = modalContent.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit me-2"></i>Editar Reporte <span class="badge bg-warning ms-2" style="font-size: 0.75rem; vertical-align: middle;">Modo Edición</span>';
    }

    // Obtener datos del reporte del modal
    const idReporteInput = modalContent.querySelector('#viewIdReporte');
    if (!idReporteInput) return;

    const idReporte = idReporteInput.value;
    const rep = gsTableReportes.find(r => (r.id_reporte || r.ID_REPORTE) === idReporte);
    if (!rep) return;

    // Inicializar listeners
    initEditModeListenersAnalizado(modalContent);

    // Convertir campos de solo lectura a editables
    // 1. Tipo de Visita
    const tipoVisitaInput = modalContent.querySelector('#viewTipoVisita');
    if (tipoVisitaInput) {
        const currentValue = tipoVisitaInput.value;
        const selectHtml = `
            <select id="editTipoVisitaSelect" class="form-control" style="border-radius: 8px; border-color: #dee2e6; font-size: 0.9rem; padding: 0.5rem 0.75rem;">
                <option value="">Seleccionar...</option>
                <option value="AUDITORIA" ${currentValue === 'AUDITORIA' ? 'selected' : ''}>AUDITORIA</option>
                <option value="RONDA" ${currentValue === 'RONDA' ? 'selected' : ''}>RONDA</option>
                <option value="CONTRAMUESTRA" ${currentValue === 'CONTRAMUESTRA' ? 'selected' : ''}>CONTRAMUESTRA</option>
                <option value="REVISION" ${currentValue === 'REVISION' ? 'selected' : ''}>REVISIÓN</option>
            </select>
        `;
        tipoVisitaInput.outerHTML = selectHtml;
    }

    // 2. Conclusión
    const conclusionInput = modalContent.querySelector('#viewConclusion');
    if (conclusionInput) {
        const currentValue = conclusionInput.value;
        const selectHtml = `
            <select id="editConclusionSelect" class="form-control" style="border-radius: 8px; border-color: #dee2e6; font-size: 0.9rem; padding: 0.5rem 0.75rem;">
                <option value="">Seleccionar...</option>
                <option value="APROBADO" ${currentValue === 'APROBADO' ? 'selected' : ''}>APROBADO</option>
                <option value="RECHAZADO" ${currentValue === 'RECHAZADO' ? 'selected' : ''}>RECHAZADO</option>
                <option value="PAUSADO" ${currentValue === 'PAUSADO' ? 'selected' : ''}>PAUSADO</option>
            </select>
        `;
        conclusionInput.outerHTML = selectHtml;
    }

    // 3. Observaciones
    const observacionesInput = modalContent.querySelector('#viewObservaciones');
    if (observacionesInput) {
        const currentValue = observacionesInput.value;
        observacionesInput.readOnly = false;
        observacionesInput.id = 'editObservacionesEditable';
        observacionesInput.style.minHeight = '120px';
    }

    // 4. Avance (si aplica)
    const cantidadRow = modalContent.querySelector('#viewCantidad')?.closest('.row');
    if (cantidadRow) {
        const avanceHtml = `
            <div class="col-md-6" id="containerAvanceEdit" style="display: none;">
                <label class="form-label" style="font-weight: 600; color: #3f51b5; font-size: 0.85rem; margin-bottom: 0.5rem;">
                    <i class="fas fa-percentage"></i> Avance de Producción
                </label>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="range" id="editAvanceSlider" min="0" max="100" value="${rep.avance || rep.AVANCE || 0}" class="form-range" style="flex: 1;">
                    <span id="editAvanceValor" style="font-weight: 700; color: #3f51b5; font-size: 1.1rem; min-width: 50px;">${rep.avance || rep.AVANCE || 0}%</span>
                    <input type="hidden" id="editAvancePorcentaje" value="${rep.avance || rep.AVANCE || 0}">
                </div>
            </div>
        `;
        cantidadRow.insertAdjacentHTML('beforeend', avanceHtml);
    }

    // 5. Destino (si aplica)
    const procesoRow = modalContent.querySelector('#viewProceso')?.closest('.row');
    if (procesoRow) {
        const destinoHtml = `
            <div class="col-12" id="editDestinoSection" style="display: none; margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <label class="form-label" style="font-weight: 600; color: #3f51b5; font-size: 0.85rem; margin-bottom: 12px;">
                    <i class="fas fa-arrow-right"></i> Destino
                </label>
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label" style="font-size: 0.8rem; color: #64748b;">Tipo de Destino</label>
                        <select id="editDestinoTipo" class="form-control" style="border-radius: 8px;">
                            <option value="">Seleccionar...</option>
                            <option value="CDI">CDI</option>
                            <option value="PROCESO">Otro Proceso</option>
                        </select>
                    </div>
                    <div class="col-md-6" id="editDestinoProcesoContainer" style="display: none;">
                        <label class="form-label" style="font-size: 0.8rem; color: #64748b;">Proceso</label>
                        <select id="editDestinoProcesoSelect" class="form-control" style="border-radius: 8px;">
                            <option value="">Seleccionar...</option>
                            <option value="LAVANDERIA">LAVANDERIA</option>
                            <option value="ESTAMPADO">ESTAMPADO</option>
                            <option value="BORDADO">BORDADO</option>
                            <option value="LASER">LASER</option>
                            <option value="OTROS">OTROS</option>
                        </select>
                    </div>
                </div>
                <div class="row mt-2" id="editDestinoOtroSection" style="display: none;">
                    <div class="col-12">
                        <label class="form-label" style="font-size: 0.8rem; color: #64748b;">Especificar Proceso</label>
                        <input type="text" id="editDestinoOtro" class="form-control" placeholder="Nombre del proceso" style="border-radius: 8px;">
                    </div>
                </div>
                <div class="row mt-2">
                    <div class="col-12">
                        <label class="form-label" style="font-size: 0.8rem; color: #64748b;">Planta Destino</label>
                        <input type="text" id="editDestinoPlantaInput" class="form-control" list="plantasDatalistModalAnalizado" placeholder="Nombre de la planta" style="border-radius: 8px;">
                        <datalist id="plantasDatalistModalAnalizado"></datalist>
                    </div>
                </div>
            </div>
        `;
        procesoRow.insertAdjacentHTML('afterend', destinoHtml);
    }

    // 6. Soporte (imagen)
    const soporteContainer = modalContent.querySelector('#viewSoporteContainer');
    if (soporteContainer) {
        const currentSoporte = rep.soporte || rep.SOPORTE || '';
        const dropzoneHtml = `
            <div style="margin-top: 12px;">
                <label class="form-label" style="font-weight: 600; color: #3f51b5; font-size: 0.85rem;">
                    <i class="fas fa-camera"></i> Cambiar Evidencia Fotográfica
                </label>
                <div id="editSoporteDropzone" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; background: #f8fafc;">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #94a3b8; margin-bottom: 8px;"></i>
                    <p style="margin: 0; color: #64748b; font-size: 0.85rem;">Haz clic o arrastra una imagen aquí</p>
                    <p id="editSoporteName" style="margin-top: 8px; color: #3f51b5; font-size: 0.8rem; font-weight: 600;"></p>
                </div>
                <input type="file" id="editSoporteInput" accept="image/*" style="display: none;">
            </div>
        `;
        soporteContainer.insertAdjacentHTML('afterend', dropzoneHtml);
    }

    // Cambiar botones del footer
    const footer = modalContent.querySelector('.modal-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="d-flex gap-2 w-100">
                <button type="button" class="btn flex-1" onclick="salirModoEdicionAnalizado()" style="background: #e2e8f0; border: none; color: #475569; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 500;">
                    <i class="fas fa-times me-1"></i>Cancelar
                </button>
                <button type="button" class="btn flex-1 text-white" onclick="guardarCambiosReporteAnalizado()" style="background: #3f51b5; border: none; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 500;">
                    <i class="fas fa-save me-1"></i>Guardar Cambios
                </button>
            </div>
        `;
    }

    // Cargar valores de destino si existen
    const destinoProceso = rep.destino_proceso || rep.DESTINO_PROCESO || '';
    const destinoPlanta = rep.destino_planta || rep.DESTINO_PLANTA || '';

    if (destinoProceso) {
        const tipoDestinoSelect = modalContent.querySelector('#editDestinoTipo');
        if (tipoDestinoSelect) {
            if (destinoProceso === 'CDI') {
                tipoDestinoSelect.value = 'CDI';
            } else {
                tipoDestinoSelect.value = 'PROCESO';
                const procesoSelect = modalContent.querySelector('#editDestinoProcesoSelect');
                const standardOptions = ['LAVANDERIA', 'ESTAMPADO', 'BORDADO', 'LASER'];
                if (standardOptions.includes(destinoProceso)) {
                    procesoSelect.value = destinoProceso;
                } else {
                    procesoSelect.value = 'OTROS';
                    modalContent.querySelector('#editDestinoOtroSection').style.display = '';
                    modalContent.querySelector('#editDestinoOtro').value = destinoProceso;
                }
            }
        }
        const plantaInput = modalContent.querySelector('#editDestinoPlantaInput');
        if (plantaInput) plantaInput.value = destinoPlanta;
    }

    // Llenar datalist de plantas
    const listEl = modalContent.querySelector('#plantasDatalistModalAnalizado');
    if (listEl && gsPlantas) {
        listEl.innerHTML = gsPlantas.map(p => `<option value="${p.PLANTA || p.planta}"></option>`).join('');
    }

    // Reset estado
    selectedSoporteFileAnalizado = null;
    window._novedadesCalidadStateAnalizado = [];

    // Actualizar campos reactivos
    actualizarCamposEdicionAnalizado(modalContent);
}

function initEditModeListenersAnalizado(modalContent) {
    if (_listenersInitializedAnalizado) return;
    _listenersInitializedAnalizado = true;

    // Avance slider
    setTimeout(() => {
        const slider = modalContent.querySelector('#editAvanceSlider');
        const valor = modalContent.querySelector('#editAvanceValor');
        const pct = modalContent.querySelector('#editAvancePorcentaje');

        if (slider && valor && pct) {
            slider.oninput = () => {
                valor.textContent = slider.value + '%';
                pct.value = slider.value;
            };
        }

        // Tipo visita y conclusión reactivos
        const tipoSelect = modalContent.querySelector('#editTipoVisitaSelect');
        const conclusionSelect = modalContent.querySelector('#editConclusionSelect');

        if (tipoSelect) {
            tipoSelect.onchange = () => actualizarCamposEdicionAnalizado(modalContent);
        }
        if (conclusionSelect) {
            conclusionSelect.onchange = () => actualizarCamposEdicionAnalizado(modalContent);
        }

        // Destino reactivo
        const destinoTipo = modalContent.querySelector('#editDestinoTipo');
        const destinoProcesoSelect = modalContent.querySelector('#editDestinoProcesoSelect');

        if (destinoTipo) {
            destinoTipo.onchange = () => actualizarCamposEdicionAnalizado(modalContent);
        }

        if (destinoProcesoSelect) {
            destinoProcesoSelect.onchange = () => {
                const otroSection = modalContent.querySelector('#editDestinoOtroSection');
                const otroInput = modalContent.querySelector('#editDestinoOtro');
                if (destinoProcesoSelect.value === 'OTROS') {
                    if (otroSection) otroSection.style.display = '';
                    if (otroInput) otroInput.required = true;
                } else {
                    if (otroSection) otroSection.style.display = 'none';
                    if (otroInput) {
                        otroInput.required = false;
                        otroInput.value = '';
                    }
                }
            };
        }

        // Soporte uploader
        const dropzone = modalContent.querySelector('#editSoporteDropzone');
        const fileInput = modalContent.querySelector('#editSoporteInput');
        const nameSpan = modalContent.querySelector('#editSoporteName');

        if (dropzone && fileInput) {
            dropzone.onclick = () => fileInput.click();

            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    selectedSoporteFileAnalizado = file;
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
                dropzone.style.background = '#f8fafc';
            };

            dropzone.ondrop = (e) => {
                e.preventDefault();
                dropzone.style.borderColor = '#cbd5e1';
                dropzone.style.background = '#f8fafc';
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    selectedSoporteFileAnalizado = file;
                    if (nameSpan) nameSpan.textContent = file.name;
                    fileInput.files = e.dataTransfer.files;
                }
            };
        }
    }, 100);
}

function actualizarCamposEdicionAnalizado(modalContent) {
    const tipoSelect = modalContent.querySelector('#editTipoVisitaSelect');
    const conclusionSelect = modalContent.querySelector('#editConclusionSelect');

    if (!tipoSelect || !conclusionSelect) return;

    const tipo = tipoSelect.value.toUpperCase();
    const conclusion = conclusionSelect.value;

    const esAuditoria = tipo === 'AUDITORIA';
    const esRonda = tipo === 'RONDA';
    const esContramuestra = tipo === 'CONTRAMUESTRA';

    // Conclusión PAUSADO solo disponible para RONDA
    const optPausado = conclusionSelect.querySelector('option[value="PAUSADO"]');
    if (esRonda) {
        if (!optPausado) {
            const opt = document.createElement('option');
            opt.value = 'PAUSADO';
            opt.textContent = 'PAUSADO';
            conclusionSelect.appendChild(opt);
        }
    } else {
        if (conclusionSelect.value === 'PAUSADO') {
            conclusionSelect.value = '';
        }
        if (optPausado) {
            optPausado.remove();
        }
    }

    const esPausado = conclusionSelect.value === 'PAUSADO';

    // Avance
    const avanceContainer = modalContent.querySelector('#containerAvanceEdit');
    if (avanceContainer) {
        const mostrarAvance = (esRonda || esContramuestra) && !esPausado;
        avanceContainer.style.display = mostrarAvance ? '' : 'none';
    }

    // Destino
    const destinoSection = modalContent.querySelector('#editDestinoSection');
    const destinoProcesoContainer = modalContent.querySelector('#editDestinoProcesoContainer');
    const destinoTipo = modalContent.querySelector('#editDestinoTipo');

    if (destinoSection) {
        if (esAuditoria && conclusion === 'APROBADO') {
            destinoSection.style.display = '';
            const isProc = destinoTipo && destinoTipo.value === 'PROCESO';
            if (destinoProcesoContainer) destinoProcesoContainer.style.display = isProc ? '' : 'none';
        } else {
            destinoSection.style.display = 'none';
            if (destinoProcesoContainer) destinoProcesoContainer.style.display = 'none';
        }
    }
}

function salirModoEdicionAnalizado() {
    const overlay = document.getElementById('simpleModalOverlay');
    if (overlay) {
        overlay.remove();
    }
    selectedSoporteFileAnalizado = null;
    _listenersInitializedAnalizado = false;
}

window.salirModoEdicionAnalizado = salirModoEdicionAnalizado;
window.guardarCambiosReporteAnalizado = guardarCambiosReporteAnalizado;

async function guardarCambiosReporteAnalizado() {
    const overlay = document.getElementById('simpleModalOverlay');
    if (!overlay) return;

    const modalContent = overlay.querySelector('.modal-content');
    if (!modalContent) return;

    const idReporteInput = modalContent.querySelector('#viewIdReporte');
    if (!idReporteInput) return;

    const idReporte = idReporteInput.value;
    const rep = gsTableReportes.find(r => (r.id_reporte || r.ID_REPORTE) === idReporte);
    if (!rep) return;

    const tipoVisita = modalContent.querySelector('#editTipoVisitaSelect')?.value;
    const conclusion = modalContent.querySelector('#editConclusionSelect')?.value;
    const observaciones = modalContent.querySelector('#editObservacionesEditable')?.value;

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
        avance = modalContent.querySelector('#editAvancePorcentaje')?.value || '0';
        if (tipoVisita === 'RONDA' && Number(avance) === 0) {
            Swal.fire({ icon: 'warning', title: 'Avance requerido', text: 'Para una Ronda debes registrar el porcentaje de avance de producción.', confirmButtonColor: '#3F51B5' });
            return;
        }
    }

    const destinoTipoVal = modalContent.querySelector('#editDestinoTipo')?.value || '';
    const destinoProcesoVal = modalContent.querySelector('#editDestinoProcesoSelect')?.value || '';
    const destinoOtroVal = modalContent.querySelector('#editDestinoOtro')?.value || '';
    const destinoPlantaVal = modalContent.querySelector('#editDestinoPlantaInput')?.value || '';

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

        let finalSoporteUrl = rep.soporte || rep.SOPORTE || '';
        if (selectedSoporteFileAnalizado) {
            Swal.update({ title: 'Subiendo soporte...', text: 'Subiendo soporte digital' });
            try {
                const uploadedUrl = await uploadToSupabase(selectedSoporteFileAnalizado, rep.productora || rep.PRODUCTORA, 'REPORTES');
                if (uploadedUrl) {
                    finalSoporteUrl = uploadedUrl;
                }
            } catch (upErr) {
                console.error("Error subiendo soporte:", upErr);
                throw new Error("No se pudo subir la imagen de soporte: " + upErr.message);
            }
        }

        let sessionToken = '';
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('-auth-token')) {
                    const s = JSON.parse(localStorage.getItem(k));
                    if (s?.access_token) { sessionToken = s.access_token; break; }
                }
            }
        } catch (e) { }

        const res = await fetch(`${getFunctionsUrl()}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                accion: 'UPDATE_REPORTE',
                idReporte: idReporte,
                tipoVisita: tipoVisita,
                conclusion: conclusion,
                observaciones: observaciones,
                avance: avance ? Number(avance) : null,
                destinoProceso: destino_proceso,
                destinoPlanta: destino_planta,
                novedadesAuditoria: null,
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

        salirModoEdicionAnalizado();
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

async function anularYEditarReporte(index) {
    const rep = gsTableReportes[index];
    if (!rep) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró el reporte seleccionado',
            confirmButtonColor: '#3f51b5',
            customClass: {
                container: 'swal-high-zindex'
            }
        });
        return;
    }

    // Validar permisos del usuario actual
    const currentUserRole = window.currentUser?.ROL || '';
    if (!['ADMIN', 'MODERATOR'].includes(currentUserRole)) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo ADMIN y MODERATOR pueden anular reportes',
            confirmButtonColor: '#ef4444',
            customClass: {
                container: 'swal-high-zindex'
            }
        });
        return;
    }

    // Confirmar anulación
    const result = await Swal.fire({
        title: '¿Anular y Editar Reporte?',
        html: `
            <div style="text-align: left; padding: 0 20px;">
                <p style="margin-bottom: 15px;">Esta acción marcará el reporte actual como <strong>ANULADO</strong> y creará una copia editable.</p>
                <div style="background: #f8fafc; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
                    <div style="font-weight: 600; color: #dc2626; margin-bottom: 6px;">
                        <i class="fas fa-exclamation-triangle"></i> Reporte a Anular:
                    </div>
                    <div style="font-size: 0.9rem; color: #64748b;">
                        <strong>ID:</strong> ${rep.id_reporte || rep.ID_REPORTE || 'N/A'}<br>
                        <strong>Lote:</strong> ${rep.id || rep.ID || rep.lote || rep.LOTE || 'N/A'}<br>
                        <strong>Planta:</strong> ${rep._planta || 'N/A'}<br>
                        <strong>Tipo:</strong> ${rep._tipo || 'N/A'}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0;">
                    <i class="fas fa-info-circle"></i> El reporte anulado permanecerá en el historial pero marcado como inactivo.
                </p>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-ban me-2"></i>Anular y Editar',
        cancelButtonText: 'Cancelar',
        width: '600px',
        customClass: {
            container: 'swal-high-zindex'
        }
    });

    if (!result.isConfirmed) return;

    // Mostrar loader
    Swal.fire({
        title: 'Anulando reporte...',
        html: 'Por favor espera mientras se procesa la anulación',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
            container: 'swal-high-zindex'
        },
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const idReporte = rep.id_reporte || rep.ID_REPORTE;
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g';

        // Obtener token de sesión del usuario
        let sessionToken = SUPABASE_KEY;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('-auth-token')) {
                    const raw = localStorage.getItem(key);
                    if (raw && raw !== 'undefined' && raw !== 'null') {
                        const session = JSON.parse(raw);
                        if (session && session.access_token) {
                            sessionToken = session.access_token;
                            break;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('No se pudo obtener token de sesión, usando SUPABASE_KEY');
        }

        console.log('[ANULAR] ID Reporte:', idReporte);
        console.log('[ANULAR] Token disponible:', sessionToken ? 'Sí' : 'No');

        // 1. Anular el reporte actual vía edge function
        const anularResponse = await fetch('https://zpikjjcbievfpzegupmw.supabase.co/functions/v1/operations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                accion: 'ANULAR_REPORTE',
                id_reporte: idReporte
            })
        });

        console.log('[ANULAR] Response status:', anularResponse.status);

        if (!anularResponse.ok) {
            const errorText = await anularResponse.text();
            console.error('[ANULAR] Error response:', errorText);
            throw new Error(`Error al anular el reporte en el servidor (${anularResponse.status}): ${errorText}`);
        }

        const anularResult = await anularResponse.json();
        console.log('[ANULAR] Resultado anulación:', anularResult);

        // 2. Crear nuevo reporte duplicado - enviar TODO el reporte original
        console.log('[DUPLICAR] Preparando reporte para duplicar...');

        const crearResponse = await fetch('https://zpikjjcbievfpzegupmw.supabase.co/functions/v1/operations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                accion: 'DUPLICAR_REPORTE',
                reporte: rep  // Enviar el reporte COMPLETO tal cual está
            })
        });

        console.log('[DUPLICAR] Response status:', crearResponse.status);

        if (!crearResponse.ok) {
            const errorText = await crearResponse.text();
            console.error('[DUPLICAR] Error response:', errorText);
            throw new Error(`Error al crear el reporte duplicado (${crearResponse.status}): ${errorText}`);
        }

        const crearResult = await crearResponse.json();
        console.log('[DUPLICAR] Resultado creación:', crearResult);

        // Cerrar modal si está abierto
        cerrarModalReporte();

        // Recargar datos
        await recargarDatos();

        // Mostrar éxito
        Swal.fire({
            icon: 'success',
            title: '¡Reporte Anulado!',
            html: `
                <div style="text-align: left; padding: 0 20px;">
                    <p>El reporte original ha sido <strong>anulado</strong> y se ha creado una copia activa.</p>
                    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin-top: 12px;">
                        <div style="font-weight: 600; color: #059669; margin-bottom: 6px;">
                            <i class="fas fa-check-circle"></i> Nuevo Reporte Creado
                        </div>
                        <div style="font-size: 0.85rem; color: #64748b;">
                            ID: ${crearResult.id_reporte || crearResult.ID_REPORTE || 'Generado'}
                        </div>
                    </div>
                </div>
            `,
            confirmButtonColor: '#3f51b5',
            timer: 3000,
            customClass: {
                container: 'swal-high-zindex'
            }
        });

    } catch (error) {
        console.error('Error al anular reporte:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo anular el reporte: ${error.message}`,
            confirmButtonColor: '#ef4444',
            customClass: {
                container: 'swal-high-zindex'
            }
        });
    }
}

// Exponer función globalmente
window.anularYEditarReporte = anularYEditarReporte;
