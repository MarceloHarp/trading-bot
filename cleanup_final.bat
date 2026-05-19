@echo off
REM Script de limpieza para trading-bot
REM Elimina archivos de desarrollo y temporales

setlocal enabledelayedexpansion

set PROJECT_DIR=C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\trading-bot

echo.
echo ===============================================
echo LIMPIANDO ARCHIVOS INNECESARIOS...
echo ===============================================
echo.

set DELETED=0

REM Archivos a ELIMINAR
echo Eliminando archivos temporales...

REM .env (archivo personal, no debería estar aquí)
if exist "%PROJECT_DIR%\.env" (
    del "%PROJECT_DIR%\.env"
    echo [DEL] .env
    set /a DELETED+=1
)

REM ZIPs temporales
if exist "%PROJECT_DIR%\files.zip" (
    del "%PROJECT_DIR%\files.zip"
    echo [DEL] files.zip
    set /a DELETED+=1
)

REM Archivos SETUP/estado
if exist "%PROJECT_DIR%\ESTADO_PROYECTO.md" (
    del "%PROJECT_DIR%\ESTADO_PROYECTO.md"
    echo [DEL] ESTADO_PROYECTO.md
    set /a DELETED+=1
)

if exist "%PROJECT_DIR%\SETUP.md" (
    del "%PROJECT_DIR%\SETUP.md"
    echo [DEL] SETUP.md
    set /a DELETED+=1
)

REM Scripts auxiliares
if exist "%PROJECT_DIR%\setup_backtest_backend.js" (
    del "%PROJECT_DIR%\setup_backtest_backend.js"
    echo [DEL] setup_backtest_backend.js
    set /a DELETED+=1
)

if exist "%PROJECT_DIR%\setup_backtest_frontend.js" (
    del "%PROJECT_DIR%\setup_backtest_frontend.js"
    echo [DEL] setup_backtest_frontend.js
    set /a DELETED+=1
)

if exist "%PROJECT_DIR%\setup_offline.js" (
    del "%PROJECT_DIR%\setup_offline.js"
    echo [DEL] setup_offline.js
    set /a DELETED+=1
)

if exist "%PROJECT_DIR%\implement_improvements.js" (
    del "%PROJECT_DIR%\implement_improvements.js"
    echo [DEL] implement_improvements.js
    set /a DELETED+=1
)

if exist "%PROJECT_DIR%\read_trades.js" (
    del "%PROJECT_DIR%\read_trades.js"
    echo [DEL] read_trades.js
    set /a DELETED+=1
)

if exist "%PROJECT_DIR%\fix_strats_bt.js" (
    del "%PROJECT_DIR%\fix_strats_bt.js"
    echo [DEL] fix_strats_bt.js
    set /a DELETED+=1
)

REM Scripts de debug (empiezan con _)
echo Eliminando scripts de debug...
for /r "%PROJECT_DIR%" %%F in (_*.js) do (
    del "%%F"
    echo [DEL] %%~nxF
    set /a DELETED+=1
)

REM docker-compose.yml (no está en uso)
if exist "%PROJECT_DIR%\docker-compose.yml" (
    del "%PROJECT_DIR%\docker-compose.yml"
    echo [DEL] docker-compose.yml
    set /a DELETED+=1
)

REM start-bot.bat (auxiliar)
if exist "%PROJECT_DIR%\start-bot.bat" (
    del "%PROJECT_DIR%\start-bot.bat"
    echo [DEL] start-bot.bat
    set /a DELETED+=1
)

echo.
echo ===============================================
echo RESULTADO: %DELETED% archivos eliminados
echo ===============================================
echo.
echo Contenido final de la carpeta:
dir /b "%PROJECT_DIR%" | findstr /v "^$"
echo.
echo ===============================================
echo LIMPIEZA COMPLETADA
echo ===============================================
echo.
pause
