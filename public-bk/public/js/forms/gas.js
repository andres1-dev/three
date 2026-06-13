/* ==========================================================================
   forms/supabase-api.js — Comunicación con Supabase Edge Functions
   Depende de: config.js (FUNCTIONS_URL), ui.js (DOM)
   ========================================================================== */

/**
 * Comprime y convierte un archivo a Base64 antes de enviarlo.
 * Mejorado para compatibilidad con iOS/Android
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        // Para videos y archivos no-imagen, conversión directa
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const base64 = reader.result.split(',')[1];
                    if (!base64) {
                        reject(new Error('Error al convertir archivo a base64'));
                        return;
                    }
                    resolve({
                        base64,
                        mimeType: file.type,
                        fileName: file.name,
                    });
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(new Error('Error al leer el archivo'));
            reader.readAsDataURL(file);
            return;
        }

        // Para imágenes: comprimir y optimizar
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        // Timeout para evitar bloqueos en móviles
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Timeout al cargar imagen'));
        }, 30000);

        img.onload = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            
            try {
                const MAX_W = 1280;
                let w = img.width, h = img.height;
                if (w > MAX_W) { 
                    h = Math.round(h * MAX_W / w); 
                    w = MAX_W; 
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                // Fondo blanco para transparencias
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                // Calidad adaptativa según tamaño
                const quality = w > 800 ? 0.7 : 0.8;
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const base64 = dataUrl.split(',')[1];
                
                if (!base64) {
                    reject(new Error('Error al generar base64 de imagen'));
                    return;
                }

                resolve({
                    base64,
                    mimeType: 'image/jpeg',
                    fileName: file.name.replace(/\.[^.]+$/, '.jpg'),
                });
            } catch (e) {
                reject(e);
            }
        };
        
        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error('Error al cargar la imagen'));
        };
        
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
        entrada: document.getElementById('entrada').value,
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
 * Mejorado para compatibilidad con móviles iOS/Android
 */
async function sendToSupabase(payload) {
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g';
    
    // Obtener token de sesión dinámicamente
    let sessionToken = SUPABASE_KEY;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('-auth-token')) {
                const session = JSON.parse(localStorage.getItem(key));
                if (session && session.access_token) {
                    sessionToken = session.access_token;
                    break;
                }
            }
        }
    } catch (e) { console.error("Error recuperando sesión para Supabase:", e); }

    let response;
    try {
        response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify(payload),
        });
    } catch (fetchError) {
        throw new Error(`Error de conexión: ${fetchError.message}`);
    }

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: 'Error desconocido' };
        }
        throw new Error(`Error ${response.status}: ${errorData.message || 'Error en el servidor'}`);
    }

    let result;
    try {
        result = await response.json();
    } catch (e) {
        throw new Error('Error al procesar respuesta del servidor');
    }

    return result;
}

/**
 * Función legacy mantenida por compatibilidad temporal en el resto de la app
 */
const sendToGAS = sendToSupabase;

// Exportar globalmente para que esté disponible en otros módulos
window.sendToSupabase = sendToSupabase;
window.sendToGAS = sendToGAS;

/**
 * Sube una imagen en background a Supabase Storage via Edge Function.
 * Mejorado con mejor manejo de errores y compatibilidad móvil
 */
