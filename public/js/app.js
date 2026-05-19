/* ==========================================================================
   app.js — Punto de entrada: orquesta la carga inicial y conecta eventos
   Depende de: config.js, api.js, ui.js, forms.js, particles-config.js
   ========================================================================== */

// ============================================================================
// 🚀 PRE-FETCH DE DATOS (Anon Key)
// Trae los datos de inmediato mientras la app procesa auth y UI,
// respetando el filtro de productora si existe en localStorage.
// ============================================================================
(function initFastPrefetch() {
    try {
        if (typeof fetchSupabaseData !== 'function') return;
        
        // 1. Intentar inyectar el usuario simulado temporalmente para el filtro
        const savedProdRaw = localStorage.getItem('busint_productora');
        let mocked = false;
        if (savedProdRaw && typeof window.currentUser === 'undefined') {
            const savedProd = JSON.parse(savedProdRaw);
            if (savedProd && savedProd.ID_PRODUCTORA) {
                window.currentUser = { 
                    ROL: 'ADMIN', // Rol base para activar el filtro
                    ID_PRODUCTORA: savedProd.ID_PRODUCTORA 
                };
                mocked = true;
            }
        }
        
        // 2. Disparar el fetch de inmediato en paralelo
        console.log('[FAST-LOAD] 🚀 Ejecutando prefetch paralelo de base de datos...');
        fetchSupabaseData('master').catch(()=>null);
        fetchSupabaseData('plantas').catch(()=>null);
        
        // 3. Limpiar el mock
        if (mocked) {
            window.currentUser = undefined;
        }
    } catch(e) {
        console.warn('[FAST-LOAD] Prefetch falló silenciosamente:', e);
    }
})();

// ── Auto-limpieza de caché corrupta de productora ──
// Si busint_productora tiene PRODUCTORA = "3" (un número) en vez de un nombre real, lo borramos.
(function _cleanCorruptProductoraCache() {
  try {
    const raw = localStorage.getItem('busint_productora');
    if (!raw) return;
    const data = JSON.parse(raw);
    const name = data?.PRODUCTORA;
    // Si el "nombre" es en realidad un número puro, está corrupto
    if (name && !isNaN(Number(name)) && String(Number(name)) === String(name).trim()) {
      console.log('[APP] Caché de productora corrupta detectada ("' + name + '"), limpiando...');
      localStorage.removeItem('busint_productora');
    }
  } catch(e) {}
})();

/**
 * Garantiza que el usuario tenga una productora seleccionada.
 * Si no la tiene (sesión anterior al cambio), muestra un selector Swal.
 * Solo aplica a roles internos — GUEST no necesita productora.
 */
