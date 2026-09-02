/* ── Módulo: Nube ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-nube .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Nube */
})();
