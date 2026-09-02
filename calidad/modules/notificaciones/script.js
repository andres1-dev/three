/* ── Módulo: Notificaciones ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-notificaciones .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Notificaciones */
})();
