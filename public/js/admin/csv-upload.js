/* ==========================================================================
   csv-upload.js — Carga masiva de lotes desde CSV a Supabase (SOLO ADMIN)
   ========================================================================== */

let csvUploadModal = null;

/* ══════════════════════════════════════════════════════════════════════════
   Botón flotante CSV (solo para ADMIN)
   ══════════════════════════════════════════════════════════════════════════ */
function createFloatingCSVButton() {
  // Solo crear si el usuario es ADMIN
  if (!currentUser || currentUser.ROL !== 'ADMIN') return;
  
  // Verificar si ya existe
  if (document.getElementById('floating-csv-btn')) return;
  
  // Contenedor del speed-dial
  const container = document.createElement('div');
  container.id = 'floating-csv-btn';
  container.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-end;
    gap: 10px;
    z-index: 1000;
  `;

  // Opciones del menú (ocultas por defecto)
  const options = [
    { label: 'Inventario de proceso', icon: 'fa-file-csv',    action: 'modal' },
    { label: 'Cargar barras',         icon: 'fa-barcode',     action: 'barras' },
    { label: 'Cargar curvas',         icon: 'fa-chart-line',  action: 'curva' },
  ];

  const menuEl = document.createElement('div');
  menuEl.id = 'floating-csv-menu';
  menuEl.style.cssText = `
    display: none;
    flex-direction: column-reverse;
    gap: 8px;
    align-items: flex-end;
  `;

  options.forEach(opt => {
    const row = document.createElement('div');
    row.style.cssText = `display:flex; align-items:center; gap:10px; cursor:pointer;`;

    const label = document.createElement('span');
    label.textContent = opt.label;
    label.style.cssText = `
      background: white;
      color: #1e293b;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.12);
      white-space: nowrap;
      text-transform: none;
      font-family: 'Inter', system-ui, sans-serif;
    `;

    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3f51b5, #303f9f);
      border: none; color: white;
      font-size: 1.3rem; cursor: pointer;
      box-shadow: 0 4px 14px rgba(63,81,181,0.35);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    `;
    btn.innerHTML = `<i class="fas ${opt.icon}"></i>`;
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout  = () => btn.style.transform = 'scale(1)';

    row.onclick = () => {
      toggleCSVMenu(false);
      if (opt.action === 'modal')   window.location.href = 'sispro.html';
      if (opt.action === 'barras')  window.location.href = 'barras.html';
      if (opt.action === 'curva')   window.location.href = 'curva.html';
    };

    row.appendChild(label);
    row.appendChild(btn);
    menuEl.appendChild(row);
  });

  // Botón principal
  const mainBtn = document.createElement('button');
  mainBtn.style.cssText = `
    width: 56px; height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3f51b5, #303f9f);
    border: none; color: white;
    font-size: 1.3rem; cursor: pointer;
    box-shadow: 0 8px 24px rgba(63,81,181,0.4);
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    display: flex; align-items: center; justify-content: center;
    outline: none;
  `;
  mainBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
  mainBtn.title = 'Carga masiva';
  mainBtn.onclick = () => toggleCSVMenu();
  mainBtn.onmouseover = () => { mainBtn.style.transform = 'scale(1.1) translateY(-2px)'; };
  mainBtn.onmouseout  = () => { mainBtn.style.transform = 'scale(1) translateY(0)'; };

  container.appendChild(menuEl);
  container.appendChild(mainBtn);
  document.body.appendChild(container);
  menuEl.dataset.open = 'false';

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!container.contains(e.target)) toggleCSVMenu(false);
  });
}

function toggleCSVMenu(force) {
  const menu = document.getElementById('floating-csv-menu');
  if (!menu) return;
  const open = force !== undefined ? force : menu.dataset.open !== 'true';
  menu.dataset.open = open ? 'true' : 'false';
  menu.style.display = open ? 'flex' : 'none';
}

// Crear el botón al cargar el script
if (typeof currentUser !== 'undefined' && currentUser) {
  createFloatingCSVButton();
}

/* ══════════════════════════════════════════════════════════════════════════
   Modal de carga CSV (estilo profesional similar a index.html)
   ══════════════════════════════════════════════════════════════════════════ */
