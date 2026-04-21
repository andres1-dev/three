// Sistema de registro de eventos

const LogManager = {
  logs: {
    found: [],      // Barras encontradas exitosamente
    notfound: [],   // Barras no encontradas
    errors: []      // Errores del sistema
  },
  maxLogs: 100,
  currentTab: 'found',
  expandedTabs: {
    found: false,
    notfound: false,
    errors: false
  },

  init() {
    this.logs = {
      found: [],
      notfound: [],
      errors: []
    };
    this.currentTab = 'found';
    this.expandedTabs = {
      found: false,
      notfound: false,
      errors: false
    };
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
    const logPanel = document.getElementById('logPanel');
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
    
    // Verificar si hay contenido en alguna pestaña
    const hasAnyContent = this.logs.found.length > 0 || 
                          this.logs.notfound.length > 0 || 
                          this.logs.errors.length > 0;
    
    // Verificar si la pestaña actual está expandida
    const isCurrentTabExpanded = this.expandedTabs[this.currentTab] && currentLogs.length > 0;
    
    // Agregar/quitar clases al panel
    if (logPanel) {
      if (hasAnyContent) {
        logPanel.classList.add('has-content');
      } else {
        logPanel.classList.remove('has-content');
      }
      
      if (isCurrentTabExpanded) {
        logPanel.classList.add('has-expanded-tab');
      } else {
        logPanel.classList.remove('has-expanded-tab');
      }
    }

    // Si la pestaña actual está colapsada, no mostrar contenido
    if (!this.expandedTabs[this.currentTab]) {
      logContent.innerHTML = '';
      return;
    }

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
      
      // Construir mensaje en una sola línea
      let fullMessage = this.escapeHtml(log.message);
      
      // Agregar código de barras si existe
      if (log.barcode) {
        fullMessage += ` • ${this.escapeHtml(log.barcode)}`;
      }
      
      return `
        <div class="log-item ${this.currentTab}">
          <div class="log-item-icon">
            <i class="fas ${icon}"></i>
          </div>
          <div class="log-item-content">
            <div class="log-item-message">
              ${fullMessage}
              <span class="log-item-time-inline"> • ${time}</span>
            </div>
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
  // Si se hace clic en la pestaña activa, toggle expand/collapse
  if (LogManager.currentTab === tab) {
    LogManager.expandedTabs[tab] = !LogManager.expandedTabs[tab];
    
    // Actualizar indicador visual de la pestaña
    const tabBtn = document.querySelector(`.log-tab[data-tab="${tab}"]`);
    if (tabBtn) {
      if (LogManager.expandedTabs[tab]) {
        tabBtn.classList.remove('collapsed');
      } else {
        tabBtn.classList.add('collapsed');
      }
    }
    
    LogManager.updateDisplay();
    return;
  }
  
  // Cambiar a otra pestaña
  LogManager.currentTab = tab;
  
  // Actualizar clases de pestañas
  document.querySelectorAll('.log-tab').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
      // Mantener estado de colapsado
      if (!LogManager.expandedTabs[tab]) {
        btn.classList.add('collapsed');
      } else {
        btn.classList.remove('collapsed');
      }
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
