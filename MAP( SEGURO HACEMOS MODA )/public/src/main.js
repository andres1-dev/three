/**
 * Main Application Entry Point
 * Inicialización y orquestación de la aplicación
 */

import { DOMManager } from './core/DOMManager.js';
import { DataProcessor } from './services/DataProcessor.js';
import { UIController } from './controllers/UIController.js';
import { EventHandler } from './core/EventHandler.js';
import { SupabaseService } from './services/SupabaseService.js';

/**
 * Clase principal de la aplicación
 */
class Application {
    constructor() {
        this.domManager = new DOMManager();
        this.dataProcessor = new DataProcessor();
        this.supabaseService = new SupabaseService();
        this.uiController = new UIController(this.domManager);
        this.eventHandler = new EventHandler(
            this.domManager,
            this.dataProcessor,
            this.uiController,
            this.supabaseService
        );
    }

    /**
     * Inicializa la aplicación
     */
    init() {
        // Inicializar spreadsheet tipo Excel con callback automático
        this.domManager.initSpreadsheet(() => {
            this.eventHandler.handleAutoProcessAndUpload();
        });
        
        // Inicializar UI
        this.uiController.initialize();
        
        // Registrar eventos
        this.eventHandler.registerEvents();
    }
}

// Función para inicializar la aplicación
const startApp = () => {
    try {
        const app = new Application();
        app.init();
    } catch (error) {
        console.error('❌ Error fatal al inicializar la aplicación:', error);
    }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    // El DOM ya está listo (posible debido a top-level await en otros módulos)
    startApp();
}
