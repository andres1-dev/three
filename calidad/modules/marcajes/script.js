/* ── Módulo: Marcajes ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-marcajes .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Marcajes */
})();
