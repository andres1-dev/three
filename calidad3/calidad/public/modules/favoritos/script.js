/* ── Módulo: Favoritos ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-favoritos .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Favoritos */
})();
