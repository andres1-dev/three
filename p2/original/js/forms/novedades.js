/* ==========================================================================
   forms/novedades.js — Formulario de Reporte de Novedades
   Depende de: forms/gas.js  (collectLotData, fileToBase64, sendToGAS)
               config.js     (SHEETS_DESTINO)
               ui.js         (hideSections)
   ========================================================================== */

/**
 * Maneja el envío del formulario de Novedades.
 * Recoge área, descripción, cantidad e imagen; construye el payload
 * y lo envía al GAS → hoja "NOVEDADES".
 * @param {Event} e
 */
async function handleNovedadesSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        // ── Datos del lote seleccionado ──
        const lotData = collectLotData();
        const area               = document.getElementById('area').value;
        const descripcion        = document.getElementById('observacionesNovedad').value;
        const cantidadSolicitada = document.getElementById('cantidadSolicitada').value;
        const imagenFile         = document.getElementById('imagen').files?.[0] || null;

        // 1. Enviar texto inmediatamente sin esperar la imagen
        const payload = {
            hoja: SHEETS_DESTINO.NOVEDADES,
            ...lotData,
            area,
            descripcion,
            cantidadSolicitada,
            imagen: '',   // se actualizará en background
        };

        const result = await sendToGAS(payload);
        const idNovedad = result.id || result.ID_NOVEDAD;

        // 2. UI libre — el usuario puede seguir
        Swal.fire({
            title: '¡Novedad registrada!',
            text: 'La novedad fue guardada exitosamente.',
            icon: 'success',
            timer: 2500,
            showConfirmButton: false,
        });

        e.target.reset();
        if (typeof clearVersionHistory === 'function') clearVersionHistory();
        hideSections();

        // 3. Subir imagen en background (no bloquea)
        if (imagenFile && idNovedad) {
            uploadArchivoAsync(imagenFile, idNovedad, SHEETS_DESTINO.NOVEDADES);
        }

    } catch (error) {
        console.error('[novedades] Error al enviar:', error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo enviar el reporte. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'OK',
        });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Reporte';
    }
}
