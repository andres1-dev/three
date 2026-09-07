/**
 * Módulo: NUBE — Programación de Taller
 * Migrado desde legacy `migracion [ Imput ]/map/` (programacionView.js).
 * Flujo: pegar/ingresar tabla → revisar → Asentar a la tabla `extensiones`
 * (Supabase, vía Edge Function dedicada `/nube`).
 */
import { Toast } from '../../components/Toast.js';
import { Store } from '../../state/Store.js';
import {
    MAPPED_COLUMNS,
    parseHTMLTable,
    parseTabularLines,
    buildProgramacionJSON,
    buildColeccionJSON,
    jsonDataToGroups,
    validateClipboardPositions,
    validateExcelColeccionHeaders
} from '../../../core/services/ProgramacionEngine.js';

export class NubeModule {
    constructor({ router, guardarProgramacionUseCase, listarProgramacionUseCase, getProductorasNubeUseCase, resumenProgramacionUseCase }) {
        this.router = router;
        this.guardarProgramacionUseCase = guardarProgramacionUseCase;
        this.listarProgramacionUseCase = listarProgramacionUseCase;
        this.getProductorasNubeUseCase = getProductorasNubeUseCase;
        this.resumenProgramacionUseCase = resumenProgramacionUseCase;
        this.container = null;
        this._docPaste = null;
        this._docKey = null;

        // Estado (legacy programacionView)
        this.rawHeaders = [];
        this.rawGrid = [];
        this.colMapping = {};
        this.jsonData = [];
        this.dataMode = '';
        this.sourceName = '';
        this.viewMode = 'lotes';
        this.productoras = [];

        this.idProductora = '';
        this.productoraNombre = '';
    }

    $(id) { return this.container ? this.container.querySelector('#' + id) : null; }
    _user() { return Store.getState().currentUser || {}; }
    _userEmail() { const u = this._user(); return u.email || u.correo || ''; }
    _userNombre() { const u = this._user(); return u.displayName || u.nombre || u.email || u.correo || ''; }
    _userRole() { const u = this._user(); return u.rol || u.role || ''; }
    _userProductoraId() { const u = this._user(); return u.idProductora || u.id_productora || null; }
    _userProductoraName() { const u = this._user(); return u.productora || ''; }
    _escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    async mount(vp) {
        this.viewport = vp;
        this.container = document.createElement('div');
        this.container.className = 'mod-nube';
        vp.innerHTML = '';
        vp.appendChild(this.container);

        this._render();
        this._bindEvents();
        this._showSkeleton(true);
        try {
            await Promise.all([
                this._cargarProductoras(),
                this._cargarResumen()
            ]);
            this._renderExcelGrid();
        } catch (e) {
            console.error('[NubeModule] Error en carga inicial:', e);
        } finally {
            this._showSkeleton(false);
        }
    }

    _showSkeleton(on) {
        const sk = this.container?.querySelector('#nube-skeleton');
        const real = this.container?.querySelector('#nube-real');
        if (sk) sk.style.display = on ? 'flex' : 'none';
        if (real) real.style.display = on ? 'none' : 'flex';
    }

    unmount() {
        if (this._docPaste) { document.removeEventListener('paste', this._docPaste); this._docPaste = null; }
        if (this.container) this.container.innerHTML = '';
        this.container = null;
    }

