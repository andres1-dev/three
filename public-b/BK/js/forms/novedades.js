/* ==========================================================================
   forms/novedades.js — Formulario de Reporte de Novedades
   Depende de: forms/gas.js  (collectLotData, fileToBase64, sendToGAS)
               config.js     (SHEETS_DESTINO)
               ui.js         (hideSections)
   ========================================================================== */

const INSUMOS_OPCIONES = [
    'ETIQUETA', 'PLACA', 'PLASTIFLECHA', 'TRAZABILIDAD', 'ELASTICO',
    'ARGOLLA', 'TENSOR', 'FRAMILON', 'TRANSFER', 'MARQUILLA',
    'CIERRE', 'CORDON', 'HILADILLA', 'HERRAJE', 'HEBILLA', 'ABROCHADURA',
    'APLIQUE', 'BOTON', 'GANCHO', 'PUNTERAS', 'COPA', 'ENCAJE', 'VARILLA',
    'ENTRETELA', 'VELCRO', 'OJALES', 'REMACHES', 'OTROS'
];

const CORTE_OPCIONES = ['PIEZAS', 'SESGO', 'ENTRETELA'];

const TELAS_OPCIONES = ['ROTOS', 'MANCHAS', 'HIDOS', 'MAREADA', 'TONO', 'SE DESTIÑE', 'SE ROMPE', 'OTROS'];

// Listados estáticos para la sección de CÓDIGOS
const CODIGOS_TALLAS_LIST = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
    '2', '4', '6', '8', '10', '12', '14', '16', '18',
    '28', '30', '32', '34', '36', '38', '40', '42',
    'UNICA', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'
];

const CODIGOS_COLORES_LIST = [
    'AGUA', 'AGUA MARINA', 'ALMENDRA', 'AMARILLO', 'AMARILLO CIELO', 'AMARILLO CLARO', 'AMARILLO MEDIO', 'AMARILLO NEON',
    'ARENA', 'AVENA', 'AZUL', 'AZUL AGUAMARINA', 'AZUL CELESTE', 'AZUL CIELO', 'AZUL CLARO',
    'AZUL DENIM', 'AZUL ELECTRICO', 'AZUL HORTENSIA', 'AZUL INDIGO', 'AZUL MEDIO', 'AZUL OSCURO', 'AZUL PETROLEO', 'AZUL REY',
    'AZULTURQUI', 'BABY BLUE', 'BEIGE', 'BERENJENA', 'BLANCO', 'BLANCO/AZUL', 'BLANCO/DORADO', 'BLANCO/NAVY', 'BLANCO/NEGRO',
    'BLANCO/PLATEADO', 'BLANCO/ROJO', 'BLANCO/ROSADO', 'BLANCO-FUCSIA', 'CAFÉ', 'CAFÉ CLARO', 'CAFÉ OSCURO', 'CAMEL',
    'CARAMELO', 'COBRE', 'COCOA', 'CORAL', 'CORAL NEON', 'CREMA', 'CRUDO', 'CRUDO/NEGRO', 'CURUBA', 'DORADO', 'DORADO PERLA',
    'DORADO/NEGRO', 'ESMERALDA', 'FUCSIA', 'FUCSIA BRILLANT', 'FUCSIA NEON', 'GRIS', 'GRIS / MILITAR', 'GRIS CLARO',
    'GRIS CLARO JASP', 'GRIS CROSS', 'GRIS FUSIL', 'GRIS JASPE', 'GRIS JASPE CLARO', 'GRIS JASPE MEDIO', 'GRIS JASPE OSC',
    'GRIS MEDIO', 'GRIS MELANGE CL', 'GRIS MELANGE OS', 'GRIS OSC JASPE', 'GRISOSCURO', 'HABANO', 'IVORY', 'JADE', 'JADE JASPE',
    'KAKY', 'KAKY CLARO', 'KAKY OSCURO', 'LILA', 'LILA CLARO', 'LILA OSCURO', 'MAGENTA', 'MANDARINA', 'MANDARINA NEON',
    'MARFIL', 'MARRON', 'MORA LECHE', 'MORADO', 'MORADO CLARO', 'MORADO OSCURO', 'MOSTAZA', 'NARANJA', 'NARANJA NEON',
    'NAVY', 'NEGRO', 'NEGRO CROSS', 'NEGRO JASPE', 'NEGRO/AMARILLO', 'NEGRO/AZUL', 'NEGRO/BLANCO', 'NEGRO/DORADO',
    'NEGRO/PLATEADO', 'NEGRO-ROJO', 'NEW BLU', 'NIQUEL', 'NUDE', 'OCRE', 'OFFWHITE', 'ORO ROSA', 'PACIFICO', 'PALO DE ROSA',
    'PALO ROSA JASPE', 'PAVON', 'PAVONADO', 'PETROLEO', 'PLATA/DORADO', 'PLATA/NEGRO', 'PLATEADO', 'PLOMO', 'PPT', 'PROMOCION',
    'ROJO', 'ROJO ESCARLATA', 'ROJO FIESTA', 'ROJO VERDE', 'ROJO/NEGRO', 'ROJO-AZUL', 'ROSA', 'ROSA CLARO', 'ROSA LILA',
    'ROSADO', 'ROSADO CLARO', 'ROSADO NEON', 'ROSADO/NEGRO', 'ROSAMORA', 'ROSANEON', 'ROSEQUARZ', 'RUBOR', 'SALMON', 'TAUPE',
    'TERRACOTA', 'TORNASOL', 'TRANSPARENTE', 'TRICOLOR', 'TURQUEZA', 'TURQUI', 'VAINILLA', 'VERDE', 'VERDE AGUA', 'VERDE BOTELLA',
    'VERDE CALI', 'VERDE CLARO', 'VERDE ESMERALDA', 'VERDE FOLLAGE', 'VERDE JADE', 'VERDE JASPE', 'VERDE LIMON', 'VERDE MANZANA',
    'VERDE MENTA', 'VERDE MILITAR', 'VERDE NEON', 'VERDE OLIVA', 'VERDE PINO', 'VERDE SALVIA', 'VERDE SELVA', 'VINO TINTO',
    'WHITE', 'ZAPOTE'
];

