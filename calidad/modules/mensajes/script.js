/* ── Módulo: Mensajes ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-mensajes .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Mensajes */
})();
