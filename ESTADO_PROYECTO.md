# TRADING BOT — ESTADO DEL PROYECTO
## Actualizado: 18/5/2026 11:33:39

---

## QUE ES

Bot de trading automatico para Binance con dashboard web.
4 estrategias activas, ejecucion real de ordenes BUY/SELL, soporte Spot y Futuros (USD-M).
Modo offline para ver señales sin ejecutar. Alertas por email y Telegram.

---

## STACK

- **Backend**: Node.js + Express + TypeScript + Prisma ORM + Socket.IO
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + lightweight-charts v4
- **DB**: SQLite local (backend/prisma/dev.db)
- **Exchange**: Binance Spot Testnet o Futures Testnet (configurable)
- **IA**: Claude API (validacion de signals, opcional)

---

## ESTRUCTURA DE ARCHIVOS

```
trading-bot/
├── start-bot.bat
├── .env                              # Variables de entorno
├── .env.example
├── ESTADO_PROYECTO.md
├── backend/
│   ├── src/
│   │   ├── server.ts                 # Entry point — instancia Spot o Futures segun TRADING_MODE
│   │   ├── types/index.ts
│   │   ├── core/
│   │   │   ├── StrategyEngine.ts     # Loop, rate limiting (DB-persistent), MAX_OPEN_TRADES
│   │   │   ├── OrderExecutor.ts      # BUY/SELL con precision por par, cierre manual
│   │   │   ├── indicators.ts         # SMA, EMA, RSI, MACD, BB, VWAP, ATR, findSwings
│   │   │   └── strategies/
│   │   │       ├── SmartMoney.ts     # HH/HL + SMA200 + ATR | SL dinamico | TP min 5%
│   │   │       ├── VWAPMomentum.ts   # VWAP + RSI + MACD | SL 2.5% | TP 5%
│   │   │       ├── Confluence.ts     # Score 5+ indicadores | SL 3% | TP 5%
│   │   │       └── DruLozano.ts      # MA Stack + Sweep + OB/FVG | R:R 3:1 | TP min 5%
│   │   ├── exchanges/
│   │   │   ├── BinanceAdapter.ts     # Spot REST + WS + getCandlesPublic
│   │   │   └── FuturesAdapter.ts     # Futuros USD-M: leverage, marginType, MARKET orders
│   │   ├── integrations/
│   │   │   ├── ClaudeAPI.ts
│   │   │   └── AlertService.ts       # Email + Telegram: signal, signalOffline, tradeOpened, tradeClosed
│   │   ├── db/prisma.ts
│   │   ├── routes/
│   │   │   ├── api.ts                # Todos los endpoints REST
│   │   │   └── indicators.ts         # /indicators: EMA20 SMA200 MA50/100/150 BB VWAP zonas
│   │   └── utils/
│   │       ├── config.ts             # Lee .env con todos los parametros
│   │       └── logger.ts
│   └── prisma/schema.prisma
└── frontend/
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Header.tsx            # Symbol/TF selector + Bot ON/OFF switch + modo Spot/Futuros
        │   ├── Chart.tsx             # Velas + 9 indicadores + flechas de señales + toggle Real/Testnet
        │   ├── StatsPanel.tsx        # PnL + win rate + barras rate limit + trades abiertos
        │   ├── SignalsPanel.tsx       # Lista de signals, resalta el del trade seleccionado
        │   ├── TradesPanel.tsx        # Tabla con hora, ordenamiento, filtros, borrar, cerrar manual
        │   ├── BalancePanel.tsx       # Balance filtrado por assets relevantes
        │   └── ClaudeCostPanel.tsx
        ├── services/api.ts            # getHealth, getCandles, getSignals, getTrades, getStats,
        │                              # getBalance, getBotMode, setBotMode, getBotMode
        ├── store/index.ts             # Zustand: botOffline, selectedSignalId, setBotOffline, setSelectedSignalId
        └── types/index.ts
```

---

## ENDPOINTS API (puerto 3001)

| Endpoint | Descripcion |
|---|---|
| GET /api/health | Estado + config (tradingMode, leverage, symbols, etc) |
| GET /api/candles | Velas del testnet |
| GET /api/candles-public | Velas de Binance real (anos de historia) |
| GET /api/indicators | EMA20, SMA200, MA50/100/150, BB, VWAP, zonas liquidez |
| GET /api/signals | Ultimos signals |
| GET /api/trades | Trades con filtro status |
| GET /api/stats | PnL, win rate, rate limit, trades abiertos |
| GET /api/balance | Balance del exchange |
| GET /api/bot-mode | Estado online/offline |
| POST /api/bot-mode | Cambiar modo online/offline |
| POST /api/trades/:id/close | Cerrar un trade manualmente al precio actual |
| POST /api/trades/close-all | Cerrar todos los trades abiertos |
| DELETE /api/trades/:id | Borrar un trade de la DB |
| DELETE /api/trades | Borrar todos los trades |
| GET /api/claude-cost | Costo Claude API |
| GET /api/logs | Logs del engine |
| POST /api/devwrite | Escritura de archivos (DEV ONLY) |

