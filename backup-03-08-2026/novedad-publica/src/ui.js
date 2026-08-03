/* ==========================================================================
   ui.js — Render, filas dinámicas y feedback visual (Novedad Pública)
   Depende de: config.js
   ========================================================================== */

/* ── Toast / Notificaciones ── */
function np_showToast(message, type = 'info') {
    const existing = document.getElementById('np-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'np-toast';
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    toast.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:9999;
        background:${colors[type] || colors.info}; color:#fff;
        padding:12px 20px; border-radius:10px; font-size:.9rem;
        box-shadow:0 4px 20px rgba(0,0,0,.2);
        animation: slideIn .3s ease; max-width:320px;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

/* ── Indicador de Steps ── */
function np_updateStepIndicator(step) {
    document.querySelectorAll('.step-item').forEach((el, i) => {
        el.classList.toggle('active',    i + 1 === step);
        el.classList.toggle('completed', i + 1 < step);
    });
}

/* ── Mostrar/ocultar secciones ── */
function np_showSection(id) {
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}

/* ── Render de datos del producto ── */
function np_mostrarInformacionProducto(data) {
    const formatDate = (d) => {
        if (!d) return 'N/A';
        const date = new Date(d);
        return isNaN(date) ? d : date.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
    };

    const fields = {
        'info-op':          data.op || data.OP || '',
        'info-referencia':  data.referencia || data.REFERENCIA || '',
        'info-prenda':      data.prenda || data.PRENDA || data.descripcion || '',
        'info-cantidad':    data.cantidad || data.CANTIDAD || '',
        'info-proceso':     data.proceso || data.PROCESO || '',
        'info-planta':      data.planta || data.PLANTA || data.nombre_planta || '',
        'info-salida':      formatDate(data.salida || data.SALIDA || data.fecha_salida),
    };

    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    });
}

/* ── Filas Dinámicas (Insumos / Corte / Tela) ── */
function np_crearFilaDinamica(opciones, listId, removeFn) {
    const list = document.getElementById(listId);
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'dynamic-row';

    const select = document.createElement('select');
    select.className = 'form-select';
    select.innerHTML = '<option value="">Seleccionar...</option>' +
        opciones.map(o => `<option value="${o}">${o}</option>`).join('');

    const cantInput = document.createElement('input');
    cantInput.type = 'number'; cantInput.min = '1';
    cantInput.placeholder = 'Cantidad'; cantInput.className = 'form-input';

    const obsInput = document.createElement('input');
    obsInput.type = 'text';
    obsInput.placeholder = 'Observación'; obsInput.className = 'form-input';

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-remove-row';
    btn.innerHTML = '<i class="fas fa-trash"></i>';
    btn.onclick = () => removeFn(btn);

    row.append(select, cantInput, obsInput, btn);
    list.appendChild(row);
    np_actualizarBotonesEliminar(listId);
}

function np_actualizarBotonesEliminar(listId) {
    const rows = document.querySelectorAll(`#${listId} .dynamic-row`);
    rows.forEach((r, i) => {
        const btn = r.querySelector('.btn-remove-row');
        if (btn) btn.disabled = rows.length === 1;
    });
}

function np_agregarFilaInsumo() { np_crearFilaDinamica(NP_OPCIONES.INSUMOS, 'insumos-list', np_eliminarFila); }
function np_agregarFilaCorte()  { np_crearFilaDinamica(NP_OPCIONES.CORTE,   'corte-list',   np_eliminarFila); }
function np_agregarFilaTela()   { np_crearFilaDinamica(NP_OPCIONES.TELAS,   'telas-list',   np_eliminarFila); }

function np_eliminarFila(btn) {
    const row = btn.closest('.dynamic-row');
    const list = row?.parentElement;
    if (!list || list.querySelectorAll('.dynamic-row').length <= 1) return;
    row.remove();
    np_actualizarBotonesEliminar(list.id);
}

/* ── Recolector de filas ── */
function np_recolectarFilas(listId) {
    return Array.from(document.querySelectorAll(`#${listId} .dynamic-row`)).map(row => {
        const [select, cant, obs] = row.querySelectorAll('select, input');
        return { tipo: select?.value, cantidad: cant?.value, observacion: obs?.value };
    }).filter(r => r.tipo);
}

/* ── Pantalla de Éxito ── */
function np_mostrarPantallaExito(idNovedad) {
    np_showSection('section-success');
    const el = document.getElementById('success-id');
    if (el) el.textContent = `#${idNovedad}`;
}

/* Exponer globalmente */
window.np_showToast            = np_showToast;
window.np_updateStepIndicator  = np_updateStepIndicator;
window.np_mostrarInformacionProducto = np_mostrarInformacionProducto;
window.np_agregarFilaInsumo    = np_agregarFilaInsumo;
window.np_agregarFilaCorte     = np_agregarFilaCorte;
window.np_agregarFilaTela      = np_agregarFilaTela;
window.np_eliminarFila         = np_eliminarFila;
window.np_recolectarFilas      = np_recolectarFilas;
window.np_mostrarPantallaExito = np_mostrarPantallaExito;
window.np_showSection          = np_showSection;
