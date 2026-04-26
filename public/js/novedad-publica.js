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

console.log('[CACHE] Caché limpiado - Trabajando con datos frescos');

// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THB9v8csluebALg';
const SUPABASE_URL = 'https://doqsurxxxaudnutsydlk.supabase.co';
const SUPABASE_STORAGE_BUCKET = 'novedades-imagenes';

const INSUMOS_OPCIONES = ['ETIQUETA','PLACA','PLASTIFLECHA','TRAZABILIDAD','ELASTICO','ARGOLLA','TENSOR','FRAMILON','TRANSFER','MARQUILLA','CIERRE','CORDON','HILADILLA','HERRAJE','HEBILLA','ABROCHADURA','APLIQUE','BOTON','GANCHO','PUNTERAS','COPA','ENCAJE','VARILLA','ENTRETELA','VELCRO','OJALES','REMACHES'];
const CORTE_OPCIONES = ['PIEZAS', 'SESGO', 'ENTRETELA'];
const TELAS_OPCIONES = ['ROTOS', 'MANCHAS', 'HIDOS', 'MAREADA', 'TONO', 'SE DESTIÑE', 'SE ROMPE'];

const FormState = {
    currentStep: 1,
    opData: null,
    selectedFile: null,
    isSubmitting: false
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
    document.getElementById('opInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btnBuscarOP').click();
        }
    });
}

function attachEventListeners() {
    document.getElementById('btnBuscarOP').addEventListener('click', buscarOP);
    document.getElementById('area').addEventListener('change', handleAreaChange);
    document.getElementById('tipoNovedad').addEventListener('change', handleTipoNovedadChange);
    document.getElementById('opInput').addEventListener('input', validateOPInput);
    document.getElementById('descripcion').addEventListener('input', validateDescripcion);
    document.getElementById('imagen').addEventListener('change', handleFileSelect);
    
    // Validación y actualización automática del correo
    const correoInput = document.getElementById('correoInput');
    if (correoInput) {
        correoInput.addEventListener('input', validateCorreoInput);
        correoInput.addEventListener('blur', actualizarEmailPlanta);
    }
    
    const fileLabel = document.querySelector('.file-upload-label');
    fileLabel.addEventListener('dragover', handleDragOver);
    fileLabel.addEventListener('dragleave', handleDragLeave);
    fileLabel.addEventListener('drop', handleFileDrop);
    
    document.getElementById('btnVolverBusqueda').addEventListener('click', volverBusqueda);
    document.getElementById('btnConfirmarProducto').addEventListener('click', confirmarProducto);
    document.getElementById('btnVolverConfirmacion').addEventListener('click', volverConfirmacion);
    document.getElementById('btnContinuar').addEventListener('click', continuarAdicional);
    document.getElementById('btnVolverDetalles').addEventListener('click', volverDetalles);
    document.getElementById('btnNuevoReporte').addEventListener('click', iniciarNuevoReporte);
    document.getElementById('novedadForm').addEventListener('submit', handleSubmit);
    
    // Inicializar campos bloqueados
    lockFieldsAfter('area');
}

function validateCorreoInput(e) {
    const input = e.target;
    const value = input.value.trim();
    const errorElement = document.getElementById('correoError');
    
    // Si está vacío, es válido (es opcional)
    if (!value) {
        hideError(input, errorElement);
        return true;
    }
    
    // Si tiene contenido, validar formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        showError(input, errorElement, 'Por favor ingresa un correo válido');
        return false;
    } else {
        hideError(input, errorElement);
        return true;
    }
}

async function actualizarEmailPlanta() {
    const correoInput = document.getElementById('correoInput');
    const correo = correoInput.value.trim();
    
    // Si está vacío o no es válido, no hacer nada
    if (!correo) {
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
        return;
    }
    
    // Verificar que tengamos datos de la planta
    if (!FormState.opData || !FormState.opData.planta) {
        console.warn('[actualizarEmailPlanta] No hay datos de planta disponibles');
        return;
    }
    
    const planta = FormState.opData.planta;
    
    console.log('[actualizarEmailPlanta] 📧 Actualizando email para planta:', planta);
    
    // Deshabilitar input mientras se actualiza
    correoInput.disabled = true;
    const originalPlaceholder = correoInput.placeholder;
    correoInput.placeholder = 'Guardando...';
    
    try {
        // Llamar al endpoint para actualizar solo el email
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/upload-public-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                _soloActualizarEmail: true,
                correo: correo,
                planta: planta
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('[actualizarEmailPlanta] ✅ Email actualizado:', result);
            
            // Mostrar feedback visual
            correoInput.classList.add('success');
            correoInput.placeholder = '✓ Email guardado';
            
            // Mostrar mensaje de éxito
            const correoGroup = document.getElementById('correoGroup');
            const helperText = correoGroup.querySelector('.helper-text');
            if (helperText) {
                helperText.textContent = '✓ Email guardado exitosamente. Recibirás notificaciones en este correo.';
                helperText.style.color = '#1e8e3e';
            }
            
            // Ocultar el campo después de 3 segundos
            setTimeout(() => {
                correoGroup.style.transition = 'opacity 0.5s ease, max-height 0.5s ease';
                correoGroup.style.opacity = '0';
                correoGroup.style.maxHeight = '0';
                correoGroup.style.overflow = 'hidden';
                setTimeout(() => {
                    correoGroup.classList.add('hidden');
                    correoGroup.style.opacity = '1';
                    correoGroup.style.maxHeight = '';
                    correoGroup.style.overflow = '';
                }, 500);
            }, 3000);
            
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            console.error('[actualizarEmailPlanta] ❌ Error:', errorData);
            correoInput.placeholder = 'Error al guardar';
            showError(correoInput, document.getElementById('correoError'), errorData.message || 'Error al guardar el email');
        }
        
    } catch (error) {
        console.error('[actualizarEmailPlanta] 💥 Error:', error);
        correoInput.placeholder = 'Error al guardar';
        showError(correoInput, document.getElementById('correoError'), 'Error de conexión al guardar el email');
    } finally {
        setTimeout(() => {
            correoInput.disabled = false;
            if (correoInput.placeholder === 'Guardando...' || correoInput.placeholder === 'Error al guardar') {
                correoInput.placeholder = originalPlaceholder;
            }
        }, 1500);
    }
}

function updateStepIndicator(step) {
    FormState.currentStep = step;
    for (let i = 1; i <= 5; i++) {
        const stepElement = document.getElementById(`step${i}`);
        stepElement.classList.remove('active', 'completed');
        if (i < step) stepElement.classList.add('completed');
        else if (i === step) stepElement.classList.add('active');
    }
}

function validateOPInput(e) {
    const input = e.target;
    const value = input.value.trim();
    const errorElement = document.getElementById('opError');
    input.value = value.replace(/[^0-9]/g, '');
    if (value && !ValidationRules.op.pattern.test(value)) {
        showError(input, errorElement, ValidationRules.op.message);
        return false;
    } else {
        hideError(input, errorElement);
        return true;
    }
}

