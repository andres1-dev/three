// Configuración
const CONFIG = {
  FUNCTIONS_URL: "https://doqsurxxxaudnutsydlk.supabase.co/functions/v1",
  SCAN_TIMEOUT: 50, // Reducido a 50ms para procesar más rápido
  MIN_BARCODE_LENGTH: 5
};

// Estado de la aplicación
const AppState = {
  consolidated: new Map(),
  totalScans: 0,
  scanTimes: [],
  lastScan: null,
  sessionActive: false,
  sessionStartTime: null,
  sessionEndTime: null,
  timerInterval: null,
  selectedOP: null,
  opDetails: [],
  opData: null,
  countMode: 'laser',
  sentItems: new Set(), // Items ya enviados a bodega
  warehouseItems: { // Items por bodega con detalles
    DI: [],
    ZY: [],
    BP: [],
    ZZ: []
  },
  totalScanTime: 0, // Tiempo total acumulado en milisegundos
  lastScanTime: null, // Timestamp del último escaneo
  scanWithoutOP: false, // Modo escaneo sin OP
  scannedWithoutOP: new Map(), // Barras escaneadas en modo sin OP
  allBarcodesDB: new Map(), // Base de datos completa de códigos (para modo sin OP)
  warehouseStats: { // Estadísticas por bodega
    DI: 0,
    ZY: 0,
    BP: 0,
    ZZ: 0
  }
};

// Referencias DOM
const DOM = {
  input: null,
  scanStatus: null,
  pauseBtn: null,
  stopBtn: null,
  opSelector: null,
  opInput: null,
  opLoadingMessage: null,
  workspace: null,
  curvaTableBody: null,
  opInfoInline: null,
  opValueInline: null,
  refValueInline: null,
  qtyValueInline: null,
  sessionTimer: null
};

// Inicializar DOM
function initDOM() {
  DOM.input = document.getElementById("barcodeInput");
  DOM.scanStatus = document.getElementById("scanStatus");
  DOM.pauseBtn = document.getElementById("pauseBtn");
  DOM.stopBtn = document.getElementById("stopBtn");
  DOM.opSelector = document.getElementById("opSelector");
  DOM.opInput = document.getElementById("opInput");
  DOM.opLoadingMessage = document.getElementById("opLoadingMessage");
  DOM.workspace = document.getElementById("workspace");
  DOM.curvaTableBody = document.getElementById("curvaTableBody");
  DOM.opInfoInline = document.getElementById("opInfoInline");
  DOM.opValueInline = document.getElementById("opValueInline");
  DOM.refValueInline = document.getElementById("refValueInline");
  DOM.qtyValueInline = document.getElementById("qtyValueInline");
  DOM.sessionTimer = document.getElementById("sessionTimer");
}

// Inicializar eventos
function initEvents() {
  let scanBuffer = "";
  let scanTimeout = null;

  DOM.input.addEventListener("input", function(e) {
    clearTimeout(scanTimeout);
    scanBuffer = DOM.input.value.trim();
    
    if (scanBuffer.length > 0) {
      scanTimeout = setTimeout(() => {
        if (scanBuffer.length >= CONFIG.MIN_BARCODE_LENGTH) {
          // NO cambiar de modo si estamos en modo sin OP
          if (AppState.scanWithoutOP) {
            processScan(scanBuffer);
            return;
          }
          
          // Verificar si estamos en vista de bodega o modo manual
          const isInWarehouseView = document.querySelector('.warehouse-stat-compact.active');
          const isManualMode = AppState.countMode === 'manual';
          
          if (isInWarehouseView || isManualMode) {
            // Cambiar a modo láser si está en manual
            if (isManualMode) {
              document.getElementById('modeLaser').checked = true;
              switchCountMode();
            }
            
            // Volver a vista principal si está en bodega
            if (isInWarehouseView) {
              backToOP();
            }
            
            // Esperar un momento para que se actualice la vista
            setTimeout(() => {
              DOM.input.focus();
              processScan(scanBuffer);
            }, 100);
          } else {
            // Procesamiento normal
            processScan(scanBuffer);
          }
        }
        scanBuffer = "";
      }, CONFIG.SCAN_TIMEOUT);
    }
  });
  
  // Detectar escaneo global (cuando no está en el input)
  let globalScanBuffer = "";
  let globalScanTimeout = null;
  
  document.addEventListener("keypress", function(e) {
    // Solo capturar si NO estamos en un input/textarea/select
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }
    
    // NO capturar si estamos en modo sin OP
    if (AppState.scanWithoutOP) {
      return;
    }
    
    // Acumular caracteres
    globalScanBuffer += e.key;
    
    clearTimeout(globalScanTimeout);
    globalScanTimeout = setTimeout(() => {
      // Si parece un código de barras (solo números y longitud adecuada)
      if (/^\d+$/.test(globalScanBuffer) && globalScanBuffer.length >= CONFIG.MIN_BARCODE_LENGTH) {
        // Cambiar a modo láser si está en manual
        if (AppState.countMode === 'manual') {
          document.getElementById('modeLaser').checked = true;
          switchCountMode();
        }
        
        // Volver a vista principal si está en bodega
        const isInWarehouseView = document.querySelector('.warehouse-stat-compact.active');
        if (isInWarehouseView) {
          backToOP();
        }
        
        // Enfocar input y procesar
        setTimeout(() => {
          DOM.input.focus();
          DOM.input.value = globalScanBuffer;
          processScan(globalScanBuffer);
        }, 100);
      }
      globalScanBuffer = "";
    }, CONFIG.SCAN_TIMEOUT);
  });

  // Auto-cargar OP mientras escribe
  let opTimeout = null;
  DOM.opInput.addEventListener("input", function(e) {
    clearTimeout(opTimeout);
    const opCode = e.target.value.trim();
    
    // Limpiar mensaje si está vacío
    if (!opCode) {
      DOM.opLoadingMessage.innerHTML = '';
      return;
    }
    
    // Esperar 500ms después de que deje de escribir
    opTimeout = setTimeout(() => {
      if (opCode) {
        loadOP();
      }
    }, 500);
  });

  // Mantener foco durante sesión activa
  setInterval(() => {
    if (AppState.sessionActive && document.activeElement !== DOM.input) {
      DOM.input.focus();
    }
  }, 500);

  // Prevenir pérdida de foco
  document.addEventListener('click', (e) => {
    if (AppState.sessionActive && 
        e.target !== DOM.startBtn && 
        e.target !== DOM.endBtn) {
      DOM.input.focus();
    }
  });
}

