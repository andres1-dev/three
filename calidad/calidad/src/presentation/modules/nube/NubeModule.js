/**
 * Módulo: NUBE — Programación de Taller
 * Migrado desde legacy `migracion [ Imput ]/map/` (programacionView.js).
 * Flujo: pegar/ingresar tabla → revisar → Asentar a la tabla `extensiones`
 * (Supabase, vía Edge Function dedicada `/nube`).
 */
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { Store } from '../../state/Store.js';
import {
    MAPPED_COLUMNS,
    parseHTMLTable,
    parseTabularLines,
    buildProgramacionJSON,
    buildColeccionJSON,
    jsonDataToGroups,
    validateClipboardPositions,
    validateExcelColeccionHeaders,
    detectUploadType,
    buildMasterJSON,
    validateMasterHeaders,
    detectProductoraDesdeCuento,
    isGeneralTdmHeaders,
    buildGeneralTdmJSON
} from '../../../core/services/ProgramacionEngine.js';

export class NubeModule {
    constructor({ router, guardarProgramacionUseCase, listarProgramacionUseCase, getProductorasNubeUseCase, resumenProgramacionUseCase, syncConfeccionUseCase, syncProcesosUseCase, listarMasterUseCase }) {
        this.router = router;
        this.guardarProgramacionUseCase = guardarProgramacionUseCase;
        this.listarProgramacionUseCase = listarProgramacionUseCase;
        this.getProductorasNubeUseCase = getProductorasNubeUseCase;
        this.resumenProgramacionUseCase = resumenProgramacionUseCase;
        this.syncConfeccionUseCase = syncConfeccionUseCase;
        this.syncProcesosUseCase = syncProcesosUseCase;
        this.listarMasterUseCase = listarMasterUseCase;
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
        // Productora bloqueada por defecto (candado cerrado) en NUBE.
        // Se desbloquea con clic en el candado para cambiar de productora
        // y se vuelve a bloquear al elegir o al auto-detectarse por CUENTO.
        // USER-P (Producción): fija siempre, sin candado visible.
        this._productoraBloqueada = true;

        // Datos de Confección y Procesos
        this.confeccionData = [];
        this.procesosData = [];
        // Interfaz limpia: la carga solo se confirma en la ventana de confirmación.
        // Hasta entonces los botones Asentar/Limpiar permanecen ocultos.
        this._cargaConfirmada = false;
    }

    _LOCK_ICON_LOCKED = `
        <svg class="lock-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>`;

    _LOCK_ICON_UNLOCKED = `
        <svg class="lock-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        </svg>`;

    _setProductoraBloqueada(bloqueada) {
        // USER-P (Producción): la productora es fija → SIEMPRE bloqueada, nunca desbloqueable.
        if (this._isUserP()) bloqueada = true;
        this._productoraBloqueada = !!bloqueada;
        const sel = this.$('nubeProveedor');
        const btn = this.$('btn-clear-productora');
        if (sel) sel.disabled = this._productoraBloqueada;
        if (btn) {
            btn.dataset.state = this._productoraBloqueada ? 'locked' : 'unlocked';
            btn.title = this._productoraBloqueada
                ? 'Productora bloqueada — clic para desbloquear'
                : 'Productora desbloqueada — clic para bloquear';
            btn.setAttribute('aria-label', btn.title);
            btn.innerHTML = this._productoraBloqueada ? this._LOCK_ICON_LOCKED : this._LOCK_ICON_UNLOCKED;
        }
        this._syncProductoraUI();
    }

    $(id) { return this.container ? this.container.querySelector('#' + id) : null; }
    _user() { return Store.getState().currentUser || {}; }
    _userEmail() { const u = this._user(); return u.email || u.correo || ''; }
    _userNombre() { const u = this._user(); return u.displayName || u.nombre || u.email || u.correo || ''; }
    _userRole() { const u = this._user(); return u.rol || u.role || ''; }
    _isUserP() { return String(this._userRole()).toUpperCase() === 'USER-P'; }
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
                            <button type="button" class="f-tab-clear-btn" id="btn-clear-productora" data-state="locked" title="Productora bloqueada — clic para desbloquear" aria-label="Productora bloqueada — clic para desbloquear">
                                <svg class="lock-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
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
                    <!-- Resumen: tarjeta única con secciones colapsables -->
                    <div class="nube-resumen-card">

                        <!-- 1. Extensiones (colapsado por defecto) -->
                        <div class="nube-sec-item" id="nube-acc-extensiones">
                            <button type="button" class="nube-sec-header" data-target="nube-acc-extensiones-body" aria-expanded="false">
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
                            <div class="nube-sec-body" id="nube-acc-extensiones-body" style="display:none;">
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

        const msgBloqueada = this._isUserP()
            ? 'Productora asignada a tu usuario — no puede cambiarse'
            : 'Productora bloqueada — clic en el candado para desbloquear';

