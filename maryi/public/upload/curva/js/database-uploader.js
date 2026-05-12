// Subida a base de datos CURVA

const DatabaseUploaderCurva = {
  async uploadRecords(records) {
    try {
      // Iniciar paso 5
      UIController.startStep5();
      
      // Preparar registros para inserción
      const recordsToInsert = records.map(function(r) {
        return {
          op: r.op,
          referencia: r.referencia,
          descripcion: r.descripcion,
          cantidad: r.cantidad_total,
          detalles: r.detalles
        };
      });

      // Llamar a la Edge Function para subir
      const response = await fetch(`${CurvaConfig.FUNCTIONS_URL}/curva`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'upload', records: recordsToInsert })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir registros');
      }

      const results = await response.json();
      
      // Actualizar progreso al 100%
      UIController.updateStep5Progress(100);

      return results;
      
    } catch (error) {
      console.error('Error subiendo registros:', error);
      
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: [error.message]
      };
    }
  },

  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  },

  delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
};

// Función global para subir
async function uploadToDatabase() {
  if (!FileHandlerCurva.parsedData) {
    console.error('❌ No hay datos para subir');
    return;
  }

  try {
    // PASO 1: Extraer OPs únicas para verificar
    const opsToCheck = FileHandlerCurva.parsedData.map(function(r) {
      const op = r.op;
      const opNum = Number(op);
      return isNaN(opNum) ? op : opNum;
    });
    
    // PASO 2: Verificar OPs existentes
    const loadResult = await DataValidatorCurva.loadExistingRecords(opsToCheck);
    
    // PASO 3: Filtrar solo las OPs NUEVAS
    const newRecords = FileHandlerCurva.parsedData.filter(function(record) {
      const opValue = record.op;
      const opNum = Number(opValue);
      const key = isNaN(opNum) ? String(opValue).trim() : opNum;
      return !DataValidatorCurva.existingOPs.has(key);
    });
    
    // PASO 3: Buscar barcodes solo para OPs nuevas
    if (newRecords.length > 0) {
      const itemsToCheck = [];
      const itemsSet = new Set();
      
      for (const record of newRecords) {
        if (!record.items || !Array.isArray(record.items)) continue;
        
        for (const item of record.items) {
          const key = `${item[2]}-${item[3]}-${item[0]}`;
          if (!itemsSet.has(key)) {
            itemsSet.add(key);
            itemsToCheck.push({
              referencia: item[2],
              talla: item[3],
              id_color: item[0]
            });
          }
        }
      }
      
      UIController.startStep3();
      const barcodeResult = await DataValidatorCurva.loadBarcodes(itemsToCheck);
      UIController.completeStep3(barcodeResult.barcodesFound, itemsToCheck.length);
    } else {
      UIController.skipStep3();
    }

    // Pequeña pausa
    await new Promise(function(resolve) { setTimeout(resolve, 300); });

    // PASO 4: Validar datos
    const validatedData = DataValidatorCurva.validate(FileHandlerCurva.parsedData);
    const stats = DataValidatorCurva.getStats(validatedData);

    // Completar paso 4
    UIController.completeStep4(stats);

    // Pequeña pausa
    await new Promise(function(resolve) { setTimeout(resolve, 300); });

    if (stats.valid === 0) {
      UIController.skipStep5();
      
      const results = {
        total: stats.total,
        success: 0,
        failed: 0,
        duplicates: stats.duplicates,
        errors: []
      };
      
      document.getElementById('statSuccess').textContent = '0';
      document.getElementById('statErrors').textContent = stats.errors.toLocaleString();
      
      await new Promise(function(resolve) { setTimeout(resolve, 300); });
      
      UIController.completeProcess(results);
      return;
    }

    // PASO 5: Subir registros válidos
    const validRecords = DataValidatorCurva.getValidRecords(validatedData);
    const results = await DatabaseUploaderCurva.uploadRecords(validRecords);
    
    results.duplicates = stats.duplicates;
    
    UIController.completeStep5(results.success);
    
    // Pequeña pausa
    await new Promise(function(resolve) { setTimeout(resolve, 300); });
    
    // PASO 6: Completar proceso
    UIController.completeProcess(results);

  } catch (error) {
    console.error('Error en la carga:', error);
    
    const statusDiv = document.getElementById('trackingStatus');
    statusDiv.className = 'tracking-status error';
    statusDiv.querySelector('.status-text').textContent = 'Error';
    
    const activeStep = document.querySelector('.timeline-item.active');
    if (activeStep) {
      const stepDetails = activeStep.querySelector('.timeline-details');
      if (stepDetails) {
        stepDetails.innerHTML = `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> ${error.message}</div>`;
      }
    }
    
    document.getElementById('actionFooter').style.display = 'block';
  }
}
