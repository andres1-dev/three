/* ==========================================================================
   UPLOAD DRIVE SERVICE - Solo Imágenes y Sincronización con Supabase
   ========================================================================== */

// CONFIGURACIÓN: Reemplaza con tus valores reales
const SUPABASE_FUNCTIONS_URL = 'https://doqsurxxxaudnutsydlk.supabase.co/functions/v1/operations';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THb9v8csluebALg'; // Necesaria para actualizar la DB
const CARPETA_RAIZ_ID = '1ZLGG8wfszE6D8vGwCECWguWGUiDXGUGfN87ZukyaCpo'; // O el ID de tu carpeta de Drive

/**
 * Recibe la imagen y la meta-información.
 * Guarda en Drive y actualiza Supabase asincrónicamente para el usuario.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.accion === 'SUBIR_DRIVE') {
      const { base64, mimeType, fileName, idNovedad, hoja } = data;
      
      if (!base64 || !idNovedad || !hoja) {
        throw new Error('Faltan datos críticos para la subida.');
      }

      // 1. Crear el archivo en Drive
      const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
      const folder = _getOrCreateFolder();
      const file = folder.createFile(blob);
      
      // 2. Dar permisos de lectura pública
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // 3. Generar URL de visualización directa (lh3 es más rápido para previsualización)
      const fileId = file.getId();
      const publicUrl = "https://lh3.googleusercontent.com/d/" + fileId;

      // 4. NOTIFICAR A SUPABASE (Actualizar la columna IMAGEN)
      // GAS lo hace aquí, así el navegador del usuario queda libre de inmediato.
      const updatePayload = {
        accion: 'UPDATE_ARCHIVO_URL',
        hoja: hoja,
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
      const resCode = response.getResponseCode();

      return ContentService.createTextOutput(JSON.stringify({ 
        success: resCode >= 200 && resCode < 300,
        url: publicUrl,
        driveId: fileId,
        supabaseResponse: response.getContentText()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Accion no reconocida' })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Organiza las fotos en carpetas: AÑO / MES / DÍA
 */
function _getOrCreateFolder() {
  const root = DriveApp.getFolderById(CARPETA_RAIZ_ID);
  const now = new Date();
  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  
  const yearName = now.getFullYear().toString();
  const monthName = MESES[now.getMonth()];
  const dayName = now.getDate().toString().padStart(2, '0');

  const yearFolder = _subF(root, yearName);
  const monthFolder = _subF(yearFolder, monthName);
  const dayFolder = _subF(monthFolder, dayName);
  
  return dayFolder;
}

function _subF(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
