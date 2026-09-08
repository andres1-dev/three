/* ==========================================================================
   forms/aprobacion.js — Formulario de Aprobación de Planta Anexo
   ========================================================================== */

// Lista de maquinaria
const MAQUINARIA_LIST = [
    'Fileteadora F3 (Sencilla)',
    'Fileteadora F4 (Refuerzo)',
    'Fileteadora F5 (Seguridad)',
    'Maquina Plana Convencional',
    'Maquina Plana Dos Aguja (Sencilla)',
    'Maquina Collarin',
    'Maquina Encintadora',
    'Maquina Ojaladora',
    'Maquina Botonadora',
    'Maquina Presilladora',
    'Maquina De Coser 20U',
    'Maquina Resortadora',
    'Maquina Multiagujas',
    'Maquina Plana Dos Aguja',
    'Maquina Plana',
    'Pulpos',
    'Banda (Termofijado)',
    'Zancudo (Transfer)',
    'Reveladora al Vacio',
    'Maquina Bordadora',
    'Cerradora de Codo',
    'Troqueladora',
    'Maquina Remachadora',
    'Plancha Industrial',
    'Mesa de Estampado',
    'Sublimadora',
    'Termofijadora',
    'Maquina Flatseamer',
    'Maquina Plana Familiar'
];

// Tipos de prendas para fuerte
const TIPOS_PRENDA = [
    'Camisetas',
    'Polos',
    'Camisas',
    'Blusas',
    'Pantalones',
    'Jeans',
    'Shorts',
    'Faldas',
    'Vestidos',
    'Chaquetas',
    'Sudaderas',
    'Chalecos',
    'Ropa Interior',
    'Ropa Deportiva',
    'Ropa de Trabajo',
    'Uniformes',
    'Bebés',
    'Niños',
    'Otros'
];

// Días de la semana
const DIAS_SEMANA = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
];

let maquinariaState = [];
let fuerteState = [];
let horariosState = {};

/**
 * Inicializa el formulario de aprobación
 */
function initAprobacionForm() {
    initLocationFilters();
    initMaquinariaField();
    initFuerteField();
    initHorariosField();
    initGeolocalizacion();
    initFormSubmit();
}

/**
 * Inicializa los filtros de ubicación (reutiliza lógica de plantas.js)
 */
