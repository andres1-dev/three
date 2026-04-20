/* ==========================================================================
   forms/plantas.js — Formulario de Actualizar Datos de Planta
   ========================================================================== */

function initPlantasMasks() {
    const form = document.getElementById('gestionPlantaForm');
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput    = document.getElementById('emailPlanta');

    if (telefonoInput) {
        // ... (existing telephone mask logic)
        telefonoInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.slice(0, 10);
            let formatted = '';
            if (value.length > 0) {
                formatted = '(' + value.slice(0, 3);
                if (value.length > 3) formatted += ') ' + value.slice(3, 6);
                if (value.length > 6) formatted += '-' + value.slice(6, 10);
            }
            e.target.value = formatted;
        });
    }

    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            const value = e.target.value;
            const datalist = document.getElementById('emailOptions');
            if (datalist && value.includes('@')) {
                const [username] = value.split('@');
                const commonDomains = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','live.com'];
                datalist.innerHTML = '';
                commonDomains.forEach(d => {
                    const option = document.createElement('option');
                    option.value = username + '@' + d;
                    datalist.appendChild(option);
                });
            }
        });
    }

    // Inicializar filtros en cascada de ubicación
    initLocationFilters();
}

// initPlantasMasks se llama desde inicializarFormulario() en gestion-planta.html (window.onload)

/**
 * Inicializa los filtros en cascada de ubicación (País -> Departamento -> Ciudad -> Barrio/Comuna)
 */
function initLocationFilters() {
    const departamentoSelect = document.getElementById('departamentoPlanta');
    const ciudadSelect = document.getElementById('ciudadPlanta');
    const ciudadContainer = document.getElementById('ciudadContainer');
    const barrioContainer = document.getElementById('barrioContainer');
    const comunaInput = document.getElementById('comunaPlanta');
    const comunaContainer = document.getElementById('comunaContainer');
    const comunaLabel = document.getElementById('comunaLabel');
    const comunaHint = document.getElementById('comunaHint');

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
        resetBarrioField();
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
        
        // Ocultar barrio y comuna
        if (barrioContainer) barrioContainer.style.display = 'none';
        if (comunaContainer) comunaContainer.style.display = 'none';
    });

    // Listener: Cambio de ciudad actualiza barrios
    ciudadSelect.addEventListener('change', function() {
        const ciudad = this.value;
        
        // Reset barrio y comuna
        resetBarrioField();
        if (comunaInput) {
            comunaInput.value = '';
            comunaInput.readOnly = true;
            comunaInput.required = false;
        }

        if (ciudad) {
            // Mostrar contenedor de barrio
            if (barrioContainer) barrioContainer.style.display = 'block';
            
            // Actualizar label de comuna/localidad
            if (typeof getNombreCampoComuna !== 'undefined' && comunaLabel) {
                const nombreCampo = getNombreCampoComuna(ciudad);
                comunaLabel.textContent = nombreCampo;
                if (comunaHint) {
                    comunaHint.textContent = `Se llena automáticamente al seleccionar barrio (${nombreCampo})`;
                }
            }

            // Mostrar comuna solo si la ciudad la maneja
            if (typeof ciudadTieneComunas !== 'undefined' && ciudadTieneComunas(ciudad)) {
                if (comunaContainer) comunaContainer.style.display = 'block';
            } else {
                if (comunaContainer) comunaContainer.style.display = 'none';
            }

            // Cargar barrios - AUTOMÁTICO
            if (typeof getBarriosPorCiudad !== 'undefined') {
                const barrios = getBarriosPorCiudad(ciudad);
                
                if (barrios.length > 0) {
                    // Hay barrios predefinidos - crear SELECT automáticamente
                    createBarrioSelect(barrios);
                } else {
                    // No hay barrios predefinidos - crear INPUT automáticamente
                    createBarrioInput();
                    
                    // Si la ciudad tiene comunas, hacer el campo editable y obligatorio
                    if (typeof ciudadTieneComunas !== 'undefined' && ciudadTieneComunas(ciudad) && comunaInput) {
                        comunaInput.readOnly = false;
                        comunaInput.required = true;
                        comunaInput.placeholder = 'Escribe la comuna o localidad';
                        
                        if (comunaHint) {
                            comunaHint.innerHTML = `<span style="color:#ef4444;">*</span> Obligatorio al escribir barrio manualmente`;
                        }
                        if (comunaLabel) {
                            const nombreCampo = getNombreCampoComuna(ciudad);
                            comunaLabel.textContent = nombreCampo;
                        }
                        const comunaAsterisk = document.getElementById('comunaAsterisk');
                        if (comunaAsterisk) {
                            comunaAsterisk.style.display = 'inline';
                        }
                    }
                }
            }
        } else {
            // Ocultar barrio y comuna
            if (barrioContainer) barrioContainer.style.display = 'none';
            if (comunaContainer) comunaContainer.style.display = 'none';
        }
    });
}

