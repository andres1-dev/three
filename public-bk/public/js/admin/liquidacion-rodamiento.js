/* ==========================================================================
   liquidacion-rodamiento.js — Liquidación de Rodamiento
   - Genera liquidación basada en reportes y aprobaciones
   - Dos periodos por mes: 1-15 y 16-último día
   - Líneas especiales: HACEMOS MODA y ANGELES ($30,000 quincenal)
   - Resto de líneas: UNIVERSO ($700,000 mensual)
   ========================================================================== */

let liqReportes = [];
let liqAprobaciones = [];
let liqPlantas = [];
let liqProductoras = [];
let liqUsuarios = [];

// Configuración
const LIQ_CONFIG = {
    VALOR_VISITA_UNIVERSO: 10,
    VALOR_QUINCENA_HACEMOS_MODA: 30000,
    VALOR_QUINCENA_ANGELES: 30000,
    TOTAL_UNIVERSO: 700000,
    LINEAS_ESPECIALES: ['HACEMOS MODA', 'ANGELES'],
    LINEAS_UNIVERSO: ['MODA FRESCA', 'BASICO', 'URBANO']
};

/**
 * Inicialización del módulo
 */
async function initLiquidacionRodamiento() {
    try {
        // Verificar si viene del módulo admin
        const urlParams = new URLSearchParams(window.location.search);
        const esAdmin = urlParams.get('admin') === 'true';

        // Cargar datos
        await cargarDatos();

        // Inyectar modal si no existe
        if (!document.getElementById('liqModal')) {
            const modalDiv = document.createElement('div');
            modalDiv.id = 'liqModal';
            modalDiv.style.cssText = 'display: none; position: fixed; z-index: 1050; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5); align-items: center; justify-content: center; box-sizing: border-box;';
            modalDiv.innerHTML = `
                <div style="background-color: #fefefe; margin: auto; padding: 20px; border: 1px solid #888; width: 95%; max-width: 600px; border-radius: 12px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.15); box-sizing: border-box;">
                    <span onclick="cerrarLiqModal()" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; position: absolute; right: 15px; top: 5px;">&times;</span>
                    <h3 id="liqModalTitle" style="margin-top: 0; margin-bottom: 15px; font-size: 1.25rem; font-weight: 700; color: var(--color-primary);">Título</h3>
                    <div id="liqModalBody" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; width: 100%; box-sizing: border-box;">
                        <!-- Contenido -->
                    </div>
                </div>
            `;
            document.body.appendChild(modalDiv);
        }

        // Establecer fecha actual en selectores
        const hoy = new Date();
        document.getElementById('mesSelector').value = hoy.getMonth();
        document.getElementById('anioSelector').value = hoy.getFullYear();

        // Determinar quincena actual
        const dia = hoy.getDate();
        document.getElementById('quincenaSelector').value = dia <= 15 ? '1' : '2';

        // Inicializar Flatpickr para descuentos
        if (typeof flatpickr !== 'undefined') {
            flatpickr("#descuentosInput", {
                mode: "multiple",
                locale: "es",
                dateFormat: "Y-m-d",
                placeholder: "Descontar días..."
            });
        }

        // Si viene del admin, cargar liquidación preseleccionada
        if (esAdmin) {
            await cargarLiquidacionDesdeAdmin();
        }

    } catch (error) {
        console.error('Error al inicializar liquidación:', error);
    }
}

/**
 * Carga los datos necesarios
 */
