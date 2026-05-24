# 🤖 TRADING BOT — CONTEXTO DE SESIÓN
> Dar este archivo al inicio de cada nueva conversación con Claude para contexto completo
> **Última actualización**: 23 Mayo 2026 — v3.0 (Futures + 6 estrategias + UI mejorada)

---

## 📍 ESTADO ACTUAL

### El bot está OPERACIONAL ✅
- **Modo**: Binance Futures Testnet · 3× apalancamiento
- **5 pares**: SOLUSDT, ETHUSDT, BNBUSDT, AVAXUSDT + BTCUSDT (solo régimen)
- **3 timeframes**: 1h · 4h · 1d
- **6 estrategias activas**: ElTigre, GatilloFacil, MarceMillo, SaltandoDelLambo, SmartMoney, VWAPMomentum
- **GitHub**: https://github.com/MarceloHarp/trading-bot

---

## 🖥️ SETUP LOCAL (Windows)

### Ruta del proyecto
```
C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\trading-bot
```

### 2 terminales para arrancar
```cmd
# Terminal 1 — Backend (puerto 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (puerto 3000)
cd ..
npm run dev
```

### URLs
- Dashboard: http://localhost:3000
- API Backend: http://localhost:3001

---

## ⚙️ CONFIGURACIÓN ACTIVA (backend/.env)

```env
DATABASE_URL="file:./dev.db"

# Binance Spot Testnet
BINANCE_TESTNET_API_KEY=y9D86dqagNG4SIux1Ykpfb4JySvK8RgkBj3EwR3FwoBm2PoLVCBs4yKnxjG65z8P
BINANCE_TESTNET_API_SECRET=yEdshwsWhGwEnXdRBGhqCkJWE7BkbTSuNWHvzqoUofKV034SyxVS2RV6QolZu5KI
BINANCE_REST_URL=https://testnet.binance.vision
BINANCE_WS_URL=wss://stream.testnet.binance.vision

# Binance Futures Testnet
BINANCE_FUTURES_API_KEY=SEeF7hoId3E9EDEtxvh0AGlO0jNs0wEghh9gE2E7cqwJ940pEnqOj3JCHLGQi1gC
BINANCE_FUTURES_API_SECRET=McJa7HyDLkpwBHBrAklRuZmjWr8js6ajKlYr9CKihRrkhyKJ0ri7gahIk3F9rro8
TRADING_MODE=futures
FUTURES_LEVERAGE=3

# Claude API
CLAUDE_API_KEY=           ← PENDIENTE
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_VALIDATION=false

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Bot config
TRADING_SYMBOLS=BTCUSDT,SOLUSDT,ETHUSDT,BNBUSDT,AVAXUSDT
NON_TRADABLE_SYMBOLS=BTCUSDT
MARKET_REGIME_SYMBOL=BTCUSDT
TRADING_TIMEFRAMES=1h,4h,1d
ENGINE_INTERVAL_MS=15000
RISK_PCT=5
RISK_PER_TRADE_USDT=100
AUTO_EXECUTE=true
MAX_SIGNALS_PER_HOUR=0
MAX_OPEN_TRADES=6
MAX_SIGNALS_PER_DAY=20

# Alertas Email
ALERT_EMAIL_ENABLED=true
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=negro.y.gti@gmail.com
ALERT_SMTP_PASS=ngaa dhro ztpo omwx
ALERT_EMAIL_TO=negro.y.gti@gmail.com
```

---

## 🏗️ ARQUITECTURA

```
trading-bot/
├── backend/src/
│   ├── server.ts
│   ├── core/
│   │   ├── StrategyEngine.ts        # tickRunning guard, cooldown TF-aware
│   │   ├── OrderExecutor.ts         # Ejecución + trailing stop + partial TP
│   │   ├── indicators.ts
│   │   └── strategies/
│   │       ├── ElTigre.ts           # Swing pullback EMA 1D · BNB longs OFF
│   │       ├── GatilloFacil.ts      # BB fade 4H
│   │       ├── MarceMillo.ts        # Momentum 1H (SOL)
│   │       ├── SaltandoDelLambo.ts  # Donchian range 4H
│   │       ├── SmartMoney.ts        # ICT structure
│   │       └── VWAPMomentum.ts      # VWAP cruce 1H
│   ├── exchanges/
│   │   ├── BinanceAdapter.ts
│   │   └── FuturesAdapter.ts
│   └── routes/
│       ├── api.ts
│       ├── backtest.ts              # 6 estrategias
│       └── indicators.ts
├── frontend/src/
│   ├── App.tsx                      # h-screen · resize+colapso chart
│   ├── components/
│   │   ├── Header.tsx               # Estrategias rankeadas · tooltips
│   │   ├── Chart.tsx                # height prop + flexible mode (ResizeObserver)
│   │   ├── TradesPanel.tsx          # Archivo · colapso · filtros
│   │   ├── SignalsPanel.tsx         # Scroll interno
│   │   ├── StatsPanel.tsx
│   │   ├── BalancePanel.tsx
│   │   ├── BacktestPage.tsx
│   │   └── ClaudeCostPanel.tsx
│   └── store/index.ts               # ALL_STRATEGIES rankeadas · botOffline
└── prisma/schema.prisma
```

