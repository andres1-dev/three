// Gestión de interfaz de usuario

const WAREHOUSES = [
  { code: 'DI', name: 'PRIMERAS' },
  { code: 'ZY', name: 'SIN CONFECCIONAR' },
  { code: 'BP', name: 'COBROS' },
  { code: 'ZZ', name: 'PROMOCIONES' }
];

const UIManager = {
  showError(message) {
    // Función temporal para compatibilidad
    updateScanStatus('error', message);
    setTimeout(() => {
      if (AppState.sessionActive) {
        updateScanStatus('idle', 'Listo');
      }
    }, 1500);
  },

  renderCurvaTable() {
    if (!AppState.opDetails || AppState.opDetails.length === 0) {
      DOM.curvaTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fas fa-inbox"></i>
            No hay detalles de curva
          </td>
        </tr>
      `;
      return;
    }

    const isManualMode = AppState.countMode === 'manual';
    const completedItems = [];
    const incompleteRows = [];

    // Función para ordenar tallas
    const sortBySize = (a, b) => {
      const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
      const aIndex = sizeOrder.indexOf(a.talla.toUpperCase());
      const bIndex = sizeOrder.indexOf(b.talla.toUpperCase());
      
      // Si ambas están en el orden estándar
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // Si son números
      const aNum = parseInt(a.talla);
      const bNum = parseInt(b.talla);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      // Si una está en el orden y la otra no
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // Orden alfabético por defecto
      return a.talla.localeCompare(b.talla);
    };

    AppState.opDetails.forEach(detail => {
      const [id_color, color, referencia, talla, cantidad, barcode] = detail;
      const key = `${id_color}-${talla}`;
      
      // Si ya fue enviado, no mostrar
      if (AppState.sentItems.has(key)) {
        return;
      }
      
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      const faltante = cantidad - contado;
      const percentage = Math.round((contado / cantidad) * 100);
      
      if (percentage >= 100) {
        // Item completado - va a las tarjetas
        completedItems.push({
          key,
          color,
          talla,
          cantidad,
          contado
        });
      } else {
        // Item incompleto - va a la tabla
        const contadoContent = isManualMode 
          ? `<input type="number" class="count-input" value="${contado}" min="0" max="${cantidad}" data-key="${key}" oninput="updateManualCount('${key}', this.value)">`
          : contado;
        
        incompleteRows.push({
          key,
          color,
          talla,
          cantidad,
          contadoContent,
          faltante,
          percentage
        });
      }
    });

    // Ordenar por talla
    incompleteRows.sort(sortBySize);
    completedItems.sort(sortBySize);

    // Renderizar items incompletos en tabla
    if (incompleteRows.length === 0) {
      DOM.curvaTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fas fa-check-circle"></i>
            <span>Todos los items están completos</span>
          </td>
        </tr>
      `;
    } else {
      DOM.curvaTableBody.innerHTML = incompleteRows.map(row => `
        <tr data-key="${row.key}">
          <td class="color-cell">${row.color}</td>
          <td class="talla-cell">${row.talla}</td>
          <td class="number-cell esperado-cell">${row.cantidad}</td>
          <td class="number-cell contado-cell">${row.contadoContent}</td>
          <td class="number-cell faltante-cell">${row.faltante}</td>
          <td class="progress-cell">
            <div class="progress-bar-mini">
              <div class="progress-bar-mini-fill" style="width: ${row.percentage}%"></div>
            </div>
            <div class="progress-text-mini">${row.percentage}%</div>
          </td>
        </tr>
      `).join('');
    }

    // Renderizar items completados en tarjetas
    const completedSection = document.getElementById('completedSection');
    const completedCards = document.getElementById('completedCards');
    const completedCount = document.getElementById('completedCount');
    
    if (completedItems.length > 0) {
      completedSection.classList.remove('hidden');
      completedCount.textContent = completedItems.length;
      
      completedCards.innerHTML = completedItems.map(item => `
        <div class="completed-card">
          <div class="completed-card-icon">
            <i class="fas fa-check"></i>
          </div>
          <div class="completed-card-content">
            <div class="completed-card-title">${item.color} - ${item.talla}</div>
            <div class="completed-card-subtitle">${item.contado} / ${item.cantidad} unidades</div>
          </div>
        </div>
      `).join('');
    } else {
      completedSection.classList.add('hidden');
    }
  },

  updateCurvaTable() {
    // Si hay items que llegaron al 100%, re-renderizar toda la tabla
    let needsFullRender = false;
    
    AppState.opDetails.forEach(detail => {
      const [id_color, , , talla, cantidad] = detail;
      const key = `${id_color}-${talla}`;
      
      if (AppState.sentItems.has(key)) return;
      
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      const percentage = Math.round((contado / cantidad) * 100);
      
      // Si llegó al 100%, necesitamos re-renderizar
      if (percentage >= 100) {
        needsFullRender = true;
      }
    });
    
    if (needsFullRender) {
      this.renderCurvaTable();
      return;
    }
    
    // Actualización rápida para items incompletos
    if (!AppState.opDetails || AppState.opDetails.length === 0) return;

    const isManualMode = AppState.countMode === 'manual';

    AppState.opDetails.forEach(detail => {
      const [id_color, color, referencia, talla, cantidad, barcode] = detail;
      const key = `${id_color}-${talla}`;
      
      // Si ya fue enviado, no actualizar
      if (AppState.sentItems.has(key)) return;
      
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      const faltante = cantidad - contado;
      const percentage = Math.round((contado / cantidad) * 100);
      
      const row = DOM.curvaTableBody.querySelector(`tr[data-key="${key}"]`);
      if (!row) return;
      
      const contadoCell = row.querySelector('.contado-cell');
      
      if (isManualMode) {
        const input = contadoCell.querySelector('input');
        if (input) input.value = contado;
      } else {
        contadoCell.textContent = contado;
      }
      
      row.querySelector('.faltante-cell').textContent = faltante;
      
      const progressFill = row.querySelector('.progress-bar-mini-fill');
      progressFill.style.width = Math.min(percentage, 100) + '%';
      
      row.querySelector('.progress-text-mini').textContent = percentage + '%';
      
      // Animación flash
      row.style.animation = 'flash 0.3s';
      setTimeout(() => {
        row.style.animation = '';
      }, 300);
    });
  }
};
