/* ==========================================================================
   app.js — Punto de entrada: orquesta la carga inicial y conecta eventos
   Depende de: config.js, api.js, ui.js, forms.js, particles-config.js
   ========================================================================== */

/**
 * Carga los datos desde la API de Google Sheets.
 * Si falla, muestra un error al usuario (sin datos de respaldo).
 */
async function loadData() {
    try {
        showLoader();

        // PASO 1: Recuperar llaves de API desde Supabase/config
        await fetchSecureConfig();

        // PASO 2: Cargar lotes SISPRO y plantas desde Supabase
        const { lots, plantas } = await fetchAllData();



        if (Array.isArray(lots)) {
            setCurrentLots(lots);
            setCurrentPlantas(plantas || []);
            
            populatePlantaOptions(lots);
            applyAccessControl();
            hideLoaderShowForm();
            
            // Inicializar vista de tarjetas para GUEST
            if (typeof initGuestCardsView === 'function') {
                initGuestCardsView();
            }
            
            _checkForzarActualizarPerfil();

            // Sin lotes: mostrar estado vacío amigable pero no bloquear la UI
            if (lots.length === 0) {
                const errEl = document.getElementById('errorMessage');
                if (errEl) {
                    errEl.innerHTML = '<i class="fas fa-database me-2"></i>La tabla <strong>SISPRO</strong> está vacía en Supabase. Importe los datos de producción para habilitar la búsqueda de lotes.';
                    errEl.classList.remove('hidden');
                    errEl.style.color = '#f59e0b';
                }
            }
        } else {
            throw new Error('La tabla SISPRO no devolvió datos válidos');
        }
    } catch (error) {
        showError('Error al cargar los datos: ' + (error.message || 'verifique la tabla SISPRO en Supabase'));
    }
}

/* ── Prefill desde Rutero ── */

/**
 * Si venimos desde rutero.html con datos en sessionStorage,
 * selecciona el lote, cambia la acción a CALIDAD y pre-llena tipoVisita.
 */
