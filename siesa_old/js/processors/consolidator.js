// Consolidador de registros por nro_documento

const Consolidator = {
  /**
   * Consolida registros que tienen el mismo nro_documento
   */
  consolidate(records) {
    console.log('📦 Iniciando consolidación...');
    
    const consolidatedMap = new Map();
    
    for (const record of records) {
      const nroDoc = record.nro_documento;
      
      if (!consolidatedMap.has(nroDoc)) {
        // Normalizaciones solicitadas
        let razonSocial = record.razon_social_cliente_factura || '';
        razonSocial = razonSocial.replace(/\./g, '');
        
        let opValue = '';
        let proveedorValue = '';
        const compStr = String(record.compania || '').trim();
        
        if (compStr === '5') {
          proveedorValue = 'TEXTILES Y CREACIONES EL UNIVERSO SAS';
          opValue = record.docto_referencia || '';
        } else if (compStr === '3') {
          proveedorValue = 'TEXTILES Y CREACIONES LOS ANGELES SAS';
          opValue = record.notas || '';
        }

        let tipoValue = '';
        const prefijo = (nroDoc.split('-')[0] || '').trim().toUpperCase();
        
        switch (prefijo) {
          case '008':
          case '034':
            tipoValue = 'DEVOLUCION';
            break;
          case '017':
          case '029':
            tipoValue = 'REMISION';
            break;
          case 'FEV':
          case 'FVE':
            tipoValue = 'OFICIAL';
            break;
          case 'NEC':
            tipoValue = 'NOTAS';
            break;
          default:
            tipoValue = '';
        }

        // Primera vez que vemos este documento
        consolidatedMap.set(nroDoc, {
          // Datos del CSV (se mantienen de la primera fila)
          estado: record.estado,
          fecha: record.fecha,
          razon_social_cliente_factura: razonSocial,
          docto_referencia: record.docto_referencia,
          notas: record.notas,
          compania: record.compania,
          
          // Nuevas columnas calculadas
          op: opValue,
          proveedor: proveedorValue,
          tipo: tipoValue,
          
          // Datos del XLSX
          nro_documento: nroDoc,
          referencia: record.referencia,
          valor_subtotal: record.valor_subtotal,
          cantidad: record.cantidad,
          
          // Array para consolidación
          referencias_detalle: [{
            referencia: record.referencia,
            cantidad: record.cantidad,
            valor_subtotal: record.valor_subtotal
          }]
        });
      } else {
        // Ya existe este documento, consolidar
        const existing = consolidatedMap.get(nroDoc);
        
        // Cambiar a REFVAR si hay múltiples referencias
        if (existing.referencia !== SiesaConfig.CONSTANTS.REFVAR) {
          existing.referencia = SiesaConfig.CONSTANTS.REFVAR;
        }
        
        // Sumar valores
        existing.valor_subtotal += record.valor_subtotal;
        existing.cantidad += record.cantidad;
        
        // Agregar al detalle
        existing.referencias_detalle.push({
          referencia: record.referencia,
          cantidad: record.cantidad,
          valor_subtotal: record.valor_subtotal
        });
      }
    }
    
    const consolidated = Array.from(consolidatedMap.values());
    
    // Limpiar referencias_detalle si solo hay una referencia
    for (const record of consolidated) {
      if (record.referencias_detalle.length === 1) {
        record.referencias_detalle = null;
      }
    }
    
    const refvarCount = consolidated.filter(r => r.referencia === SiesaConfig.CONSTANTS.REFVAR).length;
    console.log(`✅ Consolidados: ${consolidated.length} documentos únicos`);
    console.log(`📋 Documentos con múltiples referencias (REFVAR): ${refvarCount}`);
    
    return consolidated;
  }
};
