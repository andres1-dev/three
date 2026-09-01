/* ==========================================================================
   forms/dropzone.js — Lógica del selector de archivos personalizado
   Conecta cada .file-dropzone con su <input type="file"> oculto,
   y muestra el nombre del archivo seleccionado en la UI.
   Incluye validación de duración para videos (máx 10 segundos).
   En Android: el dropzone se divide en dos mitades (Cámara | Galería).
   En iOS y PC: dropzone normal de un solo clic.

   Llamado desde app.js → initDropzones() en window.onload.
   ========================================================================== */

/**
 * Detecta si el dispositivo es Android.
 * iOS y PC NO necesitan el split; en iOS el selector nativo ya ofrece ambas opciones.
 */
function isAndroidDevice() {
    return /android/i.test(navigator.userAgent);
}

/**
 * Inicializa todos los dropzones de la página.
 * Si es Android, aplica el diseño dividido (Cámara | Galería).
 * En cualquier otro dispositivo, comportamiento normal de clic único.
 */
function initDropzones() {
    const android = isAndroidDevice();

    if (android) {
        // Imagen (novedades): split con cámara directa y galería single
        _bindDropzoneSplit('imagenDropzone', {
            cameraInputId:  'imagenCamera',
            galleryInputId: 'imagen',
            mainInputId:    'imagen',     // input que leen los handlers de envío
            multiGallery:   false,
        });
        // Soporte (calidad): split dinámico — galería abre single o múltiple según conclusión
        _bindDropzoneSplit('soporteDropzone', {
            cameraInputId:  'soporteCamera',
            galleryInputId: 'soporte',
            mainInputId:    'soporte',
            multiGallery:   true,         // usa abrirSoporteGaleria() para elegir single/múltiple
        });
    } else {
        // iOS / PC: dropzone normal
        _bindDropzone('imagenDropzone', 'imagen', 'imagenName', false);
        _bindDropzone('soporteDropzone', 'soporte', 'soporteName', false);
        // Conectar el input múltiple al mismo dropzone de soporte (para modo RECHAZADO en PC/iOS)
        _bindExtraInput('soporteMultiple', 'soporteDropzone', 'soporteName', 'soporte');
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SPLIT DROPZONE — solo Android
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Transforma un dropzone en dos mitades: [📷 Cámara] | [🖼️ Galería]
 * @param {string} zoneId
 * @param {object} opts
 *   - cameraInputId:  input con capture="environment"
 *   - galleryInputId: input sin capture (single o múltiple según contexto)
 *   - mainInputId: input que usan los handlers de envío para leer el archivo
 *   - multiGallery: si true, el botón Galería llama a abrirSoporteGaleria()
 */
function _bindDropzoneSplit(zoneId, opts) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    // Quitar comportamiento de clic genérico
    zone.removeAttribute('tabindex');
    zone.style.cursor = 'default';

    // Determinar IDs de elementos según el dropzone
    const isImagenDropzone = (zoneId === 'imagenDropzone');
    const nameId      = isImagenDropzone ? 'imagenName' : 'soporteName';
    const previewId   = isImagenDropzone ? 'imagenPreview' : 'soportePreview';
    const multiPrevId = 'soporteMultiPreview';  // solo soporte tiene múltiple
    const iconId      = isImagenDropzone ? 'imagenIcon' : 'soporteIcon';
    const textId      = isImagenDropzone ? 'imagenText' : 'soporteText';

    // Inyectar estructura de dos mitades + contenedores de preview preservados
    zone.classList.add('file-dropzone--split');
    zone.innerHTML = `
        <div class="file-dropzone__half" id="${zoneId}HalfCamera" role="button" tabindex="0"
             aria-label="Abrir cámara">
            <i class="fas fa-camera file-dropzone__half-icon"></i>
            <span class="file-dropzone__half-label">Cámara</span>
            <span class="file-dropzone__half-hint">Tomar foto</span>
        </div>
        <div class="file-dropzone__divider"></div>
        <div class="file-dropzone__half" id="${zoneId}HalfGallery" role="button" tabindex="0"
             aria-label="Abrir galería">
            <i class="fas fa-images file-dropzone__half-icon"></i>
            <span class="file-dropzone__half-label" id="${zoneId}GalleryLabel">Galería</span>
            <span class="file-dropzone__half-hint" id="${zoneId}GalleryHint">Elegir foto</span>
        </div>
        <!-- Contenedor de preview single (imagen novedad o soporte single) -->
        <div class="file-dropzone__split-preview-container" style="display:none; flex-direction:column; align-items:center; gap:12px; padding:16px; width:100%;"></div>
        <!-- Elementos necesarios para renderCalidadSoporteMultiPreviews (solo soporte) -->
        ${!isImagenDropzone ? `
            <span class="file-dropzone__name" id="${nameId}" style="display:none;"></span>
            <i class="fas fa-images file-dropzone__icon" id="${iconId}" style="display:none;"></i>
            <div class="file-dropzone__text" id="${textId}" style="display:none;"></div>
            <div id="${multiPrevId}" style="display: none; width: 100%; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 8px; margin-top: 10px;"></div>
            <img id="${previewId}" style="display: none; max-width: 100%; max-height: 200px; border-radius: 8px; object-fit: contain;" />
        ` : ''}
    `;

    const halfCamera  = document.getElementById(`${zoneId}HalfCamera`);
    const halfGallery = document.getElementById(`${zoneId}HalfGallery`);
    const cameraInput = document.getElementById(opts.cameraInputId);

    // ── Mitad Cámara ──
    function openCamera() { if (cameraInput) cameraInput.click(); }
    halfCamera.addEventListener('click', openCamera);
    halfCamera.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCamera(); } });

    // ── Mitad Galería ──
    function openGallery() {
        if (opts.multiGallery && typeof abrirSoporteGaleria === 'function') {
            abrirSoporteGaleria();
        } else {
            const inp = document.getElementById(opts.galleryInputId);
            if (inp) inp.click();
        }
    }
    halfGallery.addEventListener('click', openGallery);
    halfGallery.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGallery(); } });

    // ── Escuchar cambios en ambos inputs y actualizar UI ──
    function handleFileChosen(file, fromCamera) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            Swal.fire({ title: 'Archivo muy grande', text: 'El archivo no debe superar los 10MB.', icon: 'warning', confirmButtonColor: '#3F51B5' });
            return;
        }

        if (opts.mainInputId === 'soporte') {
            // Delegar al acumulador del soporte
            const esRechazado = (document.getElementById('conclusion')?.value || '') === 'RECHAZADO';
            window._calidadSoporteFiles = window._calidadSoporteFiles || [];
            if (!esRechazado) {
                window._calidadSoporteFiles = [file];
            } else {
                window._calidadSoporteFiles.push(file);
            }
            renderCalidadSoporteMultiPreviews();
        } else {
            // Imagen novedad: copiar al input principal y mostrar preview
            try {
                const dt = new DataTransfer();
                dt.items.add(file);
                const mainInput = document.getElementById(opts.mainInputId);
                if (mainInput) mainInput.files = dt.files;
            } catch (_) {}
            _showSplitSinglePreview(zoneId, file.name, file);
            zone.classList.add('has-file');
            if (typeof mostrarImagenPreview === 'function') mostrarImagenPreview(opts.mainInputId);
        }
    }

    if (cameraInput) {
        cameraInput.addEventListener('change', () => {
            const f = cameraInput.files && cameraInput.files[0];
            handleFileChosen(f, true);
            cameraInput.value = '';
        });
    }

    // Escuchar inputs de galería (single y múltiple)
    ['soporte', 'imagen', 'soporteMultiple'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp && (id === opts.galleryInputId || id === opts.mainInputId || id === 'soporteMultiple')) {
            inp.addEventListener('change', () => {
                const files = Array.from(inp.files || []);
                if (!files.length) return;
                if (opts.mainInputId === 'soporte') {
                    // Acumular/reemplazar según modo
                    const esRechazado = (document.getElementById('conclusion')?.value || '') === 'RECHAZADO';
                    window._calidadSoporteFiles = window._calidadSoporteFiles || [];
                    files.forEach(f => {
                        if (f.size > 10 * 1024 * 1024) { return; }
                        if (!esRechazado) { window._calidadSoporteFiles = [f]; }
                        else { window._calidadSoporteFiles.push(f); }
                    });
                    renderCalidadSoporteMultiPreviews();
                } else {
                    handleFileChosen(files[0], false);
                }
                inp.value = '';
            });
        }
    });
}

