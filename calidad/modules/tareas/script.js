/* ── Módulo: Tareas ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-tareas .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Tareas */
})();
