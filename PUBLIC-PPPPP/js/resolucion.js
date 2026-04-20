/* ==========================================================================
   resolucion.js — Lógica para la vista de Resolución (Ultra Compact Cards)
   ========================================================================== */

let gsNovedades = [];
let gsPlantas = [];
let gsCurrentPage = 1;
const gsRecordsPerPage = 6;

window.onload = async function () {
    await loadUsers();

    // Aplicar modo compacto si estaba guardado
    const isCompact = localStorage.getItem('viewModeResolucion') === 'compact';
    if (isCompact) {
        document.getElementById('novedadesFeed')?.classList.add('is-compact');
        document.getElementById('toggleViewMode')?.classList.add('active');
    }

    // Cargar datos iniciales (sin finalizados)
    await cargarDatos();
};

/**
 * Alterna entre vista de lista (detallada) y vista de grid (compacta)
 */
function toggleCompactView() {
    const feed = document.getElementById('novedadesFeed');
    const btn = document.getElementById('toggleViewMode');
    if (!feed || !btn) return;

    const isCompact = feed.classList.toggle('is-compact');
    btn.classList.toggle('active');

    localStorage.setItem('viewModeResolucion', isCompact ? 'compact' : 'expanded');
    
    // Si la paginación cambia de layout, forzamos reflow o scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cargarDatos(soloFinalizados = false) {
    const loader = document.getElementById('loader');
    const section = document.getElementById('dataSection');

    try {
        await fetchSecureConfig();

        const [novedades, plantas] = await Promise.all([
            fetchNovedadesData(soloFinalizados),
            fetchPlantasData()
        ]);

        gsNovedades = novedades;
        gsPlantas = plantas;

        // Verificar si hay datos
        if (!gsNovedades || gsNovedades.length === 0) {
            if (loader) {
                loader.style.display = 'block';
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-clipboard-list mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">${soloFinalizados ? 'No hay novedades finalizadas.' : 'No hay novedades activas.'}</p>
                    </div>
                `;
            }
            if (section) section.style.display = 'none';
            return;
        }

        updateStats();

        // Ordenar por fecha: más antiguos primero
        gsNovedades.sort((a, b) => {
            const dateA = parsearFechaLatina(a.FECHA) || new Date(0);
            const dateB = parsearFechaLatina(b.FECHA) || new Date(0);
            return dateA - dateB; // Antigüedad: más viejos primero
        });

        renderTabla(gsNovedades);
        if (loader) loader.style.display = 'none';
        if (section) section.style.display = 'block';

        // Iniciar badges de chat no leídos para USER-P/ADMIN
        if (typeof initChatBadges === 'function') {
            initChatBadges();
        } else {
            console.error('[RESOLUCION] ❌ initChatBadges no está disponible');
        }

    } catch (error) {
        console.error('Error:', error);
        if (loader) {
            loader.innerHTML = `
                <div class="py-5 text-center text-danger">
                    <i class="fas fa-exclamation-circle mb-3" style="font-size: 3.5rem;"></i>
                    <p class="fw-800 mb-1">FALLO AL SINCRONIZAR</p>
                    <p class="small opacity-75 mb-3">Error: ${error.message}</p>
                    <button class="btn btn-primary rounded-pill px-4" onclick="cargarDatos()">REINTENTAR AHORA</button>
                </div>
            `;
        }
    }
}

function updateStats() {
    const stats = {
        PENDIENTE: { lots: 0, qty: 0 },
        ELABORACION: { lots: 0, qty: 0 },
        FINALIZADO: { lots: 0, qty: 0 }
    };

    gsNovedades.forEach(n => {
        const est = n.ESTADO || 'PENDIENTE';
        if (stats[est]) {
            stats[est].lots++;
            stats[est].qty += parseFloat(n.CANTIDAD_SOLICITADA || 0);
        }
    });

    const updateEl = (idVal, idQty, data) => {
        const elV = document.getElementById(idVal);
        const elQ = document.getElementById(idQty);
        if (elV) elV.textContent = data.lots;
        if (elQ) elQ.textContent = `${Math.round(data.qty)} UND`;
    };

    // Desktop
    updateEl('stat-pending', 'stat-pending-qty', stats.PENDIENTE);
    updateEl('stat-process', 'stat-process-qty', stats.ELABORACION);
    updateEl('stat-done', 'stat-done-qty', stats.FINALIZADO);

    // Mobile (Unificado)
    const mP = document.getElementById('m-stat-pending');
    const mR = document.getElementById('m-stat-process');
    const mD = document.getElementById('m-stat-done');
    if (mP) mP.textContent = stats.PENDIENTE.lots;
    if (mR) mR.textContent = stats.ELABORACION.lots;
    if (mD) mD.textContent = stats.FINALIZADO.lots;
}

function handleFilter() {
    gsCurrentPage = 1;
    const term = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
    renderTabla(gsNovedades.filter(n => {
        if (!term) return true;
        return (n.LOTE || '').toLowerCase().includes(term) ||
            (n.PLANTA || '').toLowerCase().includes(term) ||
            (n.ID_NOVEDAD || '').toLowerCase().includes(term) ||
            (n.DESCRIPCION || '').toLowerCase().includes(term);
    }));
}

/**
 * Formatea el contenido JSONB de TIPO_DETALLE para mostrarlo de forma legible
 */
function formatearTipoDetalle(tipoDetalle, area) {
    if (!tipoDetalle) return null;
    
    try {
        const detalle = typeof tipoDetalle === 'string' ? JSON.parse(tipoDetalle) : tipoDetalle;
        
        console.log('[formatearTipoDetalle] Procesando:', { tipoDetalle, detalle, area });
        
        if (!detalle || typeof detalle !== 'object') return null;
        
        let html = '<div style="font-size: 0.85rem; line-height: 1.6; color: #475569; background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6; margin: 8px 0;">';
        
        // CÓDIGOS - Lote completo
        if (detalle.tipo_solicitud === 'LOTE_COMPLETO') {
            html += `<div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1e293b;">
                <i class="fas fa-layer-group" style="color: #3b82f6;"></i>
                <span>LOTE COMPLETO</span>
            </div>
            <div style="margin-top: 6px; padding-left: 24px;">
                <span style="color: #64748b;">Cantidad total:</span> 
                <strong style="color: #1e293b;">${detalle.cantidad_total || 0} unidades</strong>
            </div>`;
        }
        // CÓDIGOS - Unidades específicas
        else if (detalle.tipo_solicitud === 'UNIDADES' && detalle.items) {
            html += `<div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                <i class="fas fa-list-ul" style="color: #3b82f6;"></i>
                <span>UNIDADES ESPECÍFICAS</span>
            </div>`;
            detalle.items.forEach((item, idx) => {
                html += `<div style="padding: 6px 0 6px 24px; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 0.75rem;">Ítem ${idx + 1}:</span>
                    <strong style="color: #1e293b;">Talla ${item.talla}</strong> · 
                    <strong style="color: #1e293b;">${item.color}</strong> · 
                    <span style="color: #3b82f6; font-weight: 700;">${item.cantidad} und</span>
                </div>`;
            });
        }
        // INSUMOS, CORTE, TELAS - Lista de items
        else if (detalle.items && Array.isArray(detalle.items)) {
            const iconMap = {
                'INSUMOS': 'fa-tags',
                'CORTE': 'fa-cut',
                'TELAS': 'fa-scroll'
            };
            const icon = iconMap[area] || 'fa-list';
            
            html += `<div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                <i class="fas ${icon}" style="color: #3b82f6;"></i>
                <span>${area || 'DETALLE'}</span>
            </div>`;
            
            detalle.items.forEach((item, idx) => {
                html += `<div style="padding: 6px 0 6px 24px; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 0.75rem;">Ítem ${idx + 1}:</span>
                    <strong style="color: #1e293b;">${item.tipo}</strong> · 
                    <span style="color: #3b82f6; font-weight: 700;">${item.cantidad} und</span>
                </div>`;
            });
        }
        
        html += '</div>';
        return html;
        
    } catch (e) {
        console.error('[formatearTipoDetalle] Error al parsear:', e);
        return null;
    }
}

/**
 * Renderiza el feed de novedades en formato ULTRA COMPACTO con Trazabilidad.
 */
function renderTabla(data = gsNovedades) {
    const feed = document.getElementById('novedadesFeed');
    const pagContainer = document.getElementById('paginationFeed');
    if (!feed) return;

    updateStats();
    feed.innerHTML = '';
    if (pagContainer) pagContainer.innerHTML = '';

    // Ya no necesitamos filtrar aquí porque los datos vienen filtrados desde Supabase
    const datosMostrar = data;

    if (!datosMostrar || datosMostrar.length === 0) {
        feed.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-search mb-3" style="font-size: 2.5rem; color: #cbd5e1;"></i>
                <p class="text-muted fw-bold mb-1">Sin registros coincidentes</p>
                <p class="small text-muted">Intenta ajustar los filtros de búsqueda.</p>
            </div>
        `;
        return;
    }

    // Lógica de Paginación
    const totalRecords = datosMostrar.length;
    const sliceStart = (gsCurrentPage - 1) * gsRecordsPerPage;
    const sliceEnd = sliceStart + gsRecordsPerPage;
    const paginatedData = datosMostrar.slice(sliceStart, sliceEnd);

    if (totalRecords > gsRecordsPerPage) {
        renderPaginacion(totalRecords, data);
    }

    paginatedData.forEach((nov) => {
        const dtIngreso = parsearFechaLatina(nov.FECHA);
        const dtSalida = nov.SALIDA ? parsearFechaLatina(nov.SALIDA) : null;
        const estadoActual = nov.ESTADO || 'PENDIENTE';
        const infoPlanta = obtenerPlantaReciente(nov.PLANTA);

        // Calcular días hábiles: desde la SALIDA hasta la FECHA DE REPORTE
        // Esto mide si la planta reportó a tiempo (debe ser máximo 2 días hábiles)
        const totalDias = (dtSalida && dtIngreso) ? calcularDiasHabiles(dtSalida, dtIngreso) : 0;

        const card = document.createElement('div');
        const statusClass = `status-${estadoActual.toLowerCase()}`;
        card.className = `novedad-card-ultra ${statusClass} ${estadoActual === 'FINALIZADO' ? 'is-finalized' : ''}`;
        card.dataset.novedadId = nov.ID_NOVEDAD;
        card.dataset.lote      = nov.LOTE   || '';
        card.dataset.planta    = nov.PLANTA  || '';

        let sIcon = 'clock', sClass = 'p', sLab = 'PENDIENTE';
        if (estadoActual === 'ELABORACION') { sIcon = 'sync-alt'; sClass = 'w'; sLab = 'ELABORACIÓN'; }
        else if (estadoActual === 'FINALIZADO') { sIcon = 'check-circle'; sClass = 'd'; sLab = 'FINALIZADO'; }

        // Opciones del select según el estado actual
        let opcionesEstado = '';
        if (estadoActual === 'PENDIENTE') {
            // Desde PENDIENTE solo puede pasar a ELABORACION
            opcionesEstado = `
                <option value="PENDIENTE" selected>PENDIENTE</option>
                <option value="ELABORACION">ELABORACIÓN</option>
            `;
        } else if (estadoActual === 'ELABORACION') {
            // Desde ELABORACION solo se puede finalizar
            opcionesEstado = `
                <option value="ELABORACION" selected>ELABORACIÓN</option>
                <option value="FINALIZADO">FINALIZAR</option>
            `;
        } else {
            // FINALIZADO no se puede cambiar
            opcionesEstado = `<option value="FINALIZADO" selected>FINALIZADO</option>`;
        }

        // Deshabilitar botón de imprimir si está en PENDIENTE
        const btnPrintDisabled = estadoActual === 'PENDIENTE' ? 'disabled' : '';
        const btnPrintTitle = estadoActual === 'PENDIENTE' ? 'Debe cambiar a ELABORACIÓN para imprimir' : 'Imprimir documento';

        card.innerHTML = `
            <div class="card-visual-ultra" onclick="${nov.IMAGEN ? `window.open('${nov.IMAGEN}', '_blank')` : ''}">
                ${nov.IMAGEN ? `<img src="${nov.IMAGEN}">` : `
                    <div class="no-image-placeholder h-100 d-flex flex-column align-items-center justify-content-center" style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); gap: 8px;">
                        <i class="fas ${(() => {
                            const iconMap = {
                                'INSUMOS': 'fa-tags',
                                'CORTE': 'fa-cut',
                                'TELAS': 'fa-scroll',
                                'CODIGOS': 'fa-barcode',
                                'DISEÑO': 'fa-palette'
                            };
                            return iconMap[nov.AREA] || 'fa-image';
                        })()} " style="font-size: 2.5rem; color: #cbd5e1; transition: all 0.3s ease;"></i>
                        <span style="font-size: 0.65rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Sin Evidencia</span>
                    </div>
                `}
            </div>
            <div class="card-body-ultra">
                <!-- Header: ID + Área + Cantidad -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0; padding-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 4px;">
                            ${nov.ID_NOVEDAD || 'N/A'}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <div style="font-size: 0.85rem; font-weight: 800; color: #1e293b; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-building" style="color: #3b82f6; font-size: 0.75rem;"></i>
                                ${nov.AREA || 'GENERAL'}
                            </div>
                            ${nov.TIPO_NOVEDAD ? `<div class="tech-pill-highlight" title="Tipo de Novedad" style="padding: 3px 10px; ${
                                nov.TIPO_NOVEDAD === 'FALTANTE' ? 'background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.4); color: #dc2626;' :
                                nov.TIPO_NOVEDAD === 'IMPERFECTO' ? 'background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.4); color: #d97706;' :
                                nov.TIPO_NOVEDAD === 'PERDIDA' ? 'background: rgba(139, 92, 246, 0.1); border-color: rgba(139, 92, 246, 0.4); color: #7c3aed;' : ''
                            }">${nov.TIPO_NOVEDAD}</div>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right; padding: 8px 12px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 10px; border: 1px solid #bfdbfe;">
                        <div style="font-size: 1.4rem; font-weight: 900; color: #3b82f6; letter-spacing: -0.5px; line-height: 1;">
                            ${nov.CANTIDAD_SOLICITADA || '0'}
                        </div>
                    </div>
                </div>

                <!-- Pestaña de Datos Técnicos (pegada a la línea divisoria) -->
                <div class="tech-divider-container" style="position: relative; border-top: 2px solid #e2e8f0; margin-bottom: 12px;">
                    <div class="tech-badge-container">
                        ${(() => {
                            const items = [];
                            if (nov.LOTE && nov.LOTE !== 'S/L' && nov.LOTE !== 'N/A') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-barcode"></i>${nov.LOTE}</span>`);
                            }
                            if (nov.REFERENCIA && nov.REFERENCIA !== 'N/A' && nov.REFERENCIA !== '--') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-tag"></i>${nov.REFERENCIA}</span>`);
                            }
                            if (nov.PRENDA && nov.PRENDA !== '--') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-tshirt"></i>${nov.PRENDA}</span>`);
                            }
                            if (nov.GENERO && nov.GENERO !== '--') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-venus-mars"></i>${nov.GENERO}</span>`);
                            }
                            if (nov.TEJIDO && nov.TEJIDO !== '--' && nov.TEJIDO !== 'NA') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-scroll"></i>${nov.TEJIDO}</span>`);
                            }
                            if (nov.LINEA && nov.LINEA !== '--') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-route"></i>${nov.LINEA}</span>`);
                            }
                            if (nov.CANTIDAD && nov.CANTIDAD !== '0') {
                                items.push(`<span class="tech-badge-item"><i class="fas fa-cubes"></i>${nov.CANTIDAD}</span>`);
                            }
                            return items.join('<span class="tech-badge-separator">•</span>');
                        })()}
                    </div>
                </div>

                <!-- Descripción y Detalle JSONB -->
                <div class="card-desc-ultra">${(() => {
                    const descripcion = (nov.DESCRIPCION || '').trim();
                    const detalleFormateado = formatearTipoDetalle(nov.TIPO_DETALLE, nov.AREA);
                    
                    let content = '';
                    
                    // Si hay descripción, mostrarla primero
                    if (descripcion) {
                        content += `<div style="margin-bottom: ${detalleFormateado ? '12px' : '0'}; color: #1e293b; line-height: 1.6;">${descripcion}</div>`;
                    }
                    
                    // Si hay detalle JSONB, agregarlo
                    if (detalleFormateado) {
                        content += detalleFormateado;
                    }
                    
                    // Si no hay nada, mensaje por defecto
                    if (!content) {
                        content = '<div style="color: #94a3b8; font-style: italic;">Sin registro detallado.</div>';
                    }
                    
                    return content;
                })()}</div>

                <!-- Footer: Planta + Fechas + Badge Días -->
                <div class="card-meta-ultra">
                    <div class="d-flex flex-column" style="flex: 1;">
                        <div class="planta-label-lux" style="margin-bottom: 8px;">
                            <i class="fas fa-industry" style="color: #3b82f6; font-size: 0.7rem;"></i>
                            ${nov.PLANTA}
                            ${infoPlanta ? `
                                <div class="info-trigger-lux" onclick="verFichaTaller('${nov.PLANTA.replace(/'/g, "\\'")}')" title="Ver contacto del taller">
                                    <i class="fas fa-info"></i>
                                </div>
                            ` : ''}
                        </div>
                        <div class="date-row-lux">
                            <span style="display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-calendar-plus" style="color: #64748b; font-size: 0.85em;"></i><span><b>Reportado:</b> ${dtIngreso ? (dtIngreso.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })) : '--'}</span></span>
                            <span style="display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-calendar-check" style="color: #64748b; font-size: 0.85em;"></i><span><b>Salida:</b> ${dtSalida ? (dtSalida.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })) : 'PENDIENTE'}</span></span>
                        </div>
                    </div>
                    <div class="days-badge-lux ${totalDias <= 2 ? 'is-ontime' : (totalDias <= 4 ? 'is-warning' : 'is-overdue')}">
                        ${totalDias <= 2 ? '<i class="fas fa-check-circle"></i> ' : (totalDias <= 4 ? '<i class="fas fa-exclamation-circle"></i> ' : '<i class="fas fa-exclamation-triangle"></i> ')}${totalDias} DÍA${totalDias !== 1 ? 'S' : ''}
                    </div>
                </div>
            </div>
            <div class="actions-tower-ultra">
                <div class="status-btn-lux ${sClass}">
                    <i class="fas fa-${sIcon}"></i>
                    <span>${sLab}</span>
                    <select class="status-select-hidden" onchange="actualizarEstado('${nov.ID_NOVEDAD}', this.value, this)">
                        ${opcionesEstado}
                    </select>
                </div>
                <button class="btn-edit-ultra w-100" onclick="editarNovedad('${nov.ID_NOVEDAD}')" title="Editar novedad">
                    <i class="fas fa-pen"></i> EDITAR
                </button>
                <button class="btn-print-ultra w-100" onclick="imprimirNovedad('${nov.ID_NOVEDAD}')" ${btnPrintDisabled} title="${btnPrintTitle}">
                    <i class="fas fa-print"></i> IMPRIMIR
                </button>
                ${estadoActual === 'FINALIZADO' ? `
                <button class="btn-chat-print-ultra w-100" onclick="imprimirChat('${nov.ID_NOVEDAD}')" title="Imprimir transcripción del chat">
                    <i class="fas fa-file-alt"></i> TRANSCRIPCIÓN
                </button>
                ` : ''}
                <button class="btn-chat-ultra w-100" data-chat-btn="${nov.ID_NOVEDAD}" onclick="openChat('${nov.ID_NOVEDAD}','${(nov.PLANTA||'').replace(/'/g,"\\'")}','${(nov.LOTE||'').replace(/'/g,"\\'")}',${(String(nov.CHAT||'').startsWith('https://') || String(nov.CHAT||'').startsWith('[')) ? 'true' : 'false'})">
                    <i class="fas fa-comments"></i> CHAT
                </button>
            </div>
        `;
        feed.appendChild(card);
    });
}

function renderPaginacion(totalRecords, dataRef) {
    const pagContainer = document.getElementById('paginationFeed');
    if (!pagContainer) return;

    const totalPages = Math.ceil(totalRecords / gsRecordsPerPage);
    if (totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.className = 'pagination-container-lux';

    // Botón Anterior
    const btnPrev = document.createElement('button');
    btnPrev.className = 'page-btn-lux';
    btnPrev.disabled = gsCurrentPage === 1;
    btnPrev.innerHTML = `<i class="fas fa-chevron-left"></i> Anterior`;
    btnPrev.onclick = () => { gsCurrentPage--; renderTabla(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnPrev);

    // Info Páginas
    const info = document.createElement('span');
    info.className = 'page-info-lux';
    info.textContent = `Página ${gsCurrentPage} de ${totalPages}`;
    nav.appendChild(info);

    // Botón Siguiente
    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn-lux';
    btnNext.disabled = gsCurrentPage === totalPages;
    btnNext.innerHTML = `Siguiente <i class="fas fa-chevron-right"></i>`;
    btnNext.onclick = () => { gsCurrentPage++; renderTabla(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnNext);

    pagContainer.appendChild(nav);
}

/**
 * Calcula días hábiles transcurridos entre dos fechas (Lunes a Viernes)
 * Excluye el día de inicio, incluye el día de fin.
 */
function calcularDiasHabiles(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 0;

    // Normalizar a medianoche para ignorar horas/minutos
    let start = new Date(fechaInicio);
    start.setHours(0, 0, 0, 0);

    let end = new Date(fechaFin);
    end.setHours(0, 0, 0, 0);

    // Si las fechas son iguales, no hay días transcurridos
    if (start.getTime() === end.getTime()) return 0;
    
    if (start > end) return 0;

    let count = 0;
    let curr = new Date(start);
    
    // Avanzar al día siguiente del inicio (excluir día de inicio)
    curr.setDate(curr.getDate() + 1);

    // Contar días hábiles hasta el día de fin (inclusive)
    while (curr <= end) {
        let day = curr.getDay();
        if (day !== 0 && day !== 6) { // 0=Dom, 6=Sab
            count++;
        }
        curr.setDate(curr.getDate() + 1);
    }

    return count;
}

function obtenerPlantaReciente(nombrePlanta) {
    if (!nombrePlanta) return null;
    const search = nombrePlanta.toLowerCase().trim();
    return gsPlantas.find(p => p.PLANTA.toLowerCase().trim() === search) || null;
}

async function actualizarEstado(timestampId, nuevoEstado, selectEl) {
    const row = gsNovedades.find(n => n.ID_NOVEDAD === timestampId);
    const btnContainer = selectEl.closest('.status-btn-lux');
    const originalHTML = btnContainer.innerHTML;
    let respuestaCorreo = "";

    // Validar campos obligatorios al intentar finalizar
    if (nuevoEstado === 'FINALIZADO') {
        const comentarios = (row?.COMENTARIOS || '').trim();
        const cobro = (row?.COBRO || '').trim();
        
        if (!comentarios || !cobro) {
            // Restaurar el select al estado anterior
            selectEl.value = row?.ESTADO || 'ELABORACION';
            
            Swal.fire({
                icon: 'warning',
                title: 'Campos Obligatorios',
                html: `Para finalizar la novedad debe completar:<br><br>
                       ${!comentarios ? '• <b>Comentarios de Resolución</b><br>' : ''}
                       ${!cobro ? '• <b>Tipo de Cobro</b><br>' : ''}
                       <br>Por favor, edite la novedad y complete estos campos.`,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#06b6d4'
            });
            return;
        }
    }

    // Estado de carga en el botón
    selectEl.disabled = true;
    btnContainer.classList.add('is-loading');
    btnContainer.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>SINCRONIZANDO...</span>`;

    try {
        const res = await sendToSupabase({
            accion: "UPDATE_ESTADO", 
            timestampId, 
            nuevoEstado, 
            respuesta: respuestaCorreo, 
            correo: obtenerPlantaReciente(row?.PLANTA)?.EMAIL || '', 
            resLote: row?.LOTE || '' 
        });

        if (row) row.ESTADO = nuevoEstado;
        renderTabla(); // Esto reconstruirá la UI con el nuevo estado y el botón correcto

        // Si se finaliza, cerrar el chat si está abierto y archivar en Drive
        if (nuevoEstado === 'FINALIZADO' && typeof _finalizarChat === 'function') {
            _finalizarChat(timestampId);
        }

        Swal.fire({ 
            icon: 'success', 
            title: 'Estado Actualizado', 
            text: 'El cambio se ha guardado correctamente',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire({ 
            icon: 'error', 
            title: 'Error al Actualizar',
            text: 'No se pudo guardar el cambio. Intente nuevamente.'
        });
        btnContainer.classList.remove('is-loading');
        btnContainer.innerHTML = originalHTML;
        renderTabla();
    }
}

let currentNovedadNotify = null;

/**
 * Selecciona un tipo de cobro Y llena el campo de comentarios con la plantilla correspondiente
 */
function seleccionarCobroYPlantilla(tipo) {
    // 1. Seleccionar el tipo de cobro visualmente
    seleccionarCobro(tipo);
    
    // 2. Llenar el campo de comentarios con la plantilla
    insertarPlantilla(tipo);
}

/**
 * Selecciona un tipo de cobro
 */
function seleccionarCobro(tipo) {
    // Remover selección de todos los botones
    document.querySelectorAll('.cobro-option-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Seleccionar el botón clickeado
    const btnSeleccionado = document.querySelector(`.cobro-option-btn[data-cobro="${tipo}"]`);
    if (btnSeleccionado) {
        btnSeleccionado.classList.add('selected');
    }
    
    // Guardar el valor en el input hidden
    document.getElementById('editCobro').value = tipo;
}

/**
 * Calcula días hábiles desde una fecha hasta hoy
 */
function calcularDiasHabilesHastaHoy(fechaInicioStr) {
    const d1 = parsearFechaLatina(fechaInicioStr);
    if (!d1) return 0;

    let start = new Date(d1);
    let end = new Date();

    if (start > end) return 0; // Es futuro

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let count = 0;
    let current = new Date(start);
    current.setDate(current.getDate() + 1); // Contar desde el día siguiente a la "salida"

    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

/**
 * Inserta una plantilla pre-establecida en el textarea según el tipo de resolución
 */
function insertarPlantilla(tipo) {
    const textarea = document.getElementById('editComentarios');
    const container = document.getElementById('editComentariosContainer');
    
    if (!textarea || !container) {
        console.error('[insertarPlantilla] No se encontró el campo editComentarios o su contenedor');
        return;
    }
    
    // Mostrar el contenedor
    container.style.display = 'block';
    
    let plantilla = '';
    
    switch(tipo) {
        case 'MANO_A_MANO':
            plantilla = 'Nos complace informarle que la presente novedad ha sido resuelta de manera satisfactoria mediante un proceso de compensación directa, sin generar cargos adicionales a su operación. El material correspondiente se encuentra disponible para su retiro en nuestras instalaciones, en el horario de atención establecido de 7:10 a.m. a 4:43 p.m., de lunes a viernes.\n\nEsta modalidad de resolución refleja nuestro compromiso con la agilidad operativa y la construcción de relaciones comerciales basadas en la confianza mutua. Agradecemos su disposición para coordinar el retiro del material en el menor tiempo posible, contribuyendo así a la continuidad de los procesos productivos.';
            textarea.readOnly = true;
            break;
        case 'TALLER':
            plantilla = 'Lamentamos informarle que, de acuerdo con nuestras políticas internas de calidad y control de procesos, así como con los lineamientos establecidos en los acuerdos contractuales entre las partes, es necesario proceder con el cobro correspondiente al faltante identificado en la presente novedad.\n\nEste proceso se encuentra alineado con las condiciones de nuestra relación comercial, las cuales contemplan que cualquier faltante, inconsistencia o incumplimiento en las especificaciones técnicas acordadas debe ser reportado dentro de un plazo máximo de 48 horas o 2 días hábiles posteriores a la recepción del material. En caso contrario, se aplican las medidas administrativas y compensatorias definidas en nuestro reglamento.\n\nAgradecemos de antemano su comprensión y colaboración. Asimismo, aprovechamos para reiterar la importancia del reporte oportuno de novedades, ya que esto nos permite gestionar de manera más ágil las soluciones, optimizar la operación y continuar fortaleciendo la calidad de nuestros procesos conjuntos, en beneficio de ambas partes.';
            textarea.readOnly = true;
            break;
        case 'LINEA':
            plantilla = 'Tras realizar el análisis técnico correspondiente, hemos determinado que la situación reportada tuvo su origen en nuestra línea de producción interna. En consecuencia, y en cumplimiento de nuestros protocolos de calidad y responsabilidad operativa, hemos procedido a implementar las acciones correctivas necesarias de manera inmediata.\n\nLos ajustes requeridos han sido gestionados íntegramente por nuestro equipo técnico, sin generar impacto en sus procesos ni costos adicionales para su operación. Esta resolución se enmarca dentro de nuestro compromiso con la excelencia en la manufactura y la mejora continua de nuestros estándares de producción.\n\nAgradecemos su reporte oportuno, el cual nos permite identificar oportunidades de mejora y garantizar la continuidad de la calidad en nuestros productos.';
            textarea.readOnly = true;
            break;
        case 'REFERENCIA':
            plantilla = 'Después de efectuar la revisión técnica detallada del caso, hemos identificado que la inconsistencia reportada está directamente relacionada con las especificaciones de la referencia en cuestión. Esta situación ha sido abordada mediante la actualización de los parámetros técnicos y la implementación de los ajustes necesarios en nuestros sistemas de control de calidad.\n\nTodas las correcciones han sido gestionadas internamente por nuestro departamento técnico, sin afectar sus tiempos de entrega ni generar costos adicionales a su operación. Este tipo de intervenciones forma parte de nuestro proceso de mejora continua y actualización de fichas técnicas, garantizando la precisión en las especificaciones de nuestros productos.\n\nValoramos su colaboración al reportar esta situación, lo cual contribuye al fortalecimiento de nuestros procesos de desarrollo y control de referencias.';
            textarea.readOnly = true;
            break;
        case 'FICHA':
            plantilla = 'Una vez realizado el análisis exhaustivo de la novedad reportada, confirmamos que la situación está vinculada con la información contenida en la ficha técnica del producto. En respuesta a ello, hemos procedido a realizar las actualizaciones y correcciones pertinentes en la documentación técnica, así como en los sistemas de control de producción asociados.\n\nLas modificaciones implementadas han sido gestionadas completamente por nuestro equipo de ingeniería y calidad, sin impactar sus procesos operativos ni generar cargos a su cuenta. Esta acción se enmarca dentro de nuestro compromiso con la precisión documental y la estandarización de nuestros procesos técnicos.\n\nAgradecemos su atención al detalle y su reporte oportuno, elementos fundamentales para mantener la integridad de nuestra información técnica y la calidad de nuestros productos.';
            textarea.readOnly = true;
            break;
        case 'ENTREGA':
            plantilla = 'Tras la investigación correspondiente, hemos determinado que la situación reportada se originó durante el proceso de entrega y distribución del material. En consecuencia, y de acuerdo con nuestros protocolos de responsabilidad logística, hemos implementado las medidas correctivas necesarias para resolver la incidencia de manera efectiva.\n\nLos ajustes y compensaciones requeridos han sido gestionados íntegramente por nuestro departamento de logística y operaciones, sin afectar sus tiempos de producción ni generar costos adicionales a su operación. Esta resolución refleja nuestro compromiso con la excelencia en el servicio y la responsabilidad en cada etapa de la cadena de suministro.\n\nValoramos su comunicación oportuna, la cual nos permite fortalecer nuestros controles logísticos y garantizar la integridad del material en todo momento.';
            textarea.readOnly = true;
            break;
        case 'PERSONALIZADO':
            // Limpiar el campo para que el operador escriba su propia solución
            plantilla = '';
            textarea.readOnly = false; // Permitir edición
            break;
    }
    
    // Insertar la plantilla en el textarea (o dejarlo vacío si es PERSONALIZADO)
    textarea.value = plantilla;
    
    // Expandir automáticamente el textarea según el contenido
    autoExpandTextarea(textarea);
    
    textarea.focus();
    
    // Pequeña animación visual
    if (tipo === 'PERSONALIZADO') {
        textarea.style.background = '#fffbeb'; // Amarillo suave para indicar que debe escribir
        textarea.placeholder = 'Escriba aquí su solución personalizada...';
    } else {
        textarea.style.background = '#f0f9ff';
        textarea.placeholder = 'Comentarios sobre la resolución de la novedad...';
    }
    
    setTimeout(() => {
        textarea.style.background = '#fafafa';
    }, 300);
}

/**
 * Expande automáticamente el textarea según su contenido
 */
function autoExpandTextarea(textarea) {
    // Reset height para calcular correctamente
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden'; // Ocultar scroll
    
    // Calcular la altura necesaria (scrollHeight + un pequeño margen)
    const scrollHeight = textarea.scrollHeight;
    
    // Establecer la altura (mínimo 3 filas, máximo 20 filas para textos muy largos)
    const minHeight = 60; // ~3 filas
    const maxHeight = 400; // ~20 filas
    const newHeight = Math.min(Math.max(scrollHeight + 2, minHeight), maxHeight);
    
    textarea.style.height = newHeight + 'px';
    
    // Si alcanza el máximo, mostrar scroll
    if (scrollHeight + 2 >= maxHeight) {
        textarea.style.overflowY = 'auto';
    }
}

// Agregar listener para auto-expandir cuando el usuario escribe (solo para PERSONALIZADO)
document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('editComentarios');
    if (textarea) {
        textarea.addEventListener('input', function() {
            if (!this.readOnly) {
                autoExpandTextarea(this);
            }
        });
    }
});

async function notificarSolucion(timestampId) {
    const nov = gsNovedades.find(n => n.ID_NOVEDAD === timestampId);
    if (!nov) {
        Swal.fire({ 
            icon: 'error', 
            title: 'Error',
            text: 'No se encontró la novedad',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    const infoPlanta = obtenerPlantaReciente(nov.PLANTA);
    if (!infoPlanta || !infoPlanta.EMAIL) {
        Swal.fire({ 
            icon: 'warning', 
            title: 'Sin Correo',
            text: 'Esta planta no tiene un correo electrónico registrado',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    // Guardar datos actuales
    currentNovedadNotify = {
        nov: nov,
        infoPlanta: infoPlanta
    };

    // Limpiar textarea
    document.getElementById('notifySolucion').value = '';

    // Mostrar modal
    document.getElementById('modalNotifyOverlay').classList.add('active');
}

function cerrarModalNotify() {
    document.getElementById('modalNotifyOverlay').classList.remove('active');
    currentNovedadNotify = null;
}

async function corregirTextoIA() {
    const textarea = document.getElementById('notifySolucion');
    const texto = textarea.value.trim();

    if (!texto) {
        Swal.fire({
            icon: 'warning',
            title: 'Campo Vacío',
            text: 'Escribe primero la solución para que la IA pueda mejorarla',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    const aiBtn = document.querySelector('.notify-ai-btn');
    const aiStatus = document.getElementById('notifyAiStatus');
    const originalHTML = aiBtn.innerHTML;
    
    aiBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
    aiBtn.disabled = true;
    aiStatus.classList.add('active');

    try {
        const data = await callSupabaseAI(texto, 'CHAT_CORRECTION');

        if (data.success && data.improvedText) {
            // Mostrar el resultado
            aiStatus.innerHTML = '<i class="fas fa-check-circle"></i> ¡Texto mejorado exitosamente!';
            aiStatus.style.background = '#f0fdf4';
            aiStatus.style.borderColor = '#bbf7d0';
            aiStatus.style.color = '#15803d';
            
            textarea.value = data.improvedText;

            setTimeout(() => {
                aiStatus.classList.remove('active');
                setTimeout(() => {
                    aiStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> La IA está mejorando tu texto...';
                    aiStatus.style.background = '#f0f9ff';
                    aiStatus.style.borderColor = '#bae6fd';
                    aiStatus.style.color = '#0369a1';
                }, 300);
            }, 2000);
        } else {
            throw new Error(data.error || 'Error en la respuesta de la IA');
        }

    } catch (error) {
        aiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (error.message || 'Error al procesar el texto');
        aiStatus.style.background = '#fef2f2';
        aiStatus.style.borderColor = '#fecaca';
        aiStatus.style.color = '#dc2626';
        
        setTimeout(() => {
            aiStatus.classList.remove('active');
            setTimeout(() => {
                aiStatus.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> La IA está mejorando tu texto...';
                aiStatus.style.background = '#f0f9ff';
                aiStatus.style.borderColor = '#bae6fd';
                aiStatus.style.color = '#0369a1';
            }, 300);
        }, 3000);
    } finally {
        aiBtn.innerHTML = originalHTML;
        aiBtn.disabled = false;
    }
}

async function enviarNotificacion() {
    // Validar que exista currentNovedadNotify PRIMERO
    if (!currentNovedadNotify) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró la información de la novedad',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    const solucion = document.getElementById('notifySolucion').value.trim();

    if (!solucion) {
        Swal.fire({
            icon: 'warning',
            title: 'Campo Requerido',
            text: 'Debe escribir la solución antes de enviar',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    const btnEnviar = document.getElementById('btnEnviarNotify');
    const originalHTML = btnEnviar.innerHTML;
    btnEnviar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando...';
    btnEnviar.disabled = true;

    try {
        const data = await sendToSupabase({ 
            accion: "NOTIFICAR_SOLUCION", 
            timestampId: currentNovedadNotify.nov.ID_NOVEDAD,
            correo: currentNovedadNotify.infoPlanta.EMAIL,
            planta: currentNovedadNotify.nov.PLANTA,
            lote: currentNovedadNotify.nov.LOTE,
            referencia: currentNovedadNotify.nov.REFERENCIA,
            descripcion: currentNovedadNotify.nov.DESCRIPCION,
            fecha: currentNovedadNotify.nov.FECHA,
            solucion: solucion
        });

        if (data.success === true) {
            // Guardar el email antes de cerrar el modal (que limpia currentNovedadNotify)
            const emailDestino = currentNovedadNotify.infoPlanta.EMAIL;
            cerrarModalNotify();
            Swal.fire({ 
                icon: 'success', 
                title: 'Notificación Enviada', 
                text: `Se ha enviado el correo a ${emailDestino}`,
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            throw new Error(data.message || 'Error al enviar notificación');
        }
    } catch (e) {
        Swal.fire({ 
            icon: 'error', 
            title: 'Error al Enviar',
            text: e.message || 'No se pudo enviar la notificación. Intente nuevamente.'
        });
    } finally {
        btnEnviar.innerHTML = originalHTML;
        btnEnviar.disabled = false;
    }
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const overlay = document.getElementById('modalNotifyOverlay');
    if (e.target === overlay) {
        cerrarModalNotify();
    }
});
function imprimirNovedad(id) {
    const nov = gsNovedades.find(n => n.ID_NOVEDAD === id);
    if (!nov) return;
    
    const infoPlanta = obtenerPlantaReciente(nov.PLANTA);
    
    localStorage.setItem('printNovedad', JSON.stringify(nov));
    localStorage.setItem('printPlanta', JSON.stringify(infoPlanta));
    
    window.open('plantilla-impresion.html', '_blank');
}

async function imprimirChat(id) {
    const nov = gsNovedades.find(n => n.ID_NOVEDAD === id);
    if (!nov) return;

    try {
        Swal.fire({ title: 'Cargando chat...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const data = await _chatFetch({ accion: 'GET_CHAT_MSGS', idNovedad: id });
        const msgs = data.msgs || [];
        localStorage.setItem('printNovedad', JSON.stringify(nov));
        localStorage.setItem('printChatMsgs', JSON.stringify(msgs));
        Swal.close();
        window.open('plantilla-chat.html', '_blank');
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el chat. Intente nuevamente.', timer: 2000, showConfirmButton: false });
    }
}


/**
 * Muestra un modal estético con la información de contacto del taller
 */


/**
 * Muestra una ficha de contacto amplia y estilizada
 */
function verFichaTaller(nombre) {
    const p = obtenerPlantaReciente(nombre);
    if (!p) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin Información',
            text: 'No se encontró información de contacto para esta planta',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }
    if (!p) return;

    Swal.fire({
        title: null,
        html: `
            <style>
                .ficha-tl { position: relative; font-family: 'Inter', sans-serif; text-align: left; }
                .grad-text {
                    background: linear-gradient(135deg, #3f51b5 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .row-lux { 
                    position: relative; 
                    display: flex; 
                    align-items: center; 
                    gap: 15px; 
                    padding: 6px 0;
                    margin-bottom: 8px;
                    white-space: nowrap;
                }
                .hint-lux {
                    position: absolute;
                    left: 0;
                    top: -14px;
                    background: #1e293b;
                    color: white;
                    font-size: 0.55rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.1s ease-out;
                    z-index: 20;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .row-lux:hover .hint-lux {
                    opacity: 1;
                    top: -18px;
                }
                .icon-box-lux {
                    width: 22px;
                    display: flex;
                    justify-content: center;
                    color: #475569;
                    font-size: 1.1rem;
                    transition: all 0.2s;
                }
                .row-lux:hover .icon-box-lux { 
                    transform: scale(1.1);
                    color: #3b82f6;
                }
                .val-lux { 
                    font-size: 0.95rem; 
                    color: #64748b; 
                    transition: color 0.2s;
                }
                .val-link { 
                    text-decoration: none; 
                    font-weight: 700;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .row-lux:hover .val-lux,
                .row-lux:hover .val-link {
                    color: #3b82f6;
                }
                .val-link:hover { opacity: 0.8; }
            </style>

            <div class="ficha-tl">
                <!-- Header con Degradado Institucional -->
                <div style="padding-bottom: 12px; border-bottom: 2px solid #eff6ff; margin-bottom: 20px;">
                    <div style="font-size: 1.2rem; font-weight: 900; display: flex; align-items: center; gap: 12px;" class="grad-text">
                        <i class="fas fa-address-card"></i> Ficha de Contacto
                    </div>
                </div>
                
                <!-- Lista de Datos Auto-Expandible -->
                <div style="display: flex; flex-direction: column;">
                    <div class="row-lux">
                        <span class="hint-lux">Planta</span>
                        <div class="icon-box-lux"><i class="fas fa-industry"></i></div>
                        <span class="val-lux" style="font-weight: 400; text-transform: uppercase;">${p.PLANTA}</span>
                    </div>

                    ${p.ID_PLANTA ? `
                    <div class="row-lux">
                        <span class="hint-lux">NIT o Cédula</span>
                        <div class="icon-box-lux"><i class="fas fa-id-card"></i></div>
                        <span class="val-lux" style="font-weight: 600;">${p.ID_PLANTA}</span>
                    </div>` : ''}

                    ${p.TELEFONO ? `
                    <div class="row-lux">
                        <span class="hint-lux">Teléfono</span>
                        <div class="icon-box-lux"><i class="fas fa-phone"></i></div>
                        <a href="tel:${p.TELEFONO}" class="val-link" style="font-size: 0.95rem;">${p.TELEFONO}</a>
                    </div>` : ''}

                    ${p.DIRECCION ? `
                    <div class="row-lux" style="align-items: center;">
                        <span class="hint-lux">Dirección</span>
                        <div class="icon-box-lux"><i class="fas fa-map-marker-alt"></i></div>
                        <span class="val-lux" style="font-weight: 500;">${p.DIRECCION}</span>
                    </div>` : ''}

                    ${p.EMAIL ? `
                    <div class="row-lux">
                        <span class="hint-lux">Correo</span>
                        <div class="icon-box-lux"><i class="fas fa-envelope"></i></div>
                        <a href="mailto:${p.EMAIL}" class="val-link" style="font-size: 0.95rem;">${p.EMAIL}</a>
                    </div>` : ''}
                </div>
            </div>
        `,
        showConfirmButton: false,
        width: 'auto',
        padding: '1.75rem',
        background: '#ffffff',
        showCloseButton: false,
        backdrop: 'rgba(15, 23, 42, 0.15)',
        customClass: {
            popup: 'shadow-2xl border-0 rounded-4'
        }
    });
}

/**
 * Motor de parseo de fechas ultra-resiliente
 */
function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let s = String(d).trim();
    if (!s) return null;

    // 1. Detectar Separadores (Soporte para / y -)
    const sep = s.includes('/') ? '/' : (s.includes('-') ? '-' : null);

    if (sep) {
        const parts = s.split(/\s+/); // Separa fecha de hora
        const dateParts = parts[0].split(sep);

        if (dateParts.length === 3) {
            let dia, mes, anio;
            
            // Caso YYYY-MM-DD (Formato ISO de Sheets)
            if (dateParts[0].length === 4) {
                anio = parseInt(dateParts[0]);
                mes = parseInt(dateParts[1]) - 1;
                dia = parseInt(dateParts[2]);
            }
            // Caso DD/MM/YYYY o DD-MM-YYYY (Formato Latino)
            else if (dateParts[2].length === 4) {
                dia = parseInt(dateParts[0]);
                mes = parseInt(dateParts[1]) - 1;
                anio = parseInt(dateParts[2]);
            }
            // Caso DD/MM/YY o DD-MM-YY (Año corto)
            else if (dateParts[2].length === 2) {
                dia = parseInt(dateParts[0]);
                mes = parseInt(dateParts[1]) - 1;
                anio = parseInt('20' + dateParts[2]);
            }
            // Caso con mes en texto (ene, feb, mar...)
            else if (isNaN(dateParts[1])) {
                dia = parseInt(dateParts[0]);
                const meses = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };
                mes = meses[dateParts[1].toLowerCase().substring(0, 3)] || 0;
                anio = parseInt(dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2]);
            }

            if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
                let fecha = new Date(anio, mes, dia);
                // Si hay hora (HH:mm:ss)
                if (parts[1] && parts[1].includes(':')) {
                    const timeParts = parts[1].split(':');
                    fecha.setHours(parseInt(timeParts[0]) || 0, parseInt(timeParts[1]) || 0, parseInt(timeParts[2]) || 0);
                }
                
                // Validar que la fecha sea válida
                if (!isNaN(fecha.getTime())) {
                    return fecha;
                }
            }
        }
    }

    // Fallback al parse nativo solo si lo de arriba falla
    const dtFallback = new Date(d);
    if (!isNaN(dtFallback.getTime())) {
        return dtFallback;
    }
    
    return null;
}

function formatearHora(d) {
    const dt = parsearFechaLatina(d);
    return dt ? dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
}

/* ── Toggle KPIs ── */
function toggleKPIs() {
    const container = document.getElementById('kpiContainer');
    const chevron = document.getElementById('kpiChevron');
    if (!container) return;
    const open = container.style.display === 'none' || container.style.display === '';
    container.style.display = open ? 'grid' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

/* ── Toggle cerradas con ojo ── */
async function _toggleFinalizados() {
    const checkbox = document.getElementById('toggleFinalizados');
    const icon = document.getElementById('icon-toggle-cerradas');
    const label = document.getElementById('label-toggle-cerradas');
    if (!checkbox) return;
    
    checkbox.checked = !checkbox.checked;
    const showing = checkbox.checked;
    
    if (icon) icon.className = showing ? 'fas fa-eye-slash' : 'fas fa-eye';
    if (label) label.textContent = showing ? 'Ocultar' : 'Cerradas';
    
    gsCurrentPage = 1;
    
    // Recargar datos desde Supabase según el estado del toggle
    await cargarDatos(showing);
}


let currentEditNovedad = null;

// Opciones para cada tipo de área (copiadas de novedades.js para el modal de edición)
const EDIT_INSUMOS_OPCIONES = [
    'ETIQUETA','PLACA','PLASTIFLECHA','TRAZABILIDAD','ELASTICO',
    'ARGOLLA','TENSOR','FRAMILON','TRANSFER','MARQUILLA',
    'CIERRE','CORDON','HILADILLA','HERRAJE','HEBILLA','ABROCHADURA',
    'APLIQUE','BOTON','GANCHO','PUNTERAS','COPA','ENCAJE','VARILLA',
    'ENTRETELA','VELCRO','OJALES','REMACHES','OTROS'
];

const EDIT_CORTE_OPCIONES = ['PIEZAS', 'SESGO', 'ENTRETELA'];

const EDIT_TELAS_OPCIONES = ['ROTOS', 'MANCHAS', 'HIDOS', 'MAREADA', 'TONO', 'SE DESTIÑE', 'SE ROMPE', 'OTROS'];

/**
 * Construye opciones HTML para un select
 */
function _buildOptionsEdit(lista) {
    return '<option value="">Seleccione...</option>' +
        lista.map(o => `<option value="${o}">${o}</option>`).join('');
}

/**
 * Maneja el cambio de área en el modal de edición
 */
function handleEditAreaChange() {
    const area = document.getElementById('editArea').value;
    const insumoGroup = document.getElementById('editTipoInsumoGroup');
    const corteGroup = document.getElementById('editTipoCorteGroup');
    const telasGroup = document.getElementById('editTipoTelasGroup');
    const codigosGroup = document.getElementById('editTipoCodigosGroup');
    const cantidadNormal = document.getElementById('editCantidadNormalGroup');
    const cantidadNormalInput = document.getElementById('editCantidadNormal');
    const cantidadDiseno = document.getElementById('editCantidadDisenoGroup');
    const cantidadDisenoInput = document.getElementById('editCantidadSolicitada');
    const tipoNovedadGroup = document.getElementById('editTipoNovedadGroup');
    const tipoNovedadSelect = document.getElementById('editTipoNovedad');
    const areaNovedadRow = document.getElementById('editAreaNovedadRow');

    // Ocultar todo primero y remover required
    insumoGroup.classList.add('hidden');
    corteGroup.classList.add('hidden');
    telasGroup.classList.add('hidden');
    codigosGroup.classList.add('hidden');
    cantidadNormal.classList.add('hidden');
    cantidadDiseno.classList.add('hidden');
    cantidadNormalInput.required = false;
    cantidadDisenoInput.required = false;

    if (area === 'DISEÑO') {
        tipoNovedadGroup.classList.add('hidden');
        tipoNovedadSelect.required = false;
        cantidadDiseno.classList.remove('hidden');
        cantidadDisenoInput.required = true;
        cantidadDisenoInput.readOnly = false;
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (area === 'TELAS') {
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.value = 'IMPERFECTO';
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = true;
        telasGroup.classList.remove('hidden');
        // Si no hay filas, agregar una por defecto
        if (document.getElementById('editTelasList').children.length === 0) {
            agregarFilaEditTela();
        }
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (area === 'INSUMOS') {
        insumoGroup.classList.remove('hidden');
        // Si no hay filas, agregar una por defecto
        if (document.getElementById('editInsumosList').children.length === 0) {
            agregarFilaEditInsumo();
        }
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (area === 'CORTE') {
        corteGroup.classList.remove('hidden');
        // Si no hay filas, agregar una por defecto
        if (document.getElementById('editCorteList').children.length === 0) {
            agregarFilaEditCorte();
        }
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (area === 'CODIGOS') {
        codigosGroup.classList.remove('hidden');
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (area !== '') {
        cantidadNormal.classList.remove('hidden');
        cantidadNormalInput.required = true;
        cantidadNormalInput.readOnly = false;
        cantidadNormalInput.value = '';
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else {
        areaNovedadRow.style.gridTemplateColumns = '1fr';
    }
}

/**
 * Maneja el cambio de tipo de solicitud en códigos (modal de edición)
 */
async function handleEditCodigosTipoChange() {
    const tipo = document.getElementById('editCodigosTipoSolicitud').value;
    const loteCompletoGroup = document.getElementById('editCodigosLoteCompletoGroup');
    const unidadesGroup = document.getElementById('editCodigosUnidadesGroup');
    const cantidadInput = document.getElementById('editCodigosCantidadTotal');
    const rowGrid = document.getElementById('editCodigosRowGrid');
    
    if (tipo === 'LOTE_COMPLETO') {
        loteCompletoGroup.classList.remove('hidden');
        unidadesGroup.classList.add('hidden');
        cantidadInput.disabled = false;
        rowGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (tipo === 'UNIDADES') {
        loteCompletoGroup.classList.add('hidden');
        unidadesGroup.classList.remove('hidden');
        cantidadInput.disabled = true;
        rowGrid.style.gridTemplateColumns = '1fr';
        
        // Cargar la curva si no está cargada aún
        if (!window.EDIT_CODIGOS_TALLAS || !window.EDIT_CODIGOS_COLORES) {
            console.log('[handleEditCodigosTipoChange] Cargando curva para cambio a UNIDADES');
            const lote = currentEditNovedad ? currentEditNovedad.LOTE : null;
            if (lote) {
                await cargarCurvaParaCodigosEdit(lote);
            }
        }
        
        // Si no hay filas, agregar una por defecto
        const lista = document.getElementById('editCodigosList');
        if (lista.children.length === 0) {
            agregarFilaCodigoEdit();
        }
    } else {
        loteCompletoGroup.classList.add('hidden');
        unidadesGroup.classList.add('hidden');
        cantidadInput.disabled = true;
        rowGrid.style.gridTemplateColumns = '1fr';
    }
}

/**
 * Abre el modal para editar una novedad
 */
async function editarNovedad(timestampId) {
    const nov = gsNovedades.find(n => n.ID_NOVEDAD === timestampId);
    if (!nov) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró la novedad',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    currentEditNovedad = nov;

    console.log('[editarNovedad] Cargando datos:', nov);

    try {
        // Limpiar listas dinámicas primero
        document.getElementById('editInsumosList').innerHTML = '';
        document.getElementById('editCorteList').innerHTML = '';
        document.getElementById('editTelasList').innerHTML = '';
        document.getElementById('editCodigosList').innerHTML = '';

        // Llenar datos de contexto (solo lectura)
        document.getElementById('editNovedadId').textContent = nov.ID_NOVEDAD || '-';
        document.getElementById('editNovedadLote').textContent = nov.LOTE || '-';
        document.getElementById('editNovedadPlanta').textContent = nov.PLANTA || '-';
        document.getElementById('editNovedadRef').textContent = nov.REFERENCIA || '-';

        // Llenar campos editables básicos
        document.getElementById('editArea').value = nov.AREA || '';
        document.getElementById('editTipoNovedad').value = nov.TIPO_NOVEDAD || '';
        document.getElementById('editDescripcion').value = nov.DESCRIPCION || '';
        
        // Cargar comentarios
        const comentariosField = document.getElementById('editComentarios');
        const comentariosContainer = document.getElementById('editComentariosContainer');
        
        if (nov.COMENTARIOS) {
            comentariosField.value = nov.COMENTARIOS;
            comentariosContainer.style.display = 'block';
        } else {
            comentariosField.value = '';
            comentariosContainer.style.display = 'none';
        }
        
        // Cargar tipo de cobro si existe
        if (nov.COBRO) {
            seleccionarCobro(nov.COBRO);
            // Si hay cobro, también mostrar el contenedor de comentarios
            if (!nov.COMENTARIOS) {
                comentariosContainer.style.display = 'block';
            }
            // Establecer readonly según el tipo de cobro
            if (nov.COBRO === 'PERSONALIZADO') {
                comentariosField.readOnly = false;
            } else {
                comentariosField.readOnly = true;
            }
        } else {
            // No seleccionar nada automáticamente
            document.getElementById('editCobro').value = '';
        }

        // Parsear TIPO_DETALLE si existe
        let tipoDetalle = null;
        try {
            if (nov.TIPO_DETALLE) {
                tipoDetalle = typeof nov.TIPO_DETALLE === 'string' ? JSON.parse(nov.TIPO_DETALLE) : nov.TIPO_DETALLE;
                console.log('[editarNovedad] TIPO_DETALLE parseado:', tipoDetalle);
            }
        } catch (e) {
            console.error('[editarNovedad] Error al parsear TIPO_DETALLE:', e);
        }

        // Cargar datos según el área
        if (nov.AREA === 'DISEÑO') {
            document.getElementById('editCantidadSolicitada').value = nov.CANTIDAD_SOLICITADA || 0;
        } else if (nov.AREA === 'OTROS') {
            document.getElementById('editCantidadNormal').value = nov.CANTIDAD_SOLICITADA || 0;
        } else if (tipoDetalle) {
            // Cargar datos dinámicos según el tipo
            if (tipoDetalle.items && Array.isArray(tipoDetalle.items)) {
                // Verificar si es CÓDIGOS con items (UNIDADES) o INSUMOS/CORTE/TELAS
                if (nov.AREA === 'CODIGOS' && tipoDetalle.tipo_solicitud === 'UNIDADES') {
                    // CÓDIGOS UNIDADES - Primero cargar la curva para tener las opciones
                    console.log('[editarNovedad] Cargando CÓDIGOS UNIDADES:', tipoDetalle);
                    document.getElementById('editCodigosTipoSolicitud').value = 'UNIDADES';
                    
                    // Cargar curva para obtener opciones de tallas y colores
                    await cargarCurvaParaCodigosEdit(nov.LOTE);
                    
                    // Agregar cada unidad
                    tipoDetalle.items.forEach((item, index) => {
                        agregarFilaCodigoEdit(item.talla || '', item.color || '', item.cantidad || '');
                        console.log(`[editarNovedad] Unidad ${index + 1} cargada:`, item);
                    });
                } else {
                    // INSUMOS, CORTE, TELAS
                    if (nov.AREA === 'INSUMOS') {
                        console.log(`[editarNovedad] Cargando ${tipoDetalle.items.length} insumos`);
                        tipoDetalle.items.forEach((item, index) => {
                            agregarFilaEditInsumo(item.tipo || '', item.cantidad || '');
                            console.log(`[editarNovedad] Insumo ${index + 1} cargado:`, item);
                        });
                    } else if (nov.AREA === 'CORTE') {
                        console.log(`[editarNovedad] Cargando ${tipoDetalle.items.length} items de corte`);
                        tipoDetalle.items.forEach((item, index) => {
                            agregarFilaEditCorte(item.tipo || '', item.cantidad || '');
                            console.log(`[editarNovedad] Corte ${index + 1} cargado:`, item);
                        });
                    } else if (nov.AREA === 'TELAS') {
                        console.log(`[editarNovedad] Cargando ${tipoDetalle.items.length} items de telas`);
                        tipoDetalle.items.forEach((item, index) => {
                            agregarFilaEditTela(item.tipo || '', item.cantidad || '');
                            console.log(`[editarNovedad] Tela ${index + 1} cargada:`, item);
                        });
                    }
                }
            } else if (tipoDetalle.tipo_solicitud === 'LOTE_COMPLETO') {
                // CÓDIGOS LOTE COMPLETO
                console.log('[editarNovedad] Cargando CÓDIGOS LOTE_COMPLETO:', tipoDetalle);
                document.getElementById('editCodigosTipoSolicitud').value = 'LOTE_COMPLETO';
                document.getElementById('editCodigosCantidadTotal').value = tipoDetalle.cantidad_total || 0;
                
                // Cargar la curva también para LOTE_COMPLETO por si el usuario quiere cambiar a UNIDADES
                await cargarCurvaParaCodigosEdit(nov.LOTE);
            }
        } else {
            // Si no hay TIPO_DETALLE pero hay cantidad, es un área simple
            if (nov.CANTIDAD_SOLICITADA && nov.AREA !== 'DISEÑO' && nov.AREA !== 'OTROS') {
                document.getElementById('editCantidadNormal').value = nov.CANTIDAD_SOLICITADA || 0;
            }
        }

        // Trigger area change para mostrar campos correctos
        handleEditAreaChange();

        // Si es CÓDIGOS, trigger el change del tipo de solicitud para mostrar los campos correctos
        if (nov.AREA === 'CODIGOS') {
            handleEditCodigosTipoChange();
        }

    } catch (error) {
        console.error('[editarNovedad] Error al cargar datos:', error);
        Swal.fire({
            icon: 'warning',
            title: 'Advertencia',
            text: 'Algunos datos no se pudieron cargar correctamente. Revisa la consola para más detalles.',
            confirmButtonText: 'Continuar'
        });
    }

    // Mostrar modal siempre (incluso si hubo errores al cargar datos)
    document.getElementById('modalEditNovedad').style.display = 'flex';
    
    // Expandir textarea después de que el modal sea visible
    const comentariosField = document.getElementById('editComentarios');
    if (comentariosField && comentariosField.value) {
        setTimeout(() => {
            autoExpandTextarea(comentariosField);
        }, 50);
    }
}

/**
 * Agrega una fila de insumo en el modal de edición
 */
function agregarFilaEditInsumo(tipoVal = '', cantVal = '') {
    const lista = document.getElementById('editInsumosList');
    const fila = document.createElement('div');
    fila.className = 'insumo-fila row-pc-grid mb-3';
    
    const opcionesHTML = _buildOptionsEdit(EDIT_INSUMOS_OPCIONES);
    
    fila.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-tags input-icon"></i>
            <select class="form-control insumo-tipo">
                ${opcionesHTML}
            </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="input-with-icon" style="flex:1;">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control insumo-cantidad" min="1" value="${cantVal}">
            </div>
            <button type="button" class="btn-eliminar-insumo"
                onclick="eliminarFilaEditInsumo(this)" title="Eliminar"
                style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:8px;
                       color:#ef4444; width:40px; height:40px; cursor:pointer; font-size:0.9rem;
                       display:flex; align-items:center; justify-content:center; transition:all 0.15s;"
                onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    lista.appendChild(fila);
    
    // Establecer el valor seleccionado
    if (tipoVal) {
        fila.querySelector('.insumo-tipo').value = tipoVal;
    }
    
    actualizarBotonesEliminarEdit('editInsumosList');
}

function eliminarFilaEditInsumo(btn) {
    const lista = document.getElementById('editInsumosList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    actualizarBotonesEliminarEdit('editInsumosList');
}

/**
 * Agrega una fila de corte en el modal de edición
 */
function agregarFilaEditCorte(tipoVal = '', cantVal = '') {
    const lista = document.getElementById('editCorteList');
    const fila = document.createElement('div');
    fila.className = 'insumo-fila row-pc-grid mb-3';
    
    const opcionesHTML = _buildOptionsEdit(EDIT_CORTE_OPCIONES);
    
    fila.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-tags input-icon"></i>
            <select class="form-control insumo-tipo">
                ${opcionesHTML}
            </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="input-with-icon" style="flex:1;">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control insumo-cantidad" min="1" value="${cantVal}">
            </div>
            <button type="button" class="btn-eliminar-insumo"
                onclick="eliminarFilaEditCorte(this)" title="Eliminar"
                style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:8px;
                       color:#ef4444; width:40px; height:40px; cursor:pointer; font-size:0.9rem;
                       display:flex; align-items:center; justify-content:center; transition:all 0.15s;"
                onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    lista.appendChild(fila);
    
    // Establecer el valor seleccionado
    if (tipoVal) {
        fila.querySelector('.insumo-tipo').value = tipoVal;
    }
    
    actualizarBotonesEliminarEdit('editCorteList');
}

function eliminarFilaEditCorte(btn) {
    const lista = document.getElementById('editCorteList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    actualizarBotonesEliminarEdit('editCorteList');
}

/**
 * Agrega una fila de tela en el modal de edición
 */
function agregarFilaEditTela(tipoVal = '', cantVal = '') {
    const lista = document.getElementById('editTelasList');
    const fila = document.createElement('div');
    fila.className = 'insumo-fila row-pc-grid mb-3';
    
    const opcionesHTML = _buildOptionsEdit(EDIT_TELAS_OPCIONES);
    
    fila.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-tags input-icon"></i>
            <select class="form-control insumo-tipo">
                ${opcionesHTML}
            </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="input-with-icon" style="flex:1;">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control insumo-cantidad" min="1" value="${cantVal}">
            </div>
            <button type="button" class="btn-eliminar-insumo"
                onclick="eliminarFilaEditTela(this)" title="Eliminar"
                style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:8px;
                       color:#ef4444; width:40px; height:40px; cursor:pointer; font-size:0.9rem;
                       display:flex; align-items:center; justify-content:center; transition:all 0.15s;"
                onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    lista.appendChild(fila);
    
    // Establecer el valor seleccionado
    if (tipoVal) {
        fila.querySelector('.insumo-tipo').value = tipoVal;
    }
    
    actualizarBotonesEliminarEdit('editTelasList');
}

function eliminarFilaEditTela(btn) {
    const lista = document.getElementById('editTelasList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    actualizarBotonesEliminarEdit('editTelasList');
}

/**
 * Carga la curva de la OP para el modal de edición
 */
async function cargarCurvaParaCodigosEdit(op) {
    console.log('[cargarCurvaParaCodigosEdit] Buscando curva para OP:', op);
    
    if (!op) {
        console.warn('[cargarCurvaParaCodigosEdit] No se proporcionó OP');
        return;
    }

    try {
        // Verificar cache primero (usar el mismo cache global de novedades.js)
        if (window.CURVAS_CACHE && window.CURVAS_CACHE[op]) {
            console.log('[cargarCurvaParaCodigosEdit] Usando cache para OP:', op);
            poblarCodigosDesdeDetallesEdit(window.CURVAS_CACHE[op].detalles);
            return;
        }

        // Fetch desde API filtrando por OP directamente
        const url = `https://doqsurxxxaudnutsydlk.supabase.co/functions/v1/query?table=CURVA&op=${encodeURIComponent(op)}`;
        console.log('[cargarCurvaParaCodigosEdit] Fetching desde:', url);
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al cargar curva');
        
        const data = await response.json();
        console.log('[cargarCurvaParaCodigosEdit] Registros recibidos:', data.length);
        
        const curva = Array.isArray(data) ? data[0] : data;
        
        if (!curva || !curva.detalles || curva.detalles.length === 0) {
            console.warn('[cargarCurvaParaCodigosEdit] No se encontró curva para la OP:', op);
            return;
        }
        
        console.log('[cargarCurvaParaCodigosEdit] ✓ Curva encontrada con', curva.detalles.length, 'detalles');
        
        // Guardar en cache global
        if (!window.CURVAS_CACHE) window.CURVAS_CACHE = {};
        window.CURVAS_CACHE[op] = curva;
        
        poblarCodigosDesdeDetallesEdit(curva.detalles);
        
    } catch (error) {
        console.error('[cargarCurvaParaCodigosEdit] Error:', error);
    }
}

/**
 * Procesa los detalles de la curva para el modal de edición
 */
function poblarCodigosDesdeDetallesEdit(detalles) {
    // Extraer opciones únicas de tallas y colores
    const tallasUnicas = [...new Set(detalles.map(d => d[3]))].sort();
    const coloresUnicos = [...new Set(detalles.map(d => d[1]))].sort();
    
    // Calcular cantidad total del lote
    const cantidadTotal = detalles.reduce((sum, d) => sum + Number(d[4]), 0);
    
    console.log('[poblarCodigosDesdeDetallesEdit] Tallas únicas:', tallasUnicas);
    console.log('[poblarCodigosDesdeDetallesEdit] Colores únicos:', coloresUnicos);
    console.log('[poblarCodigosDesdeDetallesEdit] Cantidad total del lote:', cantidadTotal);
    
    // Guardar opciones y detalles globalmente para el modal de edición
    window.EDIT_CODIGOS_TALLAS = tallasUnicas;
    window.EDIT_CODIGOS_COLORES = coloresUnicos;
    window.EDIT_CODIGOS_DETALLES = detalles;
    window.EDIT_CODIGOS_CANTIDAD_TOTAL = cantidadTotal;
    
    // Establecer la cantidad total en el input si existe
    const cantidadInput = document.getElementById('editCodigosCantidadTotal');
    if (cantidadInput) {
        cantidadInput.value = cantidadTotal;
    }
}

/**
 * Agrega una fila de código con valores prellenados (para edición)
 */
function agregarFilaCodigoEdit(tallaVal = '', colorVal = '', cantVal = '') {
    const lista = document.getElementById('editCodigosList');
    const fila  = document.createElement('div');
    fila.className = 'insumo-fila mb-3';
    fila.style.cssText = 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; align-items:center;';
    
    // Opciones de tallas
    const tallasOpts = (window.EDIT_CODIGOS_TALLAS || []).map(t => 
        `<option value="${t}" ${t === tallaVal ? 'selected' : ''}>${t}</option>`
    ).join('');
    
    // Opciones de colores
    const coloresOpts = (window.EDIT_CODIGOS_COLORES || []).map(c => 
        `<option value="${c}" ${c === colorVal ? 'selected' : ''}>${c}</option>`
    ).join('');
    
    fila.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-ruler input-icon"></i>
            <select class="form-control codigo-talla" onchange="actualizarMaximoCodigoEdit(this)">
                <option value="">Talla...</option>
                ${tallasOpts}
            </select>
        </div>
        <div class="input-with-icon">
            <i class="fas fa-palette input-icon"></i>
            <select class="form-control codigo-color" onchange="actualizarMaximoCodigoEdit(this)">
                <option value="">Color...</option>
                ${coloresOpts}
            </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="input-with-icon" style="flex:1;">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control codigo-cantidad" value="${cantVal}" min="1" placeholder="Máx: -">
            </div>
            <button type="button" class="btn-eliminar-insumo"
                onclick="eliminarFilaCodigoEdit(this)" title="Eliminar"
                style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:8px;
                       color:#ef4444; width:40px; height:40px; cursor:pointer; font-size:0.9rem;
                       display:flex; align-items:center; justify-content:center; transition:all 0.15s;"
                onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    lista.appendChild(fila);
    actualizarBotonesEliminarEdit('editCodigosList');
    
    // Si hay valores preseleccionados, actualizar el máximo
    if (tallaVal && colorVal) {
        const select = fila.querySelector('.codigo-talla');
        actualizarMaximoCodigoEdit(select);
    }
}

/**
 * Actualiza el máximo permitido para un código en el modal de edición
 */
function actualizarMaximoCodigoEdit(selectElement) {
    const fila = selectElement.closest('.insumo-fila');
    const talla = fila.querySelector('.codigo-talla').value;
    const color = fila.querySelector('.codigo-color').value;
    const inputCantidad = fila.querySelector('.codigo-cantidad');
    
    if (!talla || !color) {
        inputCantidad.placeholder = 'Máx: -';
        inputCantidad.max = '';
        return;
    }
    
    // Buscar el máximo en los detalles
    const detalle = (window.EDIT_CODIGOS_DETALLES || []).find(d => 
        d[3] === talla && d[1] === color
    );
    
    if (detalle) {
        const maximo = detalle[4];
        inputCantidad.max = maximo;
        inputCantidad.placeholder = `Máx: ${maximo}`;
        console.log(`[actualizarMaximoCodigoEdit] Máximo para ${talla}/${color}: ${maximo}`);
    } else {
        inputCantidad.placeholder = 'Máx: -';
        inputCantidad.max = '';
    }
}

/**
 * Elimina una fila de código del modal de edición
 */
function eliminarFilaCodigoEdit(btn) {
    const lista = document.getElementById('editCodigosList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    actualizarBotonesEliminarEdit('editCodigosList');
}

/**
 * Actualiza la visibilidad de los botones de eliminar en listas del modal de edición
 */
function actualizarBotonesEliminarEdit(listId) {
    const lista = document.getElementById(listId);
    if (!lista) return;
    
    const filas = lista.querySelectorAll('.insumo-fila');
    const hayMultiples = filas.length > 1;
    
    filas.forEach(fila => {
        const btn = fila.querySelector('.btn-eliminar-insumo');
        if (!btn) return;
        
        if (hayMultiples) {
            // Mostrar botón y ajustar grid para incluirlo
            btn.style.display = 'flex';
            const container = btn.parentElement;
            if (container) container.style.display = 'flex';
        } else {
            // Ocultar botón y expandir input
            btn.style.display = 'none';
            const container = btn.parentElement;
            if (container) container.style.display = 'block';
        }
    });
}

/**
 * Cierra el modal de edición
 */
function cerrarModalEditNovedad() {
    document.getElementById('modalEditNovedad').style.display = 'none';
    currentEditNovedad = null;
    
    // Limpiar listas dinámicas
    document.getElementById('editInsumosList').innerHTML = '';
    document.getElementById('editCorteList').innerHTML = '';
    document.getElementById('editTelasList').innerHTML = '';
    document.getElementById('editCodigosList').innerHTML = '';
}

/**
 * Recolecta datos de filas dinámicas del modal de edición
 */
function _recolectarFilasEdit(listId) {
    const filas = document.querySelectorAll(`#${listId} .insumo-fila`);
    const datos = [];
    let valido = true;
    filas.forEach(fila => {
        const tipo = fila.querySelector('.insumo-tipo').value;
        const cant = fila.querySelector('.insumo-cantidad').value;
        if (!tipo || !cant) { valido = false; return; }
        datos.push({ tipo, cantidad: parseInt(cant) });
    });
    return valido ? datos : null;
}

/**
 * Recolecta datos de códigos del modal de edición
 */
function _recolectarCodigosEdit() {
    const filas = document.querySelectorAll('#editCodigosList .insumo-fila');
    const datos = [];
    let valido = true;
    filas.forEach(fila => {
        const tallaSelect = fila.querySelector('.codigo-talla');
        const colorSelect = fila.querySelector('.codigo-color');
        const cantInput = fila.querySelector('.codigo-cantidad');
        
        const talla = tallaSelect ? tallaSelect.value : '';
        const color = colorSelect ? colorSelect.value : '';
        const cant = cantInput ? cantInput.value : '';
        
        if (!talla || !color || !cant) { valido = false; return; }
        datos.push({ talla, color, cantidad: parseInt(cant) });
    });
    return valido ? datos : null;
}

/**
 * Guarda los cambios de la novedad editada
 */
async function guardarEdicionNovedad() {
    if (!currentEditNovedad) return;

    const area = document.getElementById('editArea').value;
    const tipoNovedad = document.getElementById('editTipoNovedad').value || null;
    const descripcion = document.getElementById('editDescripcion').value.trim();
    const comentarios = document.getElementById('editComentarios').value.trim();
    const cobro = document.getElementById('editCobro').value || null;

    let cantidadSolicitada = 0;
    let tipoDetalle = null;

    try {
        // Construir TIPO_DETALLE según el área
        if (area === 'DISEÑO') {
            cantidadSolicitada = parseInt(document.getElementById('editCantidadSolicitada').value) || 0;
            tipoDetalle = null;
        } else if (area === 'TELAS') {
            const datos = _recolectarFilasEdit('editTelasList');
            if (!datos) throw new Error('Complete el tipo y cantidad de todas las imperfecciones de tela.');
            tipoDetalle = { items: datos };
            cantidadSolicitada = datos.reduce((s, i) => s + i.cantidad, 0);
        } else if (area === 'INSUMOS') {
            const datos = _recolectarFilasEdit('editInsumosList');
            if (!datos) throw new Error('Complete el tipo y cantidad de todos los insumos.');
            tipoDetalle = { items: datos };
            cantidadSolicitada = datos.reduce((s, i) => s + i.cantidad, 0);
        } else if (area === 'CORTE') {
            const datos = _recolectarFilasEdit('editCorteList');
            if (!datos) throw new Error('Complete el tipo y cantidad de todas las piezas de corte.');
            tipoDetalle = { items: datos };
            cantidadSolicitada = datos.reduce((s, i) => s + i.cantidad, 0);
        } else if (area === 'CODIGOS') {
            const tipoSolicitud = document.getElementById('editCodigosTipoSolicitud').value;
            if (!tipoSolicitud) throw new Error('Seleccione el tipo de solicitud.');
            
            if (tipoSolicitud === 'LOTE_COMPLETO') {
                cantidadSolicitada = parseInt(document.getElementById('editCodigosCantidadTotal').value) || 0;
                tipoDetalle = {
                    tipo_solicitud: 'LOTE_COMPLETO',
                    cantidad_total: cantidadSolicitada
                };
            } else if (tipoSolicitud === 'UNIDADES') {
                const datos = _recolectarCodigosEdit();
                if (!datos) throw new Error('Complete talla, color y cantidad de todos los códigos.');
                
                tipoDetalle = {
                    tipo_solicitud: 'UNIDADES',
                    items: datos
                };
                cantidadSolicitada = datos.reduce((s, i) => s + i.cantidad, 0);
            }
        } else {
            cantidadSolicitada = parseInt(document.getElementById('editCantidadNormal').value) || 0;
            tipoDetalle = null;
        }

        if (cantidadSolicitada < 0) {
            throw new Error('La cantidad no puede ser negativa');
        }

        console.log('[guardarEdicionNovedad] Datos a enviar:', {
            area, tipoNovedad, tipoDetalle, cantidadSolicitada, descripcion, comentarios, cobro
        });

    } catch (error) {
        Swal.fire({
            icon: 'warning',
            title: 'Validación',
            text: error.message,
            confirmButtonText: 'OK'
        });
        return;
    }

    // Deshabilitar botón
    const btnGuardar = document.getElementById('btnGuardarEdit');
    const originalHTML = btnGuardar.innerHTML;
    btnGuardar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
    btnGuardar.disabled = true;

    try {
        const result = await sendToSupabase({
            accion: 'UPDATE_NOVEDAD',
            timestampId: currentEditNovedad.ID_NOVEDAD,
            area: area,
            tipoNovedad: tipoNovedad,
            tipoDetalle: tipoDetalle,
            cantidadSolicitada: cantidadSolicitada,
            descripcion: descripcion,
            comentarios: comentarios,
            cobro: cobro
        });

        if (result.success) {
            // Actualizar datos locales
            const novIndex = gsNovedades.findIndex(n => n.ID_NOVEDAD === currentEditNovedad.ID_NOVEDAD);
            if (novIndex !== -1) {
                gsNovedades[novIndex].AREA = area;
                gsNovedades[novIndex].TIPO_NOVEDAD = tipoNovedad;
                gsNovedades[novIndex].TIPO_DETALLE = tipoDetalle;
                gsNovedades[novIndex].CANTIDAD_SOLICITADA = cantidadSolicitada;
                gsNovedades[novIndex].DESCRIPCION = descripcion;
                gsNovedades[novIndex].COMENTARIOS = comentarios;
                gsNovedades[novIndex].COBRO = cobro;
            }

            // Cerrar modal
            cerrarModalEditNovedad();

            // Recargar la vista
            renderTabla();

            Swal.fire({
                icon: 'success',
                title: '¡Actualizado!',
                text: 'La novedad se ha actualizado correctamente',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            throw new Error(result.message || 'Error al actualizar');
        }
    } catch (error) {
        console.error('[guardarEdicionNovedad] Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo actualizar la novedad. Intente nuevamente.',
            confirmButtonText: 'OK'
        });
    } finally {
        btnGuardar.innerHTML = originalHTML;
        btnGuardar.disabled = false;
    }
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modalEditNovedad');
    if (e.target === modal) {
        cerrarModalEditNovedad();
    }
});