    _render() {
        this.container.innerHTML = `
            <!-- ════ SKELETON LOADER (Idéntico a Perfil/Personas) ════ -->
            <div class="nube-skeleton" id="nube-skeleton" aria-hidden="true">
                <div class="sk-n-header">
                    <div class="sk-circle sk-sm"></div>
                    <div class="sk-bar sk-bar--title"></div>
                </div>
                <!-- Solapa Productora Skeleton -->
                <div class="sk-n-filter-tab">
                    <div class="sk-bar sk-n-bar--tab-title"></div>
                </div>
                <div class="sk-n-body">
                    <div class="sk-n-actions">
                        <div class="sk-btn sk-n-btn"></div>
                        <div class="sk-btn sk-n-btn"></div>
                        <div class="sk-btn sk-n-btn"></div>
                        <div class="sk-btn sk-n-btn"></div>
                    </div>
                    <div class="sk-n-accordions">
                        <div class="sk-n-acc-card">
                            <div class="sk-bar sk-n-bar--acc-hdr"></div>
                        </div>
                        <div class="sk-n-acc-card">
                            <div class="sk-bar sk-n-bar--acc-hdr"></div>
                        </div>
                        <div class="sk-n-acc-card">
                            <div class="sk-bar sk-n-bar--acc-hdr"></div>
                        </div>
                    </div>
                    <div class="sk-n-grid">
                        <div class="sk-bar sk-n-bar--zone"></div>
                    </div>
                </div>
            </div>

            <!-- ════ CONTENIDO REAL ════ -->
            <div class="nube-real" id="nube-real" style="display:none; flex-direction:column; flex:1;">
                <div class="page-header">
                    <button class="icon-btn back-btn" id="btn-nube-back" aria-label="Volver">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <h1 class="page-title">Nube</h1>
                </div>

                <!-- Solapa Filtro Productora (Mismo diseño de Formularios) -->
                <div class="f-filter-tab-container" id="nube-productora-tab-container">
                    <div class="f-filter-tab-header" id="btn-toggle-productora-filter" role="button" tabindex="0" aria-expanded="false">
                        <div class="f-tab-title-box">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" style="flex-shrink:0;opacity:0.5">
                                <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6L14 13.333V20a1 1 0 0 1-1.447.894l-4-2A1 1 0 0 1 8 18v-4.667L3.2 5.6A1 1 0 0 1 3 4z"/>
                            </svg>
                            <span class="f-tab-main-text" id="label-productora-filter">Productora</span>
                        </div>
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

                    <div class="f-filter-tab-body" id="productora-drawer" style="display:none;">
                        <div class="f-filter-tab-body-inner">
                            <div class="f-tab-select-wrap">
                                <select id="nubeProveedor" class="f-productora-select" aria-label="Seleccione Productora">
                                    <option value="">Seleccione...</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="nube-body">
                    <div class="nube-actions" id="nubeActions">
                        <button id="btnNubeAsentar" class="nube-btn nube-btn-primary" disabled title="Guardar registros en la tabla extensiones"><span>Asentar</span></button>
                        <button id="btnNubeSave" class="nube-btn" disabled title="Exportar datos a CSV">Exportar CSV</button>
                        <button id="btnNubeCopyJSON" class="nube-btn" disabled>Copiar JSON</button>
                        <button id="btnNubeClear" class="nube-btn" disabled>Limpiar</button>
                        <button id="btnNubeToggleSheet" class="nube-btn" disabled>Ver Plano</button>
                        <button id="btnNubeToggleJson" class="nube-btn" disabled>Ver JSON</button>
                    </div>

                    <!-- Resumen: tarjeta única con secciones colapsables -->
                    <div class="nube-resumen-card">

                        <!-- 1. Extensiones -->
                        <div class="nube-sec-item is-open" id="nube-acc-extensiones">
                            <button type="button" class="nube-sec-header" data-target="nube-acc-extensiones-body" aria-expanded="true">
                                <div class="nube-acc-title-box">
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                                    </svg>
                                    <span class="nube-acc-title">Extensiones</span>
                                    <span class="nube-acc-badge" id="badge-count-extensiones">0</span>
                                </div>
                                <svg class="nube-acc-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                            <div class="nube-sec-body" id="nube-acc-extensiones-body">
                                <table class="nube-resumen-table">
                                    <tbody id="nubeResumenTbodyExtensiones"></tbody>
                                </table>
                                <div id="nubeResumenEmptyExtensiones" class="nube-resumen-empty">Sin registros guardados todavía.</div>
                            </div>
                        </div>

                        <!-- Divider -->
                        <div class="nube-sec-divider"></div>

                        <!-- 2. Confección -->
                        <div class="nube-sec-item" id="nube-acc-confeccion">
                            <button type="button" class="nube-sec-header" data-target="nube-acc-confeccion-body" aria-expanded="false">
                                <div class="nube-acc-title-box">
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                                        <line x1="3" y1="6" x2="21" y2="6"/>
                                        <path d="M16 10a4 4 0 0 1-8 0"/>
                                    </svg>
                                    <span class="nube-acc-title">Confección</span>
                                    <span class="nube-acc-badge" id="badge-count-confeccion">0</span>
                                </div>
                                <svg class="nube-acc-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                            <div class="nube-sec-body" id="nube-acc-confeccion-body" style="display:none;">
                                <table class="nube-resumen-table">
                                    <tbody id="nubeResumenTbodyConfeccion"></tbody>
                                </table>
                                <div id="nubeResumenEmptyConfeccion" class="nube-resumen-empty">Sin registros guardados todavía.</div>
                            </div>
                        </div>

                        <!-- Divider -->
                        <div class="nube-sec-divider"></div>

                        <!-- 3. Procesos -->
                        <div class="nube-sec-item" id="nube-acc-procesos">
                            <button type="button" class="nube-sec-header" data-target="nube-acc-procesos-body" aria-expanded="false">
                                <div class="nube-acc-title-box">
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="3"/>
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                    </svg>
                                    <span class="nube-acc-title">Procesos</span>
                                    <span class="nube-acc-badge" id="badge-count-procesos">0</span>
                                </div>
                                <svg class="nube-acc-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                            <div class="nube-sec-body" id="nube-acc-procesos-body" style="display:none;">
                                <table class="nube-resumen-table">
                                    <tbody id="nubeResumenTbodyProcesos"></tbody>
                                </table>
                                <div id="nubeResumenEmptyProcesos" class="nube-resumen-empty">Sin registros guardados todavía.</div>
                            </div>
                        </div>

                    </div>

                    <div id="nubeExcelZone" class="nube-excel-zone" tabindex="0" role="grid" aria-label="Área de pegado de tabla. Haz clic y pega con Ctrl+V"></div>

                    <div class="lotes-top-bar hidden" id="nubeLotesBar">
                        <div class="lotes-filter">
                            <input type="text" id="nubeFilterOp" placeholder="Filtrar por OP…" inputmode="numeric">
                            <button id="btnNubeClearFilter" class="nube-btn nube-btn-icon" title="Limpiar filtro">✕</button>
                        </div>
                        <div class="lotes-stats">
                            <span class="lotes-stat" id="nubeLotesSource">Sin datos</span>
                            <span class="lotes-stat"><strong id="nubeStatOps">0</strong>&nbsp;OPs</span>
                            <span class="lotes-stat"><strong id="nubeStatExt">0</strong>&nbsp;extensiones</span>
                        </div>
                    </div>
                    <div id="nubeLotesContainer" class="lotes-container hidden">
                        <div class="lotes-empty">Pega la tabla o sube el Excel de colección para ver los lotes</div>
                    </div>

                    <div id="nubeJSONSection" class="nube-json-section hidden">
                        <div class="nube-json-bar">
                            <span class="nube-json-title">JSON de programación</span>
                            <button id="btnNubeCopyJsonView" class="nube-btn">Copiar</button>
                        </div>
                        <pre id="nubeJSONContent" class="nube-json-pre">[]</pre>
                    </div>

                    <input type="file" id="nubeFileInput" accept=".xlsx,.xls,.csv" style="display:none;">
                </div>
            </div>
        `;
    }

