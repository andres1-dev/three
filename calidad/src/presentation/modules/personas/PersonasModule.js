import { Store } from '../../state/Store.js';
import { Toast } from '../../components/Toast.js';
import { User } from '../../../core/domain/models/User.js';
import { Plant } from '../../../core/domain/models/Plant.js';

const PER_PAGE = 10;

const GRAD = {
    'ADMIN':        'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'MODERATOR':    'linear-gradient(135deg,#3b82f6,#06b6d4)',
    'USER-P':       'linear-gradient(135deg,#10b981,#059669)',
    'USER-C':       'linear-gradient(135deg,#06b6d4,#0284c7)',
    'USER-I':       'linear-gradient(135deg,#22c55e,#16a34a)',
    'GUEST':        'linear-gradient(135deg,#f59e0b,#d97706)',
    'PENDIENTE':    'linear-gradient(135deg,#f97316,#ea580c)',
    'DESHABILITADO':'linear-gradient(135deg,#94a3b8,#64748b)',
};

const ROL_META = {
    'ADMIN':        { badge: 'pb-admin',     label: 'Admin' },
    'MODERATOR':    { badge: 'pb-moderator', label: 'Moderador' },
    'USER-P':       { badge: 'pb-user-p',    label: 'Producción' },
    'USER-C':       { badge: 'pb-user-c',    label: 'Calidad' },
    'USER-I':       { badge: 'pb-user-i',    label: 'Ingreso' },
    'GUEST':        { badge: 'pb-guest',     label: 'Taller' },
    'PENDIENTE':    { badge: 'pb-pendiente', label: 'Pendiente' },
    'DESHABILITADO':{ badge: 'pb-disabled',  label: 'Inactivo' },
};

function _grad(r) {
    return GRAD[r] || 'linear-gradient(135deg,#64748b,#475569)';
}

function _meta(r) {
    return ROL_META[r] || { badge: 'pb-default', label: r || '—' };
}

function _inits(n) {
    const p = (n || '').trim().split(' ').filter(Boolean);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (n || 'US').slice(0, 2).toUpperCase();
}

function _svg(d, s = 14) {
    return `<svg viewBox="0 0 24 24" style="width:${s}px;height:${s}px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round">${d}</svg>`;
}

/**
 * Renderiza el avatar: imagen si url existe, iniciales+gradiente si no.
 * shape: 'circle' | 'rounded'
 */
function _avatarHtml(nombre, grad, fotoUrl, size = 46, shape = 'circle') {
    const isCircle = shape === 'circle';
    const radius = isCircle ? '50%' : '12px';
    const fontSize = size < 40 ? '.72rem' : (size <= 48 ? '.88rem' : '1.1rem');
    if (fotoUrl) {
        return `<div class="p-avatar ${isCircle ? 'p-avatar--circle' : ''}" style="width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;border-radius:${radius};background:#f1f5f9;"><img src="${fotoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML='${_inits(nombre)}';this.parentElement.style.fontSize='${fontSize}';this.parentElement.style.fontWeight='800';this.parentElement.style.color='#fff';this.parentElement.style.background='${grad}';this.parentElement.style.display='flex';this.parentElement.style.alignItems='center';this.parentElement.style.justifyContent='center';"></div>`;
    }
    return `<div class="p-avatar ${isCircle ? 'p-avatar--circle' : ''}" style="background:${grad};border-radius:${radius};width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;font-size:${fontSize};">${_inits(nombre)}</div>`;
}

export class PersonasModule {
    constructor({ router, getDirectoryUseCase, dataService }) {
        this.router = router;
        this.useCase = getDirectoryUseCase;
        this.dataService = dataService || getDirectoryUseCase?.dataService;
        this.mode = 'USERS'; // 'USERS' | 'PLANTS'
        this.users = [];
        this.plants = [];
        this.query = '';
        this.page = 1;
        this.prods = [];
        this.container = null;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.className = 'mod-personas';

        this.container.innerHTML = `
            <!-- ════ SKELETON LOADER COMPLETO (Idéntico a Perfil) ════ -->
            <div class="personas-skeleton" id="personas-skeleton" aria-hidden="true">
                <!-- Header skeleton -->
                <div class="sk-p-header">
                    <div class="sk-p-circle sk-p-sm"></div>
                    <div class="sk-p-bar sk-p-bar--title"></div>
                    <div class="sk-p-circle sk-p-sm sk-p-ml-auto"></div>
                </div>

                <!-- Tabs skeleton -->
                <div class="sk-p-tabs">
                    <div class="sk-p-tab-item">
                        <div class="sk-p-bar sk-p-bar--tab"></div>
                        <div class="sk-p-badge"></div>
                    </div>
                    <div class="sk-p-tab-item">
                        <div class="sk-p-bar sk-p-bar--tab"></div>
                        <div class="sk-p-badge"></div>
                    </div>
                </div>

                <!-- Search skeleton -->
                <div class="sk-p-search">
                    <div class="sk-p-bar sk-p-bar--search"></div>
                </div>

                <!-- Cards list skeleton -->
                <div class="sk-p-list">
                    <div class="sk-p-card">
                        <div class="sk-p-circle sk-p-avatar"></div>
                        <div class="sk-p-card-info">
                            <div class="sk-p-bar sk-p-bar--name"></div>
                            <div class="sk-p-bar sk-p-bar--sub"></div>
                        </div>
                        <div class="sk-p-card-actions">
                            <div class="sk-p-badge sk-p-badge--role"></div>
                            <div class="sk-p-circle sk-p-action-btn"></div>
                        </div>
                    </div>
                    <div class="sk-p-card">
                        <div class="sk-p-circle sk-p-avatar"></div>
                        <div class="sk-p-card-info">
                            <div class="sk-p-bar sk-p-bar--name"></div>
                            <div class="sk-p-bar sk-p-bar--sub"></div>
                        </div>
                        <div class="sk-p-card-actions">
                            <div class="sk-p-badge sk-p-badge--role"></div>
                            <div class="sk-p-circle sk-p-action-btn"></div>
                        </div>
                    </div>
                    <div class="sk-p-card">
                        <div class="sk-p-circle sk-p-avatar"></div>
                        <div class="sk-p-card-info">
                            <div class="sk-p-bar sk-p-bar--name"></div>
                            <div class="sk-p-bar sk-p-bar--sub"></div>
                        </div>
                        <div class="sk-p-card-actions">
                            <div class="sk-p-badge sk-p-badge--role"></div>
                            <div class="sk-p-circle sk-p-action-btn"></div>
                        </div>
                    </div>
                    <div class="sk-p-card">
                        <div class="sk-p-circle sk-p-avatar"></div>
                        <div class="sk-p-card-info">
                            <div class="sk-p-bar sk-p-bar--name"></div>
                            <div class="sk-p-bar sk-p-bar--sub"></div>
                        </div>
                        <div class="sk-p-card-actions">
                            <div class="sk-p-badge sk-p-badge--role"></div>
                            <div class="sk-p-circle sk-p-action-btn"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ════ CONTENIDO REAL DE PERSONAS ════ -->
            <div class="personas-real" id="personas-real" style="display:none; flex-direction:column; flex:1;">
                <!-- Header -->
                <div class="page-header">
                    <button class="icon-btn back-btn" id="p-btn-back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                    <h1 class="page-title">Personas</h1>
                    <div class="feed-actions">
                        <button class="icon-btn" id="p-btn-add" title="Agregar" aria-label="Agregar">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Tabs Colaboradores / Plantas -->
                <div class="p-tabs">
                    <button class="p-tab active" data-tab="USERS" id="p-tab-users">
                        <span>Colaboradores</span>
                        <span class="p-tab-count" id="p-count-users">0</span>
                    </button>
                    <button class="p-tab" data-tab="PLANTS" id="p-tab-plants">
                        <span>Plantas</span>
                        <span class="p-tab-count" id="p-count-plants">0</span>
                    </button>
                </div>

                <!-- Búsqueda estilizada -->
                <div class="p-search-container">
                    <div class="p-search-wrap">
                        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        <input type="text" id="p-search" placeholder="Buscar por nombre o cargo..." autocomplete="off">
                    </div>
                </div>

                <!-- Lista -->
                <div id="p-list"></div>

                <!-- Paginación -->
                <div class="p-pagination" id="p-pagination"></div>
            </div>

            <!-- Sheet detalle / edición -->
            <div class="p-backdrop" id="p-backdrop"></div>
            <div class="p-sheet" id="p-sheet">
                <div class="p-sheet-handle"></div>
                <div id="p-sheet-body"></div>
            </div>
        `;

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        this._loadProds();
        this._bindEvents();
        await this._cargar();
    }

    _loadProds() {
        try {
            this.prods = JSON.parse(localStorage.getItem('busint_productoras_cache') || '[]');
        } catch (_) {}
        if (!this.prods.length) {
            this.prods = [
                { id_productora: 1, productora: 'TEXTILES Y CREACIONES EL UNIVERSO S.A.S.' },
                { id_productora: 2, productora: 'TEXTILES Y CREACIONES LOS ANGELES S.A.S.' },
                { id_productora: 3, productora: 'HACEMOS MODA S.A.S.' },
                { id_productora: 4, productora: 'INVERSIONES URBANA S.A.S.' }
            ];
        }
    }

    _bindEvents() {
        this.container.querySelector('#p-btn-back')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });

        this.container.querySelector('#p-btn-add')?.addEventListener('click', () => this._openCreate());

        const tabs = this.container.querySelectorAll('.p-tab');
        tabs.forEach(t => t.addEventListener('click', () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            this.mode = t.dataset.tab;
            this.page = 1;
            const s = this.container.querySelector('#p-search');
            if (s) {
                s.placeholder = this.mode === 'USERS'
                    ? 'Buscar por nombre o cargo...'
                    : 'Buscar planta por nombre o NIT...';
            }
            this._render();
        }));

        this.container.querySelector('#p-search')?.addEventListener('input', (e) => {
            this.query = e.target.value.trim().toLowerCase();
            this.page = 1;
            this._render();
        });

        this.container.querySelector('#p-backdrop')?.addEventListener('click', () => this._closeSheet());
    }

    async _cargar(forceRefresh = false) {
        this._showSkeleton(true);
        try {
            if (forceRefresh && this.useCase?.cacheService) {
                this.useCase.cacheService.delete('DIR_USERS');
                this.useCase.cacheService.delete('DIR_PLANTS');
            }

            const [rawUsers, rawPlants] = await Promise.all([
                this.useCase.getUsers({}),
                this.useCase.getPlants({})
            ]);

            this.users = (rawUsers || []).map(u => this._normUser(u));
            this.plants = (rawPlants || []).map(p => this._normPlant(p));

            // Actualizar contadores en tabs
            const countUsersEl = this.container?.querySelector('#p-count-users');
            const countPlantsEl = this.container?.querySelector('#p-count-plants');
            if (countUsersEl) countUsersEl.textContent = this.users.length;
            if (countPlantsEl) countPlantsEl.textContent = this.plants.length;

        } catch (e) {
            console.error('[PersonasModule] Error al cargar:', e);
            Toast.error('Error al cargar personas: ' + e.message);
        }

        this._showSkeleton(false);
        this._render();
    }

    _normUser(u) {
        const raw = u instanceof User ? u : (User.fromRecord(u) || u || {});
        let cedula = String(raw.cedula || raw.CEDULA || '').trim();
        if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cedula) || cedula.length > 20) {
            cedula = '';
        }

        return {
            _type: 'USER',
            id: String(raw.id || raw.auth_user_id || ''),
            nombre: raw.nombre || raw.USUARIO || raw.full_name || raw.email || 'Sin nombre',
            correo: raw.email || raw.CORREO || raw.EMAIL || '',
            tel: raw.telefono || raw.TELEFONO || raw.phone || '',
            rol: (raw.rol || raw.ROL || 'GUEST').toUpperCase(),
            prod: raw.productora || raw.PRODUCTORA || '',
            id_prod: raw.id_productora || raw.ID_PRODUCTORA || null,
            pass: '',
            cedula: cedula,
            auth_user_id: raw.auth_user_id || raw.id || '',
            cargo: raw.cargo || '',
            area: raw.area || '',
            planta: raw.planta || '',
            foto: raw.fotoUrl || raw.foto_url || raw.FOTO_URL || raw.avatar_url || raw.avatar || ''
        };
    }

    _normPlant(p) {
        const raw = p instanceof Plant ? p : (Plant.fromRecord(p) || p || {});
        const plantId = String(raw.id || raw.id_planta || raw.ID_PLANTA || raw.nit || '');
        const plantNit = String(raw.nit || raw.id_planta || raw.ID_PLANTA || raw.id || '');

        return {
            _type: 'PLANT',
            id: plantId,
            nit: plantNit,
            nombre: raw.nombre || raw.PLANTA || raw.planta || 'Taller sin nombre',
            correo: raw.email || raw.EMAIL || raw.correo || raw.CORREO || '',
            tel: raw.telefono || raw.TELEFONO || raw.tel || '',
            rol: raw.rol === 'DESHABILITADO' ? 'DESHABILITADO' : 'GUEST',
            dir: raw.direccion || raw.DIRECCION || raw.dir || '',
            ciudad: raw.municipio || raw.MUNICIPIO || raw.ciudad || raw.CIUDAD || '',
            productora: raw.productora || '',
            pass: ''
        };
    }

    _render() {
        const ROL_ORDER = {
            'ADMIN': 0, 'MODERATOR': 1,
            'USER-P': 2, 'USER-C': 3, 'USER-I': 4,
            'GUEST': 5
        };

        const list = this.mode === 'USERS'
            ? this.users.filter(u => u.rol !== 'PENDIENTE' && u.rol !== 'DESHABILITADO')
            : this.plants.filter(p => p.rol !== 'DESHABILITADO');

        const filtered = list.filter(i => !this.query ||
            (i.nombre || '').toLowerCase().includes(this.query) ||
            (i.correo || '').toLowerCase().includes(this.query) ||
            (i.id || '').toLowerCase().includes(this.query) ||
            (i.cedula || '').toLowerCase().includes(this.query) ||
            (i.nit || '').toLowerCase().includes(this.query) ||
            (i.cargo || '').toLowerCase().includes(this.query) ||
            (i.ciudad || '').toLowerCase().includes(this.query)
        ).sort((a, b) => {
            const ra = ROL_ORDER[a.rol] ?? 9;
            const rb = ROL_ORDER[b.rol] ?? 9;
            if (ra !== rb) return ra - rb;
            return (a.nombre || '').localeCompare(b.nombre || '', 'es');
        });

        const start = (this.page - 1) * PER_PAGE;
        const slice = filtered.slice(start, start + PER_PAGE);
        const listEl = this.container.querySelector('#p-list');
        if (!listEl) return;

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center;padding:48px 20px;color:var(--color-text-muted,#94a3b8)">
                    ${_svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>', 38)}
                    <p style="margin-top:12px;font-size:.9rem;font-weight:600">No se encontraron resultados</p>
                    <p style="font-size:.78rem;color:#94a3b8;margin-top:4px">Intenta con otro término de búsqueda</p>
                </div>`;
        } else {
            listEl.innerHTML = slice.map((item, i) => {
                const m = _meta(item.rol);

                if (item._type === 'USER') {
                    // Cargo predeterminado por rol si no tiene cargo definido
                    const DEFAULT_CARGO = {
                        'USER-C':    'Auditor de Calidad',
                        'USER-I':    'Auxiliar Logístico',
                        'USER-P':    'Operario de Producción',
                        'ADMIN':     'Administrador',
                        'MODERATOR': 'Supervisor',
                        'GUEST':     'Colaborador'
                    };
                    const subtitle = item.cargo || DEFAULT_CARGO[item.rol] || '';

                    // Avatar con foto o iniciales
                    const avatarHtml = _avatarHtml(item.nombre, _grad(item.rol), item.foto);

                    // Botones de acción icono (sin borde, solo icono)
                    const mailBtn = item.correo && item.correo !== '—'
                        ? `<button class="p-action-btn" title="Enviar correo" onclick="event.stopPropagation();window.location.href='mailto:${item.correo}'">${_svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', 15)}</button>`
                        : '';
                    const telBtn = item.tel && item.tel !== '—'
                        ? `<button class="p-action-btn" title="Llamar" onclick="event.stopPropagation();window.location.href='tel:${item.tel}'">${_svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', 15)}</button>`
                        : '';

                    return `
                        <div class="p-card" data-idx="${start + i}">
                            ${avatarHtml}
                            <div class="p-info">
                                <div class="p-name">${item.nombre}</div>
                                ${subtitle ? `<div class="p-card-sub">${subtitle}</div>` : ''}
                            </div>
                            <div class="p-card-right">
                                <span class="p-badge ${m.badge}">${m.label}</span>
                                <div class="p-action-row">
                                    ${mailBtn}${telBtn}
                                    <span class="p-chevron">${_svg('<polyline points="9 18 15 12 9 6"/>')}</span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Para plantas: nombre + ciudad como subtitle
                    const subtitle = item.ciudad && item.ciudad !== '—' ? item.ciudad : (item.nit ? `NIT: ${item.nit}` : '');

                    // Avatar circular con iniciales del nombre de la planta
                    const plantInits = (item.nombre || 'P').trim().split(' ').filter(Boolean)
                        .slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'P';
                    const avatarHtml = `<div class="p-avatar" style="background:linear-gradient(135deg,#0284c7,#2563eb);border-radius:50%;width:46px;height:46px;min-width:46px;min-height:46px;aspect-ratio:1/1;flex-shrink:0;">${plantInits}</div>`;

                    const mailBtn = item.correo && item.correo !== '—'
                        ? `<button class="p-action-btn" title="Enviar correo" onclick="event.stopPropagation();window.location.href='mailto:${item.correo}'">${_svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>', 15)}</button>`
                        : '';
                    const telBtn = item.tel && item.tel !== '—'
                        ? `<button class="p-action-btn" title="Llamar" onclick="event.stopPropagation();window.location.href='tel:${item.tel}'">${_svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', 15)}</button>`
                        : '';

                    return `
                        <div class="p-card p-card-plant" data-idx="${start + i}">
                            ${avatarHtml}
                            <div class="p-info">
                                <div class="p-name">${item.nombre}</div>
                                ${subtitle ? `<div class="p-card-sub">${subtitle}</div>` : ''}
                            </div>
                            <div class="p-card-right">
                                <span class="p-badge pb-guest">Planta</span>
                                <div class="p-action-row">
                                    ${mailBtn}${telBtn}
                                    <span class="p-chevron">${_svg('<polyline points="9 18 15 12 9 6"/>')}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            listEl.querySelectorAll('.p-card').forEach(card => {
                card.addEventListener('click', () => {
                    const item = filtered[parseInt(card.dataset.idx, 10)];
                    if (item) this._openDetail(item);
                });
            });
        }

        this._renderPag(filtered.length);
    }

    _renderPag(total) {
        const pag = this.container.querySelector('#p-pagination');
        if (!pag) return;
        const pages = Math.ceil(total / PER_PAGE);
        if (pages <= 1) {
            pag.innerHTML = '';
            return;
        }

        pag.innerHTML = `
            <button class="p-page-btn" id="p-prev" ${this.page === 1 ? 'disabled' : ''}>
                ${_svg('<polyline points="15 18 9 12 15 6"/>')} Anterior
            </button>
            <span class="p-page-info">Pág. ${this.page} / ${pages}</span>
            <button class="p-page-btn" id="p-next" ${this.page === pages ? 'disabled' : ''}>
                Siguiente ${_svg('<polyline points="9 18 15 12 9 6"/>')}
            </button>
        `;

        pag.querySelector('#p-prev')?.addEventListener('click', () => {
            this.page--;
            this._render();
        });
        pag.querySelector('#p-next')?.addEventListener('click', () => {
            this.page++;
            this._render();
        });
    }

    /* ── Sheet detalle ── */
    _openDetail(item) {
        const m = _meta(item.rol);
        const displayId = item._type === 'USER' ? (item.cedula || 'Sin cédula') : (item.nit || item.id || 'Sin NIT');
        const currentUser = Store.getState().currentUser;
        const curRole = (currentUser?.rol || currentUser?.role || '').toUpperCase();
        const canEdit = !curRole || ['ADMIN', 'MODERATOR'].includes(curRole) || true;

        const body = this.container.querySelector('#p-sheet-body');
        if (!body) return;

        const plantSheetInits = (item.nombre || 'P').trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || 'P';
        const avatarMarkup = item._type === 'USER'
            ? _avatarHtml(item.nombre, _grad(item.rol), item.foto, 56, 'circle')
            : `<div class="p-sheet-avatar" style="background:linear-gradient(135deg,#0284c7,#2563eb);border-radius:50%;font-size:1.1rem;font-weight:800;color:#fff;width:56px;height:56px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.12);">${plantSheetInits}</div>`;

        body.innerHTML = `
            <div class="p-sheet-head">
                ${avatarMarkup}
                <div>
                    <p class="p-sheet-name">${item.nombre}</p>
                    <p class="p-sheet-email">${item.correo || 'Sin correo'}</p>
                    <span class="p-badge ${m.badge}" style="margin-top:4px;display:inline-block">${m.label}</span>
                </div>
            </div>
            <div class="p-section">
                <div class="p-section-title">Identificación</div>
                <div class="p-row">
                    <span class="p-row-label">${item._type === 'USER' ? 'Cédula' : 'NIT / ID'}</span>
                    <span class="p-row-value">${displayId}</span>
                </div>
                <div class="p-row">
                    <span class="p-row-label">Rol</span>
                    <span class="p-row-value">${m.label}</span>
                </div>
            </div>
            ${(item.correo && item.correo !== '—') || (item.tel && item.tel !== '—') || item.dir || item.ciudad ? `
            <div class="p-section">
                <div class="p-section-title">Contacto</div>
                ${item.correo && item.correo !== '—' ? `
                <div class="p-row">
                    <span class="p-row-label">Correo</span>
                    <span class="p-row-value">${item.correo}</span>
                </div>` : ''}
                ${item.tel && item.tel !== '—' ? `
                <div class="p-row">
                    <span class="p-row-label">Teléfono</span>
                    <span class="p-row-value">${item.tel}</span>
                </div>` : ''}
                ${item.dir ? `
                    <div class="p-row">
                        <span class="p-row-label">Dirección</span>
                        <span class="p-row-value">${item.dir}</span>
                    </div>
                ` : ''}
                ${item.ciudad ? `
                    <div class="p-row">
                        <span class="p-row-label">Ciudad / Municipio</span>
                        <span class="p-row-value">${item.ciudad}</span>
                    </div>
                ` : ''}
            </div>
            ` : ''}
            ${item._type === 'USER' && (item.prod || item.cargo || item.area) ? `
                <div class="p-section">
                    <div class="p-section-title">Organización</div>
                    ${item.cargo ? `<div class="p-row"><span class="p-row-label">Cargo</span><span class="p-row-value">${item.cargo}</span></div>` : ''}
                    ${item.area ? `<div class="p-row"><span class="p-row-label">Área</span><span class="p-row-value">${item.area}</span></div>` : ''}
                    ${item.prod && item.prod !== '—' ? `<div class="p-row"><span class="p-row-label">Productora</span><span class="p-row-value">${item.prod}</span></div>` : ''}
                </div>
            ` : ''}
            <div class="p-sheet-actions">
                ${canEdit ? `
                    <button class="p-btn-primary" id="p-btn-edit">
                        ${_svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')} Editar
                    </button>
                ` : ''}
                <button class="p-btn-secondary" id="p-close-det">Cerrar</button>
            </div>
        `;

        body.querySelector('#p-close-det')?.addEventListener('click', () => this._closeSheet());
        if (canEdit) {
            body.querySelector('#p-btn-edit')?.addEventListener('click', () => {
                this._closeSheet();
                setTimeout(() => this._openEdit(item), 250);
            });
        }

        this._openSheet();
    }

    /* ── Sheet edición ── */
    _openEdit(item) {
        const isPlant = item._type === 'PLANT';
        const prodOpts = this.prods.map(p => `
            <option value="${p.id_productora}" ${String(item.id_prod) === String(p.id_productora) || (item.prod && item.prod.toUpperCase() === p.productora.toUpperCase()) ? 'selected' : ''}>
                ${p.productora}
            </option>
        `).join('');

        const roles = isPlant
            ? ['GUEST', 'DESHABILITADO']
            : ['ADMIN', 'MODERATOR', 'USER-P', 'USER-C', 'USER-I', 'GUEST', 'PENDIENTE', 'DESHABILITADO'];

        const body = this.container.querySelector('#p-sheet-body');
        if (!body) return;

        const plantEditInits = (item.nombre || 'P').trim().split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || 'P';
        const avatarMarkup = !isPlant
            ? _avatarHtml(item.nombre, _grad(item.rol), item.foto, 56, 'circle')
            : `<div class="p-sheet-avatar" style="background:linear-gradient(135deg,#0284c7,#2563eb);border-radius:50%;font-size:1.1rem;font-weight:800;color:#fff;width:56px;height:56px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.12);">${plantEditInits}</div>`;

        body.innerHTML = `
            <div class="p-sheet-head">
                ${avatarMarkup}
                <div>
                    <p class="p-sheet-name">Editar ${isPlant ? 'Taller' : 'Colaborador'}</p>
                    <p class="p-sheet-email">${item.correo || item.nombre}</p>
                </div>
            </div>
            <div style="padding:12px 20px 0">
                ${!isPlant ? `
                    <div class="p-field">
                        <div class="p-field-label">Cédula</div>
                        <input class="p-field-input" id="pe-cedula" value="${item.cedula || ''}" placeholder="Ingrese cédula">
                    </div>
                    <div class="p-field">
                        <div class="p-field-label">Nombre Completo</div>
                        <input class="p-field-input" id="pe-nombre" value="${item.nombre}" placeholder="Nombre completo">
                    </div>
                ` : `
                    <div class="p-field">
                        <div class="p-field-label">NIT / ID</div>
                        <div class="p-field-wrap">
                            <input class="p-field-input" id="pe-id" value="${item.nit || item.id}" disabled style="padding-right:36px">
                            <button class="p-field-lock" id="pe-lock-id" title="Desbloquear">
                                ${_svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}
                            </button>
                        </div>
                    </div>
                    <div class="p-field">
                        <div class="p-field-label">Nombre Taller</div>
                        <div class="p-field-wrap">
                            <input class="p-field-input" id="pe-nombre" value="${item.nombre}" disabled style="padding-right:36px">
                            <button class="p-field-lock" id="pe-lock-n" title="Desbloquear">
                                ${_svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}
                            </button>
                        </div>
                    </div>
                `}
                <div class="p-field">
                    <div class="p-field-label">Correo</div>
                    <input class="p-field-input" id="pe-correo" type="email" value="${item.correo || ''}" placeholder="correo@ejemplo.com">
                </div>
                <div class="p-field">
                    <div class="p-field-label">Teléfono (10 dígitos sin +)</div>
                    <input class="p-field-input" id="pe-tel" type="tel" maxlength="10" inputmode="numeric" value="${item.tel !== '—' && item.tel ? String(item.tel).replace(/\D/g, '').slice(0, 10) : ''}" placeholder="Ej: 3001234567">
                </div>
                ${isPlant ? `
                    <div class="p-field">
                        <div class="p-field-label">Dirección</div>
                        <input class="p-field-input" id="pe-dir" value="${item.dir !== '—' && item.dir ? item.dir : ''}" placeholder="Dirección completa">
                    </div>
                ` : ''}
                <div class="p-field">
                    <div class="p-field-label">Rol</div>
                    <select class="p-field-select" id="pe-rol">
                        ${roles.map(r => `<option value="${r}" ${item.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>
                ${!isPlant ? `
                    <div class="p-field">
                        <div class="p-field-label">Productora</div>
                        <select class="p-field-select" id="pe-prod">
                            <option value="">-- Sin asignar --</option>
                            ${prodOpts}
                        </select>
                    </div>
                ` : ''}
                <div class="p-field">
                    <div class="p-field-label">Contraseña</div>
                    <div class="p-field-wrap">
                        <input class="p-field-input" id="pe-pass" type="password" value="" autocomplete="new-password" style="padding-right:36px" placeholder="Dejar vacío para no cambiar">
                        <button class="p-field-lock" id="pe-eye" title="Mostrar/Ocultar">
                            ${_svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')}
                        </button>
                    </div>
                </div>
            </div>
            <div class="p-sheet-actions">
                <button class="p-btn-primary" id="pe-save">
                    ${_svg('<polyline points="20 6 9 17 4 12"/>')} Guardar
                </button>
                <button class="p-btn-secondary" id="pe-cancel">Cancelar</button>
            </div>
        `;

        if (isPlant) {
            body.querySelector('#pe-lock-id')?.addEventListener('click', () => {
                const i = body.querySelector('#pe-id');
                if (i) i.disabled = !i.disabled;
            });
            body.querySelector('#pe-lock-n')?.addEventListener('click', () => {
                const i = body.querySelector('#pe-nombre');
                if (i) i.disabled = !i.disabled;
            });
        }

        body.querySelector('#pe-eye')?.addEventListener('click', () => {
            const i = body.querySelector('#pe-pass');
            if (i) i.type = i.type === 'password' ? 'text' : 'password';
        });

        body.querySelector('#pe-cancel')?.addEventListener('click', () => this._closeSheet());
        body.querySelector('#pe-save')?.addEventListener('click', () => this._saveEdit(item));

        // Restricción estricta: máximo 10 dígitos, prohibir el signo + y caracteres no numéricos
        const peTel = body.querySelector('#pe-tel');
        if (peTel) {
            peTel.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });
            peTel.addEventListener('keydown', (e) => {
                if (e.key === '+' || e.key === 'e' || e.key === '.' || e.key === '-') {
                    e.preventDefault();
                }
            });
        }

        setTimeout(() => {
            const passInput = body.querySelector('#pe-pass');
            if (passInput) passInput.value = '';
        }, 100);

        this._openSheet();
    }

    async _saveEdit(item) {
        const body = this.container.querySelector('#p-sheet-body');
        const btn = body?.querySelector('#pe-save');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Guardando...';
        }

        const isPlant = item._type === 'PLANT';
        const userId = item.auth_user_id || item.id;
        const prodVal = body?.querySelector('#pe-prod')?.value || '';
        const selectedProd = this.prods.find(p => String(p.id_productora) === prodVal);

        const payload = {
            accion: isPlant ? 'ACTUALIZAR_PLANTA' : 'UPDATE_USER',
            id: userId,
            cedula: !isPlant ? (body?.querySelector('#pe-cedula')?.value || '').trim() : null,
            nuevoId: isPlant && (body?.querySelector('#pe-id')?.value || '').trim() !== item.id ? (body?.querySelector('#pe-id')?.value || '').trim() : null,
            usuario: !isPlant ? (body?.querySelector('#pe-nombre')?.value || '').trim() : null,
            nombrePlanta: isPlant ? (body?.querySelector('#pe-nombre')?.value || '').trim() : null,
            correo: (body?.querySelector('#pe-correo')?.value || '').trim(),
            email: isPlant ? (body?.querySelector('#pe-correo')?.value || '').trim() : null,
            telefono: (body?.querySelector('#pe-tel')?.value || '').replace(/\D/g, ''),
            direccion: isPlant ? (body?.querySelector('#pe-dir')?.value || '').trim() : null,
            rol: body?.querySelector('#pe-rol')?.value || item.rol,
            password: (body?.querySelector('#pe-pass')?.value || '').trim(),
            id_productora: prodVal ? parseInt(prodVal, 10) : null,
            productora: prodVal ? (selectedProd?.productora || null) : null
        };

        try {
            let res;
            if (isPlant) {
                res = await this.dataService.updatePersonaPlant(payload);
            } else {
                res = await this.dataService.updatePersonaUser(payload);
            }

            if (res && (res.success || !res.error)) {
                Toast.success('Actualizado correctamente');
                this._closeSheet();
                await this._cargar(true);
            } else {
                Toast.error(res?.message || 'Error al guardar');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `${_svg('<polyline points="20 6 9 17 4 12"/>')} Guardar`;
                }
            }
        } catch (e) {
            console.error('[PersonasModule] Error al guardar:', e);
            Toast.error('No se pudo guardar: ' + e.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${_svg('<polyline points="20 6 9 17 4 12"/>')} Guardar`;
            }
        }
    }

    /* ── Crear nuevo ── */
    _openCreate() {
        const isPlant = this.mode === 'PLANTS';
        const prodOpts = this.prods.map(p => `
            <option value="${p.id_productora}">${p.productora}</option>
        `).join('');

        const roles = isPlant
            ? ['GUEST', 'DESHABILITADO']
            : ['USER-P', 'USER-C', 'USER-I', 'MODERATOR', 'ADMIN', 'GUEST'];

        const body = this.container.querySelector('#p-sheet-body');
        if (!body) return;

        body.innerHTML = `
            <div class="p-sheet-head">
                <div class="p-sheet-avatar" style="background:linear-gradient(135deg,#3b82f6,#6366f1)">
                    ${_svg('<path d="M12 5v14M5 12h14"/>', 22)}
                </div>
                <div>
                    <p class="p-sheet-name">Nuevo ${isPlant ? 'Taller' : 'Colaborador'}</p>
                    <p class="p-sheet-email">Completar todos los campos</p>
                </div>
            </div>
            <div style="padding:12px 20px 0">
                <div class="p-field">
                    <div class="p-field-label">ID / Cédula / NIT</div>
                    <input class="p-field-input" id="pc-id" placeholder="Ej: 1234567890">
                </div>
                <div class="p-field">
                    <div class="p-field-label">${isPlant ? 'Nombre Taller' : 'Nombre Completo'}</div>
                    <input class="p-field-input" id="pc-nombre" placeholder="Nombre real">
                </div>
                <div class="p-field">
                    <div class="p-field-label">Correo</div>
                    <input class="p-field-input" id="pc-correo" type="email" placeholder="correo@ejemplo.com">
                </div>
                <div class="p-field">
                    <div class="p-field-label">Teléfono (10 dígitos sin +)</div>
                    <input class="p-field-input" id="pc-tel" type="tel" maxlength="10" inputmode="numeric" placeholder="Ej: 3001234567">
                </div>
                ${isPlant ? `
                    <div class="p-field">
                        <div class="p-field-label">Dirección</div>
                        <input class="p-field-input" id="pc-dir" placeholder="Calle, Ciudad">
                    </div>
                ` : ''}
                <div class="p-field">
                    <div class="p-field-label">Rol</div>
                    <select class="p-field-select" id="pc-rol">
                        ${roles.map((r, i) => `<option value="${r}" ${i === 0 ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>
                ${!isPlant ? `
                    <div class="p-field">
                        <div class="p-field-label">Productora</div>
                        <select class="p-field-select" id="pc-prod">
                            <option value="">-- Sin asignar --</option>
                            ${prodOpts}
                        </select>
                    </div>
                ` : ''}
                <div class="p-field">
                    <div class="p-field-label">Contraseña</div>
                    <input class="p-field-input" id="pc-pass" type="password" placeholder="Defina una clave">
                </div>
            </div>
            <div class="p-sheet-actions">
                <button class="p-btn-primary" id="pc-save">
                    ${_svg('<polyline points="20 6 9 17 4 12"/>')} Crear
                </button>
                <button class="p-btn-secondary" id="pc-cancel">Cancelar</button>
            </div>
        `;

        body.querySelector('#pc-cancel')?.addEventListener('click', () => this._closeSheet());
        body.querySelector('#pc-save')?.addEventListener('click', () => this._saveCreate(isPlant));

        // Restricción estricta: máximo 10 dígitos, prohibir el signo + y caracteres no numéricos
        const pcTel = body.querySelector('#pc-tel');
        if (pcTel) {
            pcTel.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });
            pcTel.addEventListener('keydown', (e) => {
                if (e.key === '+' || e.key === 'e' || e.key === '.' || e.key === '-') {
                    e.preventDefault();
                }
            });
        }

        this._openSheet();
    }

    async _saveCreate(isPlant) {
        const body = this.container.querySelector('#p-sheet-body');
        const btn = body?.querySelector('#pc-save');
        const id = (body?.querySelector('#pc-id')?.value || '').trim();
        const nombre = (body?.querySelector('#pc-nombre')?.value || '').trim();
        const correo = (body?.querySelector('#pc-correo')?.value || '').trim();
        const tel = (body?.querySelector('#pc-tel')?.value || '').replace(/\D/g, '').slice(0, 10);
        const pass = (body?.querySelector('#pc-pass')?.value || '').trim();
        const rol = body?.querySelector('#pc-rol')?.value || 'GUEST';
        const dir = (body?.querySelector('#pc-dir')?.value || '').trim();
        const prodId = body?.querySelector('#pc-prod')?.value || '';

        if (!id || !nombre || !correo || !tel || !pass) {
            Toast.warning('Todos los campos son obligatorios');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
        }

        const selectedProd = this.prods.find(p => String(p.id_productora) === prodId);
        const payload = {
            accion: isPlant ? 'CREAR_PLANTA' : 'CREAR_USUARIO',
            id,
            cedula: id,
            usuario: !isPlant ? nombre : null,
            planta: isPlant ? nombre : null,
            nombrePlanta: isPlant ? nombre : null,
            correo,
            email: isPlant ? correo : null,
            telefono: tel,
            direccion: isPlant ? dir : null,
            rol,
            password: pass,
            id_productora: prodId ? parseInt(prodId, 10) : null,
            productora: prodId ? (selectedProd?.productora || null) : null
        };

        try {
            let res;
            if (isPlant) {
                res = await this.dataService.createPersonaPlant(payload);
            } else {
                res = await this.dataService.createPersonaUser(payload);
            }

            if (res && (res.success || !res.error)) {
                Toast.success('Creado exitosamente');
                this._closeSheet();
                await this._cargar(true);
            } else {
                Toast.error(res?.message || 'Error al crear');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `${_svg('<polyline points="20 6 9 17 4 12"/>')} Crear`;
                }
            }
        } catch (e) {
            console.error('[PersonasModule] Error al crear:', e);
            Toast.error('No se pudo crear: ' + e.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${_svg('<polyline points="20 6 9 17 4 12"/>')} Crear`;
            }
        }
    }

    _openSheet() {
        this.container?.querySelector('#p-backdrop')?.classList.add('open');
        this.container?.querySelector('#p-sheet')?.classList.add('open');
    }

    _closeSheet() {
        this.container?.querySelector('#p-backdrop')?.classList.remove('open');
        this.container?.querySelector('#p-sheet')?.classList.remove('open');
    }

    _showSkeleton(on) {
        const sk = this.container?.querySelector('#personas-skeleton');
        const real = this.container?.querySelector('#personas-real');
        if (sk) sk.style.display = on ? 'flex' : 'none';
        if (real) real.style.display = on ? 'none' : 'flex';
    }

    unmount() {
        this.container = null;
    }
}
