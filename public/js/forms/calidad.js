/* ==========================================================================
   forms/calidad.js — Formulario de Reporte de Calidad
   ========================================================================== */

/* ── Tabla AQL (ISO 2859-1) ──
   Por nivel de inspección general: I, II, III
   Cada fila: { min, max, letra: { I, II, III } }
   Muestras por letra y AQL: { letra: { aql: [n, ac, re] } }
*/
const AQL_LETRAS = {
    // [nivel_I, nivel_II, nivel_III]
    ranges: [
        { min: 2, max: 8, I: 'A', II: 'A', III: 'B' },
        { min: 9, max: 15, I: 'A', II: 'B', III: 'C' },
        { min: 16, max: 25, I: 'B', II: 'C', III: 'D' },
        { min: 26, max: 50, I: 'C', II: 'D', III: 'E' },
        { min: 51, max: 90, I: 'C', II: 'E', III: 'F' },
        { min: 91, max: 150, I: 'D', II: 'F', III: 'G' },
        { min: 151, max: 280, I: 'E', II: 'G', III: 'H' },
        { min: 281, max: 500, I: 'F', II: 'H', III: 'J' },
        { min: 501, max: 1200, I: 'G', II: 'J', III: 'K' },
        { min: 1201, max: 3200, I: 'H', II: 'K', III: 'L' },
        { min: 3201, max: 10000, I: 'J', II: 'L', III: 'M' },
        { min: 10001, max: 35000, I: 'K', II: 'M', III: 'N' },
        { min: 35001, max: 150000, I: 'L', II: 'N', III: 'P' },
    ],
};

// Muestras por letra de código y nivel AQL: [n, ac, re]
const AQL_MUESTRAS = {
    'A': { '1.0': [2, 0, 1], '1.5': [2, 0, 1], '2.5': [2, 0, 1], '4.0': [2, 0, 1], '6.5': [2, 0, 1] },
    'B': { '1.0': [3, 0, 1], '1.5': [3, 0, 1], '2.5': [3, 0, 1], '4.0': [3, 0, 1], '6.5': [3, 0, 1] },
    'C': { '1.0': [5, 0, 1], '1.5': [5, 0, 1], '2.5': [5, 0, 1], '4.0': [5, 0, 1], '6.5': [5, 1, 2] },
    'D': { '1.0': [8, 0, 1], '1.5': [8, 0, 1], '2.5': [8, 0, 1], '4.0': [8, 0, 1], '6.5': [8, 1, 2] },
    'E': { '1.0': [13, 0, 1], '1.5': [13, 0, 1], '2.5': [13, 0, 1], '4.0': [13, 1, 2], '6.5': [13, 1, 2] },
    'F': { '1.0': [20, 0, 1], '1.5': [20, 0, 1], '2.5': [20, 1, 2], '4.0': [20, 1, 2], '6.5': [20, 2, 3] },
    'G': { '1.0': [32, 0, 1], '1.5': [32, 1, 2], '2.5': [32, 1, 2], '4.0': [32, 2, 3], '6.5': [32, 3, 4] },
    'H': { '1.0': [50, 0, 1], '1.5': [50, 1, 2], '2.5': [50, 2, 3], '4.0': [50, 3, 4], '6.5': [50, 5, 6] },
    'J': { '1.0': [80, 1, 2], '1.5': [80, 1, 2], '2.5': [80, 3, 4], '4.0': [80, 5, 6], '6.5': [80, 7, 8] },
    'K': { '1.0': [125, 1, 2], '1.5': [125, 2, 3], '2.5': [125, 5, 6], '4.0': [125, 7, 8], '6.5': [125, 10, 11] },
    'L': { '1.0': [200, 2, 3], '1.5': [200, 3, 4], '2.5': [200, 7, 8], '4.0': [200, 10, 11], '6.5': [200, 14, 15] },
    'M': { '1.0': [315, 3, 4], '1.5': [315, 5, 6], '2.5': [315, 10, 11], '4.0': [315, 14, 15], '6.5': [315, 21, 22] },
    'N': { '1.0': [500, 5, 6], '1.5': [500, 7, 8], '2.5': [500, 14, 15], '4.0': [500, 21, 22], '6.5': [500, 21, 22] },
    'P': { '1.0': [800, 7, 8], '1.5': [800, 10, 11], '2.5': [800, 21, 22], '4.0': [800, 21, 22], '6.5': [800, 21, 22] },
};

