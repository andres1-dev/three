// Procesamiento de escaneos

async function processScan(code) {
  if (!AppState.sessionActive) {
    console.warn('⚠️ Sesión no activa, ignorando escaneo');
    return;
  }
  
  DOM.input.value = "";
  
  // Si está en modo sin OP, usar función especial (NO async)
  if (AppState.scanWithoutOP) {
    processScanWithoutOP(code);
    return;
  }
  
  updateScanStatus('active', 'Procesando...');
  
  console.log('📦 Buscando código en opDetails:', AppState.opDetails.length, 'items');
  
  try {
    const BARCODE_LENGTH = 13; // Longitud estándar de código de barras
    
    // Validar que sea un código de barras válido (solo números y longitud correcta)
    const isValidBarcodeFormat = /^\d+$/.test(code);
    
    if (!isValidBarcodeFormat) {
      // NO es un código de barras válido -> ERROR
      const errorMsg = `FORMATO INVÁLIDO: ${code}`;
      UIManager.showError(errorMsg);
      LogManager.error(errorMsg, { 
        entrada: code,
        razon: 'No es un código de barras válido (debe contener solo números)'
      });
      AudioManager.playBeep(400, 300);
      updateScanStatus('idle', 'Listo');
      return;
    }
    
    // Detectar si hay múltiples códigos pegados
    if (code.length > BARCODE_LENGTH && code.length % BARCODE_LENGTH === 0) {
      const numCodes = code.length / BARCODE_LENGTH;
      console.log(`🔗 Detectados ${numCodes} códigos pegados, separando...`);
      
      // Separar códigos
      const codes = [];
      for (let i = 0; i < numCodes; i++) {
        const start = i * BARCODE_LENGTH;
        const end = start + BARCODE_LENGTH;
        codes.push(code.substring(start, end));
      }
      
      console.log('📋 Códigos separados:', codes);
      
      // Procesar cada código individualmente
      for (const singleCode of codes) {
        await processSingleBarcode(singleCode);
      }
      
      updateScanStatus('idle', 'Listo');
      return;
    }
    
    // Si no es la longitud exacta, es un código con formato válido pero longitud incorrecta
    if (code.length !== BARCODE_LENGTH) {
      const errorMsg = `LONGITUD INCORRECTA: ${code} (${code.length} dígitos, esperado: ${BARCODE_LENGTH})`;
      UIManager.showError(errorMsg);
      LogManager.error(errorMsg, { 
        barcode: code,
        longitud: code.length,
        esperada: BARCODE_LENGTH,
        razon: 'Longitud incorrecta'
      });
      AudioManager.playBeep(400, 200);
      updateScanStatus('idle', 'Listo');
      return;
    }

    // Procesar código único
    await processSingleBarcode(code);
    updateScanStatus('idle', 'Listo');
    
  } catch (err) {
    console.error(err);
    const errorMsg = `ERROR: ${code} - ${err.message}`;
    UIManager.showError(errorMsg);
    LogManager.error(errorMsg, { error: err.message, barcode: code });
    AudioManager.playBeep(400, 200);
    updateScanStatus('idle', 'Listo');
  }
}

// Procesar un código de barras individual
async function processSingleBarcode(code) {
  console.log('🔎 Procesando código individual:', code);
  
  // Buscar en los detalles de la OP
  // Estructura: [id_color, color, referencia, talla, cantidad, barcode]
  const detail = AppState.opDetails.find(d => d[5] === code);

  console.log('🔎 Resultado búsqueda:', detail ? `Encontrado: ${detail[1]} - ${detail[3]}` : 'No encontrado');

  if (!detail) {
    // Código con formato válido pero NO encontrado en esta OP -> NO ENCONTRADA
    const errorMsg = `NO ENCONTRADO: ${code}`;
    UIManager.showError(errorMsg);
    LogManager.notfound(errorMsg, code, { 
      op: AppState.selectedOP,
      barcode: code,
      razon: 'Código válido pero no pertenece a esta OP'
    });
    AudioManager.playBeep(400, 200);
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
    const warningMsg = `Completo: ${item.color} - ${item.talla} (${item.cantidad_esperada}/${item.cantidad_esperada})`;
    UIManager.showError(warningMsg);
    LogManager.notfound(warningMsg, code, { 
      color: item.color, 
      talla: item.talla, 
      cantidad: item.cantidad_esperada,
      razon: 'Item completo'
    });
    AudioManager.playBeep(600, 200);
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
}
