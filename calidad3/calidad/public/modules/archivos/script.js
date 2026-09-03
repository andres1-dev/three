/* ── Módulo: Archivos ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-archivos .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Archivos */
})();