function openCSVUploadModal() {
  if (csvUploadModal) {
    csvUploadModal.remove();
  }

  csvUploadModal = document.createElement('div');
  csvUploadModal.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  csvUploadModal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 560px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 24px 64px rgba(0,0,0,0.25);
    ">
      <!-- Header -->
      <div style="
        padding: 24px 28px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="
            width: 44px; height: 44px;
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          ">
            <img src="icons/app.svg" alt="Logo" style="width:40px; height:40px; object-fit:contain;">
          </div>
          <div>
            <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#1e293b; letter-spacing:-0.3px; text-transform:none;">
              Inventario de Proceso
            </h3>
            <p style="margin:0; font-size:0.8rem; color:#64748b; font-weight:400; text-transform:none;">
              Carga masiva a Supabase · SISPRO
            </p>
          </div>
        </div>
        <button onclick="closeCSVUploadModal()" style="
          background: none; border: none;
          width: 32px; height: 32px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          color: #94a3b8; font-size: 1.1rem; cursor: pointer;
        " onmouseover="this.style.background='#f1f5f9'; this.style.color='#475569';"
           onmouseout="this.style.background='none'; this.style.color='#94a3b8';">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Body -->
      <div style="padding: 28px;">

        <!-- Drop Zone -->
        <label for="csv-file-input" id="csv-drop-zone" style="
          display: block;
          padding: 36px 30px;
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.25s ease;
          text-align: center;
          margin-bottom: 16px;
        "
        onmouseover="this.style.borderColor='#3f51b5'; this.style.background='#eef0fb'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 20px rgba(63,81,181,0.1)';"
        onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <input type="file" id="csv-file-input" accept=".csv" style="display:none;">
          <div style="margin-bottom: 14px;">
            <i class="fas fa-cloud-upload-alt" id="csv-drop-icon" style="font-size: 40px; color: #94a3b8;"></i>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="display:block; font-size:15px; color:#1e293b; margin-bottom:8px; font-weight:600; text-transform:none;">
              Arrastra tu archivo aquí
            </strong>
            <span style="display:block; font-size:13px; color:#64748b; text-transform:none; margin-bottom:6px;">o haz clic para seleccionar</span>
          </div>
          <div id="csv-badge-default" style="
            display: inline-flex; align-items: center; gap: 6px;
            padding: 5px 12px;
            background: white; border-radius: 6px;
            font-size: 12px; color: #64748b;
            border: 1px solid #e2e8f0;
          ">
            <i class="fas fa-file-csv" style="color:#3f51b5; font-size:13px;"></i>
            CSV UTF-8
          </div>
          <div id="csv-badge-file" style="display:none;"></div>
        </label>

        <!-- Link recurso -->
        <div style="
          padding: 12px 16px;
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
        ">
          <i class="fas fa-link" style="color:#94a3b8; font-size:14px; flex-shrink:0;"></i>
          <a href="http://bit.ly/4vMNEhY" target="_blank" style="
            color: #475569; font-weight: 500; text-decoration: none; text-transform: none;
          " onmouseover="this.style.color='#1e293b';" onmouseout="this.style.color='#475569';">
            ¿No tienes el archivo?
          </a>
        </div>

        <!-- Preview -->
        <div id="csv-preview" style="display:none; margin-bottom:20px;">
          <div style="
            padding: 14px 18px;
            background: #eef0fb;
            border-radius: 10px;
            border: 1px solid #c5cae9;
            display: flex; align-items: center; gap: 12px;
          ">
            <i class="fas fa-file-csv" style="color:#3f51b5; font-size:20px; flex-shrink:0;"></i>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; color:#1e293b; font-size:14px; text-transform:none;" id="csv-file-name-display">archivo.csv</div>
              <div style="font-size:12px; color:#64748b; margin-top:2px; text-transform:none;">
                <span id="csv-row-count">0</span> filas detectadas
              </div>
            </div>
            <i class="fas fa-check-circle" style="color:#3f51b5; font-size:18px;"></i>
          </div>
        </div>

        <!-- Progress -->
        <div id="csv-upload-progress" style="display:none; margin-bottom:20px;">
          <div style="
            background: #e2e8f0; border-radius: 6px;
            height: 8px; overflow: hidden; margin-bottom: 8px;
          ">
            <div id="csv-progress-bar" style="
              background: linear-gradient(90deg, #3f51b5, #303f9f);
              height: 100%; width: 0%;
              transition: width 0.3s ease;
            "></div>
          </div>
          <div style="text-align:center; font-size:12px; font-weight:600; color:#64748b;">
            <span id="csv-progress-text">Procesando...</span>
          </div>
        </div>

        <!-- Result -->
        <div id="csv-upload-result" style="display:none;"></div>
      </div>

      <!-- Footer -->
      <div style="
        padding: 16px 28px 20px;
        border-top: 1px solid #e2e8f0;
        display: flex; gap: 12px; justify-content: flex-end;
      ">
        <button onclick="closeCSVUploadModal()" style="
          padding: 9px 20px;
          border: 1px solid #e2e8f0; border-radius: 8px;
          background: white; color: #475569;
          font-weight: 600; font-size: 14px; cursor: pointer;
          text-transform: none;
        " onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='white';">
          Cancelar
        </button>
        <button id="csv-upload-btn-submit" onclick="processCSVUpload()" disabled style="
          padding: 9px 22px;
          border: none; border-radius: 8px;
          background: linear-gradient(135deg, #3f51b5, #303f9f);
          color: white; font-weight: 600; font-size: 14px; cursor: pointer;
          opacity: 0.45; text-transform: none;
          display: flex; align-items: center; gap: 8px;
          box-shadow: 0 4px 12px rgba(63,81,181,0.2);
        ">
          <i class="fas fa-cloud-upload-alt"></i> Subir a Supabase
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(csvUploadModal);

  // Event listener para el input de archivo
  document.getElementById('csv-file-input').addEventListener('change', handleCSVFileSelect);
  
  // Cerrar modal al hacer clic en el overlay
  csvUploadModal.addEventListener('click', function(e) {
    if (e.target === csvUploadModal) {
      closeCSVUploadModal();
    }
  });
}

function closeCSVUploadModal() {
  if (csvUploadModal) {
    csvUploadModal.remove();
    csvUploadModal = null;
  }
}

function toggleCSVInfo() {
  const panel = document.getElementById('csv-info-panel');
  const btn = document.getElementById('csv-info-toggle');
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    btn.textContent = 'Ocultar';
  } else {
    panel.style.display = 'none';
    btn.textContent = 'Ver columnas';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Manejo de archivo CSV
   ══════════════════════════════════════════════════════════════════════════ */
let csvData = [];

function handleCSVFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    parseCSV(text);
  };
  
  // Intentar detectar el encoding automáticamente
  // Si el archivo tiene BOM UTF-8, lo detectará
  // Si no, intentará con Latin1/Windows-1252 que es común en Excel español
  reader.readAsText(file);
}

/**
 * Convierte fecha de múltiples formatos a "YYYY-MM-DD"
 * Soporta:
 * - "dd-mmm-yy" → "02-dic-25" → "2025-12-02"
 * - "dd/mm/yyyy" → "05/08/2025" → "2025-08-05"
 */
function convertSpanishDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const cleaned = dateStr.trim();
  
  // Formato: dd/mm/yyyy
  if (cleaned.includes('/')) {
    try {
      const parts = cleaned.split('/');
      if (parts.length !== 3) return null;
      
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      
      // Validar que sean números
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      return null;
    }
  }
  
  // Formato: dd-mmm-yy
  if (cleaned.includes('-')) {
    const monthMap = {
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    
    try {
      const parts = cleaned.toLowerCase().split('-');
      if (parts.length !== 3) return null;
      
      const day = parts[0].padStart(2, '0');
      const month = monthMap[parts[1]];
      let year = parts[2];
      
      if (!month) return null;
      
      // Convertir año de 2 dígitos a 4 dígitos
      // Asumimos que 00-49 es 2000-2049 y 50-99 es 1950-1999
      const yearNum = parseInt(year);
      if (yearNum < 50) {
        year = '20' + year.padStart(2, '0');
      } else {
        year = '19' + year.padStart(2, '0');
      }
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      return null;
    }
  }
  
  return null;
}

/**
 * Normaliza el campo Descripcion (tipo de prenda)
 * - Elimina "PROMOCION", "PROMOCIO" o "PROMO"
 * - Reemplaza guiones bajos por espacios
 * - Aplica 2 casos especiales: TOP CROP y JARDINERAS
 * - Convierte plurales a singular automáticamente (quita "ES" o "S" al final)
 */
function normalizeDescripcion(descripcion) {
  if (!descripcion || typeof descripcion !== 'string') return descripcion;
  
  // 1. Limpiar y normalizar
  let normalized = descripcion
    .trim()
    .toUpperCase()
    .replace(/\s+PROMOCION$/i, '')
    .replace(/\s+PROMOCIO$/i, '')
    .replace(/\s+PROMO$/i, '')
    .replace(/_/g, ' ')
    .trim();
  
  // 2. Casos especiales (solo 2)
  if (normalized === 'TOP CROP') return 'CROPTOP';
  if (normalized === 'JARDINERAS, BRAGAS,') return 'JARDINERAS';
  
  // 3. Convertir plural a singular automáticamente
  // Primero intentar quitar "ES" (PANTALONES → PANTALON)
  if (normalized.endsWith('ES') && normalized.length > 4) {
    return normalized.slice(0, -2);
  }
  
  // Luego intentar quitar "S" (BLUSAS → BLUSA)
  // EXCEPCIÓN: No quitar S de palabras que ya son singulares como LEGGINS
  if (normalized.endsWith('S') && normalized.length > 3 && !normalized.endsWith('LEGGINS')) {
    return normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Normaliza texto eliminando caracteres de control y espacios extra
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Normalizar Unicode a forma canónica (NFC)
  // Esto convierte caracteres compuestos a su forma estándar
  let normalized = text.normalize('NFC');
  
  // Limpiar caracteres de control y espacios extra
  normalized = normalized.replace(/[\x00-\x1F\x7F]/g, '').trim();
  
  return normalized;
}

/**
 * Convierte precio de formato colombiano a número entero
 * Ejemplos:
 * - "$ 39.900" → 39900
 * - "$ 5.199.889" → 5199889
 * - "$17.606" → 17606
 */
function convertPrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return null;
  
  try {
    // Eliminar símbolo de peso, espacios y puntos (separadores de miles)
    let cleaned = priceStr
      .replace(/\$/g, '')
      .replace(/\s/g, '')
      .replace(/\./g, '');
    
    // Convertir a número entero
    const number = parseInt(cleaned);
    
    // Validar que sea un número válido
    if (isNaN(number)) return null;
    
    return number;
  } catch (error) {
    return null;
  }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    alert('El archivo CSV está vacío o no tiene datos');
    return;
  }

  // Parsear CSV con separador ;
  const headers = lines[0].split(';').map(h => h.trim());
  
  // Verificar que tenga el header principal (OP)
  if (!headers.includes('OP')) {
    alert('El CSV debe contener la columna "OP" (Orden de Producción)');
    return;
  }

  // Parsear datos - insertar TODAS las columnas tal cual vienen del CSV
  csvData = [];
  const dateColumns = ['FechaCorte', 'FSalidaConf', 'FEntregaConf'];
  const textColumns = ['NombrePlanta', 'Coleccion', 'Proceso', 'Genero', 'Tipo Tejido', 'Cuento'];
  const priceColumns = ['pvp', 'TEMPLO DE LA MODA', 'BARRANCA', 'VALOR FACTURACION'];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim());
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      // Convertir fechas de formato español a ISO
      if (dateColumns.includes(header)) {
        row[header] = convertSpanishDate(value);
      }
      // Convertir precios de formato colombiano a número
      else if (priceColumns.includes(header)) {
        row[header] = convertPrice(value);
      }
      // Convertir a número solo las columnas numéricas conocidas
      else if (['UndProg', 'UndCort', 'InvPlanta', 'InvBPT', 'Saldo BPT'].includes(header)) {
        row[header] = parseInt(value) || 0;
      }
      // Normalizar Descripcion (tipo de prenda) - plural a singular, sin PROMO, etc.
      else if (header === 'Descripcion') {
        row[header] = normalizeDescripcion(value);
      }
      // Normalizar texto en columnas específicas (corregir encoding)
      else if (textColumns.includes(header)) {
        row[header] = normalizeText(value);
      }
      // Texto normal
      else {
        row[header] = value;
      }
    });

    csvData.push(row);
  }

  // Mostrar preview y habilitar botón
  showCSVPreview();
}

