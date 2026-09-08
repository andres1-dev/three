import { Toast } from '../../../components/Toast.js';
import { SignaturePadModal } from '../components/SignaturePadModal.js';

export class PlantaDataSubForm {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Object} options.activeLote
     * @param {Array} options.productoras
     * @param {Object} options.dataService
     * @param {Object} options.currentUser
     * @param {Function} options.onBack
     * @param {Function} options.onSuccess
     */
    constructor({
        container,
        activeLote = null,
        productoras = [],
        dataService,
        currentUser = null,
        onBack = null,
        onSuccess = null
    }) {
        this.container = container;
        this.activeLote = activeLote;
        this.productoras = productoras;
        this.dataService = dataService;
        this.currentUser = currentUser;
        this.onBack = onBack;
        this.onSuccess = onSuccess;

        this.signatureBase64 = null;
        this.gpsCoords = null;
        this._render();
    }

    _render() {
        const plantaNombre = this.currentUser?.planta || (this.activeLote ? this.activeLote.planta : '');

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn" id="btn-back-to-hub" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Planta</h1>
            </div>

            <form id="form-planta-data" class="f-subform-body">
                <div class="f-section-title">
                    <span class="pill-num">1</span>
                    <span>Información General de la Planta / Taller</span>
                </div>

                <div class="f-form-grid">
                    <div class="f-form-group">
                        <label class="f-label">Nombre de Planta / Taller <span class="req">*</span></label>
                        <input type="text" id="plt-nombre" class="f-input" value="${plantaNombre}" placeholder="Nombre del taller o planta..." required />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Encargado / Administrador <span class="req">*</span></label>
                        <input type="text" id="plt-encargado" class="f-input" placeholder="Nombre completo..." required />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Teléfono / WhatsApp <span class="req">*</span></label>
                        <input type="tel" id="plt-telefono" class="f-input" placeholder="3001234567" required />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Correo Electrónico</label>
                        <input type="email" id="plt-email" class="f-input" placeholder="contacto@taller.com" />
                    </div>
                </div>

                <!-- Censo de Maquinaria -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">2</span>
                    <span>Capacidad Instalada y Maquinaria Activa</span>
                </div>

                <div class="f-form-grid three-cols">
                    <div class="f-form-group">
                        <label class="f-label">Máquinas Planas</label>
                        <input type="number" id="maq-planas" class="f-input" min="0" value="0" />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Fileteadoras</label>
                        <input type="number" id="maq-fileteadoras" class="f-input" min="0" value="0" />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Recubridoras</label>
                        <input type="number" id="maq-recubridoras" class="f-input" min="0" value="0" />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Cerradoras / Especiales</label>
                        <input type="number" id="maq-especiales" class="f-input" min="0" value="0" />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Operarios Confección</label>
                        <input type="number" id="pers-operarios" class="f-input" min="0" value="0" />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Capacidad Mensual (Uds)</label>
                        <input type="number" id="plt-capacidad" class="f-input" min="0" placeholder="Ej: 5000" />
                    </div>
                </div>

                <!-- Ubicación GPS y Firma -->
                <div class="f-section-title" style="margin-top: 20px;">
                    <span class="pill-num">3</span>
                    <span>Ubicación GPS y Validación de Firma</span>
                </div>

                <div class="f-planta-verification-grid">
                    <!-- Tarjeta GPS -->
                    <div class="f-veri-card">
                        <div class="f-veri-icon gps">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                            </svg>
                        </div>
                        <div class="f-veri-text">
                            <span class="f-veri-title">Geolocalización GPS</span>
                            <span class="f-veri-sub" id="gps-coords-text">No capturada aún</span>
                        </div>
                        <button type="button" class="f-btn-veri" id="btn-capture-gps">Capturar GPS</button>
                    </div>

                    <!-- Tarjeta Firma -->
                    <div class="f-veri-card">
                        <div class="f-veri-icon sig">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                        </div>
                        <div class="f-veri-text">
                            <span class="f-veri-title">Firma del Encargado</span>
                            <span class="f-veri-sub" id="sig-status-text">Pendiente de firma</span>
                        </div>
                        <button type="button" class="f-btn-veri" id="btn-open-signature">Firmar</button>
                    </div>
                </div>

                <div class="f-submit-actions">
                    <button type="submit" class="f-btn-submit" id="btn-submit-planta">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/>
                            <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        <span>Actualizar Datos de Planta</span>
                    </button>
                </div>
            </form>
        `;

        this._bindEvents();
    }

    _bindEvents() {
        this.container.querySelector('#btn-back-to-hub')?.addEventListener('click', () => {
            if (typeof this.onBack === 'function') this.onBack();
        });

        // Captura GPS
        const btnGps = this.container.querySelector('#btn-capture-gps');
        const gpsText = this.container.querySelector('#gps-coords-text');

        btnGps?.addEventListener('click', () => {
            if (!navigator.geolocation) {
                Toast.error('La geolocalización no está soportada por su navegador.');
                return;
            }

            btnGps.disabled = true;
            btnGps.textContent = 'Obteniendo...';

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.gpsCoords = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    };
                    gpsText.textContent = `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`;
                    gpsText.style.color = '#10b981';
                    btnGps.textContent = 'Actualizado';
                    btnGps.disabled = false;
                    Toast.success('Coordenadas GPS capturadas con éxito.');
                },
                (err) => {
                    btnGps.disabled = false;
                    btnGps.textContent = 'Reintentar';
                    Toast.warning('No se pudo obtener la ubicación: ' + err.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });

        // Firma Modal
        const btnSig = this.container.querySelector('#btn-open-signature');
        const sigText = this.container.querySelector('#sig-status-text');

        btnSig?.addEventListener('click', () => {
            SignaturePadModal.open({
                title: 'Firma de Encargado de Planta',
                subtitle: 'Firma de conformidad con los datos registrados',
                onSave: (base64) => {
                    this.signatureBase64 = base64;
                    sigText.textContent = 'Firma registrada ✓';
                    sigText.style.color = '#10b981';
                    btnSig.textContent = 'Cambiar Firma';
                    Toast.success('Firma capturada correctamente.');
                }
            });
        });

        // Submit Form
        this.container.querySelector('#form-planta-data')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleSubmit();
        });
    }

    async _handleSubmit() {
        const btn = this.container.querySelector('#btn-submit-planta');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="f-spinner"></span> Guardando...`;

        try {
            const payload = {
                nombre: this.container.querySelector('#plt-nombre')?.value,
                encargado: this.container.querySelector('#plt-encargado')?.value,
                telefono: this.container.querySelector('#plt-telefono')?.value,
                email: this.container.querySelector('#plt-email')?.value,
                maquinaria: {
                    planas: parseInt(this.container.querySelector('#maq-planas')?.value || 0, 10),
                    fileteadoras: parseInt(this.container.querySelector('#maq-fileteadoras')?.value || 0, 10),
                    recubridoras: parseInt(this.container.querySelector('#maq-recubridoras')?.value || 0, 10),
                    especiales: parseInt(this.container.querySelector('#maq-especiales')?.value || 0, 10),
                    operarios: parseInt(this.container.querySelector('#pers-operarios')?.value || 0, 10),
                },
                capacidad: parseInt(this.container.querySelector('#plt-capacidad')?.value || 0, 10),
                gps: this.gpsCoords,
                firma: this.signatureBase64,
                auditor: this.currentUser ? (this.currentUser.displayName || this.currentUser.nombre) : 'Auditor'
            };

            if (typeof this.dataService?.updatePlantaDatos === 'function') {
                await this.dataService.updatePlantaDatos(payload);
            }

            Toast.success(`Datos técnicos de "${payload.nombre}" actualizados.`);

            if (typeof this.onSuccess === 'function') {
                this.onSuccess();
            }
        } catch (err) {
            Toast.error(err.message || 'Error al actualizar datos de planta.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}
