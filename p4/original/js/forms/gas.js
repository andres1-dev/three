/* ==========================================================================
   forms/gas.js — Utilidades de comunicación con Google Apps Script
   Depende de: config.js (GAS_ENDPOINT), ui.js (DOM)
   ========================================================================== */

/**
 * Comprime y convierte un archivo a Base64 antes de enviarlo al GAS.
 * Imágenes se redimensionan a max 1280px y calidad 0.72 → reduce ~80% el tamaño.
 * Videos y otros archivos se envían sin modificar.
 * @param {File} file
 * @returns {Promise<{base64: string, mimeType: string, fileName: string}>}
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        // No-imagen (video, etc): enviar directo sin comprimir
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve({
                base64: reader.result.split(',')[1],
                mimeType: file.type,
                fileName: file.name,
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX_W = 1280;
            let w = img.width, h = img.height;
            if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
            resolve({
                base64: dataUrl.split(',')[1],
                mimeType: 'image/jpeg',
                fileName: file.name.replace(/\.[^.]+$/, '.jpg'),
            });
        };
        img.onerror = reject;
        img.src = url;
    });
}


/**
 * Recoge los datos comunes del lote actualmente seleccionado en el formulario.
 * @returns {Object} Campos del lote: fecha, lote, referencia, cantidad, planta, salida, linea, proceso, prenda, genero, tejido.
 */
function collectLotData() {
    return {
        fecha: document.getElementById('fecha').value,
        lote: document.getElementById('lote').value,
        referencia: document.getElementById('referencia').value,
        cantidad: document.getElementById('cantidad').value,
        planta: DOM.plantaSelect().value,
        salida: document.getElementById('salida').value,
        linea: DOM.lineaInput().value,
        proceso: document.getElementById('proceso').value,
        prenda: document.getElementById('prenda').value,
        genero: document.getElementById('genero').value,
        tejido: document.getElementById('tejido').value,
    };
}

/**
 * Envía un payload al Google Apps Script vía POST.
 * Usa Content-Type: text/plain para evitar CORS preflight.
 * @param {Object} payload — Datos a enviar (serializados como JSON).
 * @returns {Promise<Object>} Respuesta JSON del servidor.
 * @throws {Error} Si la respuesta HTTP no es OK.
 */
async function sendToGAS(payload) {
    const response = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    return response.json();
}

/**
 * Sube una imagen en background después de que el reporte ya fue guardado.
 * - Guarda la tarea en localStorage como respaldo ante pérdida de conexión.
 * - Reintenta hasta 5 veces con backoff exponencial.
 * - Al terminar, actualiza la URL en la fila del GAS via UPDATE_ARCHIVO_URL.
 *
 * @param {File}   file   — Archivo a subir
 * @param {string} id     — ID del registro (ID_NOVEDAD o ID_REPORTE)
 * @param {string} hoja   — 'NOVEDADES' o 'REPORTES'
 */
async function uploadArchivoAsync(file, id, hoja) {
    const STORAGE_KEY = `pending_upload_${id}`;

    // Comprimir imagen y guardar base64 en localStorage como respaldo
    let fileData;
    try {
        fileData = await fileToBase64(file);
    } catch(e) {
        console.error('[upload] Error comprimiendo archivo:', e);
        return;
    }

    // Persistir en localStorage para sobrevivir recargas
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fileData, id, hoja, ts: Date.now() }));
    } catch(e) {
        console.warn('[upload] localStorage lleno, continuando sin respaldo local.');
    }

    // Mostrar indicador discreto
    _showUploadIndicator(id);

    // Intentar subir con reintentos
    await _uploadConReintentos(fileData, id, hoja, STORAGE_KEY);
}

async function _uploadConReintentos(fileData, id, hoja, storageKey, intento = 1) {
    const MAX_INTENTOS = 5;
    try {
        // 1. Subir el archivo a Drive y obtener la URL real
        const driveUrl = await _subirArchivoGAS(fileData);

        // 2. Actualizar la URL en la fila del registro
        const res = await sendToGAS({
            accion: 'UPDATE_ARCHIVO_URL',
            hoja,
            id,
            url: driveUrl,
        });

        if (res.success) {
            localStorage.removeItem(storageKey);
            _hideUploadIndicator(id);
            console.log(`[upload] ✓ Archivo subido para ${id}`);
        } else {
            throw new Error(res.message);
        }
    } catch(e) {
        if (intento < MAX_INTENTOS) {
            const delay = Math.min(2000 * Math.pow(2, intento - 1), 30000); // 2s, 4s, 8s, 16s, 30s
            console.warn(`[upload] Intento ${intento} fallido, reintentando en ${delay/1000}s...`);
            setTimeout(() => _uploadConReintentos(fileData, id, hoja, storageKey, intento + 1), delay);
        } else {
            console.error(`[upload] Falló después de ${MAX_INTENTOS} intentos. Datos guardados en localStorage.`);
            _showUploadError(id);
        }
    }
}

async function _subirArchivoGAS(fileData) {
    // Enviar el archivo base64 al GAS para que lo suba a Drive y retorne la URL
    const res = await sendToGAS({
        accion: 'SUBIR_ARCHIVO',
        archivo: fileData,
    });
    if (!res.success || !res.url) throw new Error(res.message || 'Sin URL');
    return res.url;
}

/** Indicador visual discreto de subida en progreso */
function _showUploadIndicator(id) {
    if (document.getElementById(`upload-ind-${id}`)) return;
    const el = document.createElement('div');
    el.id = `upload-ind-${id}`;
    el.style.cssText = `
        position:fixed; bottom:20px; right:20px; z-index:9999;
        background:#1e293b; color:white; padding:10px 16px;
        border-radius:12px; font-size:0.8rem; font-weight:600;
        display:flex; align-items:center; gap:8px;
        box-shadow:0 4px 20px rgba(0,0,0,0.3);
    `;
    el.innerHTML = `<i class="fas fa-cloud-arrow-up" style="color:#60a5fa;"></i> Subiendo imagen...`;
    document.body.appendChild(el);
}

function _hideUploadIndicator(id) {
    const el = document.getElementById(`upload-ind-${id}`);
    if (!el) return;
    el.innerHTML = `<i class="fas fa-check-circle" style="color:#4ade80;"></i> Imagen guardada`;
    setTimeout(() => el.remove(), 2500);
}

function _showUploadError(id) {
    const el = document.getElementById(`upload-ind-${id}`);
    if (el) {
        el.style.background = '#7f1d1d';
        el.innerHTML = `<i class="fas fa-triangle-exclamation" style="color:#fca5a5;"></i> Imagen pendiente — se reintentará al reconectar`;
    }
}

/**
 * Al iniciar la app, reintenta subidas pendientes que quedaron en localStorage.
 * Se ejecuta automáticamente en cualquier página que cargue gas.js.
 */
function retryPendingUploads() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_upload_'));
    if (!keys.length) return;
    console.log(`[upload] ${keys.length} subida(s) pendiente(s) encontrada(s), reintentando...`);
    keys.forEach(key => {
        try {
            const { fileData, id, hoja } = JSON.parse(localStorage.getItem(key));
            _showUploadIndicator(id);
            _uploadConReintentos(fileData, id, hoja, key);
        } catch(e) {
            localStorage.removeItem(key);
        }
    });
}

/* Auto-ejecutar al cargar cualquier página que incluya gas.js */
(function _autoRetryOnLoad() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', retryPendingUploads);
    } else {
        retryPendingUploads();
    }
})();
