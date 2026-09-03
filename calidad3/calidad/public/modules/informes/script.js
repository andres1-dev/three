/* ── Módulo: Informes ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-informes .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Informes */
})();
