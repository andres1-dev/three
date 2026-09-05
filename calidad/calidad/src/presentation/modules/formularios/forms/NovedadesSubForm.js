import { Toast } from '../../../components/Toast.js';
import { MediaDropzone } from '../components/MediaDropzone.js';
import { LoteSelectorCard } from '../components/LoteSelectorCard.js';

const INSUMOS_LIST = [
    'ETIQUETA', 'PLACA', 'PLASTIFLECHA', 'TRAZABILIDAD', 'ELASTICO',
    'ARGOLLA', 'TENSOR', 'FRAMILON', 'TRANSFER', 'MARQUILLA',
    'CIERRE', 'CORDON', 'HILADILLA', 'HERRAJE', 'HEBILLA', 'ABROCHADURA',
    'APLIQUE', 'BOTON', 'GANCHO', 'PUNTERAS', 'COPA', 'ENCAJE', 'VARILLA',
    'ENTRETELA', 'VELCRO', 'OJALES', 'REMACHES', 'OTROS'
];

const CORTE_LIST = ['PIEZAS', 'SESGO', 'ENTRETELA'];

const TELAS_LIST = [
    'ROTOS', 'MANCHAS', 'HIDOS', 'MAREADA', 'TONO',
    'SE DESTIÑE', 'SE ROMPE', 'OTROS'
];

const CODIGOS_TALLAS_LIST = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
    '2', '4', '6', '8', '10', '12', '14', '16', '18',
    '28', '30', '32', '34', '36', '38', '40', '42',
    'UNICA', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'
];

const CODIGOS_COLORES_LIST = [
    'AGUA', 'AGUA MARINA', 'ALMENDRA', 'AMARILLO', 'AMARILLO CIELO', 'AMARILLO CLARO', 'AMARILLO MEDIO', 'AMARILLO NEON',
    'ARENA', 'AVENA', 'AZUL', 'AZUL AGUAMARINA', 'AZUL CELESTE', 'AZUL CIELO', 'AZUL CLARO',
    'AZUL DENIM', 'AZUL ELECTRICO', 'AZUL HORTENSIA', 'AZUL INDIGO', 'AZUL MEDIO', 'AZUL OSCURO', 'AZUL PETROLEO', 'AZUL REY',
    'AZULTURQUI', 'BABY BLUE', 'BEIGE', 'BERENJENA', 'BLANCO', 'BLANCO/AZUL', 'BLANCO/DORADO', 'BLANCO/NAVY', 'BLANCO/NEGRO',
    'BLANCO/PLATEADO', 'BLANCO/ROJO', 'BLANCO/ROSADO', 'BLANCO-FUCSIA', 'CAFÉ', 'CAFÉ CLARO', 'CAFÉ OSCURO', 'CAMEL',
    'CARAMELO', 'COBRE', 'COCOA', 'CORAL', 'CORAL NEON', 'CREMA', 'CRUDO', 'CRUDO/NEGRO', 'CURUBA', 'DORADO', 'DORADO PERLA',
    'DORADO/NEGRO', 'ESMERALDA', 'FUCSIA', 'FUCSIA BRILLANT', 'FUCSIA NEON', 'GRIS', 'GRIS / MILITAR', 'GRIS CLARO',
    'GRIS CLARO JASP', 'GRIS CROSS', 'GRIS FUSIL', 'GRIS JASPE', 'GRIS JASPE CLARO', 'GRIS JASPE MEDIO', 'GRIS JASPE OSC',
    'GRIS MEDIO', 'GRIS MELANGE CL', 'GRIS MELANGE OS', 'GRIS OSC JASPE', 'GRISOSCURO', 'HABANO', 'IVORY', 'JADE', 'JADE JASPE',
    'KAKY', 'KAKY CLARO', 'KAKY OSCURO', 'LILA', 'LILA CLARO', 'LILA OSCURO', 'MAGENTA', 'MANDARINA', 'MANDARINA NEON',
    'MARFIL', 'MARRON', 'MORA LECHE', 'MORADO', 'MORADO CLARO', 'MORADO OSCURO', 'MOSTAZA', 'NARANJA', 'NARANJA NEON',
    'NAVY', 'NEGRO', 'NEGRO CROSS', 'NEGRO JASPE', 'NEGRO/AMARILLO', 'NEGRO/AZUL', 'NEGRO/BLANCO', 'NEGRO/DORADO',
    'NEGRO/PLATEADO', 'NEGRO-ROJO', 'NEW BLU', 'NIQUEL', 'NUDE', 'OCRE', 'OFFWHITE', 'ORO ROSA', 'PACIFICO', 'PALO DE ROSA',
    'PALO ROSA JASPE', 'PAVON', 'PAVONADO', 'PETROLEO', 'PLATA/DORADO', 'PLATA/NEGRO', 'PLATEADO', 'PLOMO', 'PPT', 'PROMOCION',
    'ROJO', 'ROJO ESCARLATA', 'ROJO FIESTA', 'ROJO VERDE', 'ROJO/NEGRO', 'ROJO-AZUL', 'ROSA', 'ROSA CLARO', 'ROSA LILA',
    'ROSADO', 'ROSADO CLARO', 'ROSADO NEON', 'ROSADO/NEGRO', 'ROSAMORA', 'ROSANEON', 'ROSEQUARZ', 'RUBOR', 'SALMON', 'TAUPE',
    'TERRACOTA', 'TORNASOL', 'TRANSPARENTE', 'TRICOLOR', 'TURQUEZA', 'TURQUI', 'VAINILLA', 'VERDE', 'VERDE AGUA', 'VERDE BOTELLA',
    'VERDE CALI', 'VERDE CLARO', 'VERDE ESMERALDA', 'VERDE FOLLAGE', 'VERDE JADE', 'VERDE JASPE', 'VERDE LIMON', 'VERDE MANZANA',
    'VERDE MENTA', 'VERDE MILITAR', 'VERDE NEON', 'VERDE OLIVA', 'VERDE PINO', 'VERDE SALVIA', 'VERDE SELVA', 'VINO TINTO',
    'WHITE', 'ZAPOTE'
];

