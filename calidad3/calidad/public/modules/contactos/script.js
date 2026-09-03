/* ── Módulo: Contactos ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-contactos .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Contactos */
})();