function showCSVPreview() {
  const preview = document.getElementById('csv-preview');
  const rowCount = document.getElementById('csv-row-count');
  const fileNameDisplay = document.getElementById('csv-file-name-display');
  const fileInput = document.getElementById('csv-file-input');
  const badgeDefault = document.getElementById('csv-badge-default');
  const badgeFile = document.getElementById('csv-badge-file');
  const badgeFilename = document.getElementById('csv-badge-filename');

  const fileName = fileInput && fileInput.files[0] ? fileInput.files[0].name : 'archivo.csv';

  // Cambiar badge: ocultar "CSV UTF-8", mostrar nombre del archivo
  if (badgeDefault) badgeDefault.style.display = 'none';
  if (badgeFile) { badgeFile.style.display = 'inline-flex'; }
  if (badgeFilename) badgeFilename.textContent = fileName;

  preview.style.display = 'block';
  rowCount.textContent = csvData.length.toLocaleString();
  if (fileNameDisplay) fileNameDisplay.textContent = fileName;

  // Habilitar botón de subida
  const submitBtn = document.getElementById('csv-upload-btn-submit');
  submitBtn.disabled = false;
  submitBtn.style.opacity = '1';
  submitBtn.style.cursor = 'pointer';
  submitBtn.onmouseover = function() { this.style.transform = 'translateY(-1px)'; this.style.boxShadow = '0 6px 16px rgba(82,166,117,0.3)'; };
  submitBtn.onmouseout = function() { this.style.transform = 'translateY(0)'; this.style.boxShadow = '0 4px 12px rgba(82,166,117,0.2)'; };
}