function initLocationFilters() {
    const departamentoSelect = document.getElementById('departamentoAprobacion');
    const ciudadSelect = document.getElementById('ciudadAprobacion');
    const ciudadContainer = document.getElementById('ciudadContainer');
    const barrioContainer = document.getElementById('barrioContainer');
    const comunaInput = document.getElementById('comunaAprobacion');
    const comunaContainer = document.getElementById('comunaContainer');
    const comunaLabel = document.getElementById('comunaLabel');
    const barrioInput = document.getElementById('barrioAprobacion');

    if (!departamentoSelect || !ciudadSelect) return;

    // Poblar departamentos
    if (typeof DEPARTAMENTOS_COLOMBIA !== 'undefined') {
        DEPARTAMENTOS_COLOMBIA.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departamentoSelect.appendChild(option);
        });
    }

    // Listener: Cambio de departamento actualiza ciudades
    departamentoSelect.addEventListener('change', function() {
        const departamento = this.value;
        
        // Reset y ocultar campos siguientes
        ciudadSelect.innerHTML = '<option value="" disabled selected>Seleccione ciudad</option>';
        if (barrioInput) barrioInput.value = '';
        if (comunaInput) comunaInput.value = '';
        
        if (departamento) {
            // Mostrar campo de ciudad
            if (ciudadContainer) ciudadContainer.style.display = 'block';
            
            // Cargar ciudades
            if (typeof getCiudadesPorDepartamento !== 'undefined') {
                const ciudades = getCiudadesPorDepartamento(departamento);
                ciudades.forEach(ciudad => {
                    const option = document.createElement('option');
                    option.value = ciudad;
                    option.textContent = ciudad;
                    ciudadSelect.appendChild(option);
                });
            }
        } else {
            // Ocultar campos siguientes
            if (ciudadContainer) ciudadContainer.style.display = 'none';
            if (barrioContainer) barrioContainer.style.display = 'none';
            if (comunaContainer) comunaContainer.style.display = 'none';
        }
    });

    // Listener: Cambio de ciudad actualiza barrio/comuna
    ciudadSelect.addEventListener('change', function() {
        const ciudad = this.value;
        
        if (barrioInput) barrioInput.value = '';
        if (comunaInput) comunaInput.value = '';
        
        if (ciudad) {
            // Mostrar campos de barrio y comuna
            if (barrioContainer) barrioContainer.style.display = 'block';
            
            // Configurar campo de comuna si la ciudad lo maneja
            if (typeof ciudadTieneComunas !== 'undefined' && ciudadTieneComunas(ciudad)) {
                if (comunaContainer) comunaContainer.style.display = 'block';
                if (comunaLabel) comunaLabel.textContent = typeof getNombreCampoComuna !== 'undefined' ? getNombreCampoComuna(ciudad) : 'Comuna';
                
                // Poblar comunas/localidades
                if (typeof getComunasLocalidadesPorCiudad !== 'undefined') {
                    const comunas = getComunasLocalidadesPorCiudad(ciudad);
                    comunaInput.innerHTML = '<option value="" disabled selected>Seleccione</option>';
                    comunas.forEach(c => {
                        const option = document.createElement('option');
                        option.value = c.numero;
                        option.textContent = c.nombre;
                        comunaInput.appendChild(option);
                    });
                }
            } else {
                if (comunaContainer) comunaContainer.style.display = 'none';
            }
            
            // Configurar autocomplete de barrio
            if (barrioInput && typeof getBarriosPorCiudad !== 'undefined') {
                const barrios = getBarriosPorCiudad(ciudad);
                barrioInput.setAttribute('list', 'barrioOptions');
                
                let datalist = document.getElementById('barrioOptions');
                if (!datalist) {
                    datalist = document.createElement('datalist');
                    datalist.id = 'barrioOptions';
                    barrioInput.parentNode.appendChild(datalist);
                }
                
                datalist.innerHTML = '';
                barrios.forEach(barrio => {
                    const option = document.createElement('option');
                    option.value = barrio;
                    datalist.appendChild(option);
                });
            }
        } else {
            if (barrioContainer) barrioContainer.style.display = 'none';
            if (comunaContainer) comunaContainer.style.display = 'none';
        }
    });
}

/**
 * Inicializa el campo de maquinaria
 */
function initMaquinariaField() {
    const select = document.getElementById('maquinariaSelect');
    const cantidadInput = document.getElementById('maquinariaCantidad');
    const agregarBtn = document.getElementById('agregarMaquinariaBtn');
    const lista = document.getElementById('maquinariaLista');
    const customInput = document.getElementById('maquinariaCustom');
    const customContainer = document.getElementById('maquinariaCustomContainer');

    if (!select || !agregarBtn || !lista) return;

    // Poblar select
    MAQUINARIA_LIST.forEach(maq => {
        const option = document.createElement('option');
        option.value = maq;
        option.textContent = maq;
        select.appendChild(option);
    });

    // Mostrar campo custom cuando se selecciona "Otro"
    select.addEventListener('change', function() {
        if (this.value === 'OTRO') {
            if (customContainer) customContainer.style.display = 'block';
            if (customInput) customInput.required = true;
        } else {
            if (customContainer) customContainer.style.display = 'none';
            if (customInput) {
                customInput.required = false;
                customInput.value = '';
            }
        }
    });

    // Agregar maquinaria
    agregarBtn.addEventListener('click', function() {
        const tipo = select.value === 'OTRO' ? (customInput?.value || '').trim() : select.value;
        const cantidad = parseInt(cantidadInput?.value) || 0;

        if (!tipo) {
            Swal.fire('Error', 'Debe seleccionar o ingresar un tipo de maquinaria', 'error');
            return;
        }

        if (cantidad <= 0) {
            Swal.fire('Error', 'Debe ingresar una cantidad válida', 'error');
            return;
        }

        maquinariaState.push({ tipo, cantidad });
        renderMaquinariaLista();

        // Reset campos
        select.value = '';
        if (cantidadInput) cantidadInput.value = '';
        if (customInput) customInput.value = '';
        if (customContainer) customContainer.style.display = 'none';
    });
}

