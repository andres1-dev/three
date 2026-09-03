#!/bin/bash
# Script para construir el ejecutable en macOS

echo "========================================"
echo "  Construyendo ejecutable para macOS"
echo "========================================"
echo ""

# Verificar si Python 3 está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 no está instalado. Por favor instálalo primero."
    exit 1
fi

# Instalar PyInstaller si no está instalado
echo "📦 Verificando PyInstaller..."
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "Instalando PyInstaller..."
    pip3 install pyinstaller
fi

# Construir el ejecutable
echo "🔨 Construyendo ejecutable..."
python3 -m PyInstaller --onefile --name "ServidorHTTPS" server.py

# Mover el ejecutable a la raíz del proyecto
echo "📁 Moviendo ejecutable..."
cp dist/ServidorHTTPS ../

echo ""
echo "✅ Ejecutable creado exitosamente: ../ServidorHTTPS"
echo ""
echo "Para ejecutar el servidor:"
echo "  ./ServidorHTTPS"