/**
 * Resetea el campo de barrio (lo convierte en select vacío)
 */
function resetBarrioField() {
    const container = document.querySelector('#barrioPlanta')?.parentElement;
    if (!container) return;
    
    const icon = container.querySelector('.fas');
    container.innerHTML = '';
    if (icon) container.appendChild(icon);
    
    const select = document.createElement('select');
    select.id = 'barrioPlanta';
    select.className = 'form-control';
    select.required = true;
    select.innerHTML = '<option value="" disabled selected>Seleccione barrio</option>';
    container.appendChild(select);
}

/**
 * Crea un SELECT con los barrios predefinidos
 */
function createBarrioSelect(barrios) {
    const container = document.querySelector('#barrioPlanta')?.parentElement;
    if (!container) return;
    
    const icon = container.querySelector('.fas');
    container.innerHTML = '';
    if (icon) container.appendChild(icon);
    
    const select = document.createElement('select');
    select.id = 'barrioPlanta';
    select.className = 'form-control';
    select.required = true;
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccione barrio';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    barrios.forEach(barrio => {
        const option = document.createElement('option');
        option.value = barrio;
        option.textContent = barrio;
        select.appendChild(option);
    });
    
    container.appendChild(select);
    
    // Agregar listener para auto-llenar comuna
    select.addEventListener('change', function() {
        const barrio = this.value;
        const ciudadSelect = document.getElementById('ciudadPlanta');
        const ciudad = ciudadSelect?.value;
        const comunaInput = document.getElementById('comunaPlanta');

        if (barrio && comunaInput && typeof ciudadTieneComunas !== 'undefined' && ciudadTieneComunas(ciudad)) {
            if (ciudad === 'Cali' && typeof getComunaPorBarrio !== 'undefined') {
                const comuna = getComunaPorBarrio(barrio);
                if (comuna) {
                    comunaInput.value = comuna;
                    // Mostrar botón de editar cuando se auto-llena
                    if (typeof mostrarBotonEditarComuna === 'function') {
                        mostrarBotonEditarComuna();
                    }
                }
            }
        }
    });
}

/**
 * Crea un INPUT para escribir el barrio manualmente
 */
function createBarrioInput() {
    const container = document.querySelector('#barrioPlanta')?.parentElement;
    if (!container) return;
    
    const icon = container.querySelector('.fas');
    container.innerHTML = '';
    if (icon) container.appendChild(icon);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'barrioPlanta';
    input.className = 'form-control';
    input.placeholder = 'Escribe el nombre del barrio';
    input.required = true;
    
    container.appendChild(input);
}

/**
 * Maneja la respuesta del usuario sobre si está en el taller
 */
function respuestaUbicacionTaller(enTaller) {
    const preguntaCard = document.getElementById('gps-pregunta-card');
    const mapaCard = document.getElementById('gps-planta-card');
    const locInput = document.getElementById('localizacionPlanta');
    const locInputContainer = document.getElementById('localizacionInputContainer');
    const locHint = document.getElementById('localizacionHint');
    
    if (!preguntaCard || !mapaCard || !locInput) return;
    
    if (enTaller) {
        // Usuario está en el taller - ocultar pregunta y activar GPS inmediatamente
        preguntaCard.style.display = 'none';
        mapaCard.style.display = 'block';
        activarGpsPlanta();
    } else {
        // Usuario NO está en el taller - ocultar todo
        preguntaCard.style.display = 'none';
        mapaCard.style.display = 'none';
        if (locInputContainer) locInputContainer.style.display = 'none';
        if (locHint) {
            locHint.innerHTML = '<i class="fas fa-info-circle me-1"></i> Ubicación omitida (no estás en el taller)';
            locHint.style.color = '#64748b';
        }
        locInput.value = '';
    }
}

/**
 * Activa la geolocalización para el formulario de plantas
 */