/**
 * Renderiza la lista de maquinaria
 */
function renderMaquinariaLista() {
    const lista = document.getElementById('maquinariaLista');
    if (!lista) return;
    
    lista.innerHTML = '';
    maquinariaState.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'maquinaria-item';
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;';
        div.innerHTML = `
            <span><strong>${item.tipo}</strong> - Cantidad: ${item.cantidad}</span>
            <button type="button" class="btn btn-sm btn-danger" onclick="removeMaquinaria(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        lista.appendChild(div);
    });
}

/**
 * Elimina una maquinaria de la lista
 */
window.removeMaquinaria = function(index) {
    maquinariaState.splice(index, 1);
    renderMaquinariaLista();
};

/**
 * Inicializa el campo de fuerte (tipos de prendas)
 */
function initFuerteField() {
    const select = document.getElementById('fuerteSelect');
    const agregarBtn = document.getElementById('agregarFuerteBtn');
    const lista = document.getElementById('fuerteLista');

    if (!select || !agregarBtn || !lista) return;

    // Poblar select
    TIPOS_PRENDA.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        select.appendChild(option);
    });

    // Agregar tipo de prenda
    agregarBtn.addEventListener('click', function() {
        const tipo = select.value;

        if (!tipo) {
            Swal.fire('Error', 'Debe seleccionar un tipo de prenda', 'error');
            return;
        }

        if (fuerteState.includes(tipo)) {
            Swal.fire('Advertencia', 'Este tipo de prenda ya está agregado', 'warning');
            return;
        }

        fuerteState.push(tipo);
        renderFuerteLista();

        select.value = '';
    });

    function renderFuerteLista() {
        lista.innerHTML = '';
        fuerteState.forEach((tipo, index) => {
            const div = document.createElement('div');
            div.className = 'fuerte-item';
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;';
            div.innerHTML = `
                <span>${tipo}</span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeFuerte(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            lista.appendChild(div);
        });
    }
}

/**
 * Elimina un tipo de prenda de la lista
 */
window.removeFuerte = function(index) {
    fuerteState.splice(index, 1);
    renderFuerteLista();
};

/**
 * Inicializa la geolocalización automática
 */
function initGeolocalizacion() {
    const btnGeolocalizar = document.getElementById('btnGeolocalizar');
    const locInput = document.getElementById('localizacionAprobacion');

    if (!btnGeolocalizar || !locInput) return;

    const obtenerUbicacion = function() {
        if (!navigator.geolocation) {
            locInput.value = 'Geolocalización no soportada';
            return;
        }

        locInput.value = 'Obteniendo ubicación...';

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);
                locInput.value = `${lat},${lng}`;
            },
            (error) => {
                let errorMsg = 'No se pudo obtener la ubicación';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'Permiso denegado';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'Ubicación no disponible';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'Tiempo agotado';
                        break;
                }
                locInput.value = errorMsg;
            },
            options
        );
    };

    btnGeolocalizar.addEventListener('click', obtenerUbicacion);

    // Obtener ubicación automáticamente al cargar
    setTimeout(obtenerUbicacion, 500);
}

/**
 * Inicializa el campo de horarios
 */
