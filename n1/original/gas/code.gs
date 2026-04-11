const SPREADSHEET_ID     = '1jZh1Na1Jsb52LvIZlRYjHNUtX2enOSXGxVqeHIVhxVA';
const CARPETA_RAIZ_ID    = '1jeZrMgwwhBHA5G4oUqRHNDGhAEx2LMGQ';
const DRIVE_IMAGE_PREFIX = 'https://lh3.googleusercontent.com/d/';
const CHAT_FOLDER_NAME   = 'CHATS';

/* URL del GAS de notificaciones (codeNotifications.gs) — actualizar tras deploy */
const NOTIF_GAS_URL = 'https://script.google.com/macros/s/AKfycbzPkZzYLgMuqWzUZtcZ9MqEsliJFbjplxwB7wN98SDHF4mIHMFKYCkZUhFtMOIdTahh/exec';

let _ssCache = null;
function _ss() {
  if (!_ssCache) _ssCache = SpreadsheetApp.openById(SPREADSHEET_ID);
  return _ssCache;
}

function _sheet(name) {
  return _ss().getSheetByName(name);
}

/* ── Enviar push de forma SÍNCRONA (sin trigger) para máxima velocidad ── */
function _pushNotif(title, body, extra) {
  if (!NOTIF_GAS_URL) {
    console.warn('[PUSH] NOTIF_GAS_URL no configurada');
    return;
  }
  try {
    var notifId = 'push_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    var payload = 'action=send-notification'
      + '&title=' + encodeURIComponent(title || 'SISPRO')
      + '&body='  + encodeURIComponent(body || '')
      + '&timestamp=' + Date.now();

    var extraData = extra || {};
    for (var k in extraData) {
      if (extraData[k] !== undefined && extraData[k] !== null) {
        payload += '&' + k + '=' + encodeURIComponent(String(extraData[k]));
      }
    }

    console.log('[PUSH] Enviando inmediatamente:', notifId, 'Title:', title);
    
    // Envío SÍNCRONO - sin trigger, respuesta inmediata
    var resp = UrlFetchApp.fetch(NOTIF_GAS_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: payload,
      muteHttpExceptions: true,
      validateHttpsCertificates: true,
      timeout: 10 // 10 segundos máximo para el envío completo
    });
    
    var code = resp.getResponseCode();
    var text = resp.getContentText();
    
    if (code >= 200 && code < 300) {
      console.log('[PUSH] ✅ Enviado exitosamente:', notifId, '|', text.substring(0, 100));
    } else {
      console.error('[PUSH] ❌ Error HTTP ' + code + ':', text.substring(0, 150));
    }
  } catch(e) {
    console.error('[PUSH] Error enviando notificación:', e.message);
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(message, extra)  { return _json(Object.assign({ success: true,  message }, extra)); }
function err(message, extra) { return _json(Object.assign({ success: false, message }, extra)); }

function _uid(p) {
  return p + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
}

function isoALatino(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${+m[3]}/${+m[2]}/${m[1]}` : s;
}

/* ══════════════════════════════════════════
   HEADERS
══════════════════════════════════════════ */
const HEADERS = {
  NOVEDADES: ['ID_NOVEDAD','FECHA','LOTE','REFERENCIA','CANTIDAD','PLANTA','SALIDA','LINEA','PROCESO','PRENDA','GENERO','TEJIDO','AREA','DESCRIPCION','CANTIDAD_SOLICITADA','IMAGEN','ESTADO','CHAT','CHAT_READ','HISTORIAL_ESTADOS'],
  REPORTES:  ['ID_REPORTE','FECHA','LOTE','REFERENCIA','CANTIDAD','PLANTA','SALIDA','LINEA','PROCESO','PRENDA','GENERO','TEJIDO','EMAIL','LOCALIZACION','TIPO_VISITA','CONCLUSION','AVANCE','OBSERVACIONES','SOPORTE'],
  PLANTAS:   ['ID_PLANTA','PLANTA','DIRECCION','TELEFONO','EMAIL'],
  RUTERO:    ['ID_VISITA','FECHA_VISITA','AUDITOR','PLANTA','LOTE','REFERENCIA','PROCESO','TIPO_VISITA','DESTINO','CANTIDAD','PRIORIDAD','ESTADO'],
  USUARIOS:  ['ID_USUARIO','USUARIO','CORREO','TELEFONO','ROL','CONTRASEÑA'],
  CHAT:      ['ID_MSG','ID_NOVEDAD','PLANTA','ROL','AUTOR','MENSAJE','TS'],
};

function _ensureHeaders(sheet, hoja) {
  const expected = HEADERS[hoja] || [];
  if (!expected.length) return;
  if (sheet.getLastRow() === 0) { sheet.appendRow(expected); return; }
  const cur = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = expected.filter(h => !cur.includes(h));
  if (missing.length) sheet.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
}

function _getOrCreateSheet(name) {
  const ss = _ss();
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); _ensureHeaders(s, name); }
  return s;
}

/* ══════════════════════════════════════════
   INSERT ROW AT TOP — batch via Sheets API v4
   Usa batchUpdate para insertar + appendCells en una sola llamada HTTP.
   Fallback a método nativo si falla.
══════════════════════════════════════════ */
function _insertTop(sheet, rowData) {
  try {
    const ssId    = SPREADSHEET_ID;
    const sheetId = sheet.getSheetId();
    const requests = [
      {
        insertDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
          inheritFromBefore: false,
        }
      },
      {
        updateCells: {
          rows: [{
            values: rowData.map(v => {
              if (v instanceof Date) return { userEnteredValue: { stringValue: Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") } };
              if (typeof v === 'number') return { userEnteredValue: { numberValue: v } };
              return { userEnteredValue: { stringValue: String(v ?? '') } };
            })
          }],
          fields: 'userEnteredValue',
          start: { sheetId, rowIndex: 1, columnIndex: 0 },
        }
      }
    ];
    Sheets.Spreadsheets.batchUpdate({ requests }, ssId);
  } catch (_) {
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
  }
}

/* ══════════════════════════════════════════
   ENDPOINTS
══════════════════════════════════════════ */
function doGet() { return ok('API SISPRO activa.'); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    switch (d.accion) {
      case 'GET_CONFIG':                 return _getConfig();
      case 'SOLICITAR_RESETEO_PASSWORD': return _solicitarReseteo(d);
      case 'CONFIRMAR_RESETEO_PASSWORD': return _confirmarReseteo(d);
      case 'UPDATE_ESTADO':              return _updateEstado(d);
      case 'UPDATE_FECHAS':              return err('No existe');
      case 'UPSERT_PLANTA':              return _upsertPlanta(d, _getOrCreateSheet('PLANTAS'));
      case 'NOTIFICAR_SOLUCION':         return _notificarSolucion(d);
      case 'SEND_CHAT_MSG':              return _sendChatMsg(d);
      case 'GET_CHAT_MSGS':              return _getChatMsgs(d);
      case 'GET_LAST_MSGS':              return _getLastMsgs(d);
      case 'ARCHIVE_CHAT':               return _archiveChat(d);
      case 'REOPEN_CHAT':                return _reopenChat(d);
      case 'MARK_READ':                  return _markRead(d);
      case 'UPDATE_RUTERO_PRIORIDADES':  return _updateRuteroPrioridades(d);
      case 'POSPONER_RUTERO':            return _posponerRutero(d);
      case 'ENVIAR_RESUMEN_RUTERO':      return _enviarResumenRutero(d);
      case 'UPDATE_USER_ROLE':           return _updateUserRole(d);
      case 'UPDATE_USER':                return _updateUser(d);
      case 'UPDATE_ARCHIVO_URL':         return _updateArchivoUrl(d);
      case 'SUBIR_ARCHIVO':              return _subirArchivo(d);
      case 'ACTUALIZAR_PLANTA':          return _actualizarPlanta(d);
      case 'UPDATE_AVATAR':              return _updateAvatar(d);
      case 'GET_CONFIG_USER':            return _getConfigUser(d);
      case 'SET_CONFIG_USER':            return _setConfigUser(d);
    }

    const hoja = d.hoja;
    if (!hoja) return err('No se especificó la hoja destino.');

    // Fast path: NOVEDADES y REPORTES no necesitan buscar archivos aquí (upload es async)
    if (hoja === 'NOVEDADES') {
      const id = _uid('NOV');
      _insertTop(_getOrCreateSheet('NOVEDADES'), _rowNovedades(d, '', id));
      return ok('Reporte guardado exitosamente.', { id });
    }
    if (hoja === 'REPORTES') {
      const id = _uid('REP');
      _insertTop(_getOrCreateSheet('REPORTES'), _rowReportes(d, '', id));
      return ok('Reporte guardado exitosamente.', { id });
    }

    const sheet = _getOrCreateSheet(hoja);

    if (hoja === 'RUTERO') {
      _insertTop(sheet, _rowRutero(d));
    } else if (hoja === 'PLANTAS') {
      return _upsertPlanta(d, sheet);
    } else if (hoja === 'USUARIOS') {
      const lr = sheet.getLastRow();
      if (lr >= 2) {
        const rows = sheet.getRange(2, 1, lr - 1, 5).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0]).trim() === String(d.id).trim()) {
            const rol = rows[i][4];
            return err(rol === 'PENDIENTE'
              ? 'Su solicitud aún está PENDIENTE de aprobación por el administrador.'
              : `Ya tiene una cuenta activa con el rol: ${rol}. Por favor inicie sesión.`);
          }
        }
      }
      _insertTop(sheet, _rowUsuarios(d));
    } else {
      return err('Hoja destino no reconocida: ' + hoja);
    }

    return ok('Reporte guardado exitosamente.');
  } catch (e) {
    console.error(e);
    return err('Error interno: ' + e.message);
  }
}

/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
function _getConfig() {
  const p = PropertiesService.getScriptProperties();
  return _json({ API_KEY: p.getProperty('SHEETS_API_KEY'), GEMINI_KEY: p.getProperty('GEMINI_API_KEY') });
}

/* ══════════════════════════════════════════
   ROW BUILDERS
══════════════════════════════════════════ */
function _ts() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function _rowNovedades(d, url, id) {
  return [id||_uid('NOV'), _ts(), d.lote||'', d.referencia||'', d.cantidad||'', d.planta||'', d.salida||'', d.linea||'', d.proceso||'', d.prenda||'', d.genero||'', d.tejido||'', d.area||'', d.descripcion||'', d.cantidadSolicitada||'', url||'', 'PENDIENTE'];
}

function _rowReportes(d, url, id) {
  return [id||_uid('REP'), _ts(), d.lote||'', d.referencia||'', d.cantidad||'', d.planta||'', d.salida||'', d.linea||'', d.proceso||'', d.prenda||'', d.genero||'', d.tejido||'', d.email||'', d.localizacion||'', d.tipoVisita||'', d.conclusion||'', d.avance||'', d.observaciones||'', url||''];
}

function _rowRutero(d) {
  return [_uid('VIS'), isoALatino(String(d.fechaVisita||'').trim()), d.auditor||'', d.planta||'', d.lote||'', d.referencia||'', d.proceso||'', d.tipoVisita||'', d.destino||'', d.cantidad||'', '99', ''];
}

function _rowPlanta(d) {
  return [d.cedula||'', d.nombrePlanta||'', d.direccion||'', d.telefono||'', d.email||'', 'GUEST', d.password||''];
}

function _rowUsuarios(d) {
  return [d.id||'', d.usuario||'', d.correo||'', d.telefono||'', d.rol||'PENDIENTE', d.password||''];
}

/* ══════════════════════════════════════════
   ARCHIVOS ASÍNCRONOS
   SUBIR_ARCHIVO: recibe base64, sube a Drive, retorna URL.
   UPDATE_ARCHIVO_URL: actualiza columna imagen/soporte en fila existente.
══════════════════════════════════════════ */
function _subirArchivo(d) {
  try {
    const url = _guardarArchivo(d.archivo);
    if (!url) return err('No se pudo subir el archivo.');
    return ok('Archivo subido.', { url });
  } catch(e) { return err('Error subiendo archivo: ' + e.message); }
}

function _updateArchivoUrl(d) {
  try {
    const hoja = d.hoja;
    const id   = String(d.id  || '').trim();
    const url  = String(d.url || '').trim();
    if (!hoja || !id || !url) return err('Faltan parámetros.');

    const sheet = _sheet(hoja);
    if (!sheet) return err('Hoja no encontrada.');
    const lr = sheet.getLastRow();
    if (lr < 2) return err('Sin datos.');

    // Columnas fijas según estructura HEADERS (no releer headers en cada llamada)
    // NOVEDADES: col 16 = IMAGEN  |  REPORTES: col 19 = SOPORTE
    const colIdx = hoja === 'NOVEDADES' ? 16 : 19;

    const ids = sheet.getRange(2, 1, lr - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) {
        sheet.getRange(i + 2, colIdx).setValue(url);
        return ok('URL actualizada.');
      }
    }
    return err('Registro no encontrado: ' + id);
  } catch(e) { return err('Error: ' + e.message); }
}

/* ══════════════════════════════════════════
   USUARIOS
══════════════════════════════════════════ */
function _updateUserRole(d) {
  const sheet = _sheet('USUARIOS');
  const lr = sheet.getLastRow();
  if (lr < 2) return err('No hay usuarios registrados.');
  // Solo leer col 1 (IDs), no toda la hoja
  const ids = sheet.getRange(2, 1, lr - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(d.id).trim()) {
      sheet.getRange(i + 2, 5).setValue(d.nuevoRol);
      return ok('Rol actualizado exitosamente.');
    }
  }
  return err('Usuario no encontrado.');
}

function _updateUser(d) {
  const sheet = _sheet('USUARIOS');
  const lr = sheet.getLastRow();
  if (lr < 2) return err('No hay usuarios registrados.');
  const rows = sheet.getRange(2, 1, lr - 1, 6).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(d.id).trim()) {
      const pass = (d.password && String(d.password).trim()) ? d.password : rows[i][5];
      sheet.getRange(i + 2, 2, 1, 5).setValues([[d.usuario, d.correo, d.telefono, d.rol, pass]]);
      return ok('Usuario actualizado exitosamente.');
    }
  }
  return err('Usuario no encontrado.');
}

/* ══════════════════════════════════════════
   PASSWORD RESET
   Usa CacheService (volátil, 30 min).
   Método de búsqueda por correo.
══════════════════════════════════════════ */
function _solicitarReseteo(d) {
  try {
    const correo = String(d.correo || d.email || '').trim().toLowerCase();
    if (!correo) return err('Correo no especificado.');

    const sheet = _sheet('USUARIOS');
    if (!sheet) return err('Hoja USUARIOS no encontrada.');
    const lr = sheet.getLastRow();
    if (lr < 2) return err('No hay usuarios registrados.');

    const rows = sheet.getRange(2, 1, lr - 1, 6).getValues();
    let foundRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][2]).trim().toLowerCase() === correo) { foundRow = i + 2; break; }
    }
    if (foundRow === -1) return err('No se encontró una cuenta con ese correo.');

    const token = Utilities.getUuid().replace(/-/g,'').substring(0,8).toUpperCase();
    CacheService.getScriptCache().put('reset_' + token, String(foundRow), 1800);

    MailApp.sendEmail({
      to: correo,
      subject: '[SISPRO] Código de recuperación de contraseña',
      body: `Tu código de recuperación es: ${token}\n\nVence en 30 minutos.\n\nSi no solicitaste esto, ignorá este mensaje.`,
    });
    return ok('Código enviado al correo registrado.');
  } catch (e) { return err('Error al solicitar reseteo: ' + e.message); }
}

function _confirmarReseteo(d) {
  try {
    const token = String(d.token || '').trim().toUpperCase();
    const pass  = String(d.nuevaPassword || d.newPassword || '').trim();
    if (!token || !pass) return err('Faltan parámetros.');

    const cache  = CacheService.getScriptCache();
    const rowStr = cache.get('reset_' + token);
    if (!rowStr) return err('El código es inválido o ya expiró.');

    _sheet('USUARIOS').getRange(parseInt(rowStr), 6).setValue(pass);
    cache.remove('reset_' + token);
    return ok('Contraseña actualizada exitosamente.');
  } catch (e) { return err('Error al confirmar reseteo: ' + e.message); }
}

/* ══════════════════════════════════════════
   NOVEDADES — UPDATE ESTADO
   Lee headers 1 sola vez, escribe ESTADO + HISTORIAL en batch (setValues 1x2).
══════════════════════════════════════════ */
function _updateEstado(d) {
  try {
    const sheet = _sheet('NOVEDADES');
    if (!sheet) return err('Hoja NOVEDADES no encontrada.');
    const lr = sheet.getLastRow();
    if (lr < 2) return err('No hay datos en la hoja.');

    // Leer headers + todas las filas en 2 llamadas (no por celda individual)
    const ncols      = sheet.getLastColumn();
    const hdrs       = sheet.getRange(1, 1, 1, ncols).getValues()[0].map(String);
    const colEstado  = hdrs.indexOf('ESTADO')            + 1;
    const colHist    = hdrs.indexOf('HISTORIAL_ESTADOS') + 1;
    const allRows    = sheet.getRange(2, 1, lr - 1, ncols).getValues();
    const tz         = Session.getScriptTimeZone();
    const target     = String(d.timestampId);

    for (let i = 0; i < allRows.length; i++) {
      if (String(allRows[i][0]) !== target) continue;
      const row      = i + 2;
      const prevVal  = colEstado > 0 ? String(allRows[i][colEstado - 1] || 'PENDIENTE') : 'PENDIENTE';
      const prevHist = colHist  > 0 ? String(allRows[i][colHist  - 1] || '') : '';
      const tsNow    = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
      const entrada  = `${prevVal}->${d.nuevoEstado}@${tsNow}`;

      // Un solo setValues en rango contiguo si las columnas lo permiten, o dos setValue rápidos
      if (colEstado > 0) sheet.getRange(row, colEstado).setValue(d.nuevoEstado);
      if (colHist   > 0) sheet.getRange(row, colHist).setValue(prevHist ? prevHist + '|' + entrada : entrada);

      if (d.respuesta && d.correo) _mailSolucion(d.correo, d);

      // Push notification al GUEST cuando cambia el estado
      var lote   = String(allRows[i][hdrs.indexOf('LOTE')]        || '');
      var planta = String(allRows[i][hdrs.indexOf('PLANTA')]      || '');
      var ref    = String(allRows[i][hdrs.indexOf('REFERENCIA')]  || '');
      var area   = String(allRows[i][hdrs.indexOf('AREA')]        || '');

      var estadoLabel = d.nuevoEstado === 'FINALIZADO' ? 'Solucionado' : 'En Elaboración';
      var pushTitle  = 'Lote ' + lote + ' — ' + estadoLabel;
      var pushBody   = (ref ? 'Ref: ' + ref : '') + (area ? ' · ' + area : '') + (planta ? ' · ' + planta : '');

      console.log('[PUSH] Enviando notificación de estado:', pushTitle);
      _pushNotif(pushTitle, pushBody.trim(), {
        notifType:      'estado',
        idNovedad:      target,
        lote:           lote,
        planta:         planta,
        referencia:     ref,
        area:           area,
        estadoActual:   d.nuevoEstado,
        timestamp:      Date.now()
      });

      return ok('Estado actualizado exitosamente.');
    }
    return err('No se encontró la novedad con ese ID.');
  } catch (e) { return err('Error interno actualizando estado: ' + e.message); }
}

/* ══════════════════════════════════════════
   PLANTAS
══════════════════════════════════════════ */
function _upsertPlanta(d, sheet) {
  const lr = sheet.getLastRow();
  const idB = String(d.cedula || d.id || '').trim().toLowerCase();
  const nmB = String(d.nombrePlanta || '').trim().toLowerCase();
  if (lr >= 2) {
    const vals = sheet.getRange(2, 1, lr - 1, 2).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim().toLowerCase() === idB || String(vals[i][1]).trim().toLowerCase() === nmB)
        return err('Este taller ya cuenta con un registro activo en el sistema. Por favor, inicie sesión o use la opción de recuperar contraseña.');
    }
  }
  _insertTop(sheet, _rowPlanta(d));
  return ok('Planta registrada exitosamente.');
}

/**
 * Actualiza DIRECCION, TELEFONO y EMAIL de una planta existente buscando por ID o nombre.
 */
function _actualizarPlanta(d) {
  const sheet = _sheet('PLANTAS');
  if (!sheet) return err('Hoja PLANTAS no encontrada.');
  const lr = sheet.getLastRow();
  if (lr < 2) return err('No hay plantas registradas.');

  const idB  = String(d.cedula || d.id || '').trim().toLowerCase();
  const nmB  = String(d.nombrePlanta || '').trim().toLowerCase();
  // PLANTAS: ID_PLANTA(1), PLANTA(2), DIRECCION(3), TELEFONO(4), EMAIL(5), ROL(6), PASSWORD(7)
  const rows = sheet.getRange(2, 1, lr - 1, 7).getValues();

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === idB ||
        String(rows[i][1]).trim().toLowerCase() === nmB) {
      const nuevoNombre = d.nombrePlanta || rows[i][1];
      const nuevaDireccion = d.direccion  || rows[i][2];
      const nuevoTelefono  = d.telefono   || rows[i][3];
      const nuevoEmail     = d.email      || rows[i][4];
      const nuevoRol       = d.rol        || rows[i][5];
      const nuevaPass      = (d.password && String(d.password).trim()) ? d.password : rows[i][6];
      // Actualizar cols 2-7 en una sola llamada
      sheet.getRange(i + 2, 2, 1, 6).setValues([[
        nuevoNombre, nuevaDireccion, nuevoTelefono, nuevoEmail, nuevoRol, nuevaPass
      ]]);
      return ok('Datos de planta actualizados exitosamente.');
    }
  }
  _insertTop(sheet, _rowPlanta(d));
  return ok('Planta registrada exitosamente.');
}

/* ══════════════════════════════════════════
   RUTERO
══════════════════════════════════════════ */
function _updateRuteroPrioridades(d) {
  try {
    const sheet = _sheet('RUTERO');
    if (!sheet) return err('Hoja RUTERO no encontrada.');
    const lr = sheet.getLastRow();
    if (lr < 2) return ok('Sin datos.');

    const updates = d.updates || [];
    if (!updates.length) return ok('Sin cambios.');

    const map = {};
    updates.forEach(u => { map[String(u.idVisita).trim()] = u.prioridad; });

    // Leer col 1 (IDs) y col 11 (PRIORIDAD) en una sola llamada, escribir todo en batch
    const data = sheet.getRange(2, 1, lr - 1, 11).getValues();
    const rowsToWrite = [];  // { row, prioridad }

    for (let i = 0; i < data.length; i++) {
      const id = String(data[i][0]).trim();
      if (map.hasOwnProperty(id)) rowsToWrite.push({ row: i + 2, prioridad: map[id] });
    }

    // Agrupar filas consecutivas para minimizar llamadas a la API
    rowsToWrite.forEach(r => sheet.getRange(r.row, 11).setValue(r.prioridad));
    return ok('Prioridades actualizadas.');
  } catch (e) { return err('Error: ' + e.message); }
}

function _posponerRutero(d) {
  try {
    const sheet = _sheet('RUTERO');
    if (!sheet) return err('Hoja RUTERO no encontrada.');
    const lr = sheet.getLastRow();
    if (lr < 2) return err('Sin datos.');

    // Leer solo col 1 para buscar el ID, luego leer la fila completa una sola vez
    const ids = sheet.getRange(2, 1, lr - 1, 1).getValues();
    let foundIdx = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(d.idVisita).trim()) { foundIdx = i + 2; break; }
    }
    if (foundIdx === -1) return err('Visita no encontrada.');

    const orig = sheet.getRange(foundIdx, 1, 1, 12).getValues()[0];
    // Marcar como REPROGRAMADO e insertar nueva fila en una sola operación
    sheet.getRange(foundIdx, 12).setValue('REPROGRAMADO');
    _insertTop(sheet, [_uid('VIS'), isoALatino(String(d.nuevaFecha||'').trim()), orig[2], orig[3], orig[4], orig[5], orig[6], orig[7], orig[8], orig[9], '99', '']);
    return ok('Visita reprogramada.');
  } catch (e) { return err('Error: ' + e.message); }
}

/* ══════════════════════════════════════════
   CORREOS
══════════════════════════════════════════ */
function _notificarSolucion(d) {
  try {
    if (!d.correo) return err('Correo no especificado.');
    _mailSolucion(d.correo, d);
    return ok('Notificación enviada.');
  } catch (e) { return err('Error al enviar notificación: ' + e.message); }
}

function _mailSolucion(correo, d) {
  const fechaStr = d.fecha
    ? Utilities.formatDate(new Date(d.fecha), Session.getScriptTimeZone(), "dd/MM/yyyy 'a las' HH:mm 'horas'")
    : 'N/A';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
  <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;"><tr><td style="padding:20px 0;">
  <table cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <tr><td style="background:#1e293b;padding:30px 20px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;">RESOLUCIÓN DE NOVEDAD</h1>
    </td></tr>
    <tr><td style="padding:30px 24px;">
      <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Estimado(a) <strong>${d.planta||'Planta'}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
        Le informamos que la novedad reportada el día <strong>${fechaStr}</strong>,
        con radicado <strong>${d.timestampId||'N/A'}</strong>,
        OP <strong>${d.lote||d.resLote||'N/A'}</strong>,
        Ref: <strong>${d.referencia||'N/A'}</strong>, ha sido resuelta exitosamente.
      </p>
      <table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:20px;">
        <tr><td style="padding:16px;background:#f0fdf4;border-left:4px solid #10b981;">
          <p style="margin:0 0 8px;font-size:13px;color:#059669;font-weight:bold;text-transform:uppercase;">DETALLES DE LA SOLUCIÓN</p>
          <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap;">${d.solucion||d.respuesta||'Sin detalles'}</p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#64748b;">Si tiene alguna pregunta, no dude en contactarnos.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Sistema de Gestión de Novedades SISPRO<br>Correo automático, no responder.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;

  MailApp.sendEmail({
    to: correo,
    subject: `[SISPRO] Novedad ${d.timestampId||''} — ${d.nuevoEstado||'Resuelta'}`,
    htmlBody: html,
  });
}

function _enviarResumenRutero(d) {
  try {
    const DEST     = d.correo || 'nixandres2@gmail.com';
    const fecha    = d.fecha || '';
    const auditores = d.auditores || [];

    const auditoresHtml = auditores.map(aud => {
      const s = aud.stats || {};
      const pctColor = s.pct >= 80 ? '#16a34a' : s.pct >= 50 ? '#d97706' : '#dc2626';
      const visitasRows = (aud.visitas || []).map(v => {
        const ec = v.estado === 'VISITADO' ? '#16a34a' : v.estado === 'REPROGRAMADO' ? '#dc2626' : v.estado === 'VENCIDO' ? '#dc2626' : '#d97706';
        const el = v.estado === 'VISITADO' ? 'Visitado' : v.estado === 'REPROGRAMADO' ? 'Diferido' : v.estado === 'VENCIDO' ? 'Vencido' : 'Pendiente';
        return `<tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 10px;font-size:12px;color:#1e293b;font-weight:700;">${v.lote||'S/N'}</td>
          <td style="padding:8px 10px;font-size:12px;color:#64748b;">${v.referencia||'—'}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;">${v.planta||'—'}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;">${v.tipoVisita||'—'}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;">${v.proceso||'—'}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;">${v.destino||'—'}</td>
          <td style="padding:8px 10px;font-size:12px;color:#475569;text-align:right;">${v.cantidad ? Number(v.cantidad).toLocaleString() : '—'}</td>
          <td style="padding:8px 10px;text-align:center;"><span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;color:${ec};background:${ec}18;">${el}</span></td>
        </tr>`;
      }).join('');
      return `<table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:20px;border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;">
        <tr><td colspan="8" style="background:#f8fafc;padding:12px 16px;border-bottom:1.5px solid #e2e8f0;">
          <table cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td><div style="font-size:14px;font-weight:800;color:#1e293b;">${aud.nombre}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${s.total||0} visitas &nbsp;·&nbsp; <span style="color:#22c55e;">${s.visitadas||0} completadas</span> &nbsp;·&nbsp; <span style="color:#d97706;">${s.pendientes||0} pendientes</span>${s.diferidas>0?` &nbsp;·&nbsp; <span style="color:#dc2626;">${s.diferidas} diferidas</span>`:''}${s.uds>0?` &nbsp;·&nbsp; ${Number(s.uds).toLocaleString()} uds.`:''}</div>
            </td>
            <td style="text-align:right;white-space:nowrap;"><span style="font-size:18px;font-weight:900;color:${pctColor};">${s.pct||0}%</span><div style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700;">cumplimiento</div></td>
          </tr></table>
          <div style="height:4px;border-radius:4px;background:#e2e8f0;margin-top:8px;overflow:hidden;"><div style="height:100%;width:${s.pct||0}%;background:linear-gradient(90deg,#3F51B5,#22c55e);border-radius:4px;"></div></div>
        </td></tr>
        <tr style="background:#f1f5f9;">
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:left;text-transform:uppercase;">OP/Lote</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:left;text-transform:uppercase;">Referencia</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:left;text-transform:uppercase;">Planta</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:left;text-transform:uppercase;">Tipo</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:left;text-transform:uppercase;">Proceso</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:left;text-transform:uppercase;">Destino</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:right;text-transform:uppercase;">Uds.</th>
          <th style="padding:7px 10px;font-size:10px;font-weight:800;color:#64748b;text-align:center;text-transform:uppercase;">Estado</th>
        </tr>${visitasRows}
      </table>`;
    }).join('');

    const tv = auditores.reduce((a,x) => a+(x.stats.total||0), 0);
    const tvi = auditores.reduce((a,x) => a+(x.stats.visitadas||0), 0);
    const tp  = auditores.reduce((a,x) => a+(x.stats.pendientes||0), 0);
    const td  = auditores.reduce((a,x) => a+(x.stats.diferidas||0), 0);
    const tu  = auditores.reduce((a,x) => a+(x.stats.uds||0), 0);
    const pg  = tv > 0 ? Math.round((tvi/tv)*100) : 0;
    const pgc = pg >= 80 ? '#16a34a' : pg >= 50 ? '#d97706' : '#dc2626';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;"><tr><td style="padding:24px 12px;">
    <table cellspacing="0" cellpadding="0" border="0" width="640" style="margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      <tr><td style="background:linear-gradient(135deg,#3F51B5,#5c6bc0);padding:24px 28px;">
        <div style="font-size:20px;font-weight:900;color:white;">Resumen de Rutero</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px;">Agenda de visitas · ${fecha}</div>
      </td></tr>
      <tr><td style="padding:20px 28px 0;">
        <table cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:14px 0;text-align:center;border-right:1px solid #f1f5f9;"><div style="font-size:22px;font-weight:900;color:#22c55e;">${tvi}</div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:2px;">Visitadas</div></td>
            <td style="padding:14px 0;text-align:center;border-right:1px solid #f1f5f9;"><div style="font-size:22px;font-weight:900;color:#d97706;">${tp}</div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:2px;">Pendientes</div></td>
            <td style="padding:14px 0;text-align:center;border-right:1px solid #f1f5f9;"><div style="font-size:22px;font-weight:900;color:#dc2626;">${td}</div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:2px;">Diferidas</div></td>
            <td style="padding:14px 0;text-align:center;border-right:1px solid #f1f5f9;"><div style="font-size:22px;font-weight:900;color:#3F51B5;">${tu > 0 ? Number(tu).toLocaleString() : '—'}</div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:2px;">Unidades</div></td>
            <td style="padding:14px 20px;text-align:center;"><div style="font-size:22px;font-weight:900;color:${pgc};">${pg}%</div><div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-top:2px;">Cumplimiento</div><div style="height:4px;border-radius:4px;background:#e2e8f0;margin-top:6px;overflow:hidden;"><div style="height:100%;width:${pg}%;background:linear-gradient(90deg,#3F51B5,#22c55e);border-radius:4px;"></div></div></td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 28px;">${auditoresHtml}</td></tr>
      <tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">Sistema SISPRO · Resumen generado automáticamente · No responder</p>
      </td></tr>
    </table></td></tr></table></body></html>`;

    MailApp.sendEmail({
      to: DEST,
      subject: `Rutero ${fecha} — ${tv} visitas · ${pg}% cumplimiento`,
      htmlBody: html,
    });
    return ok('Resumen enviado a ' + DEST);
  } catch (e) { return err('Error al enviar resumen: ' + e.message); }
}