/* ── Helpers de opciones ─────────────────────────────────────────────────── */

function _buildOptions(lista) {
    return '<option value="">Seleccione...</option>' +
        lista.map(o => `<option value="${o}">${o}</option>`).join('');
}

/* ── Fábrica de fila dinámica ────────────────────────────────────────────── */

function _crearFila(opciones, listId, removeFn, prefix = '') {
    const lista = document.getElementById(listId);
    const fila = document.createElement('div');
    fila.className = 'insumo-fila mb-3 fila-2-cols'; // Clase para 2 columnas
    // NO usar inline styles, dejar que CSS maneje el responsive

    // Determinar los labels según el tipo de lista
    let labelTipo = 'Tipo:';
    let labelCantidad = 'Cantidad:';
    let iconoTipo = 'fa-tags';

    if (listId.includes('corte') || listId.includes('Corte')) {
        labelTipo = 'Tipo de Corte:';
    } else if (listId.includes('tela') || listId.includes('Tela')) {
        labelTipo = 'Tipo de Imperfección:';
    } else if (listId.includes('insumo') || listId.includes('Insumo')) {
        labelTipo = 'Tipo de Insumo:';
    }

    fila.innerHTML = `
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline">${labelTipo} <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-mobile"
                    onclick="${removeFn}(this${prefix ? ", '" + prefix + "'" : ''})" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;"
                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas ${iconoTipo} input-icon"></i>
                <select class="form-control form-control-sm insumo-tipo">
                    ${_buildOptions(opciones)}
                </select>
            </div>
        </div>
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline">${labelCantidad} <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-desktop"
                    onclick="${removeFn}(this${prefix ? ", '" + prefix + "'" : ''})" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;"
                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control form-control-sm insumo-cantidad" min="1" placeholder="Cantidad">
            </div>
        </div>`;
    lista.appendChild(fila);
    _actualizarBotonesEliminar(listId);
    return fila;
}

function _actualizarBotonesEliminar(listId) {
    const lista = document.getElementById(listId);
    const filas = lista.querySelectorAll('.insumo-fila');
    const hayMultiples = filas.length > 1;

    filas.forEach(fila => {
        const btn = fila.querySelector('.btn-eliminar-insumo');
        if (hayMultiples) {
            // Mostrar botón y ajustar grid para incluirlo
            btn.style.display = 'flex';
            const container = btn.parentElement;
            container.style.display = 'flex';
        } else {
            // Ocultar botón y expandir input
            btn.style.display = 'none';
            const container = btn.parentElement;
            container.style.display = 'block';
        }
    });
}

function _resetLista(listId, addFn) {
    document.getElementById(listId).innerHTML = '';
    addFn();
}

/* ── API pública: INSUMOS ────────────────────────────────────────────────── */