function validateDescripcion(e) {
    const textarea = e.target;
    const value = textarea.value.trim();
    const errorElement = document.getElementById('descripcionError');
    
    // Solo validar si hay contenido
    if (value.length > 0 && value.length < 10) {
        showError(textarea, errorElement, `Faltan ${10 - value.length} caracteres`);
        return false;
    } else if (value.length > ValidationRules.descripcion.maxLength) {
        showError(textarea, errorElement, 'Has excedido el límite de caracteres');
        return false;
    } else {
        hideError(textarea, errorElement);
        return true;
    }
}

function showError(input, errorElement, message) {
    input.classList.add('error');
    input.classList.remove('success');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    
    // Si es un select, actualizar también el wrapper
    if (input.tagName === 'SELECT') {
        const wrapper = input.closest('.input-wrapper');
        if (wrapper) {
            wrapper.classList.add('error');
            wrapper.classList.remove('success');
        }
    }
}

function hideError(input, errorElement) {
    input.classList.remove('error');
    input.classList.add('success');
    errorElement.classList.remove('show');
    
    // Si es un select, actualizar también el wrapper
    if (input.tagName === 'SELECT') {
        const wrapper = input.closest('.input-wrapper');
        if (wrapper) {
            wrapper.classList.remove('error');
            wrapper.classList.add('success');
        }
    }
}

async function buscarOP() {
    const opInput = document.getElementById('opInput');
    const op = opInput.value.trim();
    const btnBuscar = document.getElementById('btnBuscarOP');
    
    if (!op) {
        showError(opInput, document.getElementById('opError'), 'El número de OP es obligatorio para continuar con el reporte');
        opInput.focus();
        return;
    }
    
    if (!ValidationRules.op.pattern.test(op)) {
        showError(opInput, document.getElementById('opError'), ValidationRules.op.message);
        opInput.focus();
        return;
    }
    
    btnBuscar.disabled = true;
    btnBuscar.innerHTML = '<div class="spinner"></div><span>Buscando...</span>';
    
    try {
        const url = `${CONFIG.FUNCTIONS_URL}/upload-public-image?op=${encodeURIComponent(op)}`;
        console.log('[buscarOP] 🔍 URL completa:', url);
        console.log('[buscarOP] 🔑 SUPABASE_KEY presente:', !!SUPABASE_KEY);
        console.log('[buscarOP] 📡 Iniciando petición GET...');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('[buscarOP] 📥 Respuesta recibida:');
        console.log('  - Status:', response.status);
        console.log('  - StatusText:', response.statusText);
        console.log('  - OK:', response.ok);
        console.log('  - Headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[buscarOP] ❌ Error en respuesta:', errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('[buscarOP] ✅ Datos parseados:', result);
        
        if (result.success && result.found && result.data) {
            FormState.opData = result.data;
            console.log('[buscarOP] 🎉 OP encontrada mediante Edge Function:', FormState.opData);
            mostrarInformacionProducto(FormState.opData);
            
            // Mostrar campo de correo si la planta no tiene email
            const correoGroup = document.getElementById('correoGroup');
            if (result.needsEmail) {
                console.log('[buscarOP] 📧 La planta necesita email');
                correoGroup.classList.remove('hidden');
            } else {
                console.log('[buscarOP] ✅ La planta ya tiene email:', result.currentEmail);
                correoGroup.classList.add('hidden');
            }
            
            mostrarSeccionDetalles();
            updateStepIndicator(2);
            hideError(opInput, document.getElementById('opError'));
        } else {
            console.warn('[buscarOP] ⚠️ OP no encontrada:', result);
            showError(opInput, document.getElementById('opError'), result.message || `No se encontró información para la OP: ${op}`);
        }
    } catch (error) {
        console.error('[buscarOP] 💥 ERROR COMPLETO:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        Swal.fire({
            icon: 'error',
            title: 'Error al buscar OP',
            html: `<strong>Error:</strong> ${error.message}<br><br>Revisa la consola para más detalles.`,
            confirmButtonColor: '#673ab7'
        });
    } finally {
        btnBuscar.disabled = false;
        btnBuscar.innerHTML = '<i class="fas fa-search"></i><span>Buscar OP</span>';
    }
}

function mostrarInformacionProducto(data) {
    document.getElementById('infoPlanta').textContent = data.planta;
    document.getElementById('infoReferencia').textContent = data.referencia;
    document.getElementById('infoOP').textContent = data.lote;
    document.getElementById('infoCantidad').textContent = data.cantidad;
    
    // Mostrar campos adicionales solo si tienen datos
    if (data.proceso) {
        document.getElementById('infoProceso').textContent = data.proceso;
        document.getElementById('infoProcesoRow').style.display = 'flex';
    } else {
        document.getElementById('infoProcesoRow').style.display = 'none';
    }
    
    if (data.prenda) {
        document.getElementById('infoPrenda').textContent = data.prenda;
        document.getElementById('infoPrendaRow').style.display = 'flex';
    } else {
        document.getElementById('infoPrendaRow').style.display = 'none';
    }
    
    if (data.tejido) {
        document.getElementById('infoTejido').textContent = data.tejido;
        document.getElementById('infoTejidoRow').style.display = 'flex';
    } else {
        document.getElementById('infoTejidoRow').style.display = 'none';
    }
    
    if (data.genero) {
        document.getElementById('infoGenero').textContent = data.genero;
        document.getElementById('infoGeneroRow').style.display = 'flex';
    } else {
        document.getElementById('infoGeneroRow').style.display = 'none';
    }
    
    if (data.cuento) {
        document.getElementById('infoCuento').textContent = data.cuento;
        document.getElementById('infoCuentoRow').style.display = 'flex';
    } else {
        document.getElementById('infoCuentoRow').style.display = 'none';
    }
    
    if (data.salida) {
        // Formatear fecha: "Viernes, 24 de Abril del 2026 (hace 8 días hábiles)"
        const fechaFormateada = formatearFechaLarga(data.salida);
        document.getElementById('infoSalida').innerHTML = fechaFormateada;
        document.getElementById('infoSalidaRow').style.display = 'flex';
    } else {
        document.getElementById('infoSalidaRow').style.display = 'none';
    }
}

function formatearFechaLarga(fechaStr) {
    try {
        // Parsear la fecha (puede venir en formato YYYY-MM-DD o DD/MM/YYYY)
        let fecha;
        if (fechaStr.includes('-')) {
            // Formato YYYY-MM-DD
            fecha = new Date(fechaStr + 'T00:00:00');
        } else if (fechaStr.includes('/')) {
            // Formato DD/MM/YYYY
            const partes = fechaStr.split('/');
            fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        } else {
            return fechaStr; // Retornar original si no se puede parsear
        }
        
        // Nombres en español
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const diaSemana = diasSemana[fecha.getDay()];
        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        const año = fecha.getFullYear();
        
        // Calcular días hábiles desde la fecha hasta hoy
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fecha.setHours(0, 0, 0, 0);
        
        const diasHabiles = calcularDiasHabiles(fecha, hoy);
        
        // Determinar color según días hábiles
        let colorClass = '';
        let textoTiempo = '';
        
        if (diasHabiles === 0) {
            textoTiempo = 'hoy';
            colorClass = 'fecha-verde';
        } else if (diasHabiles === 1) {
            textoTiempo = 'hace 1 día hábil';
            colorClass = 'fecha-verde';
        } else if (diasHabiles === 2) {
            textoTiempo = 'hace 2 días hábiles';
            colorClass = 'fecha-verde';
        } else if (diasHabiles > 2) {
            textoTiempo = `hace ${diasHabiles} días hábiles`;
            colorClass = 'fecha-rojo';
        } else {
            // Fecha futura
            const diasFuturos = Math.abs(diasHabiles);
            if (diasFuturos === 1) {
                textoTiempo = 'en 1 día hábil';
            } else {
                textoTiempo = `en ${diasFuturos} días hábiles`;
            }
            colorClass = 'fecha-verde';
        }
        
        return `${diaSemana}, ${dia} de ${mes} del ${año} <span class="${colorClass}">(${textoTiempo})</span>`;
    } catch (error) {
        console.error('[formatearFechaLarga] Error al formatear fecha:', error);
        return fechaStr; // Retornar original en caso de error
    }
}