/* ══════════════════════════════════════════
   DRIVE
   Cache de carpeta del día (6h TTL).
══════════════════════════════════════════ */
const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function _guardarArchivo(f) {
  if (!f || !f.base64) return '';
  try {
    const blob   = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType, f.fileName);
    const folder = _monthFolder();
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return DRIVE_IMAGE_PREFIX + file.getId();
  } catch (e) { console.error(e); return ''; }
}

function _monthFolder() {
  const now = new Date();
  const key = `folder_${now.getFullYear()}_${MESES[now.getMonth()]}_${String(now.getDate()).padStart(2,'0')}`;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) { try { return DriveApp.getFolderById(cached); } catch(_){} }
  const root  = DriveApp.getFolderById(CARPETA_RAIZ_ID);
  const year  = _subFolder(root,  String(now.getFullYear()));
  const month = _subFolder(year,  MESES[now.getMonth()]);
  const day   = _subFolder(month, String(now.getDate()).padStart(2,'0'));
  cache.put(key, day.getId(), 21600);
  return day;
}

function _subFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/* ══════════════════════════════════════════
   CHAT
   Buffer en hoja CHAT. Archivado → Drive JSON.
   Lecturas de mensajes: getDisplayValues en 1 llamada.
══════════════════════════════════════════ */
function _chatSheet() {
  return _getOrCreateSheet('CHAT');
}

