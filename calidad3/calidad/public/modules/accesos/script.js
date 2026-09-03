/* ── Módulo: Accesos ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-accesos .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Accesos */
})();
