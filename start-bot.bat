@echo off
title Trading Bot
color 0A
echo.
echo  ======================================
echo   TRADING BOT - Binance Testnet
echo  ======================================
echo.

if not exist "backend\package.json" (
  echo [ERROR] Ejecuta desde la carpeta raiz del proyecto
  pause & exit /b 1
)

if not exist ".env" (
  echo [WARN] Copiando .env.example a .env...
  copy .env.example .env
)

if not exist "backend\.env" copy .env backend\.env
if not exist "frontend\.env" copy .env frontend\.env

echo [1/3] Verificando dependencias...
if not exist "backend\node_modules" ( cd backend && call npm install && cd .. )
if not exist "frontend\node_modules" ( cd frontend && call npm install && cd .. )
echo       OK

echo [2/3] Iniciando Backend en puerto 3001...
start "Trading Bot - BACKEND" cmd /k "cd /d %~dp0backend && npm run dev"

echo       Esperando que el backend este listo...
set /a i=0
:wait
set /a i+=1
if %i% gtr 30 ( echo [ERROR] Backend no respondio & pause & exit /b 1 )
timeout /t 2 /nobreak >nul
curl -s http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 goto wait
echo       Backend listo!

echo [3/3] Iniciando Frontend en puerto 3000...
start "Trading Bot - FRONTEND" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 4 /nobreak >nul
echo.
echo  ======================================
echo   Backend:  http://localhost:3001/api/health
echo   Frontend: http://localhost:3000
echo  ======================================
echo.
start http://localhost:3000
echo  Bot corriendo. Cierra las ventanas de consola para detenerlo.
pause