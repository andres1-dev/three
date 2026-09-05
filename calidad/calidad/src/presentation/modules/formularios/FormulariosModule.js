import { Store } from '../../state/Store.js';
import { Toast } from '../../components/Toast.js';
import { NovedadesSubForm } from './forms/NovedadesSubForm.js';
import { CalidadSubForm } from './forms/CalidadSubForm.js';
import { RuteroSubForm } from './forms/RuteroSubForm.js';
import { PlantaDataSubForm } from './forms/PlantaDataSubForm.js';

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
 * Definición de Formularios con los mismos íconos Streamline y estilo de Apps.
 */
const FORMULARIOS_DEFINITIONS = [
    { id: 'novedades', label: 'Novedades', icon: 'task-list-edit-flat',    palette: 'Naranja' },
    { id: 'calidad',   label: 'Calidad',   icon: 'star-medal-flat',        palette: 'Azul' },
    { id: 'rutero',    label: 'Rutero',    icon: 'calendar-check-flat',    palette: 'Verde' },
    { id: 'planta',    label: 'Planta',    icon: 'hierarchy-1-flat',       palette: 'Morado' }
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

export class FormulariosModule {
    /**
     * @param {Object} deps
     * @param {Object} deps.router
     * @param {Object} deps.getLotesUseCase
     * @param {Object} deps.submitNovedadUseCase
     * @param {Object} deps.submitCalidadUseCase
     * @param {Object} deps.submitRuteroUseCase
     * @param {Object} deps.dataService
     */
    constructor({
        router,
        getLotesUseCase,
        submitNovedadUseCase,
        submitCalidadUseCase,
        submitRuteroUseCase,
        dataService
    }) {
        this.router = router;
        this.getLotesUseCase = getLotesUseCase;
        this.submitNovedadUseCase = submitNovedadUseCase;
        this.submitCalidadUseCase = submitCalidadUseCase;
        this.submitRuteroUseCase = submitRuteroUseCase;
        this.dataService = dataService;

        this.container = null;
        this.currentView = 'HUB';
        this.activeLote = null;
        this.productoras = [];
        this.selectedProductora = '';
        this.lotes = [];
        this.currentSubFormInstance = null;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.className = 'mod-formularios';

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        // Cargar Productoras y Lotes en segundo plano
        this._cargarProductorasYLotes();

        // Mostrar pantalla de menú con iconos idénticos a Apps
        this._renderHubView();
    }

    async _cargarProductorasYLotes() {
        try {
            const { currentUser } = Store.getState();
            const [productoras, lotes] = await Promise.all([
                this.getLotesUseCase.getProductoras().catch(() => []),
                this.getLotesUseCase.execute({
                    planta: currentUser?.planta || '',
                    productora: this.selectedProductora,
                    rol: currentUser?.rol || ''
                }).catch(() => [])
            ]);

            this.productoras = productoras || [];
            this.lotes = lotes || [];

            if (this.currentSubFormInstance) {
                if (this.currentSubFormInstance.setProductoras) {
                    this.currentSubFormInstance.setProductoras(this.productoras);
                }
                if (this.currentSubFormInstance.setLotes) {
                    this.currentSubFormInstance.setLotes(this.lotes);
                }
            }
        } catch (err) {
            console.warn('[FormulariosModule] Error precargando productoras y lotes:', err);
        }
    }

    _renderHubView() {
        this.currentView = 'HUB';
        this.currentSubFormInstance = null;

        const cardsHtml = FORMULARIOS_DEFINITIONS.map(app => `
            <div class="app-card" data-module="${app.id}" data-icon="${app.icon}" data-palette="${app.palette}">
                <div class="icon-card-box"></div>
                <span class="app-label">${app.label}</span>
            </div>
        `).join('');

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn" id="btn-back-apps" aria-label="Volver a Apps">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Formularios</h1>
            </div>

            <div id="view-formularios-hub" class="view active">
                <div class="apps-grid">
                    ${cardsHtml}
                </div>
            </div>
        `;

        // Renderizar y recolorizar íconos vectoriales
        this._renderAllIcons();

        this.container.querySelector('#btn-back-apps')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });

        this.container.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', () => {
                const formId = card.dataset.module;
                this._openForm(formId);
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
            const raw = await fetchSVG(prefix, iconName);
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

    _openForm(formId) {
        this.currentView = formId;
        this.container.innerHTML = `<div id="subform-viewport" class="f-subform-viewport"></div>`;
        const subViewport = this.container.querySelector('#subform-viewport');
        const { currentUser } = Store.getState();

        const onBackToHub = () => this._renderHubView();

        const onSearchLotes = async ({ query, productora }) => {
            try {
                const results = await this.getLotesUseCase.execute({
                    query,
                    productora: productora || this.selectedProductora,
                    planta: currentUser?.planta || '',
                    limit: 30
                });
                return results || [];
            } catch (err) {
                console.warn('[FormulariosModule] Error consultando lotes on-demand:', err);
                return [];
            }
        };

        const onProductoraChange = (productoraId) => {
            this.selectedProductora = productoraId;
        };

        const commonParams = {
            container: subViewport,
            activeLote: this.activeLote,
            productoras: this.productoras,
            selectedProductora: this.selectedProductora,
            onSearchLotes,
            onProductoraChange,
            currentUser,
            onBack: onBackToHub,
            onSuccess: onBackToHub
        };

        switch (formId) {
            case 'calidad':
                this.currentSubFormInstance = new CalidadSubForm({
                    ...commonParams,
                    submitUseCase: this.submitCalidadUseCase
                });
                break;

            case 'novedades':
                this.currentSubFormInstance = new NovedadesSubForm({
                    ...commonParams,
                    submitUseCase: this.submitNovedadUseCase
                });
                break;

            case 'rutero':
                this.currentSubFormInstance = new RuteroSubForm({
                    ...commonParams,
                    submitUseCase: this.submitRuteroUseCase
                });
                break;

            case 'planta':
                this.currentSubFormInstance = new PlantaDataSubForm({
                    ...commonParams,
                    dataService: this.dataService
                });
                break;

            default:
                this._renderHubView();
                break;
        }
    }

    unmount() {
        document.querySelectorAll('.f-modal-backdrop').forEach(el => el.remove());
        this.container = null;
        this.currentSubFormInstance = null;
    }
}
