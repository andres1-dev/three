/* ==========================================================================
   particles-config.js — Configuración visual de Particles.js
   ========================================================================== */

/**
 * Configuración de partículas para el fondo animado.
 * @see https://vincentgarreau.com/particles.js/
 * @readonly
 */
const PARTICLES_CONFIG = Object.freeze({
    particles: {
        number: {
            value: 80,
            density: { enable: true, value_area: 800 },
        },
        color: { value: '#94a3b8' }, // Color sutil (Slate 400)
        shape: { type: 'circle' },
        opacity: { value: 0.4, random: false },
        size: { value: 3, random: true },
        line_linked: {
            enable: true,
            distance: 150,
            color: '#94a3b8',
            opacity: 0.3,
            width: 1,
        },
        move: {
            enable: true,
            speed: 1.2, // Movimiento lento y elegante
            direction: 'none',
            random: true,
            straight: false,
            out_mode: 'out',
            bounce: false,
        },
    },
    interactivity: {
        detect_on: 'canvas',
        events: {
            onhover: { enable: true, mode: 'repulse' },
            onclick: { enable: false },
        },
        modes: {
            repulse: { 
                distance: 140, 
                duration: 0.2 // Repulsión casi instantánea y veloz
            }
        },
    },
    retina_detect: true,
});

/**
 * Inicializa Particles.js en el contenedor indicado.
 * @param {string} containerId — ID del elemento DOM contenedor.
 */
function initParticles(containerId = 'particles-js') {
    if (typeof particlesJS === 'function') {
        particlesJS(containerId, PARTICLES_CONFIG);
    } else {
        console.warn('[particles] particlesJS no está disponible');
    }
}