export class NovedadesSubForm {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Object} options.activeLote
     * @param {Array} options.lotes
     * @param {Array} options.productoras
     * @param {string} options.selectedProductora
     * @param {Function} options.onSearchLotes
     * @param {Function} options.onProductoraChange
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
        this._syncLoteDataIntoForm();
    }

    _render() {
        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn" id="btn-back-to-hub" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Novedades</h1>
            </div>

            <!-- Selector de Lote Integrado On-Demand -->
            <div id="nov-lote-mount" class="f-mount-section"></div>

            <form id="form-novedades" class="f-subform-body">
                <div class="f-section-title">
                    <span class="pill-num">1</span>
                    <span>Clasificación de la Novedad</span>
                </div>

                <div class="f-form-grid">
                    <!-- Área de Servicios Principal (Conduce las opciones dinámicas) -->
                    <div class="f-form-group">
                        <label class="f-label">Área de Servicios <span class="req">*</span></label>
                        <select id="nov-area" class="f-select" required>
                            <option value="">Seleccione un área...</option>
                            <option value="INSUMOS">INSUMOS</option>
                            <option value="CORTE">CORTE</option>
                            <option value="CODIGOS">CÓDIGOS</option>
                            <option value="DISEÑO">DISEÑO</option>
                            <option value="TELAS">TELAS</option>
                            <option value="OTROS">OTROS</option>
                        </select>
                    </div>

                    <!-- Tipo de Novedad (condicional / reactivo al área) -->
                    <div class="f-form-group" id="grp-nov-tipo">
                        <label class="f-label">Tipo de Novedad <span class="req">*</span></label>
                        <select id="nov-tipo" class="f-select" required>
                            <option value="">Seleccione tipo...</option>
                            <option value="FALTANTE">FALTANTE</option>
                            <option value="IMPERFECTO">IMPERFECTO</option>
                            <option value="PERDIDA">PERDIDA</option>
                            <option value="CAMBIO">CAMBIO</option>
                        </select>
                    </div>

                    <!-- Cantidad Solicitada para DISEÑO (no editable, auto-cargada del lote) -->
                    <div class="f-form-group" id="grp-cant-diseno" style="display:none;">
                        <label class="f-label">Cantidad Total Solicitada <span class="req">*</span></label>
                        <input type="number" id="nov-cant-diseno" class="f-input" readonly placeholder="Cantidad total del lote" />
                    </div>

                    <!-- Cantidad Normal para OTROS -->
                    <div class="f-form-group" id="grp-cant-normal" style="display:none;">
                        <label class="f-label">Cantidad Solicitada <span class="req">*</span></label>
                        <input type="number" id="nov-cant-normal" class="f-input" min="1" placeholder="Ingrese cantidad..." />
                    </div>
                </div>

                <!-- ── SECCIÓN DINÁMICA: INSUMOS ── -->
                <div class="f-dynamic-block" id="sec-dyn-insumos" style="display:none;">
                    <div class="f-dynamic-header">
                        <div class="f-dynamic-title">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                                <line x1="7" y1="7" x2="7.01" y2="7"/>
                            </svg>
                            <span>Detalle de Insumos Afectados</span>
                        </div>
                        <button type="button" class="f-btn-add-item" id="btn-add-insumo">+ Agregar Insumo</button>
                    </div>
                    <div id="insumos-list-container" class="f-dynamic-list"></div>
                </div>

                <!-- ── SECCIÓN DINÁMICA: CORTE ── -->
                <div class="f-dynamic-block" id="sec-dyn-corte" style="display:none;">
                    <div class="f-dynamic-header">
                        <div class="f-dynamic-title">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="6" cy="6" r="3"/>
                                <circle cx="6" cy="18" r="3"/>
                                <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                                <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
                            </svg>
                            <span>Detalle de Defectos en Corte / Moldería</span>
                        </div>
                        <button type="button" class="f-btn-add-item" id="btn-add-corte">+ Agregar Corte</button>
                    </div>
                    <div id="corte-list-container" class="f-dynamic-list"></div>
                </div>

                <!-- ── SECCIÓN DINÁMICA: TELAS ── -->
                <div class="f-dynamic-block" id="sec-dyn-telas" style="display:none;">
                    <div class="f-dynamic-header">
                        <div class="f-dynamic-title">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M2 12h20M12 2v20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/>
                            </svg>
                            <span>Detalle de Imperfecciones en Tela</span>
                        </div>
                        <button type="button" class="f-btn-add-item" id="btn-add-tela">+ Agregar Defecto</button>
                    </div>
                    <div id="telas-list-container" class="f-dynamic-list"></div>
                </div>

                <!-- ── SECCIÓN DINÁMICA: CÓDIGOS ── -->
                <div class="f-dynamic-block" id="sec-dyn-codigos" style="display:none;">
                    <div class="f-dynamic-header">
                        <div class="f-dynamic-title">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="16" rx="2"/>
                                <line x1="7" y1="8" x2="7" y2="16"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="17" y1="8" x2="17" y2="16"/>
                            </svg>
                            <span>Solicitud de Códigos / Etiquetas</span>
                        </div>
                    </div>

                    <div class="f-form-grid" style="margin-bottom:10px;">
                        <div class="f-form-group">
                            <label class="f-label">Tipo de Solicitud <span class="req">*</span></label>
                            <select id="codigos-tipo-solicitud" class="f-select">
                                <option value="">Seleccione...</option>
                                <option value="LOTE_COMPLETO">LOTE COMPLETO</option>
                                <option value="UNIDADES">UNIDADES ESPECÍFICAS</option>
                            </select>
                        </div>

                        <div class="f-form-group" id="grp-codigos-lote-completo" style="display:none;">
                            <label class="f-label">Cantidad Total del Lote</label>
                            <input type="number" id="codigos-cantidad-total" class="f-input" readonly disabled placeholder="Total del lote" />
                        </div>
                    </div>

                    <div id="grp-codigos-unidades" style="display:none;">
                        <div class="f-dynamic-header" style="margin-top:6px;">
                            <span class="f-label">Desglose por Talla, Color y Cantidad</span>
                            <button type="button" class="f-btn-add-item" id="btn-add-codigo">+ Agregar Código</button>
                        </div>
                        <div id="codigos-list-container" class="f-dynamic-list"></div>
                    </div>
                </div>

                <!-- Datalists globales para Códigos -->
                <datalist id="datalist-colores-novedad">
                    ${CODIGOS_COLORES_LIST.map(c => `<option value="${c}"></option>`).join('')}
                </datalist>
                <datalist id="datalist-tallas-novedad">
                    ${CODIGOS_TALLAS_LIST.map(t => `<option value="${t}"></option>`).join('')}
                </datalist>

                <!-- Observaciones y Descripción Detallada -->
                <div class="f-form-group full" style="margin-top: 14px;">
                    <label class="f-label">Descripción Detallada y Contexto</label>
                    <textarea id="nov-observaciones" class="f-textarea" rows="3" placeholder="Escriba aquí los detalles y justificación de la novedad..."></textarea>
                </div>

                <!-- Dropzone de Imágenes -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">2</span>
                    <span>Evidencias y Soportes Fotográficos</span>
                </div>
                <div id="nov-dropzone-mount"></div>

                <!-- Acciones Submit -->
                <div class="f-submit-actions">
                    <button type="submit" class="f-btn-submit" id="btn-submit-novedad">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                        <span>Registrar y Enviar Novedad</span>
                    </button>
                </div>
            </form>
        `;

        // Instanciar Selector de Lote On-Demand
        const loteMount = this.container.querySelector('#nov-lote-mount');
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
            this._syncLoteDataIntoForm();
        }

        // Instanciar Dropzone
        const dropzoneMount = this.container.querySelector('#nov-dropzone-mount');
        this.dropzone = new MediaDropzone({
            container: dropzoneMount,
            maxFiles: 5
        });

        this._bindEvents();
    }

    _syncLoteDataIntoForm() {
        if (!this.activeLote) return;
        const cant = this.activeLote.cantidad || 0;

        const cantDiseno = this.container.querySelector('#nov-cant-diseno');
        if (cantDiseno) cantDiseno.value = cant;

        const cantCodigos = this.container.querySelector('#codigos-cantidad-total');
        if (cantCodigos) cantCodigos.value = cant;

        this._updateFilteredSizes();
    }

    _updateFilteredSizes() {
        const datalistTallas = this.container.querySelector('#datalist-tallas-novedad');
        if (!datalistTallas) return;

        let sizes = [...CODIGOS_TALLAS_LIST];
        if (this.activeLote) {
            const genero = (this.activeLote.genero || '').toUpperCase();
            const prenda = (this.activeLote.tipoPrenda || this.activeLote.prenda || '').toUpperCase();

            if (genero.includes('BEBE')) {
                sizes = sizes.filter(s => s.includes('M') || s === 'UNICA');
            } else if (genero.includes('NIÑ')) {
                sizes = sizes.filter(s => {
                    const n = parseInt(s, 10);
                    return (!isNaN(n) && n <= 18) || s === 'UNICA';
                });
            } else if (genero.includes('HOMBRE') || genero.includes('MUJER')) {
                sizes = sizes.filter(s => {
                    const n = parseInt(s, 10);
                    return isNaN(n) || n >= 28;
                });
            }

            if (prenda.includes('JEAN') || prenda.includes('PANTALON')) {
                sizes = sizes.filter(s => !isNaN(parseInt(s, 10)));
            } else if (prenda.includes('CAMISA') || prenda.includes('CAMISETA') || prenda.includes('POLO')) {
                sizes = sizes.filter(s => isNaN(parseInt(s, 10)) || s === 'UNICA');
            }
        }

        datalistTallas.innerHTML = sizes.map(s => `<option value="${s}"></option>`).join('');
    }

    _bindEvents() {
        this.container.querySelector('#btn-back-to-hub')?.addEventListener('click', () => {
            if (typeof this.onBack === 'function') this.onBack();
        });

        // Cambio reactivo de Área de Servicios
        const selectArea = this.container.querySelector('#nov-area');
        selectArea?.addEventListener('change', () => {
            this._handleAreaChange(selectArea.value);
        });

        // Cambio reactivo de Tipo de Solicitud en Códigos
        const selectCodigosTipo = this.container.querySelector('#codigos-tipo-solicitud');
        selectCodigosTipo?.addEventListener('change', () => {
            this._handleCodigosTipoChange(selectCodigosTipo.value);
        });

        // Botones agregar filas dinámicas
        this.container.querySelector('#btn-add-insumo')?.addEventListener('click', () => {
            this._addDynamicRow('#insumos-list-container', INSUMOS_LIST, 'Insumo');
        });

        this.container.querySelector('#btn-add-corte')?.addEventListener('click', () => {
            this._addDynamicRow('#corte-list-container', CORTE_LIST, 'Tipo de Corte');
        });

        this.container.querySelector('#btn-add-tela')?.addEventListener('click', () => {
            this._addDynamicRow('#telas-list-container', TELAS_LIST, 'Tipo de Imperfección');
        });

        this.container.querySelector('#btn-add-codigo')?.addEventListener('click', () => {
            this._addCodigoRow();
        });

        // Submit form
        const form = this.container.querySelector('#form-novedades');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleSubmit();
        });
    }

    _handleAreaChange(area) {
        const grpTipo = this.container.querySelector('#grp-nov-tipo');
        const selectTipo = this.container.querySelector('#nov-tipo');
        const grpCantDiseno = this.container.querySelector('#grp-cant-diseno');
        const grpCantNormal = this.container.querySelector('#grp-cant-normal');
        const inputCantNormal = this.container.querySelector('#nov-cant-normal');

        const secInsumos = this.container.querySelector('#sec-dyn-insumos');
        const secCorte = this.container.querySelector('#sec-dyn-corte');
        const secTelas = this.container.querySelector('#sec-dyn-telas');
        const secCodigos = this.container.querySelector('#sec-dyn-codigos');

        // Ocultar todo y resetear required
        secInsumos.style.display = 'none';
        secCorte.style.display = 'none';
        secTelas.style.display = 'none';
        secCodigos.style.display = 'none';
        grpCantDiseno.style.display = 'none';
        grpCantNormal.style.display = 'none';
        inputCantNormal.required = false;

        grpTipo.style.display = 'flex';
        selectTipo.required = true;
        selectTipo.disabled = false;

        if (area === 'DISEÑO') {
            // DISEÑO: No pide tipo de novedad, fija cantidad total del lote no editable
            grpTipo.style.display = 'none';
            selectTipo.required = false;
            grpCantDiseno.style.display = 'flex';
            this._syncLoteDataIntoForm();

        } else if (area === 'TELAS') {
            // TELAS: Tipo fijo en IMPERFECTO, muestra sección telas
            selectTipo.value = 'IMPERFECTO';
            selectTipo.disabled = true;
            secTelas.style.display = 'block';
            const list = this.container.querySelector('#telas-list-container');
            if (list && list.children.length === 0) {
                this._addDynamicRow('#telas-list-container', TELAS_LIST, 'Tipo de Imperfección');
            }

        } else if (area === 'INSUMOS') {
            secInsumos.style.display = 'block';
            const list = this.container.querySelector('#insumos-list-container');
            if (list && list.children.length === 0) {
                this._addDynamicRow('#insumos-list-container', INSUMOS_LIST, 'Insumo');
            }

        } else if (area === 'CORTE') {
            secCorte.style.display = 'block';
            const list = this.container.querySelector('#corte-list-container');
            if (list && list.children.length === 0) {
                this._addDynamicRow('#corte-list-container', CORTE_LIST, 'Tipo de Corte');
            }

        } else if (area === 'CODIGOS') {
            secCodigos.style.display = 'block';
            this._syncLoteDataIntoForm();

        } else if (area === 'OTROS') {
            grpCantNormal.style.display = 'flex';
            inputCantNormal.required = true;
        }
    }

    _handleCodigosTipoChange(tipo) {
        const grpLoteComp = this.container.querySelector('#grp-codigos-lote-completo');
        const grpUnidades = this.container.querySelector('#grp-codigos-unidades');

        if (tipo === 'LOTE_COMPLETO') {
            grpLoteComp.style.display = 'flex';
            grpUnidades.style.display = 'none';
            this._syncLoteDataIntoForm();
        } else if (tipo === 'UNIDADES') {
            grpLoteComp.style.display = 'none';
            grpUnidades.style.display = 'block';
            const list = this.container.querySelector('#codigos-list-container');
            if (list && list.children.length === 0) {
                this._addCodigoRow();
            }
        } else {
            grpLoteComp.style.display = 'none';
            grpUnidades.style.display = 'none';
        }
    }

    _addDynamicRow(containerSelector, optionsList, label) {
        const container = this.container.querySelector(containerSelector);
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'f-dynamic-row';
        row.innerHTML = `
            <div class="f-dyn-col-type">
                <select class="f-select-sm item-type" required>
                    <option value="">Seleccione ${label}...</option>
                    ${optionsList.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>
            </div>
            <div class="f-dyn-col-qty">
                <input type="number" class="f-input-sm item-qty" min="1" placeholder="Cant." value="1" required />
            </div>
            <button type="button" class="f-btn-del-row" title="Eliminar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        row.querySelector('.f-btn-del-row')?.addEventListener('click', () => {
            if (container.children.length > 1) {
                row.remove();
            } else {
                row.querySelector('.item-type').value = '';
                row.querySelector('.item-qty').value = '1';
            }
        });

        container.appendChild(row);
    }

    _addCodigoRow() {
        const container = this.container.querySelector('#codigos-list-container');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'f-dynamic-row f-dyn-row-3cols';
        row.innerHTML = `
            <div>
                <input type="text" class="f-input-sm item-talla" placeholder="Talla..." list="datalist-tallas-novedad" required autocomplete="off" />
            </div>
            <div>
                <input type="text" class="f-input-sm item-color" placeholder="Color..." list="datalist-colores-novedad" required autocomplete="off" />
            </div>
            <div>
                <input type="number" class="f-input-sm item-qty" min="1" placeholder="Cant." value="1" required />
            </div>
            <button type="button" class="f-btn-del-row" title="Eliminar">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        row.querySelector('.f-btn-del-row')?.addEventListener('click', () => {
            if (container.children.length > 1) {
                row.remove();
            } else {
                row.querySelector('.item-talla').value = '';
                row.querySelector('.item-color').value = '';
                row.querySelector('.item-qty').value = '1';
            }
        });

        container.appendChild(row);
    }

    async _handleSubmit() {
        if (!this.activeLote) {
            Toast.warning('Debe buscar y seleccionar una OP / Lote obligatorio antes de enviar.');
            const searchInput = this.container.querySelector('#input-search-lote');
            if (searchInput) {
                searchInput.focus();
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        const area = this.container.querySelector('#nov-area')?.value;
        if (!area) {
            Toast.warning('Debe seleccionar el Área de Servicios afectada.');
            return;
        }

        const btn = this.container.querySelector('#btn-submit-novedad');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="f-spinner"></span> Guardando Novedad...`;

        try {
            // Recolectar desgloses según el área seleccionada
            const insumos = [];
            if (area === 'INSUMOS') {
                this.container.querySelectorAll('#insumos-list-container .f-dynamic-row').forEach(row => {
                    const tipo = row.querySelector('.item-type')?.value;
                    const cantidad = parseInt(row.querySelector('.item-qty')?.value, 10) || 1;
                    if (tipo) insumos.push({ tipo, cantidad });
                });
                if (!insumos.length) throw new Error('Debe agregar al menos un insumo con su cantidad.');
            }

            const cortes = [];
            if (area === 'CORTE') {
                this.container.querySelectorAll('#corte-list-container .f-dynamic-row').forEach(row => {
                    const tipo = row.querySelector('.item-type')?.value;
                    const cantidad = parseInt(row.querySelector('.item-qty')?.value, 10) || 1;
                    if (tipo) cortes.push({ tipo, cantidad });
                });
                if (!cortes.length) throw new Error('Debe agregar al menos un ítem de corte con su cantidad.');
            }

            const telas = [];
            if (area === 'TELAS') {
                this.container.querySelectorAll('#telas-list-container .f-dynamic-row').forEach(row => {
                    const tipo = row.querySelector('.item-type')?.value;
                    const cantidad = parseInt(row.querySelector('.item-qty')?.value, 10) || 1;
                    if (tipo) telas.push({ tipo, cantidad });
                });
                if (!telas.length) throw new Error('Debe agregar al menos una imperfección de tela.');
            }

            const codigos = [];
            let codigosTipoSolicitud = '';
            if (area === 'CODIGOS') {
                codigosTipoSolicitud = this.container.querySelector('#codigos-tipo-solicitud')?.value;
                if (!codigosTipoSolicitud) throw new Error('Debe seleccionar el tipo de solicitud de códigos.');

                if (codigosTipoSolicitud === 'UNIDADES') {
                    this.container.querySelectorAll('#codigos-list-container .f-dynamic-row').forEach(row => {
                        const talla = row.querySelector('.item-talla')?.value?.trim();
                        const color = row.querySelector('.item-color')?.value?.trim();
                        const cantidad = parseInt(row.querySelector('.item-qty')?.value, 10) || 1;
                        if (talla && color) codigos.push({ talla, color, cantidad });
                    });
                    if (!codigos.length) throw new Error('Debe especificar al menos una talla y color con su cantidad.');
                }
            }

            // Calcular cantidad solicitada sumando insumos/cortes/telas/codigos si aplica
            let cantidadSolicitada = 0;
            if (area === 'INSUMOS') {
                cantidadSolicitada = insumos.reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);
            } else if (area === 'CORTE') {
                cantidadSolicitada = cortes.reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);
            } else if (area === 'TELAS') {
                cantidadSolicitada = telas.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);
            } else if (area === 'CODIGOS') {
                if (codigosTipoSolicitud === 'LOTE_COMPLETO') {
                    cantidadSolicitada = Number(this.activeLote.cantidad || 0);
                } else {
                    cantidadSolicitada = codigos.reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);
                }
            } else if (area === 'DISEÑO') {
                cantidadSolicitada = Number(this.activeLote.cantidad || 0);
            } else if (area === 'OTROS') {
                cantidadSolicitada = parseInt(this.container.querySelector('#nov-cant-normal')?.value, 10) || 0;
            }

            const tipoNovedad = area === 'DISEÑO' 
                ? 'SOLICITUD_DISEÑO' 
                : (area === 'TELAS' ? 'IMPERFECTO' : this.container.querySelector('#nov-tipo')?.value);

            const payload = {
                lote: this.activeLote.id_master || this.activeLote.lote || this.activeLote.op || this.activeLote.id,
                op: this.activeLote.id_master || this.activeLote.op || this.activeLote.lote || this.activeLote.id,
                planta: this.activeLote.nombre_planta || this.activeLote.planta || '',
                modulo: this.activeLote.cuento || this.activeLote.modulo || this.activeLote.linea || '',
                cuento: this.activeLote.cuento || this.activeLote.modulo || this.activeLote.linea || null,
                linea: this.activeLote.cuento || this.activeLote.linea || '',
                referencia: this.activeLote.referencia || '',
                cantidadTotal: Number(this.activeLote.cantidad || 0),
                cantidad: Number(this.activeLote.cantidad || 0),
                cantidadSolicitada: cantidadSolicitada,
                proceso: this.activeLote.proceso || 'CONFECCION',
                prenda: this.activeLote.descripcion || this.activeLote.tipoPrenda || this.activeLote.prenda || this.activeLote.tipo_prenda || '',
                genero: this.activeLote.genero || '',
                tejido: this.activeLote.tejido || null,
                salida: this.activeLote.fecha_salida || this.activeLote.salida || null,
                productora: this.activeLote.productora || this.selectedProductora || 1,
                area,
                tipoNovedad,
                insumos,
                cortes,
                telas,
                codigos,
                codigosTipoSolicitud,
                observaciones: this.container.querySelector('#nov-observaciones')?.value || '',
                fotos: this.dropzone ? this.dropzone.getFiles() : [],
                auditor: this.currentUser ? (this.currentUser.displayName || this.currentUser.nombre) : 'Auditor'
            };

            const res = await this.submitUseCase.execute(payload);
            Toast.success(res.message || 'Novedad registrada exitosamente.');

            // Resetear formulario
            this.container.querySelector('#form-novedades')?.reset();
            this._handleAreaChange('');
            if (this.dropzone) this.dropzone.clear();

            if (typeof this.onSuccess === 'function') {
                this.onSuccess();
            }
        } catch (err) {
            console.error('[NovedadesSubForm] Error:', err);
            Toast.error(err.message || 'Error al procesar el reporte de novedad.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}