    _bindEvents() {
        // Volver
        this.container.querySelector('#btn-nube-back')?.addEventListener('click', () => {
            this.router.navigate('apps');
        });

        // Solapa Filtro Productora (patrón Formularios)
        const tabContainer = this.container.querySelector('#nube-productora-tab-container');
        const btnToggleFilter = this.container.querySelector('#btn-toggle-productora-filter');
        const filterDrawer = this.container.querySelector('#productora-drawer');
        const btnClearProd = this.container.querySelector('#btn-clear-productora');
        const sel = this.container.querySelector('#nubeProveedor');

        const toggleHandler = () => {
            if (sel?.disabled) {
                Toast.info('Productora asignada a tu usuario, no editable');
                return;
            }
            const isOpen = filterDrawer?.style.display !== 'none';
            if (filterDrawer) filterDrawer.style.display = isOpen ? 'none' : 'block';
            if (tabContainer) tabContainer.classList.toggle('is-open', !isOpen);
            if (btnToggleFilter) btnToggleFilter.setAttribute('aria-expanded', String(!isOpen));
        };

        btnToggleFilter?.addEventListener('click', toggleHandler);
        btnToggleFilter?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (sel?.disabled) {
                    e.preventDefault();
                    Toast.info('Productora asignada a tu usuario, no editable');
                    return;
                }
                e.preventDefault();
                toggleHandler();
            }
        });

        btnClearProd?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sel?.disabled) {
                Toast.info('Productora asignada a tu usuario, no editable');
                return;
            }
            if (sel) sel.value = '';
            this.idProductora = '';
            this.productoraNombre = '';
            this._syncProductoraUI();
            this._renderExcelGrid();
            this._updateUIState(this.rawGrid.length);
        });

        // Secciones colapsables dentro de la tarjeta unificada
        this.container.querySelectorAll('.nube-sec-header').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const body = this.container.querySelector('#' + targetId);
                const item = btn.closest('.nube-sec-item');
                if (!body || !item) return;

                const isCurrentlyOpen = body.style.display !== 'none';
                body.style.display = isCurrentlyOpen ? 'none' : 'block';
                item.classList.toggle('is-open', !isCurrentlyOpen);
                btn.setAttribute('aria-expanded', String(!isCurrentlyOpen));
            });
        });

        this._docPaste = (e) => {
            if (!this.idProductora) { e.preventDefault(); Toast.warning('Primero seleccione la productora.'); return; }
            if (e.target.classList && e.target.classList.contains('xls-cell')) return;
            e.preventDefault();
            this._handleIncomingPaste(e.clipboardData);
        };
        document.addEventListener('paste', this._docPaste);

        // Botones de acción
        this.$('btnNubeSave')?.addEventListener('click', () => this._downloadCSV());
        this.$('btnNubeCopyJSON')?.addEventListener('click', () => this._copyJSON());
        this.$('btnNubeClear')?.addEventListener('click', () => this._clearData());
        this.$('btnNubeAsentar')?.addEventListener('click', () => this._submitAsentarModal());
        this.$('btnNubeToggleSheet')?.addEventListener('click', () => {
            this.viewMode = this.viewMode === 'plano' ? 'lotes' : 'plano';
            this._applyViewMode();
        });
        this.$('btnNubeToggleJson')?.addEventListener('click', () => {
            this.viewMode = this.viewMode === 'json' ? 'lotes' : 'json';
            this._applyViewMode();
        });
        this.$('btnNubeCopyJsonView')?.addEventListener('click', () => this._copyJSON());

        // Filtro de OP en la vista de lotes
        this.$('nubeFilterOp')?.addEventListener('input', () => this._refreshDerivedViews());
        this.$('btnNubeClearFilter')?.addEventListener('click', () => {
            const inp = this.$('nubeFilterOp');
            if (inp) { inp.value = ''; this._refreshDerivedViews(); inp.focus(); }
        });

        // Archivo (Excel/CSV)
        this.$('nubeFileInput')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) this._handleExcelFile(e.target.files[0]);
            e.target.value = '';
        });
    }

    _syncProductoraUI() {
        const tabContainer = this.$('nube-productora-tab-container');
        const labelFilter = this.$('label-productora-filter');
        const btnClearProd = this.$('btn-clear-productora');
        const sel = this.$('nubeProveedor');
        const btnToggleFilter = this.$('btn-toggle-productora-filter');
        const chevron = this.$('btn-toggle-productora-filter')?.querySelector('.f-tab-chevron');

        if (this.idProductora && this.productoraNombre) {
            if (labelFilter) labelFilter.textContent = this.productoraNombre.toUpperCase();
            if (tabContainer) tabContainer.classList.add('has-active-filter');
            if (btnClearProd && !sel?.disabled) btnClearProd.style.display = 'inline-flex';
            
            // Si el select está deshabilitado (USER-P), ocultar chevron y deshabilitar click
            if (sel?.disabled) {
                if (chevron) chevron.style.display = 'none';
                if (btnToggleFilter) {
                    btnToggleFilter.classList.add('is-locked');
                    btnToggleFilter.style.cursor = 'default';
                    btnToggleFilter.style.opacity = '0.7';
                }
            } else {
                if (chevron) chevron.style.display = 'block';
                if (btnToggleFilter) {
                    btnToggleFilter.classList.remove('is-locked');
                    btnToggleFilter.style.cursor = 'pointer';
                    btnToggleFilter.style.opacity = '1';
                }
            }
        } else {
            if (labelFilter) labelFilter.textContent = 'Productora';
            if (tabContainer) tabContainer.classList.remove('has-active-filter');
            if (btnClearProd) btnClearProd.style.display = 'none';
            if (chevron) chevron.style.display = 'block';
            if (btnToggleFilter) {
                btnToggleFilter.classList.remove('is-locked');
                btnToggleFilter.style.cursor = 'pointer';
                btnToggleFilter.style.opacity = '1';
            }
        }
    }

    async _cargarProductoras() {
        this.productoras = await this.getProductorasNubeUseCase.execute();
        const sel = this.$('nubeProveedor');
        if (!sel) return;
        this.idProductora = '';
        this.productoraNombre = '';
        sel.innerHTML = ['<option value="">Seleccione...</option>']
            .concat(this.productoras.map(p => {
                const num = String(p.id_productora ?? p.nit ?? p.id ?? '');
                const name = String(p.productora || p.nombre_corto || p.nombre || num).toUpperCase();
                return `<option value="${this._escapeHtml(num)}">${this._escapeHtml(name)}</option>`;
            }))
            .join('');

        sel.addEventListener('change', () => {
            if (sel.disabled) return; // Seguridad extra: no permitir cambios si está deshabilitado
            const found = this.productoras.find(p => String(p.id_productora ?? p.nit ?? p.id ?? '') === String(sel.value));
            this.idProductora = found ? String(found.id_productora ?? found.nit ?? found.id ?? '') : '';
            this.productoraNombre = found ? String(found.productora || found.nombre_corto || '').toUpperCase() : '';
            this._syncProductoraUI();

            const filterDrawer = this.$('productora-drawer');
            const tabContainer = this.$('nube-productora-tab-container');
            const btnToggleFilter = this.$('btn-toggle-productora-filter');
            if (filterDrawer) filterDrawer.style.display = 'none';
            if (tabContainer) tabContainer.classList.remove('is-open');
            if (btnToggleFilter) btnToggleFilter.setAttribute('aria-expanded', 'false');

            this._renderExcelGrid();
            this._updateUIState(this.rawGrid.length);
        });

        // Preselección según el usuario autenticado
        const role = String(this._userRole()).toUpperCase();
        const isAdmin = role === 'ADMIN' || role === 'MODERATOR';
        const userProdId = this._userProductoraId() != null ? String(this._userProductoraId()) : '';
        const userProdName = String(this._userProductoraName()).trim();

        let foundUser = userProdId ? this.productoras.find(p => String(p.id_productora ?? p.nit ?? p.id ?? '') === userProdId) : null;

        // Si no se encuentra por ID pero tenemos nombre, buscar por nombre (normalizado)
        if (!foundUser && userProdName) {
            foundUser = this.productoras.find(p => {
                const prodName = String(p.productora || p.nombre_corto || p.nombre || '').toUpperCase().trim();
                return prodName === userProdName.toUpperCase();
            });
        }

        // Si aún no se encuentra pero tenemos datos del usuario, agregar manualmente
        if (!foundUser && (userProdId || userProdName)) {
            foundUser = { id_productora: userProdId || userProdName, productora: userProdName || userProdId };
            this.productoras.push(foundUser);
            sel.insertAdjacentHTML('beforeend',
                `<option value="${this._escapeHtml(foundUser.id_productora)}">${this._escapeHtml(foundUser.productora.toUpperCase())}</option>`);
        }

        if (foundUser) {
            this.idProductora = String(foundUser.id_productora ?? foundUser.nit ?? foundUser.id ?? '');
            this.productoraNombre = String(foundUser.productora || foundUser.nombre_corto || '').toUpperCase();
            sel.value = this.idProductora;
            if (!isAdmin) {
                sel.disabled = true;
                sel.title = 'Productora asignada a tu usuario (no editable)';
                // Ocultar botón de limpiar para usuarios no-admin
                this.$('btn-clear-productora').style.display = 'none';
            }
            this._syncProductoraUI();
            this._renderExcelGrid();
            this._updateUIState(this.rawGrid.length);
        } else {
            this._syncProductoraUI();
        }
    }

    _updateUIState(count) {
        const counter = this.$('nubeRowCount');
        if (counter) counter.textContent = `${count} fila${count !== 1 ? 's' : ''}`;

        const hasData = (count > 0 || this.jsonData.length > 0) && !!this.idProductora;
        ['btnNubeSave', 'btnNubeCopyJSON', 'btnNubeClear', 'btnNubeAsentar'].forEach(id => {
            const b = this.$(id);
            if (b) b.disabled = !hasData;
        });
    }

    _applyViewMode() {
        const zone = this.$('nubeExcelZone');
        const lotesBar = this.$('nubeLotesBar');
        const lotesContainer = this.$('nubeLotesContainer');
        const jsonSection = this.$('nubeJSONSection');
        const hasAny = this.jsonData.length > 0 || this.rawGrid.length > 0;

        if (zone) {
            const showZone = this.viewMode === 'plano' || (this.viewMode === 'lotes' && !hasAny);
            zone.classList.toggle('hidden', !showZone);
        }
        if (lotesBar) lotesBar.classList.toggle('hidden', this.viewMode !== 'lotes' || !hasAny);
        if (lotesContainer) lotesContainer.classList.toggle('hidden', this.viewMode !== 'lotes' || !hasAny);
        if (jsonSection) jsonSection.classList.toggle('hidden', this.viewMode !== 'json');

        const btnPlano = this.$('btnNubeToggleSheet');
        if (btnPlano) {
            const label = btnPlano.querySelector('span') || btnPlano;
            if (label) label.textContent = this.viewMode === 'plano' ? 'Ocultar Plano' : 'Ver Plano';
            btnPlano.classList.toggle('hidden', !hasAny);
        }
        const btnJson = this.$('btnNubeToggleJson');
        if (btnJson) {
            const label = btnJson.querySelector('span') || btnJson;
            if (label) label.textContent = this.viewMode === 'json' ? 'Ocultar JSON' : 'Ver JSON';
            btnJson.classList.toggle('hidden', !hasAny);
        }

        ['btnNubeClear', 'btnNubeCopyJSON', 'btnNubeSave', 'btnNubeAsentar'].forEach(id => {
            const b = this.$(id);
            if (b) b.classList.toggle('hidden', !hasAny);
        });
    }