function activarGpsPlanta() {
    const locInput = document.getElementById('localizacionPlanta');
    const locInputContainer = document.getElementById('localizacionInputContainer');
    const mapaCard = document.getElementById('gps-planta-card');
    const locHint = document.getElementById('localizacionHint');
    
    if (!locInput || !mapaCard) return;
    
    if (!navigator.geolocation) {
        mapaCard.innerHTML = `<span style="color:#ef4444;"><i class="fas fa-exclamation-triangle me-2"></i> Geolocalización no soportada en este navegador.</span>`;
        return;
    }
    
    mapaCard.innerHTML = `<div style="text-align:center; padding:1rem;"><i class="fas fa-spinner fa-spin me-2"></i> Obteniendo coordenadas...</div>`;
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            
            locInput.value = `${lat}, ${lng}`;
            if (locInputContainer) locInputContainer.style.display = 'block';
            if (locHint) {
                locHint.innerHTML = '<i class="fas fa-check-circle me-1" style="color:#10b981;"></i> Ubicación capturada correctamente';
                locHint.style.color = '#10b981';
            }
            
            // Calcular bbox para el mapa (área de ~500m alrededor del punto)
            const delta = 0.0045;
            const minLng = (parseFloat(lng) - delta).toFixed(6);
            const minLat = (parseFloat(lat) - delta).toFixed(6);
            const maxLng = (parseFloat(lng) + delta).toFixed(6);
            const maxLat = (parseFloat(lat) + delta).toFixed(6);
            
            // Renderizar minimapa con la ubicación exacta
            mapaCard.innerHTML = `
                <div style="text-align:center;">
                    <div style="margin-bottom:8px;">
                        <i class="fas fa-check-circle" style="color:#10b981; font-size:1.5rem;"></i>
                        <p style="margin:4px 0 0; color:#10b981; font-weight:600; font-size:0.85rem;">Ubicación capturada</p>
                    </div>
                    <div style="border-radius:8px; overflow:hidden; border:2px solid #e2e8f0;">
                        <iframe 
                            width="100%" 
                            height="200" 
                            frameborder="0" 
                            style="border:0; display:block;" 
                            src="https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}" 
                            allowfullscreen>
                        </iframe>
                    </div>
                    <p style="margin:8px 0 0; font-size:0.72rem; color:#64748b;">
                        <i class="fas fa-map-marker-alt me-1"></i> ${lat}, ${lng}
                    </p>
                    <button type="button" onclick="activarGpsPlanta()" style="
                        margin-top:8px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;
                        padding:6px 16px; border-radius:6px; font-size:0.75rem; cursor:pointer;
                    ">
                        <i class="fas fa-sync-alt me-1"></i> Actualizar
                    </button>
                </div>
            `;
        },
        (error) => {
            console.warn('[GPS Planta]', error.message);
            let errorMsg = 'No se pudo obtener la ubicación.';
            
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = 'Permiso denegado. Activa la ubicación en tu navegador.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMsg = 'Ubicación no disponible. Verifica tu conexión.';
            } else if (error.code === error.TIMEOUT) {
                errorMsg = 'Tiempo de espera agotado. Intenta de nuevo.';
            }
            
            mapaCard.innerHTML = `
                <div style="text-align:center; padding:1rem;">
                    <i class="fas fa-exclamation-circle" style="font-size:2rem; color:#ef4444; margin-bottom:10px;"></i>
                    <p style="margin:0 0 12px; color:#ef4444; font-size:0.85rem; font-weight:600;">
                        ${errorMsg}
                    </p>
                    <button type="button" onclick="activarGpsPlanta()" style="
                        background:#3b82f6; color:#fff; border:none; padding:8px 20px;
                        border-radius:8px; font-size:0.8rem; cursor:pointer;
                    ">
                        <i class="fas fa-redo me-1"></i> Reintentar
                    </button>
                </div>
            `;
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
}

/**
 * Muestra u oculta el constructor de direcciones
 */
function mostrarConstructorDireccion() {
    const constructor = document.getElementById('constructorDireccion');
    const iconConstructor = document.getElementById('iconConstructor');
    const direccionInput = document.getElementById('direccionPlanta');
    
    if (!constructor) return;
    
    // Siempre mostrar el constructor cuando se hace clic
    constructor.style.display = 'block';
    if (iconConstructor) iconConstructor.style.display = 'none';
    
    // Si hay dirección existente, parsearla
    if (direccionInput && direccionInput.value) {
        parsearDireccion(direccionInput.value);
    }
}

/**
 * Confirma la dirección construida y oculta el constructor
 */
function confirmarDireccion() {
    const constructor = document.getElementById('constructorDireccion');
    const iconConstructor = document.getElementById('iconConstructor');
    const direccionInput = document.getElementById('direccionPlanta');
    
    // Validar que al menos tipo de vía y número principal estén llenos
    const tipoVia = document.getElementById('tipoVia');
    const numPrincipal = document.getElementById('numPrincipal');
    
    const tipoViaValue = tipoVia?.value || '';
    const numPrincipalValue = numPrincipal?.value.trim() || '';
    
    if (!tipoViaValue || !numPrincipalValue) {
        // Determinar cuál campo falta y hacer scroll
        const campoFaltante = !tipoViaValue ? tipoVia : numPrincipal;
        if (campoFaltante) {
            campoFaltante.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => campoFaltante.focus(), 300);
        }
        return;
    }
    
    // Construir dirección final
    construirDireccion();
    
    // Verificar que la dirección se haya construido
    if (!direccionInput || !direccionInput.value.trim()) {
        if (direccionInput) {
            direccionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => direccionInput.focus(), 300);
        }
        return;
    }
    
    // Ocultar constructor
    cerrarConstructor();
}

