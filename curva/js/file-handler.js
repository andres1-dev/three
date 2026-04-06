// Manejo de archivos Excel para curvas

const FileHandlerCurva = {
  currentFile: null,
  parsedData: null,
  tallasHeaders: [],

  handleFile(file) {
    if (!this.validateFile(file)) {
      return false;
    }

    this.currentFile = file;
    
    // Mostrar tracking section
    UIController.showTracking(file.name);
    
    // Iniciar paso 1
    UIController.startStep1();
    
    // Pequeña pausa para animación
    setTimeout(() => {
      this.readFile(file);
    }, 300);
    
    return true;
  },

  validateFile(file) {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!validTypes.includes(file.type) && 
        !file.name.endsWith('.xls') && 
        !file.name.endsWith('.xlsx')) {
      console.error('Archivo no válido:', file.name, file.type);
      return false;
    }

    return true;
  },

  readFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          defval: null,
          raw: false
        });

        // Extraer headers de tallas de la fila 2
        this.extractTallasHeaders(jsonData);
        
        // Extraer datos
        this.parsedData = this.extractData(jsonData);
        
        // Completar paso 1
        UIController.completeStep1(this.parsedData.length);
        
        // Pequeña pausa para animación
        setTimeout(() => {
          uploadToDatabase();
        }, 500);
        
      } catch (error) {
        console.error('❌ Error al leer el archivo:', error);
        console.error('Stack:', error.stack);
        
        const statusDiv = document.getElementById('trackingStatus');
        statusDiv.className = 'tracking-status error';
        statusDiv.querySelector('.status-text').textContent = 'Error';
        
        UIController.updateStepDetails(1, 
          `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> Error al procesar el archivo: ${error.message}</div>`
        );
        
        document.getElementById('actionFooter').style.display = 'block';
      }
    };

    reader.onerror = () => {
      console.error('Error al leer el archivo');
      
      const statusDiv = document.getElementById('trackingStatus');
      statusDiv.className = 'tracking-status error';
      statusDiv.querySelector('.status-text').textContent = 'Error';
      
      UIController.updateStepDetails(1, 
        `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> Error al leer el archivo</div>`
      );
      
      document.getElementById('actionFooter').style.display = 'block';
    };

    reader.readAsArrayBuffer(file);
  },

  extractTallasHeaders(data) {
    // Los headers están en la fila 2 (índice 1)
    const headerRow = data[CurvaConfig.HEADER_ROW];
    this.tallasHeaders = [];
    
    // Extraer nombres de tallas desde columna O (índice 14) en adelante
    for (let i = CurvaConfig.COLUMNS.TALLAS_START; i < headerRow.length; i++) {
      const tallaName = headerRow[i];
      if (tallaName && String(tallaName).trim() !== '') {
        this.tallasHeaders.push({
          index: i,
          name: String(tallaName).trim()
        });
      }
    }
  },

  extractData(data) {
    const result = [];
    
    // Primero extraemos todos los registros expandidos por talla
    const allRecords = [];
    
    for (let i = CurvaConfig.DATA_START_ROW; i < data.length; i++) {
      const row = data[i];
      
      // Verificar si la fila tiene datos
      if (!row || row.length === 0) continue;
      
      const op = row[CurvaConfig.COLUMNS.OP];
      if (!op || String(op).trim() === '') continue;
      
      const referencia = row[CurvaConfig.COLUMNS.REFERENCIA];
      const descripcion = row[CurvaConfig.COLUMNS.DESCRIPCION];
      const id_color = row[CurvaConfig.COLUMNS.ID_COLOR];
      const color = row[CurvaConfig.COLUMNS.COLOR];
      
      // Extraer cada talla como un registro separado
      for (const tallaInfo of this.tallasHeaders) {
        const value = row[tallaInfo.index];
        if (value) {
          const cantidad = this.parseNumber(value);
          if (cantidad > 0) {
            allRecords.push({
              op: String(op).trim(),
              referencia: referencia,
              descripcion: descripcion,
              id_color: id_color,
              color: color,
              talla: tallaInfo.name,
              cantidad: cantidad
            });
          }
        }
      }
    }
    
    // Agrupar por OP
    const groupedByOP = {};
    
    for (const record of allRecords) {
      const op = record.op;
      
      if (!groupedByOP[op]) {
        groupedByOP[op] = {
          op: op,
          referencia: record.referencia,
          descripcion: record.descripcion,
          cantidad_total: 0,
          items: []
        };
      }
      
      // Agregar item [id_color, color, referencia, talla, cantidad, barcode]
      groupedByOP[op].items.push([
        record.id_color,
        record.color,
        record.referencia,
        record.talla,
        record.cantidad,
        null  // barcode se llenará después
      ]);
      
      groupedByOP[op].cantidad_total += record.cantidad;
    }
    
    // Convertir a array
    const finalRecords = Object.values(groupedByOP);
    
    return finalRecords;
  },

  parseNumber(value) {
    if (!value) return 0;
    
    // Convertir "273,00" a 273
    const str = String(value).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  },

  clear() {
    this.currentFile = null;
    this.parsedData = null;
    this.tallasHeaders = [];
  }
};

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    FileHandlerCurva.handleFile(file);
  }
}

function clearFile() {
  document.getElementById('fileInput').value = '';
  FileHandlerCurva.clear();
}