async function uploadArchivoAsync(file, id, hoja) {
    const STORAGE_KEY = `pending_upload_${id}`;

    console.log(`[upload] Iniciando subida para ${id}:`, {
        nombre: file.name,
        tipo: file.type,
        tamaño: `${(file.size / 1024).toFixed(2)}KB`,
        hoja
    });

    // Validar archivo
    if (!file || !file.size) {
        console.error('[upload] Archivo inválido o vacío');
        return;
    }

    // Validar tamaño (10MB máximo)
    if (file.size > 10 * 1024 * 1024) {
        console.error('[upload] Archivo muy grande:', file.size);
        Swal.fire({
            icon: 'error',
            title: 'Archivo muy grande',
            text: 'El archivo no debe superar los 10MB',
            confirmButtonColor: '#3F51B5'
        });
        return;
    }

    let fileData;
    try {
        fileData = await fileToBase64(file);
    } catch(e) {
        Swal.fire({
            icon: 'error',
            title: 'Error al procesar archivo',
            text: 'No se pudo procesar el archivo. Intente con otro.',
            confirmButtonColor: '#3F51B5'
        });
        return;
    }

    // Guardar en localStorage para reintentos
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
            fileData, 
            id, 
            hoja, 
            ts: Date.now(),
            fileName: file.name,
            fileSize: file.size
        }));
        console.log(`[upload] Guardado en localStorage: ${STORAGE_KEY}`);
    } catch(e) {
        console.warn('[upload] No se pudo guardar en localStorage (puede estar lleno):', e);
    }

    _showUploadIndicator(id);
    await _uploadConReintentos(fileData, id, hoja, STORAGE_KEY);
}

async function _uploadConReintentos(fileData, id, hoja, storageKey, intento = 1) {
    const MAX_INTENTOS = 5;
    
    try {
        const storageUrl = await _subirArchivoDrive(fileData, id, hoja);

        if (storageUrl) {
            localStorage.removeItem(storageKey);
            _hideUploadIndicator(id);
            
            // Notificación de éxito (opcional, solo en desarrollo)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Desarrollo
            }
        }
    } catch(e) {
        if (intento < MAX_INTENTOS) {
            // Backoff exponencial: 2s, 4s, 8s, 16s, 30s
            const delay = Math.min(2000 * Math.pow(2, intento - 1), 30000);
            console.warn(`[upload] Reintentando en ${delay/1000}s...`);
            
            setTimeout(() => {
                _uploadConReintentos(fileData, id, hoja, storageKey, intento + 1);
            }, delay);
        } else {
            console.error(`[upload] ❌ Falló tras ${MAX_INTENTOS} intentos para ${id}`);
            _showUploadError(id);
            
            // Mostrar error al usuario
            Swal.fire({
                icon: 'warning',
                title: 'Imagen pendiente',
                text: 'La imagen se guardará cuando haya mejor conexión. El reporte ya fue enviado.',
                confirmButtonColor: '#3F51B5',
                timer: 5000
            });
        }
    }
}

async function _subirArchivoDrive(fileData, id, hoja) {
    console.log(`[UPLOAD] Iniciando subida a Supabase (Bucket: novedades-imagenes) | Hoja: ${hoja}`);
    
    try {
        // 1. Convertir base64 a File para usar la compresión de api.js
        const byteCharacters = atob(fileData.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileData.mimeType });
        const file = new File([blob], fileData.fileName || 'upload.jpg', { type: fileData.mimeType });

        // 2. Subir a Supabase Storage via Edge Function (Centralizado en api.js)
        const pId = (typeof currentUser !== 'undefined') ? (currentUser?.ID_PRODUCTORA || currentUser?.id_productora || currentUser?.productora) : null;
        const publicUrl = await window.uploadToSupabase(file, pId, hoja);

        // 3. Si es una Novedad o Reporte de Calidad, actualizar la URL en la DB inmediatamente
        const hojaUpper = hoja.toUpperCase();
        if (hojaUpper === 'NOVEDADES' || hojaUpper === 'REPORTES') {
            console.log(`[UPLOAD] Actualizando URL en tabla ${hojaUpper} para ID: ${id}`);
            const updatePayload = {
                accion: 'UPDATE_ARCHIVO_URL',
                id: id,
                hoja: hojaUpper,
                url: publicUrl
            };

            await sendToSupabase(updatePayload);
        }

        return publicUrl;

    } catch (error) {
        console.error('[UPLOAD] Error crítico en subida a Supabase:', error);
        throw error;
    }
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

