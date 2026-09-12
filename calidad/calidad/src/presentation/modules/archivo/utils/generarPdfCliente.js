/**
 * Utilidad para generar PDF del reporte de calidad directamente en el cliente (navegador)
 * usando html2pdf.js y compartirlo directamente vía Web Share API o descargarlo.
 *
 * NOTA IMPORTANTE sobre html2canvas:
 *   - NO funciona con position:fixed fuera del viewport (-9999px) → páginas en blanco.
 *   - La solución es inyectar el contenido en un wrapper que esté dentro del flujo del
 *     documento pero completamente oculto visualmente (opacity:0, pointer-events:none,
 *     position:absolute con top/left en el origen del scroll actual).
 */

const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

let _html2pdfCargado = null;

/**
 * Carga html2pdf.js bajo demanda (lazy) solo cuando el usuario lo necesita.
 */
export function cargarHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (_html2pdfCargado) return _html2pdfCargado;

    _html2pdfCargado = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HTML2PDF_CDN;
        script.async = true;
        script.onload = () => resolve(window.html2pdf);
        script.onerror = () => {
            _html2pdfCargado = null;
            reject(new Error('No se pudo cargar la librería de PDF (html2pdf). Verifica tu conexión a Internet.'));
        };
        document.head.appendChild(script);
    });

    return _html2pdfCargado;
}

/**
 * Convierte un string HTML completo en un Blob PDF usando html2pdf + html2canvas.
 *
 * Estrategia para evitar PDF en blanco:
 *  1. Se crea un wrapper con opacity:0 pero position:absolute dentro del body
 *     (NO position:fixed, NO left:-9999px).
 *  2. Se espera un frame de pintado (requestAnimationFrame + setTimeout 0) para que
 *     el navegador registre el contenido antes de que html2canvas lo capture.
 *  3. Se elimina el wrapper después de generar el PDF.
 *
 * @param {string} sourceHtml  - HTML completo del reporte (string)
 * @param {string} filename    - Nombre de archivo sugerido
 * @returns {Promise<Blob>}
 */
export async function generarPdfBlob(sourceHtml, filename = 'reporte.pdf') {
    const html2pdf = await cargarHtml2Pdf();

    // Wrapper que existe en el flujo del documento pero es invisible al usuario
    const wrapper = document.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    Object.assign(wrapper.style, {
        position:      'absolute',
        top:           `${window.scrollY}px`,   // anclar al origen del scroll visible
        left:          '0',
        width:         '794px',                  // ~A4 a 96dpi
        minHeight:     '1px',
        opacity:       '0',
        pointerEvents: 'none',
        overflow:      'hidden',
        zIndex:        '-9999'
    });
    wrapper.innerHTML = sourceHtml;
    document.body.appendChild(wrapper);

    // Esperar a que el navegador pinte el contenido antes de capturar
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 120)));

    const opt = {
        margin:      [8, 8, 8, 8],
        filename:    filename,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale:           2,
            useCORS:         true,
            letterRendering: true,
            logging:         false,
            scrollX:         0,
            scrollY:         -window.scrollY,   // compensar scroll del body
            windowWidth:     794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().set(opt).from(wrapper).output('blob');
        return pdfBlob;
    } finally {
        wrapper.remove();
    }
}

/**
 * Genera el PDF y lo comparte usando la Web Share API (WhatsApp móvil, etc.)
 * o lo descarga en PC/Desktop con fallback.
 *
 * @param {Object} options
 * @param {string} options.html       - HTML completo del reporte
 * @param {string} options.filename   - Nombre del archivo (ej: 12345.pdf)
 * @param {string} [options.title]    - Título para el share
 * @param {string} [options.text]     - Texto adicional para acompañar el PDF
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
                // El usuario cerró el selector nativo sin elegir destino
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
    // Limpiar la URL de objeto después de un momento
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

    return { shared: false, downloaded: true };
}
