// Validación de datos contra base de datos

const DataValidator = {
  existingBarcodes: new Set(),

  async loadExistingBarcodes(barcodesToCheck) {
    try {
      const startTime = Date.now();
      console.log(`Verificando ${barcodesToCheck.length.toLocaleString()} barcodes contra la base de datos...`);
      
      // Iniciar paso 2
      UIController.startStep2();
      
      // Extraer solo los barcodes únicos del Excel
      const uniqueBarcodes = [...new Set(barcodesToCheck.map(b => String(b).trim()))];
      console.log(`Barcodes únicos a verificar: ${uniqueBarcodes.length.toLocaleString()}`);
      
      console.log('🌐 Enviando petición a:', `${AdminConfig.FUNCTIONS_URL}/verify-barcodes`);
      
      // Llamar a la Edge Function para verificar
      const response = await fetch(`${AdminConfig.FUNCTIONS_URL}/barras`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify', barcodes: uniqueBarcodes })
      });

      console.log('📡 Respuesta recibida:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        let errorMessage;
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || `HTTP ${response.status}`;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Resultado parseado:', { checked: result.checked, duplicates: result.existingBarcodes?.length });
      
      this.existingBarcodes = new Set(result.existingBarcodes.map(b => String(b).trim()));
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Verificación completada en ${elapsed}s - Duplicados: ${this.existingBarcodes.size.toLocaleString()}`);
      
      // Completar paso 2
      UIController.completeStep2(result.checked, this.existingBarcodes.size);
      
      // Pequeña pausa para animación
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return this.existingBarcodes.size;
      
    } catch (error) {
      console.error('❌ Error verificando barcodes:', error);
      throw new Error('No se pudo verificar los barcodes en la base de datos: ' + error.message);
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
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  validate(records) {
    const totalRecords = records.length;
    console.log(`Validando ${totalRecords.toLocaleString()} registros del Excel...`);
    
    // Iniciar paso 3
    UIController.startStep3();
    
    const validated = records.map((record, index) => {
      // Actualizar progreso cada 5000 registros
      if (index > 0 && index % 5000 === 0) {
        const percentage = Math.round((index / totalRecords) * 100);
        UIController.updateStep3Progress(index, totalRecords, percentage);
      }

      const errors = [];
      const barcode = String(record.barcode || '').trim();

      // Validar referencia
      if (!record.referencia || String(record.referencia).trim() === '') {
        errors.push('Referencia vacía');
      }

      // Validar talla
      if (!record.talla || String(record.talla).trim() === '') {
        errors.push('Talla vacía');
      }

      // Validar id_color
      if (record.id_color === null || record.id_color === undefined || String(record.id_color).trim() === '') {
        errors.push('ID Color vacío');
      }

      // Validar barcode
      if (!barcode) {
        errors.push('Barcode vacío');
      } else if (this.existingBarcodes.has(barcode)) {
        errors.push('Barcode ya existe en BD');
      }

      return {
        ...record,
        isValid: errors.length === 0,
        errors: errors
      };
    });

    console.log(`✅ Validación completada`);
    return validated;
  },

  getStats(validatedData) {
    const total = validatedData.length;
    const valid = validatedData.filter(r => r.isValid).length;
    const errors = total - valid;
    const duplicates = validatedData.filter(r => 
      r.errors.includes('Barcode ya existe en BD')
    ).length;

    return { total, valid, errors, duplicates };
  },

  getValidRecords(validatedData) {
    return validatedData.filter(r => r.isValid);
  }
};
