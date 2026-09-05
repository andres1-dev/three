export class InicioModule {
    constructor({ router }) {
        this.router = router;
        this.container = null;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.className = 'module-inicio';

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <h1 class="page-title">Muro Corporativo</h1>
                <button class="icon-btn" aria-label="Buscar">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </button>
            </div>

            <div class="tabs-header">
                <button class="tab-btn active">Muro</button>
                <button class="tab-btn">Noticias</button>
                <button class="tab-btn">Cumpleaños</button>
            </div>

            <div id="feed-content" style="padding: 12px 16px 24px; display: flex; flex-direction: column; gap: 14px;">
                ${this._skeletonCard()}
                ${this._skeletonCard()}
            </div>

            <!-- FAB Nueva Publicación -->
            <button id="fab-new-post" aria-label="Nueva publicación" style="
                position: fixed;
                bottom: calc(var(--nav-height) + 20px);
                right: calc(max(50vw - 240px, 0px) + 16px);
                width: 52px;
                height: 52px;
                border-radius: var(--radius-full);
                background: var(--color-primary);
                color: #fff;
                border: none;
                cursor: pointer;
                box-shadow: 0 6px 20px var(--color-primary-glow);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 40;
                transition: transform var(--transition-fast), box-shadow var(--transition-fast);
            ">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
        `;

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        this._bindEvents();

        // Simular carga de feed (placeholder hasta migración completa)
        setTimeout(() => this._renderDemoFeed(), 600);
    }

    _bindEvents() {
        this.container.querySelector('.back-btn')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });

        const tabs = this.container.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        const fab = this.container.querySelector('#fab-new-post');
        if (fab) {
            fab.addEventListener('mouseenter', () => {
                fab.style.transform = 'scale(1.08)';
                fab.style.boxShadow = '0 8px 28px var(--color-primary-glow)';
            });
            fab.addEventListener('mouseleave', () => {
                fab.style.transform = '';
                fab.style.boxShadow = '0 6px 20px var(--color-primary-glow)';
            });
        }
    }

    _skeletonCard() {
        return `
            <div class="skeleton" style="height: 140px; border-radius: 16px;"></div>
        `;
    }

    _renderDemoFeed() {
        const feed = this.container.querySelector('#feed-content');
        if (!feed) return;

        const posts = [
            {
                author: 'Gestión de Calidad',
                initials: 'GC',
                role: 'Comunicado Oficial',
                badgeClass: 'badge-admin',
                date: '4 Sept 2026',
                text: 'Equipo, recordamos que el proceso de verificación de datos en la plataforma CALIDAD está activo. Por favor ingresa y confirma tu información de perfil.',
                reactions: [{ emoji: '❤️', count: 44 }, { emoji: '👍', count: 16 }, { emoji: '🥰', count: 9 }]
            },
            {
                author: 'Sistema Calidad',
                initials: 'SC',
                role: 'Actualización',
                badgeClass: 'badge-moderator',
                date: '4 Sept 2026',
                text: 'Plataforma actualizada con arquitectura modular para auditorías, inspecciones y gestión de calidad.',
                reactions: [{ emoji: '🚀', count: 28 }, { emoji: '👍', count: 12 }]
            }
        ];

        feed.innerHTML = '';
        posts.forEach(post => {
            const card = document.createElement('article');
            card.style.cssText = `
                background: var(--color-surface);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-lg);
                padding: 14px;
                box-shadow: var(--shadow-sm);
            `;
            card.innerHTML = `
                <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0;">
                            ${post.initials}
                        </div>
                        <div>
                            <strong style="font-size: 13px; color: var(--color-text);">${post.author}</strong>
                            <br>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                <span class="badge ${post.badgeClass}" style="font-size: 10px;">${post.role}</span>
                                <span style="font-size: 11px; color: var(--color-text-light);">${post.date}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <p style="font-size: 13px; color: var(--color-text); line-height: 1.6; margin-bottom: 12px;">${post.text}</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${post.reactions.map(r => `
                        <button style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-bg); font-size: 12px; cursor: pointer; color: var(--color-text-muted);">
                            ${r.emoji} ${r.count}
                        </button>
                    `).join('')}
                </div>
            `;
            feed.appendChild(card);
        });
    }

    unmount() {
        // Remover el FAB al desmontar
        const fab = document.querySelector('#fab-new-post');
        if (fab) fab.remove();
        this.container = null;
    }
}
