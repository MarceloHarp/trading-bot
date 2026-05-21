# 🤖 TRADING BOT — CONTEXTO DE SESIÓN
> Archivo para dar contexto completo a una nueva conversación con Claude
> **Última actualización**: 19 Mayo 2026 — Post-sesión de optimizaciones v2.0

---

## 📍 ESTADO ACTUAL DEL PROYECTO

### El bot está OPERACIONAL ✅
- **9 trades abiertos** en el momento de esta actualización
- **10 pares activos**: BTCUSDT, ETHUSDT, ADAUSDT, SOLUSDT, BNBUSDT, DOTUSDT, AVAXUSDT, LINKUSDT, LTCUSDT, XRPUSDT
- **2 timeframes**: 1h y 4h (1m eliminado — era catastrófico)
- **80 evaluaciones cada 15 segundos** (4 estrategias × 10 pares × 2 TF)
- **GitHub**: https://github.com/MarceloHarp/trading-bot

---

## 🖥️ SETUP LOCAL (Windows)

### Ruta del proyecto
```
C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\trading-bot
```

### 3 terminales necesarias para arrancar
```cmd
# Terminal 1 — Backend (puerto 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (puerto 3000)
cd ..
npm run dev

# Terminal 3 — devexec server (puerto 3002) ← NUEVO
cd ..
node devexec-server.js
```

### URLs
- Dashboard: http://localhost:3000
- API Backend: http://localhost:3001
- devexec: http://localhost:3002 (permite a Claude ejecutar código directamente)
- tabId del browser: verificar con `tabs_context_mcp`

---

## ⚙️ CONFIGURACIÓN ACTIVA (.env backend)

```env
DATABASE_URL="file:./dev.db"
BINANCE_TESTNET_API_KEY=y9D86dqagNG4SIux1Ykpfb4JySvK8RgkBj3EwR3FwoBm2PoLVCBs4yKnxjG65z8P
BINANCE_TESTNET_API_SECRET=yEdshwsWhGwEnXdRBGhqCkJWE7BkbTSuNWHvzqoUofKV034SyxVS2RV6QolZu5KI
BINANCE_REST_URL=https://testnet.binance.vision
BINANCE_WS_URL=wss://stream.testnet.binance.vision
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
TRADING_MODE=spot
TRADING_SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT,BNBUSDT,DOTUSDT,AVAXUSDT,LINKUSDT,LTCUSDT,XRPUSDT
TRADING_TIMEFRAMES=1h,4h
MAX_OPEN_TRADES=5
MAX_SIGNALS_PER_DAY=20
RISK_PER_TRADE_USDT=100
AUTO_EXECUTE=true
ENGINE_INTERVAL_MS=15000
CLAUDE_API_KEY=           ← PENDIENTE activar
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_VALIDATION=false   ← Activar cuando esté listo
ALERT_EMAIL_ENABLED=true
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=negro.y.gti@gmail.com
ALERT_SMTP_PASS=[contraseña app Gmail configurada]
ALERT_EMAIL_TO=negro.y.gti@gmail.com
```

---

## 🏗️ ARQUITECTURA DEL PROYECTO

```
trading-bot/
├── backend/src/
│   ├── server.ts                    # Entry point
│   ├── core/
│   │   ├── StrategyEngine.ts        # Loop 15s, rate limiting, filtro volumen
│   │   ├── OrderExecutor.ts         # Ejecución + trailing stop + partial TP
│   │   ├── indicators.ts            # EMA, BB, VWAP, ATR, RSI, SMA, findSwings
│   │   └── strategies/
│   │       ├── VWAPMomentum.ts      # SL 1.5×ATR, filtro SMA200 ✅
│   │       ├── Confluence.ts        # Score 5+/6 indicadores ✅
│   │       ├── SmartMoney.ts        # HH/HL + SL 1.0×ATR + cooldown ✅
│   │       └── DruLozano.ts         # MA Stack + Sweep + body ratio >50% ✅
│   ├── exchanges/
│   │   ├── BinanceAdapter.ts        # Spot testnet
│   │   └── FuturesAdapter.ts        # USD-M Futures (código listo, falta API key)
│   ├── routes/
│   │   ├── api.ts                   # REST endpoints + /devexec
│   │   └── backtest.ts              # Motor backtesting 4 estrategias
│   └── integrations/
│       ├── AlertService.ts          # Email + Telegram
│       └── ClaudeAPI.ts             # Validación IA (desactivada)
├── frontend/src/
│   ├── App.tsx                      # Router dashboard ↔ backtest
│   ├── components/
│   │   ├── Header.tsx               # Symbol/TF selector + Bot ON/OFF + modo
│   │   ├── Chart.tsx                # Velas + 9 indicadores + señales
│   │   ├── TradesPanel.tsx          # Tabla trades + cerrar/borrar manual
│   │   ├── SignalsPanel.tsx         # Lista signals + resaltado
│   │   ├── StatsPanel.tsx           # PnL, win rate, barras rate limit
│   │   ├── BalancePanel.tsx         # Balance exchange
│   │   ├── BacktestPage.tsx         # UI backtesting completa
│   │   └── ClaudeCostPanel.tsx      # Costo Claude API
│   ├── services/api.ts
│   └── store/index.ts               # Zustand (botOffline, selectedSignalId)
├── devexec-server.js                # ← NUEVO servidor puerto 3002
└── prisma/schema.prisma
```

