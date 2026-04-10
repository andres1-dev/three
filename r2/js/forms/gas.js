/* ==========================================================================
   forms/supabase-api.js — Comunicación con Supabase Edge Functions
   Depende de: config.js (FUNCTIONS_URL), ui.js (DOM)
   ========================================================================== */

/**
 * Comprime y convierte un archivo a Base64 antes de enviarlo.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
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
 * Recoge los datos comunes del lote actualmente seleccionado.
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
 * Envía un payload a la Edge Function de Supabase.
 */
async function sendToSupabase(payload) {
    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    return response.json();
}

/**
 * Función legacy mantenida por compatibilidad temporal en el resto de la app
 */
const sendToGAS = sendToSupabase;

/**
 * Sube una imagen en background a Supabase Storage via Edge Function.
 */
async function uploadArchivoAsync(file, id, hoja) {
    const STORAGE_KEY = `pending_upload_${id}`;

    let fileData;
    try {
        fileData = await fileToBase64(file);
    } catch(e) {
        console.error('[upload] Error comprimiendo archivo:', e);
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fileData, id, hoja, ts: Date.now() }));
    } catch(e) {
        console.warn('[upload] localStorage lleno.');
    }

    _showUploadIndicator(id);
    await _uploadConReintentos(fileData, id, hoja, STORAGE_KEY);
}

async function _uploadConReintentos(fileData, id, hoja, storageKey, intento = 1) {
    const MAX_INTENTOS = 5;
    try {
        // 1. Subir el archivo a Supabase Storage (proxied via Edge Function)
        const storageUrl = await _subirArchivoSupabase(fileData);

        // 2. Actualizar la URL en la fila del registro
        const res = await sendToSupabase({
            accion: 'UPDATE_ARCHIVO_URL',
            hoja,
            id,
            url: storageUrl,
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
            const delay = Math.min(2000 * Math.pow(2, intento - 1), 30000); 
            console.warn(`[upload] Intento ${intento} fallido, reintentando...`);
            setTimeout(() => _uploadConReintentos(fileData, id, hoja, storageKey, intento + 1), delay);
        } else {
            console.error(`[upload] Falló tras ${MAX_INTENTOS} intentos.`);
            _showUploadError(id);
        }
    }
}

async function _subirArchivoSupabase(fileData) {
    const res = await sendToSupabase({
        accion: 'SUBIR_ARCHIVO',
        archivo: fileData,
    });
    if (!res.success || !res.url) throw new Error(res.message || 'Sin URL');
    return res.url;
}

/** UI Helpers */
function _showUploadIndicator(id) {
    if (document.getElementById(`upload-ind-${id}`)) return;
    const el = document.createElement('div');
    el.id = `upload-ind-${id}`;
    el.className = 'upload-indicator';
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
        el.innerHTML = `<i class="fas fa-triangle-exclamation" style="color:#fca5a5;"></i> Imagen pendiente`;
    }
}

/** Reintentos automáticos */
function retryPendingUploads() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('pending_upload_'));
    if (!keys.length) return;
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

(function _initSupabaseApi() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', retryPendingUploads);
    } else {
        retryPendingUploads();
    }
})();

