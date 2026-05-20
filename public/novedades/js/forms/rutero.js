/* ==========================================================================
   forms/rutero.js — Formulario de Rutero (Agenda de Visitas)
   Depende de: forms/gas.js (collectLotData, sendToGAS)
               config.js   (SHEETS_DESTINO)
               ui.js       (hideSections)
   ========================================================================== */

/**
 * Inicializa el formulario de rutero: pre-llena la fecha con mañana por defecto.
 */
function initRuteroForm() {
    const fechaInput = document.getElementById('ruteroFechaVisita');
    if (fechaInput) {
        const now = new Date();
        const bogotaDateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(now);
        const parts = bogotaDateStr.split('-');
        const localDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        localDate.setDate(localDate.getDate() + 1);
        
        const yyyy = localDate.getFullYear();
        const mm = String(localDate.getMonth() + 1).padStart(2, '0');
        const dd = String(localDate.getDate()).padStart(2, '0');
        fechaInput.value = `${yyyy}-${mm}-${dd}`;
    }

    // Sync cantidad from the already-selected lote
    const cantidadLote = document.getElementById('cantidad');
    const ruteroCantidad = document.getElementById('ruteroCantidad');
    if (ruteroCantidad && cantidadLote) {
        ruteroCantidad.value = cantidadLote.value || '';
    }

    // Registrar submit solo una vez
    const form = document.getElementById('ruteroForm');
    if (form && !form._ruteroListenerAttached) {
        form.addEventListener('submit', handleRuteroSubmit);
        form._ruteroListenerAttached = true;
    }
}

/**
 * Maneja el envío del formulario de Rutero.
 */
async function handleRuteroSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const lotData = collectLotData();
        const auditor = (typeof currentUser !== 'undefined' && currentUser)
            ? (currentUser.USUARIO || currentUser.PLANTA || '')
            : '';

        const payload = {
            hoja: SHEETS_DESTINO.RUTERO,
            auditor,
            fechaVisita: document.getElementById('ruteroFechaVisita').value,
            tipoVisita: document.getElementById('ruteroTipoVisita').value,
            destino: document.getElementById('ruteroDestino').value,
            cantidad: document.getElementById('ruteroCantidad').value,
            ...lotData,
        };

        await sendToGAS(payload);

        Swal.fire({
            title: 'Visita Agendada',
            text: `La OP ${lotData.lote} fue agregada al rutero del ${payload.fechaVisita}.`,
            icon: 'success',
            confirmButtonColor: '#3F51B5',
            confirmButtonText: 'OK',
        });

        e.target.reset();
        hideSections();

    } catch (error) {
        Swal.fire({
            title: 'Error',
            text: 'No se pudo guardar la visita. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'OK',
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}