        const toggleHandler = () => {
            if (sel?.disabled) {
                Toast.info(msgBloqueada);
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
                    Toast.info(msgBloqueada);
                    return;
                }
                e.preventDefault();
                toggleHandler();
            }
        });

        // Candado de productora: clic → desbloquear / bloquear (reemplaza "Quitar filtro").
        // Por defecto NUBE entra con la productora bloqueada.
        btnClearProd?.addEventListener('click', (e) => {
            e.stopPropagation();
            // USER-P: sin toggling — productora fija, jamás se desbloquea.
            if (this._isUserP()) return;
            this._setProductoraBloqueada(!this._productoraBloqueada);
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

        const bloqueada = !!this._productoraBloqueada;
        if (sel) sel.disabled = bloqueada;

        // USER-P: el candado NO se muestra (productora fija, siempre bloqueada).
        // Resto de roles: candado siempre visible (permite desbloquear/bloquear).
        if (btnClearProd) btnClearProd.style.display = this._isUserP() ? 'none' : 'inline-flex';

        if (this.idProductora && this.productoraNombre) {
            if (labelFilter) labelFilter.textContent = this.productoraNombre.toUpperCase();
            if (tabContainer) tabContainer.classList.add('has-active-filter');

            // Chevron oculto mientras esté bloqueada (solo el candado la libera)
            if (bloqueada) {
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
            if (chevron) chevron.style.display = bloqueada ? 'none' : 'block';
            if (btnToggleFilter) {
                if (bloqueada) btnToggleFilter.classList.add('is-locked');
                else btnToggleFilter.classList.remove('is-locked');
                btnToggleFilter.style.cursor = bloqueada ? 'default' : 'pointer';
                btnToggleFilter.style.opacity = bloqueada ? '0.7' : '1';
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
            // Al elegir productora, se vuelve a bloquear (evita cambios accidentales)
            this._setProductoraBloqueada(true);
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
            // Candado por defecto: BLOQUEADO para todos los roles.
            // USER-P: fijo siempre (sin candado visible ni desbloqueo).
            // Resto: se desbloquea con clic en el candado 🔒 y se vuelve a bloquear al elegir.
            this._setProductoraBloqueada(true);
            this._syncProductoraUI();
            this._renderExcelGrid();
            this._updateUIState(this.rawGrid.length);
        } else {
            this._syncProductoraUI();
        }
    }

    _updateUIState(count) {
        // INTERFAZ LIMPIA: ya no hay botones físicos (Asentar/Limpiar).
        // El guardado se realiza desde el modal de confirmación (_confirmarCarga).
        // Se conserva por compatibilidad con todas las llamadas existentes.
        return;
    }

    _applyViewMode() {
        const zone = this.$('nubeExcelZone');
        const lotesBar = this.$('nubeLotesBar');
        const lotesContainer = this.$('nubeLotesContainer');
        const jsonSection = this.$('nubeJSONSection');

        // INTERFAZ LIMPIA: nunca se muestran tablas, JSON, CSV ni inputs de
        // búsqueda con lo que se carga. La zona solo conserva el CTA de importar.
        if (zone) zone.classList.remove('hidden');
        if (lotesBar) lotesBar.classList.add('hidden');
        if (lotesContainer) lotesContainer.classList.add('hidden');
        if (jsonSection) jsonSection.classList.add('hidden');
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

        // INTERFAZ LIMPIA: jamás se pinta la hoja con los datos cargados.
        // Solo se mantiene el estado interno (rawGrid → jsonData) y el CTA de importar.
        this._applyData();
        zone.innerHTML = this._buildEmptyStateHtml();
        this._setupGridEvents(zone);
        this._updateUIState(this.rawGrid.length);
        return;

        /* El grid editable quedó obsoleto por la interfaz limpia (bloque inaccesible). */
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
            btnTrigger.addEventListener('click', async () => {
                if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
                try {
                    const items = await navigator.clipboard.read();
                    let parsed = null;
                    let sourceType = null;

                    for (const item of items) {
                        if (item.types.includes('text/html')) {
                            const html = await item.getType('text/html').then(b => b.text()).catch(() => '');
                            parsed = parseHTMLTable(html);
                            sourceType = 'html';
                            break;
                        } else if (item.types.includes('text/plain')) {
                            const text = await item.getType('text/plain').then(b => b.text()).catch(() => '');
                            const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                            parsed = parseTabularLines(lines);
                            sourceType = 'text';
                            break;
                        }
                    }

                    if (!parsed || !parsed.headers || !parsed.grid.length) {
                        const msg = 'No se detectaron datos válidos en el portapapeles.';
                        console.error('[NubeModule][PasteButton] ' + msg, { headers: parsed?.headers, grid: parsed?.grid });
                        Toast.error(msg);
                        return;
                    }

                    // ── TRAZA DE CONSOLA (solo portapapeles): 1. Datos crudos capturados ──
                    console.log('%c════ [NUBE · PORTAPAPELES · BOTÓN] 1. DATOS CAPTURADOS (crudos, antes de procesar) ════', 'font-weight:bold');
                    console.log('[NUBE] Filas capturadas:', parsed.grid.length);
                    console.log('[NUBE] Encabezados:', parsed.headers);
                    console.log('[NUBE] Mapeo automático de columnas:', parsed.mapping);
                    try { console.table(parsed.grid); } catch (_) { console.log(parsed.grid); }

                    const uploadType = detectUploadType(parsed.headers);
                    console.debug('[NubeModule][PasteButton] Tipo detectado:', uploadType, 'headers:', parsed.headers, 'filas:', parsed.grid.length);

                    if (uploadType === 'CONFECCION') {
                        const val = validateMasterHeaders(parsed.headers, 'CONFECCION');
                        if (!val.valid) {
                            console.error('[NubeModule][PasteButton] Headers inválidos Confección:', parsed.headers, val.error);
                            Toast.error(val.error, 4500);
                            return;
                        }
                        const mapped = buildMasterJSON(parsed.headers, parsed.grid, 'CONFECCION', parseInt(this.idProductora));
                        if (!mapped.length) {
                            console.error('[NubeModule][PasteButton] Sin registros válidos de Confección.', { headers: parsed.headers, rows: parsed.grid.length, sampleRow: parsed.grid[0] });
                            Toast.error('No se encontraron registros válidos de Confección. Verifica que las columnas Numlote, Ref y Total tengan datos.');
                            return;
                        }
                        this._autoDetectAndSetProductora(mapped, 'CONFECCION');
                        this.confeccionData = this._reStampProductora(mapped);
                        this.dataMode = 'confeccion';
                        this.sourceName = 'Portapapeles';
                        this._renderMasterGrid(this.confeccionData, 'CONFECCION');
                        this._updateUIState(this.confeccionData.length);
                        Toast.success('Confección pegada: ' + this.confeccionData.length + ' registro(s).');
                        this._confirmarCarga();
                        return;
                    }

                    if (uploadType === 'PROCESOS') {
                        const val = validateMasterHeaders(parsed.headers, 'PROCESOS');
                        if (!val.valid) {
                            console.error('[NubeModule][PasteButton] Headers inválidos Procesos:', parsed.headers, val.error);
                            Toast.error(val.error, 4500);
                            return;
                        }
                        const mapped = buildMasterJSON(parsed.headers, parsed.grid, 'PROCESOS', parseInt(this.idProductora));
                        if (!mapped.length) {
                            console.error('[NubeModule][PasteButton] Sin registros válidos de Procesos.', { headers: parsed.headers, rows: parsed.grid.length, sampleRow: parsed.grid[0] });
                            Toast.error('No se encontraron registros válidos de Procesos. Verifica que las columnas NumLote, Ref y Total tengan datos.');
                            return;
                        }
                        this._autoDetectAndSetProductora(mapped, 'PROCESOS');
                        this.procesosData = this._reStampProductora(mapped);
                        this.dataMode = 'procesos';
                        this.sourceName = 'Portapapeles';
                        this._renderMasterGrid(this.procesosData, 'PROCESOS');
                        this._updateUIState(this.procesosData.length);
                        Toast.success('Procesos pegados: ' + this.procesosData.length + ' registro(s).');
                        this._confirmarCarga();
                        return;
                    }

                    if (uploadType === 'EXTENSIONES') {
                        // bk2-pegado-extensiones: pegado DIRECTO y tolerante — sin
                        // bloqueo por posiciones A..L; el mapeo automático por nombre
                        // de encabezado y los selectores de la hoja hacen el resto.
                        const val = validateClipboardPositions(parsed.headers, parsed.grid);
                        if (!val.valid) {
                            console.warn('[NubeModule][PasteButton] Posiciones no estándar; se aplica mapeo automático:', val.error);
                        }
                        // ── OBLIGATORIOS (regla del negocio): G(6) NUMLOTE · H(7) REF ·
                        //    J(9) COLORES · K(10) TALLA · L(11) TOTAL UND. Todo lo demás
                        //    (incluido COLOR I(8)) se ignora.
                        const faltantes = ['numlote', 'ref', 'colores', 'talla', 'totalUnd']
                            .filter(k => !Object.values(parsed.mapping || {}).includes(k));
                        if (faltantes.length) {
                            const nombres = { numlote: 'Numlote (G)', ref: 'Ref (H)', colores: 'Colores (J)', talla: 'Talla (K)', totalUnd: 'Total Und (L)' };
                            console.error('[NubeModule][PasteButton] Faltan columnas obligatorias:', faltantes, { headers: parsed.headers, mapping: parsed.mapping });
                            Toast.error('Faltan columnas obligatorias: ' + faltantes.map(k => nombres[k]).join(', '), 5000);
                            return;
                        }
                        this.rawHeaders = parsed.headers; this.rawGrid = parsed.grid; this.colMapping = parsed.mapping;
                        this.dataMode = 'pegar'; this.sourceName = '';
                        this._renderExcelGrid();
                        this._updateUIState(this.rawGrid.length);
                        this._confirmarCarga();
                        // ── TRAZA DE CONSOLA (solo portapapeles): 2. JSON procesado ──
                        console.log('%c════ [NUBE · PORTAPAPELES · BOTÓN] 2. JSON PROCESADO (lo que se enviará a la tabla `extensiones` de Supabase) ════', 'font-weight:bold');
                        console.log('[NUBE] OPs agrupados:', this.jsonData.length, '· Total extensiones:', this.jsonData.reduce((a, r) => a + (r.extensiones ? r.extensiones.length : 0), 0));
                        console.log('[NUBE] jsonData (rows para Supabase):', this.jsonData);
                        try { console.table(this.jsonData.flatMap(r => (r.extensiones || []).map(e => ({ op: r.op, referencia: r.referencia, color: e.color, talla: e.talla, cantidad: e.cantidad })))); } catch (_) { }
                        Toast.success('Extensiones pegadas: ' + parsed.grid.length + ' fila(s).');
                        return;
                    }

                    console.error('[NubeModule][PasteButton] Formato no reconocido.', { headers: parsed.headers, type: uploadType, sourceType });
                    Toast.error('Formato de encabezados no reconocido. Debe ser: Extensiones, Confección o Procesos.');
                } catch (err) {
                    console.error('[NubeModule][PasteButton] Error al leer portapapeles:', err);
                    Toast.info('Presiona Ctrl + V directamente en el recuadro para pegar.');
                }
            });
        }
        const btnUpload = zone.querySelector('#btnNubeUploadEmpty');
        if (btnUpload) btnUpload.addEventListener('click', () => {
            if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
            this.$('nubeFileInput')?.click();
        });
    }

    _handleIncomingPaste(clipboardData) {
        try {
            if (!clipboardData) return;
            if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
            this.dataMode = 'pegar';
            this.sourceName = '';

            let parsed = null;
            const html = clipboardData.getData('text/html');
            if (html) {
                parsed = parseHTMLTable(html);
            }

            if (!parsed) {
                const text = clipboardData.getData('text/plain') || '';
                if (!text.trim()) return;
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (!lines.length) return;
                parsed = parseTabularLines(lines);
            }

            if (!parsed || !parsed.headers || !parsed.grid.length) {
                const msg = 'No se detectaron datos válidos en el portapapeles.';
                console.error('[NubeModule][Paste] ' + msg, { headers: parsed?.headers, grid: parsed?.grid });
                Toast.error(msg);
                return;
            }

            // ── TRAZA DE CONSOLA (solo portapapeles): 1. Datos crudos capturados ──
            console.log('%c════ [NUBE · PORTAPAPELES] 1. DATOS CAPTURADOS (crudos, antes de procesar) ════', 'font-weight:bold');
            console.log('[NUBE] Filas capturadas:', parsed.grid.length);
            console.log('[NUBE] Encabezados:', parsed.headers);
            console.log('[NUBE] Mapeo automático de columnas:', parsed.mapping);
            try { console.table(parsed.grid); } catch (_) { console.log(parsed.grid); }

            // Detectar tipo de datos pegados
            const uploadType = detectUploadType(parsed.headers);
            console.debug('[NubeModule][Paste] Tipo detectado:', uploadType, 'headers:', parsed.headers, 'filas:', parsed.grid.length);

            if (uploadType === 'CONFECCION') {
                const val = validateMasterHeaders(parsed.headers, 'CONFECCION');
                if (!val.valid) {
                    console.error('[NubeModule][Paste] Headers inválidos Confección:', parsed.headers, val.error);
                    Toast.error(val.error, 4500);
                    return;
                }
                const mapped = buildMasterJSON(parsed.headers, parsed.grid, 'CONFECCION', parseInt(this.idProductora));
                if (!mapped.length) {
                    console.error('[NubeModule][Paste] Sin registros válidos de Confección.', { headers: parsed.headers, rows: parsed.grid.length, sampleRow: parsed.grid[0] });
                    Toast.error('No se encontraron registros válidos de Confección. Verifica que las columnas Numlote, Ref y Total tengan datos.');
                    return;
                }
                this._autoDetectAndSetProductora(mapped, 'CONFECCION');
                this.confeccionData = this._reStampProductora(mapped);
                this.dataMode = 'confeccion';
                this.sourceName = 'Portapapeles';
                this._renderMasterGrid(this.confeccionData, 'CONFECCION');
                this._updateUIState(this.confeccionData.length);
                Toast.success('Confección pegada: ' + this.confeccionData.length + ' registro(s).');
                this._confirmarCarga();
            } else if (uploadType === 'PROCESOS') {
                const val = validateMasterHeaders(parsed.headers, 'PROCESOS');
                if (!val.valid) {
                    console.error('[NubeModule][Paste] Headers inválidos Procesos:', parsed.headers, val.error);
                    Toast.error(val.error, 4500);
                    return;
                }
                const mapped = buildMasterJSON(parsed.headers, parsed.grid, 'PROCESOS', parseInt(this.idProductora));
                if (!mapped.length) {
                    console.error('[NubeModule][Paste] Sin registros válidos de Procesos.', { headers: parsed.headers, rows: parsed.grid.length, sampleRow: parsed.grid[0] });
                    Toast.error('No se encontraron registros válidos de Procesos. Verifica que las columnas NumLote, Ref y Total tengan datos.');
                    return;
                }
                this._autoDetectAndSetProductora(mapped, 'PROCESOS');
                this.procesosData = this._reStampProductora(mapped);
                this.dataMode = 'procesos';
                this.sourceName = 'Portapapeles';
                this._renderMasterGrid(this.procesosData, 'PROCESOS');
                this._updateUIState(this.procesosData.length);
                Toast.success('Procesos pegados: ' + this.procesosData.length + ' registro(s).');
                this._confirmarCarga();
            } else if (uploadType === 'EXTENSIONES') {
                // bk2-pegado-extensiones: pegado DIRECTO y tolerante de extensiones.
                // No se bloquea por posiciones estrictas A..L: el mapeo inteligente
                // (autoDetectMapping por nombre de encabezado) y los selectores de la
                // hoja editable permiten corregir el mapeo manualmente.
                const val = validateClipboardPositions(parsed.headers, parsed.grid);
                if (!val.valid) {
                    console.warn('[NubeModule][Paste] Posiciones no estándar; se aplica mapeo automático:', val.error);
                }
                // ── OBLIGATORIOS (regla del negocio): G(6) NUMLOTE · H(7) REF ·
                //    J(9) COLORES · K(10) TALLA · L(11) TOTAL UND. Todo lo demás
                //    (incluido COLOR I(8)) se ignora.
                const faltantes = ['numlote', 'ref', 'colores', 'talla', 'totalUnd']
                    .filter(k => !Object.values(parsed.mapping || {}).includes(k));
                if (faltantes.length) {
                    const nombres = { numlote: 'Numlote (G)', ref: 'Ref (H)', colores: 'Colores (J)', talla: 'Talla (K)', totalUnd: 'Total Und (L)' };
                    console.error('[NubeModule][Paste] Faltan columnas obligatorias:', faltantes, { headers: parsed.headers, mapping: parsed.mapping });
                    Toast.error('Faltan columnas obligatorias: ' + faltantes.map(k => nombres[k]).join(', '), 5000);
                    return;
                }
                this.rawHeaders = parsed.headers;
                this.rawGrid = parsed.grid;
                this.colMapping = parsed.mapping;
                this.dataMode = 'pegar';
                this.sourceName = 'Portapapeles';
                this._renderExcelGrid();
                this._updateUIState(this.rawGrid.length);
                this._confirmarCarga();
                // ── TRAZA DE CONSOLA (solo portapapeles): 2. JSON procesado ──
                console.log('%c════ [NUBE · PORTAPAPELES] 2. JSON PROCESADO (lo que se enviará a la tabla `extensiones` de Supabase) ════', 'font-weight:bold');
                console.log('[NUBE] OPs agrupados:', this.jsonData.length, '· Total extensiones:', this.jsonData.reduce((a, r) => a + (r.extensiones ? r.extensiones.length : 0), 0));
                console.log('[NUBE] jsonData (rows para Supabase):', this.jsonData);
                try { console.table(this.jsonData.flatMap(r => (r.extensiones || []).map(e => ({ op: r.op, referencia: r.referencia, color: e.color, talla: e.talla, cantidad: e.cantidad })))); } catch (_) { }
                Toast.success('Extensiones pegadas: ' + parsed.grid.length + ' fila(s).');
                return;
            } else {
                console.error('[NubeModule][Paste] Formato no reconocido.', { headers: parsed.headers, type: uploadType });
                Toast.error('Formato de encabezados no reconocido. Debe ser: Extensiones, Confección o Procesos.');
            }
        } catch (err) {
            console.error('[NubeModule][Paste] Error inesperado:', err);
            Toast.error('Error al procesar el pegado: ' + (err && err.message ? err.message : 'desconocido'));
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
        // INTERFAZ LIMPIA: las vistas derivadas (lotes/JSON/búsqueda) están desactivadas.
        this._applyViewMode();
    }

    _renderLotes(groups) {
        // INTERFAZ LIMPIA: las tablas de lotes ya no se muestran en pantalla.
        return;
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
        // INTERFAZ LIMPIA: la vista JSON ya no se muestra en pantalla.
        return;
    }

    _updateLotesStats(filtered) {
        // INTERFAZ LIMPIA: las estadísticas de lotes ya no se muestran en pantalla.
        return;
    }

// ── 4b. VENTANA DE CONFIRMACIÓN DE CARGA (cuántos registros va a subir) ──
    _confirmarCarga() {
        let total = 0;
        let tipo = 'registros';
        if (this.dataMode === 'confeccion') {
            total = this.confeccionData.length;
            tipo = 'registro(s) de Confección';
        } else if (this.dataMode === 'procesos') {
            total = this.procesosData.length;
            tipo = 'registro(s) de Procesos';
        } else {
            total = this.jsonData.reduce((a, r) => a + (r.extensiones ? r.extensiones.length : 0), 0);
            tipo = 'extensión(es)';
        }
        if (total <= 0) {
            Toast.warning('No se detectaron registros para subir.');
            return;
        }

        const prod = this.productoraNombre || this.idProductora || '—';
        let confirmado = false;

        Modal.open({
            title: 'Confirmar guardado',
            contentHtml: `
                <div class="nube-confirm-body" style="margin-top:4px;">
                    <p style="margin:0 0 10px;font-size:0.9rem;color:#334155;line-height:1.5;">
                        Se guardarán <strong style="font-size:1.05rem;">${total}</strong> ${tipo}
                        en la productora <strong>${this._escapeHtml(prod)}</strong>.
                    </p>
                    <p style="margin:0 0 16px;font-size:0.85rem;color:#64748b;">
                        Esta acción registrará los datos y no se podrá deshacer.
                    </p>
                    <div class="p-sheet-actions" style="display:flex;gap:10px;justify-content:flex-end;padding:10px 4px 12px;background:transparent;border:none;">
                        <button type="button" class="nube-btn" id="nube-confirm-cancel">Cancelar</button>
                        <button type="button" class="nube-btn nube-btn-primary" id="nube-confirm-ok">Guardar</button>
                    </div>
                </div>`,
            onOpen: (body) => {
                body.querySelector('#nube-confirm-cancel')?.addEventListener('click', () => {
                    confirmado = false;
                    Modal.close(); // onClose descarta los datos
                });
                body.querySelector('#nube-confirm-ok')?.addEventListener('click', () => {
                    confirmado = true;
                    Modal.close();
                    // Esperar la animación de cierre antes de ejecutar el guardado real.
                    setTimeout(async () => {
                        const ok = await this._submitAsentarModal();
                        // Si el guardado falló, los datos siguen en memoria:
                        // se reabre la confirmación para reintentar.
                        if (!ok) setTimeout(() => this._confirmarCarga(), 500);
                    }, 260);
                });
            },
            onClose: () => {
                // Si se cierra sin pulsar Guardar (X / fondo / Cancelar): descartar la carga.
                if (!confirmado) this._clearData();
            }
        });
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

            if (!matrix || matrix.length < 2) {
                Toast.error('El archivo Excel no contiene datos válidos.');
                return;
            }

            const headers = matrix[0] || [];

            // ── PRIORIDAD: Excel de Colección (extensiones) — comportamiento bk1 ──
            // El libro de colección trae encabezados en la fila 2 (matrix[1]):
            //   B Referencia · D OP · M Color · O→AS tallas. Se valida directo
            //   ANTES de la detección maestra para no desviar el archivo a
            //   CONFECCION/PROCESOS por una fila de título en matrix[0].
            const coleccionVal = validateExcelColeccionHeaders(matrix);
            if (coleccionVal.valid) {
                await this._processExtensionesMatrix(matrix, file.name);
                return;
            }

            const uploadType = detectUploadType(headers);

            if (uploadType === 'CONFECCION') {
                await this._processConfeccionMatrix(matrix, file.name);
            } else if (uploadType === 'PROCESOS') {
                await this._processProcesosMatrix(matrix, file.name);
            } else if (uploadType === 'EXTENSIONES') {
                await this._processExtensionesMatrix(matrix, file.name);
            } else {
                // Sin formato master reconocido: si el archivo parecía colección,
                // mostrar el error específico de colección (bk1) en vez del genérico.
                const looksColeccion = /coleccion|colección|programaci/i.test(String(matrix[0] && matrix[0].join(' ') || '') + ' ' + String(matrix[1] && matrix[1].join(' ') || ''));
                if (looksColeccion) Toast.error(coleccionVal.error, 5000);
                else Toast.error('Formato de encabezados no reconocido. Debe ser: Extensiones, Confección o Procesos.');
            }
        } catch (err) {
            console.error('Error al procesar el Excel:', err);
            Toast.error('Error al procesar el Excel: ' + err.message);
        }
    }

    async _processExtensionesMatrix(matrix, fileName) {
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
        this.sourceName = fileName;
        this.rawHeaders = []; this.rawGrid = []; this.colMapping = {};
        this._renderExcelGrid();
        this._refreshDerivedViews();
        Toast.success('Excel procesado: ' + this.jsonData.length + ' OP(s).');
        this._confirmarCarga();
    }

    async _processConfeccionMatrix(matrix, fileName) {
        const headers = matrix[0] || [];
        const grid = matrix.slice(1).filter(row => row.some(c => c !== ''));

        const val = validateMasterHeaders(headers, 'CONFECCION');
        if (!val.valid) {
            Toast.error(val.error, 5000);
            return;
        }

        const mapped = buildMasterJSON(headers, grid, 'CONFECCION', parseInt(this.idProductora));
        if (!mapped.length) {
            Toast.error('No se encontraron registros válidos de Confección.');
            return;
        }

        this._autoDetectAndSetProductora(mapped, 'CONFECCION');
        this.confeccionData = this._reStampProductora(mapped);
        this.dataMode = 'confeccion';
        this.sourceName = fileName;
        this._renderMasterGrid(this.confeccionData, 'CONFECCION');
        this._updateUIState(this.confeccionData.length);
        Toast.success('Confección cargada: ' + this.confeccionData.length + ' registro(s).');
        this._confirmarCarga();
    }

    async _processProcesosMatrix(matrix, fileName) {
        const headers = matrix[0] || [];
        const grid = matrix.slice(1).filter(row => row.some(c => c !== ''));

        const val = validateMasterHeaders(headers, 'PROCESOS');
        if (!val.valid) {
            Toast.error(val.error, 5000);
            return;
        }

        const mapped = buildMasterJSON(headers, grid, 'PROCESOS', parseInt(this.idProductora));
        if (!mapped.length) {
            Toast.error('No se encontraron registros válidos de Procesos.');
            return;
        }

        this._autoDetectAndSetProductora(mapped, 'PROCESOS');
        this.procesosData = this._reStampProductora(mapped);
        this.dataMode = 'procesos';
        this.sourceName = fileName;
        this._renderMasterGrid(this.procesosData, 'PROCESOS');
        this._updateUIState(this.procesosData.length);
        Toast.success('Procesos cargados: ' + this.procesosData.length + ' registro(s).');
        this._confirmarCarga();
    }

    _handleCsvFile(file) {
        if (!this.idProductora) { Toast.warning('Primero seleccione la productora.'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result || '');
                const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim() !== '');
                if (!lines.length) { Toast.error('El archivo CSV está vacío.'); return; }

                const parsed = parseTabularLines(lines);
                if (!parsed || !parsed.grid.length) {
                    Toast.error('El CSV no contiene datos válidos.');
                    return;
                }

                // ── GENERAL_TDM: CSV legacy de Confección (migracion upload.js) ──
                // Headers: OP;InvPlanta;NombrePlanta;FSalidaConf;FEntregaConf;Proceso;
                //          Descripcion;Cuento;Genero;OS;TS;Costo;Ref;Tipo Tejido;pvp
                if (isGeneralTdmHeaders(parsed.headers)) {
                    const mapped = buildGeneralTdmJSON(parsed.headers, parsed.grid, parseInt(this.idProductora));
                    if (!mapped.length) {
                        Toast.error('El CSV GENERAL_TDM no contiene filas válidas (se requiere OP numérica).');
                        return;
                    }
                    // Misma regla que el pegado: si el CUENTO mayoritario de los datos
                    // pertenece a una productora (UNIVERSO / ÁNGELES / HACEMOS MODA),
                    // ésta se auto-detecta y se re-stampa en las filas.
                    this._autoDetectAndSetProductora(mapped, 'CONFECCION');
                    this.confeccionData = this._reStampProductora(mapped);
                    this.dataMode = 'confeccion';
                    this.sourceName = file.name;
                    this._renderMasterGrid(this.confeccionData, 'CONFECCION');
                    this._updateUIState(this.confeccionData.length);
                    Toast.success('CSV Confección (GENERAL_TDM) procesado: ' + this.confeccionData.length + ' registro(s).');
                    this._confirmarCarga();
                    return;
                }

                const uploadType = detectUploadType(parsed.headers);

                if (uploadType === 'CONFECCION') {
                    const val = validateMasterHeaders(parsed.headers, 'CONFECCION');
                    if (!val.valid) {
                        Toast.error(val.error, 4500);
                        return;
                    }
                    const mapped = buildMasterJSON(parsed.headers, parsed.grid, 'CONFECCION', parseInt(this.idProductora));
                    if (!mapped.length) {
                        Toast.error('No se encontraron registros válidos de Confección.');
                        return;
                    }
                    this._autoDetectAndSetProductora(mapped, 'CONFECCION');
                    this.confeccionData = this._reStampProductora(mapped);
                    this.dataMode = 'confeccion';
                    this.sourceName = file.name;
                    this._renderMasterGrid(this.confeccionData, 'CONFECCION');
                    this._updateUIState(this.confeccionData.length);
                    Toast.success('CSV Confección procesado: ' + this.confeccionData.length + ' registro(s).');
                    this._confirmarCarga();
                } else if (uploadType === 'PROCESOS') {
                    const val = validateMasterHeaders(parsed.headers, 'PROCESOS');
                    if (!val.valid) {
                        Toast.error(val.error, 4500);
                        return;
                    }
                    const mapped = buildMasterJSON(parsed.headers, parsed.grid, 'PROCESOS', parseInt(this.idProductora));
                    if (!mapped.length) {
                        Toast.error('No se encontraron registros válidos de Procesos.');
                        return;
                    }
                    this._autoDetectAndSetProductora(mapped, 'PROCESOS');
                    this.procesosData = this._reStampProductora(mapped);
                    this.dataMode = 'procesos';
                    this.sourceName = file.name;
                    this._renderMasterGrid(this.procesosData, 'PROCESOS');
                    this._updateUIState(this.procesosData.length);
                    Toast.success('CSV Procesos procesado: ' + this.procesosData.length + ' registro(s).');
                    this._confirmarCarga();
                } else if (uploadType === 'EXTENSIONES') {
                    const val = validateClipboardPositions(parsed.headers, parsed.grid);
                    if (!val.valid) {
                        Toast.error(val.error, 5000);
                        return;
                    }
                    this.rawHeaders = parsed.headers; this.rawGrid = parsed.grid; this.colMapping = parsed.mapping;
                    this.dataMode = 'csv';
                    this.sourceName = file.name;
                    this._renderExcelGrid();
                    this._updateUIState(this.rawGrid.length);
                    this._refreshDerivedViews();
                    Toast.success('CSV Extensiones procesado.');
                    this._confirmarCarga();
                } else {
                    Toast.error('Formato de encabezados no reconocido. Debe ser: Extensiones, Confección o Procesos.');
                }
            } catch (err) {
                console.error('Error al procesar el CSV:', err);
                Toast.error('Error al procesar el CSV: ' + err.message);
            }
        };
        reader.onerror = () => Toast.error('Error al leer el archivo.');
        reader.readAsText(file);
    }

    _renderMasterGrid(data, type) {
        const zone = this.$('nubeExcelZone');
        if (!zone) return;

        // INTERFAZ LIMPIA: jamás se pinta la tabla de datos cargados (Confección/Procesos).
        zone.innerHTML = this._buildEmptyStateHtml();
        this._setupGridEvents(zone);
        this._applyViewMode();
    }

    async _submitAsentarModal() {
        if (!this.idProductora) {
            Toast.warning('Primero seleccione la productora.');
            return false;
        }

        let payload;
        let syncUseCase;

        if (this.dataMode === 'confeccion' && this.confeccionData.length) {
            // ── Doble guardia: re-validar productora por CUENTO antes de asentar ──
            this._autoDetectAndSetProductora(this.confeccionData, 'CONFECCION');
            this.confeccionData = this._reStampProductora(this.confeccionData);
            payload = {
                rows: this._deduplicateMasterRows(this.confeccionData),
                idProductora: this.idProductora,
                productoraNombre: this.productoraNombre,
                usuarioNombre: this._userNombre()
            };
            syncUseCase = this.syncConfeccionUseCase;
        } else if (this.dataMode === 'procesos' && this.procesosData.length) {
            // ── Doble guardia: re-validar productora por CUENTO antes de asentar ──
            this._autoDetectAndSetProductora(this.procesosData, 'PROCESOS');
            this.procesosData = this._reStampProductora(this.procesosData);
            payload = {
                rows: this._deduplicateMasterRows(this.procesosData),
                idProductora: this.idProductora,
                productoraNombre: this.productoraNombre,
                usuarioNombre: this._userNombre()
            };
            syncUseCase = this.syncProcesosUseCase;
        } else if (this.jsonData.length) {
            // ── TRAZA DE CONSOLA (solo portapapeles): 3. PAYLOAD ANTES DE ENVIAR A SUPABASE ──
            if (this.dataMode === 'pegar') {
                const _tracePayload = {
                    rows: this.jsonData,
                    idProductora: this.idProductora,
                    productora: this.productoraNombre,
                    usuarioEmail: this._userEmail()
                };
                console.log('%c════ [NUBE · PORTAPAPELES] 3. PAYLOAD A SUPABASE (se envía justo después de esta traza) ════', 'font-weight:bold');
                console.log('[NUBE] Destino: Edge Function /nube → tabla `extensiones` (guardarProgramacion)');
                console.log('[NUBE] Productora:', this.idProductora, '—', this.productoraNombre);
                console.log('[NUBE] OPs:', this.jsonData.length, '· Total extensiones:', this.jsonData.reduce((a, r) => a + (r.extensiones ? r.extensiones.length : 0), 0));
                console.log('[NUBE] Payload completo:', _tracePayload);
                try { console.log('[NUBE] Payload JSON:\n' + JSON.stringify(_tracePayload, null, 2)); } catch (_) { }
                try { console.table(this.jsonData.flatMap(r => (r.extensiones || []).map(e => ({ op: r.op, referencia: r.referencia, color: e.color, talla: e.talla, cantidad: e.cantidad })))); } catch (_) { }
            }
            payload = {
                rows: this.jsonData,
                idProductora: this.idProductora,
                productora: this.productoraNombre,
                usuarioEmail: this._userEmail(),
                // Los uploads se registran con el NOMBRE real del usuario (no el correo).
                usuarioNombre: this._userNombre()
            };
            syncUseCase = this.guardarProgramacionUseCase;
        } else {
            Toast.warning('No hay datos para guardar.');
            return false;
        }

        try {
            const result = await syncUseCase.execute(payload);
            if (this.dataMode === 'pegar') {
                // ── TRAZA DE CONSOLA (solo portapapeles): 4. Respuesta de Supabase ──
                console.log('%c════ [NUBE · PORTAPAPELES] 4. RESPUESTA DE SUPABASE ════', 'font-weight:bold');
                console.log('[NUBE] Resultado:', result);
            }
            if (result.success) {
                Toast.success(result.message || 'Datos guardados correctamente.');
                await this._cargarResumen();
                this._clearData();
                return true;
            } else {
                Toast.error(result.message || 'Error al guardar datos.');
                return false;
            }
        } catch (err) {
            console.error('Error al guardar:', err);
            Toast.error('Error al guardar: ' + err.message);
            return false;
        }
    }

    /**
     * Detecta la productora correcta desde la columna CUENTO de los registros
     * y actualiza this.idProductora / this.productoraNombre si corresponde.
     * Solo cambia automáticamente para ADMIN/MODERATOR. Para otros roles,
     * solo emite una advertencia si hay discrepancia.
     *
     * @param {Array}  rows - Filas mapeadas con campo cuento
     * @param {string} tipo - 'CONFECCION' o 'PROCESOS'
     * @returns {boolean} true si se realizó un cambio de productora
     */
    _autoDetectAndSetProductora(rows, tipo) {
        const detected = detectProductoraDesdeCuento(rows, this.productoras);
        if (!detected) return false;

        const yaCoincide = detected.idProductora === String(this.idProductora);
        if (yaCoincide) return false;

        const role = String(this._userRole()).toUpperCase();
        const isAdmin = role === 'ADMIN' || role === 'MODERATOR' || role === 'SUPERADMIN';
        const tipo_label = tipo === 'CONFECCION' ? 'Confección' : 'Procesos';

        if (isAdmin) {
            // Cambiar productora automáticamente
            const anterior = this.productoraNombre || this.idProductora || '(sin seleccionar)';
            this.idProductora = detected.idProductora;
            this.productoraNombre = detected.productoraNombre;

            // Actualizar el <select> de productoras
            const sel = this.$('nubeProveedor');
            if (sel) sel.value = this.idProductora;
            this._syncProductoraUI();

            console.info(
                `[NubeModule][AutoDetect][${tipo_label}] Productora cambiada: "${anterior}" → "${detected.productoraNombre}" (CUENTO mayoritario en datos)`
            );
            Toast.info(
                `Productora detectada automáticamente por CUENTO: ${detected.productoraNombre}`,
                4000
            );
            return true;
        } else {
            // Solo advertir — no cambiar productora fija del usuario
            console.warn(
                `[NubeModule][AutoDetect][${tipo_label}] Discrepancia: productora seleccionada "${this.productoraNombre}" vs detectada por CUENTO "${detected.productoraNombre}"`
            );
            Toast.warning(
                `⚠️ Los datos de ${tipo_label} parecen pertenecer a "${detected.productoraNombre}" (detectado por CUENTO), pero está seleccionada "${this.productoraNombre || 'otra'}". Verifique antes de asentar.`,
                6000
            );
            return false;
        }
    }

    /**
     * Re-stampa id_productora y productora en cada fila usando los valores
     * actuales de this.idProductora / this.productoraNombre.
     * Se usa tras _autoDetectAndSetProductora() para que los rows queden
     * consistentes con la productora que realmente se va a guardar.
     *
     * @param {Array} rows
     * @returns {Array} copia de rows con id_productora y productora actualizados
     */
    _reStampProductora(rows) {
        if (!rows || !rows.length) return rows;
        const idProd = this.idProductora;
        const nombreProd = this.productoraNombre;
        return rows.map(r => ({
            ...r,
            id_productora: idProd,
            productora: nombreProd
        }));
    }

    _deduplicateMasterRows(rows) {
        const seen = new Set();
        const result = [];
        for (const r of rows) {
            const key = `${r.id_master}|${r.productora}|${r.proceso}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(r);
            }
        }
        return result;
    }

    _clearData() {
        this.jsonData = [];
        this.confeccionData = [];
        this.procesosData = [];
        this.rawHeaders = [];
        this.rawGrid = [];
        this.colMapping = {};
        this.dataMode = '';
        this.sourceName = '';
        this.viewMode = 'lotes';
        this._cargaConfirmada = false;
        const filterInput = this.$('nubeFilterOp');
        if (filterInput) filterInput.value = '';
        this._renderExcelGrid();
        this._refreshDerivedViews();
        Toast.success('Todos los datos fueron limpiados.');
    }
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

    _normProcesoClave(p) {
        // Normaliza el valor de proceso para clasificar Confección/Procesos
        // (mayúsculas, espacios y tildes → 'CONFECCION').
        return String(p || '').toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    async _cargarResumen() {
        // Resumen con FILTRO POR ROL (regla de negocio):
        //  · USER-P (producción, amarrado a una productora): SOLO su productora.
        //  · Usuarios superiores (ADMIN/MODERATOR/...): TODAS las productoras.
        // UNA sola llamada y SIEMPRE actual (cache: no-store en el adaptador).
        const esUserP = this._isUserP();
        const filtroProductora = esUserP
            ? (String(this._userProductoraId() ?? '').trim() || this.idProductora || '')
            : '';

        try {
            const data = await this.resumenProgramacionUseCase.execute({
                idProductora: filtroProductora || null,
                limitRows: 5000
            });

            if (data && Array.isArray(data.extensiones)) {
                let ext = data.extensiones;
                let conf = Array.isArray(data.confeccion) ? data.confeccion : [];
                let proc = Array.isArray(data.procesos) ? data.procesos : [];

                // Si un RPC de resumen específico no trajo datos, reconstruir
                // desde las filas AQUÍ MISMO (se mantiene una sola llamada),
                // clasificando Confección/Procesos con proceso normalizado.
                const rows = (data && data.rows && typeof data.rows === 'object') ? data.rows : {};
                const confRows = Array.isArray(rows.confeccion) ? rows.confeccion : [];
                const procRows = Array.isArray(rows.procesos) ? rows.procesos : [];
                if (!conf.length && confRows.length) {
                    conf = this._buildResumenFromMasterRows(
                        confRows.filter(r => this._normProcesoClave(r.proceso) === 'CONFECCION')
                    );
                }
                if (!proc.length && procRows.length) {
                    proc = this._buildResumenFromMasterRows(
                        procRows.filter(r => this._normProcesoClave(r.proceso) !== 'CONFECCION')
                    );
                }

                this._renderResumenSection('Extensiones', ext, 'nubeResumenTbodyExtensiones', 'nubeResumenEmptyExtensiones', 'badge-count-extensiones');
                this._renderResumenSection('Confección', conf, 'nubeResumenTbodyConfeccion', 'nubeResumenEmptyConfeccion', 'badge-count-confeccion');
                this._renderResumenSection('Procesos', proc, 'nubeResumenTbodyProcesos', 'nubeResumenEmptyProcesos', 'badge-count-procesos');
                return;
            }

            // Formato antiguo { resumen, ultima } (Edge Function sin RESUMEN_COMPLETO)
            this._renderResumen(data);
        } catch (err) {
            console.error('[NubeModule][Resumen] Error al cargar el resumen:', err?.message || err);
            Toast.error('Error al cargar el resumen: ' + (err?.message || err));
        }
    }

    _buildResumenFromMasterRows(rows) {
        if (!rows || !rows.length) return [];
        const grupos = new Map();
        for (const r of rows) {
            const key = String(r.productora || r.id_productora || '—');
            if (!grupos.has(key)) {
                grupos.set(key, {
                    productora: key,
                    id_productora: r.productora || r.id_productora,
                    registros: 0,
                    ultima_modificacion: r.updated_at || r.ultima_modificacion || '',
                    usuario: r.usuario || '—'
                });
            }
            const g = grupos.get(key);
            g.registros++;
            const current = r.updated_at || r.ultima_modificacion || '';
            if (current > g.ultima_modificacion) {
                g.ultima_modificacion = current;
                g.usuario = r.usuario || '—';
            }
        }
        return Array.from(grupos.values()).sort((a, b) => String(b.ultima_modificacion || '').localeCompare(String(a.ultima_modificacion || '')));
    }

    _renderResumen(data) {
        // 1. Extensiones
        const resumenExt = (data && Array.isArray(data.resumen)) ? data.resumen : ((data && Array.isArray(data.extensiones)) ? data.extensiones : []);
        this._renderResumenSection('Extensiones', resumenExt, 'nubeResumenTbodyExtensiones', 'nubeResumenEmptyExtensiones', 'badge-count-extensiones');

        // 2. Confección y 3. Procesos se cargan por separado en _cargarResumen
    }

    _rowsDeMiProductora(rows) {
        // Filas del editor (confección/procesos) limitadas a la productora
        // seleccionada. Necesario ahora que el resumen trae TODAS las productoras.
        if (!Array.isArray(rows)) return [];
        if (!this.idProductora) return rows;
        return rows.filter(r => String(r.id_productora ?? r.id_prod ?? '') === String(this.idProductora));
    }

    _resumenVisiblePorRol(list) {
        // Agrupación de tarjetas por productora según el ROL (regla de negocio):
        //  · USER-P: SOLO la tarjeta de su productora (en ceros si aún no tiene
        //    registros), nunca las demás.
        //  · Usuarios superiores (y cualquier otro rol): TODAS las productoras,
        //    agrupadas y ordenadas por la modificación más reciente.
        const rows = Array.isArray(list) ? list : [];
        const porReciente = (arr) => arr.slice().sort((a, b) =>
            String(b.ultima_modificacion || '').localeCompare(String(a.ultima_modificacion || '')));

        if (!this._isUserP()) return porReciente(rows);

        const uid = String(this._userProductoraId() ?? '').trim();
        const uname = String(this._userProductoraName() || '').toUpperCase().trim();
        const mine = rows.filter(r => {
            const rid = String(r.id_productora ?? '').trim();
            const rname = String(r.productora || '').toUpperCase().trim();
            return (uid && rid === uid) || (!!uname && rname === uname);
        });
        if (mine.length) return porReciente(mine);

        // Su productora aún sin registros → tarjeta propia en ceros.
        if (uid || uname) {
            return [{
                id_productora: uid || uname,
                productora: uname || uid,
                registros: 0,
                ultima_modificacion: '',
                usuario: '—'
            }];
        }
        return [];
    }

    _renderResumenSection(type, list, tbodyId, emptyId, badgeId) {
        const tbody = this.$(tbodyId);
        const empty = this.$(emptyId);
        const badge = this.$(badgeId);

        // Tarjetas por productora según rol (_resumenVisiblePorRol filtra para USER-P).
        list = this._resumenVisiblePorRol(list);

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

}