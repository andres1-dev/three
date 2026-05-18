/**
 * Google Apps Script para Sistema de Reseteo de Contraseña
 * Maneja todo el flujo: validación, generación de tokens, envío de correos y actualización de contraseñas
 */

// Configuración de Supabase
const SUPABASE_URL = 'https://doqsurxxxaudnutsydlk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcyMTEwNSwiZXhwIjoyMDkxMjk3MTA1fQ.9Jnrogfmdn9PJdBbQ5QbUbgArQL75hG26VPVv1ez5AE';

// URL de la aplicación (cambiar en producción)
const APP_URL = 'http://andres1-dev.github.io/three/public/reset';

function doPost(e) {
  try {
    // Leer datos de FormData o JSON
    let data;
    if (e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else {
      // FormData
      data = e.parameter;
    }
    
    const { action } = data;
    
    let result;
    if (action === 'SOLICITAR_RESETEO') {
      result = solicitarReseteo(data);
    } else if (action === 'CONFIRMAR_RESETEO') {
      result = confirmarReseteo(data);
    } else {
      result = createResponse(false, 'Acción no válida');
    }
    
    // Agregar headers CORS
    return addCorsHeaders(result);
    
  } catch (error) {
    Logger.log('Error en doPost: ' + error.toString());
    return addCorsHeaders(createResponse(false, error.toString()));
  }
}

function doGet(e) {
  const response = ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Password Reset Service is running',
    version: '1.0.0'
  })).setMimeType(ContentService.MimeType.JSON);
  
  return addCorsHeaders(response);
}

/**
 * Agregar headers CORS a la respuesta
 */
function addCorsHeaders(response) {
  return response
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Solicitar reseteo de contraseña
 */
function solicitarReseteo(data) {
  const { id, hoja } = data;
  
  if (!id || !hoja) {
    return createResponse(false, 'Faltan parámetros requeridos');
  }
  
  try {
    // Buscar usuario en Supabase
    const tableName = hoja === 'PLANTAS' ? 'PLANTAS' : 'USUARIOS';
    const idField = hoja === 'PLANTAS' ? 'ID_PLANTA' : 'ID_USUARIO';
    const emailField = hoja === 'PLANTAS' ? 'EMAIL' : 'CORREO';
    const nameField = hoja === 'PLANTAS' ? 'PLANTA' : 'USUARIO';
    const passwordField = hoja === 'PLANTAS' ? 'PASSWORD' : 'CONTRASEÑA';
    
    const url = `${SUPABASE_URL}/rest/v1/${tableName}?${idField}=eq.${id}&select=*`;
    
    Logger.log('URL de consulta: ' + url);
    
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    Logger.log('Response code: ' + response.getResponseCode());
    Logger.log('Response body: ' + response.getContentText());
    
    const users = JSON.parse(response.getContentText());
    
    Logger.log('Usuarios encontrados: ' + JSON.stringify(users));
    
    if (!users || users.length === 0) {
      return createResponse(false, 'No se encontró una cuenta con esta identificación.');
    }
    
    const userData = users[0];
    const userEmail = userData[emailField];
    
    Logger.log('Email del usuario: ' + userEmail);
    
    if (!userEmail) {
      return createResponse(false, 'Esta cuenta no tiene un correo electrónico asociado.');
    }
    
    // Generar token seguro
    const token = Utilities.getUuid().replace(/-/g, '') + Date.now();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // Guardar token en Supabase (table_name en minúsculas para el constraint)
    const tokenUrl = `${SUPABASE_URL}/rest/v1/RESTABLECER`;
    const tokenResponse = UrlFetchApp.fetch(tokenUrl, {
      method: 'post',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify({
        user_id: String(id),
        table_name: tableName.toLowerCase(), // Convertir a minúsculas para el constraint
        token: token,
        expires_at: expiresAt,
        email: userEmail
      }),
      muteHttpExceptions: true
    });
    
    if (tokenResponse.getResponseCode() !== 201) {
      Logger.log('Error guardando token: ' + tokenResponse.getContentText());
      return createResponse(false, 'Error al generar el token de recuperación.');
    }
    
    // Generar URL de reseteo
    const resetUrl = `${APP_URL}/reset.html?token=${encodeURIComponent(token)}`;
    
    // Enviar correo
    const userName = userData[nameField] || 'Usuario';
    const emailHtml = generateResetEmailHTML(userName, id, resetUrl);
    
    Logger.log('Enviando correo a: ' + userEmail);
    
    GmailApp.sendEmail(userEmail, 'Restablecimiento de contraseña - Grupo TDM', '', {
      htmlBody: emailHtml,
      name: 'Grupo TDM'
    });
    
    Logger.log('Correo enviado exitosamente');
    
    return createResponse(true, `Enlace enviado a ${userEmail}`);
    
  } catch (error) {
    Logger.log('Error en solicitarReseteo: ' + error.toString());
    return createResponse(false, 'Error al procesar la solicitud: ' + error.toString());
  }
}

/**
 * Confirmar reseteo y actualizar contraseña
 */
function confirmarReseteo(data) {
  const { token, newPassword } = data;
  
  if (!token || !newPassword) {
    return createResponse(false, 'Faltan parámetros requeridos');
  }
  
  try {
    // Buscar token en Supabase
    const tokenUrl = `${SUPABASE_URL}/rest/v1/RESTABLECER?token=eq.${token}&used=eq.false&select=*`;
    const response = UrlFetchApp.fetch(tokenUrl, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      muteHttpExceptions: true
    });
    
    const tokens = JSON.parse(response.getContentText());
    
    if (!tokens || tokens.length === 0) {
      return createResponse(false, 'El código es inválido o ya expiró.');
    }
    
    const tokenData = tokens[0];
    
    // Verificar expiración
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return createResponse(false, 'El código ha expirado. Solicite uno nuevo.');
    }
    
    // Actualizar contraseña
    const tableName = tokenData.table_name.toUpperCase(); // Convertir a mayúsculas para las tablas reales
    const userId = tokenData.user_id;
    const passwordField = 'CONTRASEÑA'; // Ambas tablas usan CONTRASEÑA
    const idField = tableName === 'PLANTAS' ? 'ID_PLANTA' : 'ID_USUARIO';
    
    const updateUrl = `${SUPABASE_URL}/rest/v1/${tableName}?${idField}=eq.${userId}`;
    const updatePayload = {};
    updatePayload[passwordField] = newPassword;
    
    Logger.log('Actualizando contraseña en tabla: ' + tableName);
    Logger.log('Campo: ' + passwordField);
    Logger.log('ID: ' + userId);
    
    const updateResponse = UrlFetchApp.fetch(updateUrl, {
      method: 'patch',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(updatePayload),
      muteHttpExceptions: true
    });
    
    if (updateResponse.getResponseCode() !== 204) {
      Logger.log('Error actualizando contraseña: ' + updateResponse.getContentText());
      return createResponse(false, 'Error al actualizar la contraseña.');
    }
    
    // Marcar token como usado
    const markUsedUrl = `${SUPABASE_URL}/rest/v1/RESTABLECER?id=eq.${tokenData.id}`;
    UrlFetchApp.fetch(markUsedUrl, {
      method: 'patch',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify({ used: true }),
      muteHttpExceptions: true
    });
    
    Logger.log('Contraseña actualizada exitosamente');
    
    return createResponse(true, 'Contraseña actualizada correctamente.');
    
  } catch (error) {
    Logger.log('Error en confirmarReseteo: ' + error.toString());
    return createResponse(false, 'Error al procesar la solicitud: ' + error.toString());
  }
}

