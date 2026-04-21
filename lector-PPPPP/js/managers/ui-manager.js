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
          <td colspan="5" class="empty-state">
            <i class="fas fa-inbox"></i>
            No hay detalles de curva
          </td>
        </tr>
      `;
      return;
    }

    const isManualMode = AppState.countMode === 'manual';
    const rows = [];

    AppState.opDetails.forEach(detail => {
      const [id_color, color, referencia, talla, cantidad, barcode] = detail;
      const key = `${id_color}-${talla}`;
      
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      
      // Diferencia = Stock actual - Validado
      const faltante = cantidad - contado;
      const percentage = Math.round((contado / cantidad) * 100);
      const isComplete = percentage >= 100;
      const isValidating = contado > 0 && !isComplete;
      
      // Contenido de la celda de contado
      const contadoContent = isManualMode 
        ? `<input type="number" class="count-input" value="${contado}" min="0" max="${cantidad}" data-key="${key}" onchange="updateManualCount('${key}', this.value)" onfocus="hideInputOnSelectFocus()" onblur="showInputOnSelectBlur()">`
        : contado;
      
      rows.push({
        key,
        color,
        talla,
        cantidad,
        contadoContent,
        faltante,
        isComplete,
        isValidating
      });
    });

    // Renderizar todas las filas
    if (rows.length === 0) {
      DOM.curvaTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <i class="fas fa-check-circle"></i>
            <span>Todos los items fueron enviados</span>
          </td>
        </tr>
      `;
    } else {
      DOM.curvaTableBody.innerHTML = rows.map(row => {
        let rowClass = '';
        if (row.isComplete) {
          rowClass = 'complete';
        } else if (row.isValidating) {
          rowClass = 'validating';
        }
        
        return `
          <tr data-key="${row.key}" class="${rowClass}">
            <td class="color-cell">${row.color}</td>
            <td class="talla-cell">${row.talla}</td>
            <td class="number-cell esperado-cell">${row.cantidad}</td>
            <td class="number-cell contado-cell">${row.contadoContent}</td>
            <td class="number-cell faltante-cell">${row.faltante}</td>
          </tr>
        `;
      }).join('');
    }
  },

  updateCurvaTable() {
    console.log('🔄 updateCurvaTable llamado');
    // Actualización rápida para items
    if (!AppState.opDetails || AppState.opDetails.length === 0) {
      console.warn('⚠️ No hay opDetails para actualizar');
      return;
    }

    const isManualMode = AppState.countMode === 'manual';
    console.log('📊 Actualizando tabla, modo:', isManualMode ? 'manual' : 'láser');

    let updatedCount = 0;
    AppState.opDetails.forEach(detail => {
      const [id_color, color, referencia, talla, cantidad, barcode] = detail;
      const key = `${id_color}-${talla}`;
      
      const scanned = AppState.consolidated.get(key);
      const contado = scanned ? scanned.count : 0;
      
      // Diferencia = Stock actual - Validado
      const faltante = cantidad - contado;
      const percentage = Math.round((contado / cantidad) * 100);
      const isComplete = percentage >= 100;
      const isValidating = contado > 0 && !isComplete;
      
      const row = DOM.curvaTableBody.querySelector(`tr[data-key="${key}"]`);
      if (!row) {
        console.warn(`⚠️ No se encontró fila para key: ${key}`);
        return;
      }
      
      console.log(`✅ Actualizando fila ${key}: stock=${cantidad}, contado=${contado}, faltante=${faltante}`);
      updatedCount++;
      
      // Actualizar clases según estado
      row.classList.remove('complete', 'validating');
      if (isComplete) {
        row.classList.add('complete');
      } else if (isValidating) {
        row.classList.add('validating');
      }
      
      const contadoCell = row.querySelector('.contado-cell');
      
      if (isManualMode) {
        const input = contadoCell.querySelector('input');
        if (input) input.value = contado;
      } else {
        contadoCell.textContent = contado;
      }
      
      row.querySelector('.faltante-cell').textContent = faltante;
      
      // Animación flash
      row.style.animation = 'flash 0.3s';
      setTimeout(() => {
        row.style.animation = '';
      }, 300);
    });
    
    console.log(`📊 Total de filas actualizadas: ${updatedCount}`);
  }
};