// ── 3. RENDER DE LA HOJA EXCEL (grid editable) ─────────────────────────
    _colLetter(i) {
        let s = '', n = i + 1;
        while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
        return s;
    }

    _renderExcelGrid() {
        const zone = this.$('nubeExcelZone');
        if (!zone) return;

        if (!this.rawGrid.length) {
            zone.innerHTML = this._buildEmptyStateHtml();
            this._setupGridEvents(zone);
            this._updateUIState(0);
            this._applyData();
            return;
        }

        const maxCols = Math.max(this.rawHeaders.length, ...this.rawGrid.map(r => r.length));

        let theadCells = `<th class="xls-corner-cell" title="Eliminar / Fila"></th>`;
        for (let c = 0; c < maxCols; c++) {
            const letter = this._colLetter(c);
            const headerName = this.rawHeaders[c] || `Columna ${c + 1}`;
            const mappedKey = this.colMapping[c] || '';
            const optionsHtml = [
                `<option value="">(Sin mapear)</option>`,
                ...MAPPED_COLUMNS.map(m =>
                    `<option value="${m.key}" ${m.key === mappedKey ? 'selected' : ''}>[${m.letter}] ${m.label}${m.required ? ' *' : ''}</option>`
                )
            ].join('');
            theadCells += `
                <th class="xls-col-header ${mappedKey ? 'is-mapped' : ''}" data-col="${c}">
                    <div class="xls-hdr-top">
                        <span class="xls-hdr-letter">${letter}</span>
                        <span class="xls-hdr-name" title="${this._escapeHtml(headerName)}">${this._escapeHtml(headerName)}</span>
                    </div>
                    <div class="xls-hdr-mapping">
                        <select class="xls-map-select" data-col="${c}" title="Asignar campo de destino">${optionsHtml}</select>
                    </div>
                </th>`;
        }

        let tbodyRows = '';
        this.rawGrid.forEach((row, rIdx) => {
            let rowCells = `
                <td class="xls-row-num" title="Fila ${rIdx + 1}">
                    <span class="xls-rn-text">${rIdx + 1}</span>
                    <button class="btn-del-row" data-row="${rIdx}" title="Eliminar fila ${rIdx + 1}" aria-label="Eliminar fila">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </td>`;
            for (let c = 0; c < maxCols; c++) {
                const val = row[c] !== undefined ? String(row[c]) : '';
                const mappedKey = this.colMapping[c];
                rowCells += `
                    <td class="xls-cell ${mappedKey ? 'is-mapped-cell' : ''}" contenteditable="true" data-row="${rIdx}" data-col="${c}" spellcheck="false">${this._escapeHtml(val)}</td>`;
            }
            tbodyRows += `<tr data-row="${rIdx}">${rowCells}</tr>`;
        });

        zone.innerHTML = `
            <div class="xls-sheet-container">
                <div class="xls-toolbar">
                    <span class="xls-stat-badge">${this.rawGrid.length} filas</span>
                    <span class="xls-stat-badge">${maxCols} columnas</span>
                    <span class="xls-stat-mapped">${Object.keys(this.colMapping).length} de ${MAPPED_COLUMNS.length} mapeadas</span>
                    <button id="btnNubeAddRow" class="btn-ghost xls-tool-btn" title="Agregar fila al final">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        + Fila
                    </button>
                </div>
                <div class="xls-grid-scroll">
                    <table class="xls-table">
                        <thead><tr>${theadCells}</tr></thead>
                        <tbody>${tbodyRows}</tbody>
                    </table>
                </div>
            </div>`;

        this._setupGridEvents(zone);
        this._applyData();
        this._updateUIState(this.rawGrid.length);
    }

    _buildEmptyStateHtml() {
        if (!this.idProductora) {
            return `
            <div class="prog-paste-hint" id="nubePasteZonePrompt">
                <div class="prog-hub-card is-locked">
                    <h3 class="prog-hub-title">Seleccione una productora</h3>
                    <p class="prog-hub-subtitle">Para pegar la tabla o cargar un archivo, primero elija la productora en la barra superior.</p>
                </div>
            </div>`;
        }
        return `
            <div class="prog-paste-hint" id="nubePasteZonePrompt">
                <div class="prog-hub-card">
                    <h3 class="prog-hub-title">Importar Programación de Taller</h3>
                    <p class="prog-hub-subtitle">Copia la tabla desde tu correo o archivo y pégala aquí</p>
                    <div class="prog-hub-actions">
                        <button id="btnNubeTriggerPaste" class="btn-modal-primary prog-hub-paste-btn">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                            Pegar del portapapeles
                        </button>
                        <button id="btnNubeUploadEmpty" class="btn-ghost prog-hub-upload-btn" title="Cargar archivo (.xlsx, .xls o .csv)">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Cargar archivo
                        </button>
                    </div>
                </div>
            </div>`;
    }
    _setupGridEvents(zone) {
        if (!zone) return;

        // Selector de mapeo de columnas
        zone.querySelectorAll('.xls-map-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const colIdx = parseInt(e.target.dataset.col, 10);
                const val = e.target.value;
                if (val) {
                    for (const [k, v] of Object.entries(this.colMapping)) {
                        if (v === val && parseInt(k, 10) !== colIdx) delete this.colMapping[k];
                    }
                    this.colMapping[colIdx] = val;
                } else {
                    delete this.colMapping[colIdx];
                }
                this._renderExcelGrid();
            });
        });

        // Edición en vivo de celdas
        zone.querySelectorAll('.xls-cell').forEach(cell => {
            cell.addEventListener('input', (e) => {
                const r = parseInt(e.target.dataset.row, 10);
                const c = parseInt(e.target.dataset.col, 10);
                if (this.rawGrid[r]) this.rawGrid[r][c] = e.target.innerText.trim();
            });
        });

        // Eliminar fila
        zone.querySelectorAll('.btn-del-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const r = parseInt(btn.dataset.row, 10);
                if (this.rawGrid[r]) { this.rawGrid.splice(r, 1); this._renderExcelGrid(); }
            });
        });

        // Agregar fila
        const btnAddRow = zone.querySelector('#btnNubeAddRow');
        if (btnAddRow) {
            btnAddRow.addEventListener('click', () => {
                const numCols = Math.max(this.rawHeaders.length, 1);
                this.rawGrid.push(new Array(numCols).fill(''));
                this._renderExcelGrid();
            });
        }

        zone.addEventListener('paste', (e) => {
            if (!this.idProductora) { e.preventDefault(); Toast.warning('Primero seleccione la productora.'); return; }
            if (e.target.classList && e.target.classList.contains('xls-cell')) return;
            e.preventDefault();
            this._handleIncomingPaste(e.clipboardData);
        });

        // Drag & drop de Excel
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                if (/\.(xlsx|xls)$/i.test(files[0].name)) this._handleExcelFile(files[0]);
                else Toast.error('Solo archivos .xlsx o .xls');
            } else if (e.dataTransfer.getData('text/html') || e.dataTransfer.getData('text/plain')) {
                this._handleIncomingPaste(e.dataTransfer);
            }
        });

        // Botones del estado vacío
        const btnTrigger = zone.querySelector('#btnNubeTriggerPaste');
        if (btnTrigger) {
            btnTrigger.addEventListener('click', () => {
                if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
                navigator.clipboard.read().then(items => {
                    for (const item of items) {
                        if (item.types.includes('text/html')) {
                            item.getType('text/html').then(b => b.text()).then(html => {
                                const parsed = parseHTMLTable(html);
                                if (parsed) {
                                    const val = validateClipboardPositions(parsed.headers, parsed.grid);
                                    if (!val.valid) {
                                        Toast.error(val.error, 4500);
                                        return;
                                    }
                                    this.rawHeaders = parsed.headers; this.rawGrid = parsed.grid; this.colMapping = parsed.mapping;
                                    this.dataMode = 'pegar'; this.sourceName = '';
                                    this._renderExcelGrid();
                                }
                            });
                            return;
                        } else if (item.types.includes('text/plain')) {
                            item.getType('text/plain').then(b => b.text()).then(text => {
                                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                                const parsed = parseTabularLines(lines);
                                if (parsed) {
                                    const val = validateClipboardPositions(parsed.headers, parsed.grid);
                                    if (!val.valid) {
                                        Toast.error(val.error, 4500);
                                        return;
                                    }
                                    this.rawHeaders = parsed.headers; this.rawGrid = parsed.grid; this.colMapping = parsed.mapping;
                                    this.dataMode = 'pegar'; this.sourceName = '';
                                    this._renderExcelGrid();
                                }
                            });
                            return;
                        }
                    }
                }).catch(() => Toast.info('Presiona Ctrl + V directamente en el recuadro para pegar.'));
            });
        }
        const btnUpload = zone.querySelector('#btnNubeUploadEmpty');
        if (btnUpload) btnUpload.addEventListener('click', () => {
            if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
            this.$('nubeFileInput')?.click();
        });
    }

    _handleIncomingPaste(clipboardData) {
        if (!clipboardData) return;
        if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
        this.dataMode = 'pegar';
        this.sourceName = '';

        const html = clipboardData.getData('text/html');
        if (html) {
            const parsed = parseHTMLTable(html);
            if (parsed) {
                const val = validateClipboardPositions(parsed.headers, parsed.grid);
                if (!val.valid) {
                    Toast.error(val.error, 4500);
                    return;
                }
                this.rawHeaders = parsed.headers;
                this.rawGrid = parsed.grid;
                this.colMapping = parsed.mapping;
                this._renderExcelGrid();
                return;
            }
        }

        const text = clipboardData.getData('text/plain') || '';
        if (!text.trim()) return;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return;
        const parsed = parseTabularLines(lines);
        if (parsed) {
            const val = validateClipboardPositions(parsed.headers, parsed.grid);
            if (!val.valid) {
                Toast.error(val.error, 4500);
                return;
            }
            this.rawHeaders = parsed.headers;
            this.rawGrid = parsed.grid;
            this.colMapping = parsed.mapping;
            this._renderExcelGrid();
        }
    }