---

## ✅ CAMBIOS IMPLEMENTADOS (sesión 23 Mayo 2026)

### Race condition fix (CRÍTICO)
- `tickRunning` boolean guard en StrategyEngine — evita ticks concurrentes
- Cooldown timeframe-aware: 1h para 1h/4h, **24h para 1D**
- `inCooldown()` check ANTES de `await checkLimits()` (evita race en async)

### Nuevas estrategias
- **ElTigre** — swing pullback EMA 1D (BNB longs bloqueados: 6 pérdidas seguidas)
- **GatilloFacil** — BB fade 4H
- **MarceMillo** v2 — momentum 1H mejorado (SOL)
- **SaltandoDelLambo** — rango Donchian 4H

### Config
- `MAX_OPEN_TRADES`: 15 → **6**
- `TRADING_MODE`: spot → **futures**
- BTC: filtro régimen solamente (`NON_TRADABLE_SYMBOLS=BTCUSDT`)

### Frontend
| Feature | Descripción |
|---|---|
| Estrategias rankeadas | Barra header con ranking 1-6 · hover muestra WR, PF, pares, TF |
| Resize chart | Drag handle entre gráfico y Trades · rango 150-700px |
| Colapso Trades | Botón `⌄` colapsa a header · gráfico se expande via `flexible`+ResizeObserver |
| Archivo de trades | Check → Archivar · sección colapsable · filtros win/loss · sort date/PnL |
| Layout fijo | `h-screen overflow-hidden` · no hay scroll de página |
| Signals scroll | `flex-1 min-h-0 overflow-y-auto` — scroll interno |

---

## 📊 RESULTADOS BACKTEST

### Ranking estrategias (backtest datos reales Binance)

| # | Estrategia | WR | Profit Factor | Notas |
|---|---|---|---|---|
| 1 | **ElTigre** | 37% | **1.81** | +$1,073 en 3 años (3x lev) · avg +3.4%/trade |
| 2 | **GatilloFacil** | 48% | 1.55 | Mean-reversion BB inferior/superior |
| 3 | **MarceMillo** | 45% | 1.48 | Momentum con VWAP + ADX filtro |
| 4 | **SaltandoDelLambo** | 42% | 1.38 | Mejor en mercados laterales |
| 5 | **SmartMoney** | 38% | 1.22 | Estructura ICT con HTF confirmación |
| 6 | **VWAPMomentum** | 35% | 1.15 | Funciona en trending |

---

## 🔧 NOTAS TÉCNICAS IMPORTANTES

- `tickRunning = true` antes de `_tickBody()`, `= false` en `finally` — NUNCA saltear
- `inCooldown()` es sync, se chequea ANTES de cualquier `await`
- `cooldownMs1d = 24 * 60 * 60 * 1000` para timeframe `'1d'`
- ElTigre: `noLongSymbols = new Set(['BNBUSDT'])` — BNB solo shorts
- Chart.tsx: `flexible=true` usa ResizeObserver en el canvas — no pasar `height` prop
- Chart.tsx: `flexible=false` (default) usa `height` prop + `chart.applyOptions({ height })`
- TradesPanel: props `collapsed` y `onToggleCollapse` vienen de App.tsx
- Store: `ALL_STRATEGIES` define orden de renderizado (mayor→menor rentabilidad)
- `ARCHIVE_KEY = 'archivedTrades_v2'` en localStorage
- `STORAGE_KEY = 'activeStrategies_v1'` en localStorage

---

## 🎯 PENDIENTES — Próxima Sesión

### Alta Prioridad
- [ ] **Activar Claude API** (`CLAUDE_VALIDATION=true`) — código listo, falta API key
- [ ] **Experimentar scalping 5m/15m** — tarea #8 en progreso

### Media Prioridad
- [ ] **Backtesting automático semanal** — cron + reporte email
- [ ] **Estrategia scalping en producción** si experimento es positivo

### Bajo
- [ ] Cloud deployment 24/7 (VPS)
- [ ] Dashboard móvil

---

## 📌 HISTORIAL DE SESIONES

| Fecha | Cambios principales |
|---|---|
| 17-18 Mayo | Estrategias base, dashboard, alertas email, gráfico, backtesting |
| 19 Mayo AM | DruLozano, Futures support, TradesPanel mejoras |
| 19 Mayo PM | v2.0: 10 pares, SL ATR, trailing stop, partial TP, filtro volumen |
| 21-22 Mayo | Race condition fix, ElTigre, GatilloFacil, MarceMillo v2, SaltandoDelLambo |
| 23 Mayo | Frontend: resize chart drag, colapso Trades, archivo trades, estrategias rankeadas |

---

## 🚀 CÓMO INICIAR LA PRÓXIMA SESIÓN

1. Arrancar backend (`cd backend && npm run dev`) y frontend (`npm run dev`)
2. Dar este archivo como contexto a Claude
3. Verificar estado: `curl http://localhost:3001/api/health`

---

*GitHub: https://github.com/MarceloHarp/trading-bot*
