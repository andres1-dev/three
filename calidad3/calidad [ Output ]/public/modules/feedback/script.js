/* ── Módulo: Feedback ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-feedback .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Feedback */
})();
