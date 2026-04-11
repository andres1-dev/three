/* ==========================================================================
   forms/plantas.js — Formulario de Actualizar Datos de Planta
   ========================================================================== */

function initPlantasMasks() {
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput    = document.getElementById('emailPlanta');

    if (telefonoInput) {
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
}

document.addEventListener('DOMContentLoaded', initPlantasMasks);

/**
 * Maneja el envío del formulario de Actualizar Datos de Planta.
 */
async function handleActualizarDatosSubmit(e) {
    e.preventDefault();

    const btn      = e.target.querySelector('button[type="submit"]');
    const inputTel = document.getElementById('telefonoPlanta');
    const inputCed = document.getElementById('cedulaPlanta');

    const rawTelefono  = inputTel.value.replace(/\D/g, '');
    const rawCedula    = inputCed.value.replace(/\D/g, '');
    const nombrePlanta = document.getElementById('nombrePlanta').value;
    const direccion    = document.getElementById('direccionPlanta').value;
    const emailPlanta  = document.getElementById('emailPlanta').value;

    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    // 1. Actualizar localStorage ANTES de esperar al GAS — la UI se desbloquea al instante
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.ROL === 'GUEST') {
        currentUser.EMAIL     = emailPlanta;
        currentUser.TELEFONO  = rawTelefono;
        currentUser.DIRECCION = direccion;
        localStorage.setItem('sispro_user', JSON.stringify(currentUser));
    }

    const nuevaPlanta = { ID_PLANTA: rawCedula, PLANTA: nombrePlanta, DIRECCION: direccion, TELEFONO: rawTelefono, EMAIL: emailPlanta };
    const idx = currentPlantas.findIndex(p => p.PLANTA === nombrePlanta);
    if (idx !== -1) currentPlantas[idx] = nuevaPlanta;
    else currentPlantas.push(nuevaPlanta);

    // 2. Mostrar éxito y recargar sin esperar al GAS
    Swal.fire({
        title: '¡Datos guardados!',
        text: 'Tu información ha sido registrada.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
    });

    setTimeout(() => window.location.reload(), 1500);

    // 3. Sincronizar con Supabase en background (no bloquea la UI)
    const payload = {
        accion: 'ACTUALIZAR_PLANTA',
        id: rawCedula, // El Edge Function busca 'id'
        nombrePlanta: nombrePlanta,
        direccion: direccion,
        telefono: rawTelefono,
        email: emailPlanta,
        // No enviamos rol ni contraseña para no sobreescribir con null
    };
    sendToSupabase(payload).catch(err => console.warn('[plantas] Sync Supabase falló:', err));
}
