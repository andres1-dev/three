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
    jsonDataToGroups
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
    _userNombre() { const u = this._user(); const m = u.raw_user_meta_data || u.user_metadata || {}; return u.full_name || m.full_name || u.displayName || u.nombre || u.email || u.correo || ''; }
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
        await this._cargarProductoras();
        this._renderExcelGrid();
        this._cargarResumen();
    }

    unmount() {
        if (this._docPaste) { document.removeEventListener('paste', this._docPaste); this._docPaste = null; }
        if (this.container) this.container.innerHTML = '';
        this.container = null;
    }

    _render() {
        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn" id="btn-nube-back" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <h1 class="page-title">Nube · Programación</h1>
            </div>

            <div class="nube-toolbar">
                <label class="nube-prov-label">
                    <span>Productora</span>
                    <select id="nubeProveedor" class="nube-prov-select" aria-label="Productora">
                        <option value="">Seleccione...</option>
                    </select>
                </label>
            </div>

            <div class="nube-actions" id="nubeActions">
                <button id="btnNubeAsentar" class="nube-btn nube-btn-primary" disabled title="Guardar registros en la tabla extensiones"><span>Asentar</span></button>
                <button id="btnNubeSave" class="nube-btn" disabled title="Exportar datos a CSV">Exportar CSV</button>
                <button id="btnNubeCopyJSON" class="nube-btn" disabled>Copiar JSON</button>
                <button id="btnNubeClear" class="nube-btn" disabled>Limpiar</button>
                <button id="btnNubeToggleSheet" class="nube-btn" disabled>Ver Plano</button>
                <button id="btnNubeToggleJson" class="nube-btn" disabled>Ver JSON</button>
            </div>

            <div id="nubeResumenPanel" class="nube-resumen-panel">
                <div class="nube-resumen-head">Última actualización por productora</div>
                <table class="nube-resumen-table">
                    <thead>
                        <tr>
                            <th>Productora</th>
                            <th>Registros</th>
                        </tr>
                    </thead>
                    <tbody id="nubeResumenTbody"></tbody>
                </table>
                <div id="nubeResumenEmpty" class="nube-resumen-empty">Sin registros guardados todavía.</div>
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
        `;
    }

    _bindEvents() {
        // Volver
        this.container.querySelector('#btn-nube-back')?.addEventListener('click', () => {
            this.router.navigate('apps');
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
            const found = this.productoras.find(p => String(p.id_productora ?? p.nit ?? p.id ?? '') === String(sel.value));
            this.idProductora = found ? String(found.id_productora ?? found.nit ?? found.id ?? '') : '';
            this.productoraNombre = found ? String(found.productora || found.nombre_corto || '').toUpperCase() : '';
            this._renderExcelGrid();
            this._updateUIState(this.rawGrid.length);
        });

        // Preselección según el usuario autenticado:
        //  - Usuario normal con productora asignada → se selecciona de una vez y queda bloqueada.
        //  - ADMIN / MODERATOR (o sin productora) → puede seleccionar siempre (la propia queda preseleccionada).
        const userMeta = (this._user().raw_user_meta_data || this._user().user_metadata || {});
        const role = String(userMeta.role || this._user().role || '').toUpperCase();
        const isAdmin = role === 'ADMIN' || role === 'MODERATOR';
        const userProdId = userMeta.id_productora != null ? String(userMeta.id_productora) : '';
        const userProdName = String(userMeta.productora || '').trim();

        let foundUser = userProdId ? this.productoras.find(p => String(p.id_productora ?? p.nit ?? p.id ?? '') === userProdId) : null;

        // Si la productora del perfil no viene en el listado, inyectarla para que el nombre se muestre.
        if (userProdId && !foundUser && userProdName) {
            foundUser = { id_productora: userProdId, productora: userProdName };
            this.productoras.push(foundUser);
            sel.insertAdjacentHTML('beforeend',
                `<option value="${this._escapeHtml(userProdId)}">${this._escapeHtml(userProdName.toUpperCase())}</option>`);
        }

        if (foundUser) {
            this.idProductora = String(foundUser.id_productora ?? foundUser.nit ?? foundUser.id ?? '');
            this.productoraNombre = String(foundUser.productora || foundUser.nombre_corto || '').toUpperCase();
            sel.value = this.idProductora;
            if (!isAdmin) {
                sel.disabled = true;
                sel.title = 'Productora asignada a tu usuario';
            }
            this._renderExcelGrid();
            this._updateUIState(this.rawGrid.length);
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
        const resumen = (data && Array.isArray(data.resumen)) ? data.resumen : [];
        const ultima = (data && data.ultima) || null;
        const tbody = this.$('nubeResumenTbody');
        const empty = this.$('nubeResumenEmpty');
        if (!resumen.length && !ultima) {
            if (tbody) tbody.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        if (tbody) {
            tbody.innerHTML = resumen.map(r => {
                const name = r.productora || r.id_productora || '—';
                return '<tr>' +
                    '<td>' +
                        '<div class="nube-resumen-prod">' + this._escapeHtml(name) + '</div>' +
                        '<div class="nube-resumen-user">' + this._escapeHtml(r.usuario || '—') + '</div>' +
                        '<div class="nube-resumen-fecha">' + this._fmtFecha(r.ultima_modificacion) + '</div>' +
                    '</td>' +
                    '<td class="num">' + (Number(r.registros) || 0) + '</td>' +
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