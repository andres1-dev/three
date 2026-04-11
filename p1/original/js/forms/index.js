/* ==========================================================================
   forms/index.js — Estado compartido y despacho de acciones
   Punto de entrada de todos los sub-módulos de formularios.

   Sub-módulos (cargados desde index.html en este orden):
     forms/gas.js       → utilidades de comunicación con GAS
     forms/lotes.js     → búsqueda y selección de lotes
     forms/novedades.js → formulario de novedades
     forms/calidad.js   → formulario de calidad
     forms/plantas.js   → formulario de actualizar datos de planta
   ========================================================================== */

/* ── Estado compartido (accedido por todos los sub-módulos) ── */

/** Lista de lotes cargados desde la API de SISPRO. */
let currentLots = [];

/** Lista de plantas registradas. */
let currentPlantas = [];

/**
 * Establece la lista de lotes disponibles.
 * @param {Object[]} lots
 */
function setCurrentLots(lots) {
    currentLots = lots;
}

/**
 * Establece la lista de plantas disponibles.
 * @param {Object[]} plantas
 */
function setCurrentPlantas(plantas) {
    currentPlantas = plantas;
}

/* ── Despacho de acción ── */

/**
 * Maneja el cambio del select de acciones y muestra el sub-formulario correcto.
 */
function handleActionChange() {
    const action = DOM.accionesSelect().value;
    toggleActionSections(action);
    
    // Si se selecciona cualquier acción, contraer los datos del lote para ahorrar espacio
    if (action) {
        hideLotCollapse();
    }
}
