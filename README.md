# 🤖 Trading Bot — Automatización de Trading con IA

**Status**: ✅ Operacional | **Última actualización**: Mayo 23, 2026 | **Versión**: 3.0 (Futures + 6 Estrategias)

Bot de trading automatizado para Binance Futures Testnet. Ejecuta 6 estrategias técnicas en 3 timeframes con gestión de riesgo avanzada, dashboard interactivo, backtesting y alertas por email.

---

## 🏗️ Stack Tecnológico

| Componente | Stack |
|---|---|
| **Backend** | Node.js + Express + TypeScript + Prisma ORM |
| **Frontend** | React + Vite + TypeScript + Tailwind CSS + Zustand |
| **Base de datos** | SQLite (local) |
| **Exchange** | Binance Futures Testnet (USD-M) · 3× apalancamiento |
| **Realtime** | Socket.IO |
| **IA (opcional)** | Claude API para validación de signals |

---

## 📊 Estado Actual (v3.0)

### Modo: Futures Testnet · 3× Leverage

**Pares activos** (5):
- `SOLUSDT` — MarceMillo (momentum 1h)
- `ETHUSDT` — GatilloFacil + ElTigre + SaltandoDelLambo
- `BNBUSDT` — GatilloFacil + ElTigre (solo shorts) + SaltandoDelLambo
- `AVAXUSDT` — ElTigre + GatilloFacil
- `BTCUSDT` — Filtro de régimen (no operable, solo monitoreo)

**Timeframes**: 1h · 4h · 1d

**Config principal (.env)**:
```env
TRADING_MODE=futures
FUTURES_LEVERAGE=3
TRADING_SYMBOLS=BTCUSDT,SOLUSDT,ETHUSDT,BNBUSDT,AVAXUSDT
NON_TRADABLE_SYMBOLS=BTCUSDT
MARKET_REGIME_SYMBOL=BTCUSDT
TRADING_TIMEFRAMES=1h,4h,1d
MAX_OPEN_TRADES=6
MAX_SIGNALS_PER_DAY=20
RISK_PER_TRADE_USDT=100
AUTO_EXECUTE=true
ENGINE_INTERVAL_MS=15000
```

---

## 🎯 6 Estrategias — Ranking por Rentabilidad

| # | ID | Label | WR | PF | Mejor TF | Notas |
|---|---|---|---|---|---|---|
| 1 | `ElTigre` | El Tigre | 37% | **1.81** | 1D | Swing pullback EMA · BNB longs bloqueados |
| 2 | `GatilloFacil` | Gatillo Fácil | 48% | 1.55 | 4H | BB fade mean-reversion |
| 3 | `MarceMillo` | MarceMillo | 45% | 1.48 | 1H | Momentum SOL · VWAP + ADX |
| 4 | `SaltandoDelLambo` | Del Lambo | 42% | 1.38 | 4H | Rango Donchian · mercados laterales |
| 5 | `SmartMoney` | Smart Money | 38% | 1.22 | 4H | Estructura ICT LH+LL / HL+HH |
| 6 | `VWAPMomentum` | VWAP | 35% | 1.15 | 1H | Cruce VWAP con volumen · trending |

> 💡 En el header del dashboard, las estrategias se muestran ordenadas de mejor a peor. Hover para ver stats completos.

---

## 🛡️ Gestión de Riesgo

- **MAX_OPEN_TRADES=6** — máximo simultáneo
- **MAX_SIGNALS_PER_DAY=20** — rate limit diario (persiste en DB)
- **MAX_SIGNALS_PER_HOUR=0** — sin límite horario
- **RISK_PER_TRADE_USDT=100** — riesgo fijo por operación
- **tickRunning guard** — evita ticks concurrentes (race condition fix)
- **Cooldown timeframe-aware**: 1h cooldown para 1h/4h · 24h para 1D
- **BNB longs bloqueados en ElTigre** (6 pérdidas seguidas detectadas en backtest)
- **BTC como filtro de régimen** — evalúa tendencia macro, nunca opera

---

## 🖥️ Dashboard

### Funcionalidades del Frontend

| Feature | Descripción |
|---|---|
| **Gráfico interactivo** | Velas + 9 indicadores + señales como flechas clickeables |
| **Resize chart** | Drag handle entre gráfico y Trades para redimensionar |
| **Colapsar Trades** | Botón `⌄` en header de Trades → gráfico se expande a pantalla completa |
| **Barra de estrategias** | Ranking visual, hover con tooltip (WR, PF, pares, TF) |
| **Archivo de trades** | Check → Archivar · filtros ganadora/perdedora · sort date/PnL |
| **Bot ON/OFF** | Toggle en header · modo offline evalúa sin ejecutar |
| **Backtest page** | Simulación histórica con datos reales de Binance |

---

## 📁 Estructura del Proyecto