function _chatFolder() {
  const root = DriveApp.getFolderById(CARPETA_RAIZ_ID);
  const it   = root.getFoldersByName(CHAT_FOLDER_NAME);
  return it.hasNext() ? it.next() : root.createFolder(CHAT_FOLDER_NAME);
}

function _novChatInfo(idNovedad) {
  const sheet = _sheet('NOVEDADES');
  if (!sheet) return null;
  const lr = sheet.getLastRow();
  if (lr < 2) return null;
  const hdrs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  let col = hdrs.indexOf('CHAT') + 1;
  if (!col) { col = sheet.getLastColumn() + 1; sheet.getRange(1, col).setValue('CHAT'); }
  const ids = sheet.getRange(2, 1, lr - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(idNovedad).trim())
      return { sheet, col, row: i + 2 };
  }
  return null;
}

function _readReceipts(idNovedad) {
  try {
    const sheet = _sheet('NOVEDADES');
    if (!sheet) return {};
    const lr = sheet.getLastRow();
    if (lr < 2) return {};
    const hdrs = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const col  = hdrs.indexOf('CHAT_READ') + 1;
    if (!col) return {};
    const ids = sheet.getRange(2, 1, lr - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(idNovedad).trim()) {
        try { return JSON.parse(sheet.getRange(i+2,col).getDisplayValue() || '{}'); } catch(_){ return {}; }
      }
    }
  } catch(_){}
  return {};
}

