// ============================================
// GAS PWA NOTIFICACIONES v5
// - Envío rápido: JWT VAPID + payload texto plano
// - Compatible Android (FCM) e iOS (APNs)
// - NUNCA borra suscripciones salvo HTTP 410
// - Sin BigInt, compatible Google Apps Script
// ============================================

var SPREADSHEET_ID = '1jZh1Na1Jsb52LvIZlRYjHNUtX2enOSXGxVqeHIVhxVA';

function getFormattedDateTime(date) {
  date = date || new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return pad(date.getDate()) + '/' + pad(date.getMonth()+1) + '/' + date.getFullYear()
    + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

// ============================================
// doGet
// ============================================
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    if (params.action === 'vapid-public-key')        return obtenerClaveVapid();
    if (params.action === 'test')                    return crearRespuestaJSON({ success: true, message: 'OK v5', time: getFormattedDateTime() });
    if (params.action === 'list-subscriptions')      return listarSuscripciones();
    if (params.action === 'get-latest-notification') return getLatestNotification();
    return crearRespuestaJSON({ success: true, message: 'PWA API v5' });
  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// doPost
// ============================================
function doPost(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    if (e && e.postData && e.postData.contents) {
      try {
        var json = JSON.parse(e.postData.contents);
        for (var k in json) { params[k] = json[k]; }
      } catch(err) {}
    }
    var action = params.action;
    console.log('POST action:', action);
    if (action === 'subscribe')         return guardarSuscripcion(params, e);
    if (action === 'unsubscribe')       return eliminarSuscripcion(params);
    if (action === 'send-notification') return enviarNotificacionATodos(params);
    return crearRespuestaJSON({ success: false, message: 'Accion no reconocida: ' + action });
  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// Respuestas
// ============================================
function crearRespuestaJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function crearRespuestaError(err) {
  console.error('ERROR:', err.toString());
  return crearRespuestaJSON({ success: false, error: err.toString() });
}

// ============================================
// Obtener última notificación (PULL para iOS)
// ============================================
function getLatestNotification() {
  try {
    var props = PropertiesService.getScriptProperties();
    var json = props.getProperty('LAST_NOTIFICATION');
    if (!json) return crearRespuestaJSON({ success: false, message: 'No hay notificaciones' });
    return crearRespuestaJSON({ success: true, notification: JSON.parse(json) });
  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// VAPID public key
// ============================================
function obtenerClaveVapid() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('vapid_keys');
    if (!sheet) {
      var ns = ss.insertSheet('vapid_keys');
      ns.getRange('A1').setValue('public_key');
      ns.getRange('B1').setValue('private_key');
      return crearRespuestaJSON({ success: false, error: 'Hoja vapid_keys creada. Agrega claves en fila 2.' });
    }
    var data = sheet.getDataRange().getValues();
    if (data.length < 2 || !data[1][0])
      return crearRespuestaJSON({ success: false, error: 'Agrega clave publica VAPID en A2.' });
    return ContentService.createTextOutput(data[1][0].toString().trim())
      .setMimeType(ContentService.MimeType.TEXT);
  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// Guardar suscripcion
// ============================================
function guardarSuscripcion(params, e) {
  try {
    var sub = null;
    
    // Método 1: Leer desde params.data (form-urlencoded con JSON stringificado)
    if (params.data) {
      try { 
        sub = JSON.parse(params.data);
        console.log('[SUBSCRIBE] Método 1 - params.data:', sub.endpoint ? sub.endpoint.substring(0, 60) : 'sin endpoint');
      } catch(err) {
        console.error('[SUBSCRIBE] Error parseando params.data:', err.toString());
      }
    }
    
    // Método 2: Leer desde e.postData.contents (JSON directo en body)
    if (!sub && e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        if (body.endpoint) sub = body;
        else if (body.subscription) sub = body.subscription;
        console.log('[SUBSCRIBE] Método 2 - postData.contents:', sub ? sub.endpoint.substring(0, 60) : 'sin endpoint');
      } catch(err) {
        console.error('[SUBSCRIBE] Error parseando postData.contents:', err.toString());
      }
    }
    
    // Método 3: Construir desde params individuales (form-urlencoded expandido)
    if (!sub && params.endpoint) {
      sub = { 
        endpoint: params.endpoint, 
        keys: { 
          p256dh: params.p256dh || '', 
          auth: params.auth || '' 
        } 
      };
      console.log('[SUBSCRIBE] Método 3 - params individuales:', sub.endpoint.substring(0, 60));
    }
    
    if (!sub || !sub.endpoint) {
      console.error('[SUBSCRIBE] No se pudo extraer suscripción de la petición');
      return crearRespuestaJSON({ success: false, message: 'Endpoint requerido' });
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('suscripciones');
    if (!sheet) {
      sheet = ss.insertSheet('suscripciones');
      sheet.appendRow(['endpoint','p256dh','auth','subscription_json','created_at']);
      console.log('[SUBSCRIBE] Hoja suscripciones creada');
    }
    
    var p256dh = (sub.keys && sub.keys.p256dh) ? sub.keys.p256dh : '';
    var auth   = (sub.keys && sub.keys.auth)   ? sub.keys.auth   : '';
    var rows   = sheet.getDataRange().getValues();
    
    // Buscar si ya existe
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === sub.endpoint) {
        sheet.getRange(i+1,1,1,4).setValues([[sub.endpoint, p256dh, auth, JSON.stringify(sub)]]);
        console.log('[SUBSCRIBE] Suscripción actualizada en fila', i+1);
        return crearRespuestaJSON({ success: true, message: 'Suscripcion actualizada' });
      }
    }
    
    // No existe, agregar nueva
    sheet.appendRow([sub.endpoint, p256dh, auth, JSON.stringify(sub), getFormattedDateTime()]);
    console.log('[SUBSCRIBE] Nueva suscripción guardada');
    return crearRespuestaJSON({ success: true, message: 'Suscripcion guardada' });
  } catch(err) { 
    console.error('[SUBSCRIBE] Error:', err.toString());
    return crearRespuestaError(err); 
  }
}

// ============================================
// Eliminar suscripcion
// ============================================
function eliminarSuscripcion(params) {
  try {
    var endpoint = params.endpoint;
    if (!endpoint) return crearRespuestaJSON({ success: false, message: 'Endpoint requerido' });
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('suscripciones');
    if (sheet) {
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] === endpoint) { sheet.deleteRow(i+1); break; }
      }
    }
    return crearRespuestaJSON({ success: true, message: 'Suscripcion eliminada' });
  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// Listar suscripciones (debug)
// ============================================
function listarSuscripciones() {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('suscripciones');
    if (!sheet) return crearRespuestaJSON({ success: true, count: 0, subscriptions: [] });
    var rows = sheet.getDataRange().getValues();
    var subs = rows.slice(1).map(function(r) {
      return { endpoint: r[0].toString().substring(0,60)+'...', created: r[4] };
    });
    return crearRespuestaJSON({ success: true, count: subs.length, subscriptions: subs });
  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// ENVIO A TODOS  — rápido y sin cifrado pesado
// ============================================
function enviarNotificacionATodos(params) {
  var title = params.title || 'Notificacion';
  var body  = params.body  || 'Mensaje nuevo';
  var icon  = params.icon  || '';

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Leer claves VAPID
    var vapidSheet = ss.getSheetByName('vapid_keys');
    if (!vapidSheet)
      return crearRespuestaJSON({ success: false, error: 'No hay hoja vapid_keys' });
    var vapidData = vapidSheet.getDataRange().getValues();
    if (vapidData.length < 2)
      return crearRespuestaJSON({ success: false, error: 'Sin claves VAPID' });
    var vapidPub  = vapidData[1][0].toString().trim();
    var vapidPriv = vapidData[1][1].toString().trim();
    if (!vapidPub || !vapidPriv)
      return crearRespuestaJSON({ success: false, error: 'Necesitas clave publica (A2) y privada (B2) en vapid_keys.' });

    // Leer suscripciones
    var subsSheet = ss.getSheetByName('suscripciones');
    if (!subsSheet)
      return crearRespuestaJSON({ success: false, error: 'No hay hoja suscripciones' });
    var subsData = subsSheet.getDataRange().getValues();
    if (subsData.length < 2)
      return crearRespuestaJSON({ success: true, message: 'Sin suscriptores', sent: 0 });

    // Payload JSON que el Service Worker leerá con event.data.json()
    // Incluir todos los campos extra que vengan en params (notifType, lote, planta, etc.)
    var payloadObj = {
      id:        Utilities.getUuid(),
      title:     title,
      body:      body,
      icon:      icon,
      timestamp: Date.now()
    };
    // Copiar campos extra (notifType, lote, planta, idNovedad, estadoActual, etc.)
    var reservados = { action:1, title:1, body:1, icon:1, data:1, p256dh:1, auth:1, endpoint:1 };
    for (var k in params) {
      if (!reservados[k] && params[k] !== undefined && params[k] !== '') {
        payloadObj[k] = params[k];
      }
    }
    // Si viene un campo 'data' JSON con campos extra, expandirlo también
    if (params.data) {
      try {
        var extra = JSON.parse(params.data);
        for (var ek in extra) {
          if (!reservados[ek]) payloadObj[ek] = extra[ek];
        }
      } catch(_) {}
    }
    var payloadJson = JSON.stringify(payloadObj);
    
    // Verificar tamaño del payload (límite típico: 4KB)
    if (payloadJson.length > 4000) {
      console.warn('[PUSH] Payload muy grande (' + payloadJson.length + ' bytes), truncando...');
      // Truncar body si es muy largo
      if (payloadObj.body && payloadObj.body.length > 100) {
        payloadObj.body = payloadObj.body.substring(0, 100) + '...';
        payloadJson = JSON.stringify(payloadObj);
      }
    }
    
    console.log('[PUSH] Payload size:', payloadJson.length, 'bytes');

    // Guardar última notificación para PULL (iOS)
    PropertiesService.getScriptProperties().setProperty('LAST_NOTIFICATION', payloadJson);

    // Pre-calcular el JWT una sola vez — sirve para todos los envíos
    // Nota: audience cambia por endpoint, así que calculamos por dominio
    var sent = 0, failed = 0, expired = 0, errors = [];
    var jwtCache = {}; // cache de JWT por audience para no recalcular (en memoria)
    var persistentCache = CacheService.getScriptCache(); // cache persistente entre ejecuciones

    // Enviar en paralelo con UrlFetchApp.fetchAll (mucho más rápido)
    var requests  = [];
    var validRows = [];

    for (var i = 1; i < subsData.length; i++) {
      try {
        var subJson = subsData[i][3];
        if (!subJson) continue;
        var sub;
        try { sub = JSON.parse(subJson); } catch(pe) { continue; }
        if (!sub || !sub.endpoint) continue;

        var endpoint = sub.endpoint;
        var audienceMatch = endpoint.match(/^(https?:\/\/[^\/]+)/);
        var audience = audienceMatch ? audienceMatch[1] : '';

        // Reusar JWT si mismo audience (primero de caché persistente, luego calcular)
        if (!jwtCache[audience]) {
          var cacheKey = 'jwt_' + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, Utilities.newBlob(audience)).slice(0, 8).map(function(b){return(b<0?b+256:b).toString(16).padStart(2,'0');}).join('');
          var cachedJwt = persistentCache.get(cacheKey);
          
          if (cachedJwt) {
            jwtCache[audience] = cachedJwt;
            console.log('JWT recuperado de caché para:', audience.substring(0, 30));
          } else {
            jwtCache[audience] = crearJWT(audience, vapidPub, vapidPriv);
            persistentCache.put(cacheKey, jwtCache[audience], 3600); // 1 hora
            console.log('JWT creado y cacheado para:', audience.substring(0, 30));
          }
        }
        var jwt = jwtCache[audience];
        
        // Detectar si es endpoint de Apple o Mozilla
        var isApple = endpoint.indexOf('apple.com') >= 0 || endpoint.indexOf('web.push.apple.com') >= 0;
        var isMozilla = endpoint.indexOf('mozilla.com') >= 0 || endpoint.indexOf('firefox') >= 0 || endpoint.indexOf('updates.push.services.mozilla.com') >= 0;
        var isChrome = endpoint.indexOf('fcm.googleapis.com') >= 0 || endpoint.indexOf('android.googleapis.com') >= 0;

        var request = {
          url: endpoint,
          method: 'post',
          muteHttpExceptions: true,
          timeout: 5, // 5 segundos máximo por endpoint
          headers: {
            'Authorization': 'vapid t=' + jwt + ', k=' + vapidPub,
            'TTL':           '86400',
            'Urgency':       'high'
          }
        };

        // ESTRATEGIA: Enviar tickle vacío a TODOS los endpoints
        // El SW hará polling para obtener el contenido real
        // Esto evita problemas de encriptación y formato
        // NO establecer Content-Length manualmente (GAS lo maneja automáticamente)
        request.payload = '';
        
        var endpointType = isApple ? 'iOS/Safari' : (isMozilla ? 'Firefox' : (isChrome ? 'Chrome/Android' : 'Desconocido'));
        console.log('Enviando tickle a ' + endpointType + ' | Endpoint:', endpoint.substring(0, 60));

        requests.push(request);
        validRows.push(i); // guardar índice de fila para saber qué borrar si 410

      } catch(rowErr) {
        failed++;
        errors.push('Fila ' + i + ': ' + rowErr.toString());
      }
    }

    if (requests.length === 0)
      return crearRespuestaJSON({ success: true, message: 'Sin suscripciones validas', sent: 0 });

    // ⭐ fetchAll: envía todos en paralelo — mucho más rápido que uno a uno
    var responses = UrlFetchApp.fetchAll(requests);

    // Procesar respuestas — iterar en reversa para borrar filas sin desplazar índices
    var toDelete = [];
    for (var j = 0; j < responses.length; j++) {
      var code = responses[j].getResponseCode();
      var rowIdx = validRows[j];
      var endpoint = subsData[rowIdx][0].toString();
      var endpointPreview = endpoint.substring(0, 80);
      
      // Detectar tipo de endpoint para logging
      var isAppleEndpoint = endpoint.indexOf('apple.com') >= 0 || endpoint.indexOf('web.push.apple.com') >= 0;
      var isMozillaEndpoint = endpoint.indexOf('mozilla.com') >= 0 || endpoint.indexOf('firefox') >= 0 || endpoint.indexOf('updates.push.services.mozilla.com') >= 0;
      var endpointType = isAppleEndpoint ? 'iOS/Safari' : (isMozillaEndpoint ? 'Firefox' : 'Chrome/Android');
      
      console.log('Fila ' + rowIdx + ' | ' + endpointType + ' | HTTP ' + code + ' | ' + endpointPreview);

      if (code === 200 || code === 201 || code === 202) {
        sent++;
        console.log('  ✅ Enviado exitosamente');
      } else if (code === 410) {
        // 410 = Gone: endpoint expirado confirmado → marcar para borrar
        expired++;
        toDelete.push(rowIdx);
        console.log('  ⚠️ Endpoint expirado (410), será eliminado');
      } else if (code === 400) {
        // 400 = Bad Request: puede ser formato inválido o suscripción corrupta
        failed++;
        var errorText = responses[j].getContentText().substring(0, 200);
        errors.push('HTTP 400 (' + endpointType + ') en fila ' + rowIdx + ': ' + errorText);
        console.log('  ❌ Error 400 (' + endpointType + '): ' + errorText);
        console.log('  💡 SOLUCIÓN: Eliminar esta suscripción y volver a suscribirse desde ese dispositivo');
        // NO borrar automáticamente, dejar que el usuario lo haga manualmente
      } else {
        // Cualquier otro error → NO borrar, solo registrar
        failed++;
        var errorText = responses[j].getContentText().substring(0, 200);
        errors.push('HTTP ' + code + ' (' + endpointType + ') en fila ' + rowIdx + ': ' + errorText);
        console.log('  ❌ Error (' + endpointType + '): ' + errorText);
      }
    }

    // Borrar filas expiradas en reversa (para no desplazar índices)
    toDelete.sort(function(a,b){return b-a;});
    for (var d = 0; d < toDelete.length; d++) {
      subsSheet.deleteRow(toDelete[d] + 1);
    }

    var msg = 'Enviadas: ' + sent + ' | Fallidas: ' + failed + ' | Expiradas: ' + expired;
    console.log(msg);
    if (errors.length > 0) console.log('Errores:', errors.join(' | '));

    return crearRespuestaJSON({
      success: true,
      message: msg,
      sent: sent, failed: failed, expired: expired,
      errors: errors.slice(0, 5)
    });

  } catch(err) { return crearRespuestaError(err); }
}

