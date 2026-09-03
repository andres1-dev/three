#!/bin/bash
# Script para iniciar el servidor HTTPS

# Cambiar al directorio del proyecto (uno nivel arriba)
cd "$(dirname "$0")/.."

# Generar certificado SSL si no existe
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    echo "Generando certificado SSL autofirmado..."
    openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365 -subj '/CN=localhost'
    echo "Certificado generado exitosamente."
fi

# Iniciar el servidor HTTPS
echo "Iniciando servidor HTTPS en https://localhost:4443"
python3 -c "
import ssl
import http.server
import socketserver
import os

PORT = 4443
# Ya estamos en el directorio correcto del script bash

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain('cert.pem', 'key.pem')
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print(f'Servidor HTTPS corriendo en: https://localhost:{PORT}')
    print('Presiona Ctrl+C para detener')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido')
"
