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
        onSelectLote = null
    }) {
        this.container = container;
        this.productoras = productoras;
        this.selectedProductora = selectedProductora;
        this.onSearchLotes = onSearchLotes;
        this.onProductoraChange = onProductoraChange;
        this.onSelectLote = onSelectLote;

        this.activeLote = null;
        this.isAccordionOpen = false;
        this.isFilterTabOpen = false;
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

        this._renderProductoraOptions();
        this._bindEvents();
    }

    _renderProductoraOptions() {
        if (!this.selectProductora) return;
        const currentVal = this.selectedProductora;

        const optionsHtml = [
            '<option value="">Todas las Productoras</option>',
            ...this.productoras.map(p => {
                const id = p.id_productora ?? p.id ?? p.nit ?? p.productora;
                const name = p.productora ?? p.nombre ?? id;
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
            const name = found ? (found.productora || found.nombre) : this.selectedProductora;
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
                    <span class="f-sug-qty">${(l.cantidad || 0).toLocaleString()} uds.</span>
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
            return;
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
                            <span class="f-lote-tag">OP: ${l.lote || l.op}</span>
                            <span class="f-lote-status">${l.estado || 'Activo'}</span>
                        </div>
                        <span class="f-lote-ref-text">Ref: ${l.referencia || 'N/A'} · Planta: ${l.planta || 'N/A'}</span>
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
                            <span class="lbl">Cantidad Total</span>
                            <span class="val">${(l.cantidad || 0).toLocaleString()} uds.</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Módulo / Línea</span>
                            <span class="val">${l.modulo || l.linea || 'Línea 1'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Proceso</span>
                            <span class="val">${l.proceso || 'Confección'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Tipo Prenda</span>
                            <span class="val">${l.tipoPrenda || l.prenda || 'Prenda'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Género / Tejido</span>
                            <span class="val">${[l.genero, l.tejido].filter(Boolean).join(' · ') || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">SAM Estimado</span>
                            <span class="val">${l.sam ? l.sam + ' min' : 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Fecha Entrada</span>
                            <span class="val">${l.entrada || l.fechaEntrega || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item">
                            <span class="lbl">Fecha Salida</span>
                            <span class="val">${l.salida || l.fechaSalida || 'N/A'}</span>
                        </div>
                        <div class="f-detail-item full">
                            <span class="lbl">Descripción Completa Master</span>
                            <span class="val">${l.descripcion || 'Sin descripción adicional en master'}</span>
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
}
