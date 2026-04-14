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
        { min: 2,     max: 8,      I: 'A', II: 'A', III: 'B' },
        { min: 9,     max: 15,     I: 'A', II: 'B', III: 'C' },
        { min: 16,    max: 25,     I: 'B', II: 'C', III: 'D' },
        { min: 26,    max: 50,     I: 'C', II: 'D', III: 'E' },
        { min: 51,    max: 90,     I: 'C', II: 'E', III: 'F' },
        { min: 91,    max: 150,    I: 'D', II: 'F', III: 'G' },
        { min: 151,   max: 280,    I: 'E', II: 'G', III: 'H' },
        { min: 281,   max: 500,    I: 'F', II: 'H', III: 'J' },
        { min: 501,   max: 1200,   I: 'G', II: 'J', III: 'K' },
        { min: 1201,  max: 3200,   I: 'H', II: 'K', III: 'L' },
        { min: 3201,  max: 10000,  I: 'J', II: 'L', III: 'M' },
        { min: 10001, max: 35000,  I: 'K', II: 'M', III: 'N' },
        { min: 35001, max: 150000, I: 'L', II: 'N', III: 'P' },
    ],
};

// Muestras por letra de código y nivel AQL: [n, ac, re]
const AQL_MUESTRAS = {
    'A': { '1.0': [2,0,1],   '1.5': [2,0,1],   '2.5': [2,0,1],   '4.0': [2,0,1],   '6.5': [2,0,1]   },
    'B': { '1.0': [3,0,1],   '1.5': [3,0,1],   '2.5': [3,0,1],   '4.0': [3,0,1],   '6.5': [3,0,1]   },
    'C': { '1.0': [5,0,1],   '1.5': [5,0,1],   '2.5': [5,0,1],   '4.0': [5,0,1],   '6.5': [5,1,2]   },
    'D': { '1.0': [8,0,1],   '1.5': [8,0,1],   '2.5': [8,0,1],   '4.0': [8,0,1],   '6.5': [8,1,2]   },
    'E': { '1.0': [13,0,1],  '1.5': [13,0,1],  '2.5': [13,0,1],  '4.0': [13,1,2],  '6.5': [13,1,2]  },
    'F': { '1.0': [20,0,1],  '1.5': [20,0,1],  '2.5': [20,1,2],  '4.0': [20,1,2],  '6.5': [20,2,3]  },
    'G': { '1.0': [32,0,1],  '1.5': [32,1,2],  '2.5': [32,1,2],  '4.0': [32,2,3],  '6.5': [32,3,4]  },
    'H': { '1.0': [50,0,1],  '1.5': [50,1,2],  '2.5': [50,2,3],  '4.0': [50,3,4],  '6.5': [50,5,6]  },
    'J': { '1.0': [80,1,2],  '1.5': [80,1,2],  '2.5': [80,3,4],  '4.0': [80,5,6],  '6.5': [80,7,8]  },
    'K': { '1.0': [125,1,2], '1.5': [125,2,3], '2.5': [125,5,6], '4.0': [125,7,8], '6.5': [125,10,11]},
    'L': { '1.0': [200,2,3], '1.5': [200,3,4], '2.5': [200,7,8], '4.0': [200,10,11],'6.5': [200,14,15]},
    'M': { '1.0': [315,3,4], '1.5': [315,5,6], '2.5': [315,10,11],'4.0': [315,14,15],'6.5': [315,21,22]},
    'N': { '1.0': [500,5,6], '1.5': [500,7,8], '2.5': [500,14,15],'4.0': [500,21,22],'6.5': [500,21,22]},
    'P': { '1.0': [800,7,8], '1.5': [800,10,11],'2.5': [800,21,22],'4.0': [800,21,22],'6.5': [800,21,22]},
};

