import { Store } from '../../state/Store.js';
import { Toast } from '../../components/Toast.js';
import { MisReportesSubView } from './views/MisReportesSubView.js';
import { LiquidacionSubView } from './views/LiquidacionSubView.js';

/**
 * Paletas de color idénticas al catálogo de Apps de Calidad.
 */
const PALETTES = {
    'Morado':   { light: '#ebe7fe', dark: '#a599f5' },
    'Azul':     { light: '#e0edff', dark: '#8aacf0' },
    'Celeste':  { light: '#e4f7ff', dark: '#7dc9f0' },
    'Verde':    { light: '#ddf8ea', dark: '#75d0a5' },
    'Turquesa': { light: '#dff9f7', dark: '#70ccc7' },
    'Naranja':  { light: '#fff0dd', dark: '#f0b070' },
    'Rojo':     { light: '#ffe0e7', dark: '#f08a9f' },
    'Rosa':     { light: '#feeaf7', dark: '#f0a0ca' },
    'Amarillo': { light: '#fff8dd', dark: '#e8ca60' }
};

/**
 * Las dos secciones del módulo Archivo.
 */
const ARCHIVO_DEFINITIONS = [
    {
        id:      'mis-reportes',
        label:   'Mis Reportes',
        icon:    'file-report-flat',
        palette: 'Azul'
    },
    {
        id:      'liquidacion',
        label:   'Liquidación',
        icon:    'notepad-text-flat',
        palette: 'Verde'
    }
];

const API = 'https://api.iconify.design';
const svgCache = new Map();

async function fetchSVG(prefix, iconName) {
    const key = `${prefix}:${iconName}`;
    if (svgCache.has(key)) return svgCache.get(key);
    const url = `${API}/${prefix}/${encodeURIComponent(iconName)}.svg`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('SVG no encontrado');
    const svg = await res.text();
    svgCache.set(key, svg);
    return svg;
}

function extractColors(svg) {
    const found = new Set();
    (svg.match(/#[0-9a-fA-F]{3,8}/g) || []).forEach(c => {
        if (c.length === 4 || c.length === 7) found.add(c.toUpperCase());
    });
    return [...found];
}

function lum(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return parseInt(hex.slice(0, 2), 16) * 0.299
         + parseInt(hex.slice(2, 4), 16) * 0.587
         + parseInt(hex.slice(4, 6), 16) * 0.114;
}

function recolor(svg, palette) {
    const colors = extractColors(svg);
    if (!colors.length) return svg;
    if (colors.length === 1) return svg.replaceAll(colors[0], palette.light);
    const sorted  = [...colors].sort((a, b) => lum(a) - lum(b));
    const darkRef = sorted[0];
    let result    = svg;
    colors.forEach(color => {
        const rep = color === darkRef ? palette.dark : palette.light;
        result = result.replace(new RegExp(color, 'gi'), rep);
    });
    return result;
}

function monoColor(svg, palette) {
    return svg
        .replace(/stroke="(?!none)[^"]*"/g, `stroke="${palette.dark}"`)
        .replace(/fill="(?!none)[^"]*"/g,   `fill="${palette.light}"`);
}

function toElement(svgText, size = '100%') {
    const parser = new DOMParser();
    const el = parser.parseFromString(svgText, 'image/svg+xml').documentElement;
    el.setAttribute('width',  size);
    el.setAttribute('height', size);
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    el.style.display = 'block';
    return el;
}

export class ArchivoModule {
    /**
     * @param {Object} deps
     * @param {Object} deps.router
     * @param {Object} deps.dataService
     */
    constructor({ router, dataService }) {
        this.router      = router;
        this.dataService = dataService;
        this.container   = null;
        this.currentView = 'HUB';
        this.currentSubViewInstance = null;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.className = 'mod-archivo';

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        this._renderHubView();
    }

    // ─────────────────────────────────────────────────────────────
    //  HUB — pantalla principal con los dos íconos
    // ─────────────────────────────────────────────────────────────
    _renderHubView() {
        this.currentView = 'HUB';
        this.currentSubViewInstance = null;

        const cardsHtml = ARCHIVO_DEFINITIONS.map(item => `
            <div class="app-card" data-module="${item.id}" data-icon="${item.icon}" data-palette="${item.palette}">
                <div class="icon-card-box"></div>
                <span class="app-label">${item.label}</span>
            </div>
        `).join('');

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn" id="btn-back-apps" aria-label="Volver a Apps">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Archivo</h1>
            </div>

            <div id="view-archivo-hub" class="view active">
                <div class="apps-grid">
                    ${cardsHtml}
                </div>
            </div>
        `;

        // Renderizar íconos recolorizados
        this._renderAllIcons();

        this.container.querySelector('#btn-back-apps')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });

        this.container.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', () => {
                this._openSubView(card.dataset.module);
            });
        });
    }

    async _renderAllIcons() {
        if (!this.container) return;
        const cards = this.container.querySelectorAll('.app-card[data-module]');
        await Promise.all([...cards].map(card => this._renderCardIcon(card)));
    }

    async _renderCardIcon(card) {
        const box = card.querySelector('.icon-card-box');
        if (!box) return;

        const iconName    = card.dataset.icon;
        const paletteName = card.dataset.palette || 'Azul';
        const prefix      = 'streamline-plump-color';
        if (!iconName) return;

        const palette = PALETTES[paletteName] || PALETTES['Azul'];

        try {
            const raw     = await fetchSVG(prefix, iconName);
            const colored = prefix === 'streamline'
                ? monoColor(raw, palette)
                : recolor(raw, palette);
            const el = toElement(colored, '100%');
            box.innerHTML = '';
            box.appendChild(el);
        } catch (_) {
            box.innerHTML = `
                <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                </svg>
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Abrir subvista
    // ─────────────────────────────────────────────────────────────
    _openSubView(viewId) {
        if (this.currentSubViewInstance?.unmount) {
            try { this.currentSubViewInstance.unmount(); } catch (_) { /* noop */ }
        }
        this.currentSubViewInstance = null;
        this.currentView = viewId;

        this.container.innerHTML = `<div id="subview-viewport" class="f-subform-viewport"></div>`;
        const subViewport = this.container.querySelector('#subview-viewport');
        const { currentUser } = Store.getState();

        const onBack = () => this._renderHubView();

        switch (viewId) {
            case 'mis-reportes':
                this.currentSubViewInstance = new MisReportesSubView({
                    container: subViewport,
                    currentUser,
                    dataService: this.dataService,
                    onBack
                });
                break;

            case 'liquidacion':
                this.currentSubViewInstance = new LiquidacionSubView({
                    container: subViewport,
                    currentUser,
                    dataService: this.dataService,
                    onBack
                });
                break;

            default:
                this._renderHubView();
        }
    }

    unmount() {
        if (this.currentSubViewInstance?.unmount) {
            try { this.currentSubViewInstance.unmount(); } catch (_) { /* noop */ }
        }
        this.container = null;
        this.currentSubViewInstance = null;
    }
}