function initHorariosField() {
    const diasContainer = document.getElementById('diasContainer');
    const calcularBtn = document.getElementById('calcularHorarioBtn');
    const resultadoDiv = document.getElementById('horarioResultado');

    if (!diasContainer) return;

    // Manejar selección de días con botones
    let diasSeleccionados = [];
    const diaBtns = diasContainer.querySelectorAll('.dia-btn');
    
    diaBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const dia = parseInt(this.getAttribute('data-dia'));
            
            if (dia === 0) {
                // Lunes-Viernes: selecciona o deselecciona todos los días de lunes a viernes
                if (this.classList.contains('active')) {
                    this.classList.remove('active');
                    diasSeleccionados = diasSeleccionados.filter(d => d !== 1 && d !== 2 && d !== 3 && d !== 4 && d !== 5);
                } else {
                    this.classList.add('active');
                    [1, 2, 3, 4, 5].forEach(d => {
                        if (!diasSeleccionados.includes(d)) {
                            diasSeleccionados.push(d);
                        }
                    });
                }
            } else {
                // Sábado (6) o Domingo (7): toggle individual
                if (this.classList.contains('active')) {
                    this.classList.remove('active');
                    diasSeleccionados = diasSeleccionados.filter(d => d !== dia);
                } else {
                    this.classList.add('active');
                    if (!diasSeleccionados.includes(dia)) {
                        diasSeleccionados.push(dia);
                    }
                }
            }
            
            document.getElementById('diasSeleccionados').value = JSON.stringify(diasSeleccionados);
        });
    });

    // Calcular horario
    calcularBtn.addEventListener('click', function() {
        if (!diasSeleccionados.length) {
            Swal.fire('Error', 'Debe seleccionar al menos un día', 'error');
            return;
        }

        const inicio = document.querySelector('.hora-inicio-input').value;
        const fin = document.querySelector('.hora-fin-input').value;
        const desayuno = parseInt(document.querySelector('.desayuno-input').value) || 0;
        const almuerzo = parseInt(document.querySelector('.almuerzo-input').value) || 0;

        if (!inicio || !fin) {
            Swal.fire('Error', 'Debe seleccionar hora inicio y fin', 'error');
            return;
        }

        const inicioParts = inicio.split(':');
        const finParts = fin.split(':');
        const inicioMin = parseInt(inicioParts[0]) * 60 + parseInt(inicioParts[1]);
        const finMin = parseInt(finParts[0]) * 60 + parseInt(finParts[1]);

        if (finMin <= inicioMin) {
            Swal.fire('Error', 'La hora fin debe ser mayor a la hora inicio', 'error');
            return;
        }

        const duracionMin = finMin - inicioMin;
        const minutosNetos = duracionMin - desayuno - almuerzo;

        if (minutosNetos < 0) {
            Swal.fire('Error', 'El tiempo de desayuno y almuerzo no puede ser mayor que la duración del horario', 'error');
            return;
        }

        const minutosSemanales = minutosNetos * diasSeleccionados.length;

        const diasNombres = diasSeleccionados.map(d => {
            if (d === 1) return 'Lunes';
            if (d === 2) return 'Martes';
            if (d === 3) return 'Miércoles';
            if (d === 4) return 'Jueves';
            if (d === 5) return 'Viernes';
            if (d === 6) return 'Sábado';
            if (d === 7) return 'Domingo';
        }).join(', ');

        resultadoDiv.innerHTML = `
            <div class="alert alert-success">
                <strong>Horario configurado:</strong><br>
                Días: ${diasNombres}<br>
                Hora: ${inicio} - ${fin}<br>
                Duración: ${duracionMin} minutos<br>
                Desayuno: ${desayuno} minutos<br>
                Almuerzo: ${almuerzo} minutos<br>
                <strong>Neto diario: ${minutosNetos} minutos</strong><br>
                <strong>Neto semanal: ${minutosSemanales} minutos</strong>
            </div>
        `;
    });
}

/**
 * Inicializa el envío del formulario
 */
