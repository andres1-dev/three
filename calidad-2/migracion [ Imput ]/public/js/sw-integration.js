/* ==========================================================================
   sw-integration.js — Integración con Service Worker
   - Medición de latencia
   - Manejo de payloads fallidos
   - Indicador de conexión
   ========================================================================== */

class ServiceWorkerIntegration {
  constructor() {
    this.sw = null;
    this.isConnected = navigator.onLine;
    this.latency = null;
    this.failedPayloads = [];
    this.listeners = [];
    
    this.init();
  }
  
  async init() {
    // Registrar service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[SW Integration] Service Worker registrado:', registration);
        
        // Esperar a que el SW esté activo
        if (registration.active) {
          this.sw = registration.active;
        } else if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') {
              this.sw = e.target;
            }
          });
        }
        
        // Escuchar mensajes del SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleMessage(event);
        });
        
        // Medir latencia inicial
        await this.measureLatency();
        
        // Obtener payloads fallidos
        await this.getFailedPayloads();
        
      } catch (error) {
        console.error('[SW Integration] Error al registrar SW:', error);
      }
    }
    
    // Escuchar eventos de conexión
    window.addEventListener('online', () => {
      this.isConnected = true;
      this.notifyListeners('online', true);
      this.measureLatency();
      this.getFailedPayloads();
    });
    
    window.addEventListener('offline', () => {
      this.isConnected = false;
      this.latency = Infinity;
      this.notifyListeners('online', false);
    });
  }
  
  handleMessage(event) {
    const data = event.data;
    
    if (data.type === 'LATENCY_RESULT') {
      this.latency = data.latency;
      this.notifyListeners('latency', data.latency);
    }
    
    if (data.type === 'FAILED_PAYLOADS') {
      this.failedPayloads = data.payloads;
      this.notifyListeners('failedPayloads', data.payloads);
    }
    
    if (data.type === 'RETRY_COMPLETE') {
      this.getFailedPayloads();
      this.notifyListeners('retryComplete');
    }
    
    if (data.type === 'CACHE_CLEARED') {
      this.notifyListeners('cacheCleared');
    }
  }
  
  async measureLatency() {
    if (!navigator.serviceWorker.controller) {
      console.warn('[SW Integration] Service Worker no está activo');
      return null;
    }
    
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        this.latency = event.data.latency;
        resolve(event.data.latency);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'MEASURE_LATENCY' },
        [messageChannel.port2]
      );
      
      // Timeout de 5 segundos
      setTimeout(() => resolve(null), 5000);
    });
  }
  
  async getFailedPayloads() {
    if (!navigator.serviceWorker.controller) {
      return [];
    }
    
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        this.failedPayloads = event.data.payloads;
        resolve(event.data.payloads);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_FAILED_PAYLOADS' },
        [messageChannel.port2]
      );
      
      setTimeout(() => resolve([]), 5000);
    });
  }
  
  async retryFailedPayloads() {
    if (!navigator.serviceWorker.controller) {
      return false;
    }
    
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = () => {
        resolve(true);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'RETRY_PAYLOADS' },
        [messageChannel.port2]
      );
      
      setTimeout(() => resolve(false), 10000);
    });
  }
  
  async clearCache() {
    if (!navigator.serviceWorker.controller) {
      return false;
    }
    
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = () => {
        resolve(true);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
      
      setTimeout(() => resolve(false), 5000);
    });
  }
  
  addListener(event, callback) {
    this.listeners.push({ event, callback });
  }
  
  removeListener(event, callback) {
    this.listeners = this.listeners.filter(l => l.event !== event || l.callback !== callback);
  }
  
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        listener.callback(data);
      }
    });
  }
  
  getConnectionStatus() {
    return {
      online: this.isConnected,
      latency: this.latency,
      failedPayloads: this.failedPayloads.length
    };
  }
  
  getLatencyStatus() {
    if (!this.latency) return 'unknown';
    if (this.latency < 100) return 'fast';
    if (this.latency < 500) return 'medium';
    if (this.latency < 2000) return 'slow';
    return 'very-slow';
  }
}

// Instancia global
const swIntegration = new ServiceWorkerIntegration();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.swIntegration = swIntegration;
}
