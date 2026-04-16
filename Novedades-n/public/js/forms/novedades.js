/* ==========================================================================
   forms/novedades.js — Formulario de Reporte de Novedades
   Depende de: forms/gas.js  (collectLotData, fileToBase64, sendToGAS)
               config.js     (SHEETS_DESTINO)
               ui.js         (hideSections)
   ========================================================================== */

const INSUMOS_OPCIONES = [
    'ETIQUETA','PLACA','PLASTIFLECHA','TRAZABILIDAD','ELASTICO',
    'ARGOLLA','TENSOR','FRAMILON','TRANSFER','MARQUILLA',
    'CIERRE','CORDON','HILADILLA','HERRAJE','HEBILLA','ABROCHADURA',
    'APLIQUE','BOTON','GANCHO','PUNTERAS','COPA','ENCAJE','VARILLA',
    'ENTRETELA','VELCRO','OJALES','REMACHES','OTROS'
];

const CORTE_OPCIONES = ['PIEZAS', 'SESGO', 'ENTRETELA'];

// Cache de curvas por referencia
let CURVAS_CACHE = {};

/* ── Helpers de opciones ─────────────────────────────────────────────────── */

function _buildOptions(lista) {
    return '<option value="">Seleccione...</option>' +
        lista.map(o => `<option value="${o}">${o}</option>`).join('');
}

/* ── Fábrica de fila dinámica ────────────────────────────────────────────── */

function _crearFila(opciones, listId, removeFn) {
    const lista = document.getElementById(listId);
    const fila  = document.createElement('div');
    fila.className = 'insumo-fila row-pc-grid mb-3';
    fila.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-tags input-icon"></i>
            <select class="form-control insumo-tipo" required>
                ${_buildOptions(opciones)}
            </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="input-with-icon" style="flex:1;">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control insumo-cantidad" min="1" required>
            </div>
            <button type="button" class="btn-eliminar-insumo"
                onclick="${removeFn}(this)" title="Eliminar"
                style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:8px;
                       color:#ef4444; width:40px; height:40px; cursor:pointer; font-size:0.9rem;
                       display:flex; align-items:center; justify-content:center; transition:all 0.15s;"
                onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    lista.appendChild(fila);
    _actualizarBotonesEliminar(listId);
    return fila;
}

function _actualizarBotonesEliminar(listId) {
    const lista   = document.getElementById(listId);
    const botones = lista.querySelectorAll('.btn-eliminar-insumo');
    botones.forEach(b => {
        b.style.visibility = lista.children.length > 1 ? 'visible' : 'hidden';
    });
}

function _resetLista(listId, addFn) {
    document.getElementById(listId).innerHTML = '';
    addFn();
}

/* ── API pública: INSUMOS ────────────────────────────────────────────────── */

function agregarFilaInsumo() {
    _crearFila(INSUMOS_OPCIONES, 'insumosList', 'eliminarFilaInsumo');
}

