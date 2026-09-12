// ================================================================
// Google Apps Script — Email Sender para GRUPO TDM
// Publicar como Web App: Ejecutar como "Yo" / Acceso "Cualquiera"
// SIN reintentos: si falla, retorna error inmediatamente
// ================================================================

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var body = JSON.parse(e.postData.contents);

    var to         = (body.to         || "").trim();
    var subject    = (body.subject    || "Sin asunto").trim();
    var html       = body.html        || "";
    var senderName = body.senderName  || "GRUPO TDM";
    var attachHtml = body.attachmentHtml || "";
    var attachName = (body.attachmentName || "reporte.pdf").trim();

    // Validación básica
    if (!to || to.indexOf("@") === -1) {
      output.setContent(JSON.stringify({ success: false, error: "Destinatario inválido: " + to }));
      return output;
    }

    if (!html && !subject) {
      output.setContent(JSON.stringify({ success: false, error: "El mensaje no puede estar vacío" }));
      return output;
    }

    var mailOptions = {
      htmlBody: html,
      name: senderName,
      noReply: false
    };

    // Si viene HTML del reporte → convertir a PDF y adjuntar ÚNICAMENTE el PDF con nombre {radicado}.pdf
    if (attachHtml) {
      // Remover prefijo 'reporte_' y extensiones para obtener sólo el número de radicado
      var radicado = attachName.replace(/\.(html?|pdf)$/i, '').replace(/^reporte_/i, '').trim() || "reporte";
      var pdfName  = radicado + '.pdf';

      var htmlBlob = Utilities.newBlob(attachHtml, 'text/html', radicado + '.html');
      var pdfBlob  = null;

      try {
        // Intento 1: Conversión directa de Blob en GAS
        pdfBlob = htmlBlob.getAs('application/pdf').setName(pdfName);
      } catch (e1) {
        try {
          // Intento 2: Archivo temporal en Drive con tempFile.getAs
          var tempFile = DriveApp.createFile(htmlBlob);
          pdfBlob = tempFile.getAs('application/pdf').setName(pdfName);
          tempFile.setTrashed(true);
        } catch (e2) {
          console.warn("No fue posible generar el PDF adjunto: " + e2);
        }
      }

      // Adjuntar ÚNICAMENTE el PDF (o fallback a html si fallara críticamente la conversión)
      if (pdfBlob && pdfBlob.getBytes().length > 0) {
        mailOptions.attachments = [pdfBlob];
      } else {
        mailOptions.attachments = [htmlBlob.setName(radicado + '.html')];
      }
    }

    GmailApp.sendEmail(to, subject, "", mailOptions);

    output.setContent(JSON.stringify({ success: true, message: "Email enviado a " + to }));

  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: String(err.message || err) }));
  }

  return output;
}

// Prueba manual desde el editor de GAS
function testEmail() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        to: "nixandres2@gmail.com",
        subject: "Test PDF desde GAS",
        html: "<h1>Prueba</h1><p>Email de prueba GRUPO TDM</p>",
        senderName: "GRUPO TDM",
        attachmentHtml: "<html><body><h1>Reporte de Calidad</h1><p>Contenido de prueba</p></body></html>",
        attachmentName: "reporte_prueba.pdf"
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