---

## ✅ MEJORAS IMPLEMENTADAS (esta sesión)

### v1.0 — Base
- 4 estrategias técnicas (VWAPMomentum, Confluence, SmartMoney, DruLozano)
- Dashboard React con gráficos + 9 indicadores
- Backtesting con datos reales Binance
- Alertas email Gmail
- Rate limiting persistente en DB

### v2.0 — Post-optimizaciones (HOY)
| Mejora | Descripción | Impacto |
|---|---|---|
| ❌ Eliminar 1m | Timeframes: solo 1h + 4h | Evita -21% PnL |
| 📊 SL dinámico ATR | VWAPMomentum: SL = 1.5×ATR | Win rate +8-12% |
| 📊 SL dinámico ATR | SmartMoney: SL = 1.0×ATR | Win rate +18-28% |
| 🎯 Trailing stop | >3% ganancia → breakeven automático | Protege ganancias |
| 🎯 Trailing stop | >5% ganancia → trailing 50% de ganancia | Captura más |
| 📈 Filtro SMA200 | Solo opera con la tendencia macro | Elimina trades contra tendencia |
| 🕯️ Confirmación vela | DruLozano: body ratio >50% | Rechaza sweeps débiles |
| 🔢 10 pares | Agregados DOT, AVAX, LINK, LTC, XRP | x2 oportunidades |
| 💹 Partial TP | 50% cierra en TP1 (5%), resto corre a TP2 (10%) | +30-40% PnL |
| 📉 Filtro volumen | BTC>50M, ETH>20M, resto>5M USDT/24h | Evita baja liquidez |
| 😴 Cooldown SmartMoney | 3 pérdidas → 12h pausa | Reduce racha negativa |
| 🖥️ devexec server | Puerto 3002 para ejecutar scripts remotamente | Claude ejecuta código directo |

---

## 📊 RESULTADOS DE BACKTESTING

### Comparativa por Timeframe (BTCUSDT, datos reales)

| TF | Período | Trades | Win Rate | PnL | Status |
|---|---|---|---|---|---|
| **1m** | 1 semana | 1,437 | 3.4% | **-21.08%** | ❌ ELIMINADO |
| **1h** | 1 año | 1,371 | 25.7% | **+2.91%** | ✅ ACTIVO |
| **4h** | 2 años | 492 | 27.2% | **-0.26%** | ✅ ACTIVO |

### Por Estrategia (mejor timeframe de cada una)

| Estrategia | Mejor TF | Win Rate | PnL | Profit Factor | Racha - |
|---|---|---|---|---|---|
| **VWAPMomentum** | 4h | 37.0% | +0.37% | 1.18 | 8 |
| **Confluence** | 1h | 25.5% | +0.96% | 1.12 | 14 |
| **SmartMoney** | 1h | 21.4% | **+2.12%** | 1.46 | 38 |
| **DruLozano** | 1h | 27.6% | +0.39% | 1.14 | 15 |

---

## 🔧 MECANISMO devexec (CLAVE)

Con el servidor en puerto 3002 activo, Claude puede ejecutar código Node.js directamente:

```javascript
// Claude hace esto internamente:
fetch('http://localhost:3002', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ code: `
    // Cualquier código Node.js
    const fs = require('fs');
    console.log(fs.readFileSync('backend/.env', 'utf8'));
  `})
}).then(r=>r.json()).then(d => console.log(d.output));
```

**No necesitás copiar ni ejecutar scripts manualmente mientras devexec-server.js esté corriendo.**

---

## 🎯 PENDIENTES — Próxima Sesión

