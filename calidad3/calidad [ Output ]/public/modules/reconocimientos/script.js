/* ── Módulo: Reconocimientos ── */
(function () {
    'use strict';

    const tabs  = document.querySelectorAll('.mod-reconocimientos .tab-btn');
    const list  = document.getElementById('recon-list');
    const empty = document.getElementById('recon-empty');

    /* Datos de ejemplo — reemplazar con API */
    const data = {
        recibidos: [],
        enviados:  []
    };

    let activeTab = 'recibidos';

    function render(tab) {
        list.innerHTML = '';
        const items = data[tab] || [];

        if (!items.length) {
            list.style.display  = 'none';
            empty.style.display = 'flex';
            return;
        }

        empty.style.display = 'none';
        list.style.display  = 'flex';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'recon-card';
            card.innerHTML = `
                <div class="recon-header">
                    <img src="${item.avatar}" alt="${item.from}" class="recon-avatar">
                    <div class="recon-author">
                        <strong>${item.from}</strong>
                        <span>${item.date}</span>
                    </div>
                    <span class="recon-badge">${item.emoji || '⭐'}</span>
                </div>
                <p class="recon-message">${item.message}</p>
                ${item.value ? `<span class="recon-value">✦ ${item.value}</span>` : ''}
            `;
            list.appendChild(card);
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            render(activeTab);
        });
    });

    render(activeTab);
})();
