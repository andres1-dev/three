#!/usr/bin/env python3
import ssl
import http.server
import socketserver
import os
import sys
import platform
from pathlib import Path

# Configuración
PORT = 4443

# Detectar si estamos ejecutando desde un ejecutable PyInstaller
if getattr(sys, 'frozen', False):
    # Ejecutable: el directorio base es donde está el .exe
    BASE_DIR = Path(sys.executable).parent
    SERVER_DIR = BASE_DIR
else:
    # Script normal: directorio donde está este script
    SERVER_DIR = Path(__file__).parent

# Directorio del proyecto (un nivel arriba del server/)
PROJECT_DIR = SERVER_DIR.parent

# Detectar sistema operativo para rutas de certificados
if platform.system() == "Windows":
    cert_dir = Path("C:/https")
else:
    # Mac/Linux: usar carpeta del proyecto
    cert_dir = SERVER_DIR / ".certs"

# Usar certificados de mkcert si existen, sino generar autofirmado
cert_file = cert_dir / "localhost+2.pem"
key_file = cert_dir / "localhost+2-key.pem"

if cert_file.exists() and key_file.exists():
    print(f"✅ Usando certificados mkcert de: {cert_dir}")
else:
    print("⚠️ Certificados mkcert no encontrados, usando certificado autofirmado...")
    cert_file = SERVER_DIR / "cert.pem"
    key_file = SERVER_DIR / "key.pem"
    
    if not cert_file.exists() or not key_file.exists():
        print("Generando certificado SSL autofirmado...")
        os.system(f"openssl req -x509 -newkey rsa:4096 -nodes -out {cert_file} -keyout {key_file} -days 365 -subj '/CN=localhost'")
        print("Certificado generado exitosamente.")

# Cambiar al directorio del proyecto (padre) para servir los archivos de la app
os.chdir(PROJECT_DIR)

# Crear el servidor HTTP
class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Deshabilitar caché para que los cambios se vean inmediatamente
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

# Configurar SSL con método moderno
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(str(cert_file), str(key_file))

httpd = socketserver.TCPServer(("", PORT), MyHTTPRequestHandler)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Servidor HTTPS corriendo en: https://localhost:{PORT}")
print(f"Sirviendo archivos desde: {PROJECT_DIR}")
print("Presiona Ctrl+C para detener el servidor")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServidor detenido.")
    httpd.server_close()