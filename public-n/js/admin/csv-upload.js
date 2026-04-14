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
  
  const floatingBtn = document.createElement('button');
  floatingBtn.id = 'floating-csv-btn';
  floatingBtn.onclick = openCSVUploadModal;
  floatingBtn.title = 'Cargar CSV de lotes';
  floatingBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
  floatingBtn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    border: none;
    color: white;
    font-size: 1.3rem;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
  `;
  
  floatingBtn.onmouseover = function() {
    this.style.transform = 'scale(1.1) translateY(-2px)';
    this.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.5)';
  };
  
  floatingBtn.onmouseout = function() {
    this.style.transform = 'scale(1) translateY(0)';
    this.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)';
  };
  
  document.body.appendChild(floatingBtn);
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  `;
  
  csvUploadModal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <div style="
        padding: 20px 24px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #1e293b;">
          <i class="fas fa-file-csv" style="color: #3b82f6; margin-right: 8px;"></i>
          Cargar CSV de Lotes
        </h3>
        <button onclick="closeCSVUploadModal()" style="
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #94a3b8;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f1f5f9'; this.style.color='#1e293b';" 
           onmouseout="this.style.background='none'; this.style.color='#94a3b8';">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div style="padding: 24px;">
        <div style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-weight: 600; color: #334155; font-size: 0.875rem;">
              Seleccionar archivo CSV:
            </label>
            <button type="button" id="csv-info-toggle" onclick="toggleCSVInfo()" style="
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 6px;
              padding: 4px 10px;
              color: #3b82f6;
              font-size: 0.75rem;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: all 0.2s;
            " onmouseover="this.style.background='#dbeafe';" onmouseout="this.style.background='#eff6ff';">
              <i class="fas fa-info-circle"></i>
              <span>Ver formato</span>
            </button>
          </div>
          
          <div id="csv-info-panel" style="
            display: none;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            font-size: 0.75rem;
            color: #1e40af;
          ">
            <strong>Formato esperado:</strong> CSV con separador punto y coma (;)
            <div style="margin-top: 8px; background: white; padding: 8px; border-radius: 4px; overflow-x: auto;">
              <strong>Headers (23 columnas):</strong><br>
              <code style="font-size: 0.7rem; color: #475569;">OP;Ref;Coleccion;UndProg;UndCort;FechaCorte;Estado de integracion;Bodega Despacho;InvPlanta;NombrePlanta;FSalidaConf;FEntregaConf;Proceso;InvBPT;Saldo BPT;Descripcion;Cuento;Genero;Tipo Tejido;pvp;TEMPLO DE LA MODA;BARRANCA;VALOR FACTURACION</code>
            </div>
          </div>

          <input type="file" id="csv-file-input" accept=".csv" style="
            width: 100%;
            padding: 10px;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.borderColor='#3b82f6';" onmouseout="this.style.borderColor='#cbd5e1';">
        </div>

        <div id="csv-preview" style="display: none; margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #334155; font-size: 0.875rem;">
            Vista previa (primeras 5 filas):
          </label>
          <div style="
            max-height: 200px;
            overflow: auto;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
          ">
            <pre id="csv-preview-content" style="margin: 0; font-size: 0.75rem; color: #475569;"></pre>
          </div>
          <div style="margin-top: 8px; font-size: 0.875rem; color: #64748b;">
            <strong>Total de filas:</strong> <span id="csv-row-count">0</span>
          </div>
        </div>

        <div id="csv-upload-progress" style="display: none; margin-bottom: 20px;">
          <div style="
            background: #e2e8f0;
            border-radius: 8px;
            height: 32px;
            overflow: hidden;
            position: relative;
          ">
            <div id="csv-progress-bar" style="
              background: linear-gradient(90deg, #3b82f6, #2563eb);
              height: 100%;
              width: 0%;
              transition: width 0.3s;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: 700;
              font-size: 0.875rem;
            ">0%</div>
          </div>
          <div style="margin-top: 8px; text-align: center; font-size: 0.875rem; color: #64748b;">
            <span id="csv-progress-text">Procesando...</span>
          </div>
        </div>

        <div id="csv-upload-result" style="display: none;"></div>
      </div>
      
      <div style="
        padding: 16px 24px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      ">
        <button onclick="closeCSVUploadModal()" style="
          padding: 10px 20px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          color: #475569;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='white';">
          Cancelar
        </button>
        <button id="csv-upload-btn-submit" onclick="processCSVUpload()" disabled style="
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          background: #3b82f6;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0.5;
        ">
          <i class="fas fa-upload"></i> Subir a Supabase
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
    btn.innerHTML = '<i class="fas fa-times"></i><span>Ocultar</span>';
  } else {
    panel.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-info-circle"></i><span>Ver formato</span>';
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
  const content = document.getElementById('csv-preview-content');
  const rowCount = document.getElementById('csv-row-count');

  preview.style.display = 'block';
  rowCount.textContent = csvData.length;

  // Mostrar primeras 5 filas
  const previewData = csvData.slice(0, 5);
  content.textContent = JSON.stringify(previewData, null, 2);
  
  // Habilitar botón de subida
  const submitBtn = document.getElementById('csv-upload-btn-submit');
  submitBtn.disabled = false;
  submitBtn.style.opacity = '1';
  submitBtn.style.cursor = 'pointer';
  submitBtn.onmouseover = function() { this.style.background = '#2563eb'; };
  submitBtn.onmouseout = function() { this.style.background = '#3b82f6'; };
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
    const supabase = window.supabase.createClient(
      'https://doqsurxxxaudnutsydlk.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THb9v8csluebALg'
    );

    // Subir en lotes de 100
    const batchSize = 100;
    let uploaded = 0;
    let errors = 0;
    let errorDetails = [];

    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('SISPRO')
        .upsert(batch, { onConflict: 'OP' });

      if (error) {
        errors += batch.length;
        errorDetails.push({
          batch: Math.floor(i/batchSize) + 1,
          error: error.message,
          code: error.code
        });
      } else {
        uploaded += batch.length;
      }

      // Actualizar progreso
      const progress = Math.round((i + batch.length) / csvData.length * 100);
      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `${progress}%`;
      progressText.textContent = `Subiendo: ${uploaded + errors} / ${csvData.length}`;
    }

    if (errorDetails.length > 0) {
      // Errores registrados
    }

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
            Se subieron ${uploaded} lotes correctamente a Supabase.
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
