/**
 * Google Apps Script - Servicio de Notificaciones Email
 * Maneja el envío de correos con plantillas profesionales para el Grupo TDM
 */

const SUPABASE_URL = 'https://doqsurxxxaudnutsydlk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcyMTEwNSwiZXhwIjoyMDkxMjk3MTA1fQ.9Jnrogfmdn9PJdBbQ5QbUbgArQL75hG26VPVv1ez5AE';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { accion, email, nombre, idNovedad, lote, referencia, nuevoEstado, mensaje } = data;
    
    if (!email) throw new Error('Email es requerido');
    
    let subject = '';
    let htmlBody = '';
    
    switch (accion) {
      case 'CHAT_INICIADO':
        subject = `Nuevo chat iniciado - Novedad ${idNovedad}`;
        htmlBody = generateNotificationHTML({
          titulo: 'Nuevo Chat Iniciado',
          nombre: nombre,
          subtitulo: `Se ha iniciado una conversación para la novedad ${idNovedad}.`,
          detalles: `<strong>Lote:</strong> ${lote || 'N/A'}<br><strong>Referencia:</strong> ${referencia || 'N/A'}`,
          cuerpo: 'Un agente del Grupo TDM ha iniciado un chat para resolver dudas sobre este reporte. Por favor, ingrese al sistema para responder.',
          botonTexto: 'IR AL CHAT',
          botonUrl: 'https://andres1-dev.github.io/three/public/index.html'
        });
        break;
        
      case 'CHAT_FINALIZADO':
        subject = `Chat finalizado - Novedad ${idNovedad}`;
        htmlBody = generateNotificationHTML({
          titulo: 'Chat Finalizado',
          nombre: nombre,
          subtitulo: `La conversación para la novedad ${idNovedad} ha sido cerrada.`,
          detalles: `<strong>Lote:</strong> ${lote || 'N/A'}<br><strong>Referencia:</strong> ${referencia || 'N/A'}`,
          cuerpo: 'El chat ha sido finalizado y archivado. Si tiene dudas adicionales, por favor reporte una nueva novedad.',
          botonTexto: 'VER REPORTE',
          botonUrl: 'https://andres1-dev.github.io/three/public/index.html'
        });
        break;
        
      case 'NOVEDAD_RESUELTA':
        subject = `Novedad Resuelta - ${idNovedad}`;
        htmlBody = generateNotificationHTML({
          titulo: 'Novedad Resuelta',
          nombre: nombre,
          subtitulo: `La novedad ${idNovedad} ha sido marcada como RESUELTA.`,
          detalles: `<strong>Lote:</strong> ${lote || 'N/A'}<br><strong>Acción:</strong> Resolución Técnica Aplicada`,
          cuerpo: 'Le informamos que el reporte ha sido procesado exitosamente por nuestro equipo de calidad/producción.',
          botonTexto: 'VER DETALLES',
          botonUrl: 'https://andres1-dev.github.io/three/public/index.html'
        });
        break;
        
      case 'CAMBIO_ESTADO':
        subject = `Actualización de Estado - Novedad ${idNovedad}`;
        htmlBody = generateNotificationHTML({
          titulo: 'Actualización de Estado',
          nombre: nombre,
          subtitulo: `El estado de su novedad ${idNovedad} ha cambiado.`,
          detalles: `<strong>Nuevo Estado:</strong> <span style="color:#3f51b5; font-weight:bold;">${nuevoEstado}</span>`,
          cuerpo: `Su reporte se encuentra ahora en estado: ${nuevoEstado}. Seguiremos informándole sobre el avance.`,
          botonTexto: 'VER SEGUIMIENTO',
          botonUrl: 'https://andres1-dev.github.io/three/public/index.html'
        });
        break;
        
      default:
        throw new Error('Acción no reconocida');
    }
    
    GmailApp.sendEmail(email, subject, '', {
      htmlBody: htmlBody,
      name: 'Grupo TDM - Notificaciones'
    });
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Correo enviado' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generador de HTML basado en la plantilla del sistema
 */
function generateNotificationHTML(params) {
  const { titulo, nombre, subtitulo, detalles, cuerpo, botonTexto, botonUrl } = params;
  
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { padding: 30px; text-align: center; border-bottom: 1px solid #F1F5F9; }
        .body { padding: 40px; text-align: center; }
        .title { font-size: 22px; font-weight: 700; color: #1E293B; margin-bottom: 10px; }
        .user-name { font-size: 18px; font-weight: 600; color: #3F51B5; margin-bottom: 20px; }
        .message { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 30px; }
        .info-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: left; }
        .info-title { font-size: 12px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em; }
        .info-content { font-size: 14px; color: #1E293B; }
        .btn { display: inline-block; padding: 14px 36px; background: #1E293B; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .footer { padding: 25px; background: #F8FAFC; font-size: 12px; color: #94A3B8; text-align: center; border-top: 1px solid #F1F5F9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://lh3.googleusercontent.com/d/1ut0pgWZJ1nGr2EaS2-gtJwCftVILMJO4" alt="Grupo TDM" width="180">
        </div>
        <div class="body">
            <div class="title">${titulo}</div>
            <div class="user-name">Hola, ${nombre}</div>
            <div class="message">${subtitulo}</div>
            
            <div class="info-box">
                <div class="info-title">Detalles del Reporte</div>
                <div class="info-content">${detalles}</div>
            </div>
            
            <p class="message" style="margin-bottom: 40px;">${cuerpo}</p>
            
            <a href="${botonUrl}" class="btn">${botonTexto}</a>
        </div>
        <div class="footer">
            © ${new Date().getFullYear()} Grupo TDM - Sistema de Gestión Operativa<br>
            Este es un mensaje automático, por favor no responda.
        </div>
    </div>
</body>
</html>
  `;
}