function _sendChatMsg(d) {
  try {
    const ts    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const sheet = _chatSheet();
    let msg = String(d.mensaje || '');
    if (d.imagen && d.imagen.base64) {
      const url = _guardarArchivo(d.imagen);
      if (url) msg = url + (msg ? '\n' + msg : '');
    }
    const id = _uid('MSG');
    sheet.appendRow([id, String(d.idNovedad||''), String(d.planta||''), String(d.rol||''), String(d.autor||''), msg, ts]);

    // Push notification cuando se envía un mensaje de chat
    var isGuest = String(d.rol||'').toUpperCase() === 'GUEST';
    var pushTitle = isGuest
      ? '💬 Mensaje — Lote ' + String(d.lote||'S/N')
      : '💬 Respuesta — Lote ' + String(d.lote||'S/N');
    var autor = isGuest ? String(d.planta||'Planta') : String(d.autor||'Equipo');
    var pushBody = autor + ': ' + String(d.mensaje||'').substring(0, 80);
    
    console.log('[PUSH] Enviando notificación de chat:', pushTitle);
    _pushNotif(pushTitle, pushBody, {
      notifType: 'chat',
      idNovedad: String(d.idNovedad||''),
      lote:      String(d.lote||''),
      planta:    String(d.planta||''),
      autor:     autor,
      body:      String(d.mensaje||''),
      timestamp: Date.now()
    });

    return ok('Mensaje enviado.', { id, ts });
  } catch (e) { return err('Error al enviar mensaje: ' + e.message); }
}

