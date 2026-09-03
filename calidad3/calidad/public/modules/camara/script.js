/* ── Módulo: C&aacute;mara ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-camara .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar C&aacute;mara */
})();
