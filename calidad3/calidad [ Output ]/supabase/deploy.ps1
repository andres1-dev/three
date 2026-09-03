# Script de despliegue de Edge Functions
# PowerShell script para Windows

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Despliegue de Edge Functions - Calidad TDM" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si Supabase CLI está instalado
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCli) {
    Write-Host "❌ Supabase CLI no está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instalar con:" -ForegroundColor Yellow
    Write-Host "  scoop install supabase" -ForegroundColor White
    Write-Host ""
    Write-Host "O visita: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Supabase CLI detectado" -ForegroundColor Green
Write-Host ""

# Mostrar proyecto actual
Write-Host "Proyecto: efocfgjunowtkrgxepbn" -ForegroundColor Cyan
Write-Host ""

# Menú de opciones
Write-Host "Selecciona una opción:" -ForegroundColor Yellow
Write-Host "  1) Desplegar función 'personas'" -ForegroundColor White
Write-Host "  2) Desplegar TODAS las funciones" -ForegroundColor White
Write-Host "  3) Ver logs de 'personas'" -ForegroundColor White
Write-Host "  4) Test local de 'personas'" -ForegroundColor White
Write-Host "  5) Salir" -ForegroundColor White
Write-Host ""

$opcion = Read-Host "Opción"

switch ($opcion) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Desplegando función 'personas'..." -ForegroundColor Cyan
        supabase functions deploy personas
        Write-Host ""
        Write-Host "✅ Despliegue completado" -ForegroundColor Green
    }
    "2" {
        Write-Host ""
        Write-Host "🚀 Desplegando función 'perfiles'..." -ForegroundColor Cyan
        supabase functions deploy perfiles
        Write-Host ""
        Write-Host "✅ Despliegue completado" -ForegroundColor Green
    }
    "3" {
        Write-Host ""
        Write-Host "🚀 Desplegando TODAS las funciones..." -ForegroundColor Cyan
        supabase functions deploy
        Write-Host ""
        Write-Host "✅ Despliegue completado" -ForegroundColor Green
    }
    "4" {
        Write-Host ""
        Write-Host "📋 Mostrando logs de 'personas' (Ctrl+C para salir)..." -ForegroundColor Cyan
        Write-Host ""
        supabase functions logs personas --tail
    }
    "4" {
        Write-Host ""
        Write-Host "🧪 Iniciando servidor local..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "URL: http://localhost:54321/functions/v1/personas" -ForegroundColor Yellow
        Write-Host ""
        supabase functions serve personas
    }
    "5" {
        Write-Host "👋 Hasta luego" -ForegroundColor Cyan
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "❌ Opción inválida" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Presiona Enter para salir..." -ForegroundColor Gray
Read-Host