function aplicarPrefillRutero() {
    const raw = sessionStorage.getItem('rutero_prefill');
    if (!raw) return;
    sessionStorage.removeItem('rutero_prefill');

    let prefill;
    try { prefill = JSON.parse(raw); } catch(_) { return; }

    // Buscar el lote en currentLots
    const lot = currentLots.find(l =>
        (l.LOTE || '').trim().toLowerCase() === (prefill.lote || '').trim().toLowerCase()
    );
    if (!lot) return;

    // Seleccionar el lote y llenar detalles
    DOM.loteInput().value = lot.LOTE;
    fillLotDetails(lot);
    verificarRegistroPlanta(lot.PLANTA);

    // Cambiar acción a CALIDAD
    DOM.accionesSelect().value = 'CALIDAD';
    toggleActionSections('CALIDAD');

    // Pre-llenar tipo de visita
    if (prefill.tipoVisita) {
        const tvSelect = document.getElementById('tipoVisita');
        if (tvSelect) tvSelect.value = prefill.tipoVisita;
    }

    // Scroll suave al formulario
    setTimeout(() => {
        const calidadSection = document.getElementById('calidadSection');
        if (calidadSection) calidadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

/* ── Registro de Event Listeners ── */

function bindEvents() {
    // Búsqueda de lotes
    DOM.loteInput().addEventListener('input', handleLoteSearch);
    DOM.loteInput().addEventListener('input', handleLoteInputReset);

    // Selección de sugerencia
    DOM.loteSuggestions().addEventListener('click', handleLotSelection);

    // Cambio de acción (Novedades / Calidad / Actualizar Datos)
    DOM.accionesSelect().addEventListener('change', handleActionChange);

    // Cambio manual de planta
    DOM.plantaSelect().addEventListener('change', () => {
        const planta = DOM.plantaSelect().value;
        if (planta) {
            verificarRegistroPlanta(planta);
        }
    });

    // Envío de formularios
    document.getElementById('novedadesForm').addEventListener('submit', handleNovedadesSubmit);
    document.getElementById('calidadForm').addEventListener('submit', handleCalidadSubmit);
    
    // Verificar que handleActualizarDatosSubmit existe antes de registrar el evento
    const actualizarForm = document.getElementById('actualizarDatosForm');
    if (actualizarForm) {
        if (typeof handleActualizarDatosSubmit === 'function') {
            actualizarForm.addEventListener('submit', handleActualizarDatosSubmit);
        } else {
            console.error('[bindEvents] ERROR: handleActualizarDatosSubmit no está definida');
            // Registrar un handler temporal que muestre el error
            actualizarForm.addEventListener('submit', function(e) {
                e.preventDefault();
                console.error('[actualizarDatosForm] handleActualizarDatosSubmit no disponible');
                alert('Error: La función de guardado no está disponible. Por favor recarga la página.');
            });
        }
    } else {
        console.error('[bindEvents] ERROR: No se encontró el formulario actualizarDatosForm');
    }

    // Acordeón de datos del lote
    initLotCollapse();

    // Cambio de logo
    window.cambiarLogo = cycleLogo;
}

/* ── Inicialización de la aplicación ── */

window.onload = async function() {
    // 1. Prioridad Absoluta: Validar usuario (El escudo está activo en CSS)
    await loadUsers(); 

    // Si loadUsers() pasó (no hubo redirect), inicializar el resto
    updateDateTime();
    bindEvents();
    
    // Mostrar mensaje vacío inicial
    showEmptyState();
    
    // Cargar datos operativos
    loadData().then(() => aplicarPrefillRutero());
    
    initDropzones();

    // El escudo se quita dentro de loadUsers() cuando todo es válido
    setInterval(updateDateTime, 60_000);

    // Sistema de notificaciones internas (solo para GUEST)
    // Se llama aquí para pasar los datos ya cargados y evitar un fetch extra.
    // auth.js ya inició el sistema en otras páginas sin datos precargados.
    if (currentUser?.ROL === 'GUEST' && typeof initNotifications === 'function') {
        // Pasar novedades precargadas si ya están disponibles
        const preloaded = typeof currentLots !== 'undefined' ? currentLots : [];
        // Reiniciar con datos precargados (reemplaza el poll iniciado por auth.js sin datos)
        initNotifications(preloaded.length ? preloaded : undefined);
    }

    // Reintentar subidas de archivos que quedaron pendientes
    retryPendingUploads();

    // Mantener GAS caliente con un ping periódico (evita cold start en el próximo envío)
    _warmUpGAS();
    setInterval(_warmUpGAS, 4 * 60 * 1000); // cada 4 minutos

    // Warm-up de la edge function /query para evitar cold start en la primera carga real
    if (typeof _warmUpQuery === 'function') _warmUpQuery();
};

/* ── Forzar actualización de perfil para GUEST con datos incompletos ── */

/**
 * Si el GUEST tiene datos vitales faltantes, redirige a gestion-planta.html
 * para completar los datos obligatorios.
 */
function _checkForzarActualizarPerfil() {
    if (!currentUser || currentUser.ROL !== 'GUEST') return;

    sessionStorage.removeItem('completar_perfil');

    if (!_guestPerfilIncompleto()) return;

    // Redirigir a gestion-planta.html para completar datos
    window.location.href = 'gestion-planta.html?id=' + (currentUser.ID_PLANTA || currentUser.ID);
}

/* ── Keep-alive GAS ── */

/**
 * Hace un ping liviano al GAS (doGet) para mantenerlo "caliente"
 * y evitar el cold start de 2-5s en el próximo envío real.
 * Usa fetch sin await para no bloquear nada.
 */
function _warmUpGAS() {
    fetch(GAS_ENDPOINT, { method: 'GET' }).catch(() => {});
}
