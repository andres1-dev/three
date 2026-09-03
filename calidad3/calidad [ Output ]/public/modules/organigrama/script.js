/* ── Módulo: Organigrama ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-organigrama .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Organigrama */
})();
