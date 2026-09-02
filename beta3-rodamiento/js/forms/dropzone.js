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
        // Manejo especial multi-archivo para Soporte de Calidad
        if (inputId === 'soporte') {
            const files = Array.from(input.files || []);
            const esMultiple = input.hasAttribute('multiple');
            
            if (files.length > 0) {
                window._calidadSoporteFiles = window._calidadSoporteFiles || [];
                
                // Si no es multiple, reemplazar el array completo con solo el primer archivo
                if (!esMultiple) {
                    window._calidadSoporteFiles = [];
                }
                
                files.forEach(f => {
                    if (f.size > 10 * 1024 * 1024) {
                        Swal.fire({
                            title: 'Archivo muy grande',
                            text: `"${f.name}" supera los 10MB.`,
                            icon: 'warning',
                            confirmButtonColor: '#3F51B5'
                        });
                        return;
                    }
                    
                    // Si no es multiple, solo agregar si el array está vacío
                    if (!esMultiple && window._calidadSoporteFiles.length > 0) {
                        return;
                    }
                    
                    window._calidadSoporteFiles.push(f);
                });
                
                renderCalidadSoporteMultiPreviews();
                input.value = ''; // Permite agregar más fotos en selecciones consecutivas (solo en modo múltiple)
            }
            return;
        }

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
            // Solo limpiar si no hay preview restaurado desde localStorage
            const preview = document.getElementById(inputId + 'Preview');
            if (!preview || preview.style.display === 'none') {
                zone.classList.remove('has-file');
                if (nameEl) nameEl.textContent = '';
            }
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

// ── Multi-preview helper para Soporte de Calidad ──
window._calidadSoporteFiles = [];

function renderCalidadSoporteMultiPreviews() {
    const container = document.getElementById('soporteMultiPreview');
    const legacyPreview = document.getElementById('soportePreview');
    const nameEl = document.getElementById('soporteName');
    const icon = document.getElementById('soporteIcon');
    const text = document.getElementById('soporteText');
    const zone = document.getElementById('soporteDropzone');
    const soporteInput = document.getElementById('soporte');

    if (!container) return;

    const esMultiple = soporteInput && soporteInput.hasAttribute('multiple');

    if (!window._calidadSoporteFiles || window._calidadSoporteFiles.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        if (legacyPreview) legacyPreview.style.display = 'none';
        if (icon) icon.style.display = 'block';
        if (text) text.style.display = 'block';
        if (nameEl) nameEl.textContent = '';
        if (zone) zone.classList.remove('has-file');
        return;
    }

    if (icon) icon.style.display = 'none';
    if (text) text.style.display = 'none';
    if (legacyPreview) legacyPreview.style.display = 'none';
    if (zone) zone.classList.add('has-file');
    
    const numFotos = window._calidadSoporteFiles.length;
    const mensajeAdicional = esMultiple ? '(Toca para agregar más)' : '(Toca para cambiar)';
    
    if (nameEl) {
        nameEl.innerHTML = `<span style="color:#10b981; font-weight:700;"><i class="fas fa-check-circle me-1"></i> ${numFotos} foto(s) adjunta(s)</span> <small style="color:#64748b; margin-left:6px; font-weight:500;">${mensajeAdicional}</small>`;
    }

    container.style.display = 'grid';
    container.innerHTML = '';

    window._calidadSoporteFiles.forEach((file, index) => {
        const thumbDiv = document.createElement('div');
        thumbDiv.style.cssText = 'position:relative; width:100%; height:75px; border-radius:8px; overflow:hidden; border:1.5px solid #cbd5e1; background:#f8fafc;';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';

        const btnRemove = document.createElement('button');
        btnRemove.type = 'button';
        btnRemove.innerHTML = '<i class="fas fa-times"></i>';
        btnRemove.title = 'Eliminar foto';
        btnRemove.style.cssText = 'position:absolute; top:3px; right:3px; width:20px; height:20px; border-radius:50%; background:rgba(220,38,38,0.9); color:white; border:none; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.3); z-index:2;';
        
        btnRemove.onclick = (e) => {
            e.stopPropagation(); // Evitar abrir selector de archivos al hacer click en eliminar
            removeSoporteFileByIndex(index);
        };

        const badge = document.createElement('span');
        badge.textContent = `${index + 1}`;
        badge.style.cssText = 'position:absolute; bottom:3px; left:3px; background:rgba(15,23,42,0.75); color:white; font-size:9px; font-weight:700; padding:1px 5px; border-radius:10px; z-index:2;';

        thumbDiv.appendChild(img);
        thumbDiv.appendChild(btnRemove);
        thumbDiv.appendChild(badge);
        container.appendChild(thumbDiv);
    });
}

function removeSoporteFileByIndex(index) {
    if (window._calidadSoporteFiles && window._calidadSoporteFiles[index]) {
        window._calidadSoporteFiles.splice(index, 1);
        renderCalidadSoporteMultiPreviews();
    }
}

window.renderCalidadSoporteMultiPreviews = renderCalidadSoporteMultiPreviews;
window.removeSoporteFileByIndex = removeSoporteFileByIndex;

