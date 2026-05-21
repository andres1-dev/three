/* novedad-publica.js - Formulario público de novedades */

// ═══════════════════════════════════════════════════════════════════════════
// PREVENIR CACHÉ - FORZAR DATOS FRESCOS SIEMPRE
// ═══════════════════════════════════════════════════════════════════════════

// Limpiar todo el caché al cargar
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names) caches.delete(name);
    });
}

// Limpiar localStorage y sessionStorage relacionado con novedades
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('novedad') || key.includes('cache') || key.includes('sb_'))) {
        keysToRemove.push(key);
    }
}
keysToRemove.forEach(key => localStorage.removeItem(key));

// Limpiar sessionStorage
sessionStorage.clear();

// ═══════════════════════════════════════════════════════════════════════════

// Nota: Estos valores se usan como fallback, lo ideal es que vengan de CONFIG
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g';
const SUPABASE_URL = 'https://zpikjjcbievfpzegupmw.supabase.co';
const SUPABASE_STORAGE_BUCKET = 'novedades-imagenes';

const INSUMOS_OPCIONES = ['ETIQUETA','PLACA','PLASTIFLECHA','TRAZABILIDAD','ELASTICO','ARGOLLA','TENSOR','FRAMILON','TRANSFER','MARQUILLA','CIERRE','CORDON','HILADILLA','HERRAJE','HEBILLA','ABROCHADURA','APLIQUE','BOTON','GANCHO','PUNTERAS','COPA','ENCAJE','VARILLA','ENTRETELA','VELCRO','OJALES','REMACHES','OTROS'];
const CORTE_OPCIONES = ['PIEZAS', 'SESGO', 'ENTRETELA'];
const TELAS_OPCIONES = ['ROTOS', 'MANCHAS', 'HILOS', 'HIDOS', 'MAREADA', 'TONO', 'SE DESTIÑE', 'SE ROMPE', 'OTROS'];

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

const FormState = {
    currentStep: 1,
    opData: null,
    selectedFile: null,
    isSubmitting: false,
    isSearching: false
};

const ValidationRules = {
    op: { pattern: /^[0-9]+$/, message: 'El número de OP solo debe contener números' },
    descripcion: { minLength: 10, maxLength: 1000, message: 'La descripción debe tener entre 10 y 1000 caracteres' },
    imagen: { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/gif'], message: 'El archivo debe ser una imagen JPG, PNG o GIF menor a 5MB' }
};

let CURVAS_CACHE = {};

document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    attachEventListeners();
});

function initializeForm() {
    updateStepIndicator(1);
    document.getElementById('opSearchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btnBuscarOP').click();
        }
    });
}

function attachEventListeners() {
    const opSearchInput = document.getElementById('opSearchInput');
    if (opSearchInput) {
        opSearchInput.addEventListener('keydown', (e) => {
            if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
                e.preventDefault();
            }
        });
    }

    document.getElementById('btnBuscarOP').addEventListener('click', buscarOP);
    document.getElementById('btnVolverIdentificacion').addEventListener('click', volverIdentificacion);
    
    document.getElementById('area').addEventListener('change', handleAreaChange);
    document.getElementById('tipoNovedad').addEventListener('change', handleTipoNovedadChange);
    document.getElementById('codigosTipoSolicitud').addEventListener('change', handleCodigosTipoChange);
    document.getElementById('descripcion').addEventListener('input', validateDescripcion);
    document.getElementById('imagen').addEventListener('change', handleFileSelect);
    
    // Asignar funciones a botones dinámicos
    document.getElementById('btnAddInsumo').onclick = () => agregarFilaInsumo();
    document.getElementById('btnAddCorte').onclick = () => agregarFilaCorte();
    document.getElementById('btnAddTela').onclick = () => agregarFilaTela();
    document.getElementById('btnAddCodigo').onclick = () => agregarFilaCodigo();
    
    // Validación y actualización automática del correo
    const correoInput = document.getElementById('correoInput');
    if (correoInput) {
        correoInput.addEventListener('input', validateCorreoInput);
        correoInput.addEventListener('blur', actualizarEmailPlanta);
    }
    
    const fileLabel = document.querySelector('.file-upload-label');
    if (fileLabel) {
        fileLabel.addEventListener('dragover', handleDragOver);
        fileLabel.addEventListener('dragleave', handleDragLeave);
        fileLabel.addEventListener('drop', handleFileDrop);
    }
    
    document.getElementById('btnVolverBusqueda').addEventListener('click', volverSeleccionOP);
    document.getElementById('btnConfirmarProducto').addEventListener('click', confirmarProducto);
    document.getElementById('btnVolverConfirmacion').addEventListener('click', volverConfirmacion);
    document.getElementById('btnContinuar').addEventListener('click', continuarAdicional);
    document.getElementById('btnVolverDetalles').addEventListener('click', volverDetalles);
    document.getElementById('btnNuevoReporte').addEventListener('click', iniciarNuevoReporte);
    document.getElementById('novedadForm').addEventListener('submit', handleSubmit);
}

