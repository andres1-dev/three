/* ── Módulo: Formularios ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-formularios .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Formularios */
})();