/**
 * Muestra una imagen seleccionada dentro del split dropzone (modo single).
 * Oculta las dos mitades y muestra el preview centrado con el nombre del archivo.
 */
function _showSplitSinglePreview(zoneId, fileName, file) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    // Ocultar mitades y divisor
    const hc  = document.getElementById(`${zoneId}HalfCamera`);
    const hg  = document.getElementById(`${zoneId}HalfGallery`);
    const div = zone.querySelector('.file-dropzone__divider');

    if (hc)  hc.style.display  = 'none';
    if (hg)  hg.style.display  = 'none';
    if (div) div.style.display = 'none';

    // Crear/mostrar preview con imagen, nombre y botón cambiar
    let previewContainer = zone.querySelector('.file-dropzone__split-preview-container');
    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'file-dropzone__split-preview-container';
        previewContainer.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:12px; padding:16px; width:100%;';
        zone.appendChild(previewContainer);
    }

    previewContainer.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = e => {
        previewContainer.innerHTML = `
            <img src="${e.target.result}" style="max-width:100%; max-height:180px; border-radius:8px; object-fit:contain; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
            <span style="font-size:0.85rem; font-weight:600; color:#10b981; text-align:center;">
                <i class="fas fa-check-circle"></i> ${fileName}
            </span>
            <button type="button" onclick="_clearSplitDropzone('${zoneId}')"
                style="font-size:0.75rem; color:#ef4444; background:none; border:none; cursor:pointer; font-weight:700; display:flex; align-items:center; gap:4px;">
                <i class="fas fa-times-circle"></i> Cambiar foto
            </button>`;
    };
    reader.readAsDataURL(file);
}

