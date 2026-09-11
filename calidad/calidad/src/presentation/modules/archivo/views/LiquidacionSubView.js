import { Toast } from '../../../components/Toast.js';

const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const ESTADO_CONFIG = {
    PENDIENTE:  { bg: '#fff7ed', color: '#f97316', label: 'Pendiente'  },
    APROBADO:   { bg: '#f0fdf4', color: '#10b981', label: 'Aprobado'   },
    RECHAZADO:  { bg: '#fff1f2', color: '#f43f5e', label: 'Rechazado'  },
    PROCESADO:  { bg: '#eff6ff', color: '#3b82f6', label: 'Procesado'  }
};

export class LiquidacionSubView {
    /**
     * @param {Object} opts
     * @param {HTMLElement} opts.container
     * @param {Object}      opts.currentUser
     * @param {Object}      opts.dataService   — SupabaseDataRepository
     * @param {Function}    opts.onBack
     */
    constructor({ container, currentUser, dataService, onBack }) {
        this.container   = container;
        this.currentUser = currentUser;
        this.dataService = dataService;
        this.onBack      = onBack;

        this._liquidaciones = [];
        this._loading       = false;

        const hoy = new Date();
        this._filtroMes    = hoy.getMonth();
        this._filtroAnio   = hoy.getFullYear();
        this._filtroCorreo = '';

        this._isAdminOrMod = ['ADMIN', 'MODERATOR', 'MODERADOR']
            .includes((currentUser?.rol || currentUser?.ROL || '').toUpperCase());

        this._render();
        this._cargarLiquidaciones();
    }

