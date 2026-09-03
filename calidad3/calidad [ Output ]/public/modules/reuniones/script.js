/* ── Módulo: Reuniones ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-reuniones .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Reuniones */
})();
