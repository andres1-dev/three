/* ============================================================
   MÓDULO: Íconos de Apps
   Permite seleccionar ícono + paleta de color para cada app-card
   y guarda la configuración en localStorage para que el grid
   los cargue recolorizados al iniciar.
   ============================================================ */
(function () {
    'use strict';

    /* ── Constantes ────────────────────────────────────────── */
    const PREFIX_PLUMP = 'streamline-plump-color';
    const PREFIX_COLOR = 'streamline-color';
    const PREFIX_MONO  = 'streamline';
    const API          = 'https://api.iconify.design';
    const STORAGE_KEY  = 'app_icon_config'; /* mismo que usa el grid */

    const PALETTES = {
        'Morado':   { light: '#ddd8fe', dark: '#b8adfa' },
        'Azul':     { light: '#d0e4ff', dark: '#9dbff8' },
        'Celeste':  { light: '#d4f1ff', dark: '#96d6f5' },
        'Verde':    { light: '#c8f5e0', dark: '#8adab4' },
        'Turquesa': { light: '#c8f4f2', dark: '#88d8d4' },
        'Naranja':  { light: '#ffe8cc', dark: '#f5bf88' },
        'Rojo':     { light: '#ffd4dc', dark: '#f5a0b0' },
        'Rosa':     { light: '#fde0f2', dark: '#f5b4d8' },
        'Amarillo': { light: '#fff4cc', dark: '#f0d878' }
    };

    /* Lista completa de apps (debe coincidir con index.html) */
    const APPS = [
        { id: 'personas',          label: 'Personas' },
        { id: 'turnos',            label: 'Turnos' },
        { id: 'marcajes',          label: 'Marcajes' },
        { id: 'organigrama',       label: 'Organigrama' },
        { id: 'desempeno',         label: 'Desempeño' },
        { id: 'aprendizaje',       label: 'Aprendizaje' },
        { id: 'people-experience', label: 'Experiencia' },
        { id: 'inicio',            label: 'Inicio' },
        { id: 'chats',             label: 'Chats' },
        { id: 'reconocimientos',   label: 'Reconocimientos' },
        { id: 'perfil',            label: 'Perfil' },
        { id: 'notificaciones',    label: 'Notificaciones' },
        { id: 'tareas',            label: 'Tareas' },
        { id: 'calendario',        label: 'Calendario' },
        { id: 'informes',          label: 'Informes' },
        { id: 'ajustes',           label: 'Ajustes' },
        { id: 'favoritos',         label: 'Favoritos' },
        { id: 'equipo',            label: 'Equipo' },
        { id: 'estadisticas',      label: 'Estadísticas' },
        { id: 'mensajes',          label: 'Mensajes' },
        { id: 'archivos',          label: 'Archivos' },
        { id: 'nube',              label: 'Nube' },
        { id: 'seguridad',         label: 'Seguridad' },
        { id: 'guardados',         label: 'Guardados' },
        { id: 'reuniones',         label: 'Reuniones' },
        { id: 'formularios',       label: 'Formularios' },
        { id: 'encuestas',         label: 'Encuestas' },
        { id: 'feedback',          label: 'Feedback' },
        { id: 'objetivos',         label: 'Objetivos' },
        { id: 'capacitacion',      label: 'Capacitación' },
        { id: 'bienestar',         label: 'Bienestar' },
        { id: 'talento',           label: 'Talento' },
        { id: 'contactos',         label: 'Contactos' },
        { id: 'accesos',           label: 'Accesos' },
        { id: 'camara',            label: 'Cámara' },
        { id: 'actividad',         label: 'Actividad' },
        { id: 'iconos',            label: 'Íconos' }
    ];

    /* ── Estado ─────────────────────────────────────────────── */
    let config         = {};   /* { appId: { icon, prefix, palette } } */
    let selectedApp    = null; /* id de la app actualmente seleccionada */
    let currentPrefix  = PREFIX_PLUMP;
    let allIcons       = [];   /* íconos de la colección activa */
    let filteredIcons  = [];
    let svgCache       = new Map();
    let searchTimer    = null;

    /* ── Raíz del módulo ────────────────────────────────────── */
    const root = document.getElementById('view-module') || document;

    function q(sel)  { return root.querySelector(sel); }
    function qq(sel) { return root.querySelectorAll(sel); }

    /* ── Elementos del DOM ──────────────────────────────────── */
    const appList        = q('#ico-app-list');
    const placeholder    = q('#ico-placeholder');
    const editPanel      = q('#ico-edit-panel');
    const previewBox     = q('#ico-preview-box');
    const previewAppName = q('#ico-preview-app-name');
    const previewIconName= q('#ico-preview-icon-name');
    const previewPalette = q('#ico-preview-palette-label');
    const paletteGrid    = q('#ico-palette-grid');
    const searchInput    = q('#ico-search');
    const iconGrid       = q('#ico-icon-grid');
    const iconCount      = q('#ico-icon-count');
    const loadingEl      = q('#ico-loading');
    const btnSave        = q('#ico-btn-save');

    /* ── Cargar config desde localStorage ──────────────────── */
    function loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            config = raw ? JSON.parse(raw) : {};
        } catch (_) {
            config = {};
        }
    }

    /* ── Guardar config en localStorage ────────────────────── */
    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        /* Refrescar el grid de apps en vivo si está disponible */
        if (typeof window.refreshAppGrid === 'function') {
            window.refreshAppGrid();
        }
        showToast('✓ Cambios guardados');
    }

    /* ── Toast ──────────────────────────────────────────────── */
    function showToast(msg) {
        let toast = document.getElementById('ico-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ico-toast';
            toast.className = 'ico-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    /* ── Utilidades SVG (portadas de iconos2color.html) ─────── */
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
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        return parseInt(hex.slice(0,2),16)*0.299
             + parseInt(hex.slice(2,4),16)*0.587
             + parseInt(hex.slice(4,6),16)*0.114;
    }

    function recolorSVG(svg, palette) {
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

    /* Para colecciones mono: usa stroke del tono oscuro de la paleta */
    function monoSVG(svg, palette) {
        return svg
            .replace(/stroke="[^"]*"/g,  `stroke="${palette.dark}"`)
            .replace(/fill="(?!none)[^"]*"/g, `fill="${palette.light}"`);
    }

    function toSVGElement(svgText, size) {
        const parser = new DOMParser();
        const el = parser.parseFromString(svgText, 'image/svg+xml').documentElement;
        el.setAttribute('width',  size);
        el.setAttribute('height', size);
        el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        el.style.display = 'block';
        return el;
    }

    async function renderSVGInto(container, prefix, iconName, paletteName, size) {
        const palette = PALETTES[paletteName] || PALETTES['Azul'];
        try {
            const raw      = await fetchSVG(prefix, iconName);
            const colored  = prefix === PREFIX_MONO
                ? monoSVG(raw, palette)
                : recolorSVG(raw, palette);
            const el = toSVGElement(colored, size);
            container.innerHTML = '';
            container.appendChild(el);
        } catch (_) {
            container.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24"
                fill="none" stroke="#94a3b8" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
            </svg>`;
        }
    }

    /* ── Renderizar lista de apps ────────────────────────────── */
    function renderAppList() {
        appList.innerHTML = '';
        APPS.forEach(app => {
            const li   = document.createElement('li');
            li.className = 'ico-app-item';
            li.dataset.id = app.id;

            const thumb = document.createElement('div');
            thumb.className = 'ico-app-thumb';

            /* placeholder gris mientras carga */
            thumb.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24"
                fill="none" stroke="#cbd5e1" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
            </svg>`;

            const span = document.createElement('span');
            span.className = 'ico-app-name';
            span.textContent = app.label;

            li.appendChild(thumb);
            li.appendChild(span);

            li.addEventListener('click', () => selectApp(app.id));
            appList.appendChild(li);

            /* Cargar el ícono guardado en segundo plano */
            const cfg = config[app.id];
            if (cfg) {
                renderSVGInto(thumb, cfg.prefix || PREFIX_PLUMP, cfg.icon, cfg.palette, 36);
            }
        });
    }

    /* ── Seleccionar una app ────────────────────────────────── */
    function selectApp(appId) {
        selectedApp = appId;

        /* Resaltar en la lista */
        qq('.ico-app-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === appId);
        });

        /* Mostrar panel editor */
        placeholder.style.display  = 'none';
        editPanel.style.display    = 'block';

        const app = APPS.find(a => a.id === appId);
        previewAppName.textContent = app ? app.label : appId;

        /* Cargar valores actuales del config */
        const cfg = config[appId] || {};
        const paletteName = cfg.palette  || 'Azul';
        const iconName    = cfg.icon     || null;
        const prefix      = cfg.prefix   || PREFIX_PLUMP;

        /* Actualizar indicadores de la paleta activa */
        updatePaletteUI(paletteName);

        /* Actualizar colección activa */
        currentPrefix = prefix;
        qq('.ico-col-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.col === prefix);
        });

        /* Preview */
        if (iconName) {
            previewIconName.textContent = iconName;
            previewPalette.textContent  = paletteName;
            renderSVGInto(previewBox, prefix, iconName, paletteName, 44);
        } else {
            previewIconName.textContent = '— sin ícono guardado —';
            previewPalette.textContent  = paletteName;
            previewBox.innerHTML = `<svg width="44" height="44" viewBox="0 0 24 24"
                fill="none" stroke="#cbd5e1" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
            </svg>`;
        }

        /* Si el grid aún no tiene íconos, cargar */
        if (allIcons.length === 0) {
            loadCollection(currentPrefix);
        } else {
            /* Marcar el ícono activo en el grid */
            markActiveIcon(iconName);
        }
    }

    /* ── Actualizar UI de paleta ────────────────────────────── */
    function updatePaletteUI(paletteName) {
        qq('.ico-palette-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.palette === paletteName);
        });
    }

    /* ── Renderizar botones de paleta ───────────────────────── */
    function renderPaletteGrid() {
        paletteGrid.innerHTML = '';
        Object.entries(PALETTES).forEach(([name, colors]) => {
            const btn = document.createElement('button');
            btn.className = 'ico-palette-btn';
            btn.dataset.palette = name;
            btn.title = name;
            btn.innerHTML = `<span class="ico-duo">
                <span style="background:${colors.light}"></span>
                <span style="background:${colors.dark}"></span>
            </span>`;
            btn.addEventListener('click', () => pickPalette(name));
            paletteGrid.appendChild(btn);
        });
    }

    /* ── Cambiar paleta ─────────────────────────────────────── */
    async function pickPalette(paletteName) {
        if (!selectedApp) return;

        /* Actualizar config */
        if (!config[selectedApp]) config[selectedApp] = {};
        config[selectedApp].palette = paletteName;

        updatePaletteUI(paletteName);
        previewPalette.textContent = paletteName;

        /* Refrescar preview si hay ícono */
        const cfg = config[selectedApp];
        if (cfg.icon) {
            renderSVGInto(previewBox, cfg.prefix || PREFIX_PLUMP, cfg.icon, paletteName, 44);
        }

        /* Refrescar thumb en la lista de apps */
        refreshAppThumb(selectedApp);

        /* Refrescar grid de íconos para ver nueva paleta */
        renderIconGrid(filteredIcons);
    }

    /* ── Cargar colección desde API Iconify ─────────────────── */
    async function loadCollection(prefix) {
        loadingEl.classList.remove('hidden');
        iconGrid.innerHTML = '';
        allIcons  = [];
        filteredIcons = [];
        iconCount.textContent = '';

        try {
            const res  = await fetch(`${API}/collection?prefix=${prefix}`);
            const data = await res.json();
            let icons  = data.uncategorized || [];
            if (data.categories) {
                Object.values(data.categories).forEach(list => icons.push(...list));
            }
            allIcons      = [...new Set(icons)].sort();
            filteredIcons = [...allIcons];
        } catch (_) {
            allIcons      = [];
            filteredIcons = [];
        }

        loadingEl.classList.add('hidden');
        iconCount.textContent = `${allIcons.length} íconos`;
        renderIconGrid(filteredIcons);
    }

    /* ── Renderizar grid de íconos ──────────────────────────── */
    async function renderIconGrid(icons) {
        iconGrid.innerHTML = '';
        if (!icons.length) {
            iconGrid.innerHTML = '<div style="color:#94a3b8;font-size:.8rem;grid-column:1/-1;padding:20px 0;text-align:center">Sin resultados</div>';
            return;
        }

        const cfg         = config[selectedApp] || {};
        const paletteName = cfg.palette || 'Azul';
        const palette     = PALETTES[paletteName];
        const activeIcon  = cfg.icon || null;

        /* Renderizamos en lotes para no bloquear el hilo */
        const BATCH = 40;
        for (let i = 0; i < icons.length; i += BATCH) {
            const batch = icons.slice(i, i + BATCH);
            await Promise.all(batch.map(async iconName => {
                const cell = document.createElement('div');
                cell.className = 'ico-icon-cell' + (iconName === activeIcon ? ' active' : '');
                cell.dataset.icon = iconName;

                const iconBox = document.createElement('div');
                iconBox.className = 'ico-cell-icon';

                const label = document.createElement('div');
                label.className = 'ico-cell-name';
                /* Mostrar nombre sin sufijo -flat para ahorrar espacio */
                label.textContent = iconName.replace(/-flat$/, '');
                label.title = iconName;

                cell.appendChild(iconBox);
                cell.appendChild(label);
                iconGrid.appendChild(cell);

                cell.addEventListener('click', () => pickIcon(iconName, cell));

                /* Cargar SVG recolorizado */
                try {
                    const raw     = await fetchSVG(currentPrefix, iconName);
                    const colored = currentPrefix === PREFIX_MONO
                        ? monoSVG(raw, palette)
                        : recolorSVG(raw, palette);
                    const el = toSVGElement(colored, 36);
                    iconBox.innerHTML = '';
                    iconBox.appendChild(el);
                } catch (_) {
                    iconBox.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24"
                        fill="none" stroke="#e2e8f0" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="3"/>
                    </svg>`;
                }
            }));

            /* Pausa para que el navegador respire */
            await new Promise(r => setTimeout(r, 5));
        }
    }

    /* ── Marcar ícono activo en el grid ─────────────────────── */
    function markActiveIcon(iconName) {
        qq('.ico-icon-cell').forEach(el => {
            el.classList.toggle('active', el.dataset.icon === iconName);
        });
    }

    /* ── Seleccionar un ícono del grid ──────────────────────── */
    function pickIcon(iconName, cell) {
        if (!selectedApp) return;

        /* Actualizar config */
        if (!config[selectedApp]) config[selectedApp] = {};
        config[selectedApp].icon   = iconName;
        config[selectedApp].prefix = currentPrefix;

        /* Marcar activo */
        qq('.ico-icon-cell').forEach(el => el.classList.remove('active'));
        cell.classList.add('active');

        /* Actualizar preview */
        const cfg = config[selectedApp];
        previewIconName.textContent = iconName;
        renderSVGInto(previewBox, currentPrefix, iconName, cfg.palette || 'Azul', 44);

        /* Actualizar thumb en la lista de apps */
        refreshAppThumb(selectedApp);
    }

    /* ── Refrescar thumb de una app en la lista lateral ─────── */
    function refreshAppThumb(appId) {
        const li    = appList.querySelector(`.ico-app-item[data-id="${appId}"]`);
        const thumb = li?.querySelector('.ico-app-thumb');
        if (!thumb) return;
        const cfg = config[appId];
        if (cfg && cfg.icon) {
            renderSVGInto(thumb, cfg.prefix || PREFIX_PLUMP, cfg.icon, cfg.palette || 'Azul', 36);
        }
    }

    /* ── Cambiar colección ──────────────────────────────────── */
    qq('.ico-col-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.col === currentPrefix) return;
            currentPrefix = btn.dataset.col;
            qq('.ico-col-btn').forEach(b => b.classList.toggle('active', b === btn));
            searchInput.value = '';
            loadCollection(currentPrefix);
        });
    });

    /* ── Búsqueda con debounce ──────────────────────────────── */
    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const q = this.value.trim().toLowerCase();
            filteredIcons = q
                ? allIcons.filter(n => n.toLowerCase().includes(q))
                : [...allIcons];
            iconCount.textContent = `${filteredIcons.length} íconos`;
            renderIconGrid(filteredIcons);
        }, 280);
    });

    /* ── Botón guardar ──────────────────────────────────────── */
    btnSave.addEventListener('click', saveConfig);

    /* ── Inicialización ─────────────────────────────────────── */
    function init() {
        loadConfig();
        renderPaletteGrid();
        renderAppList();
    }

    /* Esperar un tick para que el router haya inyectado el HTML */
    setTimeout(init, 0);

})();
