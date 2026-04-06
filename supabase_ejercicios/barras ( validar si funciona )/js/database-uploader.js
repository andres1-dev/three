// Subida a base de datos vía CSV

const DatabaseUploader = {
  async uploadCSV(csvContent) {
    try {
      // Iniciar paso 4
      UIController.startStep4();
      
      // Parsear CSV
      const lines = csvContent.split('\n');
      const headers = lines[0].split(',');
      
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = this.parseCSVLine(lines[i]);
        records.push({
          referencia: values[0],
          talla: values[1],
          id_color: values[2],
          barcode: values[3]
        });
      }

      // Llamar a la Edge Function para subir
      const response = await fetch(`${AdminConfig.FUNCTIONS_URL}/upload-barcodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir registros');
      }

      const results = await response.json();
      
      // Actualizar progreso al 100%
      UIController.updateStep4Progress(100);

      return results;
      
    } catch (error) {
      console.error('Error subiendo CSV:', error);
      
      // Retornar error en lugar de lanzar excepción
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: [error.message]
      };
    }
  },

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  },

  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Función global para subir (ahora automática)
async function uploadToDatabase() {
  if (!FileHandler.parsedData) {
    console.error('No hay datos para subir');
    return;
  }

  try {
    // Extraer solo los barcodes del Excel para verificar
    const barcodesToCheck = FileHandler.parsedData.map(r => r.barcode);
    const existingCount = await DataValidator.loadExistingBarcodes(barcodesToCheck);
    console.log(`Encontrados ${existingCount} barcodes duplicados`);

    const validatedData = DataValidator.validate(FileHandler.parsedData);
    const stats = DataValidator.getStats(validatedData);

    // Completar paso 3
    UIController.completeStep3(stats);

    if (stats.valid === 0) {
      // No hay registros nuevos, completar proceso sin subir
      UIController.setStepActive(4);
      UIController.setStepComplete(4);
      UIController.updateStepDetails(4, '<i class="fas fa-info-circle"></i> No hay registros nuevos para subir');
      
      const results = {
        total: stats.total,
        success: 0,
        failed: 0,
        duplicates: stats.duplicates,
        errors: []
      };
      
      // Actualizar estadísticas
      document.getElementById('statSuccess').textContent = '0';
      document.getElementById('statErrors').textContent = stats.errors.toLocaleString();
      
      // Pequeña pausa para animación
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Completar proceso
      UIController.completeProcess(results);
      return;
    }

    // Pequeña pausa para animación
    await new Promise(resolve => setTimeout(resolve, 500));

    const validRecords = DataValidator.getValidRecords(validatedData);
    const csvContent = CSVGenerator.generate(validRecords);

    const results = await DatabaseUploader.uploadCSV(csvContent);
    
    // Agregar duplicados al resultado
    results.duplicates = stats.duplicates;
    
    // Completar paso 4
    UIController.completeStep4(results.success);
    
    // Pequeña pausa para animación
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Completar proceso (paso 5)
    UIController.completeProcess(results);

  } catch (error) {
    console.error('Error en la carga:', error);
    
    // Mostrar error en el timeline
    const statusDiv = document.getElementById('trackingStatus');
    statusDiv.className = 'tracking-status error';
    statusDiv.querySelector('.status-text').textContent = 'Error';
    
    // Marcar paso actual como error
    const activeStep = document.querySelector('.timeline-item.active');
    if (activeStep) {
      const stepDetails = activeStep.querySelector('.timeline-details');
      if (stepDetails) {
        stepDetails.innerHTML = `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> ${error.message}</div>`;
      }
    }
    
    // Mostrar botón de acción
    document.getElementById('actionFooter').style.display = 'block';
  }
}
