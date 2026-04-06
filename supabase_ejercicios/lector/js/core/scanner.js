// Procesamiento de escaneos

async function processScan(code) {
  if (!AppState.sessionActive) return;
  
  DOM.input.value = "";
  
  // Si está en modo sin OP, usar función especial
  if (AppState.scanWithoutOP) {
    await processScanWithoutOP(code);
    return;
  }
  
  updateScanStatus('active', 'Procesando...');
  
  try {
    // Detectar si hay barras pegadas/duplicadas (longitud anormal)
    const expectedLength = 13; // Longitud esperada de una barra
    if (code.length > expectedLength * 1.5) {
      const errorMsg = `Barras pegadas o duplicadas detectadas`;
      UIManager.showError(errorMsg);
      LogManager.notfound(errorMsg, code, { 
        longitud: code.length,
        esperada: expectedLength,
        razon: 'Barras pegadas'
      });
      AudioManager.playBeep(400, 200);
      updateScanStatus('idle', 'Listo');
      return;
    }

    // Buscar en los detalles de la OP
    // Estructura: [id_color, color, referencia, talla, cantidad, barcode]
    const detail = AppState.opDetails.find(d => d[5] === code);

    if (!detail) {
      // Verificar si la barra existe en la base de datos (cualquier OP)
      await validateBarcodeInDatabase(code);
      return;
    }

    const item = {
      barcode: code,
      id_color: detail[0],
      color: detail[1],
      referencia: detail[2],
      talla: detail[3],
      cantidad_esperada: detail[4],
      timestamp: new Date()
    };

    // Verificar si ya se alcanzó el límite
    const key = `${item.id_color}-${item.talla}`;
    const current = AppState.consolidated.get(key);
    
    if (current && current.count >= item.cantidad_esperada) {
      const warningMsg = `Límite alcanzado: ${item.color} - ${item.talla}`;
      UIManager.showError(warningMsg);
      LogManager.notfound(warningMsg, code, { 
        color: item.color, 
        talla: item.talla, 
        limite: item.cantidad_esperada,
        razon: 'Límite alcanzado'
      });
      AudioManager.playBeep(400, 300);
      updateScanStatus('idle', 'Listo');
      return;
    }

    // INICIAR TIMER: Si es el primer escaneo o viene de pausa
    if (!AppState.lastScanTime) {
      AppState.lastScanTime = Date.now();
      
      // Iniciar actualización del timer cada segundo
      if (!AppState.timerInterval) {
        AppState.timerInterval = setInterval(updateTimer, 100);
      }
    }

    DataManager.addToConsolidated(item);
    UIManager.updateCurvaTable();
    AudioManager.playBeep(1000, 100);
    
    // Log de éxito
    const newCount = AppState.consolidated.get(key).count;
    LogManager.found(
      `${item.color} - ${item.talla} (${newCount}/${item.cantidad_esperada})`,
      code,
      { color: item.color, talla: item.talla, count: newCount, esperado: item.cantidad_esperada }
    );
    
    updateScanStatus('idle', 'Listo');
    
  } catch (err) {
    console.error(err);
    const errorMsg = "Error al procesar escaneo";
    UIManager.showError(errorMsg);
    LogManager.error(errorMsg, { error: err.message, barcode: code });
    AudioManager.playBeep(400, 200);
    updateScanStatus('idle', 'Listo');
  }
}

// Validar si una barra existe en la base de datos
async function validateBarcodeInDatabase(code) {
  try {
    updateScanStatus('active', 'Validando en base de datos...');
    
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
      // La barra existe pero no pertenece a esta OP
      const barcodeData = result;
      const errorMsg = `Código no pertenece a esta OP`;
      UIManager.showError(errorMsg);
      LogManager.notfound(errorMsg, code, { 
        op_actual: AppState.selectedOP,
        op_correcta: barcodeData.op || 'N/A',
        referencia: barcodeData.referencia,
        color: barcodeData.color,
        talla: barcodeData.talla,
        razon: 'OP incorrecta'
      });
      AudioManager.playBeep(400, 200);
    } else {
      // La barra no existe en ninguna OP
      const errorMsg = `Código no existe en la base de datos`;
      UIManager.showError(errorMsg);
      LogManager.error(errorMsg, { 
        barcode: code,
        razon: 'Código inválido o no registrado'
      });
      AudioManager.playBeep(400, 300);
    }
    
    updateScanStatus('idle', 'Listo');
    
  } catch (err) {
    console.error('Error validando código:', err);
    const errorMsg = `Código no encontrado en esta OP`;
    UIManager.showError(errorMsg);
    LogManager.notfound(errorMsg, code, { 
      op: AppState.selectedOP,
      razon: 'No encontrado'
    });
    AudioManager.playBeep(400, 200);
    updateScanStatus('idle', 'Listo');
  }
}
