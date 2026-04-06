// Configuración
const CONFIG = {
  FUNCTIONS_URL: "https://djgnfyglyvlfhnhvpzxy.supabase.co/functions/v1",
  SCAN_TIMEOUT: 100,
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
  totalScanTime: 0, // Tiempo total acumulado en milisegundos
  lastScanTime: null, // Timestamp del último escaneo
  scanWithoutOP: false, // Modo escaneo sin OP
  scannedWithoutOP: new Map(), // Barras escaneadas en modo sin OP
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
  sidebarOpInfo: null,
  sidebarOp: null,
  sidebarRef: null,
  sidebarQty: null,
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
  DOM.sidebarOpInfo = document.getElementById("sidebarOpInfo");
  DOM.sidebarOp = document.getElementById("sidebarOp");
  DOM.sidebarRef = document.getElementById("sidebarRef");
  DOM.sidebarQty = document.getElementById("sidebarQty");
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
          processScan(scanBuffer);
        }
        scanBuffer = "";
      }, CONFIG.SCAN_TIMEOUT);
    }
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

    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/read-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ op: opCode })
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.notFound) {
        DOM.opLoadingMessage.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            OP "${opCode}" no encontrada
          </div>
        `;
      } else {
        throw new Error(error.error || 'Error al cargar OP');
      }
      return;
    }

    const result = await response.json();
    const data = result.data;

    AppState.selectedOP = opCode;
    AppState.opData = data;
    AppState.opDetails = data.detalles || [];

    // Ocultar selector y mostrar workspace
    DOM.opSelector.classList.add('hidden');
    DOM.workspace.classList.remove('hidden');
    DOM.sidebarOpInfo.classList.remove('hidden');

    // Actualizar info de OP en sidebar
    DOM.sidebarOp.textContent = data.op;
    DOM.sidebarRef.textContent = data.referencia;
    DOM.sidebarQty.textContent = data.cantidad;

    // Renderizar tabla de curva
    UIManager.renderCurvaTable();

    // Log de éxito
    LogManager.found(
      `OP ${opCode} cargada: ${data.referencia}`,
      null,
      { op: opCode, referencia: data.referencia, cantidad: data.cantidad, items: data.detalles.length }
    );

    // Iniciar sesión automáticamente en modo láser
    if (AppState.countMode === 'laser') {
      startSession();
    }
    
  } catch (err) {
    console.error('Error cargando OP:', err);
    
    let errorMsg = err.message;
    if (err.message === 'Failed to fetch') {
      errorMsg = 'No se puede conectar al servidor. Verifica que la Edge Function "get-op" esté desplegada en Supabase.';
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
  AppState.warehouseStats = { DI: 0, ZY: 0, BP: 0, ZZ: 0 };

  // Mostrar selector
  DOM.opSelector.classList.remove('hidden');
  DOM.workspace.classList.add('hidden');
  DOM.sidebarOpInfo.classList.add('hidden');
  
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
        <th>Esperado</th>
        <th>Contado</th>
        <th>Faltante</th>
        <th>Progreso</th>
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
  
  if (mode === 'laser') {
    // Cambio a modo láser
    DOM.input.style.display = 'block';
    updateScanStatus('idle', 'Modo Láser activado');
    
    // Si venía de manual, reiniciar sesión automáticamente
    if (previousMode === 'manual') {
      startSession();
    }
  } else {
    // Cambio a modo manual
    DOM.input.style.display = 'none';
    updateScanStatus('idle', 'Modo Manual activado');
    
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
}

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', init);

// Modo escaneo sin OP
function startScanWithoutOP() {
  // Configurar modo sin OP
  AppState.selectedOP = null;
  AppState.opDetails = [];
  AppState.opData = null;
  AppState.scanWithoutOP = true;
  AppState.consolidated.clear();
  AppState.scannedWithoutOP = new Map(); // Mapa para barras escaneadas sin OP
  
  // Ocultar selector y mostrar workspace
  DOM.opSelector.classList.add('hidden');
  DOM.workspace.classList.remove('hidden');
  
  // Ocultar info de OP en sidebar
  DOM.sidebarOpInfo.classList.add('hidden');
  
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
    dataPanelHeader.innerHTML = '<i class="fas fa-barcode"></i> Escaneo sin OP - Validación de Barras';
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
  
  // Renderizar tabla vacía
  renderTableWithoutOP();
  
  // Iniciar sesión automáticamente
  startSession();
  
  LogManager.found('Modo escaneo sin OP activado', null, { modo: 'sin_op' });
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

// Procesar escaneo sin OP
async function processScanWithoutOP(code) {
  DOM.input.value = "";
  updateScanStatus('active', 'Validando...');
  
  try {
    // Detectar barras pegadas
    const expectedLength = 13;
    if (code.length > expectedLength * 1.5) {
      const errorMsg = `Barras pegadas o duplicadas detectadas`;
      LogManager.notfound(errorMsg, code, { 
        longitud: code.length,
        esperada: expectedLength,
        razon: 'Barras pegadas'
      });
      AudioManager.playBeep(400, 200);
      updateScanStatus('idle', 'Listo');
      return;
    }
    
    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/validate-barcode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barcode: code })
    });

    if (!response.ok) {
      throw new Error('Error al validar código');
    }

    const result = await response.json();
    
    if (result.found) {
      const barcodeData = result;
      
      // Agregar o actualizar en el mapa
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
    } else {
      LogManager.error(`Código no existe en la base de datos`, { 
        barcode: code,
        razon: 'Código inválido o no registrado'
      });
      AudioManager.playBeep(400, 300);
    }
    
    updateScanStatus('idle', 'Listo');
    
  } catch (err) {
    console.error('Error validando código:', err);
    LogManager.error('Error al validar código', { error: err.message, barcode: code });
    AudioManager.playBeep(400, 200);
    updateScanStatus('idle', 'Listo');
  }
}


// Enviar items completos a bodega
function sendToWarehouse(warehouseCode) {
  if (!warehouseCode) return;
  
  const warehouse = WAREHOUSES.find(w => w.code === warehouseCode);
  if (!warehouse) return;
  
  // Obtener todas las filas completas (100%)
  const completeItems = [];
  
  AppState.opDetails.forEach(detail => {
    const [id_color, color, , talla, cantidad] = detail;
    const key = `${id_color}-${talla}`;
    
    // Si ya fue enviado, saltar
    if (AppState.sentItems.has(key)) return;
    
    const scanned = AppState.consolidated.get(key);
    if (scanned && scanned.count >= cantidad) {
      completeItems.push({ key, color, talla, count: scanned.count });
    }
  });
  
  if (completeItems.length === 0) {
    alert('No hay items completos (100%) para enviar');
    document.getElementById('globalWarehouseSelect').value = '';
    return;
  }
  
  const itemsText = completeItems.map(i => `${i.color} - ${i.talla} (${i.count})`).join('\n');
  
  if (confirm(`¿Enviar ${completeItems.length} items completos a ${warehouse.name}?\n\n${itemsText}`)) {
    // Actualizar estadísticas de bodega
    AppState.warehouseStats[warehouseCode] += completeItems.length;
    updateWarehouseStats();
    
    // Log de envío
    LogManager.found(
      `${completeItems.length} items enviados a ${warehouse.name}`,
      null,
      { bodega: warehouseCode, items: completeItems.length }
    );
    
    // Marcar como enviados y ocultar
    completeItems.forEach(item => {
      AppState.sentItems.add(item.key);
      
      const row = document.querySelector(`tr[data-key="${item.key}"]`);
      if (row) {
        row.style.transition = 'opacity 0.3s, transform 0.3s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        
        setTimeout(() => {
          row.style.display = 'none';
          // Re-renderizar si todas desaparecieron
          const visibleRows = document.querySelectorAll('#curvaTableBody tr:not([style*="display: none"])');
          if (visibleRows.length === 0) {
            UIManager.renderCurvaTable();
          }
        }, 300);
      }
    });
    
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
  document.getElementById('warehouseDI').textContent = AppState.warehouseStats.DI;
  document.getElementById('warehouseZY').textContent = AppState.warehouseStats.ZY;
  document.getElementById('warehouseBP').textContent = AppState.warehouseStats.BP;
  document.getElementById('warehouseZZ').textContent = AppState.warehouseStats.ZZ;
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