async function _ensureProductora() {
    const user = window.currentUser;
    if (!user || user.ROL === 'GUEST') return;

    // ── LÓGICA DE ACCESO UNIVERSAL PARA PLANTAS ──
    if (user.email === 'plantas@grupotdm.com.co') {
        try {
            const universalData = JSON.parse(localStorage.getItem('busint_universal_plant') || 'null');
            if (universalData) {
                window.currentUser.ID_PLANTA  = universalData.ID_PLANTA  || universalData.id_planta  || universalData.id;
                window.currentUser.PLANTA     = universalData.PLANTA     || universalData.planta;
                window.currentUser.USUARIO    = universalData.PLANTA     || universalData.planta;
                window.currentUser.ID_USUARIO = universalData.ID_PLANTA  || universalData.id_planta  || universalData.id;

                // El campo `productora` en la tabla de Supabase es el ID numérico
                const prodIdRaw = universalData.ID_PRODUCTORA || universalData.productora;
                if (prodIdRaw) {
                    window.currentUser.ID_PRODUCTORA = parseInt(prodIdRaw);
                    // Buscar el nombre guardado previamente — si es un número, está corrupto, ignorarlo
                    const savedProd = JSON.parse(localStorage.getItem('busint_productora') || 'null');
                    const savedName = savedProd?.PRODUCTORA;
                    const nameIsCorrupt = savedName && !isNaN(parseInt(savedName)) && String(parseInt(savedName)) === String(savedName).trim();
                    if (savedProd && String(savedProd.ID_PRODUCTORA) === String(prodIdRaw) && savedName && !nameIsCorrupt) {
                        window.currentUser.PRODUCTORA = savedName;
                    } else {
                        // Nombre no resuelto aún — se resolverá en loadUsers()
                        window.currentUser.PRODUCTORA = null;
                        // Limpiar caché corrupta para forzar nueva resolución
                        if (nameIsCorrupt) localStorage.removeItem('busint_productora');
                    }
                }
                // Merge del resto de campos sin pisar las correcciones anteriores
                const { productora: _p, ID_PRODUCTORA: _ip, PRODUCTORA: _pn, ...restData } = universalData;
                Object.assign(window.currentUser, restData);
            }
        } catch(e) { console.error("Error vinculando planta universal:", e); }
    }

    // 1. Intentar recuperar de localStorage
    try {
        const saved = JSON.parse(localStorage.getItem('busint_productora') || 'null');
        if (saved?.ID_PRODUCTORA) {
            user.ID_PRODUCTORA = saved.ID_PRODUCTORA;
            user.PRODUCTORA    = saved.PRODUCTORA;
            return;
        }
    } catch(e) {}

    // 1.5. Si ya viene asignada desde el perfil de Supabase Auth
    if (user.ID_PRODUCTORA) {
        if (typeof _sanitizeProductora === 'function') {
            _sanitizeProductora(user);
        }
        try {
            localStorage.setItem('busint_productora', JSON.stringify({
                ID_PRODUCTORA: user.ID_PRODUCTORA,
                PRODUCTORA:    user.PRODUCTORA || String(user.ID_PRODUCTORA)
            }));
        } catch(e) {}
        return;
    }

    // 2. Si no hay productora, mostrar el overlay MANDATORIO
    const overlay = document.getElementById('productora-overlay');
    const list    = document.getElementById('productora-list');
    if (!overlay || !list) return;

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Bloquear scroll

    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: JSON.stringify({ accion: 'LISTAR_PRODUCTORAS' })
        });
        const result = response.ok ? await response.json() : { productoras: [] };
        const prods = result.productoras || [];

        if (prods.length === 0) {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
            return;
        }

        // Si solo hay una, asignarla automáticamente
        if (prods.length === 1) {
            _selectProductora(prods[0]);
            return;
        }

        // Mostrar lista con diseño premium
        list.innerHTML = prods.map((p) => {
            return `
                <div class="productora-item" onclick="_handleProductoraSelect('${p.id_productora}', '${p.productora}')">
                    <i class="fa-solid fa-building productora-bg-icon"></i>
                    <div class="productora-item-info">
                        <span class="productora-name">${p.productora}</span>
                        ${user.ROL === 'GUEST' ? `
                            <a href="seguimiento.html" class="sidebar-link ${window.location.pathname.includes('seguimiento.html') ? 'active' : ''}">
                                <i class="fas fa-shipping-fast"></i> Seguimiento
                            </a>
                            <a href="gestion-planta.html?id=${user.ID_PLANTA || user.ID_USUARIO || user.ID || ''}" class="sidebar-link ${window.location.pathname.includes('gestion-planta.html') ? 'active' : ''}">
                                <i class="fas fa-industry"></i> Actualizar
                            </a>
                        ` : ''}
                        <span class="productora-nit">NIT: ${p.nit || 'N/A'}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Crear una promesa que se resuelva cuando se seleccione una productora
        return new Promise((resolve) => {
            window._resolveProductora = resolve;
        });

    } catch(e) {
        console.warn('[APP] No se pudo cargar productoras:', e.message);
        list.innerHTML = `<div class="text-danger p-4">Error al cargar productoras. Reintente recargando la página.</div>`;
    }
}

// _handleProductoraSelect, _forceChangeProductora y el listener Ctrl+S
// están ahora centralizados en auth.js (disponibles en todos los módulos).

function _selectProductora(prod) {
    if (typeof window._handleProductoraSelect === 'function') {
        window._handleProductoraSelect(prod.id_productora, prod.productora);
    }
}

/**
 * Carga los datos desde Supabase.
 * Si falla, muestra un error al usuario (sin datos de respaldo).
 */
async function loadData() {
    try {
        showLoader();

        // PASO 1: Recuperar llaves de API (Configuración segura)
        await fetchSecureConfig();

        // PASO 2: Cargar lotes y plantas desde Supabase (reutilizará el prefetch si está disponible)
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
            
            // Ya no forzamos actualización de perfil

            // Sin lotes: mostrar estado vacío amigable pero no bloquear la UI
            if (lots.length === 0) {
                const errEl = document.getElementById('errorMessage');
                if (errEl) {
                    errEl.innerHTML = '<i class="fas fa-database me-2"></i>No hay lotes cargados para esta productora. Importe los datos de producción para habilitar la búsqueda de lotes.';
                    errEl.classList.remove('hidden');
                    errEl.style.color = '#f59e0b';
                }
            }
        } else {
            throw new Error('La tabla master no devolvió datos válidos');
        }
    } catch (error) {
        showError('Error al cargar los datos: ' + (error.message || 'verifique la tabla master en Supabase'));
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
        if (tvSelect) {
            tvSelect.value = prefill.tipoVisita;
            // Disparar el evento change para que _actualizarCamposCalidad() muestre los campos dependientes
            tvSelect.dispatchEvent(new Event('change'));
        }
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
    
    // Cargar datos operativos — esperar a que loadUsers termine para tener currentUser completo
    await _ensureProductora();
    loadData().then(() => aplicarPrefillRutero());
    
    initDropzones();

    // El escudo se quita dentro de loadUsers() cuando todo es válido
    setInterval(updateDateTime, 60_000);

    // Sistema de notificaciones internas (solo para GUEST)
    if (currentUser?.ROL === 'GUEST' && typeof initNotifications === 'function') {
        const preloaded = typeof currentLots !== 'undefined' ? currentLots : [];
        initNotifications(preloaded.length ? preloaded : undefined);
    }

    // Opciones del formulario según rol (GUEST e internos)
    const accionesSelect = document.getElementById('acciones');
    if (accionesSelect && currentUser) {
        const role = currentUser.ROL;
        Array.from(accionesSelect.options).forEach(opt => {
            if (role === 'GUEST' || role === 'USER-P') {
                if (opt.value === 'CALIDAD' || opt.value === 'RUTERO') {
                    opt.style.display = 'none';
                    opt.disabled = true;
                } else {
                    opt.style.display = '';
                    opt.disabled = false;
                }
            } else {
                opt.style.display = '';
                opt.disabled = false;
            }
        });
        if (role === 'GUEST' || role === 'USER-P') {
            accionesSelect.value = 'NOVEDADES';
            accionesSelect.disabled = true;
        } else {
            accionesSelect.disabled = false;
        }
    }

    // Reintentar subidas de archivos que quedaron pendientes
    retryPendingUploads();

    // Mantener Supabase caliente con un ping periódico
    _warmUpSupabase();
    setInterval(_warmUpSupabase, 4 * 60 * 1000); 

    // Warm-up de la edge function /query para evitar cold start en la primera carga real
    if (typeof _warmUpQuery === 'function') _warmUpQuery();
};

/* ── Forzar actualización de perfil para GUEST con datos incompletos ── */



/* ── Keep-alive Supabase ── */

/**
 * Hace un ping liviano a Supabase para mantenerlo "caliente"
 * y evitar el cold start de las Edge Functions.
 */
function _warmUpSupabase() {
    if (typeof _warmUpQuery === 'function') _warmUpQuery();
}
