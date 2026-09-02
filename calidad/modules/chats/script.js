/* ── Módulo: Chats ── */
(function () {
    'use strict';

    function init() {
        /* Botón nuevo chat */
        document.querySelector('.mod-chats .icon-btn')
            ?.addEventListener('click', () => {
                console.log('[Chats] Nuevo chat');
            });
    }

    if (document.querySelector('.mod-chats')) {
        init();
    } else {
        requestAnimationFrame(init);
    }

})();