function initFormSubmit() {
    const form = document.getElementById('aprobacionForm');

    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validar campos requeridos
        const idPlantaAnexo = document.getElementById('idPlantaAnexo')?.value;
        const plantaAnexo = document.getElementById('plantaAnexo')?.value;
        const productora = document.getElementById('productoraAprobacion')?.value;
        const direccion = document.getElementById('direccionAprobacion')?.value;
        const localizacion = document.getElementById('localizacionAprobacion')?.value;
        const telefono = document.getElementById('telefonoAprobacion')?.value;
        const estado = document.getElementById('estadoAprobacion')?.value;
        const fecha = document.getElementById('fechaAprobacion')?.value;
        const comentarios = document.getElementById('comentariosAprobacion')?.value;
        
        // Capturar tipo_visita
        const tipoVisita = document.getElementById('tipoVisita')?.value || 'APROBACION';
        
        // Capturar tejidos seleccionados (checkboxes)
        const tejidosSeleccionados = [];
        if (document.getElementById('tejidoPLANO')?.checked) tejidosSeleccionados.push('PLANO');
        if (document.getElementById('tejidoPUNTO')?.checked) tejidosSeleccionados.push('PUNTO');
        if (document.getElementById('tejidoINDIGO')?.checked) tejidosSeleccionados.push('INDIGO');
        
        // Capturar email del usuario logueado
        const emailUsuario = window.currentUser?.EMAIL || window.currentUser?.email || window.currentUser?.CORREO || window.currentUser?.correo || null;
        
        // Capturar archivo de soporte
        const soporteInput = document.getElementById('soporte');
        const soporteFile = soporteInput?.files?.[0] || null;
        
        // Capturar firma SVG desde FirmaTaller
        let firma = null;
        if (window.FirmaTaller && !window.FirmaTaller.isEmpty()) {
            firma = window.FirmaTaller.getSVG();
        }

        // Capturar horarios del formulario
        const inicio = document.querySelector('.hora-inicio-input')?.value;
        const fin = document.querySelector('.hora-fin-input')?.value;
        const desayuno = parseInt(document.querySelector('.desayuno-input')?.value) || 0;
        const almuerzo = parseInt(document.querySelector('.almuerzo-input')?.value) || 0;
        const diasSeleccionados = JSON.parse(document.getElementById('diasSeleccionados')?.value || '[]');

        // Calcular minutos
        const inicioParts = inicio.split(':');
        const finParts = fin.split(':');
        const inicioMin = parseInt(inicioParts[0]) * 60 + parseInt(inicioParts[1]);
        const finMin = parseInt(finParts[0]) * 60 + parseInt(finParts[1]);
        const duracionMin = finMin - inicioMin;
        const minutosDia = duracionMin - desayuno - almuerzo;
        const minutosSemanales = minutosDia * diasSeleccionados.length;

        const horariosData = {
            inicio: inicio,
            fin: fin,
            dias: diasSeleccionados.length,
            desayuno: desayuno,
            almuerzo: almuerzo,
            minutos_dia: minutosDia,
            minutos_semanales: minutosSemanales
        };

        if (!idPlantaAnexo) {
            Swal.fire('Error', 'Debe ingresar el NIT o cédula', 'error');
            return;
        }

        if (!plantaAnexo) {
            Swal.fire('Error', 'Debe ingresar el nombre de la planta', 'error');
            return;
        }

        if (!productora) {
            Swal.fire('Error', 'Debe seleccionar la productora', 'error');
            return;
        }

        // Validar teléfono: debe tener 10 dígitos y iniciar con 3
        if (!telefono) {
            Swal.fire('Error', 'Debe ingresar el teléfono', 'error');
            return;
        }

        if (telefono.length !== 10) {
            Swal.fire('Error', 'El teléfono debe tener exactamente 10 dígitos', 'error');
            return;
        }

        if (!telefono.startsWith('3')) {
            Swal.fire('Error', 'El teléfono debe iniciar con el número 3', 'error');
            return;
        }

        if (!direccion) {
            Swal.fire('Error', 'Debe ingresar la dirección', 'error');
            return;
        }

        if (!localizacion) {
            Swal.fire('Error', 'Debe ingresar la localización', 'error');
            return;
        }

        if (!estado) {
            Swal.fire('Error', 'Debe seleccionar el estado', 'error');
            return;
        }

        if (!fecha) {
            Swal.fire('Error', 'Debe seleccionar la fecha y hora', 'error');
            return;
        }

        if (!firma) {
            Swal.fire('Error', 'Debe firmar el formulario', 'error');
            return;
        }

        // Construir payload
        const payload = {
            id_planta_anexo: parseInt(idPlantaAnexo),
            planta_anexo: plantaAnexo,
            tipo_visita: tipoVisita,
            correo: document.getElementById('correoAprobacion')?.value || null,
            email_usuario: emailUsuario,
            telefono: parseInt(telefono),
            productora: parseInt(productora),
            operarios: document.getElementById('operariosAprobacion')?.value ? parseInt(document.getElementById('operariosAprobacion').value) : null,
            maquinaria: maquinariaState.length > 0 ? { items: maquinariaState } : null,
            horarios: horariosData,
            direccion: direccion,
            departamento: document.getElementById('departamentoAprobacion')?.value || null,
            ciudad: document.getElementById('ciudadAprobacion')?.value || null,
            tejido: tejidosSeleccionados.length > 0 ? tejidosSeleccionados : null,
            fuerte: fuerteState.length > 0 ? fuerteState : null,
            localizacion: localizacion,
            comuna: document.getElementById('comunaAprobacion')?.value ? parseInt(document.getElementById('comunaAprobacion').value) : null,
            barrio: document.getElementById('barrioAprobacion')?.value || null,
            estado: estado,
            fecha_hora: fecha,
            comentarios: comentarios || null,
            firma_svg: firma,
            soporte: '' // Se actualizará después de subir el archivo
        };

        try {
            const btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            }

            // Subir archivo de soporte si existe
            if (soporteFile) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo soporte...';
                try {
                    const soporteUrl = await uploadToSupabase(soporteFile, productora, 'plantas_anexos');
                    payload.soporte = soporteUrl;
                } catch (uploadError) {
                    console.error('[APROBACION] Error subiendo soporte:', uploadError);
                    Swal.fire('Error', 'No se pudo subir el soporte fotográfico', 'error');
                    return;
                }
            }

            // Obtener token de sesión
            let sessionToken = null;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('-auth-token')) {
                    try {
                        const raw = localStorage.getItem(key);
                        if (raw && raw !== 'undefined' && raw !== 'null') {
                            const session = JSON.parse(raw);
                            if (session && session.access_token) {
                                sessionToken = session.access_token;
                                break;
                            }
                        }
                    } catch(e) {}
                }
            }

            const headers = {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY
            };

            if (sessionToken) {
                headers['Authorization'] = `Bearer ${sessionToken}`;
            }

            const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    accion: 'INSERT_PLANTA_ANEXO',
                    planta_anexo: payload
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || 'Error al guardar');
            }

            Swal.fire({
                icon: 'success',
                title: 'Guardado exitosamente',
                text: 'La planta anexo ha sido aprobada y guardada',
                confirmButtonColor: '#3f51b5'
            }).then(() => {
                form.reset();
                maquinariaState = [];
                fuerteState = [];
                horariosState = {};
                document.getElementById('maquinariaLista').innerHTML = '';
                document.getElementById('fuerteLista').innerHTML = '';
                document.getElementById('horarioResultado').innerHTML = '';
                
                // Limpiar firma
                if (window.FirmaTaller) {
                    window.FirmaTaller.clear();
                }
            });

        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            const btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Guardar Aprobación';
            }
        }
    });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('aprobacionForm')) {
        initAprobacionForm();
    }
});
