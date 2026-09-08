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
        onFetchExtensiones = null,
        onExtensionesLoaded = null,
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
        this.onFetchExtensiones = onFetchExtensiones;
        this.onExtensionesLoaded = onExtensionesLoaded;
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
        if (this.loteSelector) {
            this.loteSelector.setActiveLote(lote);
            // Mantener los selects de configuración AQL alineados con la config vigente
            this.loteSelector.setAqlConfig({ nivel: this.aqlConfig.nivel, aqlNivel: this.aqlConfig.aqlNivel });
        }
        const form = this.container.querySelector('#form-calidad-full');
        // El formulario permanece oculto hasta que se seleccione una OP
        if (form) form.style.display = lote ? 'flex' : 'none';
        this._syncLoteDefaultData();
        this._actualizarVisibilidadCondicional();
    }

    /**
     * Aplica al formulario los valores por defecto derivados de la OP seleccionada:
     * la cantidad del lote define el muestreo AQL y la planta la ubicación del mapa.
     */
    _syncLoteDefaultData() {
        this._recalcAQL();
        this._actualizarMapaPlanta();
    }

    _render() {
        // El auditor se muestra por Nombre Completo (viene de Supabase Auth vía Store)
        const auditorName = this.currentUser?.displayName || this.currentUser?.nombre || '';

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

            <form id="form-calidad-full" class="f-subform-body" style="display:none;">
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

                <!-- 2. AUDITOR Y TIPO DE VISITA -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">2</span>
                    <span>Datos de la Auditoría</span>
                </div>

                <div class="f-form-grid">
                    <div class="f-form-group">
                        <label class="f-label">Auditor <span class="req">*</span></label>
                        <input type="text" id="cal-email" class="f-input" value="${auditorName}" placeholder="Nombre del auditor" required readonly />
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

                <!-- 3. CONCLUSIÓN Y DICTAMEN (El Muestreo AQL es informativo: solapa bajo el filtro de Productora) -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">3</span>
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
                <div id="cal-novedades-section" class="f-novedades-section" style="margin-top: 22px;">
                    <div class="f-nov-section-head">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>Novedades del Lote</span>
                    </div>

                    <div id="cal-novedades-cards-list" class="f-nov-cards-list">
                        <div class="f-empty-nov-hint">Sin novedades reportadas para este lote.</div>
                    </div>

                    <button type="button" class="f-btn-report-nov" id="btn-open-modal-novedad-cal">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Reportar Novedad</span>
                    </button>
                </div>

                <!-- 4. OBSERVACIONES Y PLANTILLA INTELIGENTE -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">4</span>
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

                <!-- 5. SOPORTE Y FOTOS MÚLTIPLES -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">5</span>
                    <span>Soporte / Evidencias Fotográficas</span>
                </div>
                <div id="cal-dropzone-mount"></div>

                <!-- 6. FIRMA DIGITAL INTEGRADA -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">6</span>
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
                                    <option value="">Seleccione...</option>
                                    <option value="CONFECCION">CONFECCIÓN</option>
                                    <option value="ESTAMPADO">ESTAMPADO</option>
                                    <option value="OJAL Y BOTON">OJAL Y BOTÓN</option>
                                    <option value="BOTONADO">BOTONADO</option>
                                    <option value="TRANSFER">TRANSFER</option>
                                    <option value="OJALETE">OJALETE</option>
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

        // 1. Instanciar Selector de Lote On-Demand (con solapa informativa AQL)
        const loteMount = this.container.querySelector('#cal-lote-mount');
        this.loteSelector = new LoteSelectorCard({
            container: loteMount,
            productoras: this.productoras,
            selectedProductora: this.selectedProductora,
            onSearchLotes: this.onSearchLotes,
            onProductoraChange: this.onProductoraChange,
            onFetchExtensiones: this.onFetchExtensiones,
            onExtensionesLoaded: () => this._refreshModalCodeRows(),
            onSelectLote: (lote) => this.setLote(lote),
            // Configuración del muestreo (legado): recalcular al cambiar Nivel Inspección / Nivel AQL
            onAqlConfigChange: (cfg) => {
                this.aqlConfig.nivel = cfg.nivel;
                this.aqlConfig.aqlNivel = cfg.aqlNivel;
                this._recalcAQL();
            },
            aqlInfo: true
        });

        if (this.activeLote) {
            // Restaurar OP preservada: muestra el form y sincroniza AQL/mapa
            this.setLote(this.activeLote);
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

        // Tipo novedad modal changes (comportamiento legacy: SIN PROCESO solo en PROMOCIONES, PROCESO ANTERIOR solo en COBROS)
        const tipoNovSel = this.container.querySelector('#modal-nov-tipo');
        tipoNovSel?.addEventListener('change', () => {
            const val = tipoNovSel.value;
            const sinProcWrap = this.container.querySelector('#modal-sin-proceso-wrap');
            const sinProcCheck = this.container.querySelector('#modal-check-sin-proceso');
            const procAntWrap = this.container.querySelector('#modal-proceso-anterior-wrap');
            const procAntCheck = this.container.querySelector('#modal-check-proceso-anterior');
            const selProc = this.container.querySelector('#modal-select-proceso-cobro');
            const procSel = this.container.querySelector('#modal-cobro-proceso-val');

            if (sinProcWrap) sinProcWrap.style.display = (val === 'PROMOCIONES') ? 'block' : 'none';
            if (sinProcCheck && val !== 'PROMOCIONES') sinProcCheck.checked = false;
            if (procAntWrap) procAntWrap.style.display = (val === 'COBROS') ? 'block' : 'none';
            if (val !== 'COBROS') {
                if (procAntCheck) procAntCheck.checked = false;
                if (procSel) procSel.value = '';
                if (selProc) selProc.style.display = 'none';
            }
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
            const ok = this._guardarNovedadCalidadModal();
            if (ok) modalNov.classList.remove('visible');
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

                // Renderizar Iframe de Google Maps interactivo (mismo patrón legacy de impresión)
                if (frameWrap) {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    frameWrap.innerHTML = `
                        <iframe
                            class="f-map-iframe"
                            src="https://maps.google.com/maps?q=${lat}%2C${lng}&z=16&output=embed"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"
                            allowfullscreen>
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

        // Resumen colapsado en la solapa informativa (bajo el filtro de Productora)
        const dispVal = this.container.querySelector('#aql-tab-value');
        if (dispVal) dispVal.textContent = res.muestra ? `${res.muestra} uds` : '—';
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
        const procSel = this.container.querySelector('#modal-cobro-proceso-val');
        if (procSel) procSel.value = '';

        const codesList = this.container.querySelector('#modal-codes-list');
        if (codesList) {
            codesList.innerHTML = '';
            this._addModalCodeRow();
        }
    }

    /**
     * Opciones REALES de talla/color derivadas de las extensiones de la OP
     * (clave id_productora + op). Si la OP aún no tiene extensiones
     * registradas, los campos quedan como texto libre (fallback).
     */
    _getExtOptions() {
        const exts = Array.isArray(this.activeLote?.extensiones) ? this.activeLote.extensiones : [];
        const tallas = [...new Set(exts.map(e => String(e.talla || '').toUpperCase().trim()).filter(Boolean))];
        const colores = [...new Set(exts.map(e => String(e.color || '').toUpperCase().trim()).filter(Boolean))];
        return { tallas, colores, disponible: exts.length > 0 };
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

        // Alimentar con las extensiones REALES de la OP (talla/color como select)
        this._upgradeRowSelects(row);
    }

    /**
     * Convierte los inputs de talla/color de una fila en <select> poblados con
     * las extensiones reales de la OP, preservando el valor ya elegido.
     */
    _upgradeRowSelects(row) {
        if (!row) return;
        const { tallas, colores, disponible } = this._getExtOptions();
        if (!disponible) return;

        const buildSelect = (list, cls, placeholder, cur) => {
            const sel = document.createElement('select');
            sel.className = `f-input-sm ${cls}`;
            sel.style.flex = '1';
            sel.innerHTML = [`<option value="">${placeholder}</option>`]
                .concat(list.map(o => `<option value="${o}" ${o === cur ? 'selected' : ''}>${o}</option>`))
                .join('');
            return sel;
        };

        const tallaEl = row.querySelector('.c-talla');
        if (tallaEl && tallaEl.tagName !== 'SELECT' && tallas.length) {
            tallaEl.replaceWith(buildSelect(tallas, 'c-talla', 'Talla...', tallaEl.value.trim()));
        }
        const colorEl = row.querySelector('.c-color');
        if (colorEl && colorEl.tagName !== 'SELECT' && colores.length) {
            colorEl.replaceWith(buildSelect(colores, 'c-color', 'Color...', colorEl.value.trim()));
        }

        // Alimentar cantidad: si existe la combinación Talla+Color en las
        // extensiones de la OP, sugerir la cantidad disponible.
        const syncQty = () => {
            const t = row.querySelector('.c-talla')?.value?.trim().toUpperCase();
            const c = row.querySelector('.c-color')?.value?.trim().toUpperCase();
            if (!t || !c) return;
            const match = (this.activeLote?.extensiones || []).find(e =>
                String(e.talla || '').toUpperCase().trim() === t &&
                String(e.color || '').toUpperCase().trim() === c);
            const qty = row.querySelector('.c-cant');
            if (match && qty && (!qty.value || Number(qty.value) < 1)) qty.value = match.cantidad || 1;
        };
        row.querySelector('.c-talla')?.addEventListener('change', syncQty);
        row.querySelector('.c-color')?.addEventListener('change', syncQty);
    }

    /**
     * Refresca las filas ya creadas del modal cuando llegan las extensiones
     * de la OP (carga async): convierte inputs en selects poblados.
     */
    _refreshModalCodeRows() {
        const { disponible } = this._getExtOptions();
        if (!disponible) return;
        const rows = this.container.querySelectorAll('#modal-codes-list .f-code-row');
        rows.forEach(row => this._upgradeRowSelects(row));
    }

    _guardarNovedadCalidadModal() {
        const tipo = this.container.querySelector('#modal-nov-tipo')?.value;
        if (!tipo) {
            Toast.warning('Seleccione el tipo de novedad.');
            return false;
        }

        const sinProcesoCheck = this.container.querySelector('#modal-check-sin-proceso');
        const procAntCheck = this.container.querySelector('#modal-check-proceso-anterior');
        const procSel = this.container.querySelector('#modal-cobro-proceso-val');

        // Legacy: SIN PROCESO solo aplica a PROMOCIONES
        let sinProceso = false;
        if (tipo === 'PROMOCIONES') sinProceso = !!sinProcesoCheck?.checked;

        // Legacy: PROCESO ANTERIOR solo aplica a COBROS, y el proceso es obligatorio si se marca
        let procesoAnterior = false;
        let procesoCobro = '';
        if (tipo === 'COBROS' && procAntCheck?.checked) {
            procesoAnterior = true;
            procesoCobro = procSel?.value?.trim() || '';
            if (!procesoCobro) {
                Toast.warning('Si marca proceso anterior, debe seleccionar el proceso correspondiente.');
                return false;
            }
        }

        // Validación estricta de filas (legacy: talla, color y cantidad obligatorias en todas)
        const rows = this.container.querySelectorAll('#modal-codes-list .f-code-row');
        if (!rows.length) {
            Toast.warning('Agregue al menos una fila de talla/color/cantidad.');
            return false;
        }

        const codigos = [];
        let valido = true;
        rows.forEach(r => {
            const talla = r.querySelector('.c-talla')?.value.trim() || '';
            const color = r.querySelector('.c-color')?.value.trim() || '';
            const cantidad = parseInt(r.querySelector('.c-cant')?.value, 10) || 0;
            if (!talla || !color || !cantidad) { valido = false; return; }
            codigos.push({ talla, color, cantidad });
        });

        if (!valido || codigos.length === 0) {
            Toast.warning('Complete talla, color y cantidad en todas las filas.');
            return false;
        }

        // Compactar códigos repetidos (misma talla+color suman cantidad) — legado
        const codigosCompactados = this._compactarCodigosNovedad(codigos);

        // Legacy: para COBROS con proceso anterior se guarda como "COBRO - PROCESO"
        let displayTipo = tipo;
        const tipoBase = tipo;
        if (tipo === 'COBROS' && procesoCobro) {
            displayTipo = `COBRO - ${procesoCobro}`;
        }

        const nuevaNovedad = {
            tipo: displayTipo,
            tipo_base: tipoBase,
            sin_proceso: sinProceso,
            proceso: procesoCobro || null,
            codigos: codigosCompactados,
            totalUnidades: codigosCompactados.reduce((acc, c) => acc + c.cantidad, 0)
        };

        // Agrupar/merge con grupos existentes del mismo tipo (comportamiento legacy)
        let destino = null;
        if (tipoBase === 'COBROS' && procesoCobro) {
            destino = this.novedadesAgregadas.find(n => n.tipo === displayTipo);
        } else if (tipoBase === 'COBROS' && !procesoCobro) {
            destino = this.novedadesAgregadas.find(n => (n.tipo_base === 'COBROS' || n.tipo === 'COBROS') && !n.proceso);
        } else {
            destino = this.novedadesAgregadas.find(n => n.tipo === displayTipo && !!n.sin_proceso === !!sinProceso);
        }

        if (destino) {
            destino.codigos = this._compactarCodigosNovedad(destino.codigos.concat(codigosCompactados));
            destino.totalUnidades = destino.codigos.reduce((acc, c) => acc + c.cantidad, 0);
        } else {
            this.novedadesAgregadas.push(nuevaNovedad);
        }

        this._renderNovedadesCalidadList();
        Toast.success('Novedad añadida al reporte.');
        return true;
    }

    _compactarCodigosNovedad(codigosArray) {
        const map = {};
        (codigosArray || []).forEach(c => {
            const key = `${c.talla}|${c.color}`;
            if (map[key]) map[key].cantidad += c.cantidad;
            else map[key] = { talla: c.talla, color: c.color, cantidad: c.cantidad };
        });
        return Object.values(map);
    }

/**
     * Íconos descriptivos SVG para las novedades del lote (equivalente a FontAwesome del legacy).
     */
    _novIcon(k) {
        const I = {
            tag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
            scissors: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
            alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            percent: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
            money: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/></svg>',
            dollar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="6" x2="12" y2="18"/><path d="M16 8.5c0-1.5-1.79-2.5-4-2.5s-4 1-4 2.5 1.79 2.5 4 2.5 4 1 4 2.5-1.79 2.5-4 2.5-4-1-4-2.5"/></svg>',
            invoice: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            water: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
            trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
        };
        return I[k] || I.tag;
    }

    /**
     * Tema (color + ícono + label) por tipo de novedad, replicando el original legacy.
     */
    _novedadTheme(n) {
        const t = n.tipo || '';
        const tb = n.tipo_base || '';
        if (t === 'SIN CONFECCIONAR') return { color: '#ef4444', bg: '#fef2f2', icon: 'scissors', label: t };
        if (t === 'PROMOCIONES') {
            if (n.sin_proceso) return { color: '#db2777', bg: '#fdf2f8', icon: 'alert', label: 'PROM. SIN PROCESO' };
            return { color: '#f59e0b', bg: '#fffbeb', icon: 'percent', label: t };
        }
        if (t.startsWith('COBRO -')) return { color: '#8b5cf6', bg: '#f5f3ff', icon: 'money', label: t };
        if (t === 'COBROS' || tb === 'COBROS') return { color: '#10b981', bg: '#ecfdf5', icon: 'invoice', label: t };
        if (t === 'LAVADO') return { color: '#6366f1', bg: '#eef2ff', icon: 'water', label: t };
        return { color: '#3b82f6', bg: '#eff6ff', icon: 'tag', label: t };
    }
    _renderNovedadesCalidadList() {
        const container = this.container.querySelector('#cal-novedades-cards-list');
        if (!container) return;

        if (!this.novedadesAgregadas.length) {
            container.innerHTML = `<div class="f-empty-nov-hint">Sin novedades reportadas para este lote.</div>`;
            return;
        }

        container.innerHTML = this.novedadesAgregadas.map((n, idx) => {
            const th = this._novedadTheme(n);
            const esCobroProceso = (n.tipo_base === 'COBROS' || (n.tipo || '').startsWith('COBRO -')) && n.proceso;
            const rows = n.codigos.map((c, ci) => `
                <div class="f-nov-tr" title="${c.talla} / ${c.color}">
                    <span class="f-nov-talla" title="${c.talla}">${c.talla}</span>
                    <span class="f-nov-color" title="${c.color}">${c.color}</span>
                    <span class="f-nov-cant-badge" style="background:${th.bg};color:${th.color};">${c.cantidad}</span>
                    <span class="f-nov-actions">
                        <button type="button" class="f-btn-del-nov-row" data-index="${idx}" data-code="${ci}" title="Quitar detalle">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </span>
                </div>
            `).join('');

            return `
                <div class="f-nov-table-card" style="border-top-color:${th.color};">
                    <div class="f-nov-table-head" style="background:${th.bg};">
                        <span class="f-nov-tipo-ico" style="color:${th.color};">${this._novIcon(th.icon)}</span>
                        <span class="f-nov-table-tipo">${th.label}</span>
                        <span class="f-nov-table-units" style="color:${th.color};">${n.totalUnidades} UDS.</span>
                        <button type="button" class="f-btn-del-nov-card" data-index="${idx}" title="Eliminar novedad">
                            ${this._novIcon('trash')}
                        </button>
                    </div>
                    ${esCobroProceso ? `<div class="f-nov-extra-tag">Cobro a proceso anterior: ${n.proceso}</div>` : ''}
                    ${n.sin_proceso ? `<div class="f-nov-extra-tag sin-proc">Marcado como Sin Proceso</div>` : ''}
                    <div class="f-nov-table">
                        <div class="f-nov-tr f-nov-tr-head">
                            <span>Talla</span>
                            <span>Color</span>
                            <span style="text-align:center;">Cant.</span>
                            <span style="text-align:right;">Acción</span>
                        </div>
                        ${rows}
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.f-btn-del-nov-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                this.novedadesAgregadas.splice(idx, 1);
                this._renderNovedadesCalidadList();
            });
        });

        // Eliminar fila individual (talla/color)
        container.querySelectorAll('.f-btn-del-nov-row').forEach(btn => {
            btn.addEventListener('click', () => {
                const gi = parseInt(btn.dataset.index, 10);
                const ci = parseInt(btn.dataset.code, 10);
                const grp = this.novedadesAgregadas[gi];
                if (!grp) return;
                grp.codigos.splice(ci, 1);
                if (grp.codigos.length === 0) {
                    this.novedadesAgregadas.splice(gi, 1);
                } else {
                    grp.totalUnidades = grp.codigos.reduce((a, c) => a + c.cantidad, 0);
                }
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
                // El correo real viaja en el payload (columna 'email' en BD); la UI muestra el nombre del auditor
                email: this.currentUser?.email || this.currentUser?.correo || '',
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