// ── 4. VISTAS DERIVADAS (LOTES + JSON) ─────────────────────────────────
    _applyData() {
        if (this.dataMode === 'excel') { this._refreshDerivedViews(); return; }
        this.jsonData = buildProgramacionJSON(this.rawHeaders, this.rawGrid, this.colMapping);
        if (this.jsonData.length) { this.dataMode = 'pegar'; this.sourceName = ''; }
        this._refreshDerivedViews();
    }

    _refreshDerivedViews() {
        const filterInput = this.$('nubeFilterOp');
        const filterVal = filterInput ? filterInput.value.trim() : '';
        let filtered = this.jsonData;
        const opNum = parseInt(filterVal, 10);
        if (filterVal && !isNaN(opNum)) filtered = this.jsonData.filter(item => item.op === opNum);
        this._renderLotes(jsonDataToGroups(filtered));
        this._renderJSONView(filtered);
        this._updateLotesStats(filtered);
        this._applyViewMode();
    }

    _renderLotes(groups) {
        const container = this.$('nubeLotesContainer');
        if (!container) return;
        if (!groups.length) {
            container.innerHTML = '<div class="lotes-empty">Pega la tabla o sube el Excel de colección para ver los lotes</div>';
            return;
        }
        let html = '';
        for (const grupo of groups) {
            const tallas = grupo.tallas;
            const colores = grupo.colores;
            html += '<table class="lotes-table"><thead><tr class="group-header"><td colspan="' + (tallas.length + 2) + '">' +
                '<span class="badge-op">OP ' + this._escapeHtml(String(grupo.op)) + '</span>' +
                this._escapeHtml(grupo.referencia) +
                '</td></tr><tr><th class="lotes-color-h">Color</th>';
            for (const talla of tallas) html += '<th>' + this._escapeHtml(talla) + '</th>';
            html += '<th class="lotes-total-h">Total</th></tr></thead><tbody>';
            let totalGral = 0;
            for (const color of colores) {
                html += '<tr><td class="color-cell">' + this._escapeHtml(color.color) + '</td>';
                let totalColor = 0;
                for (const talla of tallas) {
                    const cantidad = color.curva[talla] || 0;
                    totalColor += cantidad; totalGral += cantidad;
                    html += '<td class="' + (cantidad > 0 ? 'cantidad-cell' : 'cantidad-0') + '">' + (cantidad > 0 ? cantidad : '-') + '</td>';
                }
                html += '<td class="lotes-total-cell">' + totalColor + '</td></tr>';
            }
            html += '<tr class="lotes-grand-total"><td>TOTAL</td>';
            for (const talla of tallas) {
                let totalTalla = 0;
                for (const color of colores) totalTalla += color.curva[talla] || 0;
                html += '<td>' + totalTalla + '</td>';
            }
            html += '<td>' + totalGral + '</td></tr></tbody></table>';
        }
        container.innerHTML = html;
    }

    _highlightJSON(jsonText) {
        return jsonText.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                let cls = 'json-num';
                let out = match;
                if (match.charAt(0) === '"') {
                    cls = /:$/.test(match) ? 'json-key' : 'json-str';
                    out = this._escapeHtml(match);
                } else if (match === 'true' || match === 'false') cls = 'json-bool';
                else if (match === 'null') cls = 'json-null';
                return '<span class="' + cls + '">' + out + '</span>';
            }
        );
    }

    _renderJSONView(filtered) {
        const pre = this.$('nubeJSONContent');
        if (pre) pre.innerHTML = this._highlightJSON(JSON.stringify(filtered || [], null, 2));
    }

    _updateLotesStats(filtered) {
        const opsEl = this.$('nubeStatOps');
        const extEl = this.$('nubeStatExt');
        const srcEl = this.$('nubeLotesSource');
        let totalExt = 0;
        (filtered || []).forEach(g => { totalExt += g.extensiones.length; });
        if (opsEl) opsEl.textContent = String((filtered || []).length);
        if (extEl) extEl.textContent = String(totalExt);
        if (srcEl) {
            if (!this.jsonData.length) srcEl.textContent = 'Sin datos';
            else if (this.dataMode === 'excel') srcEl.textContent = 'Excel: ' + this.sourceName;
            else if (this.dataMode === 'csv') srcEl.textContent = 'CSV: ' + this.sourceName;
            else srcEl.textContent = 'Pegado';
        }
    }