async function cargarDatos() {
    try {
        // Cargar reportes
        if (typeof fetchReportesData === 'function') {
            liqReportes = await fetchReportesData();
        }

        // Cargar aprobaciones
        if (typeof fetchAprobacionesData === 'function') {
            liqAprobaciones = await fetchAprobacionesData();
        }

        // Cargar plantas
        if (typeof fetchPlantasData === 'function') {
            liqPlantas = await fetchPlantasData();
        }

        // Cargar productoras
        if (typeof fetchProductoras === 'function') {
            liqProductoras = await fetchProductoras();
        }

        // Cargar usuarios para obtener el nombre real de las auditoras
        if (typeof fetchUsuariosData === 'function') {
            liqUsuarios = await fetchUsuariosData();
        }

    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

/**
 * Carga liquidación desde el módulo admin
 */
async function cargarLiquidacionDesdeAdmin() {
    try {
        // Leer parámetros de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        const admin = urlParams.get('admin');

        if (!id || admin !== 'true') {
            console.log('No es modo admin o no hay ID');
            return;
        }

        console.log('Cargando liquidación desde admin con ID:', id);

        // Buscar liquidación en Supabase usando el ID
        const sb = getSupabaseClient();
        if (!sb) {
            console.error('Supabase client no disponible');
            return;
        }

        const { data: liquidacion, error } = await sb
            .from('liquidaciones_rodamiento')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error al buscar liquidación:', error);
            alert('Error al cargar la liquidación desde Supabase');
            return;
        }

        if (!liquidacion) {
            console.error('No se encontró liquidación con ID:', id);
            alert('No se encontró la liquidación');
            return;
        }

        console.log('Liquidación encontrada:', liquidacion);

        const { correo, periodo, descuentos } = liquidacion;

        console.log('Datos de liquidación:', { correo, periodo, descuentos });
        console.log('Reportes antes de filtro:', liqReportes.length, liqAprobaciones.length);
        console.log('Muestra de reportes:', liqReportes.slice(0, 3));
        console.log('Muestra de aprobaciones:', liqAprobaciones.slice(0, 3));
        
        // Mostrar las claves del primer reporte para ver qué campos existen
        if (liqReportes.length > 0) {
            console.log('Claves del primer reporte:', Object.keys(liqReportes[0]));
            console.log('Primer reporte completo:', liqReportes[0]);
            console.log('Todas las claves disponibles:', Object.keys(liqReportes[0]).join(', '));
            console.log('Valor del campo EMAIL en el primer reporte:', liqReportes[0].EMAIL);
        }

        // Parsear periodo para obtener mes, año, quincena
        // Formato esperado: "DEL 1 DE JUNIO DEL 2026 AL 15 DE JUNIO DEL 2026"
        const mesMatch = periodo.match(/DE (\w+) DEL (\d{4})/);
        if (!mesMatch) {
            console.error('No se pudo parsear el periodo:', periodo);
            return;
        }

        const mesNombre = mesMatch[1].toUpperCase();
        const anio = parseInt(mesMatch[2]);

        // Mapeo de nombres de mes a números
        const meses = {
            'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
            'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
            'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
        };

        const mes = meses[mesNombre];
        if (mes === undefined) {
            console.error('Mes no reconocido:', mesNombre);
            return;
        }

        // Determinar quincena (1-15 o 16-último)
        const quincena = periodo.includes('AL 15 DE') ? 1 : 2;

        // Establecer selectores
        document.getElementById('mesSelector').value = mes;
        document.getElementById('anioSelector').value = anio;
        document.getElementById('quincenaSelector').value = quincena;

        // Establecer descuentos si existen
        if (descuentos) {
            const descuentosInput = document.getElementById('descuentosInput');
            if (descuentosInput) {
                descuentosInput.value = descuentos;
            }
        }

        // Filtrar reportes por correo del auditor seleccionado
        liqReportes = liqReportes.filter(r => r.email === correo || r.EMAIL === correo);
        liqAprobaciones = liqAprobaciones.filter(r => r.email === correo || r.EMAIL === correo);

        console.log('Reportes filtrados por correo:', liqReportes.length, liqAprobaciones.length);

        // Generar liquidación automáticamente
        await generarLiquidacion();

        // Guardar ID en el container para uso posterior
        const container = document.getElementById('liquidacionContainer');
        if (container) {
            container.dataset.liquidacionId = id;
        }

    } catch (error) {
        console.error('Error al cargar liquidación desde admin:', error);
    }
}

/**
 * Genera la liquidación para el periodo seleccionado
 */
async function generarLiquidacion() {
    const mes = parseInt(document.getElementById('mesSelector').value);
    const anio = parseInt(document.getElementById('anioSelector').value);
    const quincena = parseInt(document.getElementById('quincenaSelector').value);

    // Calcular rango de fechas
    const fechaInicio = quincena === 1 ? new Date(anio, mes, 1) : new Date(anio, mes, 16);
    const fechaFin = quincena === 1 ? new Date(anio, mes, 15) : new Date(anio, mes + 1, 0);

    // Filtrar reportes del periodo
    const reportesPeriodo = filtrarReportesPorPeriodo(liqReportes, fechaInicio, fechaFin);
    const aprobacionesPeriodo = filtrarReportesPorPeriodo(liqAprobaciones, fechaInicio, fechaFin);

    // Combinar reportes y aprobaciones
    const todosRegistros = [...reportesPeriodo, ...aprobacionesPeriodo];

    // Contar días a descontar
    const diasDescontarStr = document.getElementById('descuentosInput') ? document.getElementById('descuentosInput').value : '';
    const fechasDescontadas = diasDescontarStr ? diasDescontarStr.split(',').map(d => d.trim()).filter(d => d !== '') : [];
    const diasDescontados = fechasDescontadas.length;

    // Generar liquidación
    const liquidacion = procesarLiquidacion(todosRegistros, fechaInicio, fechaFin, diasDescontados);

    // Renderizar
    renderizarLiquidacion(liquidacion, fechaInicio, fechaFin, fechasDescontadas);
}

/**
 * Envía la liquidación a Supabase (botón Enviar)
 */
async function enviarLiquidacion() {
    const container = document.getElementById('liquidacionContainer');
    if (!container || container.innerHTML.includes('Selecciona el periodo')) {
        alert('Primero genera una liquidación antes de enviar.');
        return;
    }

    await guardarLiquidacionGenerada();
}

/**
 * Guarda la liquidación generada en Supabase (solo metadatos)
 */
async function guardarLiquidacionGenerada() {
    const container = document.getElementById('liquidacionContainer');
    if (!container) {
        console.error('Container no encontrado');
        return;
    }

    const headerInfo = container.querySelector('div[style*="margin-bottom"]');
    let cc = '', correo = '', periodo = '';
    
    if (headerInfo) {
        const paragraphs = headerInfo.querySelectorAll('p');
        paragraphs.forEach(p => {
            const text = p.textContent || p.innerText;
            if (text.includes('CC:')) cc = text.replace('CC:', '').trim();
            if (text.includes('AUDITORA:')) correo = text.replace('AUDITORA:', '').trim();
            if (text.includes('PERIODO:')) periodo = text.replace('PERIODO:', '').trim();
        });
    }

    // Obtener correo electrónico de los reportes en lugar del header
    // El header tiene el nombre, pero necesitamos el correo para filtrar
    if (liqReportes.length > 0) {
        correo = liqReportes[0].EMAIL || liqReportes[0].email || correo;
        console.log('Correo obtenido de reportes:', correo);
    }

    // Obtener descuentos
    const descuentosInput = document.getElementById('descuentosInput');
    const descuentos = descuentosInput ? descuentosInput.value : '';

    // Generar ID descriptivo: CC-quincena-mes-año
    const mes = parseInt(document.getElementById('mesSelector').value);
    const anio = parseInt(document.getElementById('anioSelector').value);
    const quincena = parseInt(document.getElementById('quincenaSelector').value);
    
    const quincenaStr = quincena === 1 ? '1Q' : '2Q';
    const mesStr = String(mes + 1).padStart(2, '0');
    const liquidacionId = `${cc}-${quincenaStr}-${mesStr}-${anio}`;
    
    console.log('Guardando liquidación:', { liquidacionId, cc, correo, periodo, descuentos });
    
    // Guardar en Supabase (retorna ID existente o nuevo)
    const idGuardado = await guardarLiquidacionEnSupabase(liquidacionId, cc, correo, periodo, descuentos);
    
    if (idGuardado) {
        console.log('Liquidación guardada exitosamente:', idGuardado);
        // Guardar ID en el container para uso posterior (impresión)
        container.dataset.liquidacionId = idGuardado;
        alert('Liquidación guardada exitosamente.');
    } else {
        console.error('Error al guardar liquidación');
        alert('Error al guardar la liquidación. Revisa la consola para más detalles.');
    }
}

/**
 * Filtra reportes por periodo de fechas
 */
function filtrarReportesPorPeriodo(reportes, fechaInicio, fechaFin) {
    if (!reportes || reportes.length === 0) return [];

    return reportes.filter(rep => {
        const fechaRep = parsearFecha(rep.FECHA || rep.fecha);
        if (!fechaRep) return false;

        return fechaRep >= fechaInicio && fechaRep <= fechaFin;
    });
}

/**
 * Parsea una fecha string a Date
 */
function parsearFecha(fechaStr) {
    if (!fechaStr) return null;

    try {
        // Formato: DD/MM/YYYY o YYYY-MM-DD
        if (fechaStr.includes('/')) {
            const partes = fechaStr.split('/');
            return new Date(partes[2], partes[1] - 1, partes[0]);
        } else if (fechaStr.includes('-')) {
            return new Date(fechaStr);
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Procesa los datos para generar la liquidación
 */
function procesarLiquidacion(registros, fechaInicio, fechaFin, diasDescontados = 0) {
    const liquidacion = {
        lineas: {},
        totales: {
            visitas: 0,
            valor: 0
        }
    };

    // Agrupar por línea
    registros.forEach(rep => {
        const linea = obtenerLinea(rep);
        const planta = obtenerPlanta(rep);
        const fecha = parsearFecha(rep.FECHA || rep.fecha);
        const dia = fecha ? fecha.getDate() : null;

        if (!linea || !planta || !dia) return;

        if (!liquidacion.lineas[linea]) {
            liquidacion.lineas[linea] = {
                plantas: {},
                totales: {
                    visitas: 0,
                    valor: 0
                }
            };
        }

        if (!liquidacion.lineas[linea].plantas[planta]) {
            liquidacion.lineas[linea].plantas[planta] = {
                nombre: planta,
                visitasPorDia: {},
                totalVisitas: 0,
                valor: 0,
                localizacion: '',
                firmaSvg: ''
            };
        }

        // Registrar visita
        if (!liquidacion.lineas[linea].plantas[planta].visitasPorDia[dia]) {
            liquidacion.lineas[linea].plantas[planta].visitasPorDia[dia] = 0;
        }
        liquidacion.lineas[linea].plantas[planta].visitasPorDia[dia]++;
        liquidacion.lineas[linea].plantas[planta].totalVisitas++;

        // Registrar localización y firma (tomar el primero válido encontrado)
        const loc = rep.LOCALIZACION || rep.localizacion;
        const firma = rep.FIRMA_SVG || rep.firma_svg;
        if (loc && !liquidacion.lineas[linea].plantas[planta].localizacion) {
            liquidacion.lineas[linea].plantas[planta].localizacion = loc;
        }
        if (firma && !liquidacion.lineas[linea].plantas[planta].firmaSvg) {
            liquidacion.lineas[linea].plantas[planta].firmaSvg = firma;
        }
    });

    // Calcular total de visitas en líneas del Universo (no especiales) para el prorrateo de $350.000 quincenales (menos descuentos)
    let totalVisitasUniverso = 0;
    Object.keys(liquidacion.lineas).forEach(linea => {
        if (!LIQ_CONFIG.LINEAS_ESPECIALES.includes(linea)) {
            const lineaData = liquidacion.lineas[linea];
            totalVisitasUniverso += Object.values(lineaData.plantas).reduce((sum, p) => sum + p.totalVisitas, 0);
        }
    });

    // Descuento para Universo: 15 es el promedio de días de una quincena
    const descuentoUniverso = Math.round(diasDescontados * (350000 / 15));
    const totalUniversoQuincenal = Math.max(0, 350000 - descuentoUniverso);
    const valorVisitaUniverso = totalVisitasUniverso > 0 ? (totalUniversoQuincenal / totalVisitasUniverso) : 0;

    // Calcular valores por línea
    Object.keys(liquidacion.lineas).forEach(linea => {
        const lineaData = liquidacion.lineas[linea];
        const totalVisitasLinea = Object.values(lineaData.plantas).reduce((sum, p) => sum + p.totalVisitas, 0);
        lineaData.totales.visitas = totalVisitasLinea;

        if (LIQ_CONFIG.LINEAS_ESPECIALES.includes(linea)) {
            // Líneas especiales: valor fijo por quincena (menos descuentos si aplica)
            let valorQuincena = linea === 'HACEMOS MODA' ? LIQ_CONFIG.VALOR_QUINCENA_HACEMOS_MODA : LIQ_CONFIG.VALOR_QUINCENA_ANGELES;

            // Aplicar descuento de días a HACEMOS MODA (no a ANGELES)
            if (linea === 'HACEMOS MODA') {
                const descuentoHacemosModa = Math.round(diasDescontados * (LIQ_CONFIG.VALOR_QUINCENA_HACEMOS_MODA / 15));
                valorQuincena = Math.max(0, valorQuincena - descuentoHacemosModa);
            }

            if (totalVisitasLinea > 0) {
                lineaData.totales.valor = valorQuincena;
                Object.values(lineaData.plantas).forEach(planta => {
                    planta.valor = (valorQuincena / totalVisitasLinea) * planta.totalVisitas;
                });
            } else {
                lineaData.totales.valor = 0;
            }
        } else {
            // Líneas Universo: prorrateadas dinámicamente
            lineaData.totales.valor = totalVisitasLinea * valorVisitaUniverso;

            // Valor por planta
            Object.values(lineaData.plantas).forEach(planta => {
                planta.valor = planta.totalVisitas * valorVisitaUniverso;
            });
        }

        liquidacion.totales.valor += lineaData.totales.valor;
        liquidacion.totales.visitas += lineaData.totales.visitas;
    });

    return liquidacion;
}

/**
 * Obtiene la línea de un reporte
 */
function obtenerLinea(rep) {
    const l = rep.LINEA || rep.linea;
    if (l) return l.toUpperCase();

    const planta = rep.PLANTA || rep.planta || '';

    // Buscar en plantas para obtener la línea
    const plantaObj = liqPlantas.find(p =>
        (p.PLANTA || p.planta || '').toUpperCase() === planta.toUpperCase()
    );

    if (plantaObj && plantaObj.LINEA) {
        return plantaObj.LINEA.toUpperCase();
    }

    // Fallback: inferir de la planta
    if (planta.toUpperCase().includes('MODA FRESCA')) return 'MODA FRESCA';
    if (planta.toUpperCase().includes('BASICO')) return 'BASICO';
    if (planta.toUpperCase().includes('URBANO')) return 'URBANO';
    if (planta.toUpperCase().includes('HACEMOS MODA')) return 'HACEMOS MODA';
    if (planta.toUpperCase().includes('ANGELES')) return 'ANGELES';

    return 'OTRO';
}

/**
 * Obtiene el nombre de la planta/auditor
 */
function obtenerPlanta(rep) {
    return rep.PLANTA || rep.planta || 'N/A';
}

/**
 * Obtiene el nombre de la auditora
 */
function obtenerAuditora(registros) {
    if (registros.length === 0) return 'N/A';

    const primerRep = registros[0];
    const email = (primerRep.email || primerRep.EMAIL || primerRep.auditor || '').toLowerCase().trim();
    if (!email) return 'N/A';

    // Buscar en liqUsuarios por correo o email
    const userObj = liqUsuarios.find(u =>
        (u.CORREO || u.EMAIL || u.email || '').toLowerCase().trim() === email
    );

    if (userObj && userObj.NOMBRE) {
        return userObj.NOMBRE.toUpperCase();
    }

    return email.toUpperCase();
}

/**
 * Renderiza la liquidación en el DOM
 */
function renderizarLiquidacion(liquidacion, fechaInicio, fechaFin, fechasDescontadas = []) {
    const container = document.getElementById('liquidacionContainer');

    if (Object.keys(liquidacion.lineas).length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: #64748b; padding: 2rem;">
                No hay reportes para el periodo seleccionado.
            </p>
        `;
        return;
    }

    const auditora = obtenerAuditora([...liqReportes, ...liqAprobaciones]);
    const fechaInicioStr = formatFecha(fechaInicio);
    const fechaFinStr = formatFecha(fechaFin);

    let html = `
        <div style="margin-bottom: 2rem;">
            <p><strong>CC:</strong> 1107527794</p>
            <p><strong>AUDITORA:</strong> ${auditora.toUpperCase()}</p>
            <p><strong>PERIODO:</strong> DEL ${fechaInicioStr} AL ${fechaFinStr}</p>
        </div>
        
        <!-- Pestañas (Tabs) Navigation -->
        <div class="tabs-navigation" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; overflow-x: auto;">
            <button onclick="cambiarPestana('universo')" id="btn-tab-universo" style="border: none; background: transparent; padding: 0.5rem 1rem; font-weight: 600; color: var(--color-primary); border-bottom: 2px solid var(--color-primary); margin-bottom: -0.6rem; transition: all 0.2s; white-space: nowrap;">
                UNIVERSO ($350.000)
            </button>
            <button onclick="cambiarPestana('hacemos-moda')" id="btn-tab-hacemos-moda" style="border: none; background: transparent; padding: 0.5rem 1rem; font-weight: 600; color: #64748b; margin-bottom: -0.6rem; transition: all 0.2s; white-space: nowrap;">
                HACEMOS MODA ($30.000)
            </button>
            <button onclick="cambiarPestana('angeles')" id="btn-tab-angeles" style="border: none; background: transparent; padding: 0.5rem 1rem; font-weight: 600; color: #64748b; margin-bottom: -0.6rem; transition: all 0.2s; white-space: nowrap;">
                ANGELES ($30.000)
            </button>
        </div>
        
        <div class="tabs-content">
            <!-- PESTAÑA UNIVERSO -->
            <div id="tab-universo" class="liq-tab-content">
                ${renderizarGrupoTab(liquidacion, 'universo', fechaInicio, fechaFin, fechasDescontadas)}
            </div>
            
            <!-- PESTAÑA HACEMOS MODA -->
            <div id="tab-hacemos-moda" class="liq-tab-content" style="display: none;">
                ${renderizarGrupoTab(liquidacion, 'HACEMOS MODA', fechaInicio, fechaFin, fechasDescontadas)}
            </div>
            
            <!-- PESTAÑA ANGELES -->
            <div id="tab-angeles" class="liq-tab-content" style="display: none;">
                ${renderizarGrupoTab(liquidacion, 'ANGELES', fechaInicio, fechaFin, [])}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Renderiza las tablas correspondientes a una pestaña
 */
function renderizarGrupoTab(liquidacion, seccion, fechaInicio, fechaFin, fechasDescontadas = []) {
    let html = '';
    const lineasFiltradas = Object.keys(liquidacion.lineas).filter(linea => {
        if (seccion === 'universo') {
            return !LIQ_CONFIG.LINEAS_ESPECIALES.includes(linea);
        } else {
            return linea === seccion;
        }
    });

    if (lineasFiltradas.length === 0) {
        return `
            <p style="text-align: center; color: #94a3b8; padding: 3rem 2rem; border: 1px dashed #e2e8f0; border-radius: 12px; background: #f8fafc; margin: 1rem 0;">
                <i class="fas fa-info-circle" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: #cbd5e1;"></i>
                No hay visitas registradas para esta sección en el periodo seleccionado.
            </p>
        `;
    }

    const diasPeriodo = obtenerDiasPeriodo(fechaInicio, fechaFin);
    let totalVisitasSeccion = 0;

    lineasFiltradas.forEach(linea => {
        const lineaData = liquidacion.lineas[linea];
        totalVisitasSeccion += lineaData.totales.visitas;

        html += `
            <h3 style="margin: 1.8rem 0 1rem; color: var(--color-primary); font-size: 1.1rem; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                <i class="fas fa-route"></i> Línea: ${linea}
            </h3>
            <table class="liquidacion-table">
                <thead>
                    <tr>
                        <th>PLANTA</th>
                        <th>LÍNEA</th>
                        <th>LOCALIZACIÓN</th>
                        <th>FIRMA</th>
                        ${diasPeriodo.map(dia => `<th>${dia}</th>`).join('')}
                        <th># VISITAS</th>
                        <th>VALOR</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.values(lineaData.plantas).forEach(planta => {
            let lat = 0, lon = 0;
            const coords = planta.localizacion || '';
            if (coords.includes(',')) {
                const parts = coords.split(',');
                lat = parseFloat(parts[0].trim()) || 0;
                lon = parseFloat(parts[1].trim()) || 0;
            }

            html += `
                <tr>
                    <td class="planta-name">${planta.nombre}</td>
                    <td>${linea}</td>
                    <td>
                        ${coords ? `
                            <div onclick="verMapaGrande('${planta.nombre.replace(/'/g, "\\'")}', '${coords}')" class="coordenadas-link" title="Ver ubicación en Google Maps">
                                <i class="fas fa-map-marker-alt" style="color: #3b82f6; font-size: 1rem;"></i>
                                <span style="font-family: monospace; font-size: 0.8rem;">${coords}</span>
                            </div>
                        ` : '<span style="color: #94a3b8;">-</span>'}
                    </td>
                    <td style="padding: 0; vertical-align: middle;">
                        ${planta.firmaSvg ? `
                            <div onclick="verFirmaGrande('${planta.nombre.replace(/'/g, "\\'")}', '${encodeURIComponent(planta.firmaSvg)}')" class="firma-wrapper" title="Ver Firma Ampliada">
                                ${planta.firmaSvg}
                            </div>
                        ` : '<span style="color: #94a3b8;">-</span>'}
                    </td>
                    ${diasPeriodo.map(dia => {
                const visitas = planta.visitasPorDia[dia] || 0;
                return `<td class="${visitas > 0 ? 'visita-cell' : ''}">${visitas > 0 ? visitas : ''}</td>`;
            }).join('')}
                    <td class="fw-semibold">${planta.totalVisitas}</td>
                    <td class="fw-semibold">${formatValor(planta.valor)}</td>
                </tr>
            `;
        });

        html += `
            <tr class="total-row" style="background: #f8fafc; font-weight: 700;">
                <td class="planta-name" colspan="4">TOTAL</td>
                ${diasPeriodo.map(dia => {
            const totalDia = Object.values(lineaData.plantas).reduce((sum, p) => sum + (p.visitasPorDia[dia] || 0), 0);
            return `<td>${totalDia > 0 ? totalDia : ''}</td>`;
        }).join('')}
                <td>${lineaData.totales.visitas}</td>
                <td>${formatValor(lineaData.totales.valor)}</td>
            </tr>
        </tbody>
    </table>
        `;
    });

    // Resumen por sección / pestaña
    const totalValorSeccion = obtenerTotalSeccion(liquidacion, seccion);

    // Chips de fechas descontadas (solo para secciones con descuento)
    const mostrarDescuentos = fechasDescontadas.length > 0 && seccion !== 'ANGELES';
    let chipsHtml = '';
    if (mostrarDescuentos) {
        const chips = fechasDescontadas.map(f => {
            // Formatear fecha para display: YYYY-MM-DD → DD/MM
            const partes = f.split('-');
            const label = partes.length === 3 ? `${partes[2]}/${partes[1]}` : f;
            return `<span style="display:inline-flex;align-items:center;gap:4px;background:#e0e7ff;color:#3730a3;border-radius:999px;padding:2px 10px 2px 10px;font-size:0.78rem;font-weight:600;">
                ${label}
                <button onclick="quitarDescuento('${f}')" title="Quitar este día del descuento" style="background:none;border:none;cursor:pointer;color:#6366f1;font-size:1rem;line-height:1;padding:0 0 0 2px;display:flex;align-items:center;">×</button>
            </span>`;
        }).join(' ');
        chipsHtml = `
            <div style="margin-bottom:0.75rem;">
                <span style="font-size:0.8rem;color:#64748b;font-weight:600;display:block;margin-bottom:0.4rem;">DÍAS DESCONTADOS:</span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
            </div>
        `;
    }

    html += `
        <div class="liquidacion-summary" style="margin-top: 1.5rem; background: var(--glass-bg); padding: 1.25rem 1.5rem; border-radius: 8px; border-left: 4px solid var(--color-primary);">
            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.8rem; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.5px;">
                Resumen de Costeo - ${seccion === 'universo' ? 'UNIVERSO' : seccion}
            </h4>
            ${chipsHtml}
            <div class="summary-row" style="display: flex; justify-content: space-between; padding: 0.3rem 0; font-size: 0.9rem; border-bottom: 1px solid #e2e8f0;">
                <span>Total Visitas Sección:</span>
                <span style="font-weight: 600; color: #334155;">${totalVisitasSeccion}</span>
            </div>
            <div class="summary-row total" style="display: flex; justify-content: space-between; padding: 0.6rem 0 0; margin-top: 0.4rem; border-top: 1.5px solid var(--color-primary); font-size: 1.05rem; font-weight: 800; color: var(--color-primary);">
                <span>TOTAL A PAGAR SECCIÓN:</span>
                <span>${formatValor(totalValorSeccion)}</span>
            </div>
        </div>
    `;

    return html;
}


/**
 * Obtiene el total de una sección específica (universo o especiales)
 */
function obtenerTotalSeccion(liquidacion, seccion) {
    let total = 0;
    Object.keys(liquidacion.lineas).forEach(linea => {
        const matches = seccion === 'universo'
            ? !LIQ_CONFIG.LINEAS_ESPECIALES.includes(linea)
            : linea === seccion;

        if (matches) {
            total += liquidacion.lineas[linea].totales.valor;
        }
    });
    return total;
}

/**
 * Cambia la pestaña activa en el cliente
 */
window.cambiarPestana = function (pestanaId) {
    document.querySelectorAll('.liq-tab-content').forEach(el => el.style.display = 'none');

    const target = document.getElementById(`tab-${pestanaId}`);
    if (target) target.style.display = 'block';

    ['universo', 'hacemos-moda', 'angeles'].forEach(id => {
        const btn = document.getElementById(`btn-tab-${id}`);
        if (btn) {
            btn.style.color = '#64748b';
            btn.style.borderBottom = 'none';
        }
    });

    const activeBtn = document.getElementById(`btn-tab-${pestanaId}`);
    if (activeBtn) {
        activeBtn.style.color = 'var(--color-primary)';
        activeBtn.style.borderBottom = '2px solid var(--color-primary)';
    }
};

/**
 * Obtiene los días del periodo
 */
function obtenerDiasPeriodo(fechaInicio, fechaFin) {
    const dias = [];
    const fecha = new Date(fechaInicio);

    while (fecha <= fechaFin) {
        dias.push(fecha.getDate());
        fecha.setDate(fecha.getDate() + 1);
    }

    return dias;
}

/**
 * Formatea una fecha
 */
function formatFecha(fecha) {
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

    return `${fecha.getDate()} DE ${meses[fecha.getMonth()]} DEL ${fecha.getFullYear()}`;
}

/**
 * Formatea un valor monetario
 */
function formatValor(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
}

/**
 * Guarda liquidación en Supabase (solo metadatos, sin contenido HTML)
 */
async function guardarLiquidacionEnSupabase(liquidacionId, cc, correo, periodo, descuentos) {
    try {
        console.log('Intentando guardar en Supabase...');
        const sb = getSupabaseClient();
        if (!sb) {
            console.error('Supabase client no disponible');
            return false;
        }
        
        // Verificar si ya existe un registro con el mismo periodo y correo
        const { data: existente, error: errorBusqueda } = await sb
            .from('liquidaciones_rodamiento')
            .select('id')
            .eq('periodo', periodo)
            .eq('correo', correo)
            .single();
        
        if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
            console.error('Error al buscar liquidación existente:', errorBusqueda);
            return false;
        }
        
        if (existente) {
            // Actualizar registro existente (descuentos y fecha_generacion)
            console.log('Actualizando liquidación existente:', existente.id);
            const { data: dataUpdate, error: errorUpdate } = await sb
                .from('liquidaciones_rodamiento')
                .update({
                    descuentos: descuentos,
                    fecha_generacion: new Date().toISOString()
                })
                .eq('id', existente.id);
            
            if (errorUpdate) {
                console.error('Error al actualizar liquidación:', errorUpdate);
                return false;
            }
            
            console.log('Actualización exitosa:', dataUpdate);
            return existente.id;
        } else {
            // Insertar o actualizar registro (upsert) usando el ID
            console.log('Upsert liquidación con ID:', liquidacionId);
            const { data, error } = await sb
                .from('liquidaciones_rodamiento')
                .upsert({
                    id: liquidacionId,
                    cc: cc,
                    correo: correo,
                    periodo: periodo,
                    descuentos: descuentos,
                    fecha_generacion: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });
            
            if (error) {
                console.error('Error al guardar liquidación:', error);
                console.error('Detalles del error:', error.code, error.message, error.details, error.hint);
                return false;
            }
            
            console.log('Guardado exitoso (upsert):', data);
            return liquidacionId;
        }
    } catch (error) {
        console.error('Error al guardar liquidación:', error);
        return false;
    }
}

/**
 * Imprime la liquidación
 */
async function imprimirLiquidacion() {
    const container = document.getElementById('liquidacionContainer');
    const headerInfo = container.querySelector('div[style*="margin-bottom"]');
    const tabsContent = container.querySelectorAll('.liq-tab-content');
    
    // Usar el ID ya guardado en el dataset (generado al crear la liquidación)
    const liquidacionId = container.dataset.liquidacionId;
    
    if (!liquidacionId) {
        console.error('No hay ID de liquidación para imprimir');
        alert('Error: No hay ID de liquidación. Por favor guarda la liquidación primero.');
        return;
    }
    
    // Extraer información del header
    let headerHtml = '';
    let cc = '', auditora = '', periodo = '';
    if (headerInfo) {
        const paragraphs = headerInfo.querySelectorAll('p');
        
        paragraphs.forEach(p => {
            const text = p.textContent || p.innerText;
            if (text.includes('CC:')) cc = text.replace('CC:', '').trim();
            if (text.includes('AUDITORA:')) auditora = text.replace('AUDITORA:', '').trim();
            if (text.includes('PERIODO:')) periodo = text.replace('PERIODO:', '').trim();
        });
        
        headerHtml = `
            <p><strong>CC</strong>${cc}</p>
            <p><strong>AUDITORA</strong>${auditora}</p>
            <p><strong>PERIODO</strong>${periodo}</p>
        `;
    }
    
    // Generar QR code URL (apunta a vista pública)
    const qrUrl = `${window.location.origin}/liquidacion-publica.html?id=${liquidacionId}`;
    
    // Generar QR code usando API pública
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrUrl)}`;
    
    // Construir HTML de impresión
    let printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Liquidación de Rodamiento</title>
            <style>
                @page {
                    size: letter landscape;
                    margin: 0.5cm;
                }
                
                :root {
                    --color-primary: #3f51b5;
                    --color-primary-dark: #303f9f;
                    --color-border: #e2e8f0;
                    --color-text-main: #1e293b;
                    --color-text-label: #64748b;
                    --glass-bg: rgba(255, 255, 255, 0.9);
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    font-size: 10px;
                    color: var(--color-text-main);
                    background: white;
                }
                
                .print-page {
                    page-break-after: always;
                    padding: 0.5cm;
                    min-height: 100vh;
                }
                
                .print-page:last-child {
                    page-break-after: auto;
                }
                
                .header-block {
                    margin-bottom: 1rem;
                    padding: 0.75rem 1rem;
                    background: var(--glass-bg);
                    border: 2px solid var(--color-primary);
                    border-radius: 8px;
                }
                
                .header-title {
                    text-align: center;
                    margin-bottom: 0.5rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--color-border);
                }
                
                .header-title h2 {
                    font-size: 12px;
                    font-weight: 800;
                    color: var(--color-primary);
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                }
                
                .header-title p {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--color-text-main);
                    margin: 0.3rem 0 0;
                    text-transform: uppercase;
                }
                
                .header-data {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5rem;
                    align-items: center;
                }
                
                .header-data p {
                    margin: 0;
                    font-size: 9px;
                    font-weight: 700;
                    color: var(--color-text-main);
                    text-align: center;
                    line-height: 1.3;
                }
                
                .header-data p strong {
                    display: block;
                    font-size: 7px;
                    color: var(--color-text-label);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 1px;
                }
                
                .header-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 0.75rem;
                    padding-top: 0.5rem;
                    border-top: 1px solid var(--color-border);
                }
                
                .logo-print {
                    height: 35px;
                    width: auto;
                }
                
                .qr-code {
                    width: 70px;
                    height: 70px;
                }
                
                .qr-info {
                    font-size: 7px;
                    color: var(--color-text-label);
                    text-align: center;
                    margin-top: 2px;
                }
                
                h3 {
                    font-size: 13px;
                    font-weight: 700;
                    color: var(--color-primary);
                    margin: 1rem 0 0.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 0.5rem 0;
                    font-size: 9px;
                }
                
                th, td {
                    border: 1px solid var(--color-border);
                    padding: 4px 6px;
                    text-align: center;
                }
                
                th {
                    background: #f8fafc;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    font-size: 8px;
                    letter-spacing: 0.5px;
                }
                
                .planta-name {
                    text-align: left;
                    font-weight: 600;
                    font-size: 8px;
                    color: var(--color-text-main);
                }
                
                .total-row {
                    background: #f1f5f9;
                    font-weight: 700;
                    color: var(--color-primary);
                }
                
                .visita-cell {
                    background: #dbeafe;
                    color: #1e40af;
                    font-weight: 600;
                }
                
                td svg {
                    max-width: 80px;
                    max-height: 30px;
                    height: auto;
                    width: auto;
                    display: block;
                    margin: 0 auto;
                }
                
                td svg path {
                    stroke-width: 4px !important;
                }
                
                .summary {
                    background: var(--glass-bg);
                    border: 1px solid var(--color-border);
                    border-left: 4px solid var(--color-primary);
                    padding: 1rem 1.25rem;
                    margin-top: 1rem;
                    border-radius: 12px;
                }
                
                .summary h4 {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--color-primary);
                    margin-bottom: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.4rem 0;
                    border-bottom: 1px solid var(--color-border);
                    font-size: 9px;
                    color: var(--color-text-main);
                }
                
                .summary-row:last-child {
                    border-bottom: none;
                }
                
                .summary-row.total {
                    border-top: 2px solid var(--color-primary);
                    border-bottom: none;
                    padding-top: 0.6rem;
                    margin-top: 0.4rem;
                    font-size: 12px;
                    font-weight: 800;
                    color: var(--color-primary);
                }
                
                .coordenadas-link {
                    color: var(--color-text-main);
                    text-decoration: none;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 7px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .coordenadas-link i {
                    color: #3b82f6;
                    font-size: 8px;
                }
                
                .no-data {
                    text-align: center;
                    color: var(--color-text-label);
                    padding: 2rem;
                    border: 1px dashed var(--color-border);
                    background: #f8fafc;
                    border-radius: 12px;
                    font-size: 10px;
                }
                
                .firma-wrapper {
                    position: relative;
                    cursor: pointer;
                    width: 100%;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    background: transparent;
                }
            </style>
        </head>
        <body>
    `;
    
    // Mapeo de líneas a nombres legales de productoras
    const nombresLegales = {
        'angeles': 'TEXTILES Y CREACIONES LOS ANGELES S.A.S.',
        'hacemos-moda': 'HACEMOS MODA S.A.S.',
        'universo': 'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.'
    };
    
    // Agregar header en cada página
    tabsContent.forEach((tab, index) => {
        const tabClone = tab.cloneNode(true);
        
        // Remover elementos no deseados
        tabClone.querySelectorAll('button, .tabs-navigation').forEach(el => el.remove());
        
        // Determinar el nombre legal basado en el ID de la pestaña
        let tabId = tab.id.replace('tab-', '');
        let nombreLegal = nombresLegales[tabId] || '';
        
        printHtml += `
            <div class="print-page">
                ${nombreLegal ? `
                    <div class="header-block">
                        <div class="header-title">
                            <h2>LIQUIDACIÓN DE RODAMIENTO</h2>
                            <p>${nombreLegal}</p>
                        </div>
                        <div class="header-data">
                            ${headerHtml}
                        </div>
                    </div>
                ` : ''}
                ${tabClone.innerHTML}
            </div>
        `;
    });
    
    printHtml += `
        </body>
        </html>
    `;
    
    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.onload = function() {
            printWindow.print();
        };
    } else {
        alert('Por favor permite las ventanas emergentes para imprimir.');
    }
}

/**
 * Muestra la firma en tamaño completo en un modal
 */
function verFirmaGrande(plantaNombre, firmaSvgEncoded) {
    const firmaSvg = decodeURIComponent(firmaSvgEncoded);
    // Remover tamaño fijo del SVG y agregar responsividad
    const styledSvg = firmaSvg
        .replace(/<svg([^>]*)(width|height)="[^"]*"/g, '<svg$1')
        .replace('<svg', '<svg style="width: 100%; height: auto; max-height: 280px;"');

    const html = `
        <div style="width: 100%; text-align: center; padding: 10px; box-sizing: border-box;">
            <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background: #f8fafc; display: inline-block; width: 100%; box-sizing: border-box;">
                ${styledSvg}
            </div>
        </div>
    `;
    abrirLiqModal(`${plantaNombre}`, html);
}

/**
 * Muestra el mapa interactivo de OpenStreetMap en un modal
 */
function verMapaGrande(plantaNombre, coords) {
    const parts = coords.split(',');
    const lat = parseFloat(parts[0].trim()) || 0;
    const lon = parseFloat(parts[1].trim()) || 0;

    const mapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;

    const html = `
        <div style="width: 100%; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px;">
            <iframe src="${mapUrl}" style="width: 100%; height: 380px; border: 1px solid #e2e8f0; border-radius: 8px; box-sizing: border-box;"></iframe>
            <div style="margin-top: 5px;">
                <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" class="btn btn-primary btn-sm" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;">
                    <i class="fas fa-external-link-alt"></i> Abrir en Google Maps
                </a>
            </div>
        </div>
    `;
    abrirLiqModal(`${plantaNombre}`, html);
}

function abrirLiqModal(titulo, contenidoHtml) {
    const modal = document.getElementById('liqModal');
    const title = document.getElementById('liqModalTitle');
    const body = document.getElementById('liqModalBody');

    if (modal && title && body) {
        title.innerHTML = titulo;
        body.innerHTML = contenidoHtml;
        modal.style.display = 'flex';
    }
}

function cerrarLiqModal() {
    const modal = document.getElementById('liqModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Cerrar modal al hacer clic fuera del recuadro
window.addEventListener('click', function (event) {
    const modal = document.getElementById('liqModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

window.abrirLiqModal = abrirLiqModal;
window.cerrarLiqModal = cerrarLiqModal;
window.verFirmaGrande = verFirmaGrande;
window.verMapaGrande = verMapaGrande;
window.generarLiquidacion = generarLiquidacion;
window.imprimirLiquidacion = imprimirLiquidacion;

/**
 * Quita una fecha del input de descuentos y regenera la liquidación
 */
window.quitarDescuento = function (fechaStr) {
    const input = document.getElementById('descuentosInput');
    if (!input) return;

    const actuales = input.value ? input.value.split(',').map(d => d.trim()).filter(d => d !== '') : [];
    const nuevas = actuales.filter(f => f !== fechaStr);

    // Actualizar el input
    input.value = nuevas.join(', ');

    // Si flatpickr está activo, sincronizar
    if (input._flatpickr) {
        input._flatpickr.setDate(nuevas, false, 'Y-m-d');
    }

    // Regenerar
    generarLiquidacion();
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiquidacionRodamiento);
} else {
    initLiquidacionRodamiento();
}