// ============================================
// JWT VAPID (alg: ES256)
// ============================================
function crearJWT(audience, vapidPub, vapidPriv) {
  var now     = Math.floor(Date.now() / 1000);
  var header  = b64uEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  var payload = b64uEncode(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: 'mailto:admin@pwa-notificaciones.com'
  }));
  var sigInput = header + '.' + payload;
  var privBytes = b64uToBytes(vapidPriv);
  return sigInput + '.' + firmarES256(sigInput, privBytes);
}

// ============================================
// ECDSA P-256  (sin BigInt)
// ============================================
var CP  = [0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF];
var CN  = [0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xBC,0xE6,0xFA,0xAD,0xA7,0x17,0x9E,0x84,0xF3,0xB9,0xCA,0xC2,0xFC,0x63,0x25,0x51];
var CGX = [0x6B,0x17,0xD1,0xF2,0xE1,0x2C,0x42,0x47,0xF8,0xBC,0xE6,0xE5,0x63,0xA4,0x40,0xF2,0x77,0x03,0x7D,0x81,0x2D,0xEB,0x33,0xA0,0xF4,0xA1,0x39,0x45,0xD8,0x98,0xC2,0x96];
var CGY = [0x4F,0xE3,0x42,0xE2,0xFE,0x1A,0x7F,0x9B,0x8E,0xE7,0xEB,0x4A,0x7C,0x0F,0x9E,0x16,0x2B,0xCE,0x33,0x57,0x6B,0x31,0x5E,0xCE,0xCB,0xB6,0x40,0x68,0x37,0xBF,0x51,0xF5];
var CA  = [0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFC];