// ── 5. INGESTA DE ARCHIVOS (Excel / CSV) ───────────────────────────────
    _loadSheetJS() {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'undefined' && window.XLSX) return resolve(window.XLSX);
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX no disponible')));
            s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel (CDN).'));
            document.head.appendChild(s);
        });
    }

    async _handleExcelFile(file) {
        if (!file) return;
        if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
        if (/\.csv$/i.test(file.name)) { this._handleCsvFile(file); return; }
        if (!/\.(xlsx|xls)$/i.test(file.name)) { Toast.error('Solo archivos .xlsx, .xls o .csv'); return; }
        try {
            const XLSX = await this._loadSheetJS();
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
            
            // Validación obligatoria de encabezados del Excel:
            // B (índice 1) → Referencia, D (índice 3) → OP, M (índice 12) → Color, O..AS → Tallas
            const val = validateExcelColeccionHeaders(matrix);
            if (!val.valid) {
                Toast.error(val.error, 5000);
                return;
            }

            const parsed = buildColeccionJSON(matrix);
            if (!parsed.length) {
                Toast.error('El Excel no contiene lotes con curva válida (Ref B · OP D · Color M · Tallas O→AS).');
                return;
            }
            this.jsonData = parsed;
            this.dataMode = 'excel';
            this.sourceName = file.name;
            this.rawHeaders = []; this.rawGrid = []; this.colMapping = {};
            this._renderExcelGrid();
            this._refreshDerivedViews();
            Toast.success('Excel procesado: ' + this.jsonData.length + ' OP(s).');
        } catch (err) {
            console.error('Error al procesar el Excel:', err);
            Toast.error('Error al procesar el Excel: ' + err.message);
        }
    }

    _handleCsvFile(file) {
        if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result || '');
                const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim() !== '');
                if (!lines.length) { Toast.error('El archivo CSV está vacío.'); return; }
                this.rawHeaders = []; this.rawGrid = []; this.colMapping = {};
                const parsed = parseTabularLines(lines);
                if (!parsed || !parsed.grid.length) {
                    Toast.error('El CSV no contiene datos válidos (encabezados: Numlote · Ref · Color · Colores · Talla · Total Und).');
                    return;
                }
                const val = validateClipboardPositions(parsed.headers, parsed.grid);
                if (!val.valid) {
                    Toast.error(val.error, 5000);
                    return;
                }
                this.rawHeaders = parsed.headers; this.rawGrid = parsed.grid; this.colMapping = parsed.mapping;
                this.dataMode = 'csv';
                this.sourceName = file.name;
                this._renderExcelGrid();
                this._refreshDerivedViews();
                Toast.success('CSV procesado: ' + this.jsonData.length + ' OP(s).');
            } catch (err) {
                console.error('Error al procesar el CSV:', err);
                Toast.error('Error al procesar el CSV: ' + err.message);
            }
        };
        reader.onerror = () => Toast.error('Error al leer el archivo.');
        reader.readAsText(file);
    }
