/**
 * Utilidad para generar PDF del reporte de calidad directamente en el cliente (navegador)
 * usando html2pdf.js y compartirlo directamente vía Web Share API o descargarlo.
 */

const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

let _html2pdfCargado = null;

/**
 * Carga html2pdf.js bajo demanda solo cuando el usuario lo necesita
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
            reject(new Error('No se pudo cargar la librería generadora de PDF (html2pdf)'));
        };
        document.head.appendChild(script);
    });

    return _html2pdfCargado;
}

/**
 * Convierte un string HTML o elemento DOM en un Blob PDF.
 * @param {string|HTMLElement} sourceHtml 
 * @param {string} filename 
 * @returns {Promise<Blob>}
 */
export async function generarPdfBlob(sourceHtml, filename = 'reporte.pdf') {
    const html2pdf = await cargarHtml2Pdf();

    // Contenedor temporal aislado para renderizar
    let container = null;
    let isCreated = false;

    if (typeof sourceHtml === 'string') {
        container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '800px';
        container.style.background = '#ffffff';
        container.innerHTML = sourceHtml;
        document.body.appendChild(container);
        isCreated = true;
    } else {
        container = sourceHtml;
    }

    const opt = {
        margin:       [8, 8, 8, 8],
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
        return pdfBlob;
    } finally {
        if (isCreated && container) {
            container.remove();
        }
    }
}

/**
 * Genera el PDF y lo comparte usando la Web Share API (WhatsApp móvil, etc.)
 * o lo descarga en PC/Desktop con fallback.
 * 
 * @param {Object} options
 * @param {string|HTMLElement} options.html - Contenido HTML del reporte
 * @param {string} options.filename - Nombre del archivo (ej: 12345.pdf)
 * @param {string} [options.title] - Título para el share
 * @param {string} [options.text] - Texto adicional para acompañar el PDF
 * @returns {Promise<{ shared: boolean, downloaded: boolean }>}
 */
export async function compartirODescargarPdf({ html, filename = 'reporte.pdf', title = 'Reporte de Calidad', text = '' }) {
    const blob = await generarPdfBlob(html, filename);
    const file = new File([blob], filename, { type: 'application/pdf' });

    // 1. Intentar Web Share API con archivos (Android, iOS Safari, etc.)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: title,
                text: text
            });
            return { shared: true, downloaded: false };
        } catch (shareErr) {
            // Si el usuario canceló el selector nativo
            if (shareErr.name === 'AbortError') {
                return { shared: false, downloaded: false, aborted: true };
            }
            console.warn('[PDF] Error en navigator.share, procediendo a descarga:', shareErr);
        }
    }

    // 2. Fallback: Descarga directa del archivo PDF en el navegador
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

    return { shared: false, downloaded: true };
}