async function buscarOP() {
    if (FormState.isSearching) return;
    
    const opSearchInput = document.getElementById('opSearchInput');
    const op = opSearchInput.value.trim();
    const btn = document.getElementById('btnBuscarOP');
    
    if (!op) {
        showError(opSearchInput, document.getElementById('opError'), 'El número de OP es obligatorio');
        opSearchInput.focus();
        return;
    }
    
    FormState.isSearching = true;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>Buscando...</span>';
    
    try {
        const url = `${CONFIG.FUNCTIONS_URL}/upload-public-image?op=${encodeURIComponent(op)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Error de conexión' }));
            throw new Error(err.message || `Error ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            hideError(opSearchInput, document.getElementById('opError'));
            
            if (result.multiple) {
                // Hay múltiples plantas/productoras asociadas a la OP
                FormState.isMultiple = true;
                document.getElementById('opDisplay').textContent = op;
                renderizarTarjetasOP(result.ops, op);
                
                document.getElementById('seccionBusqueda').classList.add('hidden');
                document.getElementById('seccionSeleccionOP').classList.remove('hidden');
            } else {
                // Solo hay una planta/productora asociada a la OP
                FormState.isMultiple = false;
                FormState.needsEmail = result.needsEmail;
                FormState.plantaName = result.data.planta;
                
                seleccionarOP(result);
            }
        }
    } catch (error) {
        console.error('[buscarOP] 💥 ERROR:', error);
        Swal.fire({ icon: 'error', title: 'OP No Encontrada', text: error.message });
    } finally {
        FormState.isSearching = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search"></i><span>Buscar OP</span>';
    }
}

