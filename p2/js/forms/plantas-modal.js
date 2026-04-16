/* ==========================================================================
   forms/plantas-modal.js — Modal completo de gestión de plantas
   ========================================================================== */

/**
 * Abre el formulario completo de gestión de planta en un modal
 * @param {Object} plantaData - Datos de la planta a editar (null para crear nueva)
 * @param {Function} onSuccess - Callback a ejecutar después de guardar exitosamente
 */
async function abrirFormularioPlantaCompleto(plantaData = null, onSuccess = null) {
    const isEdit = !!plantaData;
    
    // Leer el HTML del formulario desde index.html
    const formHTML = await fetch('index.html')
        .then(r => r.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const form = doc.getElementById('actualizarDatosSection');
            return form ? form.innerHTML : null;
        });
    
    if (!formHTML) {
        Swal.fire('Error', 'No se pudo cargar el formulario', 'error');
        return;
    }

    // Crear el modal con SweetAlert2
    const { value: confirmed } = await Swal.fire({
        title: isEdit ? 'Editar Planta' : 'Nueva Planta',
        html: `
            <div style="max-height: 70vh; overflow-y: auto; padding: 1rem;">
                ${formHTML}
            </div>
        `,
        width: '900px',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        didOpen: () => {
            // Inicializar máscaras y validaciones
            if (typeof initPlantasMasks === 'function') initPlantasMasks();
            if (typeof initLocationFilters === 'function') initLocationFilters();
            
            // Pre-llenar datos si es edición
            if (isEdit && plantaData) {
                document.getElementById('cedulaPlanta').value = plantaData.ID_PLANTA || '';
                document.getElementById('nombrePlanta').value = plantaData.PLANTA || '';
                document.getElementById('direccionPlanta').value = plantaData.DIRECCION || '';
                document.getElementById('telefonoPlanta').value = plantaData.TELEFONO || '';
                document.getElementById('emailPlanta').value = plantaData.EMAIL || '';
                
                // Campos de ubicación
                if (plantaData.PAIS) document.getElementById('paisPlanta').value = plantaData.PAIS;
                if (plantaData.DEPARTAMENTO) {
                    document.getElementById('departamentoPlanta').value = plantaData.DEPARTAMENTO;
                    document.getElementById('departamentoPlanta').dispatchEvent(new Event('change'));
                }
                
                // Esperar a que se carguen las ciudades
                setTimeout(() => {
                    if (plantaData.CIUDAD) {
                        document.getElementById('ciudadPlanta').value = plantaData.CIUDAD;
                        document.getElementById('ciudadPlanta').dispatchEvent(new Event('change'));
                    }
                    
                    // Esperar a que se carguen los barrios
                    setTimeout(() => {
                        if (plantaData.BARRIO) {
                            const barrioSelect = document.getElementById('barrioPlanta');
                            const barrioExists = Array.from(barrioSelect.options).some(opt => opt.value === plantaData.BARRIO);
                            if (barrioExists) {
                                barrioSelect.value = plantaData.BARRIO;
                            } else {
                                // Usar entrada manual
                                document.getElementById('barrioPlantaManual').value = plantaData.BARRIO;
                                toggleBarrioManual();
                            }
                        }
                        if (plantaData.COMUNA) document.getElementById('comunaPlanta').value = plantaData.COMUNA;
                    }, 200);
                }, 200);
                
                if (plantaData.CONTACTO) document.getElementById('contactoPlanta').value = plantaData.CONTACTO;
                if (plantaData.LOCALIZACION) document.getElementById('localizacionPlanta').value = plantaData.LOCALIZACION;
            }
        },
        preConfirm: () => {
            // Validar campos obligatorios
            const cedula = document.getElementById('cedulaPlanta').value.trim();
            const nombre = document.getElementById('nombrePlanta').value.trim();
            const direccion = document.getElementById('direccionPlanta').value.trim();
            const telefono = document.getElementById('telefonoPlanta').value.replace(/\D/g, '');
            const email = document.getElementById('emailPlanta').value.trim();
            const departamento = document.getElementById('departamentoPlanta').value;
            const ciudad = document.getElementById('ciudadPlanta').value;
            const barrio = document.getElementById('barrioPlanta').value || document.getElementById('barrioPlantaManual').value;
            
            if (!cedula || !nombre || !direccion || !telefono || !email || !departamento || !ciudad || !barrio) {
                Swal.showValidationMessage('Por favor complete todos los campos obligatorios');
                return false;
            }
            
            // Validar checkboxes
            const checkPolitica = document.getElementById('checkPoliticaDatos');
            const checkNotif = document.getElementById('checkNotificaciones');
            
            if (!checkPolitica.checked || !checkNotif.checked) {
                Swal.showValidationMessage('Debe aceptar la política de datos y las notificaciones');
                return false;
            }
            
            // Recopilar todos los datos
            return {
                cedula,
                nombre,
                direccion,
                telefono,
                email,
                pais: document.getElementById('paisPlanta').value,
                departamento,
                ciudad,
                barrio,
                comuna: document.getElementById('comunaPlanta').value,
                contacto: document.getElementById('contactoPlanta').value,
                localizacion: document.getElementById('localizacionPlanta').value,
                notificaciones: checkNotif.checked
            };
        }
    });
    
    if (confirmed) {
        try {
            Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
            
            const payload = {
                accion: isEdit ? 'ACTUALIZAR_PLANTA' : 'CREAR_PLANTA',
                id: confirmed.cedula,
                planta: confirmed.nombre,
                direccion: confirmed.direccion,
                telefono: confirmed.telefono,
                email: confirmed.email,
                pais: confirmed.pais,
                departamento: confirmed.departamento,
                ciudad: confirmed.ciudad,
                barrio: confirmed.barrio,
                comuna: confirmed.comuna,
                contacto: confirmed.contacto,
                localizacion: confirmed.localizacion,
                notificaciones: confirmed.notificaciones,
                rol: 'GUEST'
            };
            
            const response = await sendToGAS(payload);
            
            if (response.success) {
                Swal.fire('✔ ¡Hecho!', 'Planta guardada correctamente', 'success');
                if (onSuccess) onSuccess();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
        }
    }
}
