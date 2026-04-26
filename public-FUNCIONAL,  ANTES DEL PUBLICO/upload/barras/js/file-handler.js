// Manejo de archivos Excel

const FileHandler = {
  currentFile: null,
  parsedData: null,

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
      // Mostrar error en consola en lugar de alert
      console.error('Archivo no válido:', file.name, file.type);
      return false;
    }

    return true;
  },

  readFile(file) {
    console.log('📖 Iniciando lectura del archivo:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        console.log('✅ Archivo cargado en memoria, parseando Excel...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log('📊 Hojas encontradas:', workbook.SheetNames);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          defval: null 
        });

        console.log('📋 Filas totales en Excel:', jsonData.length);
        this.parsedData = this.extractColumns(jsonData);
        
        console.log('✅ Datos extraídos:', this.parsedData.length, 'registros');
        
        // Completar paso 1
        UIController.completeStep1(this.parsedData.length);
        
        // Pequeña pausa para animación
        console.log('⏳ Iniciando proceso de carga en 500ms...');
        setTimeout(() => {
          console.log('🚀 Llamando a uploadToDatabase()...');
          uploadToDatabase();
        }, 500);
        
      } catch (error) {
        console.error('❌ Error al leer el archivo:', error);
        
        // Mostrar error en el timeline
        const statusDiv = document.getElementById('trackingStatus');
        statusDiv.className = 'tracking-status error';
        statusDiv.querySelector('.status-text').textContent = 'Error';
        
        UIController.updateStepDetails(1, 
          `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> Error al procesar el archivo: ${error.message}</div>`
        );
        
        // Mostrar botón de acción
        document.getElementById('actionFooter').style.display = 'block';
      }
    };

    reader.onerror = () => {
      console.error('❌ Error al leer el archivo');
      
      // Mostrar error en el timeline
      const statusDiv = document.getElementById('trackingStatus');
      statusDiv.className = 'tracking-status error';
      statusDiv.querySelector('.status-text').textContent = 'Error';
      
      UIController.updateStepDetails(1, 
        `<div style="color: #c62828;"><i class="fas fa-exclamation-circle"></i> Error al leer el archivo</div>`
      );
      
      // Mostrar botón de acción
      document.getElementById('actionFooter').style.display = 'block';
    };

    console.log('📂 Leyendo archivo como ArrayBuffer...');
    reader.readAsArrayBuffer(file);
  },

  extractColumns(data) {
    const result = [];
    const startRow = 1;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      
      const record = {
        rowNumber: i + 1,
        referencia: row[AdminConfig.COLUMNS.REFERENCIA],
        talla: row[AdminConfig.COLUMNS.TALLA],
        id_color: row[AdminConfig.COLUMNS.ID_COLOR],
        barcode: row[AdminConfig.COLUMNS.BARCODE]
      };

      result.push(record);
    }

    return result;
  },

  clear() {
    this.currentFile = null;
    this.parsedData = null;
  }
};

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    FileHandler.handleFile(file);
  }
}

function clearFile() {
  document.getElementById('fileInput').value = '';
  FileHandler.clear();
}
