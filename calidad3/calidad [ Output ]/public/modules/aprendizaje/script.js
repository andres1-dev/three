/* ── Módulo: Aprendizaje ── */
(function () {
    'use strict';

    /* Botón volver a Apps */
    document.querySelector('.mod-aprendizaje .mod-back')
        ?.addEventListener('click', () => {
            window.AppRouter?.navigate('apps');
        });

    /* TODO: inicializar Aprendizaje */
})();