// ── 6. EXPORTACIÓN ─────────────────────────────────────────────────────
    _downloadCSV() {
        if (!this.jsonData.length) return;
        const lines = ['REFERENCIA;OP;COLOR;TALLA;CANTIDAD'];
        this.jsonData.forEach(g => {
            g.extensiones.forEach(e => {
                lines.push(`"${String(g.referencia).replace(/"/g, '""')}";${g.op};"${String(e.color).replace(/"/g, '""')}";"${String(e.talla).replace(/"/g, '""')}";${e.cantidad}`);
            });
        });
        const csvContent = '\uFEFF' + lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `programacion_taller_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _copyJSON() {
        if (!this.jsonData.length) return;
        navigator.clipboard.writeText(JSON.stringify(this.jsonData, null, '\t')).then(() => {
            const btn = this.$('btnNubeCopyJSON');
            if (btn) {
                const prev = btn.innerHTML;
                btn.innerHTML = 'Copiado';
                setTimeout(() => { btn.innerHTML = prev; }, 2000);
            }
        });
    }

    _clearData() {
        this.rawHeaders = []; this.rawGrid = []; this.colMapping = {};
        this.jsonData = []; this.dataMode = ''; this.sourceName = '';
        this.viewMode = 'lotes';
        const filterInput = this.$('nubeFilterOp');
        if (filterInput) filterInput.value = '';
        this._renderExcelGrid();
        this._refreshDerivedViews();
        Toast.success('Todos los datos fueron limpiados.');
    }

    _isToday(iso) {
        if (!iso) return false;
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return false;
            const now = new Date();
            return d.getFullYear() === now.getFullYear() &&
                   d.getMonth() === now.getMonth() &&
                   d.getDate() === now.getDate();
        } catch (_) {
            return false;
        }
    }

    _fmtFecha(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return String(iso);
            const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
            return `${fecha} ${hora}`;
        } catch (_) {
            return String(iso);
        }
    }

    async _cargarResumen() {
        try {
            const data = await this.resumenProgramacionUseCase.execute();
            this._renderResumen(data);
        } catch (err) {
            console.error('Error al cargar resumen:', err);
        }
    }

    _renderResumen(data) {
        // 1. Extensiones
        const resumenExt = (data && Array.isArray(data.resumen)) ? data.resumen : ((data && Array.isArray(data.extensiones)) ? data.extensiones : []);
        this._renderResumenSection('Extensiones', resumenExt, 'nubeResumenTbodyExtensiones', 'nubeResumenEmptyExtensiones', 'badge-count-extensiones');

        // 2. Confección
        const resumenConf = (data && Array.isArray(data.confeccion)) ? data.confeccion : [];
        this._renderResumenSection('Confección', resumenConf, 'nubeResumenTbodyConfeccion', 'nubeResumenEmptyConfeccion', 'badge-count-confeccion');

        // 3. Procesos
        const resumenProc = (data && Array.isArray(data.procesos)) ? data.procesos : [];
        this._renderResumenSection('Procesos', resumenProc, 'nubeResumenTbodyProcesos', 'nubeResumenEmptyProcesos', 'badge-count-procesos');
    }

    _renderResumenSection(type, list, tbodyId, emptyId, badgeId) {
        const tbody = this.$(tbodyId);
        const empty = this.$(emptyId);
        const badge = this.$(badgeId);

        if (badge) badge.textContent = list ? list.length : 0;

        if (!list || !list.length) {
            if (tbody) tbody.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        if (tbody) {
            tbody.innerHTML = list.map(r => {
                const name = r.productora || r.id_productora || '—';
                const esHoy = this._isToday(r.ultima_modificacion);
                const checkHtml = esHoy
                    ? `<span class="nube-resumen-check-today" title="Actualizado hoy (${this._fmtFecha(r.ultima_modificacion)})" aria-label="Actualizado hoy">
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                       </span>`
                    : '';
                return '<tr>' +
                    '<td>' +
                        '<div class="nube-resumen-prod">' +
                            '<span>' + this._escapeHtml(name) + '</span>' +
                            checkHtml +
                        '</div>' +
                        '<div class="nube-resumen-user">' + this._escapeHtml(r.usuario || '—') + '</div>' +
                        '<div class="nube-resumen-fecha">' + this._fmtFecha(r.ultima_modificacion) + '</div>' +
                        '<div class="nube-resumen-regs"><strong>' + (Number(r.registros) || 0) + '</strong> registros</div>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        }
    }

    _submitAsentarModal() {
        const rows = this.jsonData;
        if (!rows.length) { Toast.error('No hay datos válidos para asentar.'); return; }
        if (!this.idProductora || !this.productoraNombre) { Toast.error('Debe seleccionar la productora antes de asentar.'); return; }
        const btn = this.$('btnNubeAsentar');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span>Asentando...</span>'; }
        this.guardarProgramacionUseCase.execute({
            rows,
            idProductora: this.idProductora,
            productora: this.productoraNombre,
            usuarioEmail: this._userEmail(),
            usuarioNombre: this._userNombre()
        })
            .then((res) => {
                const totalExtensiones = rows.reduce((acc, r) => acc + r.extensiones.length, 0);
                const agregadas = Number(res && res.agregadas != null ? res.agregadas : rows.length);
                const omitidas = Number(res && res.omitidas != null ? res.omitidas : 0);
                Toast.success(`Se agregaron ${agregadas} OP(s) nuevo(s) (${omitidas} ya existían) con ${totalExtensiones} extensiones.`);
                this._clearData();
                this._cargarResumen();
            })
            .catch(err => {
                console.error('Error al asentar:', err);
                Toast.error('Error al asentar la programación: ' + (err.message || ''));
            })
            .finally(() => {
                if (btn) { btn.disabled = false; btn.innerHTML = '<span>Asentar</span>'; }
            });
    }
}