/**
 * Crear respuesta JSON
 */
function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message
  };
  
  if (data) {
    response.data = data;
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Generar HTML del correo de reseteo
 */

function generateResetEmailHTML(userName, idField, resetUrl) {


  const whatsappMessage = encodeURIComponent(
`Hola, buen día.

Soy *${userName}*
ID: ${idField}

Solicito apoyo para recuperar mi acceso al sistema.
Quedo atento a su respuesta.`
  );

  return `

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Restablecer contraseña - Grupo TDM</title>
    <!--[if (gte mso 9)|(IE)]>
    <style type="text/css">
        table {border-collapse: collapse !important;}
        td {border-collapse: collapse !important;}
    </style>
    <![endif]-->
</head>

<body
    style="margin: 0 !important; padding: 0 !important; width: 100% !important; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #F4F6F9;"
    bgcolor="#F4F6F9">

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%"
        style="width: 100% !important; background-color: #F4F6F9;" bgcolor="#F4F6F9">
        <tr>
            <td align="center" style="padding: 20px 0 0 0;">

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600"
                    style="width: 100% !important; max-width: 600px !important; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);"
                    bgcolor="#ffffff">

                    <!-- HEADER -->
                    <tr>
                        <td style="padding: 20px 30px 0; text-align: center; background-color: #ffffff; border-radius: 12px 12px 0 0;"
                            bgcolor="#ffffff">
                            <img src="https://lh3.googleusercontent.com/d/1ut0pgWZJ1nGr2EaS2-gtJwCftVILMJO4"
                                alt="Grupo TDM" width="220"
                                style="width: 220px; height: auto; margin: 0 auto 24px; display: block; border: 0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="60"
                                align="center" style="margin: 24px auto 0;">
                                <tr>
                                    <td height="2" bgcolor="#E2E8F0"
                                        style="background-color: #E2E8F0; font-size: 0; line-height: 0;">&nbsp;</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CUERPO -->
                    <tr>
                        <td style="padding: 20px 40px 32px;">

                            <p
                                style="margin: 0 0 28px; color: #1E293B; font-size: 20px; font-weight: 600; text-align: center;">
                                Hola, ${userName}
                            </p>

                            <p
                                style="margin: 0 0 28px; color: #475569; font-size: 15px; line-height: 1.7; text-align: center;">
                                Hemos recibido una solicitud para restablecer la contraseña asociada a su cuenta.
                                Para continuar con el proceso de verificación, utilice el siguiente botón:
                            </p>

                            <!-- BOTON CTA CENTRADO -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="margin: 32px 0 30px;">
                                <tr>
                                    <td align="center">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                                            style="margin: 0 auto;">
                                            <tr>
                                                <td align="center" bgcolor="#1E293B"
                                                    style="background-color: #1E293B; border-radius: 6px; padding: 16px 48px;">
                                                    <a href="${resetUrl}"
                                                        style="display: inline-block; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                                                        Restablecer contraseña
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- AVISO DE CADUCIDAD -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="margin: 30px 0; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;"
                                bgcolor="#F8FAFC">
                                <tr>
                                    <td style="padding: 20px 24px; text-align: center;">
                                        <p
                                            style="margin: 0; color: #64748B; font-size: 14px; font-weight: 500; line-height: 1.5;">
                                            Por razones de seguridad, este enlace es válido por <strong
                                                style="color: #1E293B;">5 minutos</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- RECOMENDACIONES DE SEGURIDAD -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="margin: 36px 0 20px; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E2E8F0;"
                                bgcolor="#FFFFFF">
                                <tr>
                                    <td style="padding: 24px 28px;">
                                        <p
                                            style="margin: 0 0 18px; color: #1E293B; font-size: 15px; font-weight: 700; text-align: center; letter-spacing: 0.3px;">
                                            RECOMENDACIONES DE SEGURIDAD
                                        </p>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                                            width="100%" style="color: #475569; font-size: 14px; line-height: 1.6;">
                                            <tr>
                                                <td style="padding: 4px 0; vertical-align: top; width: 20px;">&bull;</td>
                                                <td style="padding: 4px 0; text-align: left;">Utilice una contraseña única que no haya empleado en otros servicios.</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; vertical-align: top; width: 20px;">&bull;</td>
                                                <td style="padding: 4px 0; text-align: left;">Asegúrese de que contenga al menos 8 caracteres, combinando mayúsculas, minúsculas y números.</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; vertical-align: top; width: 20px;">&bull;</td>
                                                <td style="padding: 4px 0; text-align: left;">Evite incluir información personal fácilmente deducible (fechas, nombres).</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; vertical-align: top; width: 20px;">&bull;</td>
                                                <td style="padding: 4px 0; text-align: left;">Si usted no solicitó este cambio, ignore este mensaje y notifique al administrador.</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CONTACTO ADMINISTRADOR -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                                style="margin: 40px 0 0;">
                                <tr>
                                    <td align="center"
                                        style="padding: 28px 20px; background-color: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;"
                                        bgcolor="#F8FAFC">
                                        <p
                                            style="margin: 0 0 18px; color: #334155; font-size: 15px; font-weight: 600; text-align: center;">
                                            ¿Necesita asistencia adicional?
                                        </p>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                                            style="margin: 0 auto;">
                                            <tr>
                                                <td align="center" bgcolor="#1E293B"
                                                    style="background-color: #1E293B; border-radius: 6px; padding: 14px 36px;">
                                                    <a href="https://wa.me/573168007979?text=${whatsappMessage}"
                                                        style="display: inline-block; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">
                                                        Contactar al Administrador
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p
                                            style="margin: 20px 0 0; color: #64748B; font-size: 13px; text-align: center;">
                                            Este es un mensaje automático del Sistema de Gestión Empresarial.<br>
                                            Por favor, no responda a esta dirección de correo electrónico.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding: 0 40px; text-align: center; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0; color: #94A3B8; font-size: 12px; letter-spacing: 0.2px;">
                                © ${new Date().getFullYear()} Grupo TDM. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>

</body>

</html>

  `;
}

/**
 * Función de prueba para solicitar permisos
 * Ejecuta esta función manualmente para autorizar permisos de UrlFetchApp y GmailApp
 */
function solicitarPermisos() {
  try {
    // Solicitar permiso para UrlFetchApp
    UrlFetchApp.fetch('https://www.google.com');
    
    // Solicitar permiso para GmailApp
    const email = Session.getActiveUser().getEmail();
    GmailApp.sendEmail(email, 'Test de permisos SISPRO', 'Este es un correo de prueba para autorizar permisos.');
    
    Logger.log('✅ Permisos autorizados correctamente');
    Logger.log('📧 Se envió un correo de prueba a: ' + email);
    
    return 'Permisos autorizados. Revisa tu correo.';
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    return 'Error: ' + error.toString();
  }
}

/**
 * Función de prueba para enviar correo de reseteo
 */
function testPasswordReset() {
  const data = {
    action: 'SOLICITAR_RESETEO',
    id: '1144167164',
    hoja: 'USUARIOS'
  };
  
  const result = solicitarReseteo(data);
  Logger.log(result.getContent());
  return result.getContent();
}