function agregarFilaInsumo(prefix = '') {
    const listId = prefix ? `${prefix}InsumosList` : 'insumosList';
    const fila = _crearFila(INSUMOS_OPCIONES, listId, 'eliminarFilaInsumo', prefix);
    // Si el grupo está visible, agregar required
    const insumoGroup = document.getElementById(prefix ? `${prefix}TipoInsumoGroup` : 'tipoInsumoGroup');
    if (!insumoGroup.classList.contains('hidden')) {
        fila.querySelector('.insumo-tipo').required = true;
        fila.querySelector('.insumo-cantidad').required = true;
    }
}

function eliminarFilaInsumo(btn, prefix = '') {
    const listId = prefix ? `${prefix}InsumosList` : 'insumosList';
    const lista = document.getElementById(listId);
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminar(listId);
}

function resetInsumosList(prefix = '') {
    const listId = prefix ? `${prefix}InsumosList` : 'insumosList';
    _resetLista(listId, () => agregarFilaInsumo(prefix));
}

/* ── API pública: CORTE ──────────────────────────────────────────────────── */

function agregarFilaCorte(prefix = '') {
    const listId = prefix ? `${prefix}CorteList` : 'corteList';
    const fila = _crearFila(CORTE_OPCIONES, listId, 'eliminarFilaCorte', prefix);
    // Si el grupo está visible, agregar required
    const corteGroup = document.getElementById(prefix ? `${prefix}TipoCorteGroup` : 'tipoCorteGroup');
    if (!corteGroup.classList.contains('hidden')) {
        fila.querySelector('.insumo-tipo').required = true;
        fila.querySelector('.insumo-cantidad').required = true;
    }
}

function eliminarFilaCorte(btn, prefix = '') {
    const listId = prefix ? `${prefix}CorteList` : 'corteList';
    const lista = document.getElementById(listId);
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminar(listId);
}

function resetCorteList(prefix = '') {
    const listId = prefix ? `${prefix}CorteList` : 'corteList';
    _resetLista(listId, () => agregarFilaCorte(prefix));
}

/* ── API pública: TELAS ──────────────────────────────────────────────────── */

function agregarFilaTela(prefix = '') {
    const listId = prefix ? `${prefix}TelasList` : 'telasList';
    const fila = _crearFila(TELAS_OPCIONES, listId, 'eliminarFilaTela', prefix);
    // Si el grupo está visible, agregar required
    const telasGroup = document.getElementById(prefix ? `${prefix}TipoTelasGroup` : 'tipoTelasGroup');
    if (!telasGroup.classList.contains('hidden')) {
        fila.querySelector('.insumo-tipo').required = true;
        fila.querySelector('.insumo-cantidad').required = true;
    }
}