/**
 * Cancela la construcción de dirección y oculta el constructor
 */
function cancelarConstructor() {
    cerrarConstructor();
}

/**
 * Cierra el constructor de dirección (función auxiliar)
 */
function cerrarConstructor() {
    const constructor = document.getElementById('constructorDireccion');
    const iconConstructor = document.getElementById('iconConstructor');
    
    if (constructor) constructor.style.display = 'none';
    if (iconConstructor) iconConstructor.style.display = 'block';
}

/**
 * Cierra el constructor automáticamente al cambiar de campo
 */
function cerrarConstructorAlCambiarCampo() {
    const constructor = document.getElementById('constructorDireccion');
    if (constructor && constructor.style.display === 'block') {
        // Construir dirección con lo que haya antes de cerrar
        construirDireccion();
        cerrarConstructor();
    }
}

/**
 * Construye la dirección colombiana automáticamente a partir de los campos del constructor
 */
function construirDireccion() {
    const tipoVia = document.getElementById('tipoVia')?.value || '';
    const numPrincipal = document.getElementById('numPrincipal')?.value.trim() || '';
    const letraVia = document.getElementById('letraVia')?.value || '';
    const bisVia = document.getElementById('bisVia')?.value || '';
    const sectorVia = document.getElementById('sectorVia')?.value || '';
    const numCruce = document.getElementById('numCruce')?.value.trim() || '';
    const letraCruce = document.getElementById('letraCruce')?.value || '';
    const bisCruce = document.getElementById('bisCruce')?.value || '';
    const sectorCruce = document.getElementById('sectorCruce')?.value || '';
    const numPlaca = document.getElementById('numPlaca')?.value.trim() || '';
    const sectorPlaca = document.getElementById('sectorPlaca')?.value || '';
    const tipoComplemento = document.getElementById('tipoComplemento')?.value || '';
    const complemento = document.getElementById('complementoDireccion')?.value.trim() || '';
    const direccionPlanta = document.getElementById('direccionPlanta');
    
    if (!direccionPlanta) return;
    
    // Si no hay tipo de vía ni número principal, dejar vacío
    if (!tipoVia || !numPrincipal) {
        direccionPlanta.value = '';
        return;
    }
    
    // Construir la dirección paso a paso
    let direccion = tipoVia + ' ' + numPrincipal;
    
    // Agregar letra de vía si existe
    if (letraVia) {
        direccion += ' ' + letraVia;
    }
    
    // Agregar BIS si está seleccionado
    if (bisVia) {
        direccion += ' ' + bisVia;
    }
    
    // Agregar sector de vía si existe
    if (sectorVia) {
        direccion += ' ' + sectorVia;
    }
    
    // Agregar número de cruce si existe
    if (numCruce) {
        direccion += ' # ' + numCruce;
        
        // Agregar letra de cruce si existe
        if (letraCruce) {
            direccion += ' ' + letraCruce;
        }
        
        // Agregar BIS de cruce si está seleccionado
        if (bisCruce) {
            direccion += ' ' + bisCruce;
        }
        
        // Agregar sector de cruce si existe
        if (sectorCruce) {
            direccion += ' ' + sectorCruce;
        }
    }
    
    // Agregar número de placa si existe
    if (numPlaca) {
        direccion += ' - ' + numPlaca;
        
        // Agregar sector de placa si existe
        if (sectorPlaca) {
            direccion += ' ' + sectorPlaca;
        }
    }
    
    // Agregar información adicional si existe
    if (tipoComplemento) {
        direccion += ' ' + tipoComplemento;
        if (complemento) {
            direccion += ' ' + complemento;
        }
    } else if (complemento) {
        // Si solo hay complemento sin tipo
        direccion += ' ' + complemento;
    }
    
    direccionPlanta.value = direccion;
}

/**
 * Parsea una dirección colombiana existente y llena los campos del constructor
 * Ejemplos: "CR 27 A BIS NORTE # 105 - 108 AP 201", "CL 26 # 7 - 21 B/ Jorge Isaacs"
 */
