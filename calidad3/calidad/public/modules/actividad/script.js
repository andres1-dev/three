/* ── Módulo: Actividad ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-actividad .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Actividad */
})();
