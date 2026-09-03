/* ── Módulo: Inicio / Muro ── */
(function () {
    'use strict';

    function init() {
        console.log('[Inicio] Inicializando módulo...');

        /* Tabs Muro / Noticias */
        const tabs = document.querySelectorAll('.mod-inicio .feed-tabs .tab-btn');
        console.log('[Inicio] Tabs encontrados:', tabs.length);
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        /* Ver más / Ver menos en posts */
        document.querySelectorAll('.mod-inicio .read-more').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.closest('.post-body');
                body.classList.toggle('expanded');
                btn.textContent = body.classList.contains('expanded') ? 'Ver menos' : 'Ver más';
            });
        });

        /* FAB nueva publicación */
        document.querySelector('.mod-inicio .fab')
            ?.addEventListener('click', () => {
                console.log('[Inicio] Nueva publicación');
            });
    }

    if (document.querySelector('.mod-inicio')) {
        console.log('[Inicio] DOM encontrado, inicializando...');
        init();
    } else {
        console.log('[Inicio] DOM no encontrado, reintentando...');
        setTimeout(init, 100);
    }

})();