function _getChatMsgs(d) {
  try {
    const idN      = String(d.idNovedad||'').trim();
    const receipts = _readReceipts(idN);
    const info     = _novChatInfo(idN);

    if (info) {
      const cell = info.sheet.getRange(info.row, info.col).getDisplayValue().trim();

      // Nuevo formato: JSON compacto en celda
      if (cell.startsWith('[')) {
        try {
          const raw  = JSON.parse(cell);
          const msgs = raw.map(_expandMsg);
          return ok('OK', { msgs, archived: true, readReceipts: receipts });
        } catch(_){}
      }

      // Legacy: archivo en Drive (compatibilidad hacia atrás)
      if (cell.startsWith('https://')) {
        try {
          const fid = cell.match(/id=([^&]+)/)?.[1] || cell.match(/\/d\/([^\/\?]+)/)?.[1];
          if (fid) {
            const raw  = JSON.parse(DriveApp.getFileById(fid).getBlob().getDataAsString());
            const msgs = raw.map(_expandMsg);
            return ok('OK', { msgs, archived: true, readReceipts: receipts });
          }
        } catch(_){}
      }
    }

    const sheet = _chatSheet();
    const lr    = sheet.getLastRow();
    if (lr < 2) return ok('OK', { msgs: [], readReceipts: receipts });
    const rows = sheet.getRange(2, 1, lr-1, 7).getDisplayValues();
    const msgs = rows.filter(r => String(r[1]).trim() === idN)
                     .map(r => ({ id:r[0], rol:r[3], autor:r[4], mensaje:r[5], ts:r[6] }));
    return ok('OK', { msgs, readReceipts: receipts });
  } catch (e) { return err('Error al obtener mensajes: ' + e.message); }
}