function parsearDireccion(direccion) {
    if (!direccion) return;
    
    // Limpiar campos del constructor
    const tipoVia = document.getElementById('tipoVia');
    const numPrincipal = document.getElementById('numPrincipal');
    const letraVia = document.getElementById('letraVia');
    const bisVia = document.getElementById('bisVia');
    const sectorVia = document.getElementById('sectorVia');
    const numCruce = document.getElementById('numCruce');
    const letraCruce = document.getElementById('letraCruce');
    const bisCruce = document.getElementById('bisCruce');
    const sectorCruce = document.getElementById('sectorCruce');
    const numPlaca = document.getElementById('numPlaca');
    const sectorPlaca = document.getElementById('sectorPlaca');
    const tipoComplemento = document.getElementById('tipoComplemento');
    const complemento = document.getElementById('complementoDireccion');
    
    if (!tipoVia) return;
    
    // Normalizar dirección: convertir a mayúsculas y limpiar espacios múltiples
    let dir = direccion.toUpperCase().replace(/\s+/g, ' ').trim();
    
    // Regex para parsear dirección colombiana completa
    // Formato: TIPO NUM [LETRA] [BIS] [SECTOR] # NUM [LETRA] [BIS] [SECTOR] - NUM [SECTOR] [TIPO_COMPLEMENTO] [COMPLEMENTO]
    const regex = /^(CL|CR|DG|TV|AV|CIR|AC|AK|CALLE|CARRERA|DIAGONAL|TRANSVERSAL|AVENIDA|AUTOPISTA)\s+(\d+)\s*([A-Z])?\s*(BIS)?\s*(NORTE|SUR|ESTE|OESTE)?\s*(?:#\s*(\d+)\s*([A-Z])?\s*(BIS)?\s*(NORTE|SUR|ESTE|OESTE)?)?\s*(?:-\s*(\d+)\s*(NORTE|SUR|ESTE|OESTE)?)?\s*(.*)$/;
    
    const match = dir.match(regex);
    
    if (match) {
        // Tipo de vía (normalizar a abreviatura)
        let tipo = match[1];
        if (tipo === 'CALLE') tipo = 'CL';
        else if (tipo === 'CARRERA') tipo = 'CR';
        else if (tipo === 'DIAGONAL') tipo = 'DG';
        else if (tipo === 'TRANSVERSAL') tipo = 'TV';
        else if (tipo === 'AVENIDA') tipo = 'AV';
        tipoVia.value = tipo;
        
        // Número principal
        if (match[2]) numPrincipal.value = match[2];
        
        // Letra de vía
        if (match[3]) letraVia.value = match[3];
        
        // BIS de vía
        if (match[4]) bisVia.value = 'BIS';
        
        // Sector de vía
        if (match[5]) sectorVia.value = match[5];
        
        // Número de cruce
        if (match[6]) numCruce.value = match[6];
        
        // Letra de cruce
        if (match[7]) letraCruce.value = match[7];
        
        // BIS de cruce
        if (match[8]) bisCruce.value = 'BIS';
        
        // Sector de cruce
        if (match[9]) sectorCruce.value = match[9];
        
        // Número de placa
        if (match[10]) numPlaca.value = match[10];
        
        // Sector de placa
        if (match[11]) sectorPlaca.value = match[11];
        
        // Complemento (parsear tipo y valor)
        if (match[12]) {
            const comp = match[12].trim();
            // Buscar tipos de complemento conocidos
            const tiposComplemento = ['APARTAMENTO', 'BLOQUE', 'BODEGA', 'CASA', 'CONJUNTO', 'EDIFICIO', 'ESQUINA', 'ETAPA', 'INTERIOR', 'LOCAL', 'LOTE', 'MANZANA', 'PISO', 'PLANTA', 'TORRE', 'UNIDAD', 'UNIDAD RESIDENCIAL'];
            const tiposAbreviados = { 'AP': 'APARTAMENTO', 'BL': 'BLOQUE', 'BD': 'BODEGA', 'CS': 'CASA', 'CJ': 'CONJUNTO', 'ED': 'EDIFICIO', 'IN': 'INTERIOR', 'LC': 'LOCAL', 'LT': 'LOTE', 'MZ': 'MANZANA', 'PS': 'PISO', 'PL': 'PLANTA', 'TR': 'TORRE', 'UN': 'UNIDAD' };
            
            let tipoEncontrado = false;
            for (const tipo of tiposComplemento) {
                if (comp.startsWith(tipo)) {
                    tipoComplemento.value = tipo;
                    complemento.value = comp.substring(tipo.length).trim();
                    tipoEncontrado = true;
                    break;
                }
            }
            
            // Buscar abreviaturas
            if (!tipoEncontrado) {
                for (const [abrev, tipo] of Object.entries(tiposAbreviados)) {
                    if (comp.startsWith(abrev + ' ') || comp === abrev) {
                        tipoComplemento.value = tipo;
                        complemento.value = comp.substring(abrev.length).trim();
                        tipoEncontrado = true;
                        break;
                    }
                }
            }
            
            // Si no se encontró tipo, poner todo en complemento
            if (!tipoEncontrado) {
                complemento.value = comp;
            }
        }
    } else {
        // Parseo simple: solo extraer tipo de vía y número principal
        const simpleRegex = /^(CL|CR|DG|TV|AV|CIR|AC|AK|CALLE|CARRERA|DIAGONAL|TRANSVERSAL|AVENIDA|AUTOPISTA)\s+(\d+)/;
        const simpleMatch = dir.match(simpleRegex);
        
        if (simpleMatch) {
            let tipo = simpleMatch[1];
            if (tipo === 'CALLE') tipo = 'CL';
            else if (tipo === 'CARRERA') tipo = 'CR';
            else if (tipo === 'DIAGONAL') tipo = 'DG';
            else if (tipo === 'TRANSVERSAL') tipo = 'TV';
            else if (tipo === 'AVENIDA') tipo = 'AV';
            tipoVia.value = tipo;
            numPrincipal.value = simpleMatch[2];
            // Poner el resto en complemento
            const resto = dir.replace(simpleRegex, '').trim();
            if (resto) complemento.value = resto;
        } else {
            // Si no se puede parsear, poner toda la dirección en complemento
            complemento.value = direccion;
        }
    }
    
    // Reconstruir la dirección para asegurar consistencia
    construirDireccion();
}

// Exponer funciones globalmente
window.respuestaUbicacionTaller = respuestaUbicacionTaller;
window.activarGpsPlanta = activarGpsPlanta;
window.construirDireccion = construirDireccion;
window.parsearDireccion = parsearDireccion;
window.mostrarConstructorDireccion = mostrarConstructorDireccion;
window.confirmarDireccion = confirmarDireccion;
window.cancelarConstructor = cancelarConstructor;
window.handleActualizarDatosSubmit = handleActualizarDatosSubmit;
window.cerrarConstructorAlCambiarCampo = cerrarConstructorAlCambiarCampo;

// Agregar listeners para cerrar el constructor al cambiar de campo
document.addEventListener('DOMContentLoaded', function() {
    // Lista de campos que al recibir focus deben cerrar el constructor
    const camposFormulario = [
        'cedulaPlanta',
        'nombrePlanta',
        'paisPlanta',
        'departamentoPlanta',
        'ciudadPlanta',
        'barrioPlanta',
        'comunaPlanta',
        'contactoPlanta',
        'telefonoPlanta',
        'emailPlanta',
        'nuevaPassword',
        'confirmarPassword',
        'checkPoliticaDatos',
        'checkNotificaciones'
    ];
    
    camposFormulario.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('focus', cerrarConstructorAlCambiarCampo);
            // También agregar listener para click en checkboxes
            if (campo.type === 'checkbox') {
                campo.addEventListener('click', cerrarConstructorAlCambiarCampo);
            }
        }
    });
    
    // Agregar listener al botón de submit para cerrar el constructor antes de validar
    const form = document.getElementById('gestionPlantaForm');
    if (form) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.addEventListener('click', function() {
                const constructor = document.getElementById('constructorDireccion');
                if (constructor && constructor.style.display === 'block') {
                    console.log('[Submit Button] Constructor abierto, cerrando automáticamente...');
                    construirDireccion(); // Construir dirección con lo que haya
                    cerrarConstructor(); // Cerrar el constructor
                }
            });
        }
    }
});

