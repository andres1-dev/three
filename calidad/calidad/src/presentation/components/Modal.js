/**
 * Gestor de Modales y Bottom Sheets Reutilizables
 */
class ModalManager {
    constructor() {
        this.activeModal = null;
    }

    open({ title, contentHtml, onOpen, onClose }) {
        this.close();

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';

        backdrop.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="page-title">${title || ''}</h2>
                    <button class="icon-btn close-modal-btn" aria-label="Cerrar">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    ${contentHtml || ''}
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Forzar reflow para animación CSS
        requestAnimationFrame(() => {
            backdrop.classList.add('open');
        });

        const closeBtn = backdrop.querySelector('.close-modal-btn');
        const handleClose = () => {
            backdrop.classList.remove('open');
            setTimeout(() => {
                backdrop.remove();
                if (onClose) onClose();
            }, 250);
            this.activeModal = null;
        };

        closeBtn.addEventListener('click', handleClose);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) handleClose();
        });

        this.activeModal = { element: backdrop, close: handleClose };

        if (onOpen) onOpen(backdrop.querySelector('.modal-body'));

        return this.activeModal;
    }

    close() {
        if (this.activeModal) {
            this.activeModal.close();
        }
    }
}

export const Modal = new ModalManager();
