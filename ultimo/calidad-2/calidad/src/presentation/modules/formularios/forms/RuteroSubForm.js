import { Toast } from '../../../components/Toast.js';

export class RuteroSubForm {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Object} options.activeLote
     * @param {Array} options.productoras
     * @param {Object} options.submitUseCase
     * @param {Object} options.currentUser
     * @param {Function} options.onBack
     * @param {Function} options.onSuccess
     */
    constructor({
        container,
        activeLote = null,
        productoras = [],
        submitUseCase,
        currentUser = null,
        onBack = null,
        onSuccess = null
    }) {
        this.container = container;
        this.activeLote = activeLote;
        this.productoras = productoras;
        this.submitUseCase = submitUseCase;
        this.currentUser = currentUser;
        this.onBack = onBack;
        this.onSuccess = onSuccess;

        this._render();
    }

    _render() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const defaultDate = tomorrow.toISOString().split('T')[0];
        const defaultPlanta = this.currentUser?.planta || (this.activeLote ? this.activeLote.planta : '');

        this.container.innerHTML = `
            <div class="page-header">
                <button class="icon-btn back-btn" id="btn-back-to-hub" aria-label="Volver">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h1 class="page-title">Rutero</h1>
            </div>

            <form id="form-rutero" class="f-subform-body">
                <div class="f-section-title">
                    <span class="pill-num">1</span>
                    <span>Programación de Visita en Rutero</span>
                </div>

                <div class="f-form-grid">
                    <div class="f-form-group">
                        <label class="f-label">Planta / Taller a Visitar <span class="req">*</span></label>
                        <input type="text" id="rut-planta" class="f-input" value="${defaultPlanta}" placeholder="Nombre de la planta o taller..." required />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Fecha de Visita Estimada <span class="req">*</span></label>
                        <input type="date" id="rut-fecha" class="f-input" value="${defaultDate}" required />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Tipo de Visita <span class="req">*</span></label>
                        <select id="rut-tipo-visita" class="f-select" required>
                            <option value="AUDITORIA_INICIAL">Auditoría Inicial</option>
                            <option value="AUDITORIA_INTERMEDIA" selected>Auditoría Intermedia</option>
                            <option value="AUDITORIA_FINAL">Auditoría Final (100%)</option>
                            <option value="SEGUIMIENTO_CALIDAD">Seguimiento de Calidad</option>
                            <option value="AUDITORIA_PLANTA">Auditoría Técnica de Planta</option>
                        </select>
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Destino / Área a Evaluar <span class="req">*</span></label>
                        <select id="rut-destino" class="f-select" required>
                            <option value="CONFECCION" selected>Confección / Ensamble</option>
                            <option value="CORTE">Corte y Preparación</option>
                            <option value="TERMINACION">Terminación y Empaque</option>
                            <option value="LAVANDERIA">Lavandería</option>
                        </select>
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">OP / Referencia (Opcional)</label>
                        <input type="text" id="rut-op" class="f-input" placeholder="Ej: OP 10452 o Ref. 302..." />
                    </div>

                    <div class="f-form-group">
                        <label class="f-label">Cantidad Estimada a Auditar</label>
                        <input type="number" id="rut-cantidad" class="f-input" min="1" placeholder="Ej: 50 prendas..." />
                    </div>

                    <div class="f-form-group full">
                        <label class="f-label">Observaciones o Notas de Agenda</label>
                        <textarea id="rut-observaciones" class="f-textarea" rows="3" placeholder="Puntos críticos, objetivos de la visita o notas para el taller..."></textarea>
                    </div>
                </div>

                <div class="f-submit-actions">
                    <button type="submit" class="f-btn-submit" id="btn-submit-rutero">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>Agendar en Rutero</span>
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

        this.container.querySelector('#form-rutero')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this._handleSubmit();
        });
    }

    async _handleSubmit() {
        const planta = this.container.querySelector('#rut-planta')?.value?.trim();
        if (!planta) {
            Toast.warning('Por favor especifique el nombre de la planta o taller.');
            return;
        }

        const btn = this.container.querySelector('#btn-submit-rutero');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="f-spinner"></span> Agendando...`;

        try {
            const payload = {
                planta,
                lote: this.container.querySelector('#rut-op')?.value?.trim() || '',
                op: this.container.querySelector('#rut-op')?.value?.trim() || '',
                cantidad: parseInt(this.container.querySelector('#rut-cantidad')?.value || 0, 10),
                fechaVisita: this.container.querySelector('#rut-fecha')?.value,
                tipoVisita: this.container.querySelector('#rut-tipo-visita')?.value,
                destino: this.container.querySelector('#rut-destino')?.value,
                observaciones: this.container.querySelector('#rut-observaciones')?.value,
                auditor: this.currentUser ? (this.currentUser.displayName || this.currentUser.nombre) : 'Auditor'
            };

            const res = await this.submitUseCase.execute(payload);
            Toast.success(res.message || 'Visita agendada exitosamente.');

            if (typeof this.onSuccess === 'function') {
                this.onSuccess();
            }
        } catch (err) {
            Toast.error(err.message || 'Error al agendar en rutero.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}
