// Control de interfaz de usuario

const UIController = {
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
  },

  resetAllSteps() {
    for (let i = 1; i <= 5; i++) {
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

  // Paso 1: Lectura del archivo
  startStep1() {
    this.setStepActive(1);
    this.updateStepDetails(1, '<i class="fas fa-spinner fa-spin"></i> Leyendo archivo...');
  },

  completeStep1(recordCount) {
    this.setStepComplete(1);
    this.updateStepDetails(1, `✓ ${recordCount.toLocaleString()} registros extraídos`);
    document.getElementById('statTotal').textContent = recordCount.toLocaleString();
  },

  // Paso 2: Carga de BD
  startStep2() {
    this.setStepActive(2);
    this.updateStepDetails(2, '<i class="fas fa-spinner fa-spin"></i> Cargando registros...');
  },

  updateStep2Progress(batch, duplicates, percentage) {
    this.updateStepDetails(2, `<i class="fas fa-spinner fa-spin"></i> Lote ${batch}: ${duplicates.toLocaleString()} duplicados (${percentage}%)`);
  },

  completeStep2(checked, duplicates) {
    this.setStepComplete(2);
    this.updateStepDetails(2, `✓ ${checked.toLocaleString()} verificados, ${duplicates.toLocaleString()} duplicados`);
  },

  // Paso 3: Validación
  startStep3() {
    this.setStepActive(3);
    this.updateStepDetails(3, '<i class="fas fa-spinner fa-spin"></i> Validando...');
  },

  updateStep3Progress(current, total, percentage) {
    this.updateStepDetails(3, `<i class="fas fa-spinner fa-spin"></i> ${current.toLocaleString()} / ${total.toLocaleString()} (${percentage}%)`);
  },

  completeStep3(stats) {
    this.setStepComplete(3);
    this.updateStepDetails(3, 
      `✓ Validación completa<br>` +
      `<small style="color: #2e7d32;">Nuevos: ${stats.valid.toLocaleString()}</small> | ` +
      `<small style="color: #f59e0b;">Duplicados: ${stats.duplicates.toLocaleString()}</small>`
    );
    
    // Actualizar stats
    document.getElementById('statDuplicates').textContent = stats.duplicates.toLocaleString();
  },

  // Paso 4: Subida
  startStep4() {
    this.setStepActive(4);
  },

  updateStep4Progress(percentage) {
    const progressBar = document.getElementById('uploadProgress');
    const progressText = document.getElementById('uploadProgressText');
    
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = percentage + '%';
  },

  completeStep4(successCount) {
    this.setStepComplete(4);
    this.updateStepDetails(4, `✓ ${successCount.toLocaleString()} registros insertados`);
    document.getElementById('statSuccess').textContent = successCount.toLocaleString();
  },

  // Paso 5: Completado
  completeProcess(results) {
    this.setStepActive(5);
    this.setStepComplete(5);
    
    const isSuccess = results.failed === 0;
    const statusDiv = document.getElementById('trackingStatus');
    
    if (statusDiv) {
      if (isSuccess) {
        statusDiv.className = 'tracking-status success';
        const st = statusDiv.querySelector('.status-text');
        if (st) st.textContent = 'Completado';
      } else {
        statusDiv.className = 'tracking-status error';
        const st = statusDiv.querySelector('.status-text');
        if (st) st.textContent = 'Completado con errores';
      }
    }

    if (isSuccess) {
      this.updateStepDetails(5, 
        `<div style="color: #2e7d32; font-weight: 600;">` +
        `<i class="fas fa-check-circle"></i> Proceso completado exitosamente` +
        `</div>`
      );
    } else {
      this.updateStepDetails(5, 
        `<div style="color: #c62828; font-weight: 600;">` +
        `<i class="fas fa-exclamation-circle"></i> Completado con ${results.failed} errores` +
        `</div>`
      );
      document.getElementById('statErrors').textContent = results.failed.toLocaleString();
    }
    
    // Mostrar botón de acción
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
  FileHandler.clear();
}

function closeResultModal() {
  resetTracking();
}
