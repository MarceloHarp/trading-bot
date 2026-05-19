# 🤖 TRADING BOT — CONTEXTO DE SESIÓN
> Última actualización: 19 Mayo 2026 — v2.0 Post-optimizaciones
> GitHub: https://github.com/MarceloHarp/trading-bot

## 📍 ESTADO ACTUAL
- **9 trades abiertos** al cierre de sesión
- **10 pares**: BTCUSDT, ETHUSDT, ADAUSDT, SOLUSDT, BNBUSDT, DOTUSDT, AVAXUSDT, LINKUSDT, LTCUSDT, XRPUSDT
- **Timeframes**: 1h y 4h (1m eliminado)
- **Bot**: Operacional con todas las mejoras v2.0

## 🖥️ CÓMO ARRANCAR
```cmd
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend  
npm run dev

# Terminal 3 — devexec (OBLIGATORIO para que Claude ejecute código)
node devexec-server.js
```

## ✅ MEJORAS v2.0 (implementadas hoy)
- Eliminado 1m (evitaba -21% PnL)
- SL dinámico 1.5×ATR en VWAPMomentum
- SL dinámico 1.0×ATR en SmartMoney  
- Trailing stop: >3% → breakeven, >5% → trailing 50%
- Filtro SMA200 en todas las estrategias
- Confirmación de vela en DruLozano (body ratio >50%)
- 10 pares activos (agregados DOT, AVAX, LINK, LTC, XRP)
- Partial TP: 50% cierra en 5%, resto corre a 10%
- Filtro volumen 24h (BTC>50M, ETH>20M, resto>5M USDT)
- Cooldown SmartMoney: 3 pérdidas → 12h pausa
- devexec-server.js: servidor puerto 3002 para ejecución remota

## 🎯 PENDIENTES (próxima sesión)
1. **Activar Claude API** (CLAUDE_VALIDATION=true) — costo ~$3-5 USD/mes
2. Backtesting automático semanal por email
3. Filtro multi-timeframe en SmartMoney
4. Mejorar detección de Liquidity Sweep en DruLozano
5. Machine Learning para optimización de parámetros

## 🔧 MECANISMO devexec
Claude ejecuta código Node.js directamente desde el browser:
```javascript
fetch('http://localhost:3002', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ code: `console.log('hola')` })
}).then(r=>r.json()).then(d=>console.log(d.output));
```

## 📊 BACKTESTING RESULTS (datos reales Binance)
| TF | Win Rate | PnL | Status |
|---|---|---|---|
| 1m | 3.4% | -21.08% | ❌ ELIMINADO |
| 1h | 25.7% | +2.91% | ✅ ACTIVO |
| 4h | 27.2% | -0.26% | ✅ ACTIVO |

| Estrategia | Mejor TF | Win Rate | PnL |
|---|---|---|---|
| VWAPMomentum | 4h | 37.0% | +0.37% |
| Confluence | 1h | 25.5% | +0.96% |
| SmartMoney | 1h | 21.4% | +2.12% |
| DruLozano | 1h | 27.6% | +0.39% |

## 🐛 PROBLEMAS CONOCIDOS
- Puerto 3001 ocupado: netstat -ano | findstr :3001 → taskkill /PID xxxx /F
- ENOTFOUND testnet.binance.vision: downtime temporal, se recupera solo
- devexec no responde: verificar que devexec-server.js esté corriendo en puerto 3002

## 📁 ARCHIVOS CLAVE
- backend/src/core/strategies/*.ts — 4 estrategias
- backend/src/core/OrderExecutor.ts — trailing stop + partial TP
- backend/src/core/StrategyEngine.ts — filtro volumen + rate limiting
- frontend/src/components/BacktestPage.tsx — UI backtesting
- devexec-server.js — servidor ejecución remota (puerto 3002)