function n0(){return new Array(32).fill(0);}
function n1(){var a=n0();a[31]=1;return a;}
function n2(){var a=n0();a[31]=2;return a;}
function nc(a){return a.slice(0,32);}
function ncmp(a,b){for(var i=0;i<32;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}return 0;}
function nz(a){for(var i=0;i<32;i++){if(a[i])return false;}return true;}
function nlsb(a){return a[31]&1;}
function nshr1(a){var r=new Array(32),c=0;for(var i=0;i<32;i++){r[i]=((a[i]>>1)|c)&0xFF;c=(a[i]&1)<<7;}return r;}
function nadd(a,b){var r=new Array(32),c=0;for(var i=31;i>=0;i--){var s=a[i]+b[i]+c;r[i]=s&0xFF;c=s>>8;}return[r,c];}
function nsub(a,b){var r=new Array(32),bw=0;for(var i=31;i>=0;i--){var d=a[i]-b[i]-bw;if(d<0){d+=256;bw=1;}else{bw=0;}r[i]=d;}return r;}
function mA(a,b,m){var t=nadd(a,b);var r=t[0],c=t[1];if(c||ncmp(r,m)>=0)r=nsub(r,m);return r;}
function mS(a,b,m){if(ncmp(a,b)>=0)return nsub(a,b);return nsub(nadd(a,m)[0],b);}
function mM(a,b,m){var R=n0(),ad=nc(a);for(var bi=31;bi>=0;bi--){for(var bt=0;bt<8;bt++){if((b[bi]>>bt)&1)R=mA(R,ad,m);ad=mA(ad,ad,m);}}return R;}
function mPw(base,exp,m){var R=n1(),b=nc(base),e=nc(exp);while(!nz(e)){if(nlsb(e))R=mM(R,b,m);b=mM(b,b,m);e=nshr1(e);}return R;}
function mI(a,m){return mPw(a,nsub(m,n2()),m);}
function pCp(P){if(!P)return null;return{x:nc(P.x),y:nc(P.y)};}
function pDb(P){
  if(!P)return null;if(nz(P.y))return null;
  var x2=mM(P.x,P.x,CP),num=mA(mA(x2,x2,CP),x2,CP);num=mA(num,CA,CP);
  var den=mA(P.y,P.y,CP),m=mM(num,mI(den,CP),CP),m2=mM(m,m,CP);
  var x3=mS(mS(m2,P.x,CP),P.x,CP),y3=mS(mM(m,mS(P.x,x3,CP),CP),P.y,CP);
  return{x:x3,y:y3};
}
function pAd(P,Q){
  if(!P)return pCp(Q);if(!Q)return pCp(P);
  if(ncmp(P.x,Q.x)===0){if(ncmp(P.y,Q.y)!==0)return null;return pDb(P);}
  var num=mS(Q.y,P.y,CP),den=mS(Q.x,P.x,CP),m=mM(num,mI(den,CP),CP);
  var m2=mM(m,m,CP),x3=mS(mS(m2,P.x,CP),Q.x,CP),y3=mS(mM(m,mS(P.x,x3,CP),CP),P.y,CP);
  return{x:x3,y:y3};
}
function pMl(k,G){
  var R=null,ad=pCp(G),sc=nc(k);
  for(var bi=31;bi>=0;bi--){for(var bt=0;bt<8;bt++){if((sc[bi]>>bt)&1)R=pAd(R,ad);ad=pDb(ad);}}
  return R;
}

