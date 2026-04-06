// Sistema de registro de eventos

const LogManager = {
  logs: {
    found: [],      // Barras encontradas exitosamente
    notfound: [],   // Barras no encontradas
    errors: []      // Errores del sistema
  },
  maxLogs: 100,
  currentTab: 'found',

  init() {
    this.logs = {
      found: [],
      notfound: [],
      errors: []
    };
    this.currentTab = 'found';
    this.updateDisplay();
  },

  addLog(category, message, barcode = null, details = null) {
    if (!this.logs[category]) return;

    const log = {
      id: Date.now() + Math.random(),
      message,
      barcode,
      details,
      timestamp: new Date()
    };

    this.logs[category].unshift(log); // Agregar al inicio

    // Limitar cantidad de logs por categoría
    if (this.logs[category].length > this.maxLogs) {
      this.logs[category] = this.logs[category].slice(0, this.maxLogs);
    }

    this.updateDisplay();
    return log;
  },

  found(message, barcode = null, details = null) {
    return this.addLog('found', message, barcode, details);
  },

  notfound(message, barcode = null, details = null) {
    return this.addLog('notfound', message, barcode, details);
  },

  error(message, details = null) {
    return this.addLog('errors', message, null, details);
  },

  clear() {
    if (confirm('¿Deseas limpiar todos los registros?')) {
      this.logs = {
        found: [],
        notfound: [],
        errors: []
      };
      this.updateDisplay();
    }
  },

  updateDisplay() {
    const logContent = document.getElementById('logContent');
    const countFound = document.getElementById('countFound');
    const countNotFound = document.getElementById('countNotFound');
    const countErrors = document.getElementById('countErrors');

    if (!logContent) return;

    // Actualizar contadores
    if (countFound) countFound.textContent = this.logs.found.length;
    if (countNotFound) countNotFound.textContent = this.logs.notfound.length;
    if (countErrors) countErrors.textContent = this.logs.errors.length;

    // Obtener logs de la pestaña actual
    const currentLogs = this.logs[this.currentTab] || [];

    if (currentLogs.length === 0) {
      const emptyMessages = {
        found: 'No hay barras encontradas',
        notfound: 'No hay barras no encontradas',
        errors: 'No hay errores registrados'
      };
      
      logContent.innerHTML = `
        <div class="log-empty">
          <i class="fas fa-info-circle"></i>
          <span>${emptyMessages[this.currentTab]}</span>
        </div>
      `;
      return;
    }

    logContent.innerHTML = currentLogs.map(log => {
      const icon = this.getIcon(this.currentTab);
      const time = this.formatTime(log.timestamp);
      
      let detailsHtml = '';
      if (log.barcode) {
        detailsHtml = `<div class="log-item-details">Código: ${this.escapeHtml(log.barcode)}</div>`;
      } else if (log.details && typeof log.details === 'object') {
        const detailsStr = Object.entries(log.details)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ');
        detailsHtml = `<div class="log-item-details">${this.escapeHtml(detailsStr)}</div>`;
      }
      
      return `
        <div class="log-item ${this.currentTab}">
          <div class="log-item-icon">
            <i class="fas ${icon}"></i>
          </div>
          <div class="log-item-content">
            <div class="log-item-message">${this.escapeHtml(log.message)}</div>
            ${detailsHtml}
            <div class="log-item-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    // Auto-scroll al último log (primero en la lista)
    logContent.scrollTop = 0;
  },

  getIcon(category) {
    const icons = {
      found: 'fa-check',
      notfound: 'fa-times',
      errors: 'fa-exclamation-triangle'
    };
    return icons[category] || 'fa-info';
  },

  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    // Menos de 1 minuto
    if (diff < 60000) {
      const seconds = Math.floor(diff / 1000);
      return seconds <= 1 ? 'Ahora' : `Hace ${seconds}s`;
    }
    
    // Menos de 1 hora
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `Hace ${minutes}m`;
    }
    
    // Mostrar hora
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Función global para cambiar de pestaña
function switchLogTab(tab) {
  LogManager.currentTab = tab;
  
  // Actualizar clases de pestañas
  document.querySelectorAll('.log-tab').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  LogManager.updateDisplay();
}

// Función global para limpiar logs
function clearLogs() {
  LogManager.clear();
}
