/* ── Módulo: Ajustes ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-ajustes .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Ajustes */
})();