function renderizarTarjetasOP(ops, opNumber) {
    const container = document.getElementById('opCardsContainer');
    container.innerHTML = '';
    
    if (!ops || ops.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #5f6368; background: #f8f9fa; border-radius: 24px; border: 2px dashed #dadce0;">
                <div style="background: #ffffff; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <i class="fas fa-search-minus" style="font-size: 2rem; color: #1a73e8;"></i>
                </div>
                <h3 style="color: #202124; margin-bottom: 10px; font-weight: 600;">Sin Datos</h3>
                <p style="max-width: 300px; margin: 0 auto;">No encontramos información para la búsqueda #${opNumber}.</p>
            </div>
        `;
        return;
    }
    
    ops.forEach((op, index) => {
        const card = document.createElement('div');
        card.className = 'op-card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        const prodLabel = op.data.nombre_productora 
            ? `<div class="op-card-eyebrow" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: #667eea; font-weight: 900;">
                ${op.data.nombre_productora}
               </div>` 
            : '';
            
        const headerHtml = prodLabel 
            ? `<div class="op-card-header" style="display: flex; align-items: center; width: 100%; margin-bottom: 2px;">
                ${prodLabel}
               </div>`
            : '';
            
        card.innerHTML = `
            ${headerHtml}
            
            <div class="op-card-info" style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; width: 100%;">
                <span class="op-card-info-item" style="font-size: 0.8rem; color: #5f6368; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-cog" style="font-size: 0.75rem; color: #667eea; opacity: 0.85; flex-shrink: 0; width: 14px; text-align: center;"></i>
                    <span style="font-weight: 600; color: #3c4043; text-transform: uppercase;">${op.data.proceso || 'PROCESO'}</span>
                </span>
                <span class="op-card-info-item" style="font-size: 0.8rem; color: #5f6368; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-tag" style="font-size: 0.75rem; color: #667eea; opacity: 0.85; flex-shrink: 0; width: 14px; text-align: center;"></i>
                    <span>${op.data.referencia}</span>
                </span>
                <span class="op-card-info-item" style="font-size: 0.8rem; color: #5f6368; display: flex; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${op.data.prenda || ''}">
                    <i class="fas fa-tshirt" style="font-size: 0.75rem; color: #667eea; opacity: 0.85; flex-shrink: 0; width: 14px; text-align: center;"></i>
                    <span>${op.data.prenda || 'Prenda no especificada'}</span>
                </span>
                <span class="op-card-info-item" style="font-size: 0.8rem; color: #5f6368; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-calculator" style="font-size: 0.75rem; color: #667eea; opacity: 0.85; flex-shrink: 0; width: 14px; text-align: center;"></i>
                    <span>${Number(op.data.cantidad).toLocaleString()}</span>
                </span>
            </div>
            
            <div class="op-card-footer" style="margin-top: auto; border-top: 1px solid #f1f3f4; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px; overflow: hidden;">
                <span class="op-card-planta" style="font-size: 0.82rem; color: #202124; font-weight: 700; line-height: 1.3; text-align: left; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${op.data.planta || ''}">
                    ${op.data.planta || 'SIN PLANTA'}
                </span>
                <i class="fas fa-chevron-right op-card-arrow" style="color: #a0aec0; font-size: 0.9rem; transition: all 0.3s ease; flex-shrink: 0; margin-right: 6px;"></i>
            </div>
        `;
        card.onclick = () => {
            FormState.needsEmail = op.needsEmail;
            FormState.plantaName = op.data.planta;
            seleccionarOP(op);
        };
        container.appendChild(card);
    });
}

function seleccionarOP(op) {
    // op is { data: opData, needsEmail, needsDetails, currentEmail, currentPhone, currentIdPlanta }
    FormState.opData = op.data;
    FormState.needsDetails = op.needsDetails;
    mostrarInformacionProducto(op.data);
    
    // Actualizar nombre de productora en el header
    if (op.data && op.data.nombre_productora) {
        document.getElementById('headerSubtitle').textContent = op.data.nombre_productora.toUpperCase();
    } else {
        document.getElementById('headerSubtitle').textContent = 'GRUPO TDM';
    }
    
    const detallesTallerGroup = document.getElementById('detallesTallerGroup');
    if (FormState.needsDetails) {
        detallesTallerGroup.classList.remove('hidden');
        document.getElementById('nitTallerInput').value = op.currentIdPlanta || '';
        document.getElementById('correoTallerInput').value = op.currentEmail || '';
        document.getElementById('telefonoTallerInput').value = op.currentPhone || '';
        
        // Limpiar errores
        hideError(document.getElementById('nitTallerInput'), document.getElementById('nitTallerError'));
        hideError(document.getElementById('correoTallerInput'), document.getElementById('correoTallerError'));
        hideError(document.getElementById('telefonoTallerInput'), document.getElementById('telefonoTallerError'));
    } else {
        detallesTallerGroup.classList.add('hidden');
    }
    
    document.getElementById('seccionSeleccionOP').classList.add('hidden');
    document.getElementById('seccionBusqueda').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    updateStepIndicator(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverIdentificacion() {
    document.getElementById('headerSubtitle').textContent = 'GRUPO TDM';
    document.getElementById('seccionSeleccionOP').classList.add('hidden');
    document.getElementById('seccionBusqueda').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverSeleccionOP() {
    document.getElementById('headerSubtitle').textContent = 'GRUPO TDM';
    document.getElementById('seccionDetalles').classList.add('hidden');
    if (FormState.isMultiple) {
        document.getElementById('seccionSeleccionOP').classList.remove('hidden');
    } else {
        document.getElementById('seccionBusqueda').classList.remove('hidden');
    }
    updateStepIndicator(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCorreoInput(e) {
    const input = e.target;
    const value = input.value.trim();
    const errorElement = document.getElementById('correoError');
    if (!value) { hideError(input, errorElement); return true; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) { showError(input, errorElement, 'Por favor ingresa un correo válido'); return false; }
    else { hideError(input, errorElement); return true; }
}

async function actualizarEmailPlanta() {
    const correoInput = document.getElementById('correoInput');
    const correo = correoInput.value.trim();
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return;
    if (!FormState.opData || !FormState.opData.planta) return;
    const planta = FormState.opData.planta;
    correoInput.disabled = true;
    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/upload-public-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ _soloActualizarEmail: true, correo: correo, planta: planta })
        });
        if (response.ok) {
            correoInput.classList.add('success');
            const helperText = document.getElementById('correoGroup').querySelector('.helper-text');
            if (helperText) { helperText.textContent = '✓ Email guardado exitosamente'; helperText.style.color = '#1e8e3e'; }
            setTimeout(() => { document.getElementById('correoGroup').classList.add('hidden'); }, 3000);
        }
    } catch (error) { console.error(error); }
    finally { correoInput.disabled = false; }
}

function updateStepIndicator(step) {
    FormState.currentStep = step;
    for (let i = 1; i <= 5; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (!stepElement) continue;
        stepElement.classList.remove('active', 'completed');
        if (i < step) stepElement.classList.add('completed');
        else if (i === step) stepElement.classList.add('active');
    }
}

function validateDescripcion(e) {
    const textarea = e.target;
    const value = textarea.value.trim();
    const errorElement = document.getElementById('descripcionError');
    const area = document.getElementById('area').value;
    const isRequired = (area === 'DISEÑO' || area === 'OTROS');
    
    if (isRequired && value.length === 0) {
        showError(textarea, errorElement, 'La descripción es obligatoria');
        return false;
    }
    if (value.length > 0 && value.length < 10) {
        showError(textarea, errorElement, `Faltan ${10 - value.length} caracteres`);
        return false;
    }
    else if (value.length > ValidationRules.descripcion.maxLength) {
        showError(textarea, errorElement, 'Límite excedido');
        return false;
    }
    else {
        hideError(textarea, errorElement);
        return true;
    }
}

function showError(input, errorElement, message) {
    if (!input || !errorElement) return;
    input.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    const wrapper = input.closest('.input-wrapper');
    if (wrapper) wrapper.classList.add('error');
}

function hideError(input, errorElement) {
    if (!input || !errorElement) return;
    input.classList.remove('error');
    errorElement.classList.remove('show');
    const wrapper = input.closest('.input-wrapper');
    if (wrapper) wrapper.classList.remove('error');
}


function mostrarInformacionProducto(data) {
    document.getElementById('infoPlanta').textContent = data.planta;
    document.getElementById('infoReferencia').textContent = data.referencia;
    // Adaptación para usar OP que devuelve la Edge Function
    document.getElementById('infoOP').textContent = data.OP || data.lote;
    document.getElementById('infoCantidad').textContent = data.cantidad;
    
    const rows = [
        { id: 'infoProceso', rowId: 'infoProcesoRow', value: data.proceso },
        { id: 'infoPrenda', rowId: 'infoPrendaRow', value: data.prenda },
        { id: 'infoGenero', rowId: 'infoGeneroRow', value: data.genero },
        { id: 'infoCuento', rowId: 'infoCuentoRow', value: data.linea || data.cuento },
        { id: 'infoSalida', rowId: 'infoSalidaRow', value: data.salida, isDate: true }
    ];

    rows.forEach(row => {
        const el = document.getElementById(row.id);
        const rowEl = document.getElementById(row.rowId);
        if (row.value) {
            el.innerHTML = row.isDate ? formatearFechaLarga(row.value) : row.value;
            rowEl.style.display = 'flex';
        } else {
            rowEl.style.display = 'none';
        }
    });
}

function formatearFechaLarga(fechaStr) {
    try {
        let fecha;
        if (fechaStr.includes('-')) {
            fecha = new Date(fechaStr + 'T00:00:00');
        } else if (fechaStr.includes('/')) {
            const partes = fechaStr.split('/');
            fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        } else {
            return fechaStr;
        }
        
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const diaSemana = diasSemana[fecha.getDay()];
        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        const año = fecha.getFullYear();
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fecha.setHours(0, 0, 0, 0);
        
        const diasHabiles = calcularDiasHabiles(fecha, hoy);
        let colorClass = '';
        let textoTiempo = '';
        
        if (diasHabiles === 0) {
            textoTiempo = 'hoy';
            colorClass = 'fecha-verde';
        } else if (diasHabiles === 1) {
            textoTiempo = 'hace 1 día hábil';
            colorClass = 'fecha-verde';
        } else if (diasHabiles > 1) {
            textoTiempo = `hace ${diasHabiles} días hábiles`;
            colorClass = diasHabiles > 2 ? 'fecha-rojo' : 'fecha-verde';
        } else {
            const diasFuturos = Math.abs(diasHabiles);
            textoTiempo = diasFuturos === 1 ? 'en 1 día hábil' : `en ${diasFuturos} días hábiles`;
            colorClass = 'fecha-verde';
        }
        
        return `${diaSemana}, ${dia} de ${mes} del ${año} <span class="${colorClass}">(${textoTiempo})</span>`;
    } catch (error) {
        return fechaStr;
    }
}

function calcularDiasHabiles(fechaInicio, fechaFin) {
    let invertido = false;
    if (fechaInicio > fechaFin) {
        [fechaInicio, fechaFin] = [fechaFin, fechaInicio];
        invertido = true;
    }
    let diasHabiles = 0;
    let fechaActual = new Date(fechaInicio);
    while (fechaActual < fechaFin) {
        const diaSemana = fechaActual.getDay();
        if (diaSemana >= 1 && diaSemana <= 5) diasHabiles++;
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    return invertido ? -diasHabiles : diasHabiles;
}

function mostrarSeccionDetalles() {
    document.getElementById('seccionBusqueda').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverBusqueda() {
    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionBusqueda').classList.remove('hidden');
    updateStepIndicator(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function confirmarProducto() {
    // Si la planta requiere completar detalles (NIT, correo, teléfono)
    if (FormState.needsDetails) {
        const nitInput = document.getElementById('nitTallerInput');
        const correoInput = document.getElementById('correoTallerInput');
        const telefonoInput = document.getElementById('telefonoTallerInput');
        
        const nit = nitInput.value.trim();
        const correo = correoInput.value.trim();
        const telefono = telefonoInput.value.trim();
        
        let valid = true;
        
        if (!nit) { showError(nitInput, document.getElementById('nitTallerError'), 'Por favor ingresa la identificación'); valid = false; }
        else { hideError(nitInput, document.getElementById('nitTallerError')); }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!correo || !emailRegex.test(correo)) { showError(correoInput, document.getElementById('correoTallerError'), 'Por favor ingresa un correo válido'); valid = false; }
        else { hideError(correoInput, document.getElementById('correoTallerError')); }
        
        if (!telefono) { showError(telefonoInput, document.getElementById('telefonoTallerError'), 'Por favor ingresa un teléfono de contacto'); valid = false; }
        else { hideError(telefonoInput, document.getElementById('telefonoTallerError')); }
        
        if (!valid) return;
        
        const btn = document.getElementById('btnConfirmarProducto');
        btn.disabled = true;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<div class="spinner"></div><span>Guardando taller...</span>';
        
        try {
            console.log('[CLIENT] Registrando detalles de taller:', nit, FormState.opData.planta);
            const response = await fetch(`${CONFIG.FUNCTIONS_URL}/upload-public-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
                body: JSON.stringify({
                    _soloActualizarPlanta: true,
                    id_planta: nit,
                    planta: FormState.opData.planta,
                    correo: correo,
                    telefono: telefono,
                    productora: FormState.opData.productora
                })
            });
            
            const res = await response.json();
            if (!response.ok || !res.success) {
                throw new Error(res.message || 'Error al actualizar detalles del taller');
            }
            
            // Éxito, el taller ha sido guardado
            FormState.needsDetails = false;
            
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error al Guardar Taller', text: error.message });
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            return;
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionNovedadDetalles').classList.remove('hidden');
    updateStepIndicator(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverConfirmacion() {
    document.getElementById('seccionNovedadDetalles').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    updateStepIndicator(2);
    document.getElementById('area').value = '';
    document.getElementById('tipoNovedad').value = '';
    document.getElementById('tipoNovedadGroup').classList.add('hidden');
    ['tipoInsumoGroup', 'tipoCorteGroup', 'tipoTelasGroup', 'tipoCodigosGroup', 'cantidadNormalGroup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    const cantidadInput = document.getElementById('cantidadNormal');
    if (cantidadInput) {
        cantidadInput.value = '';
        cantidadInput.readOnly = false;
    }
    
    lockFieldsAfter('area');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleAreaChange(e) {
    const area = e.target.value;
    const tipoGroup = document.getElementById('tipoNovedadGroup');
    const cantidadGroup = document.getElementById('cantidadNormalGroup');
    const cantidadInput = document.getElementById('cantidadNormal');
    
    const descBadge = document.getElementById('descripcionBadge');
    if (descBadge) {
        if (area === 'DISEÑO' || area === 'OTROS') {
            descBadge.outerHTML = '<span id="descripcionBadge" class="required-badge" style="background:#fce8e6; color:#d93025; padding: 2px 8px; border-radius: 12px; font-size:0.65rem; font-weight:600; text-transform:uppercase; margin-left: 8px;">Obligatorio</span>';
        } else {
            descBadge.outerHTML = '<span id="descripcionBadge" class="optional-badge">Opcional</span>';
        }
    }
    
    if (cantidadInput) {
        cantidadInput.readOnly = false;
        cantidadInput.value = '';
    }
    
    // Ocultar todo primero
    ['tipoInsumoGroup', 'tipoCorteGroup', 'tipoTelasGroup', 'tipoCodigosGroup', 'cantidadNormalGroup'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    
    if (!area) {
        tipoGroup.classList.add('hidden');
        return;
    }
    
    hideError(e.target, document.getElementById('areaError'));
    
    if (area === 'OTROS' || area === 'DISEÑO') {
        tipoGroup.classList.add('hidden');
        if (area === 'OTROS') {
            cantidadGroup.classList.remove('hidden', 'field-locked');
            cantidadGroup.classList.add('field-reveal');
        } else if (area === 'DISEÑO') {
            cantidadGroup.classList.remove('hidden', 'field-locked');
            cantidadGroup.classList.add('field-reveal');
            if (cantidadInput) {
                cantidadInput.value = FormState.opData ? FormState.opData.cantidad : 0;
                cantidadInput.readOnly = true;
            }
        }
    } else {
        tipoGroup.classList.remove('hidden', 'field-locked');
        tipoGroup.classList.add('field-reveal');
    }
    
    // Mostrar campos específicos
    const specificGroups = {
        'INSUMOS': 'tipoInsumoGroup',
        'CORTE': 'tipoCorteGroup',
        'TELAS': 'tipoTelasGroup',
        'CODIGOS': 'tipoCodigosGroup'
    };
    
    if (specificGroups[area]) {
        const group = document.getElementById(specificGroups[area]);
        group.classList.remove('hidden', 'field-locked');
        group.classList.add('field-reveal');
        
        // Inicializar si está vacío
        const listId = area.toLowerCase() + 'List';
        if (document.getElementById(listId).children.length === 0) {
            if (area === 'INSUMOS') agregarFilaInsumo();
            else if (area === 'CORTE') agregarFilaCorte();
            else if (area === 'TELAS') agregarFilaTela();
            else if (area === 'CODIGOS') handleCodigosTipoChange();
        }
    }
}

function handleTipoNovedadChange(e) {
    if (e.target.value) {
        hideError(e.target, document.getElementById('tipoError'));
    }
}

function lockFieldsAfter(id) {
    // Lógica simplificada para esta versión
}

function agregarFilaInsumo() {
    _crearFilaDinamica(INSUMOS_OPCIONES, 'insumosList', 'eliminarFilaInsumo');
}
function eliminarFilaInsumo(btn) {
    _eliminarFilaDinamica(btn, 'insumosList');
}

function agregarFilaCorte() {
    _crearFilaDinamica(CORTE_OPCIONES, 'corteList', 'eliminarFilaCorte');
}
function eliminarFilaCorte(btn) {
    _eliminarFilaDinamica(btn, 'corteList');
}

function agregarFilaTela() {
    _crearFilaDinamica(TELAS_OPCIONES, 'telasList', 'eliminarFilaTela');
}
function eliminarFilaTela(btn) {
    _eliminarFilaDinamica(btn, 'telasList');
}

function _crearFilaDinamica(opciones, listId, removeFn) {
    const lista = document.getElementById(listId);
    const fila = document.createElement('div');
    fila.className = 'dynamic-item';
    
    const id = Date.now();
    fila.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Tipo <span class="required">*</span></label>
            <div class="input-wrapper custom-dropdown-wrapper">
                <i class="fas fa-tag input-icon"></i>
                <input type="text" class="form-control item-tipo" placeholder="Seleccione..." list="list-${id}">
                <datalist id="list-${id}">
                    ${opciones.map(opt => `<option value="${opt}">`).join('')}
                </datalist>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cantidad <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control item-cantidad" min="1" placeholder="0">
            </div>
        </div>
        <button type="button" class="btn-remove-item" onclick="${removeFn}(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    lista.appendChild(fila);
}

function _eliminarFilaDinamica(btn, listId) {
    const lista = document.getElementById(listId);
    if (lista.children.length > 1) {
        btn.closest('.dynamic-item').remove();
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Debes incluir al menos un elemento en el reporte.',
            confirmButtonColor: '#673ab7'
        });
    }
}

function handleCodigosTipoChange() {
    const tipo = document.getElementById('codigosTipoSolicitud').value;
    const loteGroup = document.getElementById('codigosLoteCompletoGroup');
    const unidadesGroup = document.getElementById('codigosUnidadesGroup');
    
    if (tipo === 'LOTE_COMPLETO') {
        loteGroup.classList.remove('hidden');
        unidadesGroup.classList.add('hidden');
        document.getElementById('codigosCantidadTotal').value = FormState.opData ? FormState.opData.cantidad : 0;
    } else if (tipo === 'UNIDADES') {
        loteGroup.classList.add('hidden');
        unidadesGroup.classList.remove('hidden');
        if (document.getElementById('codigosList').children.length === 0) {
            agregarFilaCodigo();
        }
    }
}

function getFilteredSizes() {
    if (!FormState.opData) return CODIGOS_TALLAS_LIST;
    const prenda = (FormState.opData.prenda || '').toUpperCase();
    const genero = (FormState.opData.genero || '').toUpperCase();
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

function agregarFilaCodigo() {
    const lista = document.getElementById('codigosList');
    const fila = document.createElement('div');
    fila.className = 'dynamic-item three-cols';
    
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    const tallas = getFilteredSizes();
    
    fila.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Talla <span class="required">*</span></label>
            <div class="input-wrapper custom-dropdown-wrapper">
                <i class="fas fa-ruler input-icon"></i>
                <input type="text" class="form-control codigo-talla" placeholder="Talla..." list="tallas-${id}" required autocomplete="off">
                <datalist id="tallas-${id}">
                    ${tallas.map(t => `<option value="${t}">`).join('')}
                </datalist>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Color <span class="required">*</span></label>
            <div class="input-wrapper custom-dropdown-wrapper">
                <i class="fas fa-palette input-icon"></i>
                <input type="text" class="form-control codigo-color" placeholder="Color..." list="colores-${id}" required autocomplete="off">
                <datalist id="colores-${id}">
                    ${CODIGOS_COLORES_LIST.map(c => `<option value="${c}">`).join('')}
                </datalist>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cantidad <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control codigo-cantidad" min="1" placeholder="0" required>
            </div>
        </div>
        <button type="button" class="btn-remove-item" onclick="_eliminarFilaDinamica(this, 'codigosList')">
            <i class="fas fa-times"></i>
        </button>
    `;
    lista.appendChild(fila);
    
    // Validar cantidad máxima si está disponible
    const inputCantidad = fila.querySelector('.codigo-cantidad');
    const maximo = FormState.opData ? FormState.opData.cantidad : 0;
    if (maximo > 0) {
        inputCantidad.max = maximo;
        inputCantidad.placeholder = `Máx: ${maximo}`;
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!ValidationRules.imagen.allowedTypes.includes(file.type) || file.size > ValidationRules.imagen.maxSize) {
        showError(e.target, document.getElementById('imagenError'), ValidationRules.imagen.message);
        e.target.value = '';
        return;
    }
    
    FormState.selectedFile = file;
    const preview = document.getElementById('filePreview');
    preview.innerHTML = `
        <div class="file-preview">
            <div class="file-preview-info">
                <div class="file-preview-icon"><i class="fas fa-image"></i></div>
                <div class="file-preview-name">${file.name}</div>
            </div>
            <button type="button" class="file-preview-remove" id="btnRemoveFile"><i class="fas fa-trash"></i></button>
        </div>
    `;
    preview.classList.remove('hidden');
    document.getElementById('btnRemoveFile').onclick = () => {
        FormState.selectedFile = null;
        preview.classList.add('hidden');
        e.target.value = '';
    };
    hideError(e.target, document.getElementById('imagenError'));
}

async function handleSubmit(e) {
    e.preventDefault();
    if (FormState.isSubmitting) return;
    
    const btn = document.getElementById('btnSubmit');
    FormState.isSubmitting = true;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>Enviando...</span>';
    
    try {
        const area = document.getElementById('area').value;
        const payload = {
            OP: FormState.opData.OP || FormState.opData.lote,
            referencia: FormState.opData.referencia,
            planta: FormState.opData.planta,
            salida: FormState.opData.salida,
            linea: FormState.opData.linea,
            proceso: FormState.opData.proceso,
            prenda: FormState.opData.prenda,
            genero: FormState.opData.genero,
            cantidad: FormState.opData.cantidad,
            productora: FormState.opData.productora,
            area: area,
            tipoNovedad: document.getElementById('tipoNovedad').value,
            descripcion: document.getElementById('descripcion').value,
            cantidadSolicitada: 0,
            tipoDetalle: null
        };
        
        // Validar descripción obligatoria para DISEÑO u OTROS
        const descVal = (payload.descripcion || '').trim();
        if ((area === 'DISEÑO' || area === 'OTROS') && descVal.length < 10) {
            const textarea = document.getElementById('descripcion');
            const errorElement = document.getElementById('descripcionError');
            showError(textarea, errorElement, 'La descripción es obligatoria para Diseño u Otros (mínimo 10 caracteres)');
            textarea.focus();
            throw new Error('La descripción es obligatoria y debe contener al menos 10 caracteres.');
        }
        
        // Recolectar datos según el área
        if (area === 'INSUMOS') {
            const items = document.querySelectorAll('#insumosList .dynamic-item');
            const dataItems = [];
            items.forEach(item => {
                const tipo = item.querySelector('.item-tipo').value;
                const cant = parseInt(item.querySelector('.item-cantidad').value) || 0;
                if (tipo && cant > 0) {
                    dataItems.push({ tipo, cantidad: cant });
                    payload.cantidadSolicitada += cant;
                }
            });
            if (dataItems.length > 0) payload.tipoDetalle = { items: dataItems };
        } else if (area === 'CORTE') {
            const items = document.querySelectorAll('#corteList .dynamic-item');
            const dataItems = [];
            items.forEach(item => {
                const tipo = item.querySelector('.item-tipo').value;
                const cant = parseInt(item.querySelector('.item-cantidad').value) || 0;
                if (tipo && cant > 0) {
                    dataItems.push({ tipo, cantidad: cant });
                    payload.cantidadSolicitada += cant;
                }
            });
            if (dataItems.length > 0) payload.tipoDetalle = { items: dataItems };
        } else if (area === 'TELAS') {
            const items = document.querySelectorAll('#telasList .dynamic-item');
            const dataItems = [];
            items.forEach(item => {
                const tipo = item.querySelector('.item-tipo').value;
                const cant = parseInt(item.querySelector('.item-cantidad').value) || 0;
                if (tipo && cant > 0) {
                    dataItems.push({ tipo, cantidad: cant });
                    payload.cantidadSolicitada += cant;
                }
            });
            if (dataItems.length > 0) payload.tipoDetalle = { items: dataItems };
        } else if (area === 'CODIGOS') {
            const tipoSolicitud = document.getElementById('codigosTipoSolicitud').value;
            if (tipoSolicitud === 'LOTE_COMPLETO') {
                payload.cantidadSolicitada = parseInt(document.getElementById('codigosCantidadTotal').value) || 0;
                payload.tipoDetalle = { tipo_solicitud: 'LOTE_COMPLETO', cantidad_total: payload.cantidadSolicitada };
            } else {
                const items = document.querySelectorAll('#codigosList .dynamic-item');
                const dataItems = [];
                items.forEach(item => {
                    const talla = item.querySelector('.codigo-talla').value.trim();
                    const color = item.querySelector('.codigo-color').value.trim();
                    const cant = parseInt(item.querySelector('.codigo-cantidad').value) || 0;
                    if (talla && color && cant > 0) {
                        dataItems.push({ talla, color, cantidad: cant });
                        payload.cantidadSolicitada += cant;
                    }
                });
                if (dataItems.length > 0) payload.tipoDetalle = { tipo_solicitud: 'UNIDADES', items: dataItems };
            }
        } else if (area === 'DISEÑO') {
            payload.cantidadSolicitada = FormState.opData ? parseInt(FormState.opData.cantidad) || 0 : 0;
        } else {
            payload.cantidadSolicitada = parseInt(document.getElementById('cantidadNormal').value) || 0;
        }

        // Validar que haya cantidad si el área lo requiere
        if (payload.cantidadSolicitada <= 0 && area !== 'DISEÑO') {
            throw new Error('Debes ingresar al menos una unidad o detalle para el reporte');
        }
        
        // Procesar imagen si existe con compresión inteligente (~150KB)
        if (FormState.selectedFile) {
            btn.innerHTML = '<div class="spinner"></div><span>Comprimiendo Imagen...</span>';
            const compressedBlob = await compressImage(FormState.selectedFile);
            btn.innerHTML = '<div class="spinner"></div><span>Enviando...</span>';
            const base64 = await toBase64(compressedBlob);
            payload.imagen = {
                base64: base64,
                fileName: FormState.selectedFile.name.replace(/\.[^.]+$/, '.jpg'),
                mimeType: 'image/jpeg'
            };
        }
        
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/upload-public-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            document.getElementById('novedadIdDisplay').textContent = result.ID_NOVEDAD;
            document.getElementById('seccionAdicional').classList.add('hidden');
            document.getElementById('seccionExito').classList.remove('hidden');
            updateStepIndicator(5);
        } else {
            throw new Error(result.message || 'Error al enviar el reporte');
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
        FormState.isSubmitting = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar Reporte</span>';
    }
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const MAX_W = 1024;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(b => b ? resolve(b) : reject('Error Blob'), 'image/jpeg', 0.7);
            } catch (e) { reject(e); }
        };
        img.onerror = () => reject('Error Carga');
        img.src = url;
    });
}

function iniciarNuevoReporte() {
    window.location.reload();
}

// Drag & Drop
function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('dragover'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('dragover'); }
function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        const input = document.getElementById('imagen');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input });
    }
}
function continuarAdicional() {
    // Validar que se haya seleccionado un área
    const area = document.getElementById('area').value;
    if (!area) {
        showError(document.getElementById('area'), document.getElementById('areaError'), 'Por favor selecciona un área');
        return;
    }

    // Validar tipo de novedad si es visible
    const tipoGroup = document.getElementById('tipoNovedadGroup');
    if (!tipoGroup.classList.contains('hidden')) {
        const tipo = document.getElementById('tipoNovedad').value;
        if (!tipo) {
            showError(document.getElementById('tipoNovedad'), document.getElementById('tipoError'), 'Por favor selecciona un tipo de novedad');
            return;
        }
    }

    // Validar campos dinámicos según el área
    if (area === 'INSUMOS') {
        if (!validarFilasDinamicas('insumosList')) {
            return;
        }
    } else if (area === 'CORTE') {
        if (!validarFilasDinamicas('corteList')) {
            return;
        }
    } else if (area === 'TELAS') {
        if (!validarFilasDinamicas('telasList')) {
            return;
        }
    } else if (area === 'CODIGOS') {
        const tipoSolicitud = document.getElementById('codigosTipoSolicitud');
        if (!tipoSolicitud.value) {
            tipoSolicitud.classList.add('error');
            tipoSolicitud.focus();
            tipoSolicitud.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (tipoSolicitud.value === 'UNIDADES') {
            if (!validarFilasCodigos()) {
                return;
            }
        }
    } else if (area !== 'DISEÑO' && area !== 'TELAS') {
        // Para áreas con cantidad normal (OTROS)
        const cantidadNormal = document.getElementById('cantidadNormal');
        const cantidadGroup = document.getElementById('cantidadNormalGroup');
        if (cantidadNormal && !cantidadGroup.classList.contains('hidden')) {
            const cantidad = cantidadNormal.value;
            if (!cantidad || cantidad <= 0) {
                cantidadNormal.classList.add('error');
                cantidadNormal.focus();
                cantidadNormal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }
    }

    // Mostrar sección adicional
    document.getElementById('seccionNovedadDetalles').classList.add('hidden');
    document.getElementById('seccionAdicional').classList.remove('hidden');
    updateStepIndicator(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validarFilasDinamicas(listId) {
    const filas = document.querySelectorAll(`#${listId} .dynamic-item`);
    let primerError = null;

    filas.forEach(fila => {
        const tipoInput = fila.querySelector('.item-tipo');
        const cantInput = fila.querySelector('.item-cantidad');

        // Validar tipo
        if (!tipoInput.value.trim()) {
            tipoInput.classList.add('error');
            if (!primerError) primerError = tipoInput;
        } else {
            tipoInput.classList.remove('error');
        }

        // Validar cantidad
        if (!cantInput.value || cantInput.value <= 0) {
            cantInput.classList.add('error');
            if (!primerError) primerError = cantInput;
        } else {
            cantInput.classList.remove('error');
        }
    });

    if (primerError) {
        primerError.focus();
        primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    return true;
}

function validarFilasCodigos() {
    const filas = document.querySelectorAll('#codigosList .dynamic-item');
    let primerError = null;

    filas.forEach(fila => {
        const tallaSelect = fila.querySelector('.codigo-talla');
        const colorSelect = fila.querySelector('.codigo-color');
        const cantInput = fila.querySelector('.codigo-cantidad');

        // Validar talla
        if (!tallaSelect.value) {
            tallaSelect.classList.add('error');
            if (!primerError) primerError = tallaSelect;
        } else {
            tallaSelect.classList.remove('error');
        }

        // Validar color
        if (!colorSelect.value) {
            colorSelect.classList.add('error');
            if (!primerError) primerError = colorSelect;
        } else {
            colorSelect.classList.remove('error');
        }

        // Validar cantidad
        if (!cantInput.value || cantInput.value <= 0) {
            cantInput.classList.add('error');
            if (!primerError) primerError = cantInput;
        } else {
            cantInput.classList.remove('error');
        }
    });

    if (primerError) {
        primerError.focus();
        primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    return true;
}
function volverDetalles() {
    document.getElementById('seccionAdicional').classList.add('hidden');
    document.getElementById('seccionNovedadDetalles').classList.remove('hidden');
    updateStepIndicator(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
