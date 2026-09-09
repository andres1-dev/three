/**
 * Componente: LoteSelectorCard
 * Búsqueda ON-DEMAND de lotes con pestaña completa colapsable para filtro de Productora.
 */
export class LoteSelectorCard {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Array} options.productoras
     * @param {string} options.selectedProductora
     * @param {Function} options.onSearchLotes
     * @param {Function} options.onProductoraChange
     * @param {Function} options.onSelectLote
     */
    constructor({
        container,
        productoras = [],
        selectedProductora = '',
        onSearchLotes = null,
        onProductoraChange = null,
        onSelectLote = null,
        onAqlConfigChange = null,
        onFetchExtensiones = null,
        onExtensionesLoaded = null,
        onGpsTabOpened = null,
        searchConfig = null,
        aqlInfo = false
    }) {
        this.container = container;
        this.productoras = productoras;
        this.selectedProductora = selectedProductora;
        this.onSearchLotes = onSearchLotes;
        this.onProductoraChange = onProductoraChange;
        this.onSelectLote = onSelectLote;
        this.onAqlConfigChange = onAqlConfigChange;
        this.onFetchExtensiones = onFetchExtensiones;
        this.onExtensionesLoaded = onExtensionesLoaded;
        this.onGpsTabOpened = onGpsTabOpened;
        this.aqlInfo = aqlInfo;

        // Configuración dinámica (por defecto todo oculto hasta cargar desde Supabase)
        this.config = searchConfig || {
            searchFields: {
                productora: true,
                op: true,
                referencia: true,
                planta: true
            },
            filters: {
                productora: false
            },
            tabs: {
                aql: false,
                curva: false,
                gps: false
            }
        };
        this.searchFields = this.config.searchFields;

        this.activeLote = null;
        this.isAccordionOpen = false;
        this.isFilterTabOpen = false;
        this.isAqlTabOpen = false;
        this.searchTimeout = null;
        this.isLoading = false;
        this.currentResults = [];

        this._init();
    }

    setProductoras(productoras) {
        this.productoras = productoras || [];
        this._renderProductoraOptions();
    }

    setSelectedProductora(productoraId) {
        this.selectedProductora = productoraId || '';
        if (this.selectProductora) {
            this.selectProductora.value = this.selectedProductora;
        }
        this._syncFilterState();
    }

    setActiveLote(lote) {
        this.activeLote = lote;
        // AQL tiene datos cuando hay un lote seleccionado con cantidad válida
        this.aqlDataLoaded = lote && lote.cantidad > 0;
        // Resetear estado de curva (se marcará como cargado al obtener extensiones)
        this.curvaDataLoaded = false;
        this._renderActiveLote();
        // Al seleccionar la OP, consultar sus extensiones reales (talla · color)
        // usando la clave id_productora + op.
        this._loadExtensiones();
    }

    /**
     * Sincroniza los selects de configuración AQL con la configuración vigente
     * (Nivel de Inspección I/II/III y Nivel AQL 1.0–6.5, herencia del legado).
     */
    setAqlConfig({ nivel, aqlNivel } = {}) {
        if (this.aqlCfgNivel && nivel) this.aqlCfgNivel.value = nivel;
        if (this.aqlCfgAql && aqlNivel) this.aqlCfgAql.value = aqlNivel;
    }

    updateConfig(newConfig) {
        if (!newConfig) return;

        this.config = newConfig;
        this.searchFields = this.config.searchFields || this.config;

        // Actualizar visibilidad de filtros (ocultar solo el header del filtro)
        if (this.config.filters && this.filterTabHeader) {
            this.filterTabHeader.style.display = this.config.filters.productora ? '' : 'none';
        }

        // Actualizar visibilidad de pestañas (usando el método centralizado)
        this._updateTabVisibility();
    }

    _init() {
        this.container.innerHTML = `
            <div class="f-lote-card-wrapper">
                <!-- Solapa Filtro Productora -->
                <div class="f-filter-tab-container" id="productora-tab-container">
                    <div class="f-filter-tab-header" id="btn-toggle-productora-filter" role="button" tabindex="0" aria-expanded="false">
                        <div class="f-tab-title-box">
                            <!-- Icono embudo (funnel) real -->
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" style="flex-shrink:0;opacity:0.5">
                                <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6L14 13.333V20a1 1 0 0 1-1.447.894l-4-2A1 1 0 0 1 8 18v-4.667L3.2 5.6A1 1 0 0 1 3 4z"/>
                            </svg>
                            <span class="f-tab-main-text" id="label-productora-filter">Productora</span>
                        </div>
                        <!-- Controles derecha -->
                        <div class="f-tab-controls">
                            <button type="button" class="f-tab-clear-btn" id="btn-clear-productora" style="display:none;" title="Quitar filtro">
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                            <svg class="f-tab-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>

                    <!-- Cuerpo Desplegable -->
                    <div class="f-filter-tab-body" id="productora-drawer" style="display:none;">
                        <div class="f-filter-tab-body-inner">
                            <div class="f-tab-select-wrap">
                                <select id="select-productora" class="f-productora-select" aria-label="Seleccione Productora">
                                    <option value="">Todas las Productoras</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                ${this.aqlInfo ? `
                <!-- Solapa Informativa: Muestreo AQL (ISO 2859-1) — mismo patrón que Filtro Productora -->
                <!-- Oculta hasta seleccionar una OP (ver _renderActiveLote) -->
                <div class="f-filter-tab-container f-aql-tab" id="aql-tab-container" style="display:none;">
                    <div class="f-filter-tab-header" id="btn-toggle-aql-tab" role="button" tabindex="0" aria-expanded="false">
                        <div class="f-tab-title-box">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <span class="f-tab-main-text">Muestreo AQL</span>
                        </div>
                        <div class="f-tab-controls">
                            <span class="f-aql-tab-value" id="aql-tab-value">—</span>
                            <svg class="f-tab-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>

                    <!-- Cuerpo Desplegable -->
                    <div class="f-filter-tab-body" id="aql-tab-drawer" style="display:none;">
                        <div class="f-filter-tab-body-inner">
                            <!-- Configuración del Muestreo (legado: aqlNivelInspeccion / aqlNivel) -->
                            <div class="f-aql-config-grid">
                                <div class="f-aql-config-item">
                                    <label class="f-aql-config-lbl">Nivel de Inspección</label>
                                    <select id="aql-cfg-nivel" class="f-aql-config-select" aria-label="Nivel de Inspección">
                                        <option value="I">I — Reducido</option>
                                        <option value="II" selected>II — Estándar</option>
                                        <option value="III">III — Severo</option>
                                    </select>
                                </div>
                                <div class="f-aql-config-item">
                                    <label class="f-aql-config-lbl">Nivel AQL</label>
                                    <select id="aql-cfg-aql" class="f-aql-config-select" aria-label="Nivel AQL">
                                        <option value="1.0">1.0 — Crítico</option>
                                        <option value="1.5">1.5 — Estricto</option>
                                        <option value="2.5">2.5 — Normal</option>
                                        <option value="4.0" selected>4.0 — Flexible</option>
                                        <option value="6.5">6.5 — Permisivo</option>
                                    </select>
                                </div>
                            </div>
                            <div class="f-aql-stats-row">
                                <div class="f-aql-stat-box">
                                    <span class="lbl">Revisar</span>
                                    <span class="num" id="aql-display-muestra">—</span>
                                    <span class="sub">unidades</span>
                                </div>
                                <div class="f-aql-stat-box accept">
                                    <span class="lbl">Aprobar si</span>
                                    <span class="num" id="aql-display-ac">—</span>
                                    <span class="sub">≤ defectos</span>
                                </div>
                                <div class="f-aql-stat-box reject">
                                    <span class="lbl">Rechazar si</span>
                                    <span class="num" id="aql-display-re">—</span>
                                    <span class="sub">≥ defectos</span>
                                </div>
                            </div>
                            <button type="button" class="f-aql-detail-link" id="btn-trigger-aql-modal">Ver detalle ISO 2859-1 →</button>
                        </div>
                    </div>
                </div>` : ''}

                <!-- Solapa Curva: colapsada debajo de AQL — visible SOLO cuando
                     las extensiones de la OP ya están cargadas -->
                <div class="f-filter-tab-container f-curva-tab" id="curva-tab-container" style="display:none;">
                    <div class="f-filter-tab-header" id="btn-toggle-curva-tab" role="button" tabindex="0" aria-expanded="false">
                        <div class="f-tab-title-box">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="flex-shrink:0;opacity:0.5">
                                <rect x="3" y="14" width="4" height="8" rx="1"/>
                                <rect x="10" y="9" width="4" height="13" rx="1"/>
                                <rect x="17" y="4" width="4" height="18" rx="1"/>
                            </svg>
                            <span class="f-tab-main-text">Curva</span>
                        </div>
                        <div class="f-tab-controls">
                            <svg class="f-tab-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>

                    <!-- Cuerpo Desplegable (matriz Color x Talla con totales) -->
                    <div class="f-filter-tab-body" id="curva-tab-drawer" style="display:none;">
                        <div class="f-filter-tab-body-inner" id="curva-tab-body-inner"></div>
                    </div>
                </div>

                <!-- Solapa GPS: colapsada debajo de Curva -->
                <div class="f-filter-tab-container f-gps-tab" id="gps-tab-container" style="display:none;">
                    <div class="f-filter-tab-header" id="btn-toggle-gps-tab" role="button" tabindex="0" aria-expanded="false">
                        <div class="f-tab-title-box">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="flex-shrink:0;opacity:0.5">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            <span class="f-tab-main-text">Ubicación</span>
                        </div>
                        <div class="f-tab-controls">
                            <button type="button" class="f-btn-refresh-gps" id="btn-refresh-gps-header" title="Actualizar ubicación" style="display:none;">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                                </svg>
                            </button>
                            <svg class="f-tab-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>

                    <!-- Cuerpo Desplegable (información GPS del lote) -->
                    <div class="f-filter-tab-body" id="gps-tab-drawer" style="display:none;">
                        <div class="f-filter-tab-body-inner" id="gps-tab-body-inner">
                            <div class="f-gps-loading">Cargando ubicación...</div>
                        </div>
                    </div>
                </div>

                <!-- Buscador Principal On-Demand -->
                <div class="f-search-row" id="search-row-container">
                    <div class="f-search-input-wrap">
                        <!-- Ícono lupa permanente -->
                        <svg class="f-search-icon" id="icon-search-static" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <div class="f-search-spinner" id="icon-search-spinner" style="display:none;"></div>
                        <input type="text" id="input-search-lote" class="f-search-input" placeholder="Buscar Lote, OP, Referencia..." autocomplete="off" />
                        <button type="button" id="btn-clear-lote-search" class="f-clear-search-btn" style="display:none;" aria-label="Limpiar búsqueda">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>

                    <!-- Lista de Sugerencias On-Demand (debajo del input) -->
                    <div id="lote-suggestions-box" class="f-suggestions-box" style="display:none;"></div>
                </div>

                <!-- Tarjeta de Lote Activo Completa con Datos de Master -->
                <div id="active-lote-container" class="f-active-lote-container"></div>
            </div>
        `;

        this.tabContainer = this.container.querySelector('#productora-tab-container');
        this.btnToggleFilter = this.container.querySelector('#btn-toggle-productora-filter');
        this.filterDrawer = this.container.querySelector('#productora-drawer');
        this.labelFilter = this.container.querySelector('#label-productora-filter');
        this.btnClearProd = this.container.querySelector('#btn-clear-productora');
        this.selectProductora = this.container.querySelector('#select-productora');
        this.searchRowContainer = this.container.querySelector('#search-row-container');
        this.inputSearch = this.container.querySelector('#input-search-lote');
        this.suggestionsBox = this.container.querySelector('#lote-suggestions-box');
        this.activeContainer = this.container.querySelector('#active-lote-container');
        this.clearBtn = this.container.querySelector('#btn-clear-lote-search');
        this.searchIcon = this.container.querySelector('#icon-search-static');
        this.spinner = this.container.querySelector('#icon-search-spinner');

        // Referencia específica al header del filtro (lo que el usuario quiere ocultar)
        this.filterTabHeader = this.container.querySelector('#btn-toggle-productora-filter');

        // Referencias de la Solapa Informativa AQL (solo cuando aqlInfo = true)
        this.aqlTabContainer = this.container.querySelector('#aql-tab-container');
        this.btnAqlToggle = this.container.querySelector('#btn-toggle-aql-tab');
        this.aqlDrawer = this.container.querySelector('#aql-tab-drawer');
        this.aqlCfgNivel = this.container.querySelector('#aql-cfg-nivel');
        this.aqlCfgAql = this.container.querySelector('#aql-cfg-aql');

        // Referencias de la Solapa Curva (colapsada bajo AQL, solo con datos)
        this.curvaTabContainer = this.container.querySelector('#curva-tab-container');
        this.btnCurvaToggle = this.container.querySelector('#btn-toggle-curva-tab');
        this.curvaDrawer = this.container.querySelector('#curva-tab-drawer');
        this.curvaBody = this.container.querySelector('#curva-tab-body-inner');
        this.isCurvaTabOpen = false;

        // Referencias de la Solapa GPS (colapsada bajo Curva)
        this.gpsTabContainer = this.container.querySelector('#gps-tab-container');
        this.btnGpsToggle = this.container.querySelector('#btn-toggle-gps-tab');
        this.gpsDrawer = this.container.querySelector('#gps-tab-drawer');
        this.gpsBody = this.container.querySelector('#gps-tab-body-inner');
        this.isGpsTabOpen = false;

        // Estado de datos cargados
        this.aqlDataLoaded = false;
        this.curvaDataLoaded = false;

        // Aplicar configuración inicial de visibilidad de filtros y pestañas
        if (this.config) {
            // Aplicar visibilidad de filtros (ocultar el header del filtro, no el contenedor completo)
            if (this.config.filters && this.filterTabHeader) {
                this.filterTabHeader.style.display = this.config.filters.productora ? '' : 'none';
            }

            // Aplicar visibilidad de pestañas (usando método centralizado que respeta datos)
            this._updateTabVisibility();
        }

        this._renderProductoraOptions();
        this._bindEvents();
    }

    /**
     * Resuelve el nombre corto de una productora a partir de su ID o nombre,
     * usando el catálogo cargado vía Edge Function (tabla `productoras`).
     * Prioriza `nombre_corto`; cae al nombre legal si la tabla no lo tiene.
     * Busca por ID (id_productora) o por nombre completo (productora).
     */
    _getProductoraName(val) {
        if (val === null || val === undefined || val === '') return 'N/A';
        const raw = String(val).trim();
        const rawUpper = raw.toUpperCase();

        // 1. Buscar por ID numérico
        let p = this.productoras.find(pr => {
            const id = pr.id_productora ?? pr.id ?? pr.nit;
            return id !== undefined && id !== null && String(id) === raw;
        });

        // 2. Si no coincide por ID, buscar por nombre completo (productora)
        if (!p) {
            p = this.productoras.find(pr => {
                const nombre = String(pr.productora || '').toUpperCase().trim();
                return nombre === rawUpper;
            });
        }

        // 3. Si no encuentra nada, buscar por nombre corto
        if (!p) {
            p = this.productoras.find(pr => {
                const corto = String(pr.nombre_corto || '').toUpperCase().trim();
                return corto === rawUpper;
            });
        }

        if (!p) return raw.toUpperCase();
        return String(p.nombre_corto || p.productora || p.nombre || raw).toUpperCase();
    }

    _renderProductoraOptions() {
        if (!this.selectProductora) return;
        const currentVal = this.selectedProductora;

        const optionsHtml = [
            '<option value="">Todas las Productoras</option>',
            ...this.productoras.map(p => {
                const id = p.id_productora ?? p.id ?? p.nit ?? p.productora;
                const name = String(p.nombre_corto || p.productora || p.nombre || String(id)).toUpperCase();
                const isSelected = String(id) === String(currentVal) ? 'selected' : '';
                return `<option value="${id}" ${isSelected}>${name}</option>`;
            })
        ].join('');

        this.selectProductora.innerHTML = optionsHtml;
        this._syncFilterState();
    }

    _syncFilterState() {
        if (!this.labelFilter) return;

        if (this.selectedProductora) {
            const found = this.productoras.find(p => {
                const id = p.id_productora ?? p.id ?? p.nit ?? p.productora;
                return String(id) === String(this.selectedProductora);
            });
            const name = found ? String(found.nombre_corto || found.productora || found.nombre).toUpperCase() : String(this.selectedProductora).toUpperCase();
            this.labelFilter.textContent = name;
            this.tabContainer?.classList.add('has-active-filter');
            if (this.btnClearProd) this.btnClearProd.style.display = 'inline-flex';
        } else {
            this.labelFilter.textContent = 'Productora';
            this.tabContainer?.classList.remove('has-active-filter');
            if (this.btnClearProd) this.btnClearProd.style.display = 'none';
        }
    }

    _bindEvents() {
        // Toggle de Pestaña Completa
        const toggleHandler = () => {
            this.isFilterTabOpen = !this.isFilterTabOpen;
            this.filterDrawer.style.display = this.isFilterTabOpen ? 'block' : 'none';
            this.tabContainer.classList.toggle('is-open', this.isFilterTabOpen);
            this.btnToggleFilter.setAttribute('aria-expanded', String(this.isFilterTabOpen));
        };

        this.btnToggleFilter?.addEventListener('click', toggleHandler);
        this.btnToggleFilter?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleHandler();
            }
        });

        // Toggle Solapa Informativa AQL (mismo comportamiento que el filtro)
        if (this.btnAqlToggle && this.aqlDrawer) {
            const aqlToggleHandler = () => {
                this.isAqlTabOpen = !this.isAqlTabOpen;
                this.aqlDrawer.style.display = this.isAqlTabOpen ? 'block' : 'none';
                this.aqlTabContainer.classList.toggle('is-open', this.isAqlTabOpen);
                this.btnAqlToggle.setAttribute('aria-expanded', String(this.isAqlTabOpen));
            };

            this.btnAqlToggle.addEventListener('click', aqlToggleHandler);
            this.btnAqlToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    aqlToggleHandler();
                }
            });
        }

        // Toggle Solapa Curva (colapsada bajo AQL): solo alcanzable con datos cargados
        if (this.btnCurvaToggle && this.curvaDrawer) {
            const curvaToggleHandler = () => {
                this.isCurvaTabOpen = !this.isCurvaTabOpen;
                this.curvaDrawer.style.display = this.isCurvaTabOpen ? 'block' : 'none';
                this.curvaTabContainer.classList.toggle('is-open', this.isCurvaTabOpen);
                this.btnCurvaToggle.setAttribute('aria-expanded', String(this.isCurvaTabOpen));
                if (this.isCurvaTabOpen) this._renderCurvaBody();
            };

            this.btnCurvaToggle.addEventListener('click', curvaToggleHandler);
            this.btnCurvaToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    curvaToggleHandler();
                }
            });
        }

        // Toggle Solapa GPS (colapsada bajo Curva)
        if (this.btnGpsToggle && this.gpsDrawer) {
            const gpsToggleHandler = () => {
                this.isGpsTabOpen = !this.isGpsTabOpen;
                this.gpsDrawer.style.display = this.isGpsTabOpen ? 'block' : 'none';
                this.gpsTabContainer.classList.toggle('is-open', this.isGpsTabOpen);
                this.btnGpsToggle.setAttribute('aria-expanded', String(this.isGpsTabOpen));
                
                if (this.isGpsTabOpen) {
                    // Al abrir, limpiar contenido y renderizar nuevamente para disparar GPS
                    this.gpsBody.innerHTML = '';
                    this._renderGpsBody();
                } else {
                    // Al cerrar, ocultar botón de refresh en el header
                    const refreshBtn = this.container.querySelector('#btn-refresh-gps-header');
                    if (refreshBtn) {
                        refreshBtn.style.display = 'none';
                    }
                }
            };

            this.btnGpsToggle.addEventListener('click', gpsToggleHandler);
            this.btnGpsToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    gpsToggleHandler();
                }
            });
        }

        // Configuración del Muestreo AQL: notificar al propietario para recalcular
        if (this.aqlCfgNivel && this.aqlCfgAql) {
            const notifyAqlCfg = () => {
                if (typeof this.onAqlConfigChange === 'function') {
                    this.onAqlConfigChange({
                        nivel: this.aqlCfgNivel.value,
                        aqlNivel: this.aqlCfgAql.value
                    });
                }
            };
            this.aqlCfgNivel.addEventListener('change', notifyAqlCfg);
            this.aqlCfgAql.addEventListener('change', notifyAqlCfg);
        }

        // Limpiar Filtro de Productora
        this.btnClearProd?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectedProductora = '';
            if (this.selectProductora) this.selectProductora.value = '';
            this._syncFilterState();

            if (typeof this.onProductoraChange === 'function') {
                this.onProductoraChange('');
            }
            if (this.inputSearch.value.trim()) {
                this._ejecutarBusquedaOnDemand();
            }
        });

        // Cambio de Productora en el Selector
        this.selectProductora?.addEventListener('change', (e) => {
            this.selectedProductora = e.target.value;
            this._syncFilterState();

            if (typeof this.onProductoraChange === 'function') {
                this.onProductoraChange(this.selectedProductora);
            }
            // Si ya hay texto, re-ejecutar búsqueda on-demand
            if (this.inputSearch.value.trim()) {
                this._ejecutarBusquedaOnDemand();
            }
        });

        // Entrada en el campo de búsqueda con debounce on-demand
        this.inputSearch?.addEventListener('input', () => {
            const query = this.inputSearch.value.trim();
            this.clearBtn.style.display = query ? 'flex' : 'none';

            if (!query) {
                this.suggestionsBox.style.display = 'none';
                return;
            }

            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this._ejecutarBusquedaOnDemand();
            }, 500);
        });

        this.clearBtn?.addEventListener('click', () => {
            this.inputSearch.value = '';
            this.clearBtn.style.display = 'none';
            this.suggestionsBox.style.display = 'none';
        });

        // Ocultar sugerencias si se hace click afuera
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                if (this.suggestionsBox) this.suggestionsBox.style.display = 'none';
            }
        });
    }

    async _ejecutarBusquedaOnDemand() {
        const query = this.inputSearch.value.trim();
        if (!query) {
            this.suggestionsBox.style.display = 'none';
            return;
        }

        this._setLoading(true);

        try {
            if (typeof this.onSearchLotes === 'function') {
                const results = await this.onSearchLotes({
                    query,
                    productora: this.selectedProductora,
                    searchConfig: this.config
                });
                this.currentResults = results || [];
                this._renderSuggestions(this.currentResults);
            }
        } catch (err) {
            console.error('[LoteSelectorCard] Error en búsqueda on-demand:', err);
            this.suggestionsBox.innerHTML = `
                <div class="f-suggestion-empty" style="color:#ef4444;">Error consultando Master: ${err.message || 'Error de red'}</div>
            `;
            this.suggestionsBox.style.display = 'block';
        } finally {
            this._setLoading(false);
        }
    }

    _setLoading(loading) {
        this.isLoading = loading;
        if (this.spinner) this.spinner.style.display = loading ? 'block' : 'none';
        if (this.searchIcon) this.searchIcon.style.display = loading ? 'none' : 'block';
    }


    _renderSuggestions(matches) {
        if (!matches.length) {
            this.suggestionsBox.innerHTML = `
                <div class="f-suggestion-empty">No se encontraron lotes coincidentes en Master</div>
            `;
            this.suggestionsBox.style.display = 'block';
            return;
        }

        const productoraName = l => this._getProductoraName(l.id_productora || l.productora);

        this.suggestionsBox.innerHTML = matches.map((l, index) => `
            <div class="f-suggestion-item" data-index="${index}">
                <div class="f-sug-title-row">
                    <span class="f-sug-title-item">
                        <span class="f-sug-title-lbl">OP</span>
                        <span class="f-sug-tag">${l.lote || l.op}</span>
                    </span>
                    ${l.referencia ? `
                    <span class="f-sug-title-item">
                        <span class="f-sug-title-lbl">Referencia</span>
                        <span class="f-sug-ref-inline">${l.referencia}</span>
                    </span>` : ''}
                    <span class="f-sug-title-item">
                        <span class="f-sug-title-lbl">Cant</span>
                        <span class="f-sug-cant-inline">${(l.cantidad || 0).toLocaleString()}</span>
                    </span>
                </div>
                <div class="f-sug-ref-text">
                    <span class="f-sug-planta">${l.planta || 'Sin Planta'}</span>
                    <span class="f-sug-productora">${productoraName(l)}</span>
                </div>
            </div>
        `).join('');

        this.suggestionsBox.style.display = 'block';

        this.suggestionsBox.querySelectorAll('.f-suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.index, 10);
                const selected = matches[idx];
                this.setActiveLote(selected);
                this.suggestionsBox.style.display = 'none';
                this.inputSearch.value = selected.lote || selected.op;
                this.clearBtn.style.display = 'flex';

                if (typeof this.onSelectLote === 'function') {
                    this.onSelectLote(selected);
                }
            });
        });
    }

    _renderActiveLote() {
        if (!this.activeLote) {
            this.activeContainer.innerHTML = '';
            // Mostrar buscador cuando no hay OP seleccionada
            if (this.searchRowContainer) this.searchRowContainer.style.display = '';
            // Resetear estado de datos
            this.aqlDataLoaded = false;
            this.curvaDataLoaded = false;
            // Ocultar todas las pestañas colapsadas
            if (this.aqlTabContainer) this.aqlTabContainer.style.display = 'none';
            if (this.curvaTabContainer) this.curvaTabContainer.style.display = 'none';
            if (this.gpsTabContainer) this.gpsTabContainer.style.display = 'none';
            return;
        }

        // OP seleccionada: ocultar buscador y mostrar tarjeta de lote
        if (this.searchRowContainer) this.searchRowContainer.style.display = 'none';

        // Actualizar visibilidad de pestañas basado en config y datos
        this._updateTabVisibility();

        const l = this.activeLote;
        this.activeContainer.innerHTML = `
            <div class="f-active-lote-card">
                <div class="f-lote-main-info" id="btn-toggle-lote-details">
                    <div class="f-lote-badge-icon">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                    </div>
                    <div class="f-lote-text">
                        <div class="f-lote-title-row">
                            <span class="f-lote-title-item">
                                <span class="f-lote-title-lbl">OP</span>
                                <span class="f-lote-tag">${l.lote || l.op}</span>
                            </span>
                            ${l.referencia ? `
                            <span class="f-lote-title-item">
                                <span class="f-lote-title-lbl">Referencia</span>
                                <span class="f-lote-ref-inline">${l.referencia}</span>
                            </span>` : ''}
                            <span class="f-lote-title-item">
                                <span class="f-lote-title-lbl">Cant</span>
                                <span class="f-lote-cant-inline">${(l.cantidad || 0).toLocaleString()}</span>
                            </span>
                        </div>
                        <span class="f-lote-ref-text">${l.planta || ''}</span>
                    </div>
                    <button type="button" class="f-accordion-chevron ${this.isAccordionOpen ? 'open' : ''}" aria-label="Ver detalles">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <button type="button" id="btn-clear-lote" class="f-clear-lote-btn" aria-label="Limpiar selección">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div class="f-lote-details-body ${this.isAccordionOpen ? 'open' : ''}" id="lote-details-body">
                    <div class="f-details-grid">
                        <div class="f-detail-item">
                            <span class="lbl">Línea</span>
                            <span class="val">${l.linea || l.modulo || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Proceso</span>
                            <span class="val">${l.proceso || 'Confección'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Prenda</span>
                            <span class="val">${l.tipoPrenda || l.prenda || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Género</span>
                            <span class="val">${l.genero || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Entrada</span>
                            <span class="val">${l.entrada || l.fechaEntrega || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Salida</span>
                            <span class="val">${l.salida || l.fechaSalida || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item full">
                            <span class="lbl">Productora</span>
                            <span class="val">${this._getProductoraName(l.productora)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const toggleBtn = this.activeContainer.querySelector('#btn-toggle-lote-details');
        const chevron = this.activeContainer.querySelector('.f-accordion-chevron');
        const body = this.activeContainer.querySelector('#lote-details-body');
        const clearLoteBtn = this.activeContainer.querySelector('#btn-clear-lote');

        toggleBtn?.addEventListener('click', () => {
            this.isAccordionOpen = !this.isAccordionOpen;
            chevron?.classList.toggle('open', this.isAccordionOpen);
            body?.classList.toggle('open', this.isAccordionOpen);
        });

        clearLoteBtn?.addEventListener('click', () => {
            this.activeLote = null;
            this.inputSearch.value = '';
            this.clearBtn.style.display = 'none';
            this.suggestionsBox.style.display = 'none';
            this._renderActiveLote();
            
            if (typeof this.onSelectLote === 'function') {
                this.onSelectLote(null);
            }
        });
    }

    /**
     * Extensiones REALES de la OP activa (curva: talla · color · cantidad).
     * Consulta la tabla `extensiones` con la clave id_productora + op vía la
     * callback inyectada (onFetchExtensiones, Edge Function /nube).
     */
    async _loadExtensiones() {
        const lote = this.activeLote;
        if (!lote || typeof this.onFetchExtensiones !== 'function') return;
        if (Array.isArray(lote.extensiones)) {
            // Ya cargadas: marcar como disponibles y actualizar visibilidad
            this.curvaDataLoaded = true;
            this._updateTabVisibility();
            return;
        }

        const op = Number(lote.op ?? lote.lote ?? lote.id_master) || 0;
        let idProductora = String(lote.productora ?? this.selectedProductora ?? '').trim();
        // Si el lote trae el NOMBRE de la productora, resolverlo al ID real
        const byName = this.productoras.find(p =>
            String(p.productora || '').toUpperCase() === idProductora.toUpperCase());
        if (byName) {
            idProductora = String(byName.id_productora ?? byName.id ?? byName.nit ?? byName.productora);
        }
        if (!op || !idProductora) return;

        try {
            const exts = await this.onFetchExtensiones({ op, idProductora });
            if (this.activeLote !== lote) return; // el usuario cambió de OP mientras cargaba
            lote.extensiones = Array.isArray(exts) ? exts : [];
            this.curvaDataLoaded = true; // Marcar datos de curva como cargados
            this._updateTabVisibility(); // Actualizar visibilidad basado en config y datos
            this._renderCurvaBody();  // puebla el drawer con la tabla
            if (typeof this.onExtensionesLoaded === 'function') this.onExtensionesLoaded(lote);
        } catch (err) {
            console.warn('[LoteSelectorCard] Error consultando curva de la OP:', err);
        }
    }

    /**
     * Renderiza el cuerpo del drawer de la solapa "Curva" (solo se invoca con
     * las extensiones ya cargadas). La tabla EXPANDE TODO el ancho del
     * contenido del drawer (igual que Muestreo). Formato TABLA: columnas =
     * tallas, filas = colores, celdas = cantidad, con totales por talla, por
     * color y total general.
     */
    _renderCurvaBody() {
        const body = this.curvaBody;
        if (!body || !this.activeLote) return;
        const exts = Array.isArray(this.activeLote.extensiones) ? this.activeLote.extensiones : [];
        if (!exts.length) {
            body.innerHTML = '<span class="f-ext-empty">Sin extensiones registradas para esta OP.</span>';
            return;
        }
        body.innerHTML = this._buildExtensionesTable(exts);
    }

    /**
     * Actualiza la visibilidad de las pestañas basándose en:
     * 1. Configuración del usuario (this.config)
     * 2. Disponibilidad de datos (this.aqlDataLoaded, this.curvaDataLoaded)
     * 3. Estado del lote activo
     */
    _updateTabVisibility() {
        if (!this.config || !this.config.tabs) {
            // Sin configuración: ocultar todo
            if (this.aqlTabContainer) this.aqlTabContainer.style.display = 'none';
            if (this.curvaTabContainer) this.curvaTabContainer.style.display = 'none';
            if (this.gpsTabContainer) this.gpsTabContainer.style.display = 'none';
            return;
        }

        // AQL: visible solo si está activo en config Y hay lote con cantidad válida
        if (this.aqlTabContainer) {
            const shouldShow = this.config.tabs.aql && this.aqlDataLoaded;
            this.aqlTabContainer.style.display = shouldShow ? '' : 'none';
        }

        // Curva: visible solo si está activo en config Y hay datos cargados
        if (this.curvaTabContainer) {
            const shouldShow = this.config.tabs.curva && this.curvaDataLoaded;
            this.curvaTabContainer.style.display = shouldShow ? '' : 'none';
        }

        // GPS: visible solo si está activo en config
        if (this.gpsTabContainer) {
            this.gpsTabContainer.style.display = this.config.tabs.gps ? '' : 'none';
        }
    }

    /**
     * Construye la matriz Color × Talla con cantidades y totales:
     *  - Columnas: tallas únicas de la OP (en orden de llegada).
     *  - Filas: colores únicos de la OP.
     *  - Última fila: TOTAL por talla; última columna: TOTAL por color;
     *    celda final: total general de la OP.
     */
    _buildExtensionesTable(exts) {
        const tallas = [];
        const colores = [];
        const mapa = new Map(); // color -> Map(talla -> cantidad)

        for (const e of exts) {
            const t = String(e.talla || '').toUpperCase().trim() || '—';
            const c = String(e.color || '').toUpperCase().trim() || '—';
            if (!mapa.has(c)) { mapa.set(c, new Map()); colores.push(c); }
            const fila = mapa.get(c);
            fila.set(t, (fila.get(t) || 0) + (Number(e.cantidad) || 0));
            if (!tallas.includes(t)) tallas.push(t);
        }

        const esc = (v) => this._escapeExt(v);
        const totalPorTalla = new Map();
        tallas.forEach(t => totalPorTalla.set(t, 0));
        let totalGeneral = 0;

        let filasHtml = '';
        for (const c of colores) {
            let totalColor = 0;
            let celdas = '';
            for (const t of tallas) {
                const cant = mapa.get(c).get(t) || 0;
                totalColor += cant;
                totalPorTalla.set(t, (totalPorTalla.get(t) || 0) + cant);
                celdas += `<td class="${cant > 0 ? 'has-val' : 'zero'}">${cant > 0 ? cant : '·'}</td>`;
            }
            totalGeneral += totalColor;
            filasHtml += `<tr><th class="row-h">${esc(c)}</th>${celdas}<td class="total-cell">${totalColor}</td></tr>`;
        }

        const totalesRow = `<tr class="totals-row">
            <th class="row-h">TOTAL</th>
            ${tallas.map(t => `<td class="total-cell">${totalPorTalla.get(t) || 0}</td>`).join('')}
            <td class="grand-total">${totalGeneral}</td>
        </tr>`;

        return `
            <div class="f-ext-table-wrap">
                <table class="f-ext-table">
                    <thead>
                        <tr>
                            <th class="row-h">Color</th>
                            ${tallas.map(t => `<th>${esc(t)}</th>`).join('')}
                            <th class="col-total-h">Total</th>
                        </tr>
                    </thead>
                    <tbody>${filasHtml}${totalesRow}</tbody>
                </table>
            </div>
        `;
    }

    _escapeExt(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    /**
     * Renderiza el cuerpo del drawer de la solapa "Ubicación" (GPS).
     * Muestra solo el mapa de Google Maps sin contenedor interno.
     */
    _renderGpsBody() {
        const body = this.gpsBody;
        if (!body || !this.activeLote) return;
        const l = this.activeLote;

        body.innerHTML = `
            <div id="mapa-calidad-frame-wrap" class="f-map-wrap">
                <div id="map-placeholder" class="f-map-loading">
                    <span class="f-spinner"></span>
                    <span>Cargando mapa de ubicación...</span>
                </div>
            </div>
        `;

        // Mostrar botón de refresh en el header
        const refreshBtn = this.container.querySelector('#btn-refresh-gps-header');
        if (refreshBtn) {
            refreshBtn.style.display = 'inline-flex';
            refreshBtn.onclick = () => {
                // Notificar al formulario para recapturar GPS
                if (typeof this.onGpsTabOpened === 'function') {
                    this.onGpsTabOpened();
                }
            };
        }

        // Notificar al formulario que el mapa GPS está listo para inicializar
        if (typeof this.onGpsTabOpened === 'function') {
            this.onGpsTabOpened();
        }
    }

    /**
     * Actualiza la configuración dinámica del componente
     * @param {Object} config - Configuración con searchFields y tabs
     */
    updateConfig(config) {
        if (!config) return;

        this.config = config;

        // Actualizar visibilidad de pestañas usando método centralizado que respeta datos
        this._updateTabVisibility();

        // Actualizar campos de búsqueda (requiere recargar el HTML de búsqueda)
        if (config.searchFields) {
            this.searchFields = config.searchFields;
            // Recargar el input de búsqueda con los campos configurados
            this._renderSearchInput();
        }
    }

    _renderSearchInput() {
        if (!this.searchInputContainer) return;

        const fields = this.searchFields || {
            productora: true,
            op: true,
            referencia: true,
            planta: true
        };

        let placeholder = 'Buscar por ';
        const activeFields = [];
        
        if (fields.productora) activeFields.push('productora');
        if (fields.op) activeFields.push('OP');
        if (fields.referencia) activeFields.push('referencia');
        if (fields.planta) activeFields.push('planta');

        if (activeFields.length === 0) {
            placeholder = 'Buscar...';
        } else if (activeFields.length === 1) {
            placeholder = `Buscar por ${activeFields[0]}...`;
        } else if (activeFields.length === 2) {
            placeholder = `Buscar por ${activeFields.join(' o ')}...`;
        } else {
            const last = activeFields.pop();
            placeholder = `Buscar por ${activeFields.join(', ')} o ${last}...`;
        }

        const input = this.searchInputContainer.querySelector('#lote-search-input');
        if (input) {
            input.placeholder = placeholder;
        }
    }
}
