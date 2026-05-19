# Script PowerShell - Copiar archivos de documentación a trading-bot
# Ejecutar como: .\copy_docs.ps1

$outputDir = "C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\outputs"
$projectDir = "C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\trading-bot"

# Verificar que existen los directorios
if (-not (Test-Path $outputDir)) {
    Write-Host "ERROR: No existe $outputDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $projectDir)) {
    Write-Host "ERROR: No existe $projectDir" -ForegroundColor Red
    exit 1
}

# Archivos a copiar
$files = @(
    "README.md",
    "CONTRIBUTING.md",
    "ARCHITECTURE.md",
    "GITHUB_SETUP.md",
    ".gitignore",
    ".env.example",
    "LICENSE",
    "package.json",
    "informe_backtest.md",
    "informe_comparativo_timeframes.md",
    "PROYECTO_LISTO.md"
)

Write-Host "📋 Copiando archivos de documentación..." -ForegroundColor Cyan
Write-Host ""

$copied = 0
$failed = 0

foreach ($file in $files) {
    $source = Join-Path $outputDir $file
    $dest = Join-Path $projectDir $file
    
    if (Test-Path $source) {
        try {
            Copy-Item -Path $source -Destination $dest -Force
            Write-Host "✅ $file" -ForegroundColor Green
            $copied++
        } catch {
            Write-Host "❌ $file (error: $_)" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "⚠️  $file (no encontrado)" -ForegroundColor Yellow
        $failed++
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Copiados: $copied" -ForegroundColor Green
Write-Host "❌ Errores: $failed" -ForegroundColor Red
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

# Próximos pasos
Write-Host ""
Write-Host "📌 Próximos pasos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ir a la carpeta del proyecto:"
Write-Host "   cd `"$projectDir`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Inicializar Git:"
Write-Host "   git init" -ForegroundColor Yellow
Write-Host "   git add ." -ForegroundColor Yellow
Write-Host "   git commit -m `"feat: Initial commit - Trading Bot v2.0`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Crear repo en GitHub:"
Write-Host "   https://github.com/new" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Subir código:"
Write-Host "   git remote add origin https://github.com/MarceloHarp/trading-bot.git" -ForegroundColor Yellow
Write-Host "   git branch -M main" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
