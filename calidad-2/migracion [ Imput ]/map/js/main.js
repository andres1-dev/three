/**
 * Programación — Main Application Orchestrator
 * La app quedó reducida a la vista de Programación (única funcionalidad en uso).
 */
import { DOM } from './dom.js';
import { initProgramacionView, closeAsentarModal } from './views/programacionView.js';

function setupEventListeners() {
    // Cerrar el modal Asentar con la tecla Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAsentarModal();
    });

    // Cerrar el modal Asentar con clic en el backdrop
    if (DOM.asentarProgModal) {
        DOM.asentarProgModal.addEventListener('click', (e) => {
            if (e.target === DOM.asentarProgModal) closeAsentarModal();
        });
    }
}

function init() {
    setupEventListeners();
    initProgramacionView();
}

// Iniciar aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