function _markRead(d) {
  try {
    const idN = String(d.idNovedad||'').trim();
    const rol = String(d.rol||'').trim();
    if (!idN || !rol) return err('Faltan parámetros.');
    const ts    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const sheet = _sheet('NOVEDADES');
    if (!sheet) return err('Hoja NOVEDADES no encontrada.');
    const lr = sheet.getLastRow();
    if (lr < 2) return err('Sin datos.');
    const hdrs = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    let col = hdrs.indexOf('CHAT_READ') + 1;
    if (!col) { col = sheet.getLastColumn()+1; sheet.getRange(1,col).setValue('CHAT_READ'); }
    const ids = sheet.getRange(2,1,lr-1,1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() !== idN) continue;
      const cell = sheet.getRange(i+2, col);
      let rec = {};
      try { rec = JSON.parse(cell.getDisplayValue()||'{}'); } catch(_){}
      rec[rol === 'GUEST' ? 'GUEST' : 'OPERATOR'] = ts;
      cell.setValue(JSON.stringify(rec));
      return ok('Visto registrado.', { ts });
    }
    return err('Novedad no encontrada.');
  } catch (e) { return err('Error en markRead: ' + e.message); }
}

function _getLastMsgs(d) {
  try {
    const ids = d.ids || [];
    const result = {};
    ids.forEach(id => { result[id] = null; });
    const sheet = _chatSheet();
    const lr    = sheet.getLastRow();
    if (lr < 2) return ok('OK', { lastMsgs: result });
    sheet.getRange(2,1,lr-1,7).getDisplayValues().forEach(r => {
      const nid = String(r[1]).trim();
      if (result.hasOwnProperty(nid))
        result[nid] = { id:r[0], rol:r[3], autor:r[4], mensaje:r[5], ts:r[6] };
    });
    return ok('OK', { lastMsgs: result });
  } catch (e) { return err('Error en getLastMsgs: ' + e.message); }
}