function calcularAQL() {
    const cantidadRaw = document.getElementById('cantidad')?.value || '';
    const cantidad = parseInt(cantidadRaw.replace(/[^0-9]/g, ''));
    const aql = document.getElementById('aqlNivel')?.value || '4.0';
    const nivel = document.getElementById('aqlNivelInspeccion')?.value || 'II';
    const btn = document.getElementById('aqlBtn');

    if (!cantidad || cantidad < 2) {
        if (btn) btn.style.display = 'none';
        return;
    }

    const fila = AQL_LETRAS.ranges.find(r => cantidad >= r.min && cantidad <= r.max)
        || AQL_LETRAS.ranges[AQL_LETRAS.ranges.length - 1];
    const letra = fila[nivel];
    const datos = AQL_MUESTRAS[letra];
    const [muestra, ac, re] = (datos && datos[aql]) ? datos[aql] : [0, 0, 1];

    document.getElementById('aqlMuestra').textContent = muestra;
    document.getElementById('aqlAceptar').textContent = ac;
    document.getElementById('aqlRechazar').textContent = re;
    document.getElementById('aqlLetra').textContent =
        `Código ${letra} · Lote: ${cantidad.toLocaleString()} uds. · Nivel ${nivel}`;

    const resumen = document.getElementById('aqlBtnResumen');
    if (resumen) resumen.textContent = `Revisar ${muestra} uds. · Ac:${ac} Re:${re}`;
    const btnMuestra = document.getElementById('aqlBtnMuestra');
    const btnAceptar = document.getElementById('aqlBtnAceptar');
    const btnRechazar = document.getElementById('aqlBtnRechazar');
    if (btnMuestra) btnMuestra.textContent = muestra;
    if (btnAceptar) btnAceptar.textContent = ac;
    if (btnRechazar) btnRechazar.textContent = re;
    if (btn) btn.style.display = 'flex';
}