function calcularAQL() {
    const cantidadRaw = document.getElementById('cantidad')?.value || '';
    const cantidad = parseInt(cantidadRaw.replace(/[^0-9]/g, ''));
    const aql    = document.getElementById('aqlNivel')?.value || '4.0';
    const nivel  = document.getElementById('aqlNivelInspeccion')?.value || 'II';
    const btn    = document.getElementById('aqlBtn');

    if (!cantidad || cantidad < 2) {
        if (btn) btn.style.display = 'none';
        return;
    }

    const fila  = AQL_LETRAS.ranges.find(r => cantidad >= r.min && cantidad <= r.max)
                || AQL_LETRAS.ranges[AQL_LETRAS.ranges.length - 1];
    const letra = fila[nivel];
    const datos = AQL_MUESTRAS[letra];
    const [muestra, ac, re] = (datos && datos[aql]) ? datos[aql] : [0, 0, 1];

    document.getElementById('aqlMuestra').textContent  = muestra;
    document.getElementById('aqlAceptar').textContent  = ac;
    document.getElementById('aqlRechazar').textContent = re;
    document.getElementById('aqlLetra').textContent    =
        `Código ${letra} · Lote: ${cantidad.toLocaleString()} uds. · Nivel ${nivel}`;

    const resumen = document.getElementById('aqlBtnResumen');
    if (resumen) resumen.textContent = `Revisar ${muestra} uds. · Ac:${ac} Re:${re}`;
    const btnMuestra   = document.getElementById('aqlBtnMuestra');
    const btnAceptar   = document.getElementById('aqlBtnAceptar');
    const btnRechazar  = document.getElementById('aqlBtnRechazar');
    if (btnMuestra)  btnMuestra.textContent  = muestra;
    if (btnAceptar)  btnAceptar.textContent  = ac;
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
function initCalidadForm() {
    const tipoVisita  = document.getElementById('tipoVisita');
    const avanceSlider  = document.getElementById('avanceSlider');
    const avanceValor   = document.getElementById('avanceValor');
    const avancePct     = document.getElementById('avancePorcentaje');

    if (!tipoVisita) return;

    avanceSlider.addEventListener('input', () => {
        avanceValor.textContent = avanceSlider.value + '%';
        avancePct.value = avanceSlider.value;
    });

    tipoVisita.addEventListener('change', _actualizarCamposCalidad);
    _actualizarCamposCalidad();
    calcularAQL();

    // Recalcular AQL cada vez que cambia la cantidad del lote
    const cantidad = document.getElementById('cantidad');
    if (cantidad) cantidad.addEventListener('change', calcularAQL);
}

function _actualizarCamposCalidad() {
    const tipo = (document.getElementById('tipoVisita')?.value || '').toUpperCase();
    const conclusionWrap = document.getElementById('conclusion')?.closest('.mb-3');
    const avanceSection  = document.getElementById('avanceSection');
    const conclusion     = document.getElementById('conclusion');
    const avanceSlider   = document.getElementById('avanceSlider');
    const conclusionLabel = conclusionWrap?.querySelector('label');
    const avanceLabel     = avanceSection?.querySelector('label.form-label');

    const esAuditoria     = tipo === 'AUDITORIA';
    const esRonda         = tipo === 'RONDA';
    const esContramuestra = tipo === 'CONTRAMUESTRA';

    // ── Conclusión ──
    // Visible en AUDITORIA (obligatoria), RONDA y CONTRAMUESTRA (opcional)
    const mostrarConclusion = esAuditoria || esRonda || esContramuestra;
    if (conclusionWrap) conclusionWrap.style.display = mostrarConclusion ? '' : 'none';
    if (conclusion) {
        conclusion.required = esAuditoria;
        if (!mostrarConclusion) conclusion.value = '';
    }
    if (conclusionLabel) {
        if (esAuditoria) {
            conclusionLabel.innerHTML = 'Conclusión: <i class="fas fa-asterisk" style="color:#ef4444;font-size:0.6rem;vertical-align:middle;margin-left:4px;" title="Requerido"></i>';
        } else {
            conclusionLabel.innerHTML = 'Conclusión: <i class="fas fa-circle-minus" style="color:#94a3b8;font-size:0.7rem;vertical-align:middle;margin-left:4px;" title="Opcional"></i>';
        }
    }

    // ── Avance ──
    // Visible en RONDA (obligatorio) y CONTRAMUESTRA (opcional)
    const mostrarAvance = esRonda || esContramuestra;
    if (avanceSection) avanceSection.style.display = mostrarAvance ? '' : 'none';
    if (avanceLabel) {
        if (esRonda) {
            avanceLabel.innerHTML = 'Avance de producción: <i class="fas fa-asterisk" style="color:#ef4444;font-size:0.6rem;vertical-align:middle;margin-left:4px;" title="Requerido"></i>';
        } else {
            avanceLabel.innerHTML = 'Avance de producción: <i class="fas fa-circle-minus" style="color:#94a3b8;font-size:0.7rem;vertical-align:middle;margin-left:4px;" title="Opcional"></i>';
        }
    }
    if (avanceSlider) {
        avanceSlider.required = esRonda;
        avanceSlider.value = 0;
        const avanceValor = document.getElementById('avanceValor');
        const avancePct   = document.getElementById('avancePorcentaje');
        if (avanceValor) avanceValor.textContent = '0%';
        if (avancePct)   avancePct.value = '0';
    }
}

/**
 * Maneja el envío del formulario de Calidad.
 */
async function handleCalidadSubmit(e) {
    e.preventDefault();

    const tipo = (document.getElementById('tipoVisita')?.value || '').toUpperCase();
    const esRonda = tipo === 'RONDA';

    // Validar avance obligatorio en RONDA
    if (esRonda) {
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
        const lotData      = collectLotData();
        const email        = document.getElementById('email').value;
        const localizacion = document.getElementById('localizacion')?.value || 'No disponible';
        const tipoVisita   = document.getElementById('tipoVisita').value;
        const conclusion   = document.getElementById('conclusion').value;
        const observaciones= document.getElementById('observacionesCalidad').value;
        const avance       = document.getElementById('avancePorcentaje')?.value || '';
        const soporteFile  = document.getElementById('soporte').files?.[0] || null;

        console.log('[calidad] Datos recopilados:', {
            lote: lotData.lote,
            tipoVisita,
            tieneSoporte: !!soporteFile
        });

        // 1. Enviar texto inmediatamente sin esperar el soporte
        const payload = {
            hoja: SHEETS_DESTINO.CALIDAD,
            ...lotData,
            email,
            localizacion,
            tipoVisita,
            conclusion,
            avance,
            observaciones,
            soporte: '',   // se actualizará en background
        };

        const result = await sendToGAS(payload);
        
        const idReporte = result.id || result.ID_REPORTE;

        if (!idReporte) {
            throw new Error('No se recibió ID del reporte');
        }

        // 2. UI libre
        Swal.fire({
            title: '¡Reporte guardado!',
            text: 'El reporte de calidad fue guardado exitosamente.',
            icon: 'success',
            timer: 2500,
            showConfirmButton: false,
        });

        e.target.reset();
        if (typeof clearVersionHistory === 'function') clearVersionHistory();
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
