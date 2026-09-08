/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CDN INTEGRITY HASHES (SRI - Subresource Integrity)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo centraliza todas las dependencias CDN con sus hashes SRI
 * para prevenir ataques de supply chain.
 * 
 * IMPORTANTE: Actualizar estos hashes al cambiar versiones de librerías.
 * 
 * Para generar nuevos hashes SRI:
 * https://www.srihash.org/
 */

const CDN_RESOURCES = {
    // Font Awesome 6.0.0-beta3
    fontAwesome: {
        url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
        integrity: 'sha512-Fo3rlrZj/k7ujTnHg4CGR2D7kSs0v4LLanw2qksYuRlEzO+tcaEPQogQ0KaoGN26/zrn20ImR1DfuLWnOo7aBA==',
        crossorigin: 'anonymous'
    },
    
    // SweetAlert2 v11
    sweetalert2: {
        url: 'https://cdn.jsdelivr.net/npm/sweetalert2@11',
        // Nota: SweetAlert2 sin versión específica no puede tener SRI estático
        // Recomendación: Especificar versión exacta (ej: sweetalert2@11.10.5)
        integrity: null, // Requiere versión fija
        crossorigin: 'anonymous'
    },
    
    // Particles.js 2.0.0
    particlesjs: {
        url: 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js',
        integrity: 'sha256-V9OFoPq3kZw/Sjjd3pLIjYWKXe4VRxFpZ3R6zcLjEZA=',
        crossorigin: 'anonymous'
    },
    
    // Supabase JS v2 (sin versión fija = sin SRI posible)
    supabaseJS: {
        url: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
        integrity: null, // Requiere versión fija para SRI
        crossorigin: 'anonymous',
        note: 'Considerar instalar via npm y bundlear con Vite'
    }
};

/**
 * Genera el atributo integrity completo para usar en HTML
 * @param {string} resourceKey - Clave del recurso en CDN_RESOURCES
 * @returns {string} Atributo integrity="..." o cadena vacía
 */
function getIntegrityAttr(resourceKey) {
    const resource = CDN_RESOURCES[resourceKey];
    if (!resource || !resource.integrity) return '';
    return `integrity="${resource.integrity}" crossorigin="${resource.crossorigin}"`;
}

// Exportar para uso en build scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CDN_RESOURCES, getIntegrityAttr };
}