function abrirModalAQL() {
    const modal = document.getElementById('aqlModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalAQL() {
    const modal = document.getElementById('aqlModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Inicializa la lógica dinámica del formulario de calidad.
 */
function autogenerarPlantillaCalidad() {
    const tipo = (document.getElementById('tipoVisita')?.value || '').toUpperCase();
    if (!tipo) return "";

    const conclusion = (document.getElementById('conclusion')?.value || '').toUpperCase();

    // Condición estricta: solo aparece cuando se completan tipo de visita y conclusión (si la requiere)
    const requiereConclusion = ['AUDITORIA', 'RONDA', 'CONTRAMUESTRA'].includes(tipo);
    if (requiereConclusion && !conclusion) {
        return "";
    }

    const proceso = (document.getElementById('proceso')?.value || '').trim();
    const prenda = (document.getElementById('prenda')?.value || '').trim();
    const genero = (document.getElementById('genero')?.value || '').trim();
    const tejido = (document.getElementById('tejido')?.value || '').trim();
    const avance = document.getElementById('avancePorcentaje')?.value || '0';

    // Obtener estilo elegido del dropdown
    const estiloDropdown = document.getElementById('redaccionEstilo');
    const estilo = estiloDropdown ? estiloDropdown.value : 'ESTANDAR';

    // Obtener conector de recomendación
    const conectorDropdown = document.getElementById('conectorRedaccion');
    const conectorTexto = conectorDropdown ? conectorDropdown.value : '';

    // Obtener destino del lote si aplica (SOLO EN AUDITORIA APROBADA)
    const destinoTipoVal = document.getElementById('destinoTipo')?.value || '';
    const destinoProcesoVal = document.getElementById('destinoProceso')?.value || '';
    const destinoOtroVal = document.getElementById('destinoOtro')?.value || '';
    const destinoPlantaVal = document.getElementById('destinoPlanta')?.value || '';

    let destinoTipoData = "";
    let destinoProc = "";
    let destinoPlan = "";
    if (tipo === 'AUDITORIA' && conclusion === 'APROBADO' && destinoTipoVal) {
        destinoTipoData = destinoTipoVal;
        if (destinoTipoVal === 'PROCESO') {
            destinoProc = (destinoProcesoVal === 'OTROS') ? destinoOtroVal.trim() : destinoProcesoVal;
            destinoPlan = destinoPlantaVal.trim();
        }
    }

    const datos = {
        tipo,
        conclusion,
        proceso,
        prenda,
        genero,
        tejido,
        avance,
        destinoTipo: destinoTipoData,
        destinoProceso: destinoProc,
        destinoPlanta: destinoPlan
    };

    // Delegar al módulo dedicado de plantillas premium
    if (typeof generarRedaccionPlantilla === 'function') {
        return generarRedaccionPlantilla(datos, estilo, conectorTexto);
    }

    return "";
}

function actualizarPlantillaCalidadTextarea(forceUpdate = false) {
    const textarea = document.getElementById('observacionesCalidad');
    if (!textarea) return;

    const plantilla = autogenerarPlantillaCalidad() || "";

    // Actualizar placeholder en todo caso para guiar al usuario
    if (plantilla) {
        textarea.placeholder = `${plantilla}... (Escribe aquí los detalles y recomendaciones)`;
    } else {
        textarea.placeholder = "Detalla los hallazgos encontrados...";
    }

    // Pre-escribir en el textarea si está vacío o si el valor actual coincide con una plantilla previa
    const valActual = textarea.value.trim();
    const plantillaPrevia = textarea.getAttribute('data-auto-generated') || "";
    const esPlantillaPrevia = valActual === plantillaPrevia.trim();

    if (forceUpdate || !valActual || esPlantillaPrevia) {
        textarea.value = plantilla;
        textarea.setAttribute('data-auto-generated', plantilla);
        if (typeof _autoResizeTextarea === 'function') {
            _autoResizeTextarea(textarea);
        }
    }
}

function initCalidadForm() {
    const tipoVisita = document.getElementById('tipoVisita');
    const conclusion = document.getElementById('conclusion');
    const avanceSlider = document.getElementById('avanceSlider');
    const avanceValor = document.getElementById('avanceValor');
    const avancePct = document.getElementById('avancePorcentaje');
    const redaccionEstilo = document.getElementById('redaccionEstilo');
    const incluirRecomendaciones = document.getElementById('incluirRecomendaciones');

    if (!tipoVisita) return;

    // Listener del slider de avance
    avanceSlider.addEventListener('input', () => {
        avanceValor.textContent = avanceSlider.value + '%';
        avancePct.value = avanceSlider.value;
        actualizarPlantillaCalidadTextarea();
    });

    // Listeners para actualizar campos y plantilla
    tipoVisita.addEventListener('change', () => {
        _actualizarCamposCalidad();
        actualizarPlantillaCalidadTextarea(true);
    });

    if (conclusion) {
        conclusion.addEventListener('change', () => {
            _actualizarCamposCalidad();
            actualizarPlantillaCalidadTextarea(true);
        });
    }

    if (redaccionEstilo) {
        redaccionEstilo.addEventListener('change', () => {
            actualizarPlantillaCalidadTextarea(true);
        });
    }

    const conectorRedaccion = document.getElementById('conectorRedaccion');
    if (conectorRedaccion) {
        conectorRedaccion.addEventListener('change', () => {
            actualizarPlantillaCalidadTextarea(true);
        });
    }

    const destinoTipo = document.getElementById('destinoTipo');
    if (destinoTipo) {
        destinoTipo.addEventListener('change', () => {
            _actualizarCamposCalidad();
            actualizarPlantillaCalidadTextarea(true);
        });
    }

    const destinoProceso = document.getElementById('destinoProceso');
    if (destinoProceso) {
        destinoProceso.addEventListener('change', () => {
            const destinoOtroSection = document.getElementById('destinoOtroSection');
            const destinoOtro = document.getElementById('destinoOtro');
            if (destinoProceso.value === 'OTROS') {
                if (destinoOtroSection) destinoOtroSection.style.display = '';
                if (destinoOtro) destinoOtro.required = true;
            } else {
                if (destinoOtroSection) destinoOtroSection.style.display = 'none';
                if (destinoOtro) {
                    destinoOtro.required = false;
                    destinoOtro.value = '';
                }
            }
            actualizarPlantillaCalidadTextarea(true);
        });
    }

    const destinoOtro = document.getElementById('destinoOtro');
    if (destinoOtro) {
        destinoOtro.addEventListener('input', () => {
            actualizarPlantillaCalidadTextarea(true);
        });
    }

    const destinoPlanta = document.getElementById('destinoPlanta');
    if (destinoPlanta) {
        destinoPlanta.addEventListener('input', () => {
            actualizarPlantillaCalidadTextarea(true);
        });
        destinoPlanta.addEventListener('blur', () => {
            if (destinoPlanta.required && !destinoPlanta.value.trim()) {
                destinoPlanta.value = 'CDI';
            }
            actualizarPlantillaCalidadTextarea();
        });
    }

    _actualizarCamposCalidad();
    actualizarPlantillaCalidadTextarea();
    calcularAQL();

    // Recalcular AQL cada vez que cambia la cantidad del lote
    const cantidad = document.getElementById('cantidad');
    if (cantidad) cantidad.addEventListener('change', calcularAQL);

    // Calentar la Edge Function de la IA en segundo plano en cuanto el auditor haga foco en el texto
    const observacionesCalidad = document.getElementById('observacionesCalidad');
    if (observacionesCalidad) {
        observacionesCalidad.addEventListener('focus', () => {
            if (typeof warmUpSupabaseAI === 'function') {
                warmUpSupabaseAI();
            }
        }, { once: true });
    }
}

function _actualizarCamposCalidad() {
    const tipo = (document.getElementById('tipoVisita')?.value || '').toUpperCase();
    const conclusionWrap = document.getElementById('conclusion')?.closest('.mb-3');
    const avanceSection = document.getElementById('avanceSection');
    const conclusion = document.getElementById('conclusion');
    const avanceSlider = document.getElementById('avanceSlider');
    const conclusionLabel = conclusionWrap?.querySelector('label');
    const avanceLabel = avanceSection?.querySelector('label.form-label');

    const esAuditoria = tipo === 'AUDITORIA';
    const esRonda = tipo === 'RONDA';
    const esContramuestra = tipo === 'CONTRAMUESTRA';

    // ── Conclusión ──
    // Visible en AUDITORIA, RONDA y CONTRAMUESTRA (obligatoria siempre que esté visible)
    const mostrarConclusion = esAuditoria || esRonda || esContramuestra;
    if (conclusionWrap) conclusionWrap.style.display = mostrarConclusion ? '' : 'none';
    if (conclusion) {
        conclusion.required = mostrarConclusion;
        if (!mostrarConclusion) conclusion.value = '';

        // La conclusión PAUSADO solo está disponible para RONDA
        Array.from(conclusion.options).forEach(opt => {
            if (opt.value === 'PAUSADO') {
                if (esRonda) {
                    opt.hidden = false;
                    opt.disabled = false;
                } else {
                    opt.hidden = true;
                    opt.disabled = true;
                    if (conclusion.value === 'PAUSADO') {
                        conclusion.value = '';
                    }
                }
            }
        });
    }
    if (conclusionLabel) {
        if (mostrarConclusion) {
            conclusionLabel.innerHTML = 'Conclusión: <i class="fas fa-asterisk" style="color:#ef4444;font-size:0.6rem;vertical-align:middle;margin-left:4px;" title="Requerido"></i>';
        } else {
            conclusionLabel.innerHTML = 'Conclusión:';
        }
    }

    // ── Avance ──
    // Visible en RONDA (obligatorio) y CONTRAMUESTRA (opcional)
    // Oculto si la conclusión es PAUSADO
    const esPausado = conclusion && conclusion.value === 'PAUSADO';
    const mostrarAvance = (esRonda || esContramuestra) && !esPausado;
    if (avanceSection) avanceSection.style.display = mostrarAvance ? '' : 'none';
    if (avanceLabel) {
        if (esRonda && !esPausado) {
            avanceLabel.innerHTML = 'Avance de producción: <i class="fas fa-asterisk" style="color:#ef4444;font-size:0.6rem;vertical-align:middle;margin-left:4px;" title="Requerido"></i>';
        } else {
            avanceLabel.innerHTML = 'Avance de producción: <i class="fas fa-circle-minus" style="color:#94a3b8;font-size:0.7rem;vertical-align:middle;margin-left:4px;" title="Opcional"></i>';
        }
    }
    if (avanceSlider) {
        avanceSlider.required = esRonda && !esPausado;
        avanceSlider.value = 0;
        const avanceValor = document.getElementById('avanceValor');
        const avancePct = document.getElementById('avancePorcentaje');
        if (avanceValor) avanceValor.textContent = '0%';
        if (avancePct) avancePct.value = '0';
    }

    // ── Destino del Lote ──
    const destinoSection = document.getElementById('destinoSection');
    const destinoTipo = document.getElementById('destinoTipo');
    const destinoProcesoContainer = document.getElementById('destinoProcesoContainer');
    const destinoProceso = document.getElementById('destinoProceso');
    const destinoOtroSection = document.getElementById('destinoOtroSection');
    const destinoOtro = document.getElementById('destinoOtro');
    const destinoPlanta = document.getElementById('destinoPlanta');

    if (destinoSection) {
        if (esAuditoria && conclusion && conclusion.value === 'APROBADO') {
            destinoSection.style.display = '';
            if (destinoTipo) destinoTipo.required = true;

            if (destinoTipo && destinoTipo.value === 'PROCESO') {
                if (destinoProcesoContainer) destinoProcesoContainer.style.display = '';
                if (destinoProceso) destinoProceso.required = true;
                if (destinoPlanta) destinoPlanta.required = true;
            } else {
                if (destinoProcesoContainer) destinoProcesoContainer.style.display = 'none';
                if (destinoProceso) { destinoProceso.required = false; destinoProceso.value = ''; }
                if (destinoPlanta) { destinoPlanta.required = false; destinoPlanta.value = ''; }
                if (destinoOtroSection) { destinoOtroSection.style.display = 'none'; }
                if (destinoOtro) { destinoOtro.required = false; destinoOtro.value = ''; }
            }
        } else {
            destinoSection.style.display = 'none';
            if (destinoTipo) { destinoTipo.required = false; destinoTipo.value = ''; }
            if (destinoProcesoContainer) destinoProcesoContainer.style.display = 'none';
            if (destinoProceso) { destinoProceso.required = false; destinoProceso.value = ''; }
            if (destinoPlanta) { destinoPlanta.required = false; destinoPlanta.value = ''; }
            if (destinoOtroSection) { destinoOtroSection.style.display = 'none'; }
            if (destinoOtro) { destinoOtro.required = false; destinoOtro.value = ''; }
        }
    }

    // ── Novedades de Auditoría ──
    const calidadNovedadesSection = document.getElementById('calidadNovedadesSection');
    if (calidadNovedadesSection) {
        calidadNovedadesSection.style.display = esAuditoria ? '' : 'none';
        if (!esAuditoria) {
            // Limpiar el estado de novedades si se cambia de tipo
            window._novedadesCalidadState = [];
            renderTarjetasNovedadesCalidad();
        }
    }
}

/* ── Novedades de Auditoría: Modal Constructor y Tarjetas Resumen ───────────────────────────── */

window._novedadesCalidadState = [];
window._novedadEditIndex = null;

/**
 * Abre el Modal Constructor de Novedades.
 * Si se le pasa un index, precarga los datos para edición.
 */
function agregarBloqueNovedadCalidad(editIndex = null, subEditIndex = null) {
    window._novedadEditIndex = editIndex;
    window._novedadSubEditIndex = subEditIndex;
    const modal = document.getElementById('novedadesCalidadModal');
    const title = document.getElementById('novedadesModalTitle');
    const selectTipo = document.getElementById('novedadModalTipo');
    const sinProcesoCheck = document.getElementById('novedadModalSinProcesoCheck');
    const codigosList = document.getElementById('novedadModalCodigosList');

    // Limpiar modal
    selectTipo.value = '';
    selectTipo.disabled = false;
    sinProcesoCheck.checked = false;
    codigosList.innerHTML = '';
    handleModalCalidadNovedadTipoChange();

    if (editIndex !== null) {
        const data = window._novedadesCalidadState[editIndex];
        selectTipo.value = data.tipo;

        handleModalCalidadNovedadTipoChange();
        if (data.tipo === 'PROMOCIONES') {
            sinProcesoCheck.checked = data.sin_proceso;
        }

        if (subEditIndex !== null) {
            title.textContent = 'Editar Detalle';
            agregarFilaModalNovedad(data.codigos[subEditIndex]);
        } else {
            title.textContent = 'Editar Grupo';
            data.codigos.forEach(c => agregarFilaModalNovedad(c));
        }
    } else {
        title.textContent = 'Reportar Novedad';
        agregarFilaModalNovedad(); // Fila vacía inicial
    }

    modal.style.display = 'flex';
}

function cerrarModalNovedadCalidad() {
    document.getElementById('novedadesCalidadModal').style.display = 'none';
}

function handleModalCalidadNovedadTipoChange() {
    const tipo = document.getElementById('novedadModalTipo').value;
    const sinProcesoDiv = document.getElementById('novedadModalSinProceso');
    if (tipo === 'PROMOCIONES') {
        sinProcesoDiv.style.display = 'block';
    } else {
        sinProcesoDiv.style.display = 'none';
        document.getElementById('novedadModalSinProcesoCheck').checked = false;
    }
}

function agregarFilaModalNovedad(datosIniciales = null) {
    const listContainer = document.getElementById('novedadModalCodigosList');
    const fila = document.createElement('div');
    fila.className = 'insumo-fila mb-3 fila-3-cols';

    const tallasFiltradas = (typeof getFilteredSizes === 'function') ? getFilteredSizes() : (window.CODIGOS_TALLAS || CODIGOS_TALLAS_LIST || []);
    const coloresFiltrados = CODIGOS_COLORES_LIST || [];

    const valTalla = datosIniciales ? datosIniciales.talla : '';
    const valColor = datosIniciales ? datosIniciales.color : '';
    const valCant = datosIniciales ? datosIniciales.cantidad : '';

    fila.innerHTML = `
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline" style="font-size:0.7rem;">Talla: <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-mobile"
                    onclick="eliminarFilaModalNovedad(this)" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-ruler input-icon"></i>
                <input type="text" class="form-control form-control-sm codigo-talla" 
                    placeholder="Talla..." autocomplete="off" value="${valTalla}" list="calidad-tallas-list-${Date.now()}">
                <datalist id="calidad-tallas-list-${Date.now()}">
                    ${tallasFiltradas.map(t => `<option value="${t}"></option>`).join('')}
                </datalist>
            </div>
        </div>
        <div class="campo-dinamico">
            <label class="form-label-inline" style="font-size:0.7rem;">Color: <span style="color:#ef4444;">*</span></label>
            <div class="input-with-icon">
                <i class="fas fa-palette input-icon"></i>
                <input type="text" class="form-control form-control-sm codigo-color" 
                    placeholder="Color..." autocomplete="off" value="${valColor}" list="calidad-colores-list-${Date.now()}">
                <datalist id="calidad-colores-list-${Date.now()}">
                    ${coloresFiltrados.map(c => `<option value="${c}"></option>`).join('')}
                </datalist>
            </div>
        </div>
        <div class="campo-dinamico">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <label class="form-label-inline" style="font-size:0.7rem;">Cantidad: <span style="color:#ef4444;">*</span></label>
                <button type="button" class="btn-eliminar-insumo btn-eliminar-desktop"
                    onclick="eliminarFilaModalNovedad(this)" title="Eliminar"
                    style="flex-shrink:0; background:none; border:1px solid #fca5a5; border-radius:6px;
                           color:#ef4444; width:28px; height:28px; cursor:pointer; font-size:0.75rem;
                           display:none; align-items:center; justify-content:center; transition:all 0.15s; padding:0;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control form-control-sm codigo-cantidad" min="1" placeholder="Cant." value="${valCant}">
            </div>
        </div>`;

    listContainer.appendChild(fila);
    _actualizarBotonesEliminarModalNovedad();

    // Inicializar Smart Selects removido (usando datalist nativo)
}

function eliminarFilaModalNovedad(btn) {
    const listContainer = document.getElementById('novedadModalCodigosList');
    if (listContainer.children.length <= 1) return;
    btn.closest('.insumo-fila').remove();
    _actualizarBotonesEliminarModalNovedad();
}

function _actualizarBotonesEliminarModalNovedad() {
    const filas = document.querySelectorAll('#novedadModalCodigosList .insumo-fila');
    const hayMultiples = filas.length > 1;
    filas.forEach(fila => {
        fila.querySelectorAll('.btn-eliminar-insumo').forEach(btn => {
            btn.style.display = hayMultiples ? 'flex' : 'none';
        });
    });
}

function _compactarCodigosNovedad(codigosArray) {
    const map = {};
    codigosArray.forEach(c => {
        const key = `${c.talla.trim().toUpperCase()}|${c.color.trim().toUpperCase()}`;
        if (!map[key]) {
            map[key] = { talla: c.talla.trim().toUpperCase(), color: c.color.trim().toUpperCase(), cantidad: c.cantidad };
        } else {
            map[key].cantidad += c.cantidad;
        }
    });
    return Object.values(map);
}

function guardarNovedadCalidad() {
    const tipo = document.getElementById('novedadModalTipo').value;
    if (!tipo) {
        Swal.fire({ icon: 'warning', title: 'Falta Tipo', text: 'Selecciona el tipo de novedad.', confirmButtonColor: '#3F51B5' });
        return;
    }

    const sinProceso = document.getElementById('novedadModalSinProcesoCheck').checked;
    const filas = document.querySelectorAll('#novedadModalCodigosList .insumo-fila');
    const codigos = [];

    let valido = true;
    filas.forEach(fila => {
        const talla = fila.querySelector('.codigo-talla')?.value?.trim() || '';
        const color = fila.querySelector('.codigo-color')?.value?.trim() || '';
        const cant = fila.querySelector('.codigo-cantidad')?.value || '';
        if (!talla || !color || !cant) { valido = false; }
        else { codigos.push({ talla, color, cantidad: Number(cant) }); }
    });

    if (!valido || codigos.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'Completa talla, color y cantidad en todas las filas.', confirmButtonColor: '#3F51B5' });
        return;
    }

    const codigosCompactados = _compactarCodigosNovedad(codigos);
    const nuevaNovedad = { tipo, sin_proceso: (tipo === 'PROMOCIONES' && sinProceso), codigos: codigosCompactados };

    // Si estamos editando un subdetalle, lo removemos del grupo original
    if (window._novedadEditIndex !== null) {
        const grupoOriginal = window._novedadesCalidadState[window._novedadEditIndex];
        if (window._novedadSubEditIndex !== null && window._novedadSubEditIndex !== undefined) {
            grupoOriginal.codigos.splice(window._novedadSubEditIndex, 1);
        } else {
            // Edición de grupo entero (legacy)
            grupoOriginal.codigos = [];
        }
    }

    // Buscamos si existe el grupo destino (puede ser el mismo si no cambió de tipo)
    const isSinProceso = (tipo === 'PROMOCIONES' && sinProceso);
    const destinoIndex = window._novedadesCalidadState.findIndex(n => n.tipo === tipo && !!n.sin_proceso === !!isSinProceso);

    if (destinoIndex >= 0) {
        const destino = window._novedadesCalidadState[destinoIndex];
        const combinados = destino.codigos.concat(codigosCompactados);
        destino.codigos = _compactarCodigosNovedad(combinados);
    } else {
        window._novedadesCalidadState.push(nuevaNovedad);
    }

    // Eliminar cualquier grupo que se haya quedado sin códigos (ej. movimos el único ítem de un grupo a otro)
    window._novedadesCalidadState = window._novedadesCalidadState.filter(g => g.codigos && g.codigos.length > 0);

    cerrarModalNovedadCalidad();
    renderTarjetasNovedadesCalidad();
}

function eliminarNovedadCalidad(index) {
    window._novedadesCalidadState.splice(index, 1);
    renderTarjetasNovedadesCalidad();
}

window.editarSubNovedadCalidad = function (tipoIndex, codigoIndex) {
    agregarBloqueNovedadCalidad(tipoIndex, codigoIndex);
}

window.eliminarSubNovedadCalidad = function (tipoIndex, codigoIndex) {
    const novedad = window._novedadesCalidadState[tipoIndex];
    novedad.codigos.splice(codigoIndex, 1);
    if (novedad.codigos.length === 0) {
        window._novedadesCalidadState.splice(tipoIndex, 1);
    }
    renderTarjetasNovedadesCalidad();
}

function renderTarjetasNovedadesCalidad() {
    const lista = document.getElementById('calidadNovedadesList');
    const dropzone = document.getElementById('calidadNovedadesDropzone');

    lista.innerHTML = '';

    if (window._novedadesCalidadState.length === 0) {
        dropzone.style.display = '';
        return;
    }

    dropzone.style.display = 'none';

    window._novedadesCalidadState.forEach((novedad, index) => {
        const totalUnidades = novedad.codigos.reduce((sum, c) => sum + c.cantidad, 0);

        let colorTheme = '#3b82f6';
        let bgTheme = '#eff6ff';
        let iconName = 'fa-tag';
        let displayTipo = novedad.tipo;

        if (novedad.tipo === 'SIN CONFECCIONAR') { colorTheme = '#ef4444'; bgTheme = '#fef2f2'; iconName = 'fa-cut'; }
        if (novedad.tipo === 'PROMOCIONES') {
            if (novedad.sin_proceso) {
                colorTheme = '#db2777'; // Pink for Sin Proceso
                bgTheme = '#fdf2f8';
                iconName = 'fa-exclamation-triangle';
                displayTipo = 'PROM. SIN PROCESO';
            } else {
                colorTheme = '#f59e0b'; // Orange
                bgTheme = '#fffbeb';
                iconName = 'fa-percentage';
            }
        }
        if (novedad.tipo === 'COBROS') { colorTheme = '#10b981'; bgTheme = '#ecfdf5'; iconName = 'fa-file-invoice-dollar'; }
        if (novedad.tipo === 'LAVADO') { colorTheme = '#6366f1'; bgTheme = '#eef2ff'; iconName = 'fa-water'; }

        let codigosHtml = '';
        novedad.codigos.forEach((c, codigoIndex) => {
            const isLast = codigoIndex === novedad.codigos.length - 1;
            const borderBottom = isLast ? '' : 'border-bottom:1px solid #f1f5f9;';
            codigosHtml += `
                <div style="display:grid; grid-template-columns: 2fr 4fr 2fr 2fr; align-items:center; padding:10px 14px; ${borderBottom} transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <div style="font-size:0.75rem; font-weight:800; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.talla}">${c.talla}</div>
                    <div style="font-size:0.75rem; color:#334155; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:8px;" title="${c.color}">${c.color}</div>
                    <div style="font-size:0.7rem; font-weight:700; color:${colorTheme}; text-align:center; background:${bgTheme}; border-radius:4px; padding:2px 0; margin-right:8px;">${c.cantidad}</div>
                    <div style="display:flex; gap:8px; justify-content:flex-end;">
                        <button type="button" onclick="editarSubNovedadCalidad(${index}, ${codigoIndex})" title="Editar detalle" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px;" onmouseover="this.style.color='${colorTheme}';" onmouseout="this.style.color='#94a3b8';"><i class="fas fa-pen" style="font-size:0.8rem;"></i></button>
                        <button type="button" onclick="eliminarSubNovedadCalidad(${index}, ${codigoIndex})" title="Eliminar detalle" style="background:none; border:none; color:#fca5a5; cursor:pointer; padding:2px;" onmouseover="this.style.color='#ef4444';" onmouseout="this.style.color='#fca5a5';"><i class="fas fa-trash" style="font-size:0.8rem;"></i></button>
                    </div>
                </div>
            `;
        });

        const tarjeta = document.createElement('div');
        tarjeta.style.cssText = `background:#ffffff; border:1px solid #e2e8f0; border-top:4px solid ${colorTheme}; border-radius:12px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02); overflow:hidden;`;

        tarjeta.innerHTML = `
            <!-- HEADER -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:${bgTheme}; padding:10px 14px; border-bottom:1px solid #e2e8f0;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fas ${iconName}" style="color:${colorTheme}; font-size:1.1rem;"></i>
                    <span style="font-weight:800; font-size:0.85rem; color:#1e293b; text-transform:uppercase; letter-spacing:0.3px;">${displayTipo}</span>
                </div>
                <div style="font-size:0.75rem; font-weight:800; color:${colorTheme};">
                    ${totalUnidades} UNDS.
                </div>
            </div>
            
            <!-- BODY / TABLE -->
            <div style="padding:0;">
                <!-- HEADERS MUY PEQUEÑOS -->
                <div style="display:grid; grid-template-columns: 2fr 4fr 2fr 2fr; padding:8px 14px; background:#f8fafc; border-bottom:1px solid #f1f5f9; font-size:0.6rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">
                    <div>Talla</div>
                    <div>Color</div>
                    <div style="text-align:center;">Cant.</div>
                    <div style="text-align:right;">Acción</div>
                </div>
                
                <!-- ROWS -->
                ${codigosHtml}
            </div>
        `;
        lista.appendChild(tarjeta);
    });

    // Añadir botón compacto al final para agregar más si ya hay tarjetas
    if (window._novedadesCalidadState.length > 0) {
        const addMore = document.createElement('div');
        addMore.innerHTML = `
            <button type="button" class="btn-action-muted" onclick="agregarBloqueNovedadCalidad()" style="width:100%; justify-content:center; padding:12px; border:2px dashed #e2e8f0; border-radius:12px; color:#64748b; font-size:0.8rem; font-weight:700; transition:all 0.2s;"
            onmouseover="this.style.borderColor='#3F51B5'; this.style.color='#3F51B5'; this.style.background='#f8fafc';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#64748b'; this.style.background='none';">
                <i class="fas fa-plus"></i> Reportar otra novedad
            </button>
        `;
        lista.appendChild(addMore);
    }
}

/**
 * Maneja el envío del formulario de Calidad.
 */
async function handleCalidadSubmit(e) {
    e.preventDefault();

    // Validar que la firma esté presente
    const firmaValidada = document.getElementById('firmaValidada');
    const tieneFirma = (window.FirmaTaller && !window.FirmaTaller.isEmpty()) || (firmaValidada && firmaValidada.value);
    if (!tieneFirma) {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Enviar Reporte';
        return;
    }

    const tipo = (document.getElementById('tipoVisita')?.value || '').toUpperCase();
    const esRonda = tipo === 'RONDA';

    // Validar avance obligatorio en RONDA (excepto si está PAUSADO)
    const conclusionVal = document.getElementById('conclusion')?.value || '';
    if (esRonda && conclusionVal !== 'PAUSADO') {
        const avance = parseInt(document.getElementById('avancePorcentaje')?.value || '0');
        if (avance === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Avance requerido',
                text: 'Para una Ronda debes registrar el porcentaje de avance de producción.',
                confirmButtonColor: '#3F51B5',
            });
            return;
        }
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    console.log('[calidad] Iniciando envío de formulario');

    try {
        const lotData = collectLotData();
        const email = document.getElementById('email').value;
        const localizacion = document.getElementById('localizacion')?.value || 'No disponible';
        const tipoVisita = document.getElementById('tipoVisita').value;
        const conclusion = document.getElementById('conclusion').value;
        const observaciones = document.getElementById('observacionesCalidad').value;
        const avance = document.getElementById('avancePorcentaje')?.value || '';
        const soporteFile = document.getElementById('soporte').files?.[0] || null;

        console.log('[calidad] Datos recopilados:', {
            lote: lotData.lote,
            tipoVisita,
            tieneSoporte: !!soporteFile
        });

        let finalObservaciones = observaciones;
        let firmaSvg = null;

        // Capturar Firma Digital desde el módulo FirmaTaller (js/firma.js)
        // La firma se guarda como SVG en la columna firma_svg, sin tocar las observaciones
        if (window.FirmaTaller && !window.FirmaTaller.isEmpty()) {
            firmaSvg = window.FirmaTaller.getSVG();
        }

        // Obtener destino del lote si aplica (solo en Auditoria Aprobada)
        const destinoTipoVal = document.getElementById('destinoTipo')?.value || '';
        const destinoProcesoVal = document.getElementById('destinoProceso')?.value || '';
        const destinoOtroVal = document.getElementById('destinoOtro')?.value || '';
        const destinoPlantaVal = document.getElementById('destinoPlanta')?.value || '';

        let destino_proceso = "";
        let destino_planta = "";

        if (tipoVisita.toUpperCase() === 'AUDITORIA' && conclusion === 'APROBADO') {
            if (destinoTipoVal === 'CDI') {
                destino_proceso = 'CDI';
                destino_planta = 'CDI';
            } else if (destinoTipoVal === 'PROCESO' && destinoProcesoVal) {
                destino_proceso = (destinoProcesoVal === 'OTROS') ? destinoOtroVal.trim() : destinoProcesoVal;
                destino_planta = destinoPlantaVal.trim() || "CDI";
            }
        }

        // Recolectar novedades de auditoría (si existen)
        let novedades_auditoria = null;
        if (window._novedadesCalidadState && window._novedadesCalidadState.length > 0) {
            novedades_auditoria = window._novedadesCalidadState;
        }

        // 1. Enviar texto inmediatamente sin esperar el soporte
        const payload = {
            hoja: SHEETS_DESTINO.CALIDAD,
            ...lotData,
            email,
            localizacion,
            tipoVisita,
            conclusion,
            avance,
            destino_proceso, // Nuevo campo de destino de liberación
            destino_planta,  // Nuevo campo de planta de destino
            observaciones: finalObservaciones,
            productora: (typeof currentUser !== 'undefined') ? (currentUser.ID_PRODUCTORA || currentUser.productora) : null,
            soporte: '',   // se actualizará en background
            ...(firmaSvg && { firma_svg: firmaSvg }),  // solo si hay firma
            ...(novedades_auditoria && { novedades_auditoria }),
        };

        const result = await sendToGAS(payload);

        const idReporte = result.id || result.ID_REPORTE;

        if (!idReporte) {
            throw new Error('No se recibió ID del reporte');
        }


        // 3. UI libre
        Swal.fire({
            title: '¡Reporte guardado!',
            text: 'El reporte de calidad fue guardado exitosamente.',
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

        // Limpiar firma canvas tras envío exitoso
        if (window.FirmaTaller) window.FirmaTaller.clear();
        if (typeof clearVersionHistory === 'function') clearVersionHistory();

        // Limpiar novedades de auditoría
        window._novedadesCalidadState = [];
        renderTarjetasNovedadesCalidad();

        _actualizarCamposCalidad();
        hideSections();

        // 3. Subir soporte en background
        if (soporteFile && idReporte) {
            uploadArchivoAsync(soporteFile, idReporte, SHEETS_DESTINO.CALIDAD);
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

// ── Inicializar módulo de firma de conformidad ──
// Toda la lógica de canvas, pantalla completa y eventos vive en js/firma.js (FirmaTaller)
function initFormSignaturePad() {
    if (window.FirmaTaller) {
        window.FirmaTaller.init('signature-container');
    }
}

// Auto-inicializar al cargar el script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormSignaturePad);
} else {
    setTimeout(initFormSignaturePad, 200);
}
