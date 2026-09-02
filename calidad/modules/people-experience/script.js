/* ── Módulo: People Experience ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-people-experience .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar People Experience */
})();
