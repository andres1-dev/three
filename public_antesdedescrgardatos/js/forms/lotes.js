/* ==========================================================================
   forms/lotes.js — Búsqueda, filtrado y selección de lotes
   Depende de: forms/index.js (currentLots)
               ui.js (DOM, clearSuggestions, fillLotDetails, renderSuggestions)
   ========================================================================== */

/**
 * Maneja el input de búsqueda: filtra lotes y renderiza sugerencias.
 */
function handleLoteSearch() {
    const query = DOM.loteInput().value.toLowerCase();
    clearSuggestions();

    // Ocultar emptyStateMessage si hay algo en el input
    if (query) {
        hideEmptyState();
    } else {
        showEmptyState();
    }

    if (!query || currentLots.length === 0) return;

    const filtered = currentLots.filter((lot) => {
        const lote = lot.LOTE || lot.OP || '';
        return lote.toLowerCase().includes(query);
    });
    
    renderSuggestions(filtered);
}

/**
 * Maneja el click en una sugerencia de lote para seleccionarla.
 * Mantiene el acordeón de datos del lote contraído.
 * @param {Event} event
 */
function handleLotSelection(event) {
    if (!event.target || !event.target.matches('li.list-group-item')) return;

    const lotData = JSON.parse(event.target.dataset.lot);
    fillLotDetails(lotData);

    DOM.loteInput().value = lotData.LOTE || '';

    clearSuggestions();

    // ── Verificar si la planta tiene datos completos ──
    verificarRegistroPlanta(lotData.PLANTA);
    
    // ── Si es GUEST, activar automáticamente NOVEDADES ──
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.ROL === 'GUEST') {
        setTimeout(() => {
            const accionesSelect = DOM.accionesSelect();
            if (accionesSelect) {
                accionesSelect.value = 'NOVEDADES';
                toggleActionSections('NOVEDADES');
            }
        }, 100);
    }
}

/**
 * Valida si una planta tiene sus datos de contacto registrados.
 * @param {string} plantaNombre
 */
function verificarRegistroPlanta(plantaNombre) {
    if (!plantaNombre) {
        if (DOM.editPlantaBtn()) DOM.editPlantaBtn().style.display = 'none';
        return;
    }

    // Solo aplica la restricción a usuarios GUEST
    const role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.ROL : 'GUEST';
    if (role !== 'GUEST') {
        // Para ADMIN, USER-P, USER-C, MODERATOR: flujo libre sin restricción
        const accionesContainer = DOM.accionesSelect().closest('.mb-3');
        const editBtn = DOM.editPlantaBtn();
        if (accionesContainer) accionesContainer.style.display = 'block';
        DOM.accionesSelect().removeAttribute('disabled');
        DOM.accionesSelect().value = '';
        toggleActionSections('');
        if (editBtn) {
            editBtn.style.display = 'block';
            editBtn.onclick = () => {
                // Redirigir a gestion-planta.html
                window.location.href = 'gestion-planta.html?id=' + (currentUser.ID_PLANTA || currentUser.ID);
            };
        }
        return;
    }

    // Buscamos en la lista de plantas registradas (leídas desde Sheets o guardadas localmente)
    // Usamos comparación insensible a mayúsculas para evitar problemas de escritura
    const infoPlanta = currentPlantas.find(p =>
        (p.PLANTA || '').toString().trim().toLowerCase() === plantaNombre.trim().toLowerCase()
    );

    const accionesContainer = DOM.accionesSelect().closest('.mb-3');
    const editBtn = DOM.editPlantaBtn();

    // Verificamos si ya tiene los campos obligatorios
    const tieneDatos = infoPlanta &&
        infoPlanta.DIRECCION &&
        infoPlanta.TELEFONO &&
        infoPlanta.EMAIL;

    if (!tieneDatos) {
        // Si la planta no tiene datos, forzar actualización
        Swal.fire({
            title: 'REGISTRO DE PLANTA REQUERIDO',
            text: `La planta "${plantaNombre}" no tiene información de contacto. Por favor complétela para continuar.`,
            icon: 'info',
            confirmButtonColor: '#3F51B5'
        });

        // Redirigir a gestion-planta.html
        window.location.href = 'gestion-planta.html?id=' + (currentUser.ID_PLANTA || currentUser.ID);
    } else {
        // La planta ya tiene datos: Permitir flujo normal
        if (accionesContainer) accionesContainer.style.display = 'block';
        DOM.accionesSelect().removeAttribute('disabled');

        // Limpiar secciones anteriores (volver al inicio de selección de acción)
        DOM.accionesSelect().value = '';
        toggleActionSections('');

        // Mostrar botón de edición opcional y configurar su acción
        if (editBtn) {
            editBtn.style.display = 'block';
            editBtn.onclick = () => {
                // Redirigir a gestion-planta.html
                window.location.href = 'gestion-planta.html?id=' + (currentUser.ID_PLANTA || currentUser.ID);
            };
        }
    }
}

/**
 * Resetea el estado readonly de planta y línea al volver a escribir
 * en el campo de búsqueda.
 */
function handleLoteInputReset() {
    DOM.plantaSelect().removeAttribute('disabled');
    DOM.lineaInput().removeAttribute('disabled');

    // Si el input queda vacío, cerrar todos los formularios
    const val = DOM.loteInput().value.trim();
    if (!val) {
        hideSections();
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   ACORDEÓN — Datos del lote (colapsable)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Registra el evento click en el header del acordeón de datos del lote.
 * Llamado desde app.js en bindEvents().
 */
function initLotCollapse() {
    const header = document.getElementById('lotCollapseToggle');
    if (!header) return;
    header.addEventListener('click', toggleLotCollapse);
}

/**
 * Alterna (abre/cierra) el acordeón de datos del lote.
 */
function toggleLotCollapse() {
    const header = document.getElementById('lotCollapseToggle');
    const body = document.getElementById('lotCollapseBody');
    if (!header || !body) return;

    header.classList.toggle('open');
    body.classList.toggle('open');
    const isOpen = header.classList.contains('open');
    header.setAttribute('aria-expanded', String(isOpen));
}

/**
 * Abre el acordeón de datos del lote si está cerrado.
 * Se llama automáticamente al seleccionar un lote.
 */
function expandLotCollapse() {
    const header = document.getElementById('lotCollapseToggle');
    const body = document.getElementById('lotCollapseBody');
    if (!header || !body) return;

    header.classList.add('open');
    body.classList.add('open');
    header.setAttribute('aria-expanded', 'true');
}

/**
 * Cierra el acordeón de datos del lote de forma programática.
 */
function hideLotCollapse() {
    const header = document.getElementById('lotCollapseToggle');
    const body = document.getElementById('lotCollapseBody');
    if (!header || !body) return;

    header.classList.remove('open');
    body.classList.remove('open');
    header.setAttribute('aria-expanded', 'false');
}
