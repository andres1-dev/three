/* ── Módulo: Objetivos ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-objetivos .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Objetivos */
})();