/**
 * Maneja el envío del formulario de Actualizar Datos de Planta.
 */
async function handleActualizarDatosSubmit(e) {
    console.log('[handleActualizarDatosSubmit] ===== INICIO =====');
    console.log('[handleActualizarDatosSubmit] Evento recibido:', e);
    console.log('[handleActualizarDatosSubmit] Tipo de evento:', e.type);
    console.log('[handleActualizarDatosSubmit] Target:', e.target);
    
    e.preventDefault();
    console.log('[handleActualizarDatosSubmit] preventDefault ejecutado');
    
    // Verificar que sendToSupabase existe
    if (typeof sendToSupabase === 'undefined') {
        console.error('[handleActualizarDatosSubmit] ERROR: sendToSupabase no está definida');
        alert('Error: La función sendToSupabase no está disponible. Recarga la página.');
        return;
    }
    console.log('[handleActualizarDatosSubmit] sendToSupabase está disponible:', typeof sendToSupabase);

    // NUEVO: Cerrar el constructor automáticamente si está abierto
    const constructor = document.getElementById('constructorDireccion');
    if (constructor && constructor.style.display === 'block') {
        console.log('[handleActualizarDatosSubmit] Constructor abierto, cerrando automáticamente...');
        construirDireccion(); // Construir dirección con lo que haya
        cerrarConstructor(); // Cerrar el constructor
    }
    
    // Validar checkboxes obligatorios
    console.log('[handleActualizarDatosSubmit] Validando checkboxes...');
    const checkPolitica = document.getElementById('checkPoliticaDatos');
    const checkNotif = document.getElementById('checkNotificaciones');
    
    console.log('[handleActualizarDatosSubmit] Checkboxes:', {
        politica: checkPolitica?.checked,
        notificaciones: checkNotif?.checked
    });
    
    if (!checkPolitica || !checkPolitica.checked) {
        console.log('[handleActualizarDatosSubmit] Checkbox de política no marcado');
        Swal.fire({
            icon: 'warning',
            title: 'Política de datos',
            text: 'Debes aceptar la política de tratamiento de datos personales para continuar.',
            confirmButtonColor: '#3F51B5',
            confirmButtonText: 'Entendido'
        });
        checkPolitica?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    if (!checkNotif || !checkNotif.checked) {
        console.log('[handleActualizarDatosSubmit] Checkbox de notificaciones no marcado');
        Swal.fire({
            icon: 'warning',
            title: 'Notificaciones',
            text: 'Debes aceptar recibir notificaciones operativas del sistema para continuar.',
            confirmButtonColor: '#3F51B5',
            confirmButtonText: 'Entendido'
        });
        checkNotif?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    console.log('[handleActualizarDatosSubmit] Buscando botón submit...');
    const btn = e.target.querySelector('button[type="submit"]');
    console.log('[handleActualizarDatosSubmit] Botón encontrado:', btn);
    
    console.log('[handleActualizarDatosSubmit] Buscando campos del formulario...');
    const inputTel = document.getElementById('telefonoPlanta');
    const inputCed = document.getElementById('cedulaPlanta');
    console.log('[handleActualizarDatosSubmit] Campos encontrados:', { inputTel, inputCed });

    if (!inputTel || !inputCed) {
        console.error('[handleActualizarDatosSubmit] ERROR: Campos no encontrados:', { inputTel, inputCed });
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron encontrar todos los campos del formulario. Recarga la página e intenta de nuevo.',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const rawTelefono  = inputTel.value.replace(/\D/g, '');
    const rawCedula    = inputCed.value.replace(/\D/g, '');
    const nombrePlanta = document.getElementById('nombrePlanta').value;
    const direccion    = document.getElementById('direccionPlanta').value;
    const emailPlanta  = document.getElementById('emailPlanta').value;

    console.log('[handleActualizarDatosSubmit] Datos capturados:', {
        rawTelefono,
        rawCedula,
        nombrePlanta,
        direccion,
        emailPlanta
    });

    // Nuevos campos de ubicación
    const pais         = document.getElementById('paisPlanta')?.value || 'Colombia';
    const departamento = document.getElementById('departamentoPlanta')?.value || '';
    const ciudad       = document.getElementById('ciudadPlanta')?.value || '';
    
    // Capturar barrio: siempre del campo #barrioPlanta (sea select o input)
    const barrioField = document.getElementById('barrioPlanta');
    const barrio = barrioField?.value.trim() || '';
    
    console.log('[handleActualizarDatosSubmit] Captura de barrio:', {
        barrioFieldExists: !!barrioField,
        barrioFieldType: barrioField?.tagName,
        barrioFieldValue: barrioField?.value,
        barrioTrimmed: barrio,
        barrioLength: barrio.length
    });
    
    // Validar que el barrio no esté vacío
    if (!barrio) {
        console.error('[handleActualizarDatosSubmit] Barrio vacío');
        Swal.fire({
            icon: 'warning',
            title: 'Barrio requerido',
            text: 'Por favor ingresa o selecciona el barrio.',
            confirmButtonColor: '#3F51B5',
            confirmButtonText: 'Entendido'
        });
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Datos';
        const barrioContainer = document.getElementById('barrioContainer');
        if (barrioContainer) barrioContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (barrioField) barrioField.focus();
        return;
    }
    
    const comuna       = document.getElementById('comunaPlanta')?.value.trim() || '';
    const contacto     = document.getElementById('contactoPlanta')?.value.trim() || '';
    const localizacion = document.getElementById('localizacionPlanta')?.value.trim() || '';
    
    console.log('[handleActualizarDatosSubmit] Otros campos:', {
        comuna,
        contacto,
        localizacion
    });
    
    // Capturar preferencias de consentimiento
    const aceptaNotificaciones = document.getElementById('checkNotificaciones')?.checked || false;
    const aceptaPoliticaDatos = document.getElementById('checkPoliticaDatos')?.checked || false;

    // Capturar y validar contraseña (opcional)
    const nuevaPassword = document.getElementById('nuevaPassword')?.value.trim() || '';
    const confirmarPassword = document.getElementById('confirmarPassword')?.value.trim() || '';
    
    // Si se ingresó una nueva contraseña, validarla
    if (nuevaPassword || confirmarPassword) {
        // VALIDACIÓN OBLIGATORIA: Las contraseñas deben coincidir
        if (nuevaPassword !== confirmarPassword) {
            console.log('[handleActualizarDatosSubmit] Las contraseñas no coinciden');
            Swal.fire({
                icon: 'error',
                title: 'Las contraseñas no coinciden',
                text: 'La nueva contraseña y su confirmación deben ser iguales.',
                confirmButtonColor: '#3F51B5',
                confirmButtonText: 'Entendido'
            });
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Datos';
            document.getElementById('confirmarPassword')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        
        // VALIDACIÓN INFORMATIVA: Advertir si la contraseña es muy débil (pero permitir guardar)
        if (nuevaPassword.length < 6) {
            const confirmar = await Swal.fire({
                icon: 'warning',
                title: 'Contraseña muy corta',
                text: 'La contraseña tiene menos de 6 caracteres. Se recomienda usar al menos 8 caracteres para mayor seguridad. ¿Deseas continuar de todos modos?',
                showCancelButton: true,
                confirmButtonColor: '#3F51B5',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'No, cambiarla'
            });
            
            if (!confirmar.isConfirmed) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Guardar Datos';
                document.getElementById('nuevaPassword')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }
    }

    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    console.log('[handleActualizarDatosSubmit] Iniciando guardado...');

    // 1. Actualizar localStorage ANTES de esperar al GAS — la UI se desbloquea al instante
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.ROL === 'GUEST') {
        currentUser.EMAIL        = emailPlanta;
        currentUser.TELEFONO     = rawTelefono;
        currentUser.DIRECCION    = direccion;
        currentUser.DEPARTAMENTO = departamento;
        currentUser.CIUDAD       = ciudad;
        currentUser.BARRIO       = barrio;
        localStorage.setItem('sispro_user', JSON.stringify(currentUser));
    }

    const nuevaPlanta = { 
        ID_PLANTA: rawCedula, 
        PLANTA: nombrePlanta, 
        DIRECCION: direccion, 
        TELEFONO: rawTelefono, 
        EMAIL: emailPlanta,
        PAIS: pais,
        DEPARTAMENTO: departamento,
        CIUDAD: ciudad,
        BARRIO: barrio,
        COMUNA: comuna,
        CONTACTO: contacto,
        LOCALIZACION: localizacion,
        NOTIFICACIONES: aceptaNotificaciones,
        ACEPTA_POLITICA_DATOS: aceptaPoliticaDatos
    };
    // Actualizar currentPlantas si está disponible (solo en index.html)
    if (typeof currentPlantas !== 'undefined' && Array.isArray(currentPlantas)) {
        const idx = currentPlantas.findIndex(p => p.PLANTA === nombrePlanta);
        if (idx !== -1) currentPlantas[idx] = nuevaPlanta;
        else currentPlantas.push(nuevaPlanta);
    }

    // 2. Sincronizar con Supabase ANTES de mostrar éxito
    const payload = {
        accion: 'ACTUALIZAR_PLANTA',
        id: rawCedula,
        nombrePlanta: nombrePlanta,
        direccion: direccion,
        telefono: rawTelefono,
        email: emailPlanta,
        pais: pais,
        departamento: departamento,
        ciudad: ciudad,
        barrio: barrio,
        comuna: comuna,
        contacto: contacto,
        localizacion: localizacion,
        notificaciones: aceptaNotificaciones,
        aceptaPoliticaDatos: aceptaPoliticaDatos
    };
    
    // Agregar contraseña solo si se ingresó una nueva
    if (nuevaPassword) {
        payload.password = nuevaPassword;
    }
    
    console.log('[handleActualizarDatosSubmit] Payload a enviar:', payload);
    
    try {
        const result = await sendToSupabase(payload);
        console.log('[handleActualizarDatosSubmit] Respuesta de Supabase:', result);
        
        if (!result || !result.success) {
            throw new Error(result?.message || 'Error al guardar en la base de datos');
        }
        
        // 3. Mostrar éxito y redirigir a index.html
        Swal.fire({
            title: '¡Datos guardados!',
            text: 'Tu información ha sido registrada correctamente.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
        });

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (err) {
        console.error('[handleActualizarDatosSubmit] Error al guardar:', err);
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Datos';
        
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: 'Hubo un problema al guardar los datos. Por favor intenta de nuevo.',
            confirmButtonText: 'Entendido'
        });
    }
}