function eliminarFilaInsumo(btn) {
    const lista = document.getElementById('insumosList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminar('insumosList');
}

function resetInsumosList() { _resetLista('insumosList', agregarFilaInsumo); }

/* ── API pública: CORTE ──────────────────────────────────────────────────── */

function agregarFilaCorte() {
    _crearFila(CORTE_OPCIONES, 'corteList', 'eliminarFilaCorte');
}

function eliminarFilaCorte(btn) {
    const lista = document.getElementById('corteList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminar('corteList');
}

function resetCorteList() { _resetLista('corteList', agregarFilaCorte); }

/* ── API pública: CÓDIGOS ────────────────────────────────────────────────── */

async function cargarCurvaParaCodigos() {
    const op = document.getElementById('lote').value;
    
    console.log('[códigos] Buscando curva para OP:', op);
    
    if (!op) {
        Swal.fire({
            title: 'Error',
            text: 'No se encontró la OP del producto.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return;
    }

    try {
        // Verificar cache primero
        if (CURVAS_CACHE[op]) {
            console.log('[códigos] Usando cache para OP:', op);
            poblarCodigosDesdeDetalles(CURVAS_CACHE[op].detalles);
            return;
        }

        // Fetch desde API filtrando por OP directamente
        const url = `https://doqsurxxxaudnutsydlk.supabase.co/functions/v1/query?table=CURVA&op=${encodeURIComponent(op)}`;
        console.log('[códigos] Fetching desde:', url);
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error al cargar curva');
        
        const data = await response.json();
        console.log('[códigos] Registros recibidos:', data.length);
        
        // Debería venir solo 1 registro (o varios si hay múltiples curvas para la misma OP)
        const curva = Array.isArray(data) ? data[0] : data;
        
        console.log('[códigos] Curva encontrada:', !!curva);
        
        if (!curva || !curva.detalles || curva.detalles.length === 0) {
            Swal.fire({
                title: 'Sin curva',
                html: `No se encontró curva para la OP: <strong>${op}</strong>`,
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        console.log('[códigos] ✓ Curva encontrada con', curva.detalles.length, 'detalles');
        
        // Guardar en cache
        CURVAS_CACHE[op] = curva;
        
        poblarCodigosDesdeDetalles(curva.detalles);
        
    } catch (error) {
        console.error('[códigos] Error:', error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo cargar la curva. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

function poblarCodigosDesdeDetalles(detalles) {
    const lista = document.getElementById('codigosList');
    lista.innerHTML = '';
    
    // Extraer opciones únicas de tallas y colores
    const tallasUnicas = [...new Set(detalles.map(d => d[3]))].sort();
    const coloresUnicos = [...new Set(detalles.map(d => d[1]))].sort();
    
    console.log('[códigos] Tallas únicas:', tallasUnicas);
    console.log('[códigos] Colores únicos:', coloresUnicos);
    
    // Guardar opciones y detalles completos globalmente
    window.CODIGOS_TALLAS = tallasUnicas;
    window.CODIGOS_COLORES = coloresUnicos;
    window.CODIGOS_DETALLES = detalles; // Para validar máximos
    
    // Crear UNA sola fila vacía para que el usuario seleccione
    agregarFilaCodigo();
}

function agregarFilaCodigo(tallaVal = '', colorVal = '', cantVal = '') {
    const lista = document.getElementById('codigosList');
    const fila  = document.createElement('div');
    fila.className = 'insumo-fila mb-3';
    fila.style.cssText = 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; align-items:center;';
    
    // Opciones de tallas
    const tallasOpts = (window.CODIGOS_TALLAS || []).map(t => 
        `<option value="${t}" ${t === tallaVal ? 'selected' : ''}>${t}</option>`
    ).join('');
    
    // Opciones de colores
    const coloresOpts = (window.CODIGOS_COLORES || []).map(c => 
        `<option value="${c}" ${c === colorVal ? 'selected' : ''}>${c}</option>`
    ).join('');
    
    fila.innerHTML = `
        <div class="input-with-icon">
            <i class="fas fa-ruler input-icon"></i>
            <select class="form-control codigo-talla" required onchange="actualizarMaximoCodigo(this)">
                <option value="">Talla...</option>
                ${tallasOpts}
            </select>
        </div>
        <div class="input-with-icon">
            <i class="fas fa-palette input-icon"></i>
            <select class="form-control codigo-color" required onchange="actualizarMaximoCodigo(this)">
                <option value="">Color...</option>
                ${coloresOpts}
            </select>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <div class="input-with-icon" style="flex:1;">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control codigo-cantidad" value="${cantVal}" min="1" required placeholder="Máx: -">
            </div>
            <button type="button" class="btn-eliminar-insumo"
                onclick="eliminarFilaCodigo(this)" title="Eliminar"
                style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:8px;
                       color:#ef4444; width:40px; height:40px; cursor:pointer; font-size:0.9rem;
                       display:flex; align-items:center; justify-content:center; transition:all 0.15s;"
                onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    lista.appendChild(fila);
    _actualizarBotonesEliminar('codigosList');
    
    // Si hay valores preseleccionados, actualizar el máximo
    if (tallaVal && colorVal) {
        const select = fila.querySelector('.codigo-talla');
        actualizarMaximoCodigo(select);
    }
}

function actualizarMaximoCodigo(selectElement) {
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
    // detalles = [ [codColor, nombreColor, ref, talla, cantidad, barcode], ... ]
    const detalle = (window.CODIGOS_DETALLES || []).find(d => 
        d[3] === talla && d[1] === color
    );
    
    if (detalle) {
        const maximo = detalle[4];
        inputCantidad.max = maximo;
        inputCantidad.placeholder = `Máx: ${maximo}`;
        console.log(`[códigos] Máximo para ${talla}/${color}: ${maximo}`);
    } else {
        inputCantidad.placeholder = 'Máx: -';
        inputCantidad.max = '';
    }
}

function eliminarFilaCodigo(btn) {
    const lista = document.getElementById('codigosList');
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminar('codigosList');
}

function resetCodigosList() {
    document.getElementById('codigosList').innerHTML = '';
}

/* ── Visibilidad según área ──────────────────────────────────────────────── */

function handleAreaChange() {
    const area           = document.getElementById('area').value;
    const insumoGroup    = document.getElementById('tipoInsumoGroup');
    const corteGroup     = document.getElementById('tipoCorteGroup');
    const codigosGroup   = document.getElementById('tipoCodigosGroup');
    const cantidadNormal = document.getElementById('cantidadNormalGroup');
    const cantidadInput  = document.getElementById('cantidadSolicitada');

    // Ocultar todo primero
    insumoGroup.classList.add('hidden');
    corteGroup.classList.add('hidden');
    codigosGroup.classList.add('hidden');
    cantidadNormal.classList.add('hidden');
    cantidadInput.required = false;

    if (area === 'INSUMOS') {
        insumoGroup.classList.remove('hidden');
        if (document.getElementById('insumosList').children.length === 0) agregarFilaInsumo();

    } else if (area === 'CORTE') {
        corteGroup.classList.remove('hidden');
        if (document.getElementById('corteList').children.length === 0) agregarFilaCorte();

    } else if (area === 'CODIGOS') {
        codigosGroup.classList.remove('hidden');
        cargarCurvaParaCodigos();

    } else if (area !== '') {
        cantidadNormal.classList.remove('hidden');
        cantidadInput.required = true;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const areaSelect = document.getElementById('area');
    if (areaSelect) areaSelect.addEventListener('change', handleAreaChange);
});

/* ── Recolección de filas dinámicas ─────────────────────────────────────── */

function _recolectarFilas(listId) {
    const filas = document.querySelectorAll(`#${listId} .insumo-fila`);
    const datos = [];
    let valido = true;
    filas.forEach(fila => {
        const tipo = fila.querySelector('.insumo-tipo').value;
        const cant = fila.querySelector('.insumo-cantidad').value;
        if (!tipo || !cant) { valido = false; return; }
        datos.push({ tipo, cantidad: cant });
    });
    return valido ? datos : null;
}

function _recolectarCodigos() {
    const filas = document.querySelectorAll('#codigosList .insumo-fila');
    const datos = [];
    let valido = true;
    filas.forEach(fila => {
        const talla = fila.querySelector('.codigo-talla').value;
        const color = fila.querySelector('.codigo-color').value;
        const cant  = fila.querySelector('.codigo-cantidad').value;
        if (!talla || !color || !cant) { valido = false; return; }
        datos.push({ talla, color, cantidad: cant });
    });
    return valido ? datos : null;
}

/* ── Submit ──────────────────────────────────────────────────────────────── */

async function handleNovedadesSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const lotData     = collectLotData();
        const area        = document.getElementById('area').value;
        const tipoNovedad = document.getElementById('tipoNovedad').value || '';
        const descripcion = document.getElementById('observacionesNovedad').value;
        const imagenFile  = document.getElementById('imagen').files?.[0] || null;

        let cantidadSolicitada = '';
        let tipoInsumo         = '';

        if (area === 'INSUMOS') {
            const datos = _recolectarFilas('insumosList');
            if (!datos) throw new Error('Complete el tipo y cantidad de todos los insumos.');
            tipoInsumo         = datos.map(i => `${i.tipo} x${i.cantidad}`).join(', ');
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);

        } else if (area === 'CORTE') {
            const datos = _recolectarFilas('corteList');
            if (!datos) throw new Error('Complete el tipo y cantidad de todas las piezas de corte.');
            tipoInsumo         = datos.map(i => `${i.tipo} x${i.cantidad}`).join(', ');
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);

        } else if (area === 'CODIGOS') {
            const datos = _recolectarCodigos();
            if (!datos) throw new Error('Complete talla, color y cantidad de todos los códigos.');
            tipoInsumo         = datos.map(i => `${i.talla}/${i.color} x${i.cantidad}`).join(', ');
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);

        } else {
            cantidadSolicitada = document.getElementById('cantidadSolicitada').value;
        }

        console.log('[novedades]', { lote: lotData.lote, area, tipoNovedad, tipoInsumo, cantidadSolicitada });

        const payload = {
            hoja: SHEETS_DESTINO.NOVEDADES,
            ...lotData,
            area,
            tipoNovedad,
            tipoInsumo,
            descripcion,
            cantidadSolicitada,
            imagen: '',
        };

        const result    = await sendToGAS(payload);
        const idNovedad = result.id || result.ID_NOVEDAD;
        if (!idNovedad) throw new Error('No se recibió ID de la novedad');

        Swal.fire({
            title: '¡Novedad registrada!',
            text: 'La novedad fue guardada exitosamente.',
            icon: 'success',
            timer: 2500,
            showConfirmButton: false,
        });

        e.target.reset();
        resetInsumosList();
        resetCorteList();
        resetCodigosList();
        if (typeof clearVersionHistory === 'function') clearVersionHistory();
        hideSections();

        if (imagenFile && idNovedad) {
            uploadArchivoAsync(imagenFile, idNovedad, SHEETS_DESTINO.NOVEDADES);
        }

    } catch (error) {
        Swal.fire({
            title: 'Error al enviar',
            text: error.message || 'No se pudo enviar el reporte. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'OK',
        });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Reporte';
    }
}
