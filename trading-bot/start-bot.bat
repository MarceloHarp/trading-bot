@echo off
title Trading Bot
color 0A

echo.
echo  ████████╗██████╗  █████╗ ██████╗ ██╗███╗   ██╗ ██████╗     ██████╗  ██████╗ ████████╗
echo  ╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝     ██╔══██╗██╔═══██╗╚══██╔══╝
echo     ██║   ██████╔╝███████║██║  ██║██║██╔██╗ ██║██║  ███╗    ██████╔╝██║   ██║   ██║   
echo     ██║   ██╔══██╗██╔══██║██║  ██║██║██║╚██╗██║██║   ██║    ██╔══██╗██║   ██║   ██║   
echo     ██║   ██║  ██║██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝    ██████╔╝╚██████╔╝   ██║   
echo     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝    ╚═════╝  ╚═════╝   ╚═╝   
echo.
echo  [Binance Testnet] Paper mode
echo  ================================================================
echo.

:: Verificar que estamos en la carpeta correcta
if not exist "backend\package.json" (
    echo [ERROR] No se encontro backend\package.json
    echo         Ejecuta este .bat desde la carpeta raiz del proyecto
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] No se encontro frontend\package.json
    pause
    exit /b 1
)

:: Verificar .env
if not exist ".env" (
    echo [WARN] No existe .env - copiando desde .env.example
    copy .env.example .env
    echo [!] Edita .env con tus API keys antes de continuar
    pause
)

:: Verificar node_modules
echo [1/3] Verificando dependencias...
if not exist "backend\node_modules" (
    echo       Instalando backend...
    cd backend
    call npm install
    cd ..
)
if not exist "frontend\node_modules" (
    echo       Instalando frontend...
    cd frontend
    call npm install
    cd ..
)
echo       OK

:: Copiar .env al backend si no tiene uno propio
if not exist "backend\.env" (
    echo [2/3] Copiando .env al backend...
    copy .env backend\.env
)

:: Lanzar backend en ventana separada
echo [2/3] Iniciando Backend (puerto 3001)...
start "Trading Bot - Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Esperar que el backend esté listo (poll al health endpoint)
echo [3/3] Esperando que el backend este listo...
set /a intentos=0
:waitloop
    set /a intentos+=1
    if %intentos% gtr 30 (
        echo [ERROR] El backend no respondio en 30 segundos
        echo         Revisa la ventana del backend por errores
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    curl -s http://localhost:3001/health >nul 2>&1
    if errorlevel 1 goto waitloop

echo       Backend listo!
echo.

:: Lanzar frontend en ventana separada
echo [3/3] Iniciando Frontend (puerto 3000)...
start "Trading Bot - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Esperar un poco y abrir el browser
timeout /t 4 /nobreak >nul
echo.
echo  ================================================================
echo   Backend:  http://localhost:3001/api/health
echo   Frontend: http://localhost:3000
echo  ================================================================
echo.
echo  Abriendo el dashboard en el navegador...
start http://localhost:3000

echo.
echo  El bot esta corriendo en las dos ventanas de consola abiertas.
echo  Cierra esas ventanas para detener el bot.
echo.
pause