/* _expandMsg: normaliza un mensaje archivado al formato que espera el frontend.
   Soporta tanto el formato legible {rol,autor,mensaje,ts} como el compacto legacy {r,a,m,t}. */
function _expandMsg(m) {
  return {
    id:      m.id     || '',
    rol:     m.rol    || m.r || '',
    autor:   m.autor  || m.a || '',
    mensaje: m.mensaje|| m.m || '',
    ts:      m.ts     || m.t || ''
  };
}

function _archiveChat(d) {
  try {
    const idN   = String(d.idNovedad||'').trim();
    const sheet = _chatSheet();
    const lr    = sheet.getLastRow();
    const toDel = [];
    let msgs = [];

    if (lr >= 2) {
      sheet.getRange(2,1,lr-1,7).getDisplayValues().forEach((r,i) => {
        if (String(r[1]).trim() === idN) {
          msgs.push({ rol: r[3], autor: r[4], mensaje: r[5], ts: r[6] });
          toDel.push(i+2);
        }
      });
    }

    // Guardar JSON minificado directo en la celda CHAT de NOVEDADES
    const json = JSON.stringify(msgs);
    const info = _novChatInfo(idN);
    if (info) info.sheet.getRange(info.row, info.col).setValue(json);

    toDel.reverse().forEach(n => sheet.deleteRow(n));
    return ok('Chat archivado.', { count: msgs.length });
  } catch (e) { return err('Error al archivar chat: ' + e.message); }
}

