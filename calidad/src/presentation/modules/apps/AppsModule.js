import { Toast } from '../../components/Toast.js';

/**
 * Paletas de color en 2 tonos (light / dark) idénticas al original.
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
 * Catálogo completo de Apps idéntico al diseño original de Calidad.
 */
const APPS_DEFINITIONS = [
    { id: 'personas',          label: 'Personas',        icon: 'user-multiple-accounts-flat',         palette: 'Azul' },
    { id: 'turnos',            label: 'Turnos',          icon: 'calendar-mark-flat',                  palette: 'Morado' },
    { id: 'marcajes',          label: 'Marcajes',        icon: 'fingerprint-2-flat',                  palette: 'Rosa' },
    { id: 'organigrama',       label: 'Organigrama',     icon: 'hierarchy-1-flat',                    palette: 'Naranja' },
    { id: 'desempeno',         label: 'Desempeño',       icon: 'graph-bar-increase-flat',             palette: 'Verde' },
    { id: 'aprendizaje',       label: 'Aprendizaje',     icon: 'global-learning-flat',                palette: 'Rojo' },
    { id: 'people-experience', label: 'Experiencia',     icon: 'user-feedback-heart-flat',            palette: 'Celeste' },
    { id: 'reconocimientos',   label: 'Reconocimientos', icon: 'star-medal-flat',                     palette: 'Amarillo' },
    { id: 'tareas',            label: 'Tareas',          icon: 'task-list-edit-flat',                 palette: 'Turquesa' },
    { id: 'calendario',        label: 'Calendario',      icon: 'calendar-check-flat',                 palette: 'Morado' },
    { id: 'informes',          label: 'Informes',        icon: 'file-report-flat',                    palette: 'Amarillo' },
    { id: 'ajustes',           label: 'Ajustes',         icon: 'cog-flat',                            palette: 'Celeste' },
    { id: 'favoritos',         label: 'Favoritos',       icon: 'bookmark-flat',                       palette: 'Rojo' },
    { id: 'equipo',            label: 'Equipo',          icon: 'hierarchy-15-flat',                   palette: 'Verde' },
    { id: 'estadisticas',      label: 'Estadísticas',    icon: 'content-statistic-flat',              palette: 'Morado' },
    { id: 'mensajes',          label: 'Mensajes',        icon: 'mail-send-email-message-flat',        palette: 'Naranja' },
    { id: 'archivos',          label: 'Archivos',        icon: 'file-folder-flat',                    palette: 'Turquesa' },
    { id: 'nube',              label: 'Nube',            icon: 'cloud-data-transfer-flat',            palette: 'Celeste' },
    { id: 'seguridad',         label: 'Seguridad',       icon: 'shield-1-flat',                       palette: 'Rosa' },
    { id: 'guardados',         label: 'Guardados',       icon: 'archive-box-flat',                    palette: 'Celeste' },
    { id: 'reuniones',         label: 'Reuniones',       icon: 'presentation-flat',                   palette: 'Naranja' },
    { id: 'formularios',       label: 'Formularios',     icon: 'description-flat',                    palette: 'Verde' },
    { id: 'encuestas',         label: 'Encuestas',       icon: 'notepad-text-flat',                   palette: 'Rosa' },
    { id: 'feedback',          label: 'Feedback',        icon: 'help-chat-1-flat',                    palette: 'Verde' },
    { id: 'objetivos',         label: 'Objetivos',       icon: 'target-3-flat',                       palette: 'Turquesa' },
    { id: 'capacitacion',      label: 'Capacitación',    icon: 'graduation-cap-flat',                 palette: 'Azul' },
    { id: 'bienestar',         label: 'Bienestar',       icon: 'like-1-flat',                         palette: 'Morado' },
    { id: 'talento',           label: 'Talento',         icon: 'multiple-stars-flat',                 palette: 'Rosa' },
    { id: 'contactos',         label: 'Contactos',       icon: 'contact-phonebook-flat',              palette: 'Naranja' },
    { id: 'accesos',           label: 'Accesos',         icon: 'padlock-key-flat',                    palette: 'Morado' },
    { id: 'camara',            label: 'Cámara',          icon: 'camera-1-flat',                       palette: 'Turquesa' },
    { id: 'actividad',         label: 'Actividad',       icon: 'heart-rate-pulse-graph-flat',         palette: 'Verde' }
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

function loadStoredConfig() {
    try {
        return JSON.parse(localStorage.getItem('app_icon_config') || localStorage.getItem('calidad2_icon_config') || '{}');
    } catch (_) {
        return {};
    }
}

export class AppsModule {
    constructor({ router }) {
        this.router = router;
        this.container = null;
    }

    async mount(viewport) {
        this.container = document.createElement('div');
        this.container.id = 'module-apps-container';

        const cardsHtml = APPS_DEFINITIONS.map(app => `
            <div class="app-card" data-module="${app.id}" data-icon="${app.icon}" data-palette="${app.palette}">
                <div class="icon-card-box"></div>
                <span class="app-label">${app.label}</span>
            </div>
        `).join('');

        this.container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Apps</h1>
            </div>

            <div id="view-apps" class="view active">
                <div class="apps-grid">
                    ${cardsHtml}
                </div>
            </div>
        `;

        viewport.innerHTML = '';
        viewport.appendChild(this.container);

        // Renderizar y recolorizar todos los íconos
        this._renderAllIcons();

        // Registrar refresco global (llamado desde el módulo iconos)
        window.refreshAppGrid = () => this._renderAllIcons();

        // Enlazar eventos de clic
        this.container.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', () => {
                const modId = card.dataset.module;
                const label = card.querySelector('.app-label')?.textContent || modId;

                if (this.router && this.router.routes && this.router.routes.has(modId)) {
                    this.router.navigate(modId);
                } else {
                    Toast.info(`Módulo "${label}" en proceso de activación`);
                }
            });
        });
    }

    async _renderAllIcons() {
        if (!this.container) return;
        const storedConfig = loadStoredConfig();
        const cards = this.container.querySelectorAll('.app-card[data-module]');

        await Promise.all([...cards].map(card => this._renderCardIcon(card, storedConfig)));
    }

    async _renderCardIcon(card, storedConfig) {
        const appId = card.dataset.module;
        const box = card.querySelector('.icon-card-box');
        if (!box) return;

        const saved       = storedConfig[appId] || {};
        const iconName    = saved.icon    || card.dataset.icon;
        const paletteName = saved.palette || card.dataset.palette || 'Azul';
        const prefix      = saved.prefix  || 'streamline-plump-color';

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
                    <line x1="9" y1="9" x2="15" y2="15"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                </svg>
            `;
        }
    }

    unmount() {
        if (window.refreshAppGrid) {
            window.refreshAppGrid = null;
        }
    }
}
