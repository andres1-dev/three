// Validación de datos contra base de datos

const DataValidatorCurva = {
  existingOPs: new Set(),
  barcodeMap: new Map(),

  async loadExistingRecords(opsToCheck) {
    try {
      // Iniciar paso 2
      UIController.startStep2();
      
      // Verificar OPs existentes
      const opsResponse = await fetch(`${CurvaConfig.FUNCTIONS_URL}/curva`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify-ops', ops: opsToCheck })
      });

      if (!opsResponse.ok) {
        const errorText = await opsResponse.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error || `HTTP ${opsResponse.status}: ${errorText}`);
        } catch (e) {
          throw new Error(`HTTP ${opsResponse.status}: ${errorText}`);
        }
      }

      const opsResult = await opsResponse.json();
      
      // Convertir a Set manteniendo el tipo original
      this.existingOPs = new Set(opsResult.existingOPs.map(function(op) {
        return typeof op === 'number' ? op : String(op).trim();
      }));
      
      // Completar paso 2
      UIController.completeStep2(opsResult.checked, this.existingOPs.size);
      
      await new Promise(function(resolve) { setTimeout(resolve, 300); });
      
      return {
        opsChecked: opsResult.checked,
        opsDuplicates: this.existingOPs.size
      };
      
    } catch (error) {
      console.error('❌ Error verificando OPs:', error);
      throw new Error('No se pudo verificar las OPs: ' + error.message);
    }
  },

  async loadBarcodes(itemsToCheck) {
    try {
      const barcodesResponse = await fetch(`${CurvaConfig.FUNCTIONS_URL}/curva`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get-barcodes', items: itemsToCheck })
      });

      if (!barcodesResponse.ok) {
        const errorText = await barcodesResponse.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error || `HTTP ${barcodesResponse.status}: ${errorText}`);
        } catch (e) {
          throw new Error(`HTTP ${barcodesResponse.status}: ${errorText}`);
        }
      }

      const barcodesResult = await barcodesResponse.json();
      
      // Convertir el objeto a Map
      this.barcodeMap = new Map(Object.entries(barcodesResult.barcodeMap));
      
      return {
        barcodesFound: this.barcodeMap.size
      };
      
    } catch (error) {
      console.error('❌ Error buscando barcodes:', error);
      throw new Error('No se pudieron cargar los barcodes: ' + error.message);
    }
  },

  getBarcodeForItem(referencia, talla, id_color) {
    const key = `${String(referencia).trim()}-${String(talla).trim()}-${String(id_color).trim()}`;
    return this.barcodeMap.get(key) || null;
  },

  validate(records) {
    const totalRecords = records.length;
    
    // Iniciar paso 4
    UIController.startStep4();
    
    const validated = records.map(function(record, index) {
      // Actualizar progreso cada 100 registros
      if (index > 0 && index % 100 === 0) {
        const percentage = Math.round((index / totalRecords) * 100);
        UIController.updateStep4Progress(index, totalRecords, percentage);
      }

      const errors = [];

      // Validar referencia
      if (!record.referencia || String(record.referencia).trim() === '') {
        errors.push('Referencia vacía');
      }

      // Validar descripcion
      if (!record.descripcion || String(record.descripcion).trim() === '') {
        errors.push('Descripción vacía');
      }

      // Validar op
      if (!record.op || String(record.op).trim() === '') {
        errors.push('OP vacía');
      }

      // Validar items
      if (!record.items || record.items.length === 0) {
        errors.push('Sin items de colores/tallas');
      }

      // Verificar si ya existe (por OP)
      const opValue = record.op;
      const opNum = Number(opValue);
      const key = isNaN(opNum) ? String(opValue).trim() : opNum;
      
      if (DataValidatorCurva.existingOPs.has(key)) {
        errors.push('OP ya existe en BD');
      }

      // Buscar barcodes para cada item y completar el array
      const itemsWithBarcodes = [];
      let missingBarcodes = 0;
      
      for (const item of record.items) {
        const barcode = DataValidatorCurva.getBarcodeForItem(item[2], item[3], item[0]);
        
        if (!barcode) {
          missingBarcodes++;
        }
        
        itemsWithBarcodes.push([
          item[0],  // id_color
          item[1],  // color
          item[2],  // referencia
          item[3],  // talla
          item[4],  // cantidad
          barcode || null  // barcode
        ]);
      }
      
      // Si hay items sin barcode, marcar como inválido
      if (missingBarcodes > 0) {
        errors.push(`${missingBarcodes} items sin barcode en BD`);
      }

      return {
        op: record.op,
        referencia: record.referencia,
        descripcion: record.descripcion,
        cantidad_total: record.cantidad_total,
        detalles: itemsWithBarcodes,
        isValid: errors.length === 0,
        errors: errors
      };
    });

    return validated;
  },

  getStats(validatedData) {
    const total = validatedData.length;
    const valid = validatedData.filter(function(r) { return r.isValid; }).length;
    const errors = total - valid;
    const duplicates = validatedData.filter(function(r) {
      return r.errors.includes('OP ya existe en BD');
    }).length;

    return { total, valid, errors, duplicates };
  },

  getValidRecords(validatedData) {
    return validatedData.filter(function(r) { return r.isValid; });
  }
};