function eliminarFilaTela(btn, prefix = '') {
    const listId = prefix ? `${prefix}TelasList` : 'telasList';
    const lista = document.getElementById(listId);
    if (lista.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminar(listId);
}

function resetTelasList(prefix = '') {
    const listId = prefix ? `${prefix}TelasList` : 'telasList';
    _resetLista(listId, () => agregarFilaTela(prefix));
}

/* ── API pública: CÓDIGOS ────────────────────────────────────────────────── */

async function cargarCurvaParaCodigos() {
    const op = document.getElementById('lote').value;
    const cantidadLote = Number(document.getElementById('cantidad').value) || 0;

    console.log('[códigos] Preparando sección de códigos para OP:', op);

    if (!op) {
        Swal.fire({
            title: 'Error',
            text: 'No se encontró la OP del producto.',
            icon: 'error',
            confirmButtonText: 'OK'
        });
        return;
    }

    // Configurar opciones globales para el formulario de códigos
    window.CODIGOS_TALLAS = CODIGOS_TALLAS_LIST;
    window.CODIGOS_COLORES = CODIGOS_COLORES_LIST;
    window.CODIGOS_CANTIDAD_TOTAL = cantidadLote;

    // Establecer la cantidad total en el input
    document.getElementById('codigosCantidadTotal').value = cantidadLote;

    // Limpiar y crear una fila inicial
    const lista = document.getElementById('codigosList');
    lista.innerHTML = '';
    agregarFilaCodigo();
}


function handleCodigosTipoChange() {
    const tipo = document.getElementById('codigosTipoSolicitud').value;
    const loteCompletoGroup = document.getElementById('codigosLoteCompletoGroup');
    const unidadesGroup = document.getElementById('codigosUnidadesGroup');
    const cantidadInput = document.getElementById('codigosCantidadTotal');
    const tipoSolicitudSelect = document.getElementById('codigosTipoSolicitud');
    const rowGrid = document.getElementById('codigosRowGrid');

    if (tipo === 'LOTE_COMPLETO') {
        loteCompletoGroup.classList.remove('hidden');
        unidadesGroup.classList.add('hidden');
        tipoSolicitudSelect.required = true;
        cantidadInput.disabled = false;
        // Quitar required de los campos de unidades
        document.querySelectorAll('#codigosList .codigo-talla, #codigosList .codigo-color, #codigosList .codigo-cantidad').forEach(el => el.required = false);
        // Expandir a 2 columnas
        rowGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else if (tipo === 'UNIDADES') {
        loteCompletoGroup.classList.add('hidden');
        unidadesGroup.classList.remove('hidden');
        tipoSolicitudSelect.required = true;
        cantidadInput.disabled = true;
        // Agregar required a los campos de unidades
        document.querySelectorAll('#codigosList .codigo-talla, #codigosList .codigo-color, #codigosList .codigo-cantidad').forEach(el => el.required = true);
        // Mantener 1 columna
        rowGrid.style.gridTemplateColumns = '1fr';
    } else {
        loteCompletoGroup.classList.add('hidden');
        unidadesGroup.classList.add('hidden');
        tipoSolicitudSelect.required = false;
        cantidadInput.disabled = true;
        // Quitar required de los campos de unidades
        document.querySelectorAll('#codigosList .codigo-talla, #codigosList .codigo-color, #codigosList .codigo-cantidad').forEach(el => el.required = false);
        // Mantener 1 columna cuando no hay selección
        rowGrid.style.gridTemplateColumns = '1fr';
    }
}

function agregarFilaCodigo(tallaVal = '', colorVal = '', cantVal = '') {
    const lista = document.getElementById('codigosList');
    const fila = document.createElement('div');
    fila.className = 'insumo-fila mb-3 fila-3-cols'; // Clase para 3 columnas
    // NO usar inline styles, dejar que CSS maneje el responsive

    // Opciones filtradas según prenda y género
    const tallasFiltradas = getFilteredSizes();
    const coloresFiltrados = CODIGOS_COLORES_LIST;

    fila.innerHTML = `
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline">Talla: <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-mobile"
                    onclick="eliminarFilaCodigo(this)" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;"
                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-ruler input-icon"></i>
                <input type="text" class="form-control form-control-sm codigo-talla" 
                    placeholder="Talla..." autocomplete="off" value="${tallaVal}" list="tallas-list-${Date.now()}">
                <datalist id="tallas-list-${Date.now()}">
                    ${CODIGOS_TALLAS_LIST.map(t => `<option value="${t}"></option>`).join('')}
                </datalist>
            </div>
        </div>
        <div class="campo-dinamico">
            <label class="form-label-inline">Color: <span style="color:#ef4444;">*</span></label>
            <div class="input-with-icon">
                <i class="fas fa-palette input-icon"></i>
                <input type="text" class="form-control form-control-sm codigo-color" 
                    placeholder="Color..." autocomplete="off" value="${colorVal}" list="colores-list-${Date.now()}">
                <datalist id="colores-list-${Date.now()}">
                    ${CODIGOS_COLORES_LIST.map(c => `<option value="${c}"></option>`).join('')}
                </datalist>
            </div>
        </div>
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline">Cantidad: <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-desktop"
                    onclick="eliminarFilaCodigo(this)" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;"
                    onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control form-control-sm codigo-cantidad" value="${cantVal}" min="1" placeholder="Máx: -">
            </div>
        </div>`;
    lista.appendChild(fila);
    _actualizarBotonesEliminar('codigosList');

    // Inicializar Smart Selects removido (usando datalist nativo)
    const inputTalla = fila.querySelector('.codigo-talla');
    const inputColor = fila.querySelector('.codigo-color');

    // Event listeners para validación y máximos
    inputTalla.addEventListener('change', () => actualizarMaximoCodigo(inputTalla));
    inputColor.addEventListener('change', () => actualizarMaximoCodigo(inputColor));

    // Si hay valores preseleccionados, actualizar el máximo
    if (tallaVal && colorVal) {
        actualizarMaximoCodigo(inputTalla);
    }
}

/**
 * Filtra las tallas según la prenda y el género del lote
 */
function getFilteredSizes() {
    const prenda = (document.getElementById('prenda').value || '').toUpperCase();
    const genero = (document.getElementById('genero').value || '').toUpperCase();
    let sizes = [...CODIGOS_TALLAS_LIST];

    // Filtro por Género
    if (genero.includes('BEBE')) {
        sizes = sizes.filter(s => s.includes('M') || s === 'UNICA');
    } else if (genero.includes('NIÑ')) {
        sizes = sizes.filter(s => {
            const n = parseInt(s);
            return (!isNaN(n) && n <= 18) || s === 'UNICA';
        });
    } else if (genero.includes('HOMBRE') || genero.includes('MUJER')) {
        sizes = sizes.filter(s => {
            const n = parseInt(s);
            return isNaN(n) || n >= 28;
        });
    }

    // Filtro por Prenda
    if (prenda.includes('CALZADO')) {
        sizes = sizes.filter(s => !isNaN(parseInt(s)) && parseInt(s) >= 20);
    } else if (prenda.includes('JEAN') || prenda.includes('PANTALON')) {
        sizes = sizes.filter(s => !isNaN(parseInt(s)));
    } else if (prenda.includes('CAMISA') || prenda.includes('CAMISETA') || prenda.includes('POLO')) {
        sizes = sizes.filter(s => isNaN(parseInt(s)) || s === 'UNICA');
    }

    return sizes.length > 0 ? sizes : CODIGOS_TALLAS_LIST;
}

    // Función _setupSmartSelect eliminada, usando datalist nativo

function actualizarMaximoCodigo(selectElement) {
    const fila = selectElement.closest('.insumo-fila');
    const inputCantidad = fila.querySelector('.codigo-cantidad');
    const maximo = window.CODIGOS_CANTIDAD_TOTAL || 0;

    if (maximo > 0) {
        inputCantidad.max = maximo;
        inputCantidad.placeholder = `Máx: ${maximo}`;
    } else {
        inputCantidad.placeholder = 'Cantidad';
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
    document.getElementById('codigosTipoSolicitud').value = '';
    document.getElementById('codigosCantidadTotal').value = '';
    document.getElementById('codigosLoteCompletoGroup').classList.add('hidden');
    document.getElementById('codigosUnidadesGroup').classList.add('hidden');
    // Resetear grid a 1 columna
    document.getElementById('codigosRowGrid').style.gridTemplateColumns = '1fr';
}

/* ── Visibilidad según área ──────────────────────────────────────────────── */

function handleAreaChange() {
    const area = document.getElementById('area').value;
    const insumoGroup = document.getElementById('tipoInsumoGroup');
    const corteGroup = document.getElementById('tipoCorteGroup');
    const telasGroup = document.getElementById('tipoTelasGroup');
    const codigosGroup = document.getElementById('tipoCodigosGroup');
    const cantidadNormal = document.getElementById('cantidadNormalGroup');
    const cantidadNormalInput = document.getElementById('cantidadNormal');
    const cantidadDiseno = document.getElementById('cantidadDisenoGroup');
    const cantidadDisenoInput = document.getElementById('cantidadSolicitada');
    const tipoNovedadGroup = document.getElementById('tipoNovedadGroup');
    const tipoNovedadSelect = document.getElementById('tipoNovedad');
    const areaNovedadRow = document.getElementById('areaNovedadRow');
    const tipoSolicitudSelect = document.getElementById('codigosTipoSolicitud');

    // Ocultar todo primero y remover required
    insumoGroup.classList.add('hidden');
    corteGroup.classList.add('hidden');
    telasGroup.classList.add('hidden');
    codigosGroup.classList.add('hidden');
    cantidadNormal.classList.add('hidden');
    cantidadDiseno.classList.add('hidden');
    cantidadNormalInput.required = false;
    cantidadDisenoInput.required = false;
    tipoSolicitudSelect.required = false;

    // Remover required de todos los campos dinámicos
    document.querySelectorAll('#insumosList .insumo-tipo, #insumosList .insumo-cantidad').forEach(el => el.required = false);
    document.querySelectorAll('#corteList .insumo-tipo, #corteList .insumo-cantidad').forEach(el => el.required = false);
    document.querySelectorAll('#telasList .insumo-tipo, #telasList .insumo-cantidad').forEach(el => el.required = false);
    document.querySelectorAll('#codigosList .codigo-talla, #codigosList .codigo-color, #codigosList .codigo-cantidad').forEach(el => el.required = false);

    if (area === 'DISEÑO') {
        // DISEÑO: cantidad al lado del área (en el mismo row), no editable
        tipoNovedadGroup.classList.add('hidden');
        tipoNovedadSelect.required = false;
        cantidadDiseno.classList.remove('hidden');
        cantidadDisenoInput.required = true;
        cantidadDisenoInput.readOnly = true;
        const cantidadLote = document.getElementById('cantidad').value;
        cantidadDisenoInput.value = cantidadLote;
        // Expandir grid a 2 columnas
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';

    } else if (area === 'TELAS') {
        // TELAS: tipo de novedad = IMPERFECTO (fijo), lista de tipos de tela
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.value = 'IMPERFECTO';
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = true;
        telasGroup.classList.remove('hidden');
        if (document.getElementById('telasList').children.length === 0) agregarFilaTela();
        // Agregar required a los campos visibles de telas
        document.querySelectorAll('#telasList .insumo-tipo, #telasList .insumo-cantidad').forEach(el => el.required = true);
        // Expandir grid a 2 columnas
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';

    } else if (area === 'INSUMOS') {
        insumoGroup.classList.remove('hidden');
        if (document.getElementById('insumosList').children.length === 0) agregarFilaInsumo();
        // Agregar required a los campos visibles de insumos
        document.querySelectorAll('#insumosList .insumo-tipo, #insumosList .insumo-cantidad').forEach(el => el.required = true);
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        // Expandir grid a 2 columnas
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';

    } else if (area === 'CORTE') {
        corteGroup.classList.remove('hidden');
        if (document.getElementById('corteList').children.length === 0) agregarFilaCorte();
        // Agregar required a los campos visibles de corte
        document.querySelectorAll('#corteList .insumo-tipo, #corteList .insumo-cantidad').forEach(el => el.required = true);
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        // Expandir grid a 2 columnas
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';

    } else if (area === 'CODIGOS') {
        codigosGroup.classList.remove('hidden');
        cargarCurvaParaCodigos();
        // Agregar required al select de tipo de solicitud
        tipoSolicitudSelect.required = true;
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        // Expandir grid a 2 columnas
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';

    } else if (area !== '') {
        cantidadNormal.classList.remove('hidden');
        cantidadNormalInput.required = true;
        cantidadNormalInput.readOnly = false;
        cantidadNormalInput.value = '';
        tipoNovedadGroup.classList.remove('hidden');
        tipoNovedadSelect.required = true;
        tipoNovedadSelect.disabled = false;
        // Expandir grid a 2 columnas
        areaNovedadRow.style.gridTemplateColumns = 'repeat(2, 1fr)';
    } else {
        // Sin selección: mantener 1 columna
        areaNovedadRow.style.gridTemplateColumns = '1fr';
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
        const cant = fila.querySelector('.codigo-cantidad').value;
        if (!talla || !color || !cant) { valido = false; return; }
        datos.push({ talla, color, cantidad: cant });
    });
    return valido ? datos : null;
}

/* ── Helpers de validación visual ────────────────────────────────────────── */

function _marcarCampoError(elemento, mensaje) {
    // Agregar borde rojo
    elemento.style.border = '2px solid #ef4444';
    elemento.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';

    // Hacer scroll al campo
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Focus en el campo después del scroll
    setTimeout(() => {
        elemento.focus();

        // Mostrar mensaje de error
        Swal.fire({
            title: 'Campo requerido',
            text: mensaje,
            icon: 'warning',
            confirmButtonColor: '#3F51B5',
            confirmButtonText: 'Entendido'
        });
    }, 300);

    // Remover el borde rojo cuando el usuario interactúe con el campo
    const removerError = () => {
        elemento.style.border = '';
        elemento.style.boxShadow = '';
        elemento.removeEventListener('input', removerError);
        elemento.removeEventListener('change', removerError);
        elemento.removeEventListener('focus', removerError);
    };

    elemento.addEventListener('input', removerError);
    elemento.addEventListener('change', removerError);
    elemento.addEventListener('focus', removerError);
}

function _validarCampoRequerido(id, nombreCampo) {
    const elemento = document.getElementById(id);
    if (!elemento) return true;

    const valor = elemento.value?.trim();
    if (!valor || valor === '') {
        _marcarCampoError(elemento, `Por favor completa el campo: ${nombreCampo}`);
        return false;
    }
    return true;
}

/* ── Submit ──────────────────────────────────────────────────────────────── */

async function handleNovedadesSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');

    // Validar campos básicos del lote ANTES de deshabilitar el botón
    if (!_validarCampoRequerido('lote', 'Lote (OP)')) {
        return;
    }
    if (!_validarCampoRequerido('referencia', 'Referencia')) {
        return;
    }
    if (!_validarCampoRequerido('color', 'Color')) {
        return;
    }
    if (!_validarCampoRequerido('cantidad', 'Cantidad')) {
        return;
    }
    if (!_validarCampoRequerido('area', 'Área de Servicios')) {
        return;
    }

    // Validar tipo de novedad si es visible y requerido
    const tipoNovedadGroup = document.getElementById('tipoNovedadGroup');
    const tipoNovedadSelect = document.getElementById('tipoNovedad');
    if (tipoNovedadGroup && !tipoNovedadGroup.classList.contains('hidden') && tipoNovedadSelect.required) {
        if (!_validarCampoRequerido('tipoNovedad', 'Tipo de Novedad')) {
            return;
        }
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const lotData = collectLotData();
        const area = document.getElementById('area').value;
        const tipoNovedad = document.getElementById('tipoNovedad').value || null;
        const descripcion = document.getElementById('observacionesNovedad').value;
        const imagenFile = document.getElementById('imagen').files?.[0] || null;

        let cantidadSolicitada = 0;
        let tipoDetalle = null;

        // Construir TIPO_DETALLE según el área
        if (area === 'DISEÑO') {
            // DISEÑO: cantidad total del lote, sin tipo_novedad ni tipo_detalle
            const cantidadInput = document.getElementById('cantidadSolicitada');
            if (!cantidadInput.value || Number(cantidadInput.value) <= 0) {
                btn.disabled = false;
                btn.textContent = 'Enviar Reporte';
                _marcarCampoError(cantidadInput, 'Por favor ingresa la cantidad solicitada');
                return;
            }
            cantidadSolicitada = Number(cantidadInput.value);
            tipoDetalle = null;

        } else if (area === 'TELAS') {
            const datos = _recolectarFilas('telasList');
            if (!datos) {
                btn.disabled = false;
                btn.textContent = 'Enviar Reporte';
                // Buscar el primer campo vacío en la lista de telas
                const primeraFilaIncompleta = document.querySelector('#telasList .insumo-fila');
                if (primeraFilaIncompleta) {
                    const tipoVacio = primeraFilaIncompleta.querySelector('.insumo-tipo');
                    const cantVacia = primeraFilaIncompleta.querySelector('.insumo-cantidad');
                    if (!tipoVacio.value) {
                        _marcarCampoError(tipoVacio, 'Por favor selecciona el tipo de imperfección de tela');
                    } else if (!cantVacia.value) {
                        _marcarCampoError(cantVacia, 'Por favor ingresa la cantidad');
                    }
                }
                return;
            }

            tipoDetalle = {
                items: datos.map(i => ({
                    tipo: i.tipo,
                    cantidad: Number(i.cantidad)
                }))
            };
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);

        } else if (area === 'INSUMOS') {
            const datos = _recolectarFilas('insumosList');
            if (!datos) {
                btn.disabled = false;
                btn.textContent = 'Enviar Reporte';
                // Buscar el primer campo vacío en la lista de insumos
                const primeraFilaIncompleta = document.querySelector('#insumosList .insumo-fila');
                if (primeraFilaIncompleta) {
                    const tipoVacio = primeraFilaIncompleta.querySelector('.insumo-tipo');
                    const cantVacia = primeraFilaIncompleta.querySelector('.insumo-cantidad');
                    if (!tipoVacio.value) {
                        _marcarCampoError(tipoVacio, 'Por favor selecciona el tipo de insumo');
                    } else if (!cantVacia.value) {
                        _marcarCampoError(cantVacia, 'Por favor ingresa la cantidad');
                    }
                }
                return;
            }

            tipoDetalle = {
                items: datos.map(i => ({
                    tipo: i.tipo,
                    cantidad: Number(i.cantidad)
                }))
            };
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);

        } else if (area === 'CORTE') {
            const datos = _recolectarFilas('corteList');
            if (!datos) {
                btn.disabled = false;
                btn.textContent = 'Enviar Reporte';
                // Buscar el primer campo vacío en la lista de corte
                const primeraFilaIncompleta = document.querySelector('#corteList .insumo-fila');
                if (primeraFilaIncompleta) {
                    const tipoVacio = primeraFilaIncompleta.querySelector('.insumo-tipo');
                    const cantVacia = primeraFilaIncompleta.querySelector('.insumo-cantidad');
                    if (!tipoVacio.value) {
                        _marcarCampoError(tipoVacio, 'Por favor selecciona el tipo de pieza de corte');
                    } else if (!cantVacia.value) {
                        _marcarCampoError(cantVacia, 'Por favor ingresa la cantidad');
                    }
                }
                return;
            }

            tipoDetalle = {
                items: datos.map(i => ({
                    tipo: i.tipo,
                    cantidad: Number(i.cantidad)
                }))
            };
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);

        } else if (area === 'CODIGOS') {
            const tipoSolicitud = document.getElementById('codigosTipoSolicitud').value;

            if (!tipoSolicitud) {
                btn.disabled = false;
                btn.textContent = 'Enviar Reporte';
                const tipoSolicitudSelect = document.getElementById('codigosTipoSolicitud');
                _marcarCampoError(tipoSolicitudSelect, 'Por favor selecciona el tipo de solicitud (Lote completo o Unidades específicas)');
                return;
            }

            if (tipoSolicitud === 'LOTE_COMPLETO') {
                const cantidadInput = document.getElementById('codigosCantidadTotal');
                if (!cantidadInput.value || Number(cantidadInput.value) <= 0) {
                    btn.disabled = false;
                    btn.textContent = 'Enviar Reporte';
                    _marcarCampoError(cantidadInput, 'Por favor verifica la cantidad total del lote');
                    return;
                }
                cantidadSolicitada = Number(cantidadInput.value);
                tipoDetalle = {
                    tipo_solicitud: 'LOTE_COMPLETO',
                    cantidad_total: cantidadSolicitada
                };
            } else {
                const datos = _recolectarCodigos();
                if (!datos) {
                    btn.disabled = false;
                    btn.textContent = 'Enviar Reporte';
                    // Buscar el primer campo vacío en la lista de códigos
                    const primeraFilaIncompleta = document.querySelector('#codigosList .insumo-fila');
                    if (primeraFilaIncompleta) {
                        const tallaVacia = primeraFilaIncompleta.querySelector('.codigo-talla');
                        const colorVacio = primeraFilaIncompleta.querySelector('.codigo-color');
                        const cantVacia = primeraFilaIncompleta.querySelector('.codigo-cantidad');
                        if (!tallaVacia.value) {
                            _marcarCampoError(tallaVacia, 'Por favor selecciona la talla');
                        } else if (!colorVacio.value) {
                            _marcarCampoError(colorVacio, 'Por favor selecciona el color');
                        } else if (!cantVacia.value) {
                            _marcarCampoError(cantVacia, 'Por favor ingresa la cantidad');
                        }
                    }
                    return;
                }

                tipoDetalle = {
                    tipo_solicitud: 'UNIDADES',
                    items: datos.map(i => ({
                        talla: i.talla,
                        color: i.color,
                        cantidad: Number(i.cantidad)
                    }))
                };
                cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);
            }

        } else {
            // OTROS: cantidad simple sin detalle
            const cantidadInput = document.getElementById('cantidadSolicitada') ||
                document.getElementById('cantidadNormal');
            if (!cantidadInput || !cantidadInput.value || Number(cantidadInput.value) <= 0) {
                btn.disabled = false;
                btn.textContent = 'Enviar Reporte';
                if (cantidadInput) {
                    _marcarCampoError(cantidadInput, 'Por favor ingresa la cantidad solicitada');
                }
                return;
            }
            cantidadSolicitada = Number(cantidadInput.value);
            tipoDetalle = null;
        }

        console.log('[novedades] Datos recopilados:', {
            lote: lotData.lote, area, tipoNovedad, tipoDetalle, cantidadSolicitada,
            tieneImagen: !!imagenFile
        });

        // Resolver productora con cadena de fuentes: currentUser → localStorage → planta universal
        const _resolveProductoraId = () => {
            // Fuente 1: currentUser (varias variantes de clave)
            const fromUser = currentUser?.ID_PRODUCTORA || currentUser?.id_productora || currentUser?.productora;
            if (fromUser) return parseInt(fromUser) || fromUser;
            // Fuente 2: busint_productora en localStorage
            try {
                const saved = JSON.parse(localStorage.getItem('busint_productora') || 'null');
                if (saved?.ID_PRODUCTORA) return parseInt(saved.ID_PRODUCTORA);
            } catch(e) {}
            // Fuente 3: busint_universal_plant
            try {
                const univ = JSON.parse(localStorage.getItem('busint_universal_plant') || 'null');
                if (univ?.productora) return parseInt(univ.productora);
                if (univ?.ID_PRODUCTORA) return parseInt(univ.ID_PRODUCTORA);
            } catch(e) {}
            return null;
        };

        const payload = {
            hoja: SHEETS_DESTINO.NOVEDADES,
            ...lotData,
            area,
            tipoNovedad,
            tipoDetalle,
            descripcion,
            cantidadSolicitada,
            imagen: '',
            productora: _resolveProductoraId()
        };
        console.log('[NOVEDADES] Productora resuelta para payload:', payload.productora);

        const result = await sendToGAS(payload);
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
        
        // Limpiar inputs de búsqueda principales
        const loteInput = document.getElementById('loteInput');
        const plantaFilterInput = document.getElementById('plantaFilterInput');
        if (loteInput) loteInput.value = '';
        if (plantaFilterInput) {
            plantaFilterInput.value = '';
            if (typeof handlePlantaFilterSearch === 'function') {
                handlePlantaFilterSearch();
            }
        }
        if (typeof showEmptyState === 'function') {
            showEmptyState();
        }

        resetInsumosList();
        resetCorteList();
        resetTelasList();
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
