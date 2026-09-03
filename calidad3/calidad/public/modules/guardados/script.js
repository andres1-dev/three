/* ── Módulo: Guardados ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-guardados .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Guardados */
})();
