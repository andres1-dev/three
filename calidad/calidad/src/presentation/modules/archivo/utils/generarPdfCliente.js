/**
 * Utilidad para generar PDF del reporte de calidad directamente en el cliente.
 *
 * ESTRATEGIA (por qué iframe):
 *   - generarReporteCalidadHtmlStatico() devuelve un documento HTML COMPLETO
 *     (<!DOCTYPE html><html><head><style>…</style></head><body>…</body></html>).
 *   - Insertar ese string con innerHTML en un <div> hace que el navegador descarte
 *     <html>, <head> y <body> → el <style> NO se aplica → html2canvas captura
 *     contenido sin estilos = página en blanco.
 *   - La solución correcta es un <iframe> al que se escribe el documento completo
 *     con document.write(). El iframe crea un contexto de navegador independiente
 *     donde el HTML se procesa igual que si fuera una pestaña real.
 */

const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

let _html2pdfCargado = null;

/**
 * Carga html2pdf.js bajo demanda (lazy).
 */
export function cargarHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (_html2pdfCargado) return _html2pdfCargado;

    _html2pdfCargado = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HTML2PDF_CDN;
        script.async = true;
        script.onload  = () => resolve(window.html2pdf);
        script.onerror = () => {
            _html2pdfCargado = null;
            reject(new Error('No se pudo cargar la librería PDF. Verifica tu conexión a Internet.'));
        };
        document.head.appendChild(script);
    });

    return _html2pdfCargado;
}

/**
 * Escribe el documento HTML completo en un iframe oculto y espera a que cargue.
 * @param {string} htmlDoc - Documento HTML completo con <!DOCTYPE>, <head>, <body>
 * @returns {Promise<{ iframe: HTMLIFrameElement, cleanup: () => void }>}
 */
function montarIframe(htmlDoc) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');

        // El iframe debe estar en el flujo del documento para que html2canvas
        // pueda capturarlo, pero completamente invisible al usuario.
        Object.assign(iframe.style, {
            position:      'absolute',
            top:           '0',
            left:          '0',
            width:         '794px',   // ~A4 a 96dpi
            height:        '1122px',  // ~A4 a 96dpi
            border:        'none',
            opacity:       '0',
            pointerEvents: 'none',
            zIndex:        '-9999',
            overflow:      'hidden'
        });

        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        const cleanup = () => {
            try { iframe.remove(); } catch (_) {}
        };

        // Timeout de seguridad
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout al cargar el documento en el iframe'));
        }, 15_000);

        iframe.onload = () => {
            clearTimeout(timeout);
            resolve({ iframe, cleanup });
        };

        iframe.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error('Error al cargar el documento en el iframe'));
        };

        // Escribir el documento HTML completo al iframe
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(htmlDoc);
        doc.close();
    });
}

/**
 * Convierte un documento HTML completo en un Blob PDF.
 * Usa un <iframe> oculto para que el HTML se renderice correctamente con sus
 * propios estilos antes de ser capturado por html2canvas.
 *
 * @param {string} htmlDoc  - Documento HTML completo (string con <!DOCTYPE html>…)
 * @param {string} filename - Nombre de archivo sugerido
 * @returns {Promise<Blob>}
 */
export async function generarPdfBlob(htmlDoc, filename = 'reporte.pdf') {
    const html2pdf = await cargarHtml2Pdf();
    const { iframe, cleanup } = await montarIframe(htmlDoc);

    // Esperar a que el iframe renderice completamente imágenes, SVG y estilos
    await new Promise(resolve => setTimeout(resolve, 450));

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const sheetEl = iframeDoc?.querySelector('.sheet') || iframeDoc?.body;
    if (!sheetEl) {
        cleanup();
        throw new Error('No se pudo acceder al contenido del documento generado');
    }

    const opt = {
        margin:      [4, 4, 4, 4],
        filename:    filename,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale:           2,
            useCORS:         true,
            allowTaint:      false,
            logging:         false,
            backgroundColor: '#ffffff',
            scrollX:         0,
            scrollY:         0,
            windowWidth:     794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().set(opt).from(sheetEl).output('blob');
        return pdfBlob;
    } finally {
        cleanup();
    }
}

/**
 * Genera el PDF y lo comparte vía Web Share API (WhatsApp móvil, etc.)
 * o lo descarga en PC/Desktop como fallback.
 *
 * @param {Object} options
 * @param {string} options.html       - Documento HTML completo del reporte
 * @param {string} options.filename   - Nombre del archivo (ej: 12345.pdf)
 * @param {string} [options.title]    - Título para el share nativo
 * @param {string} [options.text]     - Texto adicional para el share nativo
 * @returns {Promise<{ shared: boolean, downloaded: boolean, aborted?: boolean }>}
 */
export async function compartirODescargarPdf({ html, filename = 'reporte.pdf', title = 'Reporte de Calidad', text = '' }) {
    const blob = await generarPdfBlob(html, filename);
    const file = new File([blob], filename, { type: 'application/pdf' });

    // 1. Web Share API con archivos (Android Chrome, iOS Safari 15.1+, Edge)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title, text });
            return { shared: true, downloaded: false };
        } catch (shareErr) {
            if (shareErr.name === 'AbortError') {
                // Usuario cerró el selector nativo sin elegir destino
                return { shared: false, downloaded: false, aborted: true };
            }
            console.warn('[PDF] navigator.share falló, usando descarga directa:', shareErr.message);
        }
    }

    // 2. Fallback: descarga directa del archivo en el navegador
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

    return { shared: false, downloaded: true };
}
