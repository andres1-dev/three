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

/** Oculta todas las secciones dinámicas del formulario y colapsa los detalles del lote. */
function hideSections() {
    DOM.detailsSection().classList.add('hidden');
    DOM.novedadesSection().classList.add('hidden');
    DOM.calidadSection().classList.add('hidden');
    DOM.actualizarDatosSection().classList.add('hidden');
    DOM.ruteroSection()?.classList.add('hidden');
    DOM.errorMessage().classList.add('hidden');

    // Asegurar que los datos del lote se contraigan
    const collapseHeader = document.getElementById('lotCollapseToggle');
    const collapseBody = document.getElementById('lotCollapseBody');
    if (collapseHeader && collapseBody) {
        collapseHeader.classList.remove('open');
        collapseBody.classList.remove('open');
        collapseHeader.setAttribute('aria-expanded', 'false');
    }

    clearSuggestions();
}

/**
 * Muestra el indicador de sincronización y oculta el error.
 */
function showLoader() {
    const el = DOM.loader();
    if (el) el.style.display = 'block';
    const err = DOM.errorMessage();
    if (err) err.classList.add('hidden');
}

/**
 * Oculta el indicador de sincronización.
 */
function hideLoaderShowForm() {
    const el = DOM.loader();
    if (el) el.style.display = 'none';
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
    const loader = DOM.loader();
    if (loader) loader.style.display = 'none';
}

/* ── Poblar elementos del DOM ── */

/**
 * Llena el select de planta con valores únicos de los registros.
 * @param {Object[]} lots
 */
function populatePlantaOptions(lots) {
    const select = DOM.plantaSelect();
    const unique = [...new Set(lots.map((l) => l.PLANTA).filter(Boolean))];

    select.innerHTML = '<option value="">Seleccione una planta...</option>';

    unique.forEach((planta) => {
        const option = document.createElement('option');
        option.value = planta;
        option.textContent = planta;
        select.appendChild(option);
    });
}

/**
 * Rellena los campos de detalle con los datos de un lote seleccionado.
 * @param {Object} lotData
 */
function fillLotDetails(lotData) {
    document.getElementById('lote').value = lotData.LOTE || '';
    document.getElementById('referencia').value = lotData.REFERENCIA || '';
    document.getElementById('cantidad').value = lotData.CANTIDAD || '';
    DOM.plantaSelect().value = lotData.PLANTA || '';
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
}

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
    const plantaValue = DOM.plantaSelect().value;
    DOM.nombrePlanta().value = plantaValue || '';

    const cedulaInput   = document.getElementById('cedulaPlanta');
    const direccionInput= document.getElementById('direccionPlanta');
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput    = document.getElementById('emailPlanta');

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
    }

    if (plantaData) {
        if (direccionInput) direccionInput.value = plantaData.DIRECCION || '';
        if (emailInput)     emailInput.value     = plantaData.EMAIL     || '';

        const tel = (plantaData.TELEFONO || '').replace(/\D/g, '');
        if (telefonoInput) {
            telefonoInput.value = tel.length === 10
                ? `(${tel.slice(0,3)}) ${tel.slice(3,6)}-${tel.slice(6,10)}`
                : tel;
        }
    }
}

/** Actualiza el campo de fecha/hora con la fecha actual. */
function updateDateTime() {
    DOM.fecha().value = new Date().toLocaleString();
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
    console.log('[AI] Limpiando historial de versiones volátil...');
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
        const apiKey = CONFIG.GEMINI_KEY;

        if (!apiKey) {
            throw new Error("La llave de IA no se ha cargado correctamente desde el servidor.");
        }

        const model = 'gemma-3n-e4b-it';

        const promptCalidad = `Eres un auditor senior de control de calidad en confección industrial. Reescribe el siguiente texto como una observación de seguimiento técnico: concisa, directa y sin ambigüedades. Usa el contexto del lote únicamente para orientar tu criterio técnico y elegir la terminología adecuada, pero no lo menciones ni lo repitas en la respuesta. Redacta de forma clara para que el personal operativo de planta o taller entienda exactamente qué se observó y qué se requiere corregir. Evita frases largas, rodeos o lenguaje administrativo innecesario. No agregues información que no esté en el texto original. No uses markdown, asteriscos, viñetas, negritas ni listas. No incluyas encabezados, títulos ni prefijos como "Observación:", "Hallazgo:", "Nota:" ni similares. Entrega únicamente el cuerpo del texto corregido en prosa continua, listo para pegar en un informe de seguimiento.

Contexto del lote (solo para tu criterio, no lo menciones):
- Prenda: ${document.getElementById('prenda')?.value || 'No especificada'}
- Género: ${document.getElementById('genero')?.value || 'No especificado'}
- Tejido: ${document.getElementById('tejido')?.value || 'No especificado'}
- Proceso: ${document.getElementById('proceso')?.value || 'No especificado'}

Texto a reescribir: ${textoOriginal}`;

        const promptGenerico = `Actúa como corrector técnico industrial especializado en redacción profesional. Corrige la ortografía, gramática, puntuación y estilo del siguiente texto, mejorando su claridad y coherencia sin alterar el significado original. Normaliza abreviaturas técnicas comunes cuando corresponda. Si el texto está completamente en mayúsculas, conviértelo a formato de escritura estándar utilizando mayúscula inicial al inicio de las oraciones y en nombres propios, y minúsculas en el resto del texto. Sustituye términos vulgares, ofensivos o inapropiados por equivalentes profesionales o neutrales cuando sea necesario. Mantén el contenido técnico implícito en el original y no agregues información nueva. Devuelve únicamente el texto corregido.\n\nTexto a corregir: ${textoOriginal}`;

        const promptIA = fieldId === 'observacionesCalidad' ? promptCalidad : promptGenerico;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptIA }] }],
                generationConfig: { temperature: 0.1, topP: 0.95, maxOutputTokens: 1024 }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Error en la respuesta de la IA");
        }

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("La IA no pudo generar una respuesta (Filtro de seguridad o bloqueo).");
        }

        let textoPulido = data.candidates[0].content.parts[0].text.trim();
        textoPulido = textoPulido.replace(/^["']|["']$/g, '');
        // Limpiar markdown residual
        textoPulido = textoPulido.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^[-•]\s+/gm, '').trim();
        // Eliminar encabezados tipo "Observación técnica:", "Hallazgo:", etc. al inicio
        textoPulido = textoPulido.replace(/^[A-ZÁÉÍÓÚÑ][^:\n]{0,40}:\s*/i, '').trim();

        // Guardar el texto original en un atributo data
        textarea.setAttribute('data-original-text', textoOriginal);

        // Aplicar el texto mejorado inmediatamente
        textarea.value = textoPulido;

        // Mostrar el botón de restaurar
        if (restoreBtn) {
            restoreBtn.style.display = 'inline-flex';
        }

    } catch (error) {
        console.error('Error al corregir con IA:', error);
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
