#!/usr/bin/env node

/**
 * Script para generar VAPID keys para Web Push
 * 
 * Uso:
 *   node generate-vapid-keys.js
 * 
 * O si tienes web-push instalado globalmente:
 *   web-push generate-vapid-keys
 */

const crypto = require('crypto');

function generateVAPIDKeys() {
  try {
    // Generar par de claves ECDSA P-256
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      }
    });

    // Convertir a base64 URL-safe
    const publicKeyBase64 = urlBase64Encode(publicKey);
    const privateKeyBase64 = urlBase64Encode(privateKey);

    console.log('\n===============================================');
    console.log('🔑 VAPID Keys Generadas Exitosamente');
    console.log('===============================================\n');
    
    console.log('Public Key:');
    console.log(publicKeyBase64);
    console.log('\nPrivate Key:');
    console.log(privateKeyBase64);
    
    console.log('\n===============================================');
    console.log('📋 Configuración para Supabase');
    console.log('===============================================\n');
    
    console.log('Agrega estas variables en:');
    console.log('Supabase Dashboard → Project Settings → Edge Functions → Environment Variables\n');
    
    console.log(`VAPID_PUBLIC_KEY=${publicKeyBase64}`);
    console.log(`VAPID_PRIVATE_KEY=${privateKeyBase64}`);
    console.log('VAPID_SUBJECT=mailto:tu-email@ejemplo.com');
    
    console.log('\n===============================================');
    console.log('📋 Configuración para Frontend');
    console.log('===============================================\n');
    
    console.log('En tu archivo js/config.js o donde inicialices la app:\n');
    console.log(`const VAPID_PUBLIC_KEY = '${publicKeyBase64}';`);
    
    console.log('\n⚠️  IMPORTANTE:');
    console.log('- Guarda estas keys en un lugar seguro');
    console.log('- NUNCA expongas la Private Key en el frontend');
    console.log('- Solo la Public Key debe estar en el código del cliente');
    console.log('===============================================\n');

  } catch (error) {
    console.error('❌ Error generando VAPID keys:', error.message);
    console.log('\n💡 Alternativa: Instala web-push globalmente:');
    console.log('   npm install -g web-push');
    console.log('   web-push generate-vapid-keys');
    console.log('\nO usa el generador online: https://vapidkeys.com/\n');
  }
}

function urlBase64Encode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Ejecutar
generateVAPIDKeys();