function calcularDiasHabiles(fechaInicio, fechaFin) {
    // Si fechaInicio es después de fechaFin, invertir y retornar negativo
    let invertido = false;
    if (fechaInicio > fechaFin) {
        [fechaInicio, fechaFin] = [fechaFin, fechaInicio];
        invertido = true;
    }
    
    let diasHabiles = 0;
    let fechaActual = new Date(fechaInicio);
    
    while (fechaActual < fechaFin) {
        const diaSemana = fechaActual.getDay();
        // Contar solo de lunes (1) a viernes (5)
        if (diaSemana >= 1 && diaSemana <= 5) {
            diasHabiles++;
        }
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

function confirmarProducto() {
    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionNovedadDetalles').classList.remove('hidden');
    updateStepIndicator(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverConfirmacion() {
    document.getElementById('seccionNovedadDetalles').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    updateStepIndicator(2);
    
    // Resetear campos de novedad
    document.getElementById('area').value = '';
    document.getElementById('tipoNovedad').value = '';
    document.getElementById('tipoNovedadGroup').classList.add('hidden');
    
    // Ocultar todos los grupos de detalles
    const groups = [
        'tipoInsumoGroup', 'tipoCorteGroup', 'tipoTelasGroup', 
        'tipoCodigosGroup', 'cantidadNormalGroup'
    ];
    groups.forEach(groupId => {
        const group = document.getElementById(groupId);
        if (group) {
            group.classList.add('hidden');
            group.classList.remove('field-locked', 'field-reveal');
        }
    });
    
    // Reiniciar bloqueo de campos
    lockFieldsAfter('area');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
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


// CAMPOS DINÁMICOS
function _crearFilaDinamica(opciones, listId, removeFn) {
    console.log('[_crearFilaDinamica] Creando fila para:', listId);
    const lista = document.getElementById(listId);
    console.log('[_crearFilaDinamica] Lista encontrada:', !!lista);
    
    if (!lista) {
        console.error('[_crearFilaDinamica] ERROR: No se encontró el elemento con ID:', listId);
        return null;
    }
    
    const fila = document.createElement('div');
    fila.className = 'dynamic-item';
    
    let labelTipo = 'Tipo';
    let iconoTipo = 'fa-tag';
    let placeholder = 'Escribe o selecciona...';
    let suggestionId = `suggestions-${listId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (listId.includes('corte')) {
        labelTipo = 'Tipo de Corte';
        iconoTipo = 'fa-cut';
        placeholder = 'Escribe o selecciona tipo de corte...';
    } else if (listId.includes('tela')) {
        labelTipo = 'Tipo de Imperfección';
        iconoTipo = 'fa-scroll';
        placeholder = 'Escribe o selecciona imperfección...';
    } else if (listId.includes('insumo')) {
        labelTipo = 'Tipo de Insumo';
        iconoTipo = 'fa-boxes';
        placeholder = 'Escribe o selecciona insumo...';
    }
    
    console.log('[_crearFilaDinamica] Label tipo:', labelTipo);
    
    fila.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">${labelTipo} <span class="required">*</span></label>
            <div class="input-wrapper custom-dropdown-wrapper" style="position: relative;">
                <i class="fas ${iconoTipo} input-icon"></i>
                <input 
                    type="text" 
                    class="form-control item-tipo" 
                    placeholder="${placeholder}"
                    autocomplete="off"
                    required
                >
                <ul class="custom-dropdown-suggestions" id="${suggestionId}" style="display: none;"></ul>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cantidad <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control item-cantidad" min="1" placeholder="Cantidad" required>
            </div>
        </div>
        <button type="button" class="btn-remove-item" onclick="${removeFn}(this)" title="Eliminar">
            <i class="fas fa-times"></i>
        </button>
    `;
    lista.appendChild(fila);
    console.log('[_crearFilaDinamica] Fila agregada. Total de filas:', lista.children.length);
    _actualizarBotonesEliminar(listId);
    
    // Configurar dropdown personalizado
    const inputTipo = fila.querySelector('.item-tipo');
    const inputCantidad = fila.querySelector('.item-cantidad');
    const suggestionsList = fila.querySelector(`#${suggestionId}`);
    const wrapperDiv = fila.querySelector('.custom-dropdown-wrapper');
    
    // Función para filtrar y mostrar sugerencias
    function filterSuggestions() {
        const query = inputTipo.value.toLowerCase().trim();
        
        if (!query) {
            suggestionsList.style.display = 'none';
            return;
        }
        
        const filtered = opciones.filter(opt => 
            opt.toLowerCase().includes(query)
        );
        
        if (filtered.length > 0) {
            suggestionsList.innerHTML = filtered.map(opt => {
                const displayText = opt.charAt(0) + opt.slice(1).toLowerCase();
                return `<li data-value="${opt}">${displayText}</li>`;
            }).join('');
            suggestionsList.style.display = 'block';
            suggestionsList.style.zIndex = '1002';
        } else {
            suggestionsList.innerHTML = '<li style="color: #94a3b8; cursor: default; pointer-events: none;">No se encontraron opciones</li>';
            suggestionsList.style.display = 'block';
            suggestionsList.style.zIndex = '1002';
        }
    }
    
    // Evento input para filtrar
    inputTipo.addEventListener('input', function() {
        filterSuggestions();
        
        // Validación en tiempo real
        if (this.value.trim()) {
            this.classList.remove('error');
            this.classList.add('success');
        } else {
            this.classList.remove('success');
        }
    });
    
    // Evento focus para mostrar todas las opciones
    inputTipo.addEventListener('focus', function() {
        if (!this.value.trim()) {
            suggestionsList.innerHTML = opciones.map(opt => {
                const displayText = opt.charAt(0) + opt.slice(1).toLowerCase();
                return `<li data-value="${opt}">${displayText}</li>`;
            }).join('');
            suggestionsList.style.display = 'block';
            suggestionsList.style.zIndex = '1002';
        } else {
            filterSuggestions();
        }
    });
    
    // Evento click en sugerencias
    suggestionsList.addEventListener('click', function(e) {
        if (e.target.tagName === 'LI' && e.target.dataset.value) {
            const value = e.target.dataset.value;
            const displayText = value.charAt(0) + value.slice(1).toLowerCase();
            inputTipo.value = displayText;
            suggestionsList.style.display = 'none';
            inputTipo.classList.remove('error');
            inputTipo.classList.add('success');
            inputCantidad.focus();
        }
    });
    
    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!fila.contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });
    
    // Validación en tiempo real para cantidad
    inputCantidad.addEventListener('input', function() {
        if (this.value && this.value > 0) {
            this.classList.remove('error');
            this.classList.add('success');
        } else {
            this.classList.remove('success');
        }
    });
    
    return fila;
}

function _actualizarBotonesEliminar(listId) {
    const lista = document.getElementById(listId);
    const filas = lista.querySelectorAll('.dynamic-item');
    const hayMultiples = filas.length > 1;
    filas.forEach(fila => {
        const btn = fila.querySelector('.btn-remove-item');
        btn.style.display = hayMultiples ? 'flex' : 'none';
    });
}

function agregarFilaInsumo() { 
    console.log('[agregarFilaInsumo] Llamada a agregar fila de insumo');
    _crearFilaDinamica(INSUMOS_OPCIONES, 'insumosList', 'eliminarFilaInsumo'); 
}
function eliminarFilaInsumo(btn) {
    console.log('[eliminarFilaInsumo] Llamada a eliminar fila');
    const lista = document.getElementById('insumosList');
    if (lista.children.length <= 1) return;
    btn.closest('.dynamic-item').remove();
    _actualizarBotonesEliminar('insumosList');
}

function agregarFilaCorte() { 
    console.log('[agregarFilaCorte] Llamada a agregar fila de corte');
    _crearFilaDinamica(CORTE_OPCIONES, 'corteList', 'eliminarFilaCorte'); 
}
function eliminarFilaCorte(btn) {
    console.log('[eliminarFilaCorte] Llamada a eliminar fila');
    const lista = document.getElementById('corteList');
    if (lista.children.length <= 1) return;
    btn.closest('.dynamic-item').remove();
    _actualizarBotonesEliminar('corteList');
}

function agregarFilaTela() { 
    console.log('[agregarFilaTela] Llamada a agregar fila de tela');
    _crearFilaDinamica(TELAS_OPCIONES, 'telasList', 'eliminarFilaTela'); 
}
function eliminarFilaTela(btn) {
    console.log('[eliminarFilaTela] Llamada a eliminar fila');
    const lista = document.getElementById('telasList');
    if (lista.children.length <= 1) return;
    btn.closest('.dynamic-item').remove();
    _actualizarBotonesEliminar('telasList');
}

function handleAreaChange(e) {
    const area = e.target.value;
    console.log('[handleAreaChange] ===== INICIO =====');
    console.log('[handleAreaChange] Área seleccionada:', area);
    
    const tipoGroup = document.getElementById('tipoNovedadGroup');
    const tipoSelect = document.getElementById('tipoNovedad');
    
    console.log('[handleAreaChange] tipoGroup encontrado:', !!tipoGroup);
    console.log('[handleAreaChange] tipoSelect encontrado:', !!tipoSelect);
    
    if (!tipoGroup) {
        console.error('[handleAreaChange] ERROR: No se encontró tipoNovedadGroup');
        return;
    }
    
    // Ocultar todos los grupos
    const insumoGroup = document.getElementById('tipoInsumoGroup');
    const corteGroup = document.getElementById('tipoCorteGroup');
    const telasGroup = document.getElementById('tipoTelasGroup');
    const codigosGroup = document.getElementById('tipoCodigosGroup');
    const cantidadGroup = document.getElementById('cantidadNormalGroup');
    
    console.log('[handleAreaChange] Grupos encontrados:');
    console.log('  - insumoGroup:', !!insumoGroup);
    console.log('  - corteGroup:', !!corteGroup);
    console.log('  - telasGroup:', !!telasGroup);
    console.log('  - codigosGroup:', !!codigosGroup);
    console.log('  - cantidadGroup:', !!cantidadGroup);
    
    if (insumoGroup) insumoGroup.classList.add('hidden');
    if (corteGroup) corteGroup.classList.add('hidden');
    if (telasGroup) telasGroup.classList.add('hidden');
    if (codigosGroup) codigosGroup.classList.add('hidden');
    if (cantidadGroup) cantidadGroup.classList.add('hidden');
    
    if (area === 'DISEÑO') {
        console.log('[handleAreaChange] Procesando área DISEÑO');
        tipoGroup.classList.add('hidden');
        tipoSelect.required = false;
        unlockAllFields(); // Diseño no tiene más campos
        
    } else if (area === 'TELAS') {
        console.log('[handleAreaChange] Procesando área TELAS');
        revealField(tipoGroup);
        tipoSelect.value = 'IMPERFECTO';
        tipoSelect.required = true;
        tipoSelect.disabled = true;
        if (telasGroup) {
            console.log('[handleAreaChange] Mostrando grupo de telas');
            revealField(telasGroup);
            const telasList = document.getElementById('telasList');
            console.log('[handleAreaChange] telasList encontrado:', !!telasList);
            console.log('[handleAreaChange] telasList.children.length:', telasList?.children.length);
            if (telasList && telasList.children.length === 0) {
                console.log('[handleAreaChange] Agregando primera fila de tela');
                agregarFilaTela();
            }
        }
        unlockAllFields(); // Telas ya mostró todos sus campos
        
    } else if (area === 'INSUMOS') {
        console.log('[handleAreaChange] Procesando área INSUMOS');
        revealField(tipoGroup);
        tipoSelect.required = true;
        tipoSelect.disabled = false;
        tipoSelect.value = ''; // Resetear para que el usuario elija
        lockFieldsAfter('tipoNovedad'); // Bloquear campos siguientes hasta que elija tipo
        
    } else if (area === 'CORTE') {
        console.log('[handleAreaChange] Procesando área CORTE');
        revealField(tipoGroup);
        tipoSelect.required = true;
        tipoSelect.disabled = false;
        tipoSelect.value = ''; // Resetear para que el usuario elija
        lockFieldsAfter('tipoNovedad'); // Bloquear campos siguientes hasta que elija tipo
        
    } else if (area === 'CODIGOS') {
        console.log('[handleAreaChange] Procesando área CODIGOS');
        revealField(tipoGroup);
        tipoSelect.required = true;
        tipoSelect.disabled = false;
        tipoSelect.value = ''; // Resetear para que el usuario elija
        lockFieldsAfter('tipoNovedad'); // Bloquear campos siguientes hasta que elija tipo
        
    } else if (area !== '') {
        console.log('[handleAreaChange] Procesando área OTROS:', area);
        revealField(tipoGroup);
        tipoSelect.required = true;
        tipoSelect.disabled = false;
        tipoSelect.value = ''; // Resetear para que el usuario elija
        lockFieldsAfter('tipoNovedad'); // Bloquear campos siguientes hasta que elija tipo
    }
    
    if (area) hideError(e.target, document.getElementById('areaError'));
    console.log('[handleAreaChange] ===== FIN =====');
}

function handleTipoNovedadChange(e) {
    const area = document.getElementById('area').value;
    const tipo = e.target.value;
    
    console.log('[handleTipoNovedadChange] Área:', area, 'Tipo:', tipo);
    
    if (!tipo) return;
    
    const insumoGroup = document.getElementById('tipoInsumoGroup');
    const corteGroup = document.getElementById('tipoCorteGroup');
    const codigosGroup = document.getElementById('tipoCodigosGroup');
    const cantidadGroup = document.getElementById('cantidadNormalGroup');
    
    // Mostrar el grupo correspondiente según el área
    if (area === 'INSUMOS' && insumoGroup) {
        console.log('[handleTipoNovedadChange] Mostrando grupo de insumos');
        revealField(insumoGroup);
        const insumosList = document.getElementById('insumosList');
        if (insumosList && insumosList.children.length === 0) {
            agregarFilaInsumo();
        }
        unlockAllFields();
        
    } else if (area === 'CORTE' && corteGroup) {
        console.log('[handleTipoNovedadChange] Mostrando grupo de corte');
        revealField(corteGroup);
        const corteList = document.getElementById('corteList');
        if (corteList && corteList.children.length === 0) {
            agregarFilaCorte();
        }
        unlockAllFields();
        
    } else if (area === 'CODIGOS' && codigosGroup) {
        console.log('[handleTipoNovedadChange] Mostrando grupo de códigos');
        revealField(codigosGroup);
        cargarCurvaParaCodigos();
        unlockAllFields();
        
    } else if (cantidadGroup) {
        console.log('[handleTipoNovedadChange] Mostrando campo de cantidad normal');
        revealField(cantidadGroup);
        unlockAllFields();
    }
    
    hideError(e.target, document.getElementById('tipoError'));
}

// Funciones auxiliares para revelación progresiva
function revealField(element) {
    if (!element) return;
    element.classList.remove('hidden', 'field-locked');
    element.classList.add('field-reveal');
    setTimeout(() => {
        element.classList.remove('field-reveal');
    }, 400);
}

function lockFieldsAfter(fieldId) {
    // Esta función bloquea visualmente los campos que vienen después del especificado
    const fieldOrder = ['area', 'tipoNovedad', 'detalles'];
    const currentIndex = fieldOrder.indexOf(fieldId);
    
    if (currentIndex === -1) return;
    
    // Bloquear campos posteriores
    for (let i = currentIndex + 1; i < fieldOrder.length; i++) {
        const field = fieldOrder[i];
        if (field === 'detalles') {
            // Bloquear todos los grupos de detalles
            const groups = [
                'tipoInsumoGroup', 'tipoCorteGroup', 'tipoTelasGroup', 
                'tipoCodigosGroup', 'cantidadNormalGroup'
            ];
            groups.forEach(groupId => {
                const group = document.getElementById(groupId);
                if (group && !group.classList.contains('hidden')) {
                    group.classList.add('field-locked');
                }
            });
        }
    }
}

function unlockAllFields() {
    // Desbloquear todos los campos
    const allGroups = document.querySelectorAll('.form-group.field-locked');
    allGroups.forEach(group => {
        group.classList.remove('field-locked');
    });
}

async function cargarCurvaParaCodigos() {
    const op = FormState.opData?.lote;
    if (!op) {
        Swal.fire({ title: 'Error', text: 'No se encontró la OP del producto.', icon: 'error', confirmButtonColor: '#673ab7' });
        return;
    }
    try {
        if (CURVAS_CACHE[op]) {
            poblarCodigosDesdeDetalles(CURVAS_CACHE[op].detalles);
            return;
        }
        const url = `${CONFIG.FUNCTIONS_URL}/query?table=CURVA&eq_op=${encodeURIComponent(op)}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY } });
        if (!response.ok) throw new Error('Error al cargar curva');
        const data = await response.json();
        const records = (data && data.data) ? data.data : data;
        const curva = Array.isArray(records) ? records[0] : records;
        if (!curva || !curva.detalles || curva.detalles.length === 0) {
            Swal.fire({ title: 'Sin curva', html: `No se encontró curva para la OP: <strong>${op}</strong>`, icon: 'warning', confirmButtonColor: '#673ab7' });
            return;
        }
        CURVAS_CACHE[op] = curva;
        poblarCodigosDesdeDetalles(curva.detalles);
    } catch (error) {
        console.error('[códigos] Error:', error);
        Swal.fire({ title: 'Error', text: 'No se pudo cargar la curva. Intente nuevamente.', icon: 'error', confirmButtonColor: '#673ab7' });
    }
}

function poblarCodigosDesdeDetalles(detalles) {
    const lista = document.getElementById('codigosList');
    lista.innerHTML = '';
    const tallasUnicas = [...new Set(detalles.map(d => d[3]))].sort();
    const coloresUnicos = [...new Set(detalles.map(d => d[1]))].sort();
    const cantidadTotal = detalles.reduce((sum, d) => sum + Number(d[4]), 0);
    window.CODIGOS_TALLAS = tallasUnicas;
    window.CODIGOS_COLORES = coloresUnicos;
    window.CODIGOS_DETALLES = detalles;
    window.CODIGOS_CANTIDAD_TOTAL = cantidadTotal;
    document.getElementById('codigosCantidadTotal').value = cantidadTotal;
    agregarFilaCodigo();
}

function handleCodigosTipoChange() {
    const tipo = document.getElementById('codigosTipoSolicitud').value;
    const loteCompletoGroup = document.getElementById('codigosLoteCompletoGroup');
    const unidadesGroup = document.getElementById('codigosUnidadesGroup');
    if (tipo === 'LOTE_COMPLETO') {
        loteCompletoGroup.classList.remove('hidden');
        unidadesGroup.classList.add('hidden');
    } else if (tipo === 'UNIDADES') {
        loteCompletoGroup.classList.add('hidden');
        unidadesGroup.classList.remove('hidden');
    } else {
        loteCompletoGroup.classList.add('hidden');
        unidadesGroup.classList.add('hidden');
    }
}

function agregarFilaCodigo() {
    const lista = document.getElementById('codigosList');
    const fila = document.createElement('div');
    fila.className = 'dynamic-item';
    const tallasOpts = (window.CODIGOS_TALLAS || []).map(t => `<option value="${t}">${t}</option>`).join('');
    const coloresOpts = (window.CODIGOS_COLORES || []).map(c => `<option value="${c}">${c}</option>`).join('');
    fila.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Talla <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-ruler input-icon"></i>
                <select class="form-control codigo-talla" onchange="actualizarMaximoCodigo(this)" required>
                    <option value="" disabled selected>Seleccione...</option>${tallasOpts}
                </select>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Color <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-palette input-icon"></i>
                <select class="form-control codigo-color" onchange="actualizarMaximoCodigo(this)" required>
                    <option value="" disabled selected>Seleccione...</option>${coloresOpts}
                </select>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cantidad <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control codigo-cantidad" min="1" placeholder="Máx: -" required>
            </div>
        </div>
        <button type="button" class="btn-remove-item" onclick="eliminarFilaCodigo(this)" title="Eliminar">
            <i class="fas fa-times"></i>
        </button>
    `;
    lista.appendChild(fila);
    _actualizarBotonesEliminar('codigosList');
    
    // Agregar validación en tiempo real
    const selectTalla = fila.querySelector('.codigo-talla');
    const selectColor = fila.querySelector('.codigo-color');
    const inputCantidad = fila.querySelector('.codigo-cantidad');
    
    selectTalla.addEventListener('change', function() {
        if (this.value) {
            this.classList.remove('error');
            this.classList.add('success');
        }
    });
    
    selectColor.addEventListener('change', function() {
        if (this.value) {
            this.classList.remove('error');
            this.classList.add('success');
        }
    });
    
    inputCantidad.addEventListener('input', function() {
        if (this.value && this.value > 0) {
            this.classList.remove('error');
            this.classList.add('success');
        } else {
            this.classList.remove('success');
        }
    });
}

function actualizarMaximoCodigo(selectElement) {
    const fila = selectElement.closest('.dynamic-item');
    const tallaSelect = fila.querySelector('.codigo-talla');
    const colorSelect = fila.querySelector('.codigo-color');
    const talla = tallaSelect.value;
    const color = colorSelect.value;
    const inputCantidad = fila.querySelector('.codigo-cantidad');
    
    // Validación en tiempo real al cambiar
    if (talla) {
        tallaSelect.classList.remove('error');
        tallaSelect.classList.add('success');
    }
    if (color) {
        colorSelect.classList.remove('error');
        colorSelect.classList.add('success');
    }
    
    if (!talla || !color) {
        inputCantidad.placeholder = 'Máx: -';
        inputCantidad.max = '';
        return;
    }
    const detalle = (window.CODIGOS_DETALLES || []).find(d => d[3] === talla && d[1] === color);
    if (detalle) {
        const maximo = detalle[4];
        inputCantidad.max = maximo;
        inputCantidad.placeholder = `Máx: ${maximo}`;
    } else {
        inputCantidad.placeholder = 'Máx: -';
        inputCantidad.max = '';
    }
}

function eliminarFilaCodigo(btn) {
    const lista = document.getElementById('codigosList');
    if (lista.children.length <= 1) return;
    btn.closest('.dynamic-item').remove();
    _actualizarBotonesEliminar('codigosList');
}

function _recolectarFilas(listId) {
    const filas = document.querySelectorAll(`#${listId} .dynamic-item`);
    const datos = [];
    let valido = true;
    filas.forEach(fila => {
        const tipoInput = fila.querySelector('.item-tipo');
        const cantInput = fila.querySelector('.item-cantidad');
        
        // Obtener valor y convertir a mayúsculas para envío
        let tipo = tipoInput.value.trim();
        const cant = cantInput.value;
        
        if (!tipo || !cant) { 
            valido = false; 
            return; 
        }
        
        // Convertir a mayúsculas solo para el envío
        tipo = tipo.toUpperCase();
        
        datos.push({ tipo, cantidad: cant });
    });
    return valido ? datos : null;
}

function _recolectarCodigos() {
    const filas = document.querySelectorAll('#codigosList .dynamic-item');
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

window.agregarFilaInsumo = agregarFilaInsumo;
window.eliminarFilaInsumo = eliminarFilaInsumo;
window.agregarFilaCorte = agregarFilaCorte;
window.eliminarFilaCorte = eliminarFilaCorte;
window.agregarFilaTela = agregarFilaTela;
window.eliminarFilaTela = eliminarFilaTela;
window.agregarFilaCodigo = agregarFilaCodigo;
window.eliminarFilaCodigo = eliminarFilaCodigo;
window.actualizarMaximoCodigo = actualizarMaximoCodigo;
window.handleCodigosTipoChange = handleCodigosTipoChange;


// MANEJO DE ARCHIVOS
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) validateAndPreviewFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.borderColor = '#673ab7';
    e.currentTarget.style.background = '#f8f9fa';
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.borderColor = '#dadce0';
    e.currentTarget.style.background = '#fff';
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.borderColor = '#dadce0';
    e.currentTarget.style.background = '#fff';
    const file = e.dataTransfer.files[0];
    if (file) {
        const input = document.getElementById('imagen');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        validateAndPreviewFile(file);
    }
}

function validateAndPreviewFile(file) {
    const errorElement = document.getElementById('imagenError');
    const input = document.getElementById('imagen');
    if (!ValidationRules.imagen.allowedTypes.includes(file.type)) {
        showError(input, errorElement, 'Solo se permiten imágenes JPG, PNG o GIF');
        input.value = '';
        return;
    }
    if (file.size > ValidationRules.imagen.maxSize) {
        showError(input, errorElement, 'La imagen no debe superar los 5MB');
        input.value = '';
        return;
    }
    FormState.selectedFile = file;
    hideError(input, errorElement);
    showFilePreview(file);
}

function showFilePreview(file) {
    const preview = document.getElementById('filePreview');
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    preview.innerHTML = `
        <div class="file-preview-info">
            <div class="file-preview-icon"><i class="fas fa-image"></i></div>
            <div>
                <div class="file-preview-name">${file.name}</div>
                <div style="font-size: 0.75rem; color: #5f6368; margin-top: 4px;">${sizeInMB} MB</div>
            </div>
        </div>
        <button type="button" class="file-preview-remove" onclick="removeFile()">
            <i class="fas fa-times"></i>
        </button>
    `;
    preview.classList.remove('hidden');
}

function removeFile() {
    FormState.selectedFile = null;
    document.getElementById('imagen').value = '';
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('filePreview').innerHTML = '';
}

// VALIDACIÓN Y ENVÍO
function validateForm() {
    let isValid = true;
    const errors = [];
    const area = document.getElementById('area').value;
    if (!area) {
        showError(document.getElementById('area'), document.getElementById('areaError'), 'Por favor selecciona un área');
        errors.push('Área es requerida');
        isValid = false;
    }
    const tipoGroup = document.getElementById('tipoNovedadGroup');
    if (!tipoGroup.classList.contains('hidden')) {
        const tipo = document.getElementById('tipoNovedad').value;
        if (!tipo) {
            showError(document.getElementById('tipoNovedad'), document.getElementById('tipoError'), 'Por favor selecciona un tipo de novedad');
            errors.push('Tipo de novedad es requerido');
            isValid = false;
        }
    }
    // Descripción es opcional, solo validar si tiene contenido
    const descripcion = document.getElementById('descripcion').value.trim();
    if (descripcion.length > 0 && descripcion.length < 10) {
        showError(document.getElementById('descripcion'), document.getElementById('descripcionError'), 'La descripción debe tener al menos 10 caracteres');
        errors.push('Descripción muy corta');
        isValid = false;
    }
    return { isValid, errors };
}

async function handleSubmit(e) {
    e.preventDefault();
    if (FormState.isSubmitting) return;
    const validation = validateForm();
    if (!validation.isValid) {
        Swal.fire({ icon: 'warning', title: 'Formulario incompleto', text: 'Por favor completa todos los campos requeridos', confirmButtonColor: '#673ab7' });
        return;
    }
    const result = await Swal.fire({
        icon: 'question', title: '¿Enviar reporte?', text: 'Verifica que toda la información sea correcta',
        showCancelButton: true, confirmButtonColor: '#673ab7', cancelButtonColor: '#5f6368',
        confirmButtonText: 'Sí, enviar', cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    FormState.isSubmitting = true;
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<div class="spinner"></div><span>Enviando...</span>';
    
    try {
        // Preparar datos del formulario
        const formData = prepareFormData();
        
        // Si hay imagen, comprimirla y convertirla a base64
        if (FormState.selectedFile) {
            btnSubmit.innerHTML = '<div class="spinner"></div><span>Procesando imagen...</span>';
            const compressedBlob = await compressImage(FormState.selectedFile);
            const base64Data = await blobToBase64(compressedBlob);
            
            formData.imagen = {
                base64: base64Data,
                mimeType: 'image/jpeg',
                fileName: FormState.selectedFile.name
            };
        }
        
        // Enviar todo a la Edge Function segura
        btnSubmit.innerHTML = '<div class="spinner"></div><span>Guardando reporte...</span>';
        const response = await enviarNovedadSegura(formData);
        
        if (response.success) {
            // Mostrar pantalla de éxito estilo Google Forms
            mostrarPantallaExito(response.id || response.ID_NOVEDAD);
        } else {
            throw new Error(response.message || 'Error al enviar el reporte');
        }
    } catch (error) {
        console.error('[novedad-publica] Error al enviar novedad:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'Ocurrió un error al enviar el reporte. Por favor intenta nuevamente.', confirmButtonColor: '#673ab7' });
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar Reporte</span>';
    } finally {
        FormState.isSubmitting = false;
    }
}

function mostrarPantallaExito(idNovedad) {
    // Ocultar sección de formulario
    document.getElementById('seccionAdicional').classList.add('hidden');
    
    // Mostrar sección de éxito
    const seccionExito = document.getElementById('seccionExito');
    document.getElementById('novedadIdDisplay').textContent = idNovedad;
    seccionExito.classList.remove('hidden');
    
    // Actualizar indicador de paso
    updateStepIndicator(5);
    
    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function iniciarNuevoReporte() {
    // Limpiar completamente el formulario
    limpiarFormularioCompleto();
    
    // Ocultar pantalla de éxito
    document.getElementById('seccionExito').classList.add('hidden');
    
    // Mostrar sección de búsqueda
    document.getElementById('seccionBusqueda').classList.remove('hidden');
    
    // Resetear indicador de paso
    updateStepIndicator(1);
    
    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormularioCompleto() {
    // Resetear estado del formulario
    FormState.currentStep = 1;
    FormState.opData = null;
    FormState.selectedFile = null;
    FormState.isSubmitting = false;
    
    // Limpiar todos los inputs y selects
    document.getElementById('novedadForm').reset();
    document.getElementById('opInput').value = '';
    document.getElementById('area').value = '';
    document.getElementById('tipoNovedad').value = '';
    document.getElementById('descripcion').value = '';
    document.getElementById('imagen').value = '';
    
    // Limpiar campos específicos
    const cantidadNormal = document.getElementById('cantidadNormal');
    if (cantidadNormal) cantidadNormal.value = '';
    
    const codigosTipo = document.getElementById('codigosTipoSolicitud');
    if (codigosTipo) codigosTipo.value = '';
    
    const codigosCantidad = document.getElementById('codigosCantidadTotal');
    if (codigosCantidad) codigosCantidad.value = '';
    
    // Limpiar listas dinámicas
    const insumosList = document.getElementById('insumosList');
    if (insumosList) insumosList.innerHTML = '';
    
    const corteList = document.getElementById('corteList');
    if (corteList) corteList.innerHTML = '';
    
    const telasList = document.getElementById('telasList');
    if (telasList) telasList.innerHTML = '';
    
    const codigosList = document.getElementById('codigosList');
    if (codigosList) codigosList.innerHTML = '';
    
    // Ocultar todas las secciones excepto búsqueda
    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionNovedadDetalles').classList.add('hidden');
    document.getElementById('seccionAdicional').classList.add('hidden');
    document.getElementById('seccionExito').classList.add('hidden');
    
    // Ocultar todos los grupos de detalles
    const groups = [
        'tipoNovedadGroup', 'tipoInsumoGroup', 'tipoCorteGroup', 
        'tipoTelasGroup', 'tipoCodigosGroup', 'cantidadNormalGroup',
        'codigosLoteCompletoGroup', 'codigosUnidadesGroup'
    ];
    groups.forEach(groupId => {
        const group = document.getElementById(groupId);
        if (group) {
            group.classList.add('hidden');
            group.classList.remove('field-reveal');
            // Restaurar bloqueo inicial
            if (groupId !== 'area') {
                group.classList.add('field-locked');
            }
        }
    });
    
    // Limpiar preview de imagen
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('filePreview').innerHTML = '';
    
    // Limpiar errores
    document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.form-control').forEach(el => {
        el.classList.remove('error', 'success');
    });
    document.querySelectorAll('.input-wrapper').forEach(el => {
        el.classList.remove('error', 'success');
    });
    
    // Limpiar información del producto
    document.getElementById('infoOP').textContent = '-';
    document.getElementById('infoReferencia').textContent = '-';
    document.getElementById('infoCantidad').textContent = '-';
    document.getElementById('infoPlanta').textContent = '-';
    
    // Resetear botón de envío
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar Reporte</span>';
    
    // Reiniciar bloqueo de campos
    lockFieldsAfter('area');
    
    // Limpiar cache de curvas
    window.CURVAS_CACHE = {};
    window.CODIGOS_TALLAS = [];
    window.CODIGOS_COLORES = [];
    window.CODIGOS_DETALLES = [];
    window.CODIGOS_CANTIDAD_TOTAL = 0;
}

function prepareFormData() {
    const area = document.getElementById('area').value;
    const tipoNovedad = document.getElementById('tipoNovedad').value;
    const descripcion = document.getElementById('descripcion').value.trim();
    const descripcionSanitizada = sanitizeInput(descripcion);
    
    // Obtener correo si fue proporcionado
    const correoInput = document.getElementById('correoInput');
    const correo = correoInput && correoInput.value.trim() ? correoInput.value.trim() : null;
    
    let cantidadSolicitada = 0;
    let tipoDetalle = null;
    
    if (area === 'TELAS') {
        const datos = _recolectarFilas('telasList');
        if (datos) {
            tipoDetalle = { items: datos.map(i => ({ tipo: i.tipo, cantidad: Number(i.cantidad) })) };
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);
        }
    } else if (area === 'INSUMOS') {
        const datos = _recolectarFilas('insumosList');
        if (datos) {
            tipoDetalle = { items: datos.map(i => ({ tipo: i.tipo, cantidad: Number(i.cantidad) })) };
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);
        }
    } else if (area === 'CORTE') {
        const datos = _recolectarFilas('corteList');
        if (datos) {
            tipoDetalle = { items: datos.map(i => ({ tipo: i.tipo, cantidad: Number(i.cantidad) })) };
            cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);
        }
    } else if (area === 'CODIGOS') {
        const tipoSolicitud = document.getElementById('codigosTipoSolicitud').value;
        if (tipoSolicitud === 'LOTE_COMPLETO') {
            const cantidadInput = document.getElementById('codigosCantidadTotal');
            cantidadSolicitada = Number(cantidadInput.value) || 0;
            tipoDetalle = { tipo_solicitud: 'LOTE_COMPLETO', cantidad_total: cantidadSolicitada };
        } else if (tipoSolicitud === 'UNIDADES') {
            const datos = _recolectarCodigos();
            if (datos) {
                tipoDetalle = { tipo_solicitud: 'UNIDADES', items: datos.map(i => ({ talla: i.talla, color: i.color, cantidad: Number(i.cantidad) })) };
                cantidadSolicitada = datos.reduce((s, i) => s + Number(i.cantidad), 0);
            }
        }
    } else if (area !== 'DISEÑO' && area !== '') {
        const cantidadInput = document.getElementById('cantidadNormal');
        cantidadSolicitada = Number(cantidadInput.value) || 0;
    }
    
    const formData = {
        hoja: 'NOVEDADES', fecha: new Date().toISOString().split('T')[0],
        lote: FormState.opData.lote, referencia: FormState.opData.referencia, cantidad: FormState.opData.cantidad,
        planta: FormState.opData.planta, salida: FormState.opData.salida, linea: FormState.opData.linea,
        proceso: FormState.opData.proceso, prenda: FormState.opData.prenda, genero: FormState.opData.genero,
        tejido: FormState.opData.tejido, area: area, tipoNovedad: tipoNovedad || null, tipoDetalle: tipoDetalle,
        descripcion: descripcionSanitizada, cantidadSolicitada: cantidadSolicitada, imagen: ''
    };
    
    // Agregar correo solo si fue proporcionado
    if (correo) {
        formData.correo = correo;
    }
    
    return formData;
}

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

async function enviarNovedad(data) {
    console.log('[novedad-publica] Enviando datos:', data);
    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(`Error ${response.status}: ${errorData.message || 'Error en el servidor'}`);
    }
    return await response.json();
}

/**
 * Envía la novedad de forma segura mediante Edge Function
 * SIN FALLBACK - Para diagnosticar errores
 */
async function enviarNovedadSegura(data) {
    console.log('[enviarNovedadSegura] 📤 Iniciando envío...');
    console.log('[enviarNovedadSegura] 📦 Datos a enviar:', {
        lote: data.lote,
        area: data.area,
        tieneImagen: !!data.imagen,
        imagenSize: data.imagen?.base64?.length || 0
    });
    
    const url = `${CONFIG.FUNCTIONS_URL}/upload-public-image`;
    console.log('[enviarNovedadSegura] 🔗 URL:', url);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${SUPABASE_KEY}` 
            },
            body: JSON.stringify(data)
        });
        
        console.log('[enviarNovedadSegura] 📥 Respuesta recibida:');
        console.log('  - Status:', response.status);
        console.log('  - StatusText:', response.statusText);
        console.log('  - OK:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[enviarNovedadSegura] ❌ Error en respuesta:', errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('[enviarNovedadSegura] ✅ Resultado:', result);
        
        return result;
        
    } catch (error) {
        console.error('[enviarNovedadSegura] 💥 ERROR COMPLETO:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function uploadImagenAsync(file, idNovedad) {
    console.log('[novedad-publica] Subiendo imagen para ID:', idNovedad);
    try {
        const fileData = await fileToBase64(file);
        const payload = { accion: 'SUBIR_DRIVE', idNovedad: idNovedad, hoja: 'NOVEDADES', base64: fileData.base64, mimeType: fileData.mimeType, fileName: fileData.fileName };
        const response = await fetch(GAS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('Error al subir imagen');
        const result = await response.json();
        console.log('[novedad-publica] Imagen subida:', result.url);
    } catch (error) {
        console.error('[novedad-publica] Error al subir imagen:', error);
    }
}

/**
 * Sube una imagen a Supabase Storage mediante Edge Function segura
 * @param {File} file - Archivo de imagen a subir
 * @returns {Promise<string>} URL pública de la imagen subida
 */
async function uploadImagenSupabase(file) {
    console.log('[uploadImagenSupabase] Iniciando subida de imagen:', file.name);
    
    try {
        // Comprimir y convertir la imagen
        const compressedBlob = await compressImage(file);
        
        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 30);
        const fileName = `${sanitizedName}`;
        
        console.log('[uploadImagenSupabase] Preparando subida:', {
            originalSize: (file.size / 1024).toFixed(2) + ' KB',
            compressedSize: (compressedBlob.size / 1024).toFixed(2) + ' KB',
            fileName: fileName
        });
        
        // Convertir Blob a base64 para enviar a la Edge Function
        const base64Data = await blobToBase64(compressedBlob);
        
        // Subir mediante Edge Function segura
        const uploadResponse = await fetch(
            `${CONFIG.FUNCTIONS_URL}/upload-public-image`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                body: JSON.stringify({
                    base64: base64Data,
                    mimeType: 'image/jpeg',
                    fileName: fileName
                })
            }
        );
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error('[uploadImagenSupabase] Error en respuesta:', errorData);
            throw new Error(errorData.message || `Error ${uploadResponse.status}: ${uploadResponse.statusText}`);
        }
        
        const result = await uploadResponse.json();
        
        if (!result.success || !result.url) {
            throw new Error(result.message || 'Error al subir la imagen');
        }
        
        console.log('[uploadImagenSupabase] Imagen subida exitosamente:', result.url);
        
        return result.url;
        
    } catch (error) {
        console.error('[uploadImagenSupabase] Error:', error);
        throw new Error(`No se pudo subir la imagen: ${error.message}`);
    }
}

/**
 * Convierte un Blob a base64
 * @param {Blob} blob - Blob a convertir
 * @returns {Promise<string>} String en base64
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1]; // Remover el prefijo data:image/...;base64,
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Comprime una imagen y la convierte a Blob
 * Configuración balanceada: ~135 KB promedio, ~7,700 imágenes en 1GB
 * @param {File} file - Archivo de imagen original
 * @returns {Promise<Blob>} Blob de la imagen comprimida
 */
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            try {
                // Configuración balanceada para optimizar almacenamiento
                const MAX_W = 1024;  // Reducido de 1280 a 1024px
                let w = img.width;
                let h = img.height;
                
                // Redimensionar si es necesario
                if (w > MAX_W) {
                    h = Math.round(h * MAX_W / w);
                    w = MAX_W;
                }
                
                // Crear canvas y dibujar imagen
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                // Fondo blanco
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                
                // Dibujar imagen
                ctx.drawImage(img, 0, 0, w, h);
                
                // Calidad adaptativa para mejor compresión
                let quality;
                if (w > 900) {
                    quality = 0.6;   // Imágenes grandes: 60%
                } else if (w > 700) {
                    quality = 0.65;  // Imágenes medianas: 65%
                } else {
                    quality = 0.7;   // Imágenes pequeñas: 70%
                }
                
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const originalKB = (file.size / 1024).toFixed(2);
                            const compressedKB = (blob.size / 1024).toFixed(2);
                            const reduction = ((1 - blob.size / file.size) * 100).toFixed(1);
                            
                            console.log('[compressImage] Imagen optimizada:', {
                                original: originalKB + ' KB',
                                comprimido: compressedKB + ' KB',
                                reduccion: reduction + '%',
                                dimensiones: `${w}x${h}`,
                                calidad: (quality * 100) + '%'
                            });
                            resolve(blob);
                        } else {
                            reject(new Error('Error al comprimir la imagen'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
                
            } catch (e) {
                reject(e);
            }
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Error al cargar la imagen'));
        };
        
        img.src = url;
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const MAX_W = 1280;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const quality = w > 800 ? 0.7 : 0.8;
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const base64 = dataUrl.split(',')[1];
                resolve({ base64, mimeType: 'image/jpeg', fileName: file.name.replace(/\.[^.]+$/, '.jpg') });
            } catch (e) { reject(e); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al cargar la imagen')); };
        img.src = url;
    });
}

window.removeFile = removeFile;