---

## LAS 4 ESTRATEGIAS

| Estrategia | TF | SL | TP | Win rate |
|---|---|---|---|---|
| SmartMoney | 4h | ATR dinamico | min 5% (R:R 3:1) | 55-60% |
| VWAPMomentum | 1h | 2.5% | 5% | 60-65% |
| Confluence | 1h/4h | 3% | 5% | 65-70% |
| DruLozano | 4h | ATR dinamico | min 5% (R:R 3:1) | 65-70% |

### DruLozano (Dru Lozano - Atrevete)
- **MA Stack**: MA50 > MA100 > MA150 > MA200 = bullish (inverso = bearish)
- **Liquidity Sweep**: precio barre swing y revierte (manipulacion institucional)
- **Order Block**: vela de cuerpo fuerte donde instituciones inyectaron capital
- **Fair Value Gap**: gap entre 3 velas que el mercado tiende a rellenar
- Colores exactos del informe: MA50=amarillo, MA100=azul, MA150=violeta, MA200=rojo

---

## INDICADORES EN EL GRAFICO

Seccion "Bot": EMA20, BB Upper/Mid/Lower (punteado), VWAP
Seccion "Dru": MA50, MA100, MA150, MA200

Toggle 🌐 Real / 🧪 Testnet: datos de Binance real o testnet para el grafico
Flechas en el grafico: señales detectadas (▲ verde=long, ▼ roja=short)
Click en flecha: popup con estrategia, entry, SL, TP, R:R, razon
Zonas de liquidez: R=resistencia (shorts acumulados), S=soporte (longs acumulados)

---

## VARIABLES DE ENTORNO (.env actual)

```env
DATABASE_URL="file:./dev.db"

# Spot Testnet
BINANCE_TESTNET_API_KEY=y9D86dqagNG4SIux1Ykpfb4JySvK8RgkBj3EwR3FwoBm2PoLVCBs4yKnxjG65z8P
BINANCE_TESTNET_API_SECRET=yEdshwsWhGwEnXdRBGhqCkJWE7BkbTSuNWHvzqoUofKV034SyxVS2RV6QolZu5KI
BINANCE_REST_URL=https://testnet.binance.vision
BINANCE_WS_URL=wss://stream.testnet.binance.vision

# Modo: spot o futures
TRADING_MODE=spot

# Futuros Testnet (https://testnet.binancefuture.com)
FUTURES_TESTNET_API_KEY=
FUTURES_TESTNET_API_SECRET=
FUTURES_REST_URL=https://testnet.binancefuture.com
FUTURES_LEVERAGE=5
FUTURES_MARGIN_TYPE=ISOLATED

# Claude API
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6

# Servidor
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Bot
TRADING_SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT
TRADING_TIMEFRAMES=1m,1h,4h
ENGINE_INTERVAL_MS=15000
RISK_PER_TRADE_USDT=100
AUTO_EXECUTE=true
CLAUDE_VALIDATION=false

# Limites
MAX_OPEN_TRADES=5
MAX_SIGNALS_PER_HOUR=0
MAX_SIGNALS_PER_DAY=20

# Alertas Email (Gmail)
ALERT_EMAIL_ENABLED=true
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=negro.y.gti@gmail.com
ALERT_SMTP_PASS=xxxx (configurada)
ALERT_EMAIL_TO=negro.y.gti@gmail.com

# Alertas Telegram
ALERT_TELEGRAM_ENABLED=false
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=
```

---

## FUNCIONALIDADES DEL DASHBOARD

### Header
- Selector de Symbol y Timeframe (1m a 1M)
- Switch Bot ON/OFF — modo offline muestra señales sin ejecutar
- Indicadores DB / Binance / WS
- Modo Spot (azul) o Futuros xN (violeta)

### Grafico
- Velas japonesas con indicadores superpuestos
- Toggle datos reales Binance / testnet
- Flechas clickeables de señales detectadas
- Zonas de liquidez con distancia % al precio actual

### Panel Trades
- Filtros: Todo / Abiertos / Cerrados
- Ordenamiento por: Apertura, Symbol, Dir, PnL
- Hora de apertura y cierre
- Boton X por fila (borrar con confirmacion)
- Boton Cerrar por fila — solo trades abiertos (con confirmacion, ejecuta SELL en Binance)
- Boton "Cerrar todo" — cierra todas las posiciones abiertas
- Boton "Borrar todo" — borra todos los registros
- Click en fila — resalta el signal asociado en el panel derecho

### Panel Signals
- Resalta el signal del trade seleccionado (sube al tope con borde azul)
- Click en signal — modal con todos los indicadores

