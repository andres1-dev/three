/* ==========================================================================
   file-handler.js — Manejo de archivos, compresión e imagen preview
   Depende de: config.js
   ========================================================================== */

/* ── Estado de archivo ── */
let _selectedFile = null;

function np_getSelectedFile()    { return _selectedFile; }
function np_clearSelectedFile()  { _selectedFile = null; }

/* ── Eventos de Drag & Drop ── */
function np_handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) np_validateAndPreviewFile(file);
}

function np_handleDragOver(e) {
    e.preventDefault();
    document.getElementById('dropzone')?.classList.add('dragover');
}

function np_handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('dropzone')?.classList.remove('dragover');
}

function np_handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('dropzone')?.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) np_validateAndPreviewFile(file);
}

/* ── Validación y Preview ── */
function np_validateAndPreviewFile(file) {
    const { maxSize, allowedTypes, message } = NP_VALIDATION.imagen;
    if (!allowedTypes.includes(file.type) || file.size > maxSize) {
        np_showToast(message, 'error');
        return;
    }
    _selectedFile = file;
    np_showFilePreview(file);
}

function np_showFilePreview(file) {
    const preview = document.getElementById('file-preview');
    const dropzone = document.getElementById('dropzone');
    if (!preview || !dropzone) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = `
            <div class="preview-container">
                <img src="${e.target.result}" alt="Preview" class="preview-img">
                <button type="button" onclick="np_removeFile()" class="btn-remove-file">
                    <i class="fas fa-times"></i> Quitar imagen
                </button>
            </div>`;
        dropzone.style.display = 'none';
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function np_removeFile() {
    _selectedFile = null;
    const preview = document.getElementById('file-preview');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('imagen');
    if (preview)   { preview.innerHTML = ''; preview.style.display = 'none'; }
    if (dropzone)  { dropzone.style.display = 'block'; }
    if (fileInput) { fileInput.value = ''; }
}

/* ── Compresión ── */
function np_compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const MAX_W = 1024;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }

                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                const quality = w > 900 ? 0.6 : w > 700 ? 0.65 : 0.7;
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Error al comprimir')), 'image/jpeg', quality);
            } catch (e) { reject(e); }
        };

        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al cargar imagen')); };
        img.src = url;
    });
}

function np_blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror  = reject;
        reader.readAsDataURL(blob);
    });
}

/* Exponer globalmente lo que el HTML necesita */
window.np_removeFile       = np_removeFile;
window.np_handleFileSelect = np_handleFileSelect;
window.np_handleDragOver   = np_handleDragOver;
window.np_handleDragLeave  = np_handleDragLeave;
window.np_handleFileDrop   = np_handleFileDrop;
