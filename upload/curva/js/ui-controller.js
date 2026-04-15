// Control de interfaz de usuario

const UIController = {
  stepTimers: {},
  
  // Mostrar tracking section
  showTracking(fileName) {
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('trackingSection').classList.remove('hidden');
    const fn = document.getElementById('trackingFileName');
    if (fn) fn.textContent = fileName;
    const st = document.getElementById('trackingStatus');
    if (st) { st.className = 'tracking-status processing'; const s = st.querySelector('.status-text'); if (s) s.textContent = 'Procesando...'; }
    
    // Reset all steps
    this.resetAllSteps();
    this.stepTimers = {};
  },

  resetAllSteps() {
    for (let i = 1; i <= 6; i++) {
      const step = document.getElementById(`step${i}`);
      step.className = 'timeline-item pending';
      const details = document.getElementById(`step${i}Details`);
      if (details) details.innerHTML = '';
    }
    
    // Reset stats
    document.getElementById('statTotal').textContent = '-';
    document.getElementById('statSuccess').textContent = '-';
    document.getElementById('statDuplicates').textContent = '-';
    document.getElementById('statErrors').textContent = '-';
    
    // Hide action footer
    document.getElementById('actionFooter').style.display = 'none';
  },

  // Actualizar paso del timeline
  setStepActive(stepNumber) {
    const step = document.getElementById(`step${stepNumber}`);
    step.className = 'timeline-item active';
    this.stepTimers[stepNumber] = Date.now();
  },

  setStepComplete(stepNumber) {
    const step = document.getElementById(`step${stepNumber}`);
    step.className = 'timeline-item complete';
  },

  updateStepDetails(stepNumber, html) {
    const details = document.getElementById(`step${stepNumber}Details`);
    if (details) {
      details.innerHTML = html;
    }
  },

  getStepDuration(stepNumber) {
    if (!this.stepTimers[stepNumber]) return 0;
    const duration = Date.now() - this.stepTimers[stepNumber];
    return (duration / 1000).toFixed(2);
  },

  formatTime(seconds) {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
  },

  // Paso 1: Lectura del archivo
  startStep1() {
    this.setStepActive(1);
    this.updateStepDetails(1, '<i class="fas fa-spinner fa-spin"></i> Leyendo archivo Excel...');
  },

  completeStep1(recordCount) {
    const duration = this.getStepDuration(1);
    this.setStepComplete(1);
    this.updateStepDetails(1, 
      `<i class="fas fa-check-circle" style="color: #2e7d32;"></i> ${recordCount.toLocaleString()} OPs extraídas<br>` +
      `<small style="color: #666;"><i class="far fa-clock"></i> ${this.formatTime(duration)}</small>`
    );
    document.getElementById('statTotal').textContent = recordCount.toLocaleString();
  },

  // Paso 2: Verificación de OPs
  startStep2() {
    this.setStepActive(2);
    this.updateStepDetails(2, '<i class="fas fa-spinner fa-spin"></i> Verificando OPs duplicadas...');
  },

  completeStep2(opsChecked, opsDuplicates) {
    const duration = this.getStepDuration(2);
    this.setStepComplete(2);
    
    const newOPs = opsChecked - opsDuplicates;
    
    this.updateStepDetails(2, 
      `<i class="fas fa-check-circle" style="color: #2e7d32;"></i> ${opsChecked.toLocaleString()} OPs verificadas<br>` +
      `<small style="color: #2e7d32;"><i class="fas fa-plus-circle"></i> Nuevas: ${newOPs.toLocaleString()}</small> | ` +
      `<small style="color: #f59e0b;"><i class="fas fa-copy"></i> Duplicadas: ${opsDuplicates.toLocaleString()}</small><br>` +
      `<small style="color: #666;"><i class="far fa-clock"></i> ${this.formatTime(duration)}</small>`
    );
  },

  // Paso 3: Búsqueda de barcodes
  startStep3() {
    this.setStepActive(3);
    this.updateStepDetails(3, '<i class="fas fa-spinner fa-spin"></i> Buscando barcodes...');
  },

  completeStep3(barcodesFound, itemsRequested) {
    const duration = this.getStepDuration(3);
    this.setStepComplete(3);
    
    const percentage = itemsRequested > 0 ? ((barcodesFound / itemsRequested) * 100).toFixed(1) : 0;
    
    this.updateStepDetails(3, 
      `<i class="fas fa-check-circle" style="color: #2e7d32;"></i> ${barcodesFound.toLocaleString()} barcodes encontrados<br>` +
      `<small style="color: #1976d2;"><i class="fas fa-info-circle"></i> De ${itemsRequested.toLocaleString()} items solicitados (${percentage}%)</small><br>` +
      `<small style="color: #666;"><i class="far fa-clock"></i> ${this.formatTime(duration)}</small>`
    );
  },

  skipStep3() {
    this.setStepActive(3);
    this.setStepComplete(3);
    this.updateStepDetails(3, 
      `<small style="color: #666;"><i class="fas fa-forward"></i> Paso omitido (no hay OPs nuevas)</small>`
    );
  },

  // Paso 4: Validación
  startStep4() {
    this.setStepActive(4);
    this.updateStepDetails(4, '<i class="fas fa-spinner fa-spin"></i> Validando datos...');
  },

  updateStep4Progress(current, total, percentage) {
    this.updateStepDetails(4, 
      `<i class="fas fa-spinner fa-spin"></i> Validando: ${current.toLocaleString()} / ${total.toLocaleString()}<br>` +
      `<small style="color: #666;">${percentage}% completado</small>`
    );
  },

  completeStep4(stats) {
    const duration = this.getStepDuration(4);
    this.setStepComplete(4);
    
    const opsPerSecond = (stats.total / parseFloat(duration)).toFixed(0);
    
    this.updateStepDetails(4, 
      `<i class="fas fa-check-circle" style="color: #2e7d32;"></i> ${stats.total.toLocaleString()} OPs validadas<br>` +
      `<small style="color: #2e7d32;"><i class="fas fa-check"></i> Válidas: ${stats.valid.toLocaleString()}</small> | ` +
      `<small style="color: #c62828;"><i class="fas fa-times"></i> Inválidas: ${stats.errors.toLocaleString()}</small><br>` +
      `<small style="color: #666;"><i class="far fa-clock"></i> ${this.formatTime(duration)} <i class="fas fa-tachometer-alt"></i> ${opsPerSecond} OPs/s</small>`
    );
    
    // Actualizar stats
    document.getElementById('statDuplicates').textContent = stats.duplicates.toLocaleString();
  },

  // Paso 5: Subida
  startStep5() {
    this.setStepActive(5);
    this.updateStepDetails(5, '<i class="fas fa-spinner fa-spin"></i> Subiendo a base de datos...');
  },

  updateStep5Progress(percentage) {
    const progressBar = document.getElementById('uploadProgress');
    const progressText = document.getElementById('uploadProgressText');
    
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = percentage + '%';
  },

  completeStep5(successCount) {
    const duration = this.getStepDuration(5);
    this.setStepComplete(5);
    
    const recordsPerSecond = successCount > 0 ? (successCount / parseFloat(duration)).toFixed(0) : 0;
    
    this.updateStepDetails(5, 
      `<i class="fas fa-check-circle" style="color: #2e7d32;"></i> ${successCount.toLocaleString()} registros insertados<br>` +
      `<small style="color: #666;"><i class="far fa-clock"></i> ${this.formatTime(duration)} <i class="fas fa-tachometer-alt"></i> ${recordsPerSecond} reg/s</small>`
    );
    document.getElementById('statSuccess').textContent = successCount.toLocaleString();
  },

  skipStep5() {
    this.setStepActive(5);
    this.setStepComplete(5);
    this.updateStepDetails(5, 
      `<small style="color: #666;"><i class="fas fa-forward"></i> No hay registros nuevos para subir</small>`
    );
  },

  // Paso 6: Completado
  completeProcess(results) {
    this.setStepActive(6);
    this.setStepComplete(6);
    
    const totalTime = Object.keys(this.stepTimers)
      .filter(key => !isNaN(key))
      .reduce((sum, key) => {
        const nextKey = parseInt(key) + 1;
        if (this.stepTimers[nextKey]) return sum + (this.stepTimers[nextKey] - this.stepTimers[key]);
        return sum + (Date.now() - this.stepTimers[key]);
      }, 0) / 1000;
    
    const isSuccess = results.failed === 0;
    const statusDiv = document.getElementById('trackingStatus');
    if (statusDiv) {
      statusDiv.className = isSuccess ? 'tracking-status success' : 'tracking-status error';
      const s = statusDiv.querySelector('.status-text');
      if (s) s.textContent = isSuccess ? 'Completado' : 'Completado con errores';
    }

    if (isSuccess) {
      this.updateStepDetails(6, 
        `<div style="color: #2e7d32; font-weight: 600;">` +
        `<i class="fas fa-check-circle"></i> Proceso completado exitosamente` +
        `</div>` +
        `<small style="color: #666;"><i class="far fa-clock"></i> Tiempo total: ${this.formatTime(totalTime)}</small><br>` +
        `<small style="color: #666;"><i class="fas fa-chart-bar"></i> ${results.success.toLocaleString()} registros subidos | ${results.duplicates.toLocaleString()} duplicados ignorados</small>`
      );
    } else {
      this.updateStepDetails(6, 
        `<div style="color: #c62828; font-weight: 600;">` +
        `<i class="fas fa-exclamation-circle"></i> Completado con ${results.failed} errores` +
        `</div>` +
        `<small style="color: #666;"><i class="far fa-clock"></i> Tiempo total: ${this.formatTime(totalTime)}</small>`
      );
      document.getElementById('statErrors').textContent = results.failed.toLocaleString();
    }
    
    document.getElementById('actionFooter').style.display = 'block';
  },

  // Legacy methods (mantener compatibilidad)
  showLoading() {},
  updateLoadingMessage() {},
  hideLoading() {},
  showProgress() {},
  updateProgress() {},
  hideProgress() {},
  showResults() {}
};

function resetTracking() {
  document.getElementById('uploadSection').classList.remove('hidden');
  document.getElementById('trackingSection').classList.add('hidden');
  document.getElementById('fileInput').value = '';
  FileHandlerCurva.clear();
}

function closeResultModal() {
  resetTracking();
}
