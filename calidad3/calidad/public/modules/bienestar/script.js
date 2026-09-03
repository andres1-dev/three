/* ── Módulo: Bienestar ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-bienestar .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Bienestar */
})();
