/* ==========================================================================
   resolucion.js — Lógica para la vista de Resolución (Ultra Compact Cards)
   ========================================================================== */

let gsNovedades = [];
let gsPlantas = [];
let gsCurrentPage = 1;
const gsRecordsPerPage = 6;

window.onload = async function () {
    // Disparar fetches de datos en paralelo con loadUsers
    const novedadesPromise = fetchNovedadesData();
    const plantasPromise   = fetchPlantasData();

    await loadUsers();

    // Aplicar modo compacto si estaba guardado
    const isCompact = localStorage.getItem('viewModeResolucion') === 'compact';
    if (isCompact) {
        document.getElementById('novedadesFeed')?.classList.add('is-compact');
        document.getElementById('toggleViewMode')?.classList.add('active');
    }

    await cargarDatos(novedadesPromise, plantasPromise);
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

async function cargarDatos(novedadesPromise, plantasPromise) {
    const loader = document.getElementById('loader');
    const section = document.getElementById('dataSection');

    try {
        await fetchSecureConfig();

        const [novedades, plantas] = await Promise.all([
            novedadesPromise || fetchNovedadesData(),
            plantasPromise   || fetchPlantasData()
        ]);

        gsNovedades = novedades;
        gsPlantas = plantas;

        // Verificar si hay datos
        if (!gsNovedades || gsNovedades.length === 0) {
            if (loader) {
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-clipboard-list mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">La base de datos de novedades está vacía o no es accesible.</p>
                    </div>
                `;
            }
            return;
        }

        updateStats();

        gsNovedades.sort((a, b) => {
            const estA = a.ESTADO || 'PENDIENTE';
            const estB = b.ESTADO || 'PENDIENTE';
            const isA_Fin = (estA === 'FINALIZADO');
            const isB_Fin = (estB === 'FINALIZADO');
            if (isA_Fin !== isB_Fin) return isA_Fin ? 1 : -1;
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
 * Renderiza el feed de novedades en formato ULTRA COMPACTO con Trazabilidad.
 */
function renderTabla(data = gsNovedades) {
    const feed = document.getElementById('novedadesFeed');
    const pagContainer = document.getElementById('paginationFeed');
    if (!feed) return;

    const mostrarFinalizados = document.getElementById('toggleFinalizados')?.checked;
    updateStats();
    feed.innerHTML = '';
    if (pagContainer) pagContainer.innerHTML = '';

    let datosMostrar = data;
    if (!mostrarFinalizados) {
        datosMostrar = data.filter(nov => nov.ESTADO !== 'FINALIZADO');
    }

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
                ${nov.IMAGEN ? `<img src="${nov.IMAGEN}">` : `<div class="h-100 d-flex align-items-center justify-content-center bg-light text-muted" style="font-size:0.6rem;">SIN EVIDENCIA</div>`}
            </div>
            <div class="card-body-ultra">
                <div class="card-top-info">
                    <div class="tech-pills-container">
                        <div class="tech-pill-lux" title="Lote"><i class="fas fa-barcode"></i> ${nov.LOTE || 'S/L'}</div>
                        <div class="tech-pill-lux" title="Referencia"><i class="fas fa-tag"></i> ${nov.REFERENCIA || 'REF S/N'}</div>
                        <div class="tech-pill-lux" title="Prenda"><i class="fas fa-tshirt"></i> ${nov.PRENDA || '--'}</div>
                        <div class="tech-pill-lux" title="Género"><i class="fas fa-venus-mars"></i> ${nov.GENERO || '--'}</div>
                        <div class="tech-pill-lux" title="Tejido"><i class="fas fa-scroll"></i> ${nov.TEJIDO || '--'}</div>
                        <div class="tech-pill-lux" title="Línea"><i class="fas fa-route"></i> ${nov.LINEA || '--'}</div>
                        <div class="tech-pill-lux" title="Cantidad Original"><i class="fas fa-cubes"></i> ${nov.CANTIDAD || '0'}</div>
                    </div>
                    <div style="text-align: right; line-height: 1.1;">
                        <span style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${nov.AREA || 'GEN'}</span>
                        <span style="font-size: 1.1rem; font-weight: 900; color: #3b82f6; letter-spacing: -0.5px;">${nov.CANTIDAD_SOLICITADA || '0'} <small style="font-size: 0.6rem; color: #64748b;">UND</small></span>
                    </div>
                </div>

                <div class="card-desc-ultra">${(nov.DESCRIPCION || 'Sin registro detallado.').trim()}</div>

                <div class="card-meta-ultra">
                    <div class="d-flex flex-column">
                        <div class="planta-label-lux">
                            ${nov.PLANTA}
                            ${infoPlanta ? `
                                <div class="info-trigger-lux" onclick="verFichaTaller('${nov.PLANTA.replace(/'/g, "\\'")}')" title="Ver contacto del taller">
                                    <i class="fas fa-info"></i>
                                </div>
                            ` : ''}
                        </div>
                        <div class="date-row-lux">
                            <span><b>Reportado:</b> ${dtIngreso ? (dtIngreso.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).charAt(0).toUpperCase() + dtIngreso.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).slice(1)) : '--'}</span>
                            <span><b>Salida Producción:</b> ${dtSalida ? (dtSalida.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).charAt(0).toUpperCase() + dtSalida.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).slice(1)) : 'PENDIENTE'}</span>
                        </div>
                    </div>
                    <div class="days-badge-lux ${totalDias <= 2 ? 'is-ontime' : (totalDias <= 4 ? 'is-warning' : 'is-overdue')}">
                        ${totalDias <= 2 ? '<i class="fas fa-check-circle"></i> ' : (totalDias <= 4 ? '<i class="fas fa-exclamation-circle"></i> ' : '<i class="fas fa-exclamation-triangle"></i> ')}${totalDias} DÍA${totalDias !== 1 ? 'S' : ''} HÁBIL${totalDias !== 1 ? 'ES' : ''}
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
                <button class="btn-print-ultra w-100" onclick="imprimirNovedad('${nov.ID_NOVEDAD}')" ${btnPrintDisabled} title="${btnPrintTitle}">
                    <i class="fas fa-print"></i> IMPRIMIR
                </button>
                <button class="btn-chat-print-ultra w-100" onclick="imprimirChat('${nov.ID_NOVEDAD}')" ${btnPrintDisabled} title="Imprimir transcripción del chat">
                    <i class="fas fa-file-lines"></i> CHAT
                </button>
                ${estadoActual === 'FINALIZADO' ? `
                <button class="btn-notify-ultra w-100" onclick="notificarSolucion('${nov.ID_NOVEDAD}')" title="Enviar notificación de solución por correo">
                    <i class="fas fa-envelope"></i> NOTIFICAR
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

    // Ya no pedimos confirmación al finalizar, solo actualizamos directamente

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
 * Inserta una plantilla pre-establecida en el textarea según el tipo de resolución
 */
function insertarPlantilla(tipo) {
    const textarea = document.getElementById('notifySolucion');
    let plantilla = '';
    
    switch(tipo) {
        case 'MANO_A_MANO':
            plantilla = 'Esta resolución es mano a mano sin cobro. Puede recoger el material en nuestras instalaciones en el horario de atención: 7:10 a.m. - 4:43 p.m.';
            break;
        case 'TALLER':
            plantilla = 'Agradecemos su colaboración y le recordamos que el reporte oportuno de novedades (dentro de las 24 horas o 2 días hábiles) nos permite gestionar de manera más eficiente las soluciones y mantener la calidad de nuestros procesos conjuntos.';
            break;
        case 'LINEA':
            plantilla = 'Hemos identificado que la situación se originó en nuestra línea de producción, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.';
            break;
        case 'REFERENCIA':
            plantilla = 'Hemos identificado que la situación está relacionada con especificaciones de la referencia, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.';
            break;
        case 'FICHA':
            plantilla = 'Hemos identificado que la situación está relacionada con la ficha técnica, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.';
            break;
        case 'ENTREGA':
            plantilla = 'Hemos identificado que la situación se originó en el proceso de entrega, por lo que los ajustes necesarios han sido gestionados internamente para garantizar la continuidad del proceso.';
            break;
    }
    
    // Insertar la plantilla en el textarea
    textarea.value = plantilla;
    textarea.focus();
    
    // Pequeña animación visual
    textarea.style.background = '#f0f9ff';
    setTimeout(() => {
        textarea.style.background = '#fafafa';
    }, 300);
}

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
