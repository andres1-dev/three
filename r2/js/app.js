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

        console.log(`[app] SISPRO: ${lots?.length ?? 'null'} filas  |  PLANTAS: ${plantas?.length ?? 'null'} filas`);

        if (Array.isArray(lots)) {
            setCurrentLots(lots);
            setCurrentPlantas(plantas || []);
            populatePlantaOptions(lots);
            applyAccessControl();
            hideLoaderShowForm();
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
        console.error('[app] Error cargando SISPRO:', error.message || error);
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
    document.getElementById('actualizarDatosForm').addEventListener('submit', handleActualizarDatosSubmit);

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
};

/* ── Forzar actualización de perfil para GUEST con datos incompletos ── */

/**
 * Si el GUEST tiene datos vitales faltantes, oculta el contenido operativo
 * (formularios de lote/novedades/calidad/rutero) y muestra solo ACTUALIZAR_DATOS.
 * La nav y el sidebar se mantienen visibles.
 */
function _checkForzarActualizarPerfil() {
    if (!currentUser || currentUser.ROL !== 'GUEST') return;

    sessionStorage.removeItem('completar_perfil');

    if (!_guestPerfilIncompleto()) return;

    // Ocultar formularios operativos — la nav y sidebar NO se tocan
    ['mainForm', 'novedadesForm', 'calidadForm', 'ruteroForm', 'loader']
        .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    // Pre-llenar cédula y nombre desde la sesión
    const cedulaInput = document.getElementById('cedulaPlanta');
    const nombreInput = document.getElementById('nombrePlanta');
    if (cedulaInput) cedulaInput.value = String(currentUser.ID_PLANTA || '').trim();
    if (nombreInput) nombreInput.value = String(currentUser.PLANTA    || '').trim();

    // Pre-llenar datos existentes si los hay
    const plantaData = (typeof currentPlantas !== 'undefined' ? currentPlantas : [])
        .find(p => (p.PLANTA || '').trim().toLowerCase() === String(currentUser.PLANTA || '').trim().toLowerCase());

    if (plantaData) {
        const dir = document.getElementById('direccionPlanta');
        const tel = document.getElementById('telefonoPlanta');
        const eml = document.getElementById('emailPlanta');
        if (dir) dir.value = plantaData.DIRECCION || '';
        if (eml) eml.value = plantaData.EMAIL     || '';
        if (tel) {
            const t = (plantaData.TELEFONO || '').replace(/\D/g, '');
            tel.value = t.length === 10 ? `(${t.slice(0,3)}) ${t.slice(3,6)}-${t.slice(6,10)}` : t;
        }
    }

    // Mostrar el formulario de actualización
    const actualizarSection = document.getElementById('actualizarDatosSection');
    if (actualizarSection) actualizarSection.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