/**
 * Restaura el split dropzone a su estado vacío (ambas mitades visibles).
 */
function _clearSplitDropzone(zoneId) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    const hc     = document.getElementById(`${zoneId}HalfCamera`);
    const hg     = document.getElementById(`${zoneId}HalfGallery`);
    const div    = zone.querySelector('.file-dropzone__divider');
    const prevContainer = zone.querySelector('.file-dropzone__split-preview-container');

    if (hc)   { hc.style.display  = ''; }
    if (hg)   { hg.style.display  = ''; }
    if (div)  { div.style.display = ''; }
    if (prevContainer) { prevContainer.style.display = 'none'; prevContainer.innerHTML = ''; }

    zone.classList.remove('has-file');

    // Limpiar input principal
    const mainId = zoneId === 'imagenDropzone' ? 'imagen' : 'soporte';
    const inp = document.getElementById(mainId);
    if (inp) inp.value = '';

    // Si es soporte, limpiar acumulados y rotaciones
    if (mainId === 'soporte') {
        window._calidadSoporteFiles = [];
        window._calidadSoporteRotaciones = {};
        if (typeof renderCalidadSoporteMultiPreviews === 'function') renderCalidadSoporteMultiPreviews();
    }
}
window._clearSplitDropzone = _clearSplitDropzone;

/* ─────────────────────────────────────────────────────────────────────────────
   DROPZONE NORMAL — iOS / PC
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Conecta un input extra (p.ej. soporteMultiple en PC/iOS) a un dropzone,
 * de modo que al seleccionar archivos actualice la misma UI del dropzone principal.
 */