```
trading-bot/
├── backend/src/
│   ├── server.ts
│   ├── core/
│   │   ├── StrategyEngine.ts        # Loop 15s · tickRunning guard · cooldown TF-aware
│   │   ├── OrderExecutor.ts         # Ejecución + trailing stop + partial TP
│   │   ├── indicators.ts            # EMA, BB, VWAP, ATR, RSI, SMA, Donchian, ADX
│   │   └── strategies/
│   │       ├── ElTigre.ts           # Swing pullback EMA 1D · BNB no-long
│   │       ├── GatilloFacil.ts      # BB fade 4H
│   │       ├── MarceMillo.ts        # Momentum 1H · SOL
│   │       ├── SaltandoDelLambo.ts  # Donchian range 4H
│   │       ├── SmartMoney.ts        # ICT structure 1H/4H
│   │       └── VWAPMomentum.ts      # VWAP cruce 1H
│   ├── exchanges/
│   │   ├── BinanceAdapter.ts        # Spot testnet
│   │   └── FuturesAdapter.ts        # USD-M Futures · apalancamiento configurable
│   └── routes/
│       ├── api.ts                   # REST endpoints
│       ├── backtest.ts              # Motor backtesting (6 estrategias)
│       └── indicators.ts            # Cálculo de indicadores para el gráfico
├── frontend/src/
│   ├── App.tsx                      # Layout h-screen · resize/collapse chart
│   ├── components/
│   │   ├── Header.tsx               # Estrategias rankeadas + tooltips hover
│   │   ├── Chart.tsx                # Lightweight Charts · prop height · flexible mode
│   │   ├── TradesPanel.tsx          # Tabla + archivo + colapso
│   │   ├── SignalsPanel.tsx         # Scroll interno · click para marcar en gráfico
│   │   ├── StatsPanel.tsx           # PnL, win rate, Sharpe, rate limit
│   │   ├── BalancePanel.tsx         # Balance exchange
│   │   ├── BacktestPage.tsx         # UI backtesting completa
│   │   └── ClaudeCostPanel.tsx      # Costo Claude API
│   └── store/index.ts               # Zustand · ALL_STRATEGIES · botOffline
└── prisma/schema.prisma
```

---

## 🚀 Quick Start

### Requisitos
- Node.js v20+
- Binance Futures Testnet API Keys: https://testnet.binancefuture.com

### Instalación

```bash
git clone https://github.com/MarceloHarp/trading-bot.git
cd trading-bot
npm install
cd backend && npm install
```

### Configurar `.env` (backend/)

```env
DATABASE_URL="file:./dev.db"

# Binance Spot Testnet
BINANCE_TESTNET_API_KEY=tu_key
BINANCE_TESTNET_API_SECRET=tu_secret
BINANCE_REST_URL=https://testnet.binance.vision

# Binance Futures Testnet
BINANCE_FUTURES_API_KEY=tu_futures_key
BINANCE_FUTURES_API_SECRET=tu_futures_secret
TRADING_MODE=futures
FUTURES_LEVERAGE=3

# Bot config
TRADING_SYMBOLS=BTCUSDT,SOLUSDT,ETHUSDT,BNBUSDT,AVAXUSDT
NON_TRADABLE_SYMBOLS=BTCUSDT
TRADING_TIMEFRAMES=1h,4h,1d
MAX_OPEN_TRADES=6
RISK_PER_TRADE_USDT=100
AUTO_EXECUTE=true

# Email alerts
ALERT_EMAIL_ENABLED=true
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=tu@gmail.com
ALERT_SMTP_PASS=app_password_16chars
ALERT_EMAIL_TO=tu@gmail.com
```

### Ejecutar (2 terminales)

```bash
# Terminal 1 — Backend (puerto 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (puerto 3000)
npm run dev
```

Dashboard: **http://localhost:3000**

---

## 🔧 API Endpoints

```
GET  /api/health              # Estado + config activa
GET  /api/signals             # Últimos signals
GET  /api/trades              # Lista de trades
GET  /api/trades/live-pnl     # PnL en tiempo real (open trades)
DELETE /api/trades            # Borrar todos
DELETE /api/trades/:id        # Borrar uno
POST /api/trades/:id/close    # Cerrar manualmente
POST /api/trades/close-all    # Cerrar todos
GET  /api/bot-mode            # Estado online/offline
POST /api/bot-mode            # { offline: true/false }
GET  /api/balance             # Balance del exchange
GET  /api/indicators          # Indicadores calculados
POST /api/backtest/run        # Ejecutar backtest
GET  /api/claude-cost         # Uso Claude API
```

---

## 🐛 Problemas Conocidos / Troubleshooting

| Problema | Solución |
|---|---|
| Puerto 3001 ocupado | `netstat -ano \| findstr :3001` → `taskkill /PID xxxx /F` |
| `ENOTFOUND testnet.binance.vision` | Downtime testnet — esperar |
| Balance panel error 400 | Testnet renueva sesiones — no afecta operación |
| Gráfico no redimensiona | Recargar página — el ResizeObserver se reinicializa |

---

## 📊 Resultados Backtest (Datos Reales Binance)

### Resumen por estrategia (3 años histórico)

| Estrategia | Trades | Win Rate | Profit Factor | PnL estimado |
|---|---|---|---|---|
| **ElTigre** | ~200 | 37% | **1.81** | +$1,073 (3x lev) |
| **GatilloFacil** | ~350 | 48% | 1.55 | Positivo |
| **MarceMillo** | ~180 | 45% | 1.48 | Positivo |
| **SaltandoDelLambo** | ~220 | 42% | 1.38 | Positivo (rangos) |
| **SmartMoney** | ~160 | 38% | 1.22 | Positivo |
| **VWAPMomentum** | ~135 | 35% | 1.15 | Marginal |

---

## 🎯 Roadmap

### v3.1 (próximo)
- [ ] Estrategia de scalping 5m/15m (en experimentación)
- [ ] Claude API validation activa (código listo, falta API key)

### v4.0 (futuro)
- [ ] Backtesting automático semanal con email
- [ ] Machine Learning para optimización de parámetros
- [ ] Cloud deployment 24/7 (VPS)
- [ ] Dashboard móvil

---

## 📄 Licencia

MIT License — Free to use and modify

---

*GitHub: https://github.com/MarceloHarp/trading-bot*
