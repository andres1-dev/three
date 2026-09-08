/* ==========================================================================
   form-controller.js — Estado, validación y lógica multi-paso del formulario
   Depende de: config.js, api.js, ui.js, file-handler.js
   ========================================================================== */

const NP_State = {
    currentStep: 1,
    opData:      null,
    plantaData:  null,
    isSubmitting: false,
};

/* ── Init ── */
function np_init() {
    // Limpiar cachés al cargar
    try { sessionStorage.clear(); } catch(e) {}

    np_updateStepIndicator(1);
    np_showSection('section-busqueda');
    np_attachEventListeners();

    // Inicializar primera fila dinámica en cada lista
    np_agregarFilaInsumo();
    np_agregarFilaCorte();
    np_agregarFilaTela();
}

function np_attachEventListeners() {
    // Búsqueda de OP
    document.getElementById('btn-buscar')?.addEventListener('click', np_handleBuscarOP);
    document.getElementById('input-op')?.addEventListener('keydown', e => { if (e.key === 'Enter') np_handleBuscarOP(); });

    // Navegación de pasos
    document.getElementById('btn-confirmar')?. addEventListener('click', np_confirmarProducto);
    document.getElementById('btn-volver-busqueda')?.addEventListener('click', () => { np_showSection('section-busqueda'); np_updateStepIndicator(1); });
    document.getElementById('btn-continuar-adicional')?.addEventListener('click', np_continuarAdicional);
    document.getElementById('btn-volver-confirmacion')?.addEventListener('click', () => { np_showSection('section-confirmacion'); np_updateStepIndicator(2); });
    document.getElementById('btn-volver-detalles')?.addEventListener('click', () => { np_showSection('section-detalles'); np_updateStepIndicator(3); });

    // Submit
    document.getElementById('form-novedad')?.addEventListener('submit', np_handleSubmit);

    // Archivo
    document.getElementById('imagen')?.addEventListener('change', np_handleFileSelect);
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover',  np_handleDragOver);
        dropzone.addEventListener('dragleave', np_handleDragLeave);
        dropzone.addEventListener('drop',      np_handleFileDrop);
        dropzone.addEventListener('click',     () => document.getElementById('imagen')?.click());
    }
}

/* ── Paso 1: Búsqueda de OP ── */
async function np_handleBuscarOP() {
    const input = document.getElementById('input-op');
    const op = input?.value?.trim();

    if (!op || !NP_VALIDATION.op.pattern.test(op)) {
        np_showToast(NP_VALIDATION.op.message, 'error');
        return;
    }

    const btn = document.getElementById('btn-buscar');
    if (btn) { btn.disabled = true; btn.textContent = 'Buscando...'; }

    try {
        const data = await np_buscarOP(op);
        const results = Array.isArray(data) ? data : [data];

        if (!results.length || !results[0]) {
            np_showToast('No se encontró información para esa OP. Verifica el número.', 'error');
            return;
        }

        NP_State.opData = results[0];

        // Obtener email de la planta
        const planta = NP_State.opData.planta || NP_State.opData.PLANTA || NP_State.opData.nombre_planta;
        if (planta) {
            NP_State.plantaData = await np_obtenerEmailPlanta(planta).catch(() => null);
        }

        np_mostrarInformacionProducto(NP_State.opData);
        np_showSection('section-confirmacion');
        np_updateStepIndicator(2);

    } catch (err) {
        console.error('[np_handleBuscarOP]', err);
        np_showToast('Error al buscar la OP. Intenta de nuevo.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Buscar'; }
    }
}

/* ── Paso 2: Confirmación ── */
function np_confirmarProducto() {
    np_showSection('section-detalles');
    np_updateStepIndicator(3);
}

/* ── Paso 3: Detalles adicionales ── */
function np_continuarAdicional() {
    np_showSection('section-imagen');
    np_updateStepIndicator(4);
}

/* ── Paso 4: Submit ── */
async function np_handleSubmit(e) {
    e.preventDefault();
    if (NP_State.isSubmitting) return;

    if (!np_validateForm()) return;

    NP_State.isSubmitting = true;
    const btn = document.getElementById('btn-enviar');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
        let imagenUrl = null;
        const file = np_getSelectedFile();
        if (file) {
            np_showToast('Subiendo imagen...', 'info');
            imagenUrl = await np_uploadImagen(file);
        }

        const payload = np_prepareFormData(imagenUrl);
        const result  = await np_enviarNovedad(payload);

        np_mostrarPantallaExito(result.id || result.ID_NOVEDAD || '');
        np_showToast('¡Novedad enviada correctamente!', 'success');

    } catch (err) {
        console.error('[np_handleSubmit]', err);
        np_showToast(`Error al enviar: ${err.message}`, 'error');
    } finally {
        NP_State.isSubmitting = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar Novedad'; }
    }
}

/* ── Validación final del formulario ── */
function np_validateForm() {
    const descripcion = document.getElementById('descripcion')?.value?.trim();
    const area        = document.getElementById('area')?.value;
    const correo      = document.getElementById('correo')?.value?.trim();

    if (!area) {
        np_showToast('Selecciona el área afectada.', 'error');
        return false;
    }
    if (!descripcion || descripcion.length < NP_VALIDATION.descripcion.minLength) {
        np_showToast(NP_VALIDATION.descripcion.message, 'error');
        return false;
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        np_showToast('El correo electrónico no es válido.', 'error');
        return false;
    }
    return true;
}

/* ── Preparar payload ── */
function np_prepareFormData(imagenUrl) {
    const op = NP_State.opData;
    return {
        accion:      'CREAR_NOVEDAD',
        OP:          op?.op || op?.OP || document.getElementById('input-op')?.value,
        PLANTA:      op?.planta || op?.PLANTA || op?.nombre_planta,
        REFERENCIA:  op?.referencia || op?.REFERENCIA,
        PRENDA:      op?.prenda || op?.PRENDA || op?.descripcion,
        PROCESO:     op?.proceso || op?.PROCESO,
        AREA:        document.getElementById('area')?.value,
        TIPO:        document.getElementById('tipo-novedad')?.value,
        DESCRIPCION: document.getElementById('descripcion')?.value?.trim(),
        CORREO:      document.getElementById('correo')?.value?.trim() || NP_State.plantaData?.CORREO || '',
        IMAGEN:      imagenUrl,
        INSUMOS:     np_recolectarFilas('insumos-list'),
        CORTE:       np_recolectarFilas('corte-list'),
        TELAS:       np_recolectarFilas('telas-list'),
        ESTADO:      'PENDIENTE',
        FECHA:       new Date().toISOString(),
    };
}

/* ── Nuevo Reporte ── */
function np_iniciarNuevoReporte() {
    NP_State.currentStep = 1;
    NP_State.opData      = null;
    NP_State.plantaData  = null;
    np_clearSelectedFile();
    document.getElementById('form-novedad')?.reset();
    document.getElementById('input-op').value = '';
    np_showSection('section-busqueda');
    np_updateStepIndicator(1);
}

/* Exponer globalmente */
window.np_init               = np_init;
window.np_handleBuscarOP     = np_handleBuscarOP;
window.np_confirmarProducto  = np_confirmarProducto;
window.np_continuarAdicional = np_continuarAdicional;
window.np_handleSubmit       = np_handleSubmit;
window.np_iniciarNuevoReporte = np_iniciarNuevoReporte;

document.addEventListener('DOMContentLoaded', np_init);
