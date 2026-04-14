/* ==========================================================================
   forms/dropzone.js — Lógica del selector de archivos personalizado
   Conecta cada .file-dropzone con su <input type="file"> oculto,
   y muestra el nombre del archivo seleccionado en la UI.
   Incluye validación de duración para videos (máx 10 segundos).

   Llamado desde app.js → initDropzones() en window.onload.
   ========================================================================== */

/**
 * Inicializa todos los dropzones de la página.
 * Cada dropzone necesita:
 *   - Un <div class="file-dropzone"> con data-input="#idDelInput"
 *   - Un <span class="file-dropzone__name"> dentro para mostrar el nombre
 *   - Un <input type="file" class="file-dropzone__input"> hermano
 */
function initDropzones() {
    // Par imagen
    _bindDropzone('imagenDropzone', 'imagen', 'imagenName', false);
    // Par soporte (solo imágenes)
    _bindDropzone('soporteDropzone', 'soporte', 'soporteName', false);
}

/**
 * Valida la duración de un archivo de video.
 * @param {File} file - Archivo de video a validar
 * @returns {Promise<boolean>} - true si es válido (≤10 seg), false si no
 */
async function validateVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            const duration = video.duration;
            
            if (duration > 10) {
                Swal.fire({
                    title: 'Video muy largo',
                    text: `El video tiene ${duration.toFixed(1)} segundos. El máximo permitido es 10 segundos.`,
                    icon: 'warning',
                    confirmButtonColor: '#3F51B5'
                });
                resolve(false);
            } else {
                resolve(true);
            }
        };
        
        video.onerror = function() {
            window.URL.revokeObjectURL(video.src);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo validar el video. Intente con otro archivo.',
                icon: 'error',
                confirmButtonColor: '#3F51B5'
            });
            resolve(false);
        };
        
        video.src = URL.createObjectURL(file);
    });
}

/**
 * Conecta un dropzone con su input nativo.
 * @param {string} zoneId   — ID del div.file-dropzone
 * @param {string} inputId  — ID del input[type="file"] real
 * @param {string} nameId   — ID del span que muestra el nombre
 * @param {boolean} validateVideo — Si debe validar duración de videos
 */
function _bindDropzone(zoneId, inputId, nameId, validateVideo = false) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const nameEl = document.getElementById(nameId);

    if (!zone || !input) return;

    // Click en la zona → abrir selector de archivos
    zone.addEventListener('click', () => input.click());

    // Teclado (accesibilidad): Enter / Espacio activan el selector
    zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.click();
        }
    });

    // Cuando el usuario elige un archivo
    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (file) {
            // Validar tamaño (10MB máximo)
            if (file.size > 10 * 1024 * 1024) {
                Swal.fire({
                    title: 'Archivo muy grande',
                    text: 'El archivo no debe superar los 10MB.',
                    icon: 'warning',
                    confirmButtonColor: '#3F51B5'
                });
                input.value = '';
                zone.classList.remove('has-file');
                if (nameEl) nameEl.textContent = '';
                return;
            }

            // Si es video y debe validarse, verificar duración (no bloqueante)
            if (validateVideo && file.type.startsWith('video/')) {
                validateVideoDuration(file).then(isValid => {
                    if (!isValid) {
                        input.value = '';
                        zone.classList.remove('has-file');
                        if (nameEl) nameEl.textContent = '';
                    } else {
                        // Archivo válido
                        zone.classList.add('has-file');
                        if (nameEl) nameEl.textContent = file.name;
                    }
                });
                return;
            }

            // Archivo válido (no es video o no requiere validación)
            zone.classList.add('has-file');
            if (nameEl) nameEl.textContent = file.name;
        } else {
            zone.classList.remove('has-file');
            if (nameEl) nameEl.textContent = '';
        }
    });

    // Drag & Drop (bonus UX)
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('has-file');     // feedback visual
    });

    zone.addEventListener('dragleave', () => {
        if (!input.files || !input.files[0]) {
            zone.classList.remove('has-file');
        }
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files[0]) {
            const file = files[0];
            
            // Validar tamaño
            if (file.size > 10 * 1024 * 1024) {
                Swal.fire({
                    title: 'Archivo muy grande',
                    text: 'El archivo no debe superar los 10MB.',
                    icon: 'warning',
                    confirmButtonColor: '#3F51B5'
                });
                return;
            }

            // Si es video y debe validarse, verificar duración (no bloqueante)
            if (validateVideo && file.type.startsWith('video/')) {
                validateVideoDuration(file).then(isValid => {
                    if (isValid) {
                        _assignFileToInput(file, input, zone, nameEl);
                    }
                });
                return;
            }

            // Archivo válido (no es video o no requiere validación)
            _assignFileToInput(file, input, zone, nameEl);
        }
    });
}

/**
 * Asigna un archivo al input (helper para evitar duplicación de código)
 */
function _assignFileToInput(file, input, zone, nameEl) {
    try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        zone.classList.add('has-file');
        if (nameEl) nameEl.textContent = file.name;
    } catch (_) {
        // Fallback: algunos navegadores no permiten asignar input.files
    }
}
