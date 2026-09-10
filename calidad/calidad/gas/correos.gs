// ================================================================
// Google Apps Script — Email Sender para GRUPO TDM
// Publicar como Web App: Ejecutar como "Yo" / Acceso "Cualquiera"
// SIN reintentos: si falla, retorna error inmediatamente
// ================================================================

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Parsear el body JSON enviado por la Edge Function
    var body = JSON.parse(e.postData.contents);

    var to         = (body.to         || "").trim();
    var subject    = (body.subject    || "Sin asunto").trim();
    var html       = body.html        || "";
    var senderName = body.senderName  || "GRUPO TDM";
    var attachHtml = body.attachmentHtml || "";  // adjunto opcional

    // Validación básica — NO reintentar, simplemente rechazar
    if (!to || to.indexOf("@") === -1) {
      output.setContent(JSON.stringify({
        success: false,
        error: "Destinatario inválido: " + to
      }));
      return output;
    }

    if (!html && !subject) {
      output.setContent(JSON.stringify({
        success: false,
        error: "El mensaje no puede estar vacío"
      }));
      return output;
    }

    // Construir opciones de envío
    var mailOptions = {
      htmlBody: html,
      name: senderName,
      noReply: false
    };

    // Si viene adjunto HTML → añadirlo como reporte.html
    if (attachHtml) {
      var blob = Utilities.newBlob(attachHtml, 'text/html', 'reporte.html');
      mailOptions.attachments = [blob];
    }

    // Enviar SIN reintentos — un solo intento
    GmailApp.sendEmail(to, subject, "", mailOptions);

    output.setContent(JSON.stringify({
      success: true,
      message: "Email enviado a " + to
    }));

  } catch (err) {
    // Capturar cualquier error (dirección inválida, cuota, etc.) y retornar SIN reintentar
    output.setContent(JSON.stringify({
      success: false,
      error: String(err.message || err)
    }));
  }

  return output;
}

// Prueba manual desde el editor de GAS
function testEmail() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        to: "nixandres2@gmail.com",
        subject: "Test desde GAS",
        html: "<h1>Prueba</h1><p>Email de prueba GRUPO TDM</p>",
        senderName: "GRUPO TDM"
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}