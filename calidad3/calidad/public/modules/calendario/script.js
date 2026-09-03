/* ── Módulo: Calendario ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-calendario .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Calendario */
})();