### Panel Balance
- Solo muestra assets relevantes (USDT, BTC, ETH, BNB, ADA + bases de TRADING_SYMBOLS)
- Refresh cada 30s + boton manual

### StatsPanel
- PnL total, Win Rate, Trades, Signals
- Barras de rate limit: por hora, por dia, posiciones abiertas

---

## MODOS DE OPERACION

### Bot ONLINE (switch verde)
- Detecta señales y ejecuta ordenes en Binance automaticamente
- Alertas: signal detectado + trade abierto + trade cerrado

### Bot OFFLINE (switch naranja - ⏸ Bot OFF)
- El engine sigue evaluando todas las estrategias
- NO ejecuta ordenes en Binance
- Las señales aparecen como flechas en el grafico
- Alerta por email: "👁 [OFFLINE] Señal BUY BTCUSDT"

---

## PRECISION DE CANTIDAD POR PAR

| Par | Decimales | Ejemplo con 100 USDT |
|---|---|---|
| BTCUSDT | 5 | 0.00128 BTC |
| ETHUSDT | 4 | 0.0468 ETH |
| BNBUSDT | 3 | 0.163 BNB |
| ADAUSDT | 0 | 153 ADA |
| SOLUSDT | 2 | 1.17 SOL |

---

## COMO ACTIVAR FUTUROS

1. Entrar a https://testnet.binancefuture.com y generar API keys
2. En .env:
   TRADING_MODE=futures
   FUTURES_TESTNET_API_KEY=tu_key
   FUTURES_TESTNET_API_SECRET=tu_secret
   FUTURES_LEVERAGE=5       (1-125)
   FUTURES_MARGIN_TYPE=ISOLATED  (o CROSSED)
3. Reiniciar backend
4. El header mostrara "Futuros x5" en violeta

---

## ALERTAS POR EMAIL

| Evento | Asunto |
|---|---|
| Bot online detecta señal | [BUY] BTCUSDT 1h — Confluence |
| Bot offline detecta señal | 👁 [OFFLINE] Señal BUY BTCUSDT |
| Trade abierto en Binance | ✅ Trade abierto: BUY BTCUSDT @ 78013 |
| Trade cerrado target | 🎯 Trade cerrado: GANANCIA +5.23 USDT |
| Trade cerrado stop | 🛑 Trade cerrado: PERDIDA -2.50 USDT |
| Rate limit alcanzado | ⏸ Bot pausado — limite de señales |

---

## PARA NUEVA SESION CON CLAUDE

Pega esto al inicio:

"Tengo un trading bot para Binance Testnet en localhost.
Backend Node.js/Express/TypeScript puerto 3001, frontend React/Vite puerto 3000.
DB SQLite + Prisma. 4 estrategias: SmartMoney, VWAPMomentum, Confluence, DruLozano.
Soporte Spot y Futuros (TRADING_MODE=spot/futures).
AUTO_EXECUTE=true, MAX_OPEN_TRADES=5, MAX_SIGNALS_PER_DAY=20.
RISK_PER_TRADE_USDT=100. TP minimo 5% en todas las estrategias.
Precision de cantidad por par: BTC=5dec, ETH=4dec, ADA=0dec, SOL=2dec.
Alertas por email configuradas (Gmail). Telegram deshabilitado.
Bot ON/OFF switch en el header. Flechas de señales en el grafico.
Click en trade del panel -> resalta signal en panel derecho.
Endpoint POST /api/devwrite para editar archivos directamente.
Endpoint POST /api/trades/:id/close para cerrar trade manualmente.

Proyecto en: C:\Users\elkun\Documents\Bot traiding con Claude Code y Pionex\trading-bot

Para editar archivos:
1. Conectar extension Claude in Chrome
2. Navegar a http://localhost:3000
3. fetch POST a http://localhost:3001/api/devwrite con {file, content}
   O crear scripts .js y correr con node desde la carpeta raiz.

Bugs conocidos:
- meta en prisma.signal.create debe ser JSON.stringify(signal.meta)
- Testnet Binance solo tiene ~12 dias de historia (usar /api/candles-public para el grafico)
- TRADING_MODE=spot usa BinanceAdapter, futures usa FuturesAdapter
- getRateLimitStats() es async (await en routes/api.ts)"

---

## ESTADO ACTUAL (18/5/2026)

| Variable | Valor |
|---|---|
| TRADING_MODE | spot |
| AUTO_EXECUTE | true |
| MAX_OPEN_TRADES | 5 |
| MAX_SIGNALS_PER_DAY | 20 |
| RISK_PER_TRADE_USDT | 100 USDT |
| Estrategias | SmartMoney, VWAPMomentum, Confluence, DruLozano |
| Pares | BTCUSDT, ETHUSDT, ADAUSDT, SOLUSDT |
| Timeframes | 1m, 1h, 4h |
| TP minimo | 5% en todas las estrategias |
| Email alertas | Activo (negro.y.gti@gmail.com) |
| DB | Limpia (reset manual realizado) |
