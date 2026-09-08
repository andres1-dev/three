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
        this.aqlInfo = aqlInfo;

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

                <!-- Buscador Principal On-Demand -->
                <div class="f-search-row">
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
        this.inputSearch = this.container.querySelector('#input-search-lote');
        this.suggestionsBox = this.container.querySelector('#lote-suggestions-box');
        this.activeContainer = this.container.querySelector('#active-lote-container');
        this.clearBtn = this.container.querySelector('#btn-clear-lote-search');
        this.searchIcon = this.container.querySelector('#icon-search-static');
        this.spinner = this.container.querySelector('#icon-search-spinner');

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

        this._renderProductoraOptions();
        this._bindEvents();
    }

    /**
     * Resuelve el nombre corto de una productora a partir de su ID,
     * usando el catálogo cargado vía Edge Function (tabla `productoras`).
     * Prioriza `nombre_corto`; cae al nombre legal si la tabla no lo tiene.
     */
    _getProductoraName(val) {
        if (val === null || val === undefined || val === '') return 'N/A';
        const raw = String(val).trim();
        const p = this.productoras.find(pr => {
            const id = pr.id_productora ?? pr.id ?? pr.nit;
            return id !== undefined && id !== null && String(id) === raw;
        });
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
            }, 260);
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
                    productora: this.selectedProductora
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

        this.suggestionsBox.innerHTML = matches.map((l, index) => `
            <div class="f-suggestion-item" data-index="${index}">
                <div class="f-sug-header">
                    <span class="f-sug-op">OP: ${l.lote || l.op}</span>
                    <span class="f-sug-planta">${l.planta || 'Sin Planta'}</span>
                </div>
                <div class="f-sug-body">
                    <span class="f-sug-ref">Ref: ${l.referencia || 'N/A'}</span>
                    <span class="f-sug-qty">${(l.cantidad || 0).toLocaleString()}</span>
                </div>
                ${l.descripcion ? `<div class="f-sug-desc">${l.descripcion}</div>` : ''}
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
            // La solapa AQL solo es visible cuando hay una OP seleccionada
            if (this.aqlTabContainer) this.aqlTabContainer.style.display = 'none';
            // La solapa Curva solo es visible cuando las extensiones están cargadas
            if (this.curvaTabContainer) this.curvaTabContainer.style.display = 'none';
            return;
        }

        // OP seleccionada: mostrar la solapa informativa del muestreo
        if (this.aqlTabContainer) this.aqlTabContainer.style.display = '';
        // La solapa Curva SOLO aparece cuando las extensiones ya están cargadas
        if (this.curvaTabContainer) {
            this.curvaTabContainer.style.display =
                Array.isArray(this.activeLote.extensiones) ? '' : 'none';
        }

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

        toggleBtn?.addEventListener('click', () => {
            this.isAccordionOpen = !this.isAccordionOpen;
            chevron?.classList.toggle('open', this.isAccordionOpen);
            body?.classList.toggle('open', this.isAccordionOpen);
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
        if (Array.isArray(lote.extensiones)) return; // ya cargadas

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
            this._renderActiveLote(); // hace VISIBLE la solapa Curva (datos cargados)
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
}
