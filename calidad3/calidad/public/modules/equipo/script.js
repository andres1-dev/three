/* ── Módulo: Equipo ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-equipo .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Equipo */
})();