function _bindExtraInput(extraInputId, zoneId, nameId, mainInputId) {
    const input  = document.getElementById(extraInputId);
    const zone   = document.getElementById(zoneId);
    if (!input || !zone) return;

    input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        if (!files.length) return;

        window._calidadSoporteFiles = window._calidadSoporteFiles || [];
        const esRechazado = (document.getElementById('conclusion')?.value || '') === 'RECHAZADO';
        files.forEach(f => {
            if (f.size > 10 * 1024 * 1024) {
                Swal.fire({ title: 'Archivo muy grande', text: `"${f.name}" supera los 10MB.`, icon: 'warning', confirmButtonColor: '#3F51B5' });
                return;
            }
            if (!esRechazado) { window._calidadSoporteFiles = [f]; }
            else              { window._calidadSoporteFiles.push(f); }
        });
        renderCalidadSoporteMultiPreviews();
        input.value = '';
    });
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
            if (files.length > 0) {
                const esRechazado = (document.getElementById('conclusion')?.value || '') === 'RECHAZADO';
                window._calidadSoporteFiles = window._calidadSoporteFiles || [];
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
                    if (esRechazado) {
                        // Acumular fotos en modo RECHAZADO
                        window._calidadSoporteFiles.push(f);
                    } else {
                        // Reemplazar la foto en cualquier otro estado
                        window._calidadSoporteFiles = [f];
                    }
                });
                renderCalidadSoporteMultiPreviews();
                input.value = ''; // Permite agregar más fotos en selecciones consecutivas
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

    if (!container) return;

    const esRechazado = (document.getElementById('conclusion')?.value || '') === 'RECHAZADO';
    const isAndroid = isAndroidDevice();

    // En Android con split, controlar visibilidad de mitades
    const halfCamera  = document.getElementById('soporteDropzoneHalfCamera');
    const halfGallery = document.getElementById('soporteDropzoneHalfGallery');
    const divider     = zone?.querySelector('.file-dropzone__divider');

    if (!window._calidadSoporteFiles || window._calidadSoporteFiles.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        if (legacyPreview) { legacyPreview.style.display = 'none'; legacyPreview.src = ''; }
        if (icon) icon.style.display = 'block';
        if (text) text.style.display = 'block';
        if (nameEl) nameEl.textContent = '';
        if (zone) zone.classList.remove('has-file');
        // Restaurar mitades en Android
        if (isAndroid && halfCamera && halfGallery) {
            halfCamera.style.display = '';
            halfGallery.style.display = '';
            if (divider) divider.style.display = '';
        }
        return;
    }

    if (icon) icon.style.display = 'none';
    if (text) text.style.display = 'none';
    if (zone) zone.classList.add('has-file');

    // Ocultar mitades si hay fotos en Android split
    if (isAndroid && halfCamera && halfGallery) {
        halfCamera.style.display = 'none';
        halfGallery.style.display = 'none';
        if (divider) divider.style.display = 'none';
    }

    if (!esRechazado || window._calidadSoporteFiles.length === 1) {
        // ── Modo single: mostrar una imagen grande centrada con botones girar + limpiar ──
        container.innerHTML = '';
        container.style.display = 'none';
        const file = window._calidadSoporteFiles[0];
        if (legacyPreview) {
            const reader = new FileReader();
            reader.onload = e => {
                legacyPreview.src = e.target.result;
                legacyPreview.style.display = 'block';
                // Restaurar rotación si existe
                if (window._calidadSoporteRotaciones && window._calidadSoporteRotaciones[0]) {
                    legacyPreview.style.transform = `rotate(${window._calidadSoporteRotaciones[0]}deg)`;
                } else {
                    legacyPreview.style.transform = '';
                }
            };
            reader.readAsDataURL(file);
        }
        if (nameEl) {
            nameEl.style.display = 'block';
            nameEl.innerHTML = `
                <span style="color:#10b981; font-weight:700;">
                    <i class="fas fa-check-circle me-1"></i> ${file.name}
                </span>
                <div style="display:inline-flex; gap:8px; margin-left:12px;">
                    <button type="button" onclick="rotarSoporteIndividual(0)" 
                        style="font-size:0.7rem; color:#64748b; background:none; border:none; cursor:pointer; padding:2px 6px;" 
                        title="Girar foto">
                        <i class="fas fa-undo"></i> Girar
                    </button>
                    <button type="button" onclick="removeSoporteFileByIndex(0)" 
                        style="font-size:0.7rem; color:#ef4444; background:none; border:none; cursor:pointer; padding:2px 6px;" 
                        title="Eliminar foto">
                        <i class="fas fa-times-circle"></i> Eliminar
                    </button>
                </div>
            `;
        }
        return;
    }

    // ── Modo múltiple (RECHAZADO con >1 fotos): grid de miniaturas con botones individuales ──
    if (legacyPreview) { legacyPreview.style.display = 'none'; legacyPreview.src = ''; }
    if (nameEl) {
        nameEl.style.display = 'block';
        nameEl.innerHTML = `<span style="color:#10b981; font-weight:700;"><i class="fas fa-check-circle me-1"></i> ${window._calidadSoporteFiles.length} foto(s) adjunta(s)</span> <small style="color:#64748b; margin-left:6px; font-weight:500;">(Toca para agregar más)</small>`;
    }

    container.style.display = 'grid';
    container.innerHTML = '';

    window._calidadSoporteFiles.forEach((file, index) => {
        const thumbDiv = document.createElement('div');
        thumbDiv.style.cssText = 'position:relative; width:100%; height:90px; border-radius:8px; overflow:visible; border:1.5px solid #cbd5e1; background:#f8fafc; display:flex; flex-direction:column;';

        // Contenedor de imagen
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'flex:1; position:relative; overflow:hidden;';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.id = `soporteThumb${index}`;
        img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
        
        // Restaurar rotación si existe
        if (window._calidadSoporteRotaciones && window._calidadSoporteRotaciones[index]) {
            img.style.transform = `rotate(${window._calidadSoporteRotaciones[index]}deg)`;
        }
        
        imgContainer.appendChild(img);

        // Badge de número
        const badge = document.createElement('span');
        badge.textContent = `${index + 1}`;
        badge.style.cssText = 'position:absolute; top:3px; left:3px; background:rgba(15,23,42,0.75); color:white; font-size:9px; font-weight:700; padding:1px 5px; border-radius:10px; z-index:2;';
        imgContainer.appendChild(badge);

        thumbDiv.appendChild(imgContainer);

        // Barra de botones (girar + eliminar)
        const btnBar = document.createElement('div');
        btnBar.style.cssText = 'display:flex; justify-content:space-around; align-items:center; padding:4px 2px; background:#f8fafc; border-top:1px solid #e2e8f0;';

        const btnRotate = document.createElement('button');
        btnRotate.type = 'button';
        btnRotate.innerHTML = '<i class="fas fa-undo" style="font-size:10px;"></i>';
        btnRotate.title = 'Girar foto';
        btnRotate.style.cssText = 'background:none; border:none; color:#64748b; cursor:pointer; padding:4px 6px; font-size:9px; display:flex; align-items:center; gap:2px;';
        btnRotate.onclick = (e) => {
            e.stopPropagation();
            rotarSoporteIndividual(index);
        };

        const btnRemove = document.createElement('button');
        btnRemove.type = 'button';
        btnRemove.innerHTML = '<i class="fas fa-trash" style="font-size:10px;"></i>';
        btnRemove.title = 'Eliminar foto';
        btnRemove.style.cssText = 'background:none; border:none; color:#ef4444; cursor:pointer; padding:4px 6px; font-size:9px; display:flex; align-items:center; gap:2px;';
        btnRemove.onclick = (e) => {
            e.stopPropagation();
            removeSoporteFileByIndex(index);
        };

        btnBar.appendChild(btnRotate);
        btnBar.appendChild(btnRemove);
        thumbDiv.appendChild(btnBar);

        container.appendChild(thumbDiv);
    });
}