function sha256b(msg) {
  var bytes=Utilities.newBlob(msg).getBytes().map(function(b){return b<0?b+256:b;});
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)
    .map(function(b){return b<0?b+256:b;});
}

function genK(hash,priv) {
  var combined=hash.concat(priv);
  var k=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,combined)
    .map(function(b){return b<0?b+256:b;});
  if(ncmp(k,CN)>=0)k=nsub(k,CN);
  if(nz(k))k[31]=1;
  return k;
}

function firmarES256(message, privBytes) {
  var hash=sha256b(message);
  var G={x:CGX,y:CGY};
  var k=genK(hash,privBytes);
  var R=pMl(k,G);
  var r=nc(R.x);
  if(ncmp(r,CN)>=0)r=nsub(r,CN);
  var s=mM(mI(k,CN),mA(hash,mM(r,privBytes,CN),CN),CN);
  var nh=nshr1(CN);
  if(ncmp(s,nh)>0)s=nsub(CN,s);
  return b64uFromBytes(r.concat(s));
}

// ============================================
// Base64URL
// ============================================
function b64uEncode(str) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(str).getBytes()).replace(/=+$/,'');
}
function b64uToBytes(b64u) {
  var b64=b64u.replace(/-/g,'+').replace(/_/g,'/');
  var pad='='.repeat((4-b64.length%4)%4);
  return Utilities.base64Decode(b64+pad).map(function(b){return b<0?b+256:b;});
}
function b64uFromBytes(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}

