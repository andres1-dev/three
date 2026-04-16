/* ==========================================================================
   UPLOAD DRIVE SERVICE - Solo Imágenes y Sincronización con Supabase
   ========================================================================== */

// CONFIGURACIÓN: Reemplaza con tus valores reales
const SUPABASE_FUNCTIONS_URL = 'https://doqsurxxxaudnutsydlk.supabase.co/functions/v1/operations';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THb9v8csluebALg'; // Necesaria para actualizar la DB
const CARPETA_RAIZ_ID = '1jeZrMgwwhBHA5G4oUqRHNDGhAEx2LMGQ'; // ID real de la carpeta raíz de Drive

/**
 * Maneja peticiones GET (incluyendo preflight OPTIONS)
 */
function doGet(e) {
  // Responder con headers CORS para permitir peticiones desde cualquier origen
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: 'Service is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Recibe la imagen y la meta-información.
 * Guarda en Drive y actualiza Supabase asincrónicamente para el usuario.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.accion === 'SUBIR_DRIVE') {
      const { base64, mimeType, fileName, idNovedad, hoja, category } = data;
      
      if (!base64) {
        throw new Error('Faltan datos críticos para la subida (base64).');
      }

      // Determinar categoría (NOVEDADES, REPORTES, CHATS)
      let cat = (category || hoja || 'OTROS').toUpperCase().trim();
      if (cat === 'CHAT') cat = 'CHATS';

      // 1. Crear el archivo en Drive con organización por carpetas
      const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
      const folder = _getOrCreateFolder(cat);
      const file = folder.createFile(blob);
      
      // 2. Dar permisos de lectura pública
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // 3. Generar URL de visualización directa
      const fileId = file.getId();
      const publicUrl = "https://lh3.googleusercontent.com/d/" + fileId;

      // 4. NOTIFICAR A SUPABASE (Actualizar la columna IMAGEN/SOPORTE)
      // Solo si es una NOVEDAD o REPORTE real que requiere vinculación de imagen.
      let supabaseResponse = "No metadata for DB update";
      let dbUpdated = false;

      if (idNovedad && idNovedad !== 'CHAT_PENDING' && cat !== 'CHATS') {
        const updatePayload = {
          accion: 'UPDATE_ARCHIVO_URL',
          hoja: cat === 'CHATS' ? 'NOVEDADES' : hoja, // Fallback por si acaso
          id: idNovedad,
          url: publicUrl
        };

        const options = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY
          },
          payload: JSON.stringify(updatePayload),
          muteHttpExceptions: true
        };
        
        const response = UrlFetchApp.fetch(SUPABASE_FUNCTIONS_URL, options);
        supabaseResponse = response.getContentText();
        dbUpdated = response.getResponseCode() >= 200 && response.getResponseCode() < 300;
      }

      return ContentService
        .createTextOutput(JSON.stringify({ 
          success: true,
          url: publicUrl,
          driveId: fileId,
          dbUpdated: dbUpdated,
          supabaseResponse: supabaseResponse
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Accion no reconocida' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error(err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Organiza las fotos en carpetas: CATEGORIA / AÑO / MES / DÍA
 */
function _getOrCreateFolder(category) {
  const root = DriveApp.getFolderById(CARPETA_RAIZ_ID);
  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const now = new Date();
  
  const yearName = now.getFullYear().toString();
  const monthName = MESES[now.getMonth()];
  const dayName = now.getDate().toString().padStart(2, '0');

  // Nivel 0: Categoría (NOVEDADES, REPORTES, CHATS, etc.)
  const catFolder = _subF(root, category || 'OTROS');
  
  // Niveles de fecha
  const yearFolder = _subF(catFolder, yearName);
  const monthFolder = _subF(yearFolder, monthName);
  const dayFolder = _subF(monthFolder, dayName);
  
  return dayFolder;
}

function _subF(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