function _reopenChat(d) {
  try {
    const idN  = String(d.idNovedad||'').trim();
    const info = _novChatInfo(idN);
    if (!info) return err('Novedad no encontrada.');

    const cell = info.sheet.getRange(info.row, info.col).getDisplayValue().trim();
    let archived = [];

    if (cell.startsWith('[')) {
      // Nuevo formato: JSON en celda
      try { archived = JSON.parse(cell) || []; } catch(_){}
    } else if (cell.startsWith('https://')) {
      // Legacy: archivo en Drive — migrar al nuevo formato
      try {
        const fid = cell.match(/id=([^&]+)/)?.[1] || cell.match(/\/d\/([^\/\?]+)/)?.[1];
        if (fid) {
          const file = DriveApp.getFileById(fid);
          archived   = JSON.parse(file.getBlob().getDataAsString()) || [];
          file.setTrashed(true);
        }
      } catch(_){}
    }

    if (archived.length) {
      const cs   = _chatSheet();
      const rows = archived.map(m => {
        const ex = _expandMsg(m);
        return [_uid('MSG'), idN, '', ex.rol, ex.autor, ex.mensaje, ex.ts];
      });
      cs.getRange(cs.getLastRow()+1, 1, rows.length, 7).setValues(rows);
    }

    info.sheet.getRange(info.row, info.col).setValue('');
    return ok('Chat reabierto.', { count: archived.length });
  } catch (e) { return err('Error al reabrir chat: ' + e.message); }
}

/* ══════════════════════════════════════════
   TEST — ejecutar desde el editor GAS para
   verificar que el envío de push funciona.
   Abre Ejecutar > testPushEstado / testPushChat
══════════════════════════════════════════ */
function testPushEstado() {
  _pushNotif('Lote 9999 - Solucionado', 'REF-001 - CORTE - Planta Test', {
    notifType:    'estado',
    idNovedad:    'NOV-TEST',
    lote:         '9999',
    planta:       'Planta Test',
    estadoActual: 'FINALIZADO'
  });
  console.log('[TEST] testPushEstado ejecutado - Notificación enviada inmediatamente');
}

function testPushChat() {
  _pushNotif('Mensaje - Lote 9999', 'Planta Test: Hola, esto es una prueba de notificacion', {
    notifType: 'chat',
    idNovedad: 'NOV-TEST',
    lote:      '9999',
    planta:    'Planta Test'
  });
  console.log('[TEST] testPushChat ejecutado - Notificación enviada inmediatamente');
}

/* ══════════════════════════════════════════
   SOLICITAR PERMISOS — ejecutar UNA vez desde
   el editor para forzar autorización de scopes.
   Ejecutar > solicitarPermisos
══════════════════════════════════════════ */
function solicitarPermisos() {
  // Fuerza el scope script.external_request
  var resp = UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  console.log('UrlFetchApp OK:', resp.getResponseCode());

  // Fuerza scope spreadsheets
  SpreadsheetApp.openById(SPREADSHEET_ID).getName();
  console.log('SpreadsheetApp OK');

  // Fuerza scope drive
  DriveApp.getRootFolder().getName();
  console.log('DriveApp OK');

  // Fuerza scope mail
  MailApp.getRemainingDailyQuota();
  console.log('MailApp OK');

  console.log('Todos los permisos solicitados correctamente.');
}

/* ══════════════════════════════════════════
   CONFIGURACIONES — Hoja dedicada por usuario/planta
   Columnas: ID | NOMBRE | AVATAR | NOTIF_PREFS | UPDATED
   Upsert por ID: si existe actualiza, si no inserta.
══════════════════════════════════════════ */

function _getConfigsSheet() {
  return _getOrCreateSheet('CONFIGURACIONES');
}

function _ensureConfigHeaders(sheet) {
  const expected = ['ID', 'NOMBRE', 'AVATAR', 'NOTIF_PREFS', 'UPDATED'];
  if (sheet.getLastRow() === 0) { sheet.appendRow(expected); return; }
  const cur = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const missing = expected.filter(h => !cur.includes(h));
  if (missing.length) sheet.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
}

function _getConfigUser(d) {
  try {
    const id = String(d.id || '').trim();
    if (!id) return err('Falta id.');
    const sheet = _getConfigsSheet();
    _ensureConfigHeaders(sheet);
    const lr = sheet.getLastRow();
    if (lr < 2) return ok('Sin configuración.', { config: null });
    const rows = sheet.getRange(2, 1, lr - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        return ok('OK', {
          config: {
            id:          rows[i][0],
            nombre:      rows[i][1],
            avatar:      rows[i][2] ? JSON.parse(rows[i][2]) : null,
            notifPrefs:  rows[i][3] ? JSON.parse(rows[i][3]) : null,
            updated:     rows[i][4]
          }
        });
      }
    }
    return ok('Sin configuración.', { config: null });
  } catch(e) { return err('Error: ' + e.message); }
}

function _setConfigUser(d) {
  try {
    const id     = String(d.id     || '').trim();
    const nombre = String(d.nombre || '').trim();
    if (!id) return err('Falta id.');

    const sheet = _getConfigsSheet();
    _ensureConfigHeaders(sheet);
    const ts  = _ts();
    const lr  = sheet.getLastRow();

    // Buscar fila existente
    if (lr >= 2) {
      const ids = sheet.getRange(2, 1, lr - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === id) {
          // Actualizar solo los campos enviados
          const row = sheet.getRange(i + 2, 1, 1, 5).getValues()[0];
          const newAvatar     = d.avatar     !== undefined ? JSON.stringify(d.avatar)     : row[2];
          const newNotifPrefs = d.notifPrefs !== undefined ? JSON.stringify(d.notifPrefs) : row[3];
          sheet.getRange(i + 2, 1, 1, 5).setValues([[id, nombre || row[1], newAvatar, newNotifPrefs, ts]]);
          return ok('Configuración actualizada.');
        }
      }
    }

    // No existe — insertar nueva fila
    const avatarJson     = d.avatar     !== undefined ? JSON.stringify(d.avatar)     : '';
    const notifPrefsJson = d.notifPrefs !== undefined ? JSON.stringify(d.notifPrefs) : '';
    _insertTop(sheet, [id, nombre, avatarJson, notifPrefsJson, ts]);
    return ok('Configuración creada.');
  } catch(e) { return err('Error: ' + e.message); }
}

/* Mantener _updateAvatar como alias por compatibilidad */
function _updateAvatar(d) {
  return _setConfigUser({ id: d.id, nombre: d.nombre || '', avatar: d.avatar });
}