// ============================================
// TEST — ejecutar desde el editor GAS
// ============================================
function testEnviar() {
  var r = enviarNotificacionATodos({ title: 'Prueba rapida', body: 'Llega en iOS y Android', icon: '' });
  console.log(r.getContent ? r.getContent() : JSON.stringify(r));
}

// Test manual mejorado con diagnóstico completo
function testPushManual() {
  console.log('=== INICIANDO TEST DE PUSH NOTIFICATIONS ===');
  
  // 1. Verificar hoja de suscripciones
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('suscripciones');
  if (!sheet) {
    console.error('❌ No existe la hoja suscripciones');
    return;
  }
  
  var rows = sheet.getDataRange().getValues();
  console.log('📊 Total suscripciones:', rows.length - 1);
  
  // 2. Analizar cada suscripción
  for (var i = 1; i < rows.length; i++) {
    var endpoint = rows[i][0].toString();
    var isApple = endpoint.indexOf('apple.com') >= 0 || endpoint.indexOf('web.push.apple.com') >= 0;
    var isMozilla = endpoint.indexOf('mozilla.com') >= 0 || endpoint.indexOf('firefox') >= 0 || endpoint.indexOf('updates.push.services.mozilla.com') >= 0;
    var tipo = isApple ? '🍎 iOS/Safari' : (isMozilla ? '🦊 Firefox' : '🤖 Chrome/Android');
    
    console.log('\nSuscripción ' + i + ' ' + tipo);
    console.log('  Endpoint:', endpoint.substring(0, 70) + '...');
    console.log('  p256dh:', rows[i][1] ? '✅ Presente' : '❌ FALTA');
    console.log('  auth:', rows[i][2] ? '✅ Presente' : '❌ FALTA');
  }
  
  // 3. Enviar notificación de prueba
  console.log('\n=== ENVIANDO NOTIFICACIÓN DE PRUEBA ===');
  var result = enviarNotificacionATodos({
    title: '🧪 Test Manual',
    body: 'Prueba de notificaciones push',
    icon: ''
  });
  
  console.log('\n=== RESULTADO ===');
  console.log(result.getContent ? result.getContent() : JSON.stringify(result));
}

