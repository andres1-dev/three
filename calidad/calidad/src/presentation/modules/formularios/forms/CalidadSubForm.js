import { Toast } from '../../../components/Toast.js';
import { MediaDropzone } from '../components/MediaDropzone.js';
import { AqlModal } from '../components/AqlModal.js';
import { LoteSelectorCard } from '../components/LoteSelectorCard.js';
import { generarTextoPlantillaCalidad } from '../utils/plantillasCalidad.js';

export class CalidadSubForm {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Object} options.activeLote
     * @param {Array} options.lotes
     * @param {Object} options.submitUseCase
     * @param {Object} options.currentUser
     * @param {Function} options.onBack
     * @param {Function} options.onSuccess
     */
    constructor({
        container,
        activeLote = null,
        lotes = [],
        productoras = [],
        selectedProductora = '',
        onSearchLotes = null,
        onProductoraChange = null,
        submitUseCase,
        currentUser = null,
        onBack = null,
        onSuccess = null
    }) {
        this.container = container;
        this.activeLote = activeLote;
        this.lotes = lotes;
        this.productoras = productoras;
        this.selectedProductora = selectedProductora;
        this.onSearchLotes = onSearchLotes;
        this.onProductoraChange = onProductoraChange;
        this.submitUseCase = submitUseCase;
        this.currentUser = currentUser;
        this.onBack = onBack;
        this.onSuccess = onSuccess;

        this.dropzone = null;
        this.loteSelector = null;
        this.novedadesAgregadas = []; // Lista de novedades reportadas en la auditoría
        this.gpsData = { lat: null, lng: null, enabled: true };
        this.firmaCanvas = null;
        this.firmaCtx = null;
        this.haFirmado = false;

        this.aqlConfig = {
            nivel: 'II',
            aqlNivel: '4.0',
            muestra: 0,
            ac: 0,
            re: 1,
            letra: 'A'
        };

        this._render();
    }

    setLotes(lotes) {
        this.lotes = lotes || [];
        if (this.loteSelector) this.loteSelector.setLotes(this.lotes);
    }

    setProductoras(productoras) {
        this.productoras = productoras || [];
        if (this.loteSelector) this.loteSelector.setProductoras(this.productoras);
    }

    setLote(lote) {
        this.activeLote = lote;
        if (this.loteSelector) this.loteSelector.setActiveLote(lote);
        this._recalcAQL();
        this._actualizarVisibilidadCondicional();
        this._actualizarMapaPlanta();
    }

    _render() {
        const userEmail = this.currentUser?.email || this.currentUser?.correo || '';

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn" id="btn-back-to-hub" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Calidad</h1>
            </div>

            <!-- Selector de Lote Integrado -->
            <div id="cal-lote-mount" class="f-mount-section"></div>

            <form id="form-calidad-full" class="f-subform-body">
                <!-- 1. LOCALIZACIÓN GPS Y MAPA -->
                <div class="f-section-title">
                    <span class="pill-num">1</span>
                    <span>Localización GPS en Planta</span>
                </div>

                <div class="f-gps-container">
                    <div class="f-gps-header">
                        <div class="f-gps-status-box">
                            <span class="f-gps-dot active" id="gps-dot"></span>
                            <span class="f-gps-text" id="gps-status-label">Obteniendo señal GPS...</span>
                        </div>
                        <div class="f-gps-actions">
                            <button type="button" class="f-btn-refresh-gps" id="btn-refresh-gps" title="Actualizar ubicación">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Contenedor del Mapa Visual -->
                    <div id="mapa-calidad-frame-wrap" class="f-map-wrap">
                        <div id="map-placeholder" class="f-map-loading">
                            <span class="f-spinner"></span>
                            <span>Cargando mapa de ubicación...</span>
                        </div>
                    </div>
                </div>

                <!-- 2. CORREO Y TIPO DE VISITA -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">2</span>
                    <span>Datos de la Auditoría</span>
                </div>

                <div class="f-form-grid">
                    <div class="f-form-group">
                        <label class="f-label">Correo del Auditor <span class="req">*</span></label>
                        <input type="email" id="cal-email" class="f-input" value="${userEmail}" placeholder="auditor@grupotdm.com" required />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Tipo de Visita <span class="req">*</span></label>
                        <select id="cal-tipo-visita" class="f-select" required>
                            <option value="">Seleccione tipo...</option>
                            <option value="AUDITORIA" selected>AUDITORÍA</option>
                            <option value="RONDA">RONDA</option>
                            <option value="CONTRAMUESTRA">CONTRAMUESTRA</option>
                            <option value="SEGUIMIENTO">SEGUIMIENTO</option>
                        </select>
                    </div>
                </div>

                <!-- 3. MUESTREO AQL (ISO 2859-1) -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">3</span>
                    <span>Muestreo AQL (ISO 2859-1)</span>
                </div>

                <div class="f-aql-full-card" id="btn-trigger-aql-modal">
                    <div class="f-aql-card-top">
                        <div class="f-aql-badge-title">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <span>Regla de Muestreo</span>
                        </div>
                        <span class="f-aql-open-hint">Configurar / Ver detalle →</span>
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
                </div>

                <!-- 4. CONCLUSIÓN Y DICTAMEN -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">4</span>
                    <span>Conclusión de la Inspección</span>
                </div>

                <div class="f-form-group">
                    <label class="f-label">Conclusión del Lote <span class="req">*</span></label>
                    <select id="cal-conclusion" class="f-select" required>
                        <option value="">Seleccione una conclusión...</option>
                        <option value="APROBADO" selected>APROBADO</option>
                        <option value="RECHAZADO">RECHAZADO</option>
                        <option value="PAUSADO">PAUSADO</option>
                    </select>
                </div>

                <!-- 5. DESTINO DEL LOTE (Visible solo si es AUDITORIA y APROBADO) -->
                <div id="cal-destino-section" class="f-cond-section" style="display:none; margin-top: 16px;">
                    <div class="f-cond-header">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>Destino del Lote</span>
                    </div>

                    <div class="f-form-grid">
                        <div class="f-form-group">
                            <label class="f-label">¿Para dónde va el lote?</label>
                            <select id="cal-destino-tipo" class="f-select">
                                <option value="">Seleccione destino...</option>
                                <option value="CDI" selected>CDI (Centro de Distribución)</option>
                                <option value="PROCESO">Otro Proceso / Taller</option>
                            </select>
                        </div>

                        <div class="f-form-group" id="cal-destino-proceso-wrap" style="display:none;">
                            <label class="f-label">Proceso de Destino</label>
                            <select id="cal-destino-proceso" class="f-select">
                                <option value="">Seleccione...</option>
                                <option value="CONFECCION">CONFECCIÓN</option>
                                <option value="ESTAMPADO">ESTAMPADO</option>
                                <option value="OJAL Y BOTON">OJAL Y BOTÓN</option>
                                <option value="BOTONADO">BOTONADO</option>
                                <option value="TRANSFER">TRANSFER</option>
                                <option value="OJALETE">OJALETE</option>
                                <option value="APLIQUE">APLIQUE</option>
                                <option value="RESORTADO">RESORTADO</option>
                                <option value="FUSIONADO">FUSIONADO</option>
                                <option value="LAVADO">LAVADO</option>
                                <option value="OTROS">OTROS (Especificar...)</option>
                            </select>
                        </div>

                        <div class="f-form-group full" id="cal-destino-otro-wrap" style="display:none;">
                            <label class="f-label">Especifique el Otro Proceso</label>
                            <input type="text" id="cal-destino-otro-text" class="f-input" placeholder="Nombre del proceso de destino..." />
                        </div>

                        <div class="f-form-group full" id="cal-destino-planta-wrap" style="display:none;">
                            <label class="f-label">¿A qué planta / taller se envía?</label>
                            <input type="text" id="cal-destino-planta-input" class="f-input" placeholder="Nombre de la planta o taller..." />
                        </div>
                    </div>
                </div>

                <!-- 6. AVANCE DE PRODUCCIÓN (Visible solo en RONDA y CONTRAMUESTRA) -->
                <div id="cal-avance-section" class="f-cond-section" style="display:none; margin-top: 16px;">
                    <div class="f-cond-header">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"/>
                            <line x1="12" y1="20" x2="12" y2="4"/>
                            <line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                        <span>Avance de Producción</span>
                    </div>

                    <div class="f-range-advanced">
                        <div class="f-range-top-row">
                            <span class="lbl">Porcentaje de Avance Físico:</span>
                            <span class="val" id="cal-avance-badge">0%</span>
                        </div>
                        <input type="range" id="cal-slider-avance" min="0" max="100" step="5" value="0" class="f-range-track" />
                        <div class="f-range-ticks">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                <!-- 7. NOVEDADES DE AUDITORÍA ASOCIADAS (Visible en AUDITORÍA) -->
                <div id="cal-novedades-section" class="f-cond-section" style="margin-top: 16px;">
                    <div class="f-cond-header" style="justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <span>Novedades del Lote (Cobros, Promociones, Sin Confeccionar)</span>
                        </div>
                        <button type="button" class="f-btn-add-nov" id="btn-open-modal-novedad-cal">+ Reportar Novedad</button>
                    </div>

                    <div id="cal-novedades-cards-list" class="f-nov-cards-list">
                        <div class="f-empty-nov-hint">Sin novedades reportadas para este lote.</div>
                    </div>
                </div>

                <!-- 8. OBSERVACIONES Y PLANTILLA INTELIGENTE -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">5</span>
                    <span>Observaciones y Dictamen Técnico</span>
                </div>

                <div class="f-obs-wrap">
                    <div class="f-obs-tools">
                        <button type="button" class="f-btn-tool" id="btn-generar-plantilla">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            <span>Autogenerar Plantilla</span>
                        </button>
                    </div>
                    <textarea id="cal-observaciones-text" class="f-textarea" rows="4" placeholder="Detalle los hallazgos encontrados, costuras, tolerancias y motivos de la decisión..." required></textarea>
                </div>

                <!-- 9. SOPORTE Y FOTOS MÚLTIPLES -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">6</span>
                    <span>Soporte / Evidencias Fotográficas</span>
                </div>
                <div id="cal-dropzone-mount"></div>

                <!-- 10. FIRMA DIGITAL INTEGRADA -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">7</span>
                    <span>Firma de Validación del Auditor</span>
                </div>

                <div class="f-inline-signature-box">
                    <div class="f-sig-canvas-header">
                        <span class="f-sig-title">Firme en el recuadro para validar el reporte:</span>
                        <button type="button" class="f-btn-clear-sig-inline" id="btn-clear-sig-inline">Borrar Firma</button>
                    </div>
                    <div class="f-sig-canvas-inner">
                        <canvas id="cal-inline-sig-canvas" width="400" height="160"></canvas>
                        <div class="f-sig-baseline"></div>
                    </div>
                </div>

                <!-- 11. BOTONES DE ACCIÓN -->
                <div class="f-submit-footer-row">
                    <button type="button" class="f-btn-reset-form" id="btn-limpiar-calidad">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                        </svg>
                        <span>Limpiar</span>
                    </button>
                    <button type="submit" class="f-btn-submit-main" id="btn-submit-calidad-final">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        <span>Enviar Auditoría</span>
                    </button>
                </div>
            </form>

            <!-- Modal Novedades de Calidad (Sin Confeccionar, Cobros, Promociones...) -->
            <div id="cal-modal-novedad-dialog" class="f-modal-backdrop">
                <div class="f-modal-sheet" style="max-width: 520px;">
                    <div class="f-sheet-header">
                        <div class="f-sheet-pill"></div>
                        <div class="f-sheet-title-row">
                            <div class="f-sheet-title-icon aql">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="f-sheet-title">Reportar Novedad de Calidad</h3>
                                <p class="f-sheet-subtitle">Agregue cobros o prendas no conformes</p>
                            </div>
                        </div>
                    </div>

                    <div class="f-sheet-body">
                        <div class="f-form-group">
                            <label class="f-label">Tipo de Novedad <span class="req">*</span></label>
                            <select id="modal-nov-tipo" class="f-select">
                                <option value="">Seleccione tipo...</option>
                                <option value="SIN CONFECCIONAR">SIN CONFECCIONAR</option>
                                <option value="PROMOCIONES">PROMOCIONES</option>
                                <option value="COBROS">COBROS</option>
                                <option value="LAVADO">LAVADO</option>
                            </select>
                        </div>

                        <!-- Checkbox Sin Proceso -->
                        <div class="f-checkbox-row" id="modal-sin-proceso-wrap" style="display:none; margin-top:10px;">
                            <label class="f-checkbox-lbl">
                                <input type="checkbox" id="modal-check-sin-proceso" />
                                <span>MARCAR COMO SIN PROCESO (no se cobrarán en este proceso)</span>
                            </label>
                        </div>

                        <!-- Checkbox Cobro Proceso Anterior -->
                        <div id="modal-proceso-anterior-wrap" style="display:none; margin-top:10px;">
                            <label class="f-checkbox-lbl">
                                <input type="checkbox" id="modal-check-proceso-anterior" />
                                <span>PROCESO ANTERIOR (cobro a un proceso previo)</span>
                            </label>
                            <div id="modal-select-proceso-cobro" style="display:none; margin-top:8px;">
                                <label class="f-label">Seleccione el proceso:</label>
                                <select id="modal-cobro-proceso-val" class="f-select">
                                    <option value="CONFECCION">CONFECCIÓN</option>
                                    <option value="ESTAMPADO">ESTAMPADO</option>
                                    <option value="OJAL Y BOTON">OJAL Y BOTÓN</option>
                                    <option value="BOTONADO">BOTONADO</option>
                                    <option value="TRANSFER">TRANSFER</option>
                                    <option value="LAVADO">LAVADO</option>
                                    <option value="FUSIONADO">FUSIONADO</option>
                                    <option value="OTROS">OTROS</option>
                                </select>
                            </div>
                        </div>

                        <!-- Lista de Códigos / Tallas / Unidades -->
                        <div class="f-modal-codes-section" style="margin-top:16px;">
                            <div class="f-modal-codes-header">
                                <span class="f-label" style="margin:0;">Unidades Afectadas</span>
                                <button type="button" class="f-btn-add-item" id="btn-modal-add-code">+ Añadir Talla/Color</button>
                            </div>
                            <div id="modal-codes-list" class="f-codes-list"></div>
                        </div>
                    </div>

                    <div class="f-sheet-footer">
                        <button type="button" class="f-btn-secondary" id="btn-close-nov-modal">Cancelar</button>
                        <button type="button" class="f-btn-primary" id="btn-save-nov-modal">Guardar Novedad</button>
                    </div>
                </div>
            </div>
        `;

        // 1. Instanciar Selector de Lote On-Demand
        const loteMount = this.container.querySelector('#cal-lote-mount');
        this.loteSelector = new LoteSelectorCard({
            container: loteMount,
            productoras: this.productoras,
            selectedProductora: this.selectedProductora,
            onSearchLotes: this.onSearchLotes,
            onProductoraChange: this.onProductoraChange,
            onSelectLote: (lote) => this.setLote(lote)
        });

        if (this.activeLote) {
            this.loteSelector.setActiveLote(this.activeLote);
        }

        // 2. Instanciar Dropzone
        const dropMount = this.container.querySelector('#cal-dropzone-mount');
        this.dropzone = new MediaDropzone({
            container: dropMount,
            maxFiles: 8
        });

        // 3. Inicializar Firma
        this._initFirmaCanvas();

        // 4. Iniciar GPS y Mapa
        this._initGPS();

        // 5. Vincular Eventos
        this._bindEvents();
        this._recalcAQL();
        this._actualizarVisibilidadCondicional();
    }

    _bindEvents() {
        // Volver al Menú
        this.container.querySelector('#btn-back-to-hub')?.addEventListener('click', () => {
            if (typeof this.onBack === 'function') this.onBack();
        });

        // Cambio de Tipo de Visita y Conclusión
        this.container.querySelector('#cal-tipo-visita')?.addEventListener('change', () => {
            this._actualizarVisibilidadCondicional();
            this._actualizarPlantillaObservaciones();
        });

        this.container.querySelector('#cal-conclusion')?.addEventListener('change', () => {
            this._actualizarVisibilidadCondicional();
            this._actualizarPlantillaObservaciones();
        });

        // Destino tipo cambio
        this.container.querySelector('#cal-destino-tipo')?.addEventListener('change', (e) => {
            const isProceso = e.target.value === 'PROCESO';
            const pWrap = this.container.querySelector('#cal-destino-proceso-wrap');
            const plWrap = this.container.querySelector('#cal-destino-planta-wrap');
            if (pWrap) pWrap.style.display = isProceso ? 'flex' : 'none';
            if (plWrap) plWrap.style.display = isProceso ? 'flex' : 'none';
        });

        this.container.querySelector('#cal-destino-proceso')?.addEventListener('change', (e) => {
            const isOtro = e.target.value === 'OTROS';
            const oWrap = this.container.querySelector('#cal-destino-otro-wrap');
            if (oWrap) oWrap.style.display = isOtro ? 'flex' : 'none';
        });

        // Slider de Avance
        const slider = this.container.querySelector('#cal-slider-avance');
        const badge = this.container.querySelector('#cal-avance-badge');
        slider?.addEventListener('input', () => {
            if (badge) badge.textContent = `${slider.value}%`;
            this._actualizarPlantillaObservaciones();
        });

        // Botón AQL Modal
        this.container.querySelector('#btn-trigger-aql-modal')?.addEventListener('click', () => {
            AqlModal.open({
                cantidad: this.activeLote?.cantidad || 0,
                aqlNivel: this.aqlConfig.aqlNivel,
                nivel: this.aqlConfig.nivel
            });
        });

        // Refrescar GPS
        this.container.querySelector('#btn-refresh-gps')?.addEventListener('click', () => {
            this._initGPS();
        });

        // Autogenerar Plantilla
        this.container.querySelector('#btn-generar-plantilla')?.addEventListener('click', () => {
            this._actualizarPlantillaObservaciones(true);
        });

        // Modal Novedades Calidad
        const modalNov = this.container.querySelector('#cal-modal-novedad-dialog');
        const openNovBtn = this.container.querySelector('#btn-open-modal-novedad-cal');
        const closeNovBtn = this.container.querySelector('#btn-close-nov-modal');
        const saveNovBtn = this.container.querySelector('#btn-save-nov-modal');
        const addCodeBtn = this.container.querySelector('#btn-modal-add-code');

        openNovBtn?.addEventListener('click', () => {
            modalNov.classList.add('visible');
            this._resetModalNovFields();
        });

        closeNovBtn?.addEventListener('click', () => {
            modalNov.classList.remove('visible');
        });

        // Tipo novedad modal changes
        const tipoNovSel = this.container.querySelector('#modal-nov-tipo');
        tipoNovSel?.addEventListener('change', () => {
            const val = tipoNovSel.value;
            const sinProcWrap = this.container.querySelector('#modal-sin-proceso-wrap');
            const procAntWrap = this.container.querySelector('#modal-proceso-anterior-wrap');

            if (sinProcWrap) sinProcWrap.style.display = (val === 'SIN CONFECCIONAR' || val === 'LAVADO') ? 'block' : 'none';
            if (procAntWrap) procAntWrap.style.display = (val === 'COBROS') ? 'block' : 'none';
        });

        const checkProcAnt = this.container.querySelector('#modal-check-proceso-anterior');
        checkProcAnt?.addEventListener('change', () => {
            const selProc = this.container.querySelector('#modal-select-proceso-cobro');
            if (selProc) selProc.style.display = checkProcAnt.checked ? 'block' : 'none';
        });

        addCodeBtn?.addEventListener('click', () => {
            this._addModalCodeRow();
        });

        saveNovBtn?.addEventListener('click', () => {
            this._guardarNovedadCalidadModal();
            modalNov.classList.remove('visible');
        });

        // Botón Limpiar Formulario
        this.container.querySelector('#btn-limpiar-calidad')?.addEventListener('click', () => {
            this._limpiarFormulario();
        });

        // Submit Formulario
        this.container.querySelector('#form-calidad-full')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleSubmit();
        });
    }

    _initFirmaCanvas() {
        this.firmaCanvas = this.container.querySelector('#cal-inline-sig-canvas');
        if (!this.firmaCanvas) return;

        this.firmaCtx = this.firmaCanvas.getContext('2d');
        const canvas = this.firmaCanvas;
        const ctx = this.firmaCtx;

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let drawing = false;

        const getXY = (e) => {
            const r = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - r.left) * (canvas.width / r.width),
                y: (clientY - r.top) * (canvas.height / r.height)
            };
        };

        const start = (e) => {
            e.preventDefault();
            drawing = true;
            this.haFirmado = true;
            const pos = getXY(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();
            const pos = getXY(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        };

        const stop = () => { drawing = false; };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stop);
        canvas.addEventListener('mouseleave', stop);

        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stop);

        this.container.querySelector('#btn-clear-sig-inline')?.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.haFirmado = false;
        });
    }

    _initGPS() {
        const dot = this.container.querySelector('#gps-dot');
        const label = this.container.querySelector('#gps-status-label');
        const frameWrap = this.container.querySelector('#mapa-calidad-frame-wrap');

        if (!navigator.geolocation) {
            if (label) label.textContent = 'GPS no disponible en este dispositivo';
            if (dot) dot.className = 'f-gps-dot off';
            return;
        }

        if (label) label.textContent = 'Obteniendo localización...';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.gpsData = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    enabled: true
                };

                if (dot) dot.className = 'f-gps-dot active';
                if (label) {
                    label.textContent = `Ubicación: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (±${Math.round(pos.coords.accuracy)}m)`;
                }

                // Renderizar Iframe de OpenStreetMap interactivo sin requerir API key externa
                if (frameWrap) {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    frameWrap.innerHTML = `
                        <iframe
                            class="f-map-iframe"
                            src="https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005}%2C${lat-0.005}%2C${lng+0.005}%2C${lat+0.005}&amp;layer=mapnik&amp;marker=${lat}%2C${lng}"
                            loading="lazy">
                        </iframe>
                    `;
                }
            },
            (err) => {
                if (dot) dot.className = 'f-gps-dot off';
                if (label) label.textContent = 'No se pudo obtener GPS (' + err.message + ')';
                if (frameWrap) {
                    frameWrap.innerHTML = `
                        <div class="f-map-loading">
                            <span style="color:#ef4444;">Sin señal de ubicación</span>
                        </div>
                    `;
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    _actualizarMapaPlanta() {
        // Si hay planta seleccionada y no se tiene GPS exacto, se actualiza la vista
    }

    _recalcAQL() {
        const qty = this.activeLote ? this.activeLote.cantidad : 0;
        const res = AqlModal.calculate(qty, this.aqlConfig.aqlNivel, this.aqlConfig.nivel);

        this.aqlConfig.muestra = res.muestra;
        this.aqlConfig.ac = res.ac;
        this.aqlConfig.re = res.re;
        this.aqlConfig.letra = res.letra;

        const dispMuestra = this.container.querySelector('#aql-display-muestra');
        const dispAc = this.container.querySelector('#aql-display-ac');
        const dispRe = this.container.querySelector('#aql-display-re');

        if (dispMuestra) dispMuestra.textContent = res.muestra;
        if (dispAc) dispAc.textContent = res.ac;
        if (dispRe) dispRe.textContent = res.re;
    }

    _actualizarVisibilidadCondicional() {
        const tipo = this.container.querySelector('#cal-tipo-visita')?.value || '';
        const conclusion = this.container.querySelector('#cal-conclusion')?.value || '';

        const destinoSection = this.container.querySelector('#cal-destino-section');
        const avanceSection = this.container.querySelector('#cal-avance-section');
        const novedadesSection = this.container.querySelector('#cal-novedades-section');

        // Destino: Visible si AUDITORIA y APROBADO
        if (destinoSection) {
            destinoSection.style.display = (tipo === 'AUDITORIA' && conclusion === 'APROBADO') ? 'block' : 'none';
        }

        // Avance: Visible en RONDA o CONTRAMUESTRA
        if (avanceSection) {
            avanceSection.style.display = (tipo === 'RONDA' || tipo === 'CONTRAMUESTRA') ? 'block' : 'none';
        }

        // Novedades: Visible en AUDITORIA
        if (novedadesSection) {
            novedadesSection.style.display = (tipo === 'AUDITORIA') ? 'block' : 'none';
        }
    }

    _actualizarPlantillaObservaciones(force = false) {
        const obsEl = this.container.querySelector('#cal-observaciones-text');
        if (!obsEl) return;

        if (force || !obsEl.value.trim()) {
            const tipo = this.container.querySelector('#cal-tipo-visita')?.value || 'AUDITORIA';
            const conclusion = this.container.querySelector('#cal-conclusion')?.value || 'APROBADO';
            const avance = parseInt(this.container.querySelector('#cal-slider-avance')?.value || 0, 10);
            const destino = this.container.querySelector('#cal-destino-tipo')?.value || '';

            obsEl.value = generarTextoPlantillaCalidad({
                tipoVisita: tipo,
                conclusion,
                lote: this.activeLote,
                avance,
                muestra: this.aqlConfig.muestra,
                destino
            });
        }
    }

    _resetModalNovFields() {
        const tipoSel = this.container.querySelector('#modal-nov-tipo');
        if (tipoSel) tipoSel.value = '';
        const sinProcCheck = this.container.querySelector('#modal-check-sin-proceso');
        if (sinProcCheck) sinProcCheck.checked = false;
        const procAntCheck = this.container.querySelector('#modal-check-proceso-anterior');
        if (procAntCheck) procAntCheck.checked = false;

        this.container.querySelector('#modal-sin-proceso-wrap').style.display = 'none';
        this.container.querySelector('#modal-proceso-anterior-wrap').style.display = 'none';
        this.container.querySelector('#modal-select-proceso-cobro').style.display = 'none';

        const codesList = this.container.querySelector('#modal-codes-list');
        if (codesList) {
            codesList.innerHTML = '';
            this._addModalCodeRow();
        }
    }

    _addModalCodeRow() {
        const container = this.container.querySelector('#modal-codes-list');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'f-code-row';
        row.innerHTML = `
            <input type="text" class="f-input-sm c-talla" placeholder="Talla (S, M, 32...)" style="flex:1;" />
            <input type="text" class="f-input-sm c-color" placeholder="Color" style="flex:1;" />
            <input type="number" class="f-input-sm c-cant" min="1" value="1" placeholder="Cant." style="width:70px;" />
            <button type="button" class="f-btn-del-row" title="Quitar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        row.querySelector('.f-btn-del-row')?.addEventListener('click', () => row.remove());
        container.appendChild(row);
    }

    _guardarNovedadCalidadModal() {
        const tipo = this.container.querySelector('#modal-nov-tipo')?.value;
        if (!tipo) {
            Toast.warning('Seleccione el tipo de novedad.');
            return;
        }

        const sinProceso = this.container.querySelector('#modal-check-sin-proceso')?.checked || false;
        const procesoAnterior = this.container.querySelector('#modal-check-proceso-anterior')?.checked || false;
        const procesoCobro = this.container.querySelector('#modal-cobro-proceso-val')?.value || '';

        const codigos = [];
        this.container.querySelectorAll('#modal-codes-list .f-code-row').forEach(r => {
            const talla = r.querySelector('.c-talla')?.value.trim();
            const color = r.querySelector('.c-color')?.value.trim();
            const cantidad = parseInt(r.querySelector('.c-cant')?.value, 10) || 1;
            if (talla || color) {
                codigos.push({ talla, color, cantidad });
            }
        });

        const totalUnidades = codigos.reduce((acc, c) => acc + c.cantidad, 0);

        this.novedadesAgregadas.push({
            tipo,
            sinProceso,
            procesoAnterior,
            procesoCobro,
            codigos,
            totalUnidades
        });

        this._renderNovedadesCalidadList();
        Toast.success('Novedad añadida al reporte.');
    }

    _renderNovedadesCalidadList() {
        const container = this.container.querySelector('#cal-novedades-cards-list');
        if (!container) return;

        if (!this.novedadesAgregadas.length) {
            container.innerHTML = `<div class="f-empty-nov-hint">Sin novedades reportadas para este lote.</div>`;
            return;
        }

        container.innerHTML = this.novedadesAgregadas.map((n, idx) => `
            <div class="f-nov-item-card">
                <div class="f-nov-item-header">
                    <span class="f-nov-badge-tipo">${n.tipo}</span>
                    <span class="f-nov-units">${n.totalUnidades} uds.</span>
                    <button type="button" class="f-btn-del-nov-card" data-index="${idx}">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                ${n.procesoAnterior ? `<div class="f-nov-extra-tag">Cobro a proceso anterior: ${n.procesoCobro}</div>` : ''}
                ${n.sinProceso ? `<div class="f-nov-extra-tag sin-proc">Marcado como Sin Proceso</div>` : ''}
                <div class="f-nov-codes-summary">
                    ${n.codigos.map(c => `<span class="chip-code">${c.talla} / ${c.color} (${c.cantidad})</span>`).join('')}
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.f-btn-del-nov-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                this.novedadesAgregadas.splice(idx, 1);
                this._renderNovedadesCalidadList();
            });
        });
    }

    _limpiarFormulario() {
        this.container.querySelector('#form-calidad-full')?.reset();
        this.novedadesAgregadas = [];
        this._renderNovedadesCalidadList();
        if (this.dropzone) this.dropzone.clear();
        if (this.firmaCtx && this.firmaCanvas) {
            this.firmaCtx.clearRect(0, 0, this.firmaCanvas.width, this.firmaCanvas.height);
            this.haFirmado = false;
        }
        Toast.info('Formulario restablecido.');
    }

    async _handleSubmit() {
        if (!this.activeLote) {
            Toast.warning('Por favor busque y seleccione una OP / Lote en la parte superior antes de enviar.');
            return;
        }

        if (!this.haFirmado) {
            Toast.warning('Debe registrar su firma en el recuadro antes de enviar la auditoría.');
            return;
        }

        const btn = this.container.querySelector('#btn-submit-calidad-final');
        const origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="f-spinner"></span> Enviando Auditoría...`;

        try {
            const firmaBase64 = this.firmaCanvas ? this.firmaCanvas.toDataURL('image/png') : null;
            const payload = {
                lote: this.activeLote.lote || this.activeLote.op,
                op: this.activeLote.op || this.activeLote.lote,
                planta: this.activeLote.planta,
                modulo: this.activeLote.modulo || this.activeLote.linea,
                linea: this.activeLote.linea,
                referencia: this.activeLote.referencia,
                tipoPrenda: this.activeLote.tipoPrenda,
                cantidadTotal: this.activeLote.cantidad,
                email: this.container.querySelector('#cal-email')?.value,
                tipoVisita: this.container.querySelector('#cal-tipo-visita')?.value,
                conclusion: this.container.querySelector('#cal-conclusion')?.value,
                destinoTipo: this.container.querySelector('#cal-destino-tipo')?.value,
                destinoProceso: this.container.querySelector('#cal-destino-proceso')?.value,
                destinoOtro: this.container.querySelector('#cal-destino-otro-text')?.value,
                destinoPlanta: this.container.querySelector('#cal-destino-planta-input')?.value,
                avanceProduccion: parseInt(this.container.querySelector('#cal-slider-avance')?.value || 0, 10),
                novedadesAsociadas: this.novedadesAgregadas,
                observaciones: this.container.querySelector('#cal-observaciones-text')?.value,
                aql: this.aqlConfig,
                gps: this.gpsData,
                firma: firmaBase64,
                fotos: this.dropzone ? this.dropzone.getFiles() : [],
                auditor: this.currentUser?.displayName || this.currentUser?.nombre || 'Auditor'
            };

            const res = await this.submitUseCase.execute(payload);
            Toast.success(res.message || 'Auditoría de calidad registrada con éxito.');

            this._limpiarFormulario();
            if (typeof this.onSuccess === 'function') {
                this.onSuccess();
            }
        } catch (err) {
            Toast.error(err.message || 'Ocurrió un error al guardar la auditoría.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}
