/**
 * Componente: SignaturePadModal
 * Modal interactivo con Canvas HTML5 para captura de firma táctil y de mouse.
 */
export class SignaturePadModal {
    /**
     * Abre el modal de firma
     * @param {Object} options
     * @param {string} options.title
     * @param {string} options.subtitle
     * @param {Function} options.onSave - Recibe la imagen en Base64 (dataURL)
     */
    static open({ title = 'Firma Digital', subtitle = 'Firme en el recuadro para validar', onSave }) {
        const modalEl = document.createElement('div');
        modalEl.className = 'f-modal-backdrop';
        modalEl.id = 'modal-signature-pad';

        modalEl.innerHTML = `
            <div class="f-modal-sheet">
                <div class="f-sheet-header">
                    <div class="f-sheet-pill"></div>
                    <div class="f-sheet-title-row">
                        <div class="f-sheet-title-icon signature">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 class="f-sheet-title">${title}</h3>
                            <p class="f-sheet-subtitle">${subtitle}</p>
                        </div>
                    </div>
                </div>

                <div class="f-sheet-body">
                    <div class="signature-canvas-wrap">
                        <canvas id="signature-canvas" width="400" height="200"></canvas>
                        <div class="signature-line"></div>
                        <span class="signature-hint">Trace su firma aquí</span>
                    </div>
                </div>

                <div class="f-sheet-footer">
                    <button type="button" class="f-btn-secondary" id="btn-clear-sig">Borrar</button>
                    <button type="button" class="f-btn-primary" id="btn-save-sig">Confirmar Firma</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalEl);
        requestAnimationFrame(() => modalEl.classList.add('visible'));

        const canvas = modalEl.querySelector('#signature-canvas');
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let hasDrawn = false;

        // Ajustar resolución retina / dpi
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width || 380;
        canvas.height = 180;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - r.left,
                y: clientY - r.y || clientY - r.top
            };
        };

        const startDraw = (e) => {
            e.preventDefault();
            isDrawing = true;
            hasDrawn = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        };

        const stopDraw = () => {
            isDrawing = false;
        };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);

        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDraw);

        modalEl.querySelector('#btn-clear-sig')?.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasDrawn = false;
        });

        const close = () => {
            modalEl.classList.remove('visible');
            setTimeout(() => modalEl.remove(), 200);
        };

        modalEl.querySelector('#btn-save-sig')?.addEventListener('click', () => {
            if (!hasDrawn) {
                alert('Por favor dibuje una firma antes de continuar.');
                return;
            }
            const dataUrl = canvas.toDataURL('image/png');
            if (typeof onSave === 'function') {
                onSave(dataUrl);
            }
            close();
        });

        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });
    }
}