// Test para ver qué codigo HTTP devuelve cada endpoint
function testDiagnostico() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('suscripciones');
  if (!sheet) { console.log('No hay hoja suscripciones'); return; }
  var rows = sheet.getDataRange().getValues();
  console.log('=== DIAGNÓSTICO DE SUSCRIPCIONES ===');
  console.log('Total suscripciones: ' + (rows.length - 1));
  console.log('');
  
  for (var i = 1; i < rows.length; i++) {
    var endpoint = rows[i][0].toString();
    var p256dh = rows[i][1];
    var auth = rows[i][2];
    
    var isApple = endpoint.indexOf('apple.com') >= 0 || endpoint.indexOf('web.push.apple.com') >= 0;
    var isMozilla = endpoint.indexOf('mozilla.com') >= 0 || endpoint.indexOf('firefox') >= 0 || endpoint.indexOf('updates.push.services.mozilla.com') >= 0;
    var isChrome = endpoint.indexOf('fcm.googleapis.com') >= 0 || endpoint.indexOf('android.googleapis.com') >= 0;
    var tipo = isApple ? '🍎 iOS/Safari' : (isMozilla ? '🦊 Firefox' : (isChrome ? '🤖 Chrome/Android' : '❓ Desconocido'));
    
    console.log('Fila ' + i + ' - ' + tipo);
    console.log('  Endpoint: ' + endpoint.substring(0,70) + '...');
    console.log('  p256dh: ' + (p256dh ? '✅ ' + p256dh.toString().substring(0,20)+'...' : '❌ VACIO'));
    console.log('  auth: ' + (auth ? '✅ ' + auth.toString().substring(0,15)+'...' : '❌ VACIO'));
    console.log('');
  }
  
  console.log('=== RECOMENDACIÓN ===');
  console.log('Si alguna fila tiene p256dh o auth VACIO, eliminar esa fila y volver a suscribirse desde ese dispositivo.');
  console.log('');
  console.log('Para probar el envío, ejecuta: testPushManual()');
}