    // ─────────────────────────────────────────────────────────
    //  Render principal
    // ─────────────────────────────────────────────────────────
    _render() {
        const mesOpts = MESES.map((m, i) =>
            `<option value="${i}" ${i === this._filtroMes ? 'selected' : ''}>${m}</option>`
        ).join('');

        const anio = this._filtroAnio;
        const anioOpts = [anio - 1, anio, anio + 1].map(a =>
            `<option value="${a}" ${a === anio ? 'selected' : ''}>${a}</option>`
        ).join('');

        // Filtro de auditora solo visible para admin/mod
        const filtroCorrHtml = this._isAdminOrMod ? `
            <input type="text" class="ar-input" id="liq-correo"
                   placeholder="Filtrar por correo auditora"
                   value="${this._filtroCorreo}" />
        ` : '';

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn" id="liq-btn-back" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                         stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Liquidación</h1>
            </div>

            <div class="ar-filters">
                <div class="ar-filter-row">
                    <select class="ar-select" id="liq-mes">${mesOpts}</select>
                    <select class="ar-select" id="liq-anio">${anioOpts}</select>
                    ${filtroCorrHtml}
                    <button class="ar-btn-buscar" id="liq-btn-buscar">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                             stroke="currentColor" stroke-width="2.5">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        Buscar
                    </button>
                </div>
            </div>

            <div id="liq-kpi" class="liq-kpi-row" style="display:none;"></div>

            <div class="ar-content">
                <div class="ar-loader" id="liq-loader">
                    <div class="ar-spinner"></div>
                    <span>Cargando liquidaciones…</span>
                </div>
                <div id="liq-list" class="ar-list" style="display:none;"></div>
                <div id="liq-empty" class="ar-empty-state" style="display:none;">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none"
                         stroke="#94a3b8" stroke-width="1.5"
                         style="margin:0 auto 12px;display:block;">
                        <rect x="2" y="7" width="20" height="14" rx="2"/>
                        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                        <line x1="12" y1="12" x2="12" y2="16"/>
                        <line x1="10" y1="14" x2="14" y2="14"/>
                    </svg>
                    <p class="ar-empty-title">Sin liquidaciones</p>
                    <p class="ar-empty-sub">No hay liquidaciones para el período seleccionado</p>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    _bindEvents() {
        this.container.querySelector('#liq-btn-back')
            ?.addEventListener('click', () => this.onBack?.());

        this.container.querySelector('#liq-btn-buscar')
            ?.addEventListener('click', () => {
                this._filtroMes    = parseInt(this.container.querySelector('#liq-mes').value);
                this._filtroAnio   = parseInt(this.container.querySelector('#liq-anio').value);
                this._filtroCorreo = this.container.querySelector('#liq-correo')?.value?.trim() || '';
                this._cargarLiquidaciones();
            });
    }

    // ─────────────────────────────────────────────────────────
    //  Carga desde Edge Function /archivo
    // ─────────────────────────────────────────────────────────
    async _cargarLiquidaciones() {
        if (this._loading) return;
        this._loading = true;
        this._showLoader(true);

        try {
            const res = await this.dataService.listarLiquidaciones({
                mes:   this._filtroMes + 1,
                anio:  this._filtroAnio,
                email: this._isAdminOrMod ? this._filtroCorreo : '',
                rol:   this.currentUser?.rol || this.currentUser?.ROL || ''
            });

            this._liquidaciones = Array.isArray(res) ? res : (res?.data || []);
            this._renderKPI();
            this._renderLista();
        } catch (err) {
            console.error('[LiquidacionSubView]', err);
            Toast.error('Error al cargar liquidaciones: ' + err.message);
            this._showEmpty();
        } finally {
            this._loading = false;
            this._showLoader(false);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  KPI chips
    // ─────────────────────────────────────────────────────────
    _renderKPI() {
        const kpiEl = this.container?.querySelector('#liq-kpi');
        if (!kpiEl) return;

        if (!this._liquidaciones.length) {
            kpiEl.style.display = 'none';
            return;
        }

        const total = this._liquidaciones.length;
        const suma  = this._liquidaciones.reduce((acc, l) => {
            const v = parseFloat(l.VALOR || l.valor || 0);
            return acc + (isNaN(v) ? 0 : v);
        }, 0);

        kpiEl.style.display = 'flex';
        kpiEl.innerHTML = `
            <div class="liq-kpi-chip">
                <span class="liq-kpi-num">${total}</span>
                <span class="liq-kpi-lab">Liquidaciones</span>
            </div>
            ${suma > 0 ? `
            <div class="liq-kpi-chip">
                <span class="liq-kpi-num">${this._formatMoneda(suma)}</span>
                <span class="liq-kpi-lab">Total</span>
            </div>` : ''}
        `;
    }

    // ─────────────────────────────────────────────────────────
    //  Lista de cards
    // ─────────────────────────────────────────────────────────
    _renderLista() {
        const listEl  = this.container?.querySelector('#liq-list');
        const emptyEl = this.container?.querySelector('#liq-empty');
        if (!listEl || !emptyEl) return;

        if (!this._liquidaciones.length) {
            listEl.style.display  = 'none';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.style.display  = 'flex';

        listEl.innerHTML = this._liquidaciones.map(liq => {
            const estado  = (liq.ESTADO || 'PENDIENTE').toUpperCase();
            const cfg     = ESTADO_CONFIG[estado] || ESTADO_CONFIG.PENDIENTE;
            const fecha   = this._formatFecha(liq.FECHA || '');
            const correo  = liq.CORREO || '—';
            const planta  = liq.PRODUCTORA || '—';
            const periodo = liq.PERIODO || fecha;
            const cc      = liq.CC ? `CC: ${liq.CC}` : '';
            const tipo    = liq.TIPO || 'Rodamiento';
            const valor   = liq.VALOR ? this._formatMoneda(liq.VALOR) : null;
            const desc    = liq.DESCUENTOS || '';

            return `
                <div class="ar-report-card liq-card">
                    <div class="ar-card-top">
                        <span class="ar-tipo-badge"
                              style="background:${cfg.bg};color:${cfg.color};">
                            ${cfg.label}
                        </span>
                        <span class="ar-card-fecha">${periodo}</span>
                    </div>
                    <div class="ar-card-body">
                        <p class="ar-card-lote">
                            <strong>${tipo}</strong>
                            ${valor ? `<span class="liq-valor">${valor}</span>` : ''}
                        </p>
                        ${planta !== '—' ? `<p class="ar-card-ref">${planta}</p>` : ''}
                        ${cc ? `<p class="ar-card-ref">${cc}</p>` : ''}
                        ${desc ? `<p class="ar-card-ref" style="color:#f97316;">Desc: ${desc}</p>` : ''}
                        ${this._isAdminOrMod
                            ? `<p class="liq-correo-line">${correo}</p>`
                            : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────────────────
    //  Helpers UI
    // ─────────────────────────────────────────────────────────
    _showLoader(show) {
        const loader = this.container?.querySelector('#liq-loader');
        const list   = this.container?.querySelector('#liq-list');
        const empty  = this.container?.querySelector('#liq-empty');
        const kpi    = this.container?.querySelector('#liq-kpi');
        if (!loader) return;
        loader.style.display = show ? 'flex' : 'none';
        if (show) {
            if (list)  list.style.display  = 'none';
            if (empty) empty.style.display = 'none';
            if (kpi)   kpi.style.display   = 'none';
        }
    }

    _showEmpty() {
        const listEl  = this.container?.querySelector('#liq-list');
        const emptyEl = this.container?.querySelector('#liq-empty');
        if (listEl)  listEl.style.display  = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
    }

    _formatFecha(raw) {
        if (!raw) return '—';
        try {
            const d = new Date(raw);
            if (isNaN(d)) return raw;
            return d.toLocaleDateString('es-CO', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch (_) { return raw; }
    }

    _formatMoneda(valor) {
        try {
            return new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', maximumFractionDigits: 0
            }).format(valor);
        } catch (_) { return `$${valor}`; }
    }

    unmount() {
        this.container = null;
    }
}
