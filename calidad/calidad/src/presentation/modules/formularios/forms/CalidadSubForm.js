import { Toast } from '../../../components/Toast.js';
import { MediaDropzone } from '../components/MediaDropzone.js';
import { AqlModal } from '../components/AqlModal.js';
import { LoteSelectorCard } from '../components/LoteSelectorCard.js';
import { generarTextoPlantillaCalidad } from '../utils/plantillasCalidad.js';
import { ENV } from '../../../../infrastructure/config/env.js';

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
        this.gpsData = { lat: null, lng: null, enabled: false };
        this.firmaCanvas = null;
        this.firmaCtx = null;
        this.haFirmado = false;
        this.firmaStrokes = []; // Series de trazos de la firma → exportar como SVG (patrón legacy FirmaTaller)

        this.aqlConfig = {
            nivel: 'II',
            aqlNivel: '4.0',
            muestra: 0,
            ac: 0,
            re: 1,
            letra: 'A'
        };

        // Configuración de búsqueda por defecto (todo oculto hasta cargar desde Supabase)
        this.searchConfig = {
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

        this._render();
    }

    setLotes(lotes) {
        this.lotes = lotes || [];
        if (this.loteSelector && typeof this.loteSelector.setLotes === 'function') {
            this.loteSelector.setLotes(this.lotes);
        }
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
                <button class="icon-btn config-btn" id="btn-open-config" aria-label="Configuración" title="Configuración de búsqueda">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            </div>

            <!-- Selector de Lote Integrado -->
            <div id="cal-lote-mount" class="f-mount-section"></div>

            <form id="form-calidad-full" class="f-subform-body" style="display:none;">
                <!-- 1. LOCALIZACIÓN GPS Y MAPA (Oculto - ahora en pestaña colapsada GPS) -->
                <div class="f-section-title" style="display:none;">
                    <span class="pill-num">1</span>
                    <span>Localización GPS en Planta</span>
                </div>

                <div class="f-gps-container" style="display:none;">
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
                <div class="f-form-group">
                    <label class="f-label">Auditor <span class="req">*</span></label>
                    <div class="cal-input-wrap">
                        <input type="text" id="cal-email" class="f-input cal-email-locked" value="${auditorName}" placeholder="Nombre del auditor" required disabled />
                        <span class="cal-lock-icon">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </span>
                    </div>
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

                <!-- 3. CONCLUSIÓN -->
                <div class="f-form-group" style="margin-top: 16px;">
                    <label class="f-label">Conclusión del Lote <span class="req">*</span></label>
                    <select id="cal-conclusion" class="f-select" required>
                        <option value="">Seleccione una conclusión...</option>
                        <option value="APROBADO" selected>APROBADO</option>
                        <option value="RECHAZADO">RECHAZADO</option>
                        <option value="PAUSADO">PAUSADO</option>
                    </select>
                </div>

                <!-- 3. DESTINO DEL LOTE (Visible solo si es AUDITORIA y APROBADO) -->
                <div id="cal-destino-section" style="display:none;">
                    <div class="f-form-group">
                        <label class="f-label">Destino <span class="req">*</span></label>
                        <select id="cal-destino-tipo" class="f-select" required>
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

                    <div class="f-form-group" id="cal-destino-otro-wrap" style="display:none;">
                        <label class="f-label">Especifique el Otro Proceso</label>
                        <input type="text" id="cal-destino-otro-text" class="f-input" placeholder="Nombre del proceso de destino..." />
                    </div>

                    <div class="f-form-group" id="cal-destino-planta-wrap" style="display:none;">
                        <label class="f-label">¿A qué planta / taller se envía?</label>
                        <input type="text" id="cal-destino-planta-input" class="f-input" placeholder="Nombre de la planta o taller..." />
                    </div>
                </div>

                <!-- 6. AVANCE DE PRODUCCIÓN (Visible solo en RONDA y CONTRAMUESTRA) -->
                <div id="cal-avance-section" style="display:none; margin-top: 16px;">
                    <div class="f-form-group">
                        <label class="f-label">Porcentaje de Avance Físico</label>
                        <div class="f-range-advanced">
                            <div class="f-range-top-row">
                                <span class="lbl">Avance:</span>
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
                </div>

                <!-- 7. NOVEDADES DE AUDITORÍA ASOCIADAS (Visible en AUDITORÍA) -->
                <div id="cal-novedades-section" class="f-novedades-section" style="margin-top: 22px;">
                    <div class="f-form-group">
                        <label class="f-label">Novedades</label>
                    </div>

                    <div id="cal-novedades-cards-list" class="f-nov-cards-list">
                    </div>

                    <button type="button" class="f-btn-report-nov" id="btn-open-modal-novedad-cal">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Reportar Novedad</span>
                    </button>
                </div>

                <!-- 4. OBSERVACIONES -->
                <div class="f-form-group" style="margin-top: 20px;">
                    <div class="f-label-row">
                        <label class="f-label">Observaciones</label>
                        <button type="button" class="f-btn-tool-inline" id="btn-generar-plantilla">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            <span>Autogenerar Plantilla</span>
                        </button>
                    </div>
                    <textarea id="cal-observaciones-text" class="f-textarea" rows="4" placeholder="Detalle los hallazgos encontrados, costuras, tolerancias y motivos de la decisión..." required></textarea>
                </div>

                <!-- 5. SOPORTE FOTOGRÁFICO -->
                <div class="f-form-group" style="margin-top: 20px;">
                    <label class="f-label">Soporte Fotográfico</label>
                    <div id="cal-dropzone-mount"></div>
                </div>

                <!-- 6. FIRMA DIGITAL -->
                <div class="f-form-group" style="margin-top: 20px;">
                    <label class="f-label">Firma de Validación</label>
                    <div class="f-inline-signature-box">
                        <div class="f-sig-canvas-inner">
                            <canvas id="cal-inline-sig-canvas" width="400" height="160"></canvas>
                            <div class="f-sig-baseline"></div>
                        </div>
                        <button type="button" class="f-btn-clear-sig-inline" id="btn-clear-sig-inline">Borrar Firma</button>
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

            <!-- Modal Novedades de Calidad (Template, se clona a document.body al abrir) -->
            <div id="cal-modal-novedad-dialog" class="f-modal-backdrop" style="display:none;">
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

            <!-- Modal Configuración de Búsqueda -->
            <div id="cal-modal-config-dialog" class="f-modal-backdrop" style="display:none;">
                <div class="f-modal-sheet" style="max-width: 480px;">
                    <div class="f-sheet-header">
                        <div class="f-sheet-pill"></div>
                        <div class="f-sheet-title-row">
                            <div class="f-sheet-title-icon config">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </div>
                            <div>
                                <h3 class="f-sheet-title">Configuración de Búsqueda</h3>
                                <p class="f-sheet-subtitle">Personaliza los campos y pestañas visibles</p>
                            </div>
                        </div>
                    </div>

                    <div class="f-sheet-body">
                        <div class="f-config-section">
                            <h4 class="f-config-section-title">Campos de Búsqueda</h4>
                            <p class="f-config-section-desc">Selecciona los campos para buscar lotes (mínimo 1)</p>
                            
                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-search-productora" checked />
                                    <span>Productora</span>
                                </label>
                            </div>
                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-search-op" checked />
                                    <span>OP (Orden de Producción)</span>
                                </label>
                            </div>
                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-search-referencia" checked />
                                    <span>Referencia</span>
                                </label>
                            </div>
                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-search-planta" checked />
                                    <span>Planta</span>
                                </label>
                            </div>
                        </div>

                        <div class="f-config-section" style="margin-top: 20px;">
                            <h4 class="f-config-section-title">Filtros Visibles</h4>
                            <p class="f-config-section-desc">Selecciona los filtros a mostrar</p>

                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-filter-productora" checked />
                                    <span>Filtro Productora</span>
                                </label>
                            </div>
                        </div>

                        <div class="f-config-section" style="margin-top: 20px;">
                            <h4 class="f-config-section-title">Pestañas Informativas</h4>
                            <p class="f-config-section-desc">Selecciona las pestañas colapsables a mostrar</p>

                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-tab-aql" checked />
                                    <span>AQL (Muestreo)</span>
                                </label>
                            </div>
                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-tab-curva" checked />
                                    <span>Curva (Tallas/Colores)</span>
                                </label>
                            </div>
                            <div class="f-checkbox-row">
                                <label class="f-checkbox-lbl">
                                    <input type="checkbox" id="config-tab-gps" checked />
                                    <span>Ubicación (GPS)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="f-sheet-footer">
                        <button type="button" class="f-btn-secondary" id="btn-close-config-modal">Cancelar</button>
                        <button type="button" class="f-btn-primary" id="btn-save-config-modal">Guardar Configuración</button>
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
            // Capturar GPS al descolapsar pestaña de ubicación
            onGpsTabOpened: () => {
                this._initGPS();
            },
            // Configuración dinámica de búsqueda y pestañas
            searchConfig: this.searchConfig,
            aqlInfo: true
        });

        if (this.activeLote) {
            // Restaurar OP preservada: muestra el form y sincroniza AQL/mapa
            this.setLote(this.activeLote);
        }

        // 3. Instanciar Dropzone
        const dropMount = this.container.querySelector('#cal-dropzone-mount');
        this.dropzone = new MediaDropzone({
            container: dropMount,
            maxFiles: 8
        });

        // 4. Inicializar Firma
        this._initFirmaCanvas();

        // 4b. Capturar GPS de inmediato aunque la pestaña de ubicación NO esté
        //     abierta: si la localización está activa, ya viaja en el payload.
        this._initGPS(true);

        // 5. Cargar configuración de búsqueda del usuario (async, no bloquear)
        this._loadConfigFromUserProfile();

        // 6. Vincular Eventos
        this._bindEvents();
        this._recalcAQL();
        this._actualizarVisibilidadCondicional();
    }

    _bindEvents() {
        // Volver al Menú
        this.container.querySelector('#btn-back-to-hub')?.addEventListener('click', () => {
            if (typeof this.onBack === 'function') this.onBack();
        });

        // Abrir Modal de Configuración
        this.container.querySelector('#btn-open-config')?.addEventListener('click', () => {
            this._openConfigModal();
        });

        // Cerrar Modal de Configuración
        this.container.querySelector('#btn-close-config-modal')?.addEventListener('click', () => {
            this._closeConfigModal();
        });

        // Guardar Configuración
        this.container.querySelector('#btn-save-config-modal')?.addEventListener('click', async () => {
            await this._saveConfig();
        });

        // Cerrar modal al hacer clic fuera
        const configModal = this.container.querySelector('#cal-modal-config-dialog');
        configModal?.addEventListener('click', (e) => {
            if (e.target === configModal) {
                this._closeConfigModal();
            }
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
        const openNovBtn = this.container.querySelector('#btn-open-modal-novedad-cal');

        openNovBtn?.addEventListener('click', () => {
            this._openModalNovedad();
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

    _openModalNovedad(novedadExistente = null) {
        const modalNov = document.getElementById('cal-modal-novedad-dialog') || this.container.querySelector('#cal-modal-novedad-dialog');
        if (!modalNov) return;

        modalNov.style.display = '';
        if (modalNov.parentElement !== document.body) document.body.appendChild(modalNov);
        requestAnimationFrame(() => modalNov.classList.add('visible'));

        if (novedadExistente) {
            // Poblar modal con datos existentes
            this._poblarModalConNovedad(novedadExistente);
        } else {
            // Nueva novedad: limpiar cualquier índice de edición previo
            this._editingNovedadIdx = null;
            this._editingRowIdx = null;
            this._resetModalNovFields();
        }
        this._rebindModalEvents(modalNov);
    }

    /**
     * Puebla el modal con los datos de una novedad existente
     */
    _poblarModalConNovedad(novedad) {
        const modalNov = document.getElementById('cal-modal-novedad-dialog') || this.container.querySelector('#cal-modal-novedad-dialog');
        if (!modalNov || !novedad) return;

        const base = novedad.tipo_base || novedad.tipo || '';

        // 1. Tipo primero, y disparar change ANTES de poblar checks/filas,
        //    para que los wraps se muestren y NO se reseteen los valores.
        const tipoSel = modalNov.querySelector('#modal-nov-tipo');
        if (tipoSel && base) {
            tipoSel.value = base;
            tipoSel.dispatchEvent(new Event('change'));
        }

        // 2. Sin proceso (PROMOCIONES)
        const sinProcCheck = modalNov.querySelector('#modal-check-sin-proceso');
        if (sinProcCheck) sinProcCheck.checked = !!novedad.sin_proceso;

        // 3. Proceso anterior (COBROS): marcar check, mostrar select y setear proceso
        const procAntCheck = modalNov.querySelector('#modal-check-proceso-anterior');
        const selProcWrap = modalNov.querySelector('#modal-select-proceso-cobro');
        const procSel = modalNov.querySelector('#modal-cobro-proceso-val');
        if (procAntCheck) procAntCheck.checked = !!(novedad.proceso || novedad.procesoAnterior);
        if (selProcWrap) selProcWrap.style.display = (procAntCheck && procAntCheck.checked) ? 'block' : 'none';
        if (procSel && novedad.proceso) procSel.value = novedad.proceso;

        // 4. Limpiar y poblar filas con el contenido REAL de la tarjeta
        const codesWrap = modalNov.querySelector('#modal-codes-list');
        if (codesWrap) {
            codesWrap.innerHTML = '';
            const filas = Array.isArray(novedad.codigos) ? novedad.codigos : [];
            if (filas.length > 0) {
                filas.forEach(c => {
                    this._addModalCodeRow(c.talla ?? '', c.color ?? '', c.cantidad ?? 1);
                });
            } else {
                this._addModalCodeRow();
            }
        }
    }

    _closeModalNovedad() {
        const modalNov = document.getElementById('cal-modal-novedad-dialog');
        if (!modalNov) return;

        // Limpiar estado de edición al cerrar (evita reemplazos involuntarios)
        this._editingNovedadIdx = null;
        this._editingRowIdx = null;

        modalNov.classList.remove('visible');
        setTimeout(() => {
            modalNov.style.display = 'none';
            this.container.appendChild(modalNov);
        }, 250);
    }

    _rebindModalEvents(modal) {
        // ⚠️ CRÍTICO: El modal es UN SOLO nodo DOM que se mueve entre container y body.
        // Si rebindeamos listeners en cada apertura, se acumulan y al guardar se
        // ejecuta la acción N veces (creando tarjetas duplicadas).
        if (modal.dataset.eventsBound === 'true') return;
        modal.dataset.eventsBound = 'true';

        const closeBtn = modal.querySelector('#btn-close-nov-modal');
        const saveBtn = modal.querySelector('#btn-save-nov-modal');
        const addCodeBtn = modal.querySelector('#btn-modal-add-code');
        const tipoSel = modal.querySelector('#modal-nov-tipo');
        const checkProcAnt = modal.querySelector('#modal-check-proceso-anterior');

        closeBtn?.addEventListener('click', () => this._closeModalNovedad());
        saveBtn?.addEventListener('click', () => {
            const ok = this._guardarNovedadCalidadModal();
            if (ok) this._closeModalNovedad();
        });
        addCodeBtn?.addEventListener('click', () => this._addModalCodeRow());
        tipoSel?.addEventListener('change', () => {
            const val = tipoSel.value;
            const sinProcWrap = modal.querySelector('#modal-sin-proceso-wrap');
            const sinProcCheck = modal.querySelector('#modal-check-sin-proceso');
            const procAntWrap = modal.querySelector('#modal-proceso-anterior-wrap');
            const procAntCheck = modal.querySelector('#modal-check-proceso-anterior');
            const selProc = modal.querySelector('#modal-select-proceso-cobro');
            const procSel = modal.querySelector('#modal-cobro-proceso-val');

            if (sinProcWrap) sinProcWrap.style.display = (val === 'PROMOCIONES') ? 'block' : 'none';
            if (sinProcCheck && val !== 'PROMOCIONES') sinProcCheck.checked = false;
            if (procAntWrap) procAntWrap.style.display = (val === 'COBROS') ? 'block' : 'none';
            if (val !== 'COBROS') {
                if (procAntCheck) procAntCheck.checked = false;
                if (procSel) procSel.value = '';
                if (selProc) selProc.style.display = 'none';
            }
        });
        checkProcAnt?.addEventListener('change', () => {
            const selProc = modal.querySelector('#modal-select-proceso-cobro');
            if (selProc) selProc.style.display = checkProcAnt.checked ? 'block' : 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this._closeModalNovedad();
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
            this.firmaStrokes.push([pos]); // nuevo trazo
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();
            const pos = getXY(e);
            const current = this.firmaStrokes[this.firmaStrokes.length - 1];
            if (current) current.push(pos);
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
    }

    _initGPS(silent = false) {
        // Limpiar cualquier watchPosition anterior
        if (this.gpsWatchId) {
            navigator.geolocation.clearWatch(this.gpsWatchId);
            this.gpsWatchId = null;
        }

        // Limpiar cualquier timeout anterior
        if (this.gpsTimeoutId) {
            clearTimeout(this.gpsTimeoutId);
            this.gpsTimeoutId = null;
        }

        // Buscar elementos GPS dentro de la pestaña colapsada en LoteSelectorCard
        const loteMount = this.container.querySelector('#cal-lote-mount');
        const frameWrap = loteMount?.querySelector('#mapa-calidad-frame-wrap');

        // En modo silencioso (captura inmediata al abrir el formulario) no se
        // requiere que la pestaña/mapa exista todavía; solo se obtienen coords.
        if (!silent && !frameWrap) {
            console.warn('[GPS] Elementos GPS no encontrados en la pestaña colapsada');
            return;
        }

        // Mostrar estado de carga solo en modo visible (pestaña abierta)
        if (!silent && frameWrap) {
            frameWrap.innerHTML = `
            <div id="map-placeholder" class="f-map-loading">
                <span class="f-spinner"></span>
                <span>Cargando mapa de ubicación...</span>
            </div>
        `;
        }

        // Solicitar ubicación con configuración optimizada para mayor precisión
        if (!navigator.geolocation) {
            this.gpsData = { lat: null, lng: null, enabled: false };
            if (!silent) this._updateGPSUIError({ code: 0, message: 'Geolocalización no soportada' }, loteMount);
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        };

        // Usar watchPosition para obtener lecturas más precisas con el tiempo
        this.gpsWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                this.gpsData = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    enabled: true
                };

                // Actualizar UI únicamente si ya estaba abierta la pestaña
                if (!silent) this._updateGPSUI(loteMount);

                // Si la precisión es menor a 100m, cancelar watchPosition
                if (pos.coords.accuracy < 100 && this.gpsWatchId) {
                    navigator.geolocation.clearWatch(this.gpsWatchId);
                    this.gpsWatchId = null;
                }
            },
            (err) => {
                console.error('[GPS] Error obteniendo ubicación:', err);
                this.gpsData = { lat: null, lng: null, enabled: false };
                if (!silent) this._updateGPSUIError(err, loteMount);
                if (this.gpsWatchId) {
                    navigator.geolocation.clearWatch(this.gpsWatchId);
                    this.gpsWatchId = null;
                }
            },
            options
        );

        // Cancelar watchPosition después de 30 segundos si no se obtiene buena precisión
        this.gpsTimeoutId = setTimeout(() => {
            if (this.gpsWatchId) {
                navigator.geolocation.clearWatch(this.gpsWatchId);
                this.gpsWatchId = null;
            }
            this.gpsTimeoutId = null;
        }, 30000);
    }

    _updateGPSUI(container = null) {
        const searchContainer = container || this.container;
        const frameWrap = searchContainer.querySelector('#mapa-calidad-frame-wrap');

        if (!this.gpsData.enabled) return;

        // Renderizar Iframe de Google Maps interactivo
        if (frameWrap) {
            const lat = this.gpsData.lat;
            const lng = this.gpsData.lng;
            const iframeUrl = `https://maps.google.com/maps?q=${lat}%2C${lng}&z=16&output=embed`;
            
            // Crear iframe dinámicamente para asegurar que se renderice correctamente
            const iframe = document.createElement('iframe');
            iframe.className = 'f-map-iframe';
            iframe.src = iframeUrl;
            iframe.loading = 'lazy';
            iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
            iframe.setAttribute('allowfullscreen', '');
            
            frameWrap.innerHTML = '';
            frameWrap.appendChild(iframe);
        }
    }

    _updateGPSUIError(err, container = null) {
        const searchContainer = container || this.container;
        const frameWrap = searchContainer.querySelector('#mapa-calidad-frame-wrap');

        if (frameWrap) {
            frameWrap.innerHTML = `
                <div class="f-map-loading">
                    <span style="color:#ef4444;">Sin señal de ubicación</span>
                </div>
            `;
        }
    }

    _getGPSErrorMessage(err) {
        switch (err.code) {
            case err.PERMISSION_DENIED:
                return 'Permiso denegado';
            case err.POSITION_UNAVAILABLE:
                return 'Ubicación no disponible';
            case err.TIMEOUT:
                return 'Tiempo de espera agotado';
            default:
                return err.message || 'Error desconocido';
        }
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
        const modal = document.getElementById('cal-modal-novedad-dialog');
        if (!modal) return;

        const tipoSel = modal.querySelector('#modal-nov-tipo');
        if (tipoSel) tipoSel.value = '';
        const sinProcCheck = modal.querySelector('#modal-check-sin-proceso');
        if (sinProcCheck) sinProcCheck.checked = false;
        const procAntCheck = modal.querySelector('#modal-check-proceso-anterior');
        if (procAntCheck) procAntCheck.checked = false;

        modal.querySelector('#modal-sin-proceso-wrap').style.display = 'none';
        modal.querySelector('#modal-proceso-anterior-wrap').style.display = 'none';
        modal.querySelector('#modal-select-proceso-cobro').style.display = 'none';
        const procSel = modal.querySelector('#modal-cobro-proceso-val');
        if (procSel) procSel.value = '';

        const codesList = modal.querySelector('#modal-codes-list');
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

    _addModalCodeRow(talla = '', color = '', cantidad = 1) {
        const modal = document.getElementById('cal-modal-novedad-dialog');
        const container = modal ? modal.querySelector('#modal-codes-list') : this.container.querySelector('#modal-codes-list');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'f-code-row';
        row.innerHTML = `
            <input type="text" class="f-input-sm c-talla" placeholder="Talla (S, M, 32...)" value="${talla}" style="flex:1;" />
            <input type="text" class="f-input-sm c-color" placeholder="Color" value="${color}" style="flex:1;" />
            <input type="number" class="f-input-sm c-cant" min="1" value="${cantidad}" placeholder="Cant." style="width:70px;" />
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
            const curU = String(cur || '').toUpperCase().trim();
            sel.innerHTML = [`<option value="">${placeholder}</option>`]
                .concat(list.map(o => `<option value="${o}" ${o === curU ? 'selected' : ''}>${o}</option>`))
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
        const modal = document.getElementById('cal-modal-novedad-dialog');
        const container = modal ? modal.querySelector('#modal-codes-list') : this.container.querySelector('#modal-codes-list');
        if (!container) return;
        const rows = container.querySelectorAll('.f-code-row');
        rows.forEach(row => this._upgradeRowSelects(row));
    }

    _guardarNovedadCalidadModal() {
        const modal = document.getElementById('cal-modal-novedad-dialog');
        if (!modal) return false;

        const tipo = modal.querySelector('#modal-nov-tipo')?.value;
        if (!tipo) {
            Toast.warning('Seleccione el tipo de novedad.');
            return false;
        }

        const sinProcesoCheck = modal.querySelector('#modal-check-sin-proceso');
        const procAntCheck = modal.querySelector('#modal-check-proceso-anterior');
        const procSel = modal.querySelector('#modal-cobro-proceso-val');

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
        const rows = modal.querySelectorAll('#modal-codes-list .f-code-row');
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

        // El tipo de novedad NO se modifica al guardar: SIEMPRE se persiste el
        // tipo base (COBROS, PROMOCIONES, ...). El proceso anterior de COBROS
        // se guarda en el campo `proceso`; la UI sí muestra "COBRO - PROCESO"
        // pero en BD el `tipo` sigue siendo "COBROS".
        const tipoBase = tipo;
        const displayTipo = tipoBase;

        const nuevaNovedad = {
            tipo: displayTipo,
            tipo_base: tipoBase,
            sin_proceso: sinProceso,
            proceso: procesoCobro || null,
            codigos: codigosCompactados,
            totalUnidades: codigosCompactados.reduce((acc, c) => acc + c.cantidad, 0)
        };

        // Si estamos editando, reemplazar la novedad existente
        const esEdicion = (this._editingNovedadIdx !== undefined && this._editingNovedadIdx !== null);
        
        if (esEdicion) {
            // Al editar: si el nuevo tipo/flags coincide con OTRA tarjeta existente,
            // fusionar en una sola (no dejar dos tarjetas iguales en la interfaz)
            const editIdx = this._editingNovedadIdx;
            const dupIdx = (tipoBase === 'COBROS')
                ? -1 // COBROS con proceso distinto mantiene tarjetas separadas
                : this._findIndiceDestinoNovedad(displayTipo, tipoBase, sinProceso, procesoCobro, editIdx);
            if (dupIdx !== -1) {
                const destino = this.novedadesAgregadas[dupIdx];
                destino.codigos = this._compactarCodigosNovedad(destino.codigos.concat(codigosCompactados));
                destino.totalUnidades = destino.codigos.reduce((acc, c) => acc + c.cantidad, 0);
                this.novedadesAgregadas.splice(editIdx, 1);
            } else {
                this.novedadesAgregadas[editIdx] = nuevaNovedad;
            }
            this._editingNovedadIdx = null;
            this._editingRowIdx = null;
        } else {
            // Merge: si ya existe una tarjeta del mismo tipo (+ mismo proceso/sin_proceso),
            // agregar las filas a esa tarjeta en vez de crear una duplicada
            let destinoIdx = -1;
            if (tipoBase === 'COBROS') {
                if (procesoCobro) {
                    // Mismo proceso anterior → misma tarjeta (definido por `proceso`, no por `tipo`)
                    destinoIdx = this.novedadesAgregadas.findIndex(n => (n.tipo_base === 'COBROS' || n.tipo === 'COBROS') && n.proceso === procesoCobro);
                } else {
                    destinoIdx = this.novedadesAgregadas.findIndex(n => (n.tipo_base === 'COBROS' || n.tipo === 'COBROS') && !n.proceso);
                }
            } else {
                destinoIdx = this._findIndiceDestinoNovedad(displayTipo, tipoBase, sinProceso, procesoCobro, -1);
            }

            if (destinoIdx !== -1) {
                const destino = this.novedadesAgregadas[destinoIdx];
                destino.codigos = this._compactarCodigosNovedad(destino.codigos.concat(codigosCompactados));
                destino.totalUnidades = destino.codigos.reduce((acc, c) => acc + c.cantidad, 0);
            } else {
                this.novedadesAgregadas.push(nuevaNovedad);
            }
        }

        this._renderNovedadesCalidadList();
        Toast.success(esEdicion ? 'Novedad actualizada.' : 'Novedad añadida al reporte.');
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
     * Busca el índice de una tarjeta destino con el mismo tipo + flags,
     * ignorando el índice `excluirIdx` (útil al editar para no autofusionarse).
     * Retorna -1 si no hay coincidencia.
     */
    _findIndiceDestinoNovedad(displayTipo, tipoBase, sinProceso, procesoCobro, excluirIdx = -1) {
        // `tipo_base` ya no se persiste; para COBROS la agrupación depende solo
        // de `tipo === "COBROS"` (los objetos cargados sin `tipo_base` igual
        // deben fusionarse con los nuevos).
        const matchTipoBase = (n) => (tipoBase === 'COBROS'
            ? (n.tipo === 'COBROS' || (n.tipo_base || '') === 'COBROS')
            : (n.tipo_base || '') === (tipoBase || ''));
        return this.novedadesAgregadas.findIndex((n, i) =>
            i !== excluirIdx &&
            n.tipo === displayTipo &&
            matchTipoBase(n) &&
            !!n.sin_proceso === !!sinProceso &&
            (n.proceso || '') === (procesoCobro || '')
        );
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
            if (n.sin_proceso) return { color: '#db2777', bg: '#fdf2f8', icon: 'alert', label: 'PROMOCIÓN - SIN PROCESO' };
            return { color: '#f59e0b', bg: '#fffbeb', icon: 'percent', label: t };
        }
        // COBROS: en BD `tipo` SIEMPRE es "COBROS" (el detalle está en `proceso`),
        // pero la UI muestra "COBRO - PROCESO" cuando hay proceso anterior.
        if (t.startsWith('COBRO -')) return { color: '#8b5cf6', bg: '#f5f3ff', icon: 'money', label: t }; // legado guardado antes del fix
        if (t === 'COBROS' || tb === 'COBROS') {
            const label = n.proceso ? `COBRO - ${n.proceso}` : 'COBROS';
            return n.proceso
                ? { color: '#8b5cf6', bg: '#f5f3ff', icon: 'money', label }
                : { color: '#10b981', bg: '#ecfdf5', icon: 'invoice', label };
        }
        if (t === 'LAVADO') return { color: '#6366f1', bg: '#eef2ff', icon: 'water', label: t };
        return { color: '#3b82f6', bg: '#eff6ff', icon: 'tag', label: t };
    }
    _renderNovedadesCalidadList() {
        const container = this.container.querySelector('#cal-novedades-cards-list');
        if (!container) return;

        // Delegación única: se asigna una sola vez por nodo contenedor.
        // El contenedor NO se re-crea en cada render (solo su innerHTML), así el listener nunca se duplica.
        if (!container.dataset.eventsBound) {
            container.onclick = (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                e.stopPropagation();
                e.preventDefault();
                const idx = parseInt(btn.dataset.index, 10);
                if (isNaN(idx)) return;

                if (btn.classList.contains('f-btn-edit-nov-card')) {
                    this._editNovedad(idx);
                } else if (btn.classList.contains('f-btn-del-nov-card')) {
                    const ci = parseInt(btn.dataset.code, 10);
                    const grp = this.novedadesAgregadas[idx];
                    if (!grp) return;
                    grp.codigos.splice(ci, 1);
                    if (grp.codigos.length === 0) {
                        this.novedadesAgregadas.splice(idx, 1);
                    } else {
                        grp.totalUnidades = grp.codigos.reduce((a, c) => a + c.cantidad, 0);
                    }
                    this._renderNovedadesCalidadList();
                }
            };
            container.dataset.eventsBound = 'true';
        }

        if (!this.novedadesAgregadas.length) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.novedadesAgregadas.map((n, idx) => {
            const th = this._novedadTheme(n);
            const rows = n.codigos.map((c, ci) => `
                <div class="f-nov-tr" title="${c.talla} / ${c.color}">
                    <span class="f-nov-talla" title="${c.talla}">${c.talla}</span>
                    <span class="f-nov-color" title="${c.color}">${c.color}</span>
                    <span class="f-nov-cant">${c.cantidad}</span>
                    <span class="f-nov-actions">
                        <button type="button" class="f-btn-del-nov-card" data-index="${idx}" data-code="${ci}" title="Eliminar">
                            ${this._novIcon('trash')}
                        </button>
                    </span>
                </div>
            `).join('');

            return `
                <div class="f-nov-table-card" style="border-top-color:${th.color};">
                    <div class="f-nov-table-head" style="background:${th.bg};color:${th.color};">
                        <span class="f-nov-tipo-ico" style="color:inherit;">${this._novIcon(th.icon)}</span>
                        <span class="f-nov-table-tipo">${th.label}</span>
                        <span class="f-nov-table-units">${n.totalUnidades} UDS.</span>
                        <span class="f-nov-card-actions">
                            <button type="button" class="f-btn-edit-nov-card" data-index="${idx}" title="Editar">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                        </span>
                    </div>
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

        // FIN: la delegación ya quedó bindeada arriba (una sola vez por contenedor).
    }

    /**
     * Abre el modal de novedad para editar una existente
     */
    _editNovedad(idx) {
        const novedad = this.novedadesAgregadas[idx];
        if (!novedad) return;
        this._editingNovedadIdx = idx;
        this._openModalNovedad(novedad);
    }

    _limpiarFormulario() {
        this.container.querySelector('#form-calidad-full')?.reset();
        this.novedadesAgregadas = [];
        this._editingNovedadIdx = null;
        this._editingRowIdx = null;
        // Re-render directo sin rebindear (el onclick por delegación se asigna una sola vez)
        const listEl = this.container.querySelector('#cal-novedades-cards-list');
        if (listEl) listEl.innerHTML = '';
        if (this.dropzone) this.dropzone.clear();
        if (this.firmaCtx && this.firmaCanvas) {
            this.firmaCtx.clearRect(0, 0, this.firmaCanvas.width, this.firmaCanvas.height);
            this.haFirmado = false;
            this.firmaStrokes = [];
        }
        Toast.info('Formulario restablecido.');
    }

    /**
     * Exporta la firma como SVG vectorial (muy liviano, ~1-8KB), replicando el
     * comportamiento del legacy `FirmaTaller.getSVG()` (firma.js):
     *   - Sin usar base64/PNG: la columna firma_svg recibe SVG texto plano.
     *   - Norma a viewBox 600×150, autocontenido, centrado.
     * Devuelve null si no hay trazos (no se debe guardar nada).
     */
    _generarFirmaSvg() {
        if (!this.firmaStrokes || !this.haFirmado || this.firmaStrokes.length === 0) return null;

        const W = 600;
        const H = 150;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        this.firmaStrokes.forEach(stroke => {
            stroke.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
        });

        if (minX === Infinity || minY === Infinity) {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"></svg>`;
        }

        const sigW = maxX - minX;
        const sigH = maxY - minY;

        const maxUsefulW = W - 40;
        const maxUsefulH = H - 30;

        let scale = 1;
        if (sigW > 0 || sigH > 0) {
            const scaleX = maxUsefulW / (sigW || 1);
            const scaleY = maxUsefulH / (sigH || 1);
            scale = Math.min(scaleX, scaleY, 1.5);
        }

        const finalSigW = sigW * scale;
        const finalSigH = sigH * scale;
        const offsetX = (W - finalSigW) / 2;
        const offsetY = (H - finalSigH) / 2;

        const paths = this.firmaStrokes.map(stroke => {
            if (stroke.length < 2) return '';
            const d = stroke.map((p, i) => {
                const x = ((p.x - minX) * scale + offsetX).toFixed(1);
                const y = ((p.y - minY) * scale + offsetY).toFixed(1);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
            return `<path d="${d}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
        }).join('');

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${paths}</svg>`;
    }

    /**
     * Payload de localización para el envío:
     *   - Si NO hay localización activa → null (no se guarda nada).
     *   - Si está activa con coords válidas → solo { lat, lng }.
     * Nunca envía { lat: null, lng: null, enabled: true }.
     */
    _getGpsPayload() {
        const g = this.gpsData || {};
        if (!g.enabled) return null;
        const lat = Number(g.lat);
        const lng = Number(g.lng);
        if (Number.isNaN(lat) || Number.isNaN(lng) || lat === 0 || lng === 0) return null;
        return { lat, lng };
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
            const firmaSvg = this._generarFirmaSvg();
            const payload = {
                lote: this.activeLote.lote || this.activeLote.op,
                op: this.activeLote.op || this.activeLote.lote,
                planta: this.activeLote.planta,
                modulo: this.activeLote.modulo || this.activeLote.linea,
                linea: this.activeLote.linea,
                cuento: this.activeLote.cuento || this.activeLote.modulo || this.activeLote.linea,
                referencia: this.activeLote.referencia,
                tipoPrenda: this.activeLote.tipoPrenda,
                prenda: this.activeLote.tipoPrenda || this.activeLote.descripcion || this.activeLote.prenda,
                descripcion: this.activeLote.descripcion || this.activeLote.tipoPrenda,
                proceso: this.activeLote.proceso || this.activeLote.PROCESO || '',
                genero: this.activeLote.genero || '',
                tejido: this.activeLote.tejido || '',
                fechaSalida: this.activeLote.fechaSalida || this.activeLote.salida || this.activeLote.SALIDA || '',
                fechaEntrega: this.activeLote.fechaEntrega || this.activeLote.entrada || this.activeLote.ENTRADA || '',
                salida: this.activeLote.fechaSalida || this.activeLote.salida || this.activeLote.SALIDA || '',
                entrada: this.activeLote.fechaEntrega || this.activeLote.entrada || this.activeLote.ENTRADA || '',
                productora: this.activeLote.idProductora || this.activeLote.productora || this.activeLote.PRODUCTORA || '',
                idProductora: this.activeLote.idProductora || this.activeLote.productora || '',
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
                // `tipo_base` es helper interno de la UI (agrupar tarjetas); NO se envía
                novedadesAsociadas: this.novedadesAgregadas.map(n => {
                    const { tipo_base, ...rest } = n;
                    return rest;
                }),
                observaciones: this.container.querySelector('#cal-observaciones-text')?.value,
                aql: this.aqlConfig,
                gps: this._getGpsPayload(),
                firma: firmaSvg,
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

    _openConfigModal() {
        const modal = this.container.querySelector('#cal-modal-config-dialog');
        if (!modal) return;

        // Cargar configuración actual si existe
        this._loadConfigToModal();

        modal.style.display = '';
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('visible'));
    }

    _closeConfigModal() {
        const modal = document.getElementById('cal-modal-config-dialog');
        if (!modal) return;

        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
            this.container.appendChild(modal);
        }, 250);
    }

    _loadConfigToModal() {
        // Configuración por defecto
        const defaultConfig = {
            searchFields: {
                productora: true,
                op: true,
                referencia: true,
                planta: true
            },
            filters: {
                productora: true
            },
            tabs: {
                aql: true,
                curva: true,
                gps: true
            }
        };

        // Cargar configuración guardada o usar default
        const savedConfig = this.searchConfig || defaultConfig;

        // Buscar el modal en document.body (donde se movió al abrir)
        const modal = document.getElementById('cal-modal-config-dialog');
        if (!modal) return;

        // Actualizar checkboxes de campos de búsqueda
        const prodCheck = modal.querySelector('#config-search-productora');
        const opCheck = modal.querySelector('#config-search-op');
        const refCheck = modal.querySelector('#config-search-referencia');
        const plantaCheck = modal.querySelector('#config-search-planta');

        if (prodCheck) prodCheck.checked = savedConfig.searchFields.productora;
        if (opCheck) opCheck.checked = savedConfig.searchFields.op;
        if (refCheck) refCheck.checked = savedConfig.searchFields.referencia;
        if (plantaCheck) plantaCheck.checked = savedConfig.searchFields.planta;

        // Actualizar checkboxes de filtros
        const filterProdCheck = modal.querySelector('#config-filter-productora');
        if (filterProdCheck) filterProdCheck.checked = savedConfig.filters?.productora ?? true;

        // Actualizar checkboxes de pestañas
        const aqlCheck = modal.querySelector('#config-tab-aql');
        const curvaCheck = modal.querySelector('#config-tab-curva');
        const gpsCheck = modal.querySelector('#config-tab-gps');

        if (aqlCheck) aqlCheck.checked = savedConfig.tabs.aql;
        if (curvaCheck) curvaCheck.checked = savedConfig.tabs.curva;
        if (gpsCheck) gpsCheck.checked = savedConfig.tabs.gps;
    }

    async _saveConfig() {
        // Buscar el modal en document.body (donde se movió al abrir)
        const modal = document.getElementById('cal-modal-config-dialog');
        if (!modal) {
            Toast.error('Modal de configuración no encontrado');
            return;
        }

        // Validar que al menos 1 campo de búsqueda esté seleccionado
        const searchFields = {
            productora: modal.querySelector('#config-search-productora')?.checked || false,
            op: modal.querySelector('#config-search-op')?.checked || false,
            referencia: modal.querySelector('#config-search-referencia')?.checked || false,
            planta: modal.querySelector('#config-search-planta')?.checked || false
        };

        const selectedSearchFields = Object.values(searchFields).filter(v => v).length;
        if (selectedSearchFields === 0) {
            Toast.error('Debes seleccionar al menos 1 campo de búsqueda');
            return;
        }

        // Guardar configuración
        this.searchConfig = {
            searchFields,
            filters: {
                productora: modal.querySelector('#config-filter-productora')?.checked || false
            },
            tabs: {
                aql: modal.querySelector('#config-tab-aql')?.checked || false,
                curva: modal.querySelector('#config-tab-curva')?.checked || false,
                gps: modal.querySelector('#config-tab-gps')?.checked || false
            }
        };

        // Guardar en perfil de usuario (JSONB)
        await this._saveConfigToUserProfile();

        // Aplicar configuración al LoteSelectorCard (maneja visibilidad internamente)
        if (this.loteSelector) {
            this.loteSelector.updateConfig(this.searchConfig);
        }

        Toast.success('Configuración guardada correctamente');
        this._closeConfigModal();
    }

    async _saveConfigToUserProfile() {
        try {
            // Obtener token de localStorage (forma más simple)
            let accessToken = null;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.includes('-auth-token')) continue;
                const s = JSON.parse(localStorage.getItem(k) || 'null');
                if (s?.access_token) {
                    accessToken = s.access_token;
                    break;
                }
            }

            if (!accessToken) {
                throw new Error('No hay sesión de usuario activa');
            }

            // Llamar a edge function /perfiles con acción ACTUALIZAR_CONFIG_BUSQUEDA
            const resp = await fetch(`${ENV.FUNCTIONS_URL}/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': ENV.SUPABASE_KEY
                },
                body: JSON.stringify({
                    accion: 'ACTUALIZAR_CONFIG_BUSQUEDA',
                    config_busqueda: this.searchConfig
                })
            });

            const result = await resp.json();
            if (!resp.ok || !result.success) {
                throw new Error(result.message || 'Error al guardar configuración');
            }
        } catch (err) {
            console.error('[Config] Error guardando configuración:', err);
            Toast.error('Error al guardar configuración: ' + err.message);
        }
    }

    async _loadConfigFromUserProfile() {
        try {
            // Obtener token de localStorage (forma más simple)
            let accessToken = null;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.includes('-auth-token')) continue;
                const s = JSON.parse(localStorage.getItem(k) || 'null');
                if (s?.access_token) {
                    accessToken = s.access_token;
                    break;
                }
            }

            if (!accessToken) {
                return;
            }

            // Llamar a edge function /perfiles con acción OBTENER_PERFIL
            const resp = await fetch(`${ENV.FUNCTIONS_URL}/perfiles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': ENV.SUPABASE_KEY
                },
                body: JSON.stringify({ accion: 'OBTENER_PERFIL' })
            });

            const result = await resp.json();
            if (resp.ok && result.success && result.data?.config_busqueda) {
                this.searchConfig = result.data.config_busqueda;

                // Aplicar configuración al LoteSelectorCard si ya existe
                if (this.loteSelector) {
                    this.loteSelector.updateConfig(this.searchConfig);
                }
            }
        } catch (err) {
            // Usar configuración por defecto en caso de error
        }
    }
}