/* ══════════════════════════════════════════════════════════════════════════
   Subir a Supabase
   ══════════════════════════════════════════════════════════════════════════ */
async function processCSVUpload() {
  if (csvData.length === 0) {
    alert('No hay datos para subir');
    return;
  }

  const submitBtn = document.getElementById('csv-upload-btn-submit');
  const progressDiv = document.getElementById('csv-upload-progress');
  const progressBar = document.getElementById('csv-progress-bar');
  const progressText = document.getElementById('csv-progress-text');
  const resultDiv = document.getElementById('csv-upload-result');

  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.5';
  progressDiv.style.display = 'block';
  resultDiv.style.display = 'none';

  try {
    // PASO 1: Enviar todo a la Edge Function (delete + insert con service_role)
    progressText.textContent = 'Sincronizando con Supabase...';
    progressBar.style.width = '10%';

    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'SYNC_SISPRO', records: csvData })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    progressBar.style.width = '100%';
    progressText.textContent = 'Completado';

    const res = await response.json();
    const uploaded = res.inserted || 0;
    const errors = res.errors?.length || 0;
    const errorDetails = res.errors || [];

    // Mostrar resultado
    progressDiv.style.display = 'none';
    resultDiv.style.display = 'block';
    
    if (errors === 0) {
      resultDiv.innerHTML = `
        <div style="
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: start;
        ">
          <i class="fas fa-check-circle" style="color: #16a34a; font-size: 1.5rem; flex-shrink: 0;"></i>
          <div style="color: #166534; font-size: 0.875rem;">
            <strong style="display: block; margin-bottom: 4px;">¡Éxito!</strong>
            SISPRO actualizado: ${uploaded} registros cargados.
          </div>
        </div>
      `;
    } else {
      const errorMsg = errorDetails.length > 0 ? `<br><small>Error: ${errorDetails[0].error}</small>` : '';
      resultDiv.innerHTML = `
        <div style="
          background: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: start;
        ">
          <i class="fas fa-times-circle" style="color: #dc2626; font-size: 1.5rem; flex-shrink: 0;"></i>
          <div style="color: #991b1b; font-size: 0.875rem;">
            <strong style="display: block; margin-bottom: 4px;">Error al subir datos</strong>
            Subidos: ${uploaded}<br>
            Errores: ${errors}${errorMsg}
            <br><small style="color: #64748b;">Revisa la consola del navegador (F12) para más detalles</small>
          </div>
        </div>
      `;
    }

    // Recargar datos de la app
    if (uploaded > 0 && typeof loadSISPRO === 'function') {
      setTimeout(() => loadSISPRO(), 2000);
    }

  } catch (error) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div style="
        background: #fef2f2;
        border: 1px solid #fca5a5;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        gap: 12px;
        align-items: start;
      ">
        <i class="fas fa-times-circle" style="color: #dc2626; font-size: 1.5rem; flex-shrink: 0;"></i>
        <div style="color: #991b1b; font-size: 0.875rem;">
          <strong style="display: block; margin-bottom: 4px;">Error</strong>
          ${error.message}
          <br><small style="color: #64748b;">Revisa la consola del navegador (F12) para más detalles</small>
        </div>
      </div>
    `;
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Exponer funciones globalmente
   ══════════════════════════════════════════════════════════════════════════ */
window.openCSVUploadModal = openCSVUploadModal;
window.closeCSVUploadModal = closeCSVUploadModal;
window.toggleCSVInfo = toggleCSVInfo;
window.processCSVUpload = processCSVUpload;
window.createFloatingCSVButton = createFloatingCSVButton;
window.toggleCSVMenu = toggleCSVMenu;