/**
 * Rota una foto individual del soporte en 90° antihorario.
 * Mantiene la rotación en memoria para que persista al re-renderizar.
 */
function rotarSoporteIndividual(index) {
    if (!window._calidadSoporteRotaciones) window._calidadSoporteRotaciones = {};
    window._calidadSoporteRotaciones[index] = (window._calidadSoporteRotaciones[index] || 0) - 90;

    // Aplicar rotación visual
    const img = document.getElementById(`soporteThumb${index}`);
    if (img) {
        img.style.transform = `rotate(${window._calidadSoporteRotaciones[index]}deg)`;
    }

    // Si hay una sola foto, también rotar el legacyPreview
    if (window._calidadSoporteFiles && window._calidadSoporteFiles.length === 1) {
        const legacyPreview = document.getElementById('soportePreview');
        if (legacyPreview) {
            legacyPreview.style.transform = `rotate(${window._calidadSoporteRotaciones[index]}deg)`;
        }
    }
}
window.rotarSoporteIndividual = rotarSoporteIndividual;

function removeSoporteFileByIndex(index) {
    if (window._calidadSoporteFiles && window._calidadSoporteFiles[index]) {
        window._calidadSoporteFiles.splice(index, 1);
        renderCalidadSoporteMultiPreviews();
    }
}

window.renderCalidadSoporteMultiPreviews = renderCalidadSoporteMultiPreviews;
window.removeSoporteFileByIndex = removeSoporteFileByIndex;

