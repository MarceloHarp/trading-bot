@echo off
REM Script para copiar archivos de documentación a trading-bot (Windows CMD)
REM Ejecutar como: copy_docs.bat

setlocal enabledelayedexpansion

set OUTPUT_DIR=C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\outputs
set PROJECT_DIR=C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\trading-bot

echo.
echo ===============================================
echo Copiando archivos de documentacion...
echo ===============================================
echo.

REM Archivos a copiar
set COPIED=0
set FAILED=0

for %%F in (
    "README.md"
    "CONTRIBUTING.md"
    "ARCHITECTURE.md"
    "GITHUB_SETUP.md"
    ".gitignore"
    ".env.example"
    "LICENSE"
    "package.json"
    "informe_backtest.md"
    "informe_comparativo_timeframes.md"
    "PROYECTO_LISTO.md"
) do (
    if exist "%OUTPUT_DIR%\%%F" (
        copy /Y "%OUTPUT_DIR%\%%F" "%PROJECT_DIR%\%%F" >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] %%F
            set /a COPIED+=1
        ) else (
            echo [ERROR] %%F
            set /a FAILED+=1
        )
    ) else (
        echo [WARN] %%F no encontrado
        set /a FAILED+=1
    )
)

echo.
echo ===============================================
echo Copiados: %COPIED%
echo Errores: %FAILED%
echo ===============================================
echo.

echo Proximos pasos:
echo.
echo 1. Ir a la carpeta del proyecto:
echo    cd "%PROJECT_DIR%"
echo.
echo 2. Inicializar Git:
echo    git init
echo    git add .
echo    git commit -m "feat: Initial commit - Trading Bot v2.0"
echo.
echo 3. Crear repo en GitHub:
echo    https://github.com/new
echo    Nombre: trading-bot
echo    Descripcion: 🤖 Automated Trading Bot with 4 strategies
echo.
echo 4. Subir codigo:
echo    git remote add origin https://github.com/MarceloHarp/trading-bot.git
echo    git branch -M main
echo    git push -u origin main
echo.
pause