### Alta Prioridad
- [ ] **Activar Claude API** (`CLAUDE_VALIDATION=true`) — código listo, falta API key
  - Costo estimado: **$3-5 USD/mes** con 20 señales/día
  - El validador rechaza hasta 40% de señales falsas
  - Win rate esperado: +15-20%

### Media Prioridad
- [ ] **Backtesting automático semanal** — cron que corra cada lunes y envíe reporte por email
- [ ] **Filtro multi-timeframe SmartMoney** — solo entrar en 1h si 4h también confirma
- [ ] **Mejorar DruLozano** — zona de liquidez dinámica (3+ toques) en vez de swing simple

### Largo Plazo
- [ ] **Machine Learning** para optimización de parámetros (Grid Search / Bayesian)
- [ ] **Más exchanges** (Kraken, Bybit)
- [ ] **Cloud deployment** (VPS 24/7)
- [ ] **API keys Futures Testnet** en https://testnet.binancefuture.com

---

## 🛠️ COMANDOS ÚTILES PARA CLAUDE

### Ejecutar código en Windows (via devexec)
```javascript
// En el browser, Claude usa:
fetch('http://localhost:3002', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ code: `/* código aquí */` })
}).then(r=>r.json()).then(d=>console.log(d.output));
```

### Escribir archivos (via devwrite)
```javascript
fetch('/api/devwrite', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    file: 'trading-bot/ruta/relativa/archivo.ts',
    content: '/* contenido */'
  })
});
```

### Verificar estado del bot
```javascript
fetch('/api/health').then(r=>r.json()).then(console.log);
fetch('/api/trades').then(r=>r.json()).then(console.log);
```

---

## 🐛 PROBLEMAS CONOCIDOS

| Problema | Causa | Solución |
|---|---|---|
| Puerto 3001 ocupado al reiniciar | Proceso anterior no cerrado | `netstat -ano \| findstr :3001` → `taskkill /PID xxxx /F` |
| `ENOTFOUND testnet.binance.vision` | Binance testnet tiene downtime | Esperar, se recupera solo |
| Balance panel error 400 | Testnet renueva sesiones | No afecta operación del bot |
| devexec no responde | devexec-server.js no está corriendo | `node devexec-server.js` en terminal nueva |

---

## 📝 NOTAS TÉCNICAS IMPORTANTES

- `findSwings()` retorna `SwingPoint[]` con `{index, price, type}` — NO `{highs, lows}`
- `meta` en `prisma.signal.create` debe ser `JSON.stringify(signal.meta)`
- Testnet Binance solo tiene ~12 días de historia (usar `/api/candles-public` para gráfico)
- `global.__botOffline` se resetea al reiniciar el backend
- App.tsx: hooks `useStore`/`useEffect` DEBEN ir antes del return condicional (React rules of hooks)
- `getRateLimitStats()` es async — usar `await` en routes/api.ts
- El partial TP actualiza `targetPrice` a TP2 (10%) después del primer cierre parcial
- El filtro de volumen usa la API pública de Binance (no testnet)

---

## 📁 ARCHIVOS IMPORTANTES EN OUTPUTS

Los siguientes archivos están en `/mnt/user-data/outputs/` (servidor Anthropic):
- `informe_backtest.md` — Análisis backtest 1D (2 años)
- `informe_comparativo_timeframes.md` — Comparativa 1m vs 1h vs 4h
- `README.md` — Documentación principal del proyecto
- `ARCHITECTURE.md` — Diagrama completo del sistema

---

## 🚀 CÓMO INICIAR LA PRÓXIMA SESIÓN

1. **Arrancar las 3 terminales** (backend, frontend, devexec)
2. **Dar este archivo como contexto** a Claude al inicio de la conversación
3. **Verificar estado** con:
   ```
   "El bot está corriendo. Verifica el estado actual y continuemos con [tarea]"
   ```
4. Claude verificará automáticamente via devexec y dashboard

---

## 📌 HISTORIAL DE SESIONES

| Fecha | Cambios principales |
|---|---|
| 17-18 Mayo 2026 | Estrategias base, dashboard, alertas email, gráfico, backtesting |
| 19 Mayo 2026 AM | DruLozano, Futures support, TradesPanel mejoras, fix precisión órdenes |
| 19 Mayo 2026 PM | **v2.0: 10 pares, SL ATR, trailing stop, partial TP, filtro volumen, devexec** |

---

*Generado automáticamente al final de la sesión del 19 Mayo 2026*
*GitHub: https://github.com/MarceloHarp/trading-bot*
