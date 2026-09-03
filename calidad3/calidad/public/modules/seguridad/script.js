/* ── Módulo: Seguridad ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-seguridad .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Seguridad */
})();
