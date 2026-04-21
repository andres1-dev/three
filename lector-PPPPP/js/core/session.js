// Gestión de sesión

function startSession() {
  AppState.sessionActive = true;
  AppState.sessionStartTime = new Date();
  AppState.sessionEndTime = null;
  AppState.totalScanTime = 0;
  AppState.lastScanTime = null;
  
  DOM.pauseBtn.classList.remove('hidden');
  DOM.stopBtn.classList.remove('hidden');
  DOM.input.focus();
  
  updateScanStatus('active', 'Escaneando...');
  
  // Iniciar timer (se actualizará solo cuando se escanee)
  updateTimer();
  
  AudioManager.playBeep(1000, 100);
}

function pauseSession() {
  if (AppState.sessionActive) {
    AppState.sessionActive = false;
    
    // Si había un escaneo en progreso, acumular el tiempo
    if (AppState.lastScanTime) {
      AppState.totalScanTime += Date.now() - AppState.lastScanTime;
      AppState.lastScanTime = null;
    }
    
    // Ocultar input de escaneo cuando está pausado
    DOM.input.style.display = 'none';
    
    updateScanStatus('paused', 'Pausado');
    DOM.pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Reanudar</span>';
    AudioManager.playBeep(800, 100);
  } else {
    AppState.sessionActive = true;
    
    // Mostrar input de escaneo cuando se reanuda
    DOM.input.style.display = 'block';
    DOM.input.focus();
    
    updateScanStatus('active', 'Escaneando...');
    DOM.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pausar</span>';
    AudioManager.playBeep(1000, 100);
  }
}

function endSession() {
  if (!confirm('¿Finalizar la sesión de conteo?')) return;
  
  AppState.sessionActive = false;
  AppState.sessionEndTime = new Date();
  
  // Acumular tiempo final si había escaneo en progreso
  if (AppState.lastScanTime) {
    AppState.totalScanTime += Date.now() - AppState.lastScanTime;
    AppState.lastScanTime = null;
  }
  
  DOM.pauseBtn.classList.add('hidden');
  DOM.stopBtn.classList.add('hidden');
  DOM.input.value = "";
  
  updateScanStatus('idle', 'Sesión finalizada');
  
  // Detener timer
  if (AppState.timerInterval) {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = null;
  }
  
  AudioManager.playBeep(800, 150);
}

function updateTimer() {
  let totalTime = AppState.totalScanTime;
  
  // Si hay un escaneo en progreso, agregar el tiempo desde el último escaneo
  if (AppState.lastScanTime && AppState.sessionActive) {
    totalTime += Date.now() - AppState.lastScanTime;
  }
  
  const hours = Math.floor(totalTime / 3600000);
  const minutes = Math.floor((totalTime % 3600000) / 60000);
  const seconds = Math.floor((totalTime % 60000) / 1000);
  
  DOM.sessionTimer.textContent = 
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateScanStatus(type, message) {
  const statusEl = DOM.scanStatus;
  const icon = statusEl.querySelector('i');
  const text = statusEl.querySelector('span');
  
  // Reset classes
  icon.className = 'fas fa-circle';
  
  switch(type) {
    case 'active':
      icon.style.color = 'var(--success)';
      break;
    case 'paused':
      icon.style.color = 'var(--warning)';
      break;
    case 'error':
      icon.style.color = 'var(--danger)';
      break;
    default:
      icon.style.color = 'var(--gray-400)';
  }
  
  text.textContent = message;
}