// Cargar OP específica
async function loadOP() {
  const opCode = DOM.opInput.value.trim();
  
  if (!opCode) {
    alert('Por favor ingresa un número de OP');
    return;
  }

  try {
    DOM.opLoadingMessage.innerHTML = `
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        Cargando OP ${opCode}...
      </div>
    `;

    // Usar query con query parameters
    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/query?table=CURVA&eq_op=${opCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await response.json();
      DOM.opLoadingMessage.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-circle"></i>
          Error: ${error.error || 'Error al cargar OP'}
        </div>
      `;
      return;
    }

    const result = await response.json();
    
    // Verificar si se encontró la OP
    if (!result || result.length === 0) {
      DOM.opLoadingMessage.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-circle"></i>
          OP "${opCode}" no encontrada
        </div>
      `;
      return;
    }

    const data = result[0]; // query retorna un array

    // Consultar información adicional de SISPRO
    let sisproData = null;
    try {
      const sisproResponse = await fetch(`${CONFIG.FUNCTIONS_URL}/query?table=SISPRO&eq_OP=${opCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (sisproResponse.ok) {
        const sisproResult = await sisproResponse.json();
        if (sisproResult && sisproResult.length > 0) {
          sisproData = sisproResult[0];
          
          // Calcular atraso: días desde FEntregaConf hasta hoy
          if (sisproData.FEntregaConf) {
            const fechaEntrega = new Date(sisproData.FEntregaConf);
            const hoy = new Date();
            const diffTime = hoy - fechaEntrega;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            sisproData.atraso = diffDays;
          }
          
          console.log('✅ Información SISPRO obtenida:', sisproData);
        }
      }
    } catch (err) {
      console.warn('⚠️ No se pudo obtener información de SISPRO:', err);
    }

    AppState.selectedOP = opCode;
    AppState.opData = { ...data, sispro: sisproData };
    
    // Ordenar detalles: primero por número de color, luego por talla
    // Estructura de detalles: [id_color, color, referencia, talla, cantidad, barcode]
    // Ejemplo: ["022", "AZULTURQUI", "200066", "S", 63, "9990001005566"]
    const detalles = data.detalles || [];
    
    // Función para ordenar tallas: alfabéticamente o numéricamente
    const sortBySize = (tallaA, tallaB) => {
      // Si ambas son números, ordenar numéricamente
      const aNum = parseInt(tallaA);
      const bNum = parseInt(tallaB);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      // Si una es número y la otra no, números primero
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      
      // Orden alfabético para todo lo demás
      return tallaA.localeCompare(tallaB);
    };
    
    // Ordenar: primero por número de color (id_color), luego por talla
    detalles.sort((a, b) => {
      const [id_color_a, color_a, , talla_a] = a;
      const [id_color_b, color_b, , talla_b] = b;
      
      // Convertir id_color a número para ordenar correctamente
      // "003" -> 3, "022" -> 22, "072" -> 72
      const numeroColorA = parseInt(id_color_a) || 9999;
      const numeroColorB = parseInt(id_color_b) || 9999;
      
      // Primero comparar por número de color
      if (numeroColorA !== numeroColorB) {
        return numeroColorA - numeroColorB;
      }
      
      // Si tienen el mismo número de color, ordenar por talla
      return sortBySize(talla_a, talla_b);
    });
    
    console.log('✅ Detalles ordenados por número de color y talla:');
    detalles.slice(0, 10).forEach(d => {
      const [id_color, color, , talla] = d;
      console.log(`  ${id_color} (${parseInt(id_color)}) - ${color} - ${talla}`);
    });
    
    AppState.opDetails = detalles;

    // Ocultar selector y mostrar workspace
    DOM.opSelector.classList.add('hidden');
    DOM.workspace.classList.remove('hidden');
    DOM.opInfoInline.classList.remove('hidden');

    // Actualizar info de OP inline
    DOM.opValueInline.textContent = data.op;
    DOM.refValueInline.textContent = data.referencia;
    DOM.qtyValueInline.textContent = data.cantidad;
    
    // Actualizar información de SISPRO si está disponible
    if (sisproData) {
      if (sisproData.NombrePlanta) {
        document.getElementById('opInfoPlanta').style.display = 'flex';
        document.getElementById('plantaValueInline').textContent = sisproData.NombrePlanta;
      }
      if (sisproData.pvp) {
        document.getElementById('opInfoPVP').style.display = 'flex';
        document.getElementById('pvpValueInline').textContent = `$${parseInt(sisproData.pvp).toLocaleString()}`;
      }
      if (sisproData.Costo) {
        document.getElementById('opInfoCosto').style.display = 'flex';
        document.getElementById('costoValueInline').textContent = `$${parseInt(sisproData.Costo).toLocaleString()}`;
      }
      if (sisproData.atraso !== undefined) {
        document.getElementById('opInfoAtraso').style.display = 'flex';
        const atrasoEl = document.getElementById('atrasoValueInline');
        atrasoEl.textContent = `${sisproData.atraso} días`;
        // Colorear según el atraso
        if (sisproData.atraso > 0) {
          atrasoEl.style.color = 'var(--danger)';
        } else if (sisproData.atraso < 0) {
          atrasoEl.style.color = 'var(--success)';
        } else {
          atrasoEl.style.color = 'var(--warning)';
        }
      }
    }

    // Renderizar tabla de curva
    UIManager.renderCurvaTable();

    // Guardar estado en localStorage
    saveStateToLocalStorage();

    // Iniciar sesión automáticamente en modo láser
    if (AppState.countMode === 'laser') {
      startSession();
    }
    
  } catch (err) {
    console.error('Error cargando OP:', err);
    
    let errorMsg = err.message;
    if (err.message === 'Failed to fetch') {
      errorMsg = 'No se puede conectar al servidor. Verifica que la Edge Function "query" esté desplegada en Supabase.';
    }
    
    LogManager.error(`Error al cargar OP ${opCode}`, { error: errorMsg });
    
    DOM.opLoadingMessage.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        Error: ${errorMsg}
      </div>
    `;
  }
}

// Cambiar OP
function changeOP() {
  if (AppState.sessionActive) {
    if (!confirm('Hay una sesión activa. ¿Deseas finalizarla y cambiar de OP?')) {
      return;
    }
    endSession();
  }

  if (AppState.consolidated.size > 0) {
    if (!confirm('¿Estás seguro? Se perderán los datos escaneados.')) {
      return;
    }
  }

  // Limpiar datos
  AppState.consolidated.clear();
  AppState.totalScans = 0;
  AppState.scanTimes = [];
  AppState.lastScan = null;
  AppState.selectedOP = null;
  AppState.opDetails = [];
  AppState.opData = null;
  AppState.sentItems.clear();
  AppState.scanWithoutOP = false;
  AppState.scannedWithoutOP.clear();
  AppState.allBarcodesDB.clear(); // Limpiar base de datos descargada
  AppState.warehouseStats = { DI: 0, ZY: 0, BP: 0, ZZ: 0 };

  // Limpiar localStorage
  localStorage.removeItem('conteoAppState');

  // Mostrar selector
  DOM.opSelector.classList.remove('hidden');
  DOM.workspace.classList.add('hidden');
  DOM.opInfoInline.classList.add('hidden');
  
  // Restaurar tabla de curva
  const dataPanel = document.querySelector('.data-panel');
  if (dataPanel) dataPanel.style.display = 'flex';
  
  // Restaurar selector de bodega
  const warehouseSelector = document.querySelector('.warehouse-selector');
  if (warehouseSelector) warehouseSelector.style.display = 'flex';
  
  // Restaurar header de tabla
  const dataPanelHeader = document.querySelector('.data-panel-header h2');
  if (dataPanelHeader) {
    dataPanelHeader.innerHTML = '<i class="fas fa-table"></i> Curva de Producción';
  }
  
  // Restaurar headers de la tabla
  const tableHeader = document.getElementById('tableHeader');
  if (tableHeader) {
    tableHeader.innerHTML = `
      <tr>
        <th>Color</th>
        <th>Talla</th>
        <th>Stock</th>
        <th>Validado</th>
        <th>Diferencia</th>
      </tr>
    `;
  }

  // Limpiar input
  DOM.opInput.value = '';
  DOM.opLoadingMessage.innerHTML = '';
  updateWarehouseStats();
}

// Cambiar modo de conteo
function switchCountMode() {
  const mode = document.querySelector('input[name="countMode"]:checked').value;
  const previousMode = AppState.countMode;
  AppState.countMode = mode;
  
  const btnFillAll = document.getElementById('btnFillAll');
  
  // Volver a la vista de OP si estamos en una bodega
  const isInWarehouseView = document.querySelector('.warehouse-stat-compact.active');
  if (isInWarehouseView) {
    backToOP();
  }
  
  if (mode === 'laser') {
    // Cambio a modo láser
    DOM.input.style.display = 'block';
    updateScanStatus('idle', 'Modo Láser activado');
    
    // Ocultar botón de completar todo
    if (btnFillAll) btnFillAll.classList.add('hidden');
    
    // Si venía de manual, reiniciar sesión automáticamente
    if (previousMode === 'manual') {
      startSession();
    }
  } else {
    // Cambio a modo manual
    DOM.input.style.display = 'none';
    updateScanStatus('idle', 'Modo Manual activado');
    
    // Mostrar botón de completar todo
    if (btnFillAll) btnFillAll.classList.remove('hidden');
    
    // Actualizar estado del botón
    updateFillAllButton();
    
    // Detener sesión si está activa
    if (AppState.sessionActive) {
      AppState.sessionActive = false;
      AppState.sessionEndTime = new Date();
      
      // Ocultar botones
      DOM.pauseBtn.classList.add('hidden');
      DOM.stopBtn.classList.add('hidden');
      DOM.pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pausar</span>';
      
      // Detener timer
      if (AppState.timerInterval) {
        clearInterval(AppState.timerInterval);
        AppState.timerInterval = null;
      }
    }
  }
  
  UIManager.renderCurvaTable();
}

// Completar toda la curva en modo manual
function fillAllManual() {
  if (AppState.countMode !== 'manual') return;
  
  if (!confirm('¿Completar toda la curva al 100%?')) {
    return;
  }
  
  let itemsCompleted = 0;
  
  AppState.opDetails.forEach(detail => {
    const [id_color, color, referencia, talla, cantidad_esperada, barcode] = detail;
    const key = `${id_color}-${talla}`;
    
    // Establecer al 100%
    if (AppState.consolidated.has(key)) {
      const existing = AppState.consolidated.get(key);
      existing.count = cantidad_esperada;
    } else {
      AppState.consolidated.set(key, {
        barcode,
        id_color,
        color,
        referencia,
        talla,
        cantidad_esperada,
        count: cantidad_esperada,
        warehouse: 'PRIMERAS',
        timestamp: new Date()
      });
    }
    
    itemsCompleted++;
  });
  
  // Re-renderizar tabla completa
  UIManager.renderCurvaTable();
  
  // Guardar estado
  saveStateToLocalStorage();
  
  // Actualizar botón
  updateFillAllButton();
  
  // Log
  LogManager.found(
    `Curva completada: ${itemsCompleted} items al 100%`,
    null,
    { items: itemsCompleted, modo: 'manual' }
  );
  
  AudioManager.playBeep(1000, 150);
}

// Limpiar toda la curva en modo manual
function clearAllManual() {
  if (AppState.countMode !== 'manual') return;
  
  if (!confirm('¿Limpiar todos los conteos?')) {
    return;
  }
  
  // Limpiar todos los conteos
  AppState.consolidated.clear();
  
  // Re-renderizar tabla completa
  UIManager.renderCurvaTable();
  
  // Guardar estado
  saveStateToLocalStorage();
  
  // Actualizar botón
  updateFillAllButton();
  
  // Log
  LogManager.found(
    'Todos los conteos limpiados',
    null,
    { modo: 'manual' }
  );
  
  AudioManager.playBeep(800, 100);
}

// Toggle entre completar y limpiar
function toggleFillAll() {
  // Verificar si hay items con conteo
  const hasAnyCount = Array.from(AppState.consolidated.values()).some(item => item.count > 0);
  
  if (hasAnyCount) {
    clearAllManual();
  } else {
    fillAllManual();
  }
}

// Actualizar estado del botón
function updateFillAllButton() {
  const btnFillAll = document.getElementById('btnFillAll');
  const btnFillAllText = document.getElementById('btnFillAllText');
  
  if (!btnFillAll || !btnFillAllText) return;
  
  // Verificar si hay items con conteo
  const hasAnyCount = Array.from(AppState.consolidated.values()).some(item => item.count > 0);
  
  if (hasAnyCount) {
    // Cambiar a modo "Limpiar"
    btnFillAll.querySelector('i').className = 'fas fa-times-circle';
    btnFillAllText.textContent = 'Limpiar Todo';
    btnFillAll.style.background = 'var(--danger)';
  } else {
    // Cambiar a modo "Completar"
    btnFillAll.querySelector('i').className = 'fas fa-check-circle';
    btnFillAllText.textContent = 'Completar Todo';
    btnFillAll.style.background = 'var(--success)';
  }
}

// Actualizar conteo manual
function updateManualCount(key, value) {
  const count = parseInt(value) || 0;
  
  const detail = AppState.opDetails.find(d => {
    const [id_color, , , talla] = d;
    return `${id_color}-${talla}` === key;
  });
  
  if (!detail) return;
  
  const [id_color, color, referencia, talla, cantidad_esperada, barcode] = detail;
  
  // NO permitir más del esperado
  if (count > cantidad_esperada) {
    const input = document.querySelector(`input[data-key="${key}"]`);
    if (input) {
      input.value = cantidad_esperada;
    }
    LogManager.warning(
      `Límite alcanzado en modo manual: ${color} - ${talla}`,
      { color, talla, limite: cantidad_esperada }
    );
    return;
  }
  
  if (count === 0) {
    // Si es 0, eliminar del consolidated
    AppState.consolidated.delete(key);
  } else {
    const previousCount = AppState.consolidated.has(key) ? AppState.consolidated.get(key).count : 0;
    
    if (AppState.consolidated.has(key)) {
      const existing = AppState.consolidated.get(key);
      existing.count = count;
    } else {
      AppState.consolidated.set(key, {
        barcode,
        id_color,
        color,
        referencia,
        talla,
        cantidad_esperada,
        count,
        warehouse: 'PRIMERAS',
        timestamp: new Date()
      });
    }
    
    // Log solo si cambió el valor
    if (count !== previousCount) {
      LogManager.found(
        `Conteo manual: ${color} - ${talla} = ${count}/${cantidad_esperada}`,
        null,
        { color, talla, count, esperado: cantidad_esperada }
      );
    }
  }
  
  // Re-renderizar tabla completa para mover items al 100%
  UIManager.renderCurvaTable();
  
  // Actualizar botón dinámico
  updateFillAllButton();
  
  // Guardar estado
  saveStateToLocalStorage();
}

// Actualizar bodega y enviar
function updateWarehouse(key, warehouse) {
  const scanned = AppState.consolidated.get(key);
  
  if (!scanned || scanned.count === 0) {
    alert('Debes contar al menos 1 unidad antes de enviar a bodega');
    // Resetear selector
    const select = document.querySelector(`select[data-key="${key}"]`);
    if (select) select.value = 'PRIMERAS';
    return;
  }
  
  if (warehouse !== 'PRIMERAS') {
    // Confirmar envío
    if (confirm(`¿Enviar ${scanned.count} unidades de ${scanned.color} - ${scanned.talla} a ${warehouse}?`)) {
      // Marcar como enviado
      AppState.sentItems.add(key);
      
      // Ocultar fila con animación
      const row = document.querySelector(`tr[data-key="${key}"]`);
      if (row) {
        row.style.transition = 'opacity 0.3s, transform 0.3s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        
        setTimeout(() => {
          row.style.display = 'none';
        }, 300);
      }
      
      AudioManager.playBeep(800, 150);
    } else {
      // Cancelar, volver a PRIMERAS
      const select = document.querySelector(`select[data-key="${key}"]`);
      if (select) select.value = 'PRIMERAS';
    }
  }
}

// Limpiar funciones del modal que ya no se usan
function openDistributionModal() {}
function closeDistributionModal() {}
function updateAvailable() {}
function saveDistribution() {}

// Iniciar aplicación
function init() {
  initDOM();
  initEvents();
  updateWarehouseStats();
  
  // Restaurar estado desde localStorage
  loadStateFromLocalStorage();
}

// Guardar estado en localStorage
function saveStateToLocalStorage() {
  try {
    const state = {
      selectedOP: AppState.selectedOP,
      opData: AppState.opData,
      opDetails: AppState.opDetails,
      consolidated: Array.from(AppState.consolidated.entries()),
      totalScans: AppState.totalScans,
      sentItems: Array.from(AppState.sentItems),
      warehouseItems: AppState.warehouseItems,
      scanWithoutOP: AppState.scanWithoutOP,
      scannedWithoutOP: Array.from(AppState.scannedWithoutOP.entries()),
      allBarcodesDB: Array.from(AppState.allBarcodesDB.entries()),
      warehouseStats: AppState.warehouseStats,
      countMode: AppState.countMode,
      timestamp: Date.now()
    };
    
    localStorage.setItem('conteoAppState', JSON.stringify(state));
  } catch (err) {
    console.error('Error guardando estado:', err);
  }
}

// Cargar estado desde localStorage
function loadStateFromLocalStorage() {
  try {
    const saved = localStorage.getItem('conteoAppState');
    if (!saved) return;
    
    const state = JSON.parse(saved);
    
    // Verificar que no sea muy antiguo (más de 24 horas)
    const hoursSinceLastSave = (Date.now() - state.timestamp) / (1000 * 60 * 60);
    if (hoursSinceLastSave > 24) {
      console.log('⏰ Estado guardado muy antiguo, ignorando');
      localStorage.removeItem('conteoAppState');
      return;
    }
    
    // Restaurar estado
    if (state.selectedOP) {
      AppState.selectedOP = state.selectedOP;
      AppState.opData = state.opData;
      AppState.opDetails = state.opDetails || [];
      AppState.consolidated = new Map(state.consolidated || []);
      AppState.totalScans = state.totalScans || 0;
      AppState.sentItems = new Set(state.sentItems || []);
      AppState.warehouseItems = state.warehouseItems || { DI: [], ZY: [], BP: [], ZZ: [] };
      AppState.scanWithoutOP = state.scanWithoutOP || false;
      AppState.scannedWithoutOP = new Map(state.scannedWithoutOP || []);
      AppState.allBarcodesDB = new Map(state.allBarcodesDB || []);
      AppState.warehouseStats = state.warehouseStats || { DI: 0, ZY: 0, BP: 0, ZZ: 0 };
      AppState.countMode = state.countMode || 'laser';
      
      // Actualizar UI
      DOM.opSelector.classList.add('hidden');
      DOM.workspace.classList.remove('hidden');
      
      if (state.scanWithoutOP) {
        // Modo sin OP
        DOM.opInfoInline.classList.add('hidden');
        
        const dataPanel = document.querySelector('.data-panel');
        if (dataPanel) dataPanel.style.display = 'flex';
        
        const warehouseSelector = document.querySelector('.warehouse-selector');
        if (warehouseSelector) warehouseSelector.style.display = 'none';
        
        const dataPanelHeader = document.querySelector('.data-panel-header h2');
        if (dataPanelHeader) {
          dataPanelHeader.innerHTML = `<i class="fas fa-barcode"></i> Escaneo sin OP - Validación de Barras (${AppState.allBarcodesDB.size} códigos cargados)`;
        }
        
        const tableHeader = document.getElementById('tableHeader');
        if (tableHeader) {
          tableHeader.innerHTML = `
            <tr>
              <th>Referencia</th>
              <th>Color</th>
              <th>Talla</th>
              <th>Cantidad</th>
              <th>Código de Barras</th>
            </tr>
          `;
        }
        
        renderTableWithoutOP();
      } else {
        // Modo con OP
        DOM.opInfoInline.classList.remove('hidden');
        DOM.opValueInline.textContent = state.opData.op;
        DOM.refValueInline.textContent = state.opData.referencia;
        DOM.qtyValueInline.textContent = state.opData.cantidad;
        
        UIManager.renderCurvaTable();
      }
      
      updateWarehouseStats();
      
      // Iniciar sesión automáticamente en modo láser
      if (AppState.countMode === 'laser' && !state.scanWithoutOP) {
        startSession();
      }
      
      console.log('✅ Estado restaurado desde localStorage');
    }
  } catch (err) {
    console.error('Error cargando estado:', err);
    localStorage.removeItem('conteoAppState');
  }
}

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', init);

// Modo escaneo sin OP
async function startScanWithoutOP() {
  // Configurar modo sin OP
  AppState.selectedOP = null;
  AppState.opDetails = [];
  AppState.opData = null;
  AppState.scanWithoutOP = true;
  AppState.consolidated.clear();
  AppState.scannedWithoutOP = new Map();
  
  // Ocultar selector y mostrar workspace
  DOM.opSelector.classList.add('hidden');
  DOM.workspace.classList.remove('hidden');
  
  // Ocultar info de OP inline
  DOM.opInfoInline.classList.add('hidden');
  
  // Mostrar tabla de curva
  const dataPanel = document.querySelector('.data-panel');
  if (dataPanel) dataPanel.style.display = 'flex';
  
  // Ocultar selector de bodega y completed section
  const warehouseSelector = document.querySelector('.warehouse-selector');
  if (warehouseSelector) warehouseSelector.style.display = 'none';
  
  const completedSection = document.getElementById('completedSection');
  if (completedSection) completedSection.classList.add('hidden');
  
  // Actualizar header de tabla
  const dataPanelHeader = document.querySelector('.data-panel-header h2');
  if (dataPanelHeader) {
    dataPanelHeader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Descargando base de datos...';
  }
  
  // Cambiar headers de la tabla
  const tableHeader = document.getElementById('tableHeader');
  if (tableHeader) {
    tableHeader.innerHTML = `
      <tr>
        <th>Referencia</th>
        <th>Color</th>
        <th>Talla</th>
        <th>Cantidad</th>
        <th>Código de Barras</th>
      </tr>
    `;
  }
  
  // Mostrar mensaje de carga
  DOM.curvaTableBody.innerHTML = `
    <tr>
      <td colspan="5" class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Descargando base de datos de códigos de barras...</span>
      </td>
    </tr>
  `;
  
  try {
    // Descargar toda la base de datos de códigos
    await downloadAllBarcodes();
    
    // Actualizar header
    if (dataPanelHeader) {
      dataPanelHeader.innerHTML = `<i class="fas fa-barcode"></i> Escaneo sin OP - Validación de Barras (${AppState.allBarcodesDB.size} códigos cargados)`;
    }
    
    // Renderizar tabla vacía
    renderTableWithoutOP();
    
    // Iniciar sesión automáticamente
    startSession();
    
    LogManager.found(`Modo escaneo sin OP activado - ${AppState.allBarcodesDB.size} códigos descargados`, null, { 
      modo: 'sin_op',
      codigos_descargados: AppState.allBarcodesDB.size
    });
    
  } catch (err) {
    console.error('Error descargando base de datos:', err);
    
    if (dataPanelHeader) {
      dataPanelHeader.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error al descargar base de datos';
    }
    
    DOM.curvaTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state" style="color: var(--danger);">
          <i class="fas fa-exclamation-circle"></i>
          <span>Error al descargar base de datos: ${err.message}</span>
          <br><br>
          <button onclick="changeOP()" class="btn-secondary" style="margin-top: 10px;">
            <i class="fas fa-arrow-left"></i> Volver
          </button>
        </td>
      </tr>
    `;
    
    LogManager.error('Error al descargar base de datos', { error: err.message });
  }
}

// Descargar toda la base de datos de códigos de barras
async function downloadAllBarcodes() {
  // Usar la función query con paginación automática
  // Primero obtener todas las barras
  const barcodesResponse = await fetch(
    `${CONFIG.FUNCTIONS_URL}/query?table=BARRAS&select=barcode,referencia,talla,id_color`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );

  if (!barcodesResponse.ok) {
    const error = await barcodesResponse.json();
    throw new Error(error.error || 'Error al descargar códigos de barras');
  }

  const barcodes = await barcodesResponse.json();
  
  // Luego obtener todos los colores
  const colorsResponse = await fetch(
    `${CONFIG.FUNCTIONS_URL}/query?table=COLORES&select=id_color,color`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );

  if (!colorsResponse.ok) {
    const error = await colorsResponse.json();
    throw new Error(error.error || 'Error al descargar colores');
  }

  const colors = await colorsResponse.json();
  
  // Crear un mapa de colores para búsqueda rápida
  const colorsMap = new Map();
  colors.forEach(c => {
    colorsMap.set(c.id_color, c.color);
  });
  
  // Limpiar y llenar el Map
  AppState.allBarcodesDB.clear();
  
  barcodes.forEach(item => {
    // Convertir barcode a string y limpiar espacios
    const cleanBarcode = String(item.barcode).trim();
    
    AppState.allBarcodesDB.set(cleanBarcode, {
      barcode: cleanBarcode,
      referencia: item.referencia,
      color: colorsMap.get(item.id_color) || 'N/A',
      talla: item.talla,
      id_color: item.id_color
    });
  });
  
  console.log(`✅ Base de datos descargada: ${AppState.allBarcodesDB.size} códigos`);
}

// Renderizar tabla en modo sin OP
function renderTableWithoutOP() {
  if (!AppState.scannedWithoutOP || AppState.scannedWithoutOP.size === 0) {
    DOM.curvaTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="fas fa-barcode"></i>
          <span>Escanea barras para validar y ver información</span>
        </td>
      </tr>
    `;
    return;
  }
  
  // Convertir Map a array y ordenar por timestamp (más reciente primero)
  const items = Array.from(AppState.scannedWithoutOP.values())
    .sort((a, b) => b.timestamp - a.timestamp);
  
  DOM.curvaTableBody.innerHTML = items.map(item => `
    <tr>
      <td class="number-cell">${item.referencia}</td>
      <td class="color-cell">${item.color}</td>
      <td class="talla-cell">${item.talla}</td>
      <td class="number-cell contado-cell">${item.count}</td>
      <td style="font-family: 'Courier New', monospace; font-size: 11px; color: var(--gray-600);">${item.barcode}</td>
    </tr>
  `).join('');
}

// Procesar escaneo sin OP (OFFLINE - usa base de datos local)
function processScanWithoutOP(code) {
  // Limpiar el código (trim y convertir a string)
  code = String(code).trim();
  
  DOM.input.value = "";
  updateScanStatus('active', 'Validando...');
  
  const expectedLength = 13;
  
  // Validar que sea un código de barras válido (solo números)
  const isValidBarcodeFormat = /^\d+$/.test(code);
  
  if (!isValidBarcodeFormat) {
    // NO es un código de barras válido -> ERROR
    const errorMsg = `FORMATO INVÁLIDO: ${code}`;
    LogManager.error(errorMsg, { 
      entrada: code,
      razon: 'No es un código de barras válido (debe contener solo números)'
    });
    AudioManager.playBeep(400, 300);
    updateScanStatus('idle', 'Listo');
    return;
  }
  
  // Validar longitud
  if (code.length !== expectedLength) {
    const errorMsg = `LONGITUD INCORRECTA: ${code} (${code.length} dígitos, esperado: ${expectedLength})`;
    LogManager.error(errorMsg, { 
      barcode: code,
      longitud: code.length,
      esperada: expectedLength,
      razon: 'Longitud incorrecta'
    });
    AudioManager.playBeep(400, 200);
    updateScanStatus('idle', 'Listo');
    return;
  }
  
  // Buscar en la base de datos LOCAL
  const barcodeData = AppState.allBarcodesDB.get(code);
  
  if (barcodeData) {
    // Código encontrado en base de datos local
    const key = code;
    if (AppState.scannedWithoutOP.has(key)) {
      // Ya existe, incrementar contador
      const existing = AppState.scannedWithoutOP.get(key);
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      // Nueva barra
      AppState.scannedWithoutOP.set(key, {
        barcode: code,
        referencia: barcodeData.referencia,
        color: barcodeData.color,
        talla: barcodeData.talla,
        count: 1,
        timestamp: Date.now()
      });
    }
    
    const currentCount = AppState.scannedWithoutOP.get(key).count;
    
    LogManager.found(
      `Ref: ${barcodeData.referencia} | ${barcodeData.color} - ${barcodeData.talla} (x${currentCount})`,
      code,
      { 
        referencia: barcodeData.referencia,
        color: barcodeData.color,
        talla: barcodeData.talla,
        count: currentCount
      }
    );
    
    // Actualizar tabla
    renderTableWithoutOP();
    
    AudioManager.playBeep(1000, 100);
    
    // Guardar estado
    saveStateToLocalStorage();
  } else {
    // Código con formato válido pero NO encontrado en base de datos -> NO ENCONTRADA
    LogManager.notfound(`NO ENCONTRADO: ${code}`, code, { 
      barcode: code,
      razon: 'Código válido pero no registrado en la base de datos'
    });
    AudioManager.playBeep(400, 300);
  }
  
  updateScanStatus('idle', 'Listo');
}


// Enviar items escaneados a bodega
function sendToWarehouse(warehouseCode) {
  if (!warehouseCode) return;
  
  const warehouse = WAREHOUSES.find(w => w.code === warehouseCode);
  if (!warehouse) return;
  
  // Obtener todos los items que tienen al menos 1 unidad escaneada
  const scannedItems = [];
  
  AppState.opDetails.forEach((detail, index) => {
    const [id_color, color, referencia, talla, cantidad, barcode] = detail;
    const key = `${id_color}-${talla}`;
    
    const scanned = AppState.consolidated.get(key);
    if (scanned && scanned.count > 0) {
      scannedItems.push({ 
        key, 
        color,
        referencia,
        talla, 
        count: scanned.count, 
        id_color,
        barcode,
        stockActual: cantidad,
        detailIndex: index
      });
    }
  });
  
  if (scannedItems.length === 0) {
    alert('No hay items escaneados para enviar');
    document.getElementById('globalWarehouseSelect').value = '';
    return;
  }
  
  const itemsText = scannedItems.map(i => `${i.color} - ${i.talla} (${i.count} unidades)`).join('\n');
  
  if (confirm(`¿Enviar ${scannedItems.length} items a ${warehouse.name}?\n\n${itemsText}`)) {
    // Guardar detalles de items en la bodega y hacer split del stock
    scannedItems.forEach(item => {
      // Verificar si ya existe un item con el mismo barcode en la bodega
      const existingItem = AppState.warehouseItems[warehouseCode].find(i => i.barcode === item.barcode);
      
      if (existingItem) {
        // Si existe, sumar las cantidades
        existingItem.count += item.count;
        existingItem.timestamp = Date.now();
      } else {
        // Si no existe, crear nuevo item
        AppState.warehouseItems[warehouseCode].push({
          key: item.key,
          barcode: item.barcode,
          color: item.color,
          referencia: item.referencia,
          talla: item.talla,
          count: item.count,
          id_color: item.id_color,
          stockOriginal: item.stockActual,
          timestamp: Date.now()
        });
      }
      
      // SPLIT REAL: Reducir el stock en opDetails
      const detail = AppState.opDetails[item.detailIndex];
      if (detail) {
        detail[4] = detail[4] - item.count; // Restar del stock
      }
      
      // Resetear el contador de esta combinación a 0
      AppState.consolidated.delete(item.key);
    });
    
    // Actualizar estadísticas de bodega (se calcula automáticamente)
    updateWarehouseStats();
    
    // Re-renderizar tabla para mostrar nuevo stock
    UIManager.renderCurvaTable();
    
    // Log de envío
    LogManager.found(
      `${scannedItems.length} items enviados a ${warehouse.name}`,
      null,
      { bodega: warehouseCode, items: scannedItems.length }
    );
    
    // Guardar estado
    saveStateToLocalStorage();
    
    AudioManager.playBeep(800, 150);
    
    // Resetear selector
    setTimeout(() => {
      document.getElementById('globalWarehouseSelect').value = '';
    }, 500);
  } else {
    document.getElementById('globalWarehouseSelect').value = '';
  }
}

// Actualizar estadísticas de bodegas
function updateWarehouseStats() {
  // Calcular suma de unidades por bodega
  const calculateUnits = (warehouseCode) => {
    const items = AppState.warehouseItems[warehouseCode] || [];
    return items.reduce((total, item) => total + item.count, 0);
  };
  
  document.getElementById('warehouseDI').textContent = calculateUnits('DI');
  document.getElementById('warehouseZY').textContent = calculateUnits('ZY');
  document.getElementById('warehouseBP').textContent = calculateUnits('BP');
  document.getElementById('warehouseZZ').textContent = calculateUnits('ZZ');
}

// Ocultar input cuando se abre el select de bodega
function hideInputOnSelectFocus() {
  if (DOM.input) {
    DOM.input.style.display = 'none';
  }
}

// Mostrar input cuando se cierra el select de bodega
function showInputOnSelectBlur() {
  if (DOM.input && AppState.sessionActive && AppState.countMode === 'laser') {
    DOM.input.style.display = 'block';
    // Dar un pequeño delay antes de enfocar para evitar conflictos
    setTimeout(() => {
      DOM.input.focus();
    }, 100);
  }
}


// Toggle completed items
function toggleCompleted() {
  const cards = document.getElementById('completedCards');
  const chevron = document.getElementById('completedChevron');
  
  if (cards.classList.contains('hidden')) {
    cards.classList.remove('hidden');
    chevron.style.transform = 'rotate(180deg)';
  } else {
    cards.classList.add('hidden');
    chevron.style.transform = 'rotate(0deg)';
  }
}


// Mostrar detalles de bodega en el área principal
function showWarehouseDetails(warehouseCode) {
  const warehouse = WAREHOUSES.find(w => w.code === warehouseCode);
  if (!warehouse) return;
  
  // Marcar bodega como activa
  document.querySelectorAll('.warehouse-stat-compact').forEach(el => {
    el.classList.remove('active');
  });
  document.querySelector(`.warehouse-stat-compact[data-warehouse="${warehouseCode}"]`)?.classList.add('active');
  
  // Ocultar selector de bodega
  const warehouseSelector = document.querySelector('.warehouse-selector');
  if (warehouseSelector) warehouseSelector.style.display = 'none';
  
  // Actualizar header de tabla
  const dataPanelHeader = document.querySelector('.data-panel-header h2');
  if (dataPanelHeader) {
    dataPanelHeader.innerHTML = `
      <i class="fas fa-warehouse"></i>
      Bodega: ${warehouse.name}
      <button class="btn-back-to-op" onclick="backToOP()">
        <i class="fas fa-arrow-left"></i>
        Volver a OP
      </button>
    `;
  }
  
  // Cambiar headers de la tabla
  const tableHeader = document.getElementById('tableHeader');
  if (tableHeader) {
    tableHeader.innerHTML = `
      <tr>
        <th>Color</th>
        <th>Talla</th>
        <th>Stock</th>
        <th>Trasladar</th>
        <th>Acciones</th>
      </tr>
    `;
  }
  
  // Obtener items de esta bodega
  const items = AppState.warehouseItems[warehouseCode] || [];
  
  if (items.length === 0) {
    DOM.curvaTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="fas fa-box-open"></i>
          <span>No hay items en esta bodega</span>
        </td>
      </tr>
    `;
  } else {
    // Crear opciones de bodegas excluyendo la actual, pero incluyendo "PRINCIPAL"
    const warehouseOptions = [
      '<option value="PRINCIPAL">PRINCIPAL (Tabla de Curva)</option>',
      ...WAREHOUSES
        .filter(w => w.code !== warehouseCode)
        .map(w => `<option value="${w.code}">${w.name}</option>`)
    ].join('');
    
    DOM.curvaTableBody.innerHTML = items.map((item, index) => {
      return `
        <tr>
          <td class="color-cell">${item.color}</td>
          <td class="talla-cell">${item.talla}</td>
          <td class="number-cell esperado-cell">${item.count}</td>
          <td class="number-cell">
            <input type="number" class="count-input" value="1" min="1" max="${item.count}" 
                   id="qty-${warehouseCode}-${index}" onfocus="hideInputOnSelectFocus()" onblur="showInputOnSelectBlur()">
          </td>
          <td>
            <div class="warehouse-actions">
              <select class="warehouse-change-select" id="dest-${warehouseCode}-${index}" 
                      onfocus="hideInputOnSelectFocus()" onblur="showInputOnSelectBlur()">
                <option value="">Mover a...</option>
                ${warehouseOptions}
              </select>
              <button class="btn-apply-move" onclick="applyWarehouseMove('${warehouseCode}', ${index})">
                <i class="fas fa-arrow-right"></i>
                Mover
              </button>
              <button class="btn-revert-table" onclick="revertWarehouseItem('${warehouseCode}', ${index})">
                <i class="fas fa-times"></i>
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// Volver a la vista de OP
function backToOP() {
  // Desmarcar todas las bodegas
  document.querySelectorAll('.warehouse-stat-compact').forEach(el => {
    el.classList.remove('active');
  });
  
  // Restaurar selector de bodega
  const warehouseSelector = document.querySelector('.warehouse-selector');
  if (warehouseSelector) warehouseSelector.style.display = 'flex';
  
  // Restaurar header de tabla
  const dataPanelHeader = document.querySelector('.data-panel-header h2');
  if (dataPanelHeader) {
    dataPanelHeader.innerHTML = '<i class="fas fa-table"></i> Curva de Producción';
  }
  
  // Restaurar headers de la tabla
  const tableHeader = document.getElementById('tableHeader');
  if (tableHeader) {
    tableHeader.innerHTML = `
      <tr>
        <th>Color</th>
        <th>Talla</th>
        <th>Stock</th>
        <th>Validado</th>
        <th>Diferencia</th>
      </tr>
    `;
  }
  
  // Re-renderizar tabla de curva
  UIManager.renderCurvaTable();
}

// Revertir item de bodega
function revertWarehouseItem(warehouseCode, itemIndex) {
  const items = AppState.warehouseItems[warehouseCode];
  if (!items || !items[itemIndex]) return;
  
  const item = items[itemIndex];
  
  if (confirm(`¿Revertir ${item.count} unidades de ${item.color} - ${item.talla}?`)) {
    // RESTAURAR STOCK: Buscar el detalle en opDetails y sumar las unidades
    const detail = AppState.opDetails.find(d => 
      d[0] === item.id_color && d[3] === item.talla
    );
    
    if (detail) {
      detail[4] = detail[4] + item.count; // Restaurar al stock
    }
    
    // Remover del array de bodega
    items.splice(itemIndex, 1);
    
    // Actualizar estadísticas (se calcula automáticamente)
    updateWarehouseStats();
    
    // Re-renderizar tabla principal si estamos en vista de OP
    if (!AppState.scanWithoutOP) {
      UIManager.renderCurvaTable();
    }
    
    // Guardar estado
    saveStateToLocalStorage();
    
    // Actualizar vista de bodega
    showWarehouseDetails(warehouseCode);
    
    LogManager.found(
      `Item revertido de ${WAREHOUSES.find(w => w.code === warehouseCode).name}`,
      null,
      { bodega: warehouseCode, color: item.color, talla: item.talla, cantidad: item.count }
    );
    
    AudioManager.playBeep(800, 100);
  }
}

// Aplicar movimiento de bodega con cantidad ajustable
function applyWarehouseMove(fromWarehouseCode, itemIndex) {
  const fromItems = AppState.warehouseItems[fromWarehouseCode];
  if (!fromItems || !fromItems[itemIndex]) return;
  
  const item = fromItems[itemIndex];
  const qtyInput = document.getElementById(`qty-${fromWarehouseCode}-${itemIndex}`);
  const destSelect = document.getElementById(`dest-${fromWarehouseCode}-${itemIndex}`);
  
  if (!qtyInput || !destSelect) return;
  
  const qtyToMove = parseInt(qtyInput.value) || 0;
  const toWarehouseCode = destSelect.value;
  
  if (qtyToMove <= 0 || qtyToMove > item.count) {
    alert(`Cantidad inválida. Debe ser entre 1 y ${item.count}`);
    return;
  }
  
  if (!toWarehouseCode) {
    alert('Selecciona una bodega de destino');
    return;
  }
  
  const fromWarehouse = WAREHOUSES.find(w => w.code === fromWarehouseCode);
  let toWarehouseName;
  if (toWarehouseCode === 'PRINCIPAL') {
    toWarehouseName = 'Tabla Principal (Stock)';
  } else {
    const toWarehouse = WAREHOUSES.find(w => w.code === toWarehouseCode);
    toWarehouseName = toWarehouse ? toWarehouse.name : toWarehouseCode;
  }
  
  if (confirm(`¿Mover ${qtyToMove} unidades de ${item.color} - ${item.talla}\nde ${fromWarehouse.name} a ${toWarehouseName}?`)) {
    const remaining = item.count - qtyToMove;
    
    if (remaining === 0) {
      // Si se mueven todas, eliminar el item
      fromItems.splice(itemIndex, 1);
    } else {
      // Si quedan unidades, actualizar la cantidad
      item.count = remaining;
    }
    
    if (toWarehouseCode === 'PRINCIPAL') {
      // Mover a la tabla principal: restaurar el stock
      const detail = AppState.opDetails.find(d => 
        d[0] === item.id_color && d[3] === item.talla
      );
      
      if (detail) {
        detail[4] = detail[4] + qtyToMove; // Restaurar al stock
      }
    } else {
      // Mover a otra bodega
      // Buscar si ya existe un item con el mismo barcode en la bodega destino
      const existingItem = AppState.warehouseItems[toWarehouseCode].find(i => i.barcode === item.barcode);
      
      if (existingItem) {
        // Si existe, sumar las cantidades
        existingItem.count += qtyToMove;
      } else {
        // Si no existe, crear nuevo item
        AppState.warehouseItems[toWarehouseCode].push({
          key: item.key,
          barcode: item.barcode,
          color: item.color,
          referencia: item.referencia,
          talla: item.talla,
          count: qtyToMove,
          id_color: item.id_color,
          stockOriginal: item.stockOriginal,
          timestamp: Date.now()
        });
      }
    }
    
    // Actualizar estadísticas (se calcula automáticamente)
    updateWarehouseStats();
    
    // Re-renderizar tabla principal si movimos a PRINCIPAL
    if (toWarehouseCode === 'PRINCIPAL' && !AppState.scanWithoutOP) {
      UIManager.renderCurvaTable();
    }
    
    // Guardar estado
    saveStateToLocalStorage();
    
    // Actualizar vista de bodega
    showWarehouseDetails(fromWarehouseCode);
    
    LogManager.found(
      `${qtyToMove} unidades movidas de ${fromWarehouse.name} a ${toWarehouseName}`,
      null,
      { 
        de: fromWarehouseCode, 
        a: toWarehouseCode, 
        color: item.color, 
        talla: item.talla, 
        cantidad: qtyToMove 
      }
    );
    
    AudioManager.playBeep(1000, 100);
  }
}

// Cambiar item de una bodega a otra (función legacy, ahora usa applyWarehouseMove)
function changeItemWarehouse(fromWarehouseCode, itemIndex, toWarehouseCode) {
  if (!toWarehouseCode) return;
  
  const fromItems = AppState.warehouseItems[fromWarehouseCode];
  if (!fromItems || !fromItems[itemIndex]) return;
  
  const item = fromItems[itemIndex];
  const fromWarehouse = WAREHOUSES.find(w => w.code === fromWarehouseCode);
  
  let toWarehouseName;
  if (toWarehouseCode === 'PRINCIPAL') {
    toWarehouseName = 'Tabla Principal (Stock)';
  } else {
    const toWarehouse = WAREHOUSES.find(w => w.code === toWarehouseCode);
    toWarehouseName = toWarehouse ? toWarehouse.name : toWarehouseCode;
  }
  
  if (confirm(`¿Mover ${item.count} unidades de ${item.color} - ${item.talla}\nde ${fromWarehouse.name} a ${toWarehouseName}?`)) {
    // Remover del array de bodega origen
    fromItems.splice(itemIndex, 1);
    
    if (toWarehouseCode === 'PRINCIPAL') {
      // Mover a la tabla principal: restaurar el stock
      const detail = AppState.opDetails.find(d => 
        d[0] === item.id_color && d[3] === item.talla
      );
      
      if (detail) {
        detail[4] = detail[4] + item.count; // Restaurar al stock
      }
    } else {
      // Mover a otra bodega
      AppState.warehouseItems[toWarehouseCode].push({
        ...item,
        timestamp: Date.now()
      });
    }
    
    // Actualizar estadísticas (se calcula automáticamente)
    updateWarehouseStats();
    
    // Re-renderizar tabla principal si movimos a PRINCIPAL
    if (toWarehouseCode === 'PRINCIPAL' && !AppState.scanWithoutOP) {
      UIManager.renderCurvaTable();
    }
    
    // Guardar estado
    saveStateToLocalStorage();
    
    // Actualizar vista de bodega
    showWarehouseDetails(fromWarehouseCode);
    
    LogManager.found(
      `Item movido de ${fromWarehouse.name} a ${toWarehouseName}`,
      null,
      { 
        de: fromWarehouseCode, 
        a: toWarehouseCode, 
        color: item.color, 
        talla: item.talla, 
        cantidad: item.count 
      }
    );
    
    AudioManager.playBeep(1000, 100);
  } else {
    // Resetear selector si cancela
    showWarehouseDetails(fromWarehouseCode);
  }
}
