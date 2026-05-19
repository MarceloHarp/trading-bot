# 🏗️ Arquitectura del Trading Bot

Una guía profunda de cómo funciona el bot internamente.

---

## 📐 Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  http://localhost:3000                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Dashboard  │  │   Chart      │  │  Backtest    │          │
│  │   (Stats,    │  │  (Velas +    │  │  (Simulador) │          │
│  │   Trades,    │  │  9 indicadores)  │             │          │
│  │   Signals)   │  │  Real + Test │  │             │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                    REST API + Socket.IO                         │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                 BACKEND (Node.js + Express)                     │
│            http://localhost:3001                                │
│                            │                                    │
│  ┌────────────────────────┴─────────────────────────┐           │
│  │                                                  │           │
│  ▼                                                  ▼           │
│ ┌─────────────────────────────────┐  ┌──────────────────────┐  │
│ │     StrategyEngine (Loop)       │  │   OrderExecutor      │  │
│ │                                 │  │                      │  │
│ │ • Cada 15s                      │  │ • Monitorea trades   │  │
│ │ • Lee velas reales              │  │ • Cierra por TP/SL   │  │
│ │ • Evalúa 4 estrategias          │  │ • Trailing stop      │  │
│ │ • Genera signals                │  │ • Persiste en DB     │  │
│ │ • Respeta rate limits           │  │                      │  │
│ │ • MAX_OPEN_TRADES=5             │  │                      │  │
│ │ • MAX_SIGNALS_PER_DAY=20        │  │                      │  │
│ └─────────────────────────────────┘  └──────────────────────┘  │
│           │                                    │                │
│           │                                    │                │
│  ┌────────▼──────────────────────────────────▼──────────────┐  │
│  │         Indicators (EMA, BB, VWAP, ATR, RSI, etc)        │  │
│  │         Candles (real + testnet)                         │  │
│  └────────▲──────────────────────────────────▲──────────────┘  │
│           │                                    │                │
│  ┌────────┴──────────────────────────────────┴──────────────┐  │
│  │              Strategies (4)                              │  │
│  │  ┌─────────────────┐  ┌─────────────────┐              │  │
│  │  │ VWAPMomentum    │  │ Confluence      │              │  │
│  │  │ (37% WR en 4h)  │  │ (25.5% WR en 1h)              │  │
│  │  └─────────────────┘  └─────────────────┘              │  │
│  │  ┌─────────────────┐  ┌─────────────────┐              │  │
│  │  │ SmartMoney      │  │ DruLozano       │              │  │
│  │  │ (+2.12% en 1h)  │  │ (27.6% WR en 1h)              │  │
│  │  └─────────────────┘  └─────────────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                           │                        │
└───────────┼───────────────────────────┼────────────────────────┘
            │                           │
            │                           │
    ┌───────▼───────┐        ┌──────────▼───────┐
    │ BinanceAdapter │        │ AlertService     │
    │ (REST + WS)    │        │ (Email + TG)     │
    │ • getCandlesPublic      │ • alertSignal    │
    │ • placeMarketOrder      │ • alertTraded    │
    │ • cancelOrder           │ • alertClosed    │
    │                         │                  │
    └───────┬───────┘        └──────────┬───────┘
            │                           │
            │                           │
    ┌───────▼────────────────────────────▼──────┐
    │         BINANCE API (Testnet)             │
    │  https://testnet.binance.vision           │
    │  wss://stream.testnet.binance.vision     │
    └────────────────────────────────────────────┘
            │
            │
    ┌───────▼────────────────────────────────────┐
    │         SQLite Database (local)             │
    │  backend/prisma/dev.db                     │
    │                                             │
    │  • Trades                                   │
    │  • Signals                                  │
    │  • Rate limit (persistent)                 │
    │  • Logs                                     │
    └──────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos Principal

### 1️⃣ Evaluación de Estrategias (StrategyEngine)

```
Cada 15 segundos:

1. Descargar velas reales (Binance API pública)
2. Calcular indicadores (EMA, BB, VWAP, ATR, RSI, etc)
3. Para cada estrategia:
   - VWAPMomentum → evalúa VWAP + RSI + volumen
   - Confluence → suma score de 6 indicadores
   - SmartMoney → detecta estructura HH/HL
   - DruLozano → MA Stack + Sweep + OB/FVG
4. Si detecta señal:
   - Verificar rate limits (MAX_SIGNALS_PER_DAY)
   - Verificar MAX_OPEN_TRADES (count en DB)
   - Guardar en DB (signals table)
   - Enviar alerta email
5. Retornar signal para OrderExecutor

Archivos clave:
- backend/src/core/StrategyEngine.ts
- backend/src/core/strategies/*.ts
- backend/src/core/indicators.ts
```

### 2️⃣ Ejecución de Órdenes (OrderExecutor)

```
1. Obtener signal de StrategyEngine
2. Si AUTO_EXECUTE=true:
   - Calcular cantidad según riesgo (1% por defecto)
   - Validar precision por par (BTC=5dec, ETH=4dec, etc)
   - Ejecutar market order en Binance Testnet
   - Guardar trade en DB (trades table)
   - Enviar alerta "Trade abierto"
3. Si AUTO_EXECUTE=false:
   - Paper trading (solo registra, no ejecuta)
4. Monitorear trade abierto:
   - TP alcanzado → SELL
   - SL alcanzado → SELL (con trailing stop si ganancia >3%)
   - Actualizar trade en DB
   - Enviar alerta "Trade cerrado"

Archivos clave:
- backend/src/core/OrderExecutor.ts
- backend/src/routes/api.ts (POST /api/trades)
```

### 3️⃣ Alertas (AlertService)

```
Evento → Email por Gmail

Eventos:
- Signal detectado (online/offline)
- Trade abierto
- Trade cerrado (ganancia/pérdida)
- Error crítico

Configuración:
- ALERT_SMTP_HOST=smtp.gmail.com
- ALERT_SMTP_USER=tu_email@gmail.com
- ALERT_SMTP_PASS=contraseña_app

Archivos clave:
- backend/src/integrations/AlertService.ts
```

---

## 📊 Base de Datos (Prisma ORM)

### Tablas Principales

```prisma
model Signal {
  id        String   @id @default(cuid())
  strategy  String   // "VWAPMomentum", "Confluence", etc
  symbol    String   // "BTCUSDT"
  interval  String   // "1h", "4h"
  direction String   // "BUY" o "SELL"
  price     Float    // Precio de entrada
  meta      String   // JSON stringified con detalles
  createdAt DateTime @default(now())
}

model Trade {
  id          String   @id @default(cuid())
  signalId    String
  symbol      String
  interval    String
  direction   String   // "BUY" o "SELL"
  entryPrice  Float
  quantity    Float
  targetPrice Float
  stopLoss    Float
  status      String   // "open", "closed"
  result      String   // "win", "loss", "open"
  pnl         Float?   // P&L en USDT
  pnlPct      Float?   // P&L en %
  openedAt    DateTime @default(now())
  closedAt    DateTime?
}

model RateLimit {
  id        String   @id @default(cuid())
  day       String   // YYYY-MM-DD
  count     Int      // Signals enviados hoy
  updatedAt DateTime @default(now())
}

model EngineLog {
  id        String   @id @default(cuid())
  level     String   // "info", "warn", "error"
  message   String
  createdAt DateTime @default(now())
}
```

### Consultas Principales

```javascript
// Contar signals hoy
await prisma.signal.count({
  where: {
    createdAt: {
      gte: startOfDay(new Date()),
      lt: endOfDay(new Date())
    }
  }
});

// Contar trades abiertos
await prisma.trade.count({
  where: { status: "open" }
});

// Obtener rate limit de hoy
await prisma.rateLimit.findFirst({
  where: { day: today }
});

// Obtener trades cerrados por estrategia
await prisma.trade.findMany({
  where: {
    status: "closed",
    // Relacionado por signalId + signal.strategy
  }
});
```

---

## 🎯 Flujo de Cada Estrategia

### VWAPMomentum (Mejor en 4h)

```
Entrada:
  1. Calcular VWAP(50)
  2. Si precio cruza VWAP hacia arriba:
     - RSI < 70 (no sobrecomprado)
     - Volumen > 1.5x promedio
     - Precio > SMA200 (tendencia bullish)
     → SIGNAL BUY
  3. Si precio cruza VWAP hacia abajo:
     - RSI > 30 (no sobrevendido)
     - Volumen > 1.5x promedio
     - Precio < SMA200 (tendencia bearish)
     → SIGNAL SELL

SL: 1.5 × ATR(14) dinámico
TP: 5% mínimo
Trailing: >3% breakeven, >5% trailing 50%

Archivo: backend/src/core/strategies/VWAPMomentum.ts
```

### Confluence (Mejor en 1h)

```
Score de 6 indicadores:
  1. Bollinger Bands (precio toca BB)
  2. EMA20 (soporte/resistencia)
  3. SMA200 (tendencia macro)
  4. Swing levels (proximidad a swing)
  5. VWAP (nivel institucional)
  6. Volumen (confirmación)

Entrada:
  Si score BUY >= 5 Y precio > SMA200:
    → SIGNAL BUY
  Si score SELL >= 5 Y precio < SMA200:
    → SIGNAL SELL

SL: 3% fijo
TP: 5% fijo
Win Rate esperado: 50%+ (mejor profit factor)

Archivo: backend/src/core/strategies/Confluence.ts
```

### SmartMoney (Mejor en 1h)

```
Detectar estructura institucional:
  1. Encontrar swings (highs/lows)
  2. Detectar patrón HH/HL (higher high/higher low)
  3. Si HH+HL Y precio > SMA200:
     - Esperar rebote en swing low
     - Entry cuando price > swing low
     → SIGNAL BUY

  4. Si LH+LL Y precio < SMA200:
     - Esperar rebote en swing high
     - Entry cuando price < swing high
     → SIGNAL SELL

SL: 1.0 × ATR (más amplio que antes)
TP: R:R 3:1 + mínimo 5%
Distancia mínima entre swings: 3 velas

Archivo: backend/src/core/strategies/SmartMoney.ts
```

### DruLozano (Mejor en 1h)

```
MA Stack + Liquidity Sweep + Order Block:
  1. Verificar alineación MA:
     - MA50 > MA100 > MA150 > MA200 (BULL)
     - MA50 < MA100 < MA150 < MA200 (BEAR)
  2. Detectar Liquidity Sweep:
     - Precio penetra swing low/high y revierte
  3. Detectar Order Block:
     - Vela de impulso fuerte (inyección institucional)
  4. Detectar FVG (Fair Value Gap):
     - Brecha entre velas

Entrada:
  Si Sweep + OB Y body ratio > 50% Y MA Stack alineado:
    → SIGNAL BUY/SELL

SL: 1.5 × ATR
TP: R:R 3:1 + mínimo 5%
Validación: Vela siguiente debe confirmar (body > 50%)

Archivo: backend/src/core/strategies/DruLozano.ts
```

---

## 🔐 Rate Limiting

### Persistencia en DB

```javascript
// Cada vez que se genera una signal:
const today = getStartOfDay(new Date());
const existingLimit = await prisma.rateLimit.findFirst({
  where: { day: today.toISOString().split('T')[0] }
});

if (!existingLimit) {
  // Día nuevo, resetear
  await prisma.rateLimit.create({
    data: { day: today, count: 1 }
  });
} else if (existingLimit.count < MAX_SIGNALS_PER_DAY) {
  // Incrementar
  await prisma.rateLimit.update({
    where: { id: existingLimit.id },
    data: { count: existingLimit.count + 1 }
  });
} else {
  // Rechazar signal
  return null;
}
```

**Ventaja**: Si el backend se reinicia, respeta el límite de hoy.

---

## 🚀 Backtesting

### Motor de Backtesting

```javascript
// backend/src/routes/backtest.ts

POST /api/backtest/run {
  symbol: "BTCUSDT",
  interval: "1h",
  startDate: "2024-05-19",
  endDate: "2026-05-19",
  strategies: ["Confluence", "VWAPMomentum"],
  initialCapital: 10000,
  riskPct: 1
}

Respuesta:
{
  candles: 8760,
  global: {
    totalTrades: 1371,
    wins: 353,
    losses: 1018,
    winRate: 25.7%,
    totalPnlPct: +2.91%,
    finalCapital: 10290,
    maxDrawdown: 2.31%,
    avgWin: 5.0%,
    avgLoss: -1.34%,
    profitFactor: 1.15
  },
  byStrategy: {
    Confluence: { ... },
    VWAPMomentum: { ... }
  },
  trades: [
    {
      symbol, interval, strategy, direction,
      entry, exit, pnl, pnlPct, result,
      openedAt, closedAt
    }, ...
  ]
}
```

### Ventajas

- Datos reales de Binance API
- Simula exactamente como en producción
- Calcula equity curve
- Metricas completas (drawdown, ratio Sharpe, etc)
- Filtra por estrategia y calcula stats individuales

---

## 📈 Performance Monitoring

### Métricas Calculadas

```
Win Rate = wins / (wins + losses) * 100
Profit Factor = total_wins / abs(total_losses)
Max Drawdown = peak_value / trough_value - 1
Avg Win = sum_wins / wins
Avg Loss = sum_losses / losses
Risk/Reward = avg_win / abs(avg_loss)
Sharpe Ratio = (mean_return - risk_free_rate) / std_dev
```

### Dashboard

- **PnL actual**: Suma de P&L de todos los trades
- **Win Rate**: % de trades ganadores
- **Open Trades**: Contador vs MAX_OPEN_TRADES
- **Signals hoy**: Contador vs MAX_SIGNALS_PER_DAY
- **Profit Factor**: Ganancias / Pérdidas

---

## 🔄 Flujo de Reinicio (Reset)

```bash
# Opción 1: Borrar solo trades/signals
npm run db:reset

# Opción 2: Borrar TODO y recrcar schema
cd backend
npx prisma migrate reset --force

# Opción 3: Desde el dashboard
DELETE /api/trades (borra todo)

# Rate limit se auto-resetea cada día
```

---

## 📚 Archivos Clave por Funcionalidad

| Funcionalidad | Archivo |
|---|---|
| Motor principal | `core/StrategyEngine.ts` |
| Ejecución | `core/OrderExecutor.ts` |
| VWAPMomentum | `core/strategies/VWAPMomentum.ts` |
| Confluence | `core/strategies/Confluence.ts` |
| SmartMoney | `core/strategies/SmartMoney.ts` |
| DruLozano | `core/strategies/DruLozano.ts` |
| Indicadores | `core/indicators.ts` |
| Binance API | `exchanges/BinanceAdapter.ts` |
| Alertas | `integrations/AlertService.ts` |
| Rutas REST | `routes/api.ts` |
| Backtesting | `routes/backtest.ts` |
| ORM | `prisma/schema.prisma` |
| Dashboard | `frontend/src/components/*` |

---

## 🎯 Diagrama de Estados de un Trade

```
START
  │
  ▼
SIGNAL DETECTADO
  │
  ▼
EJECUTAR ORDER (si AUTO_EXECUTE=true)
  │
  ├─→ Error → SIGNAL NO EJECUTADO
  │
  ▼
TRADE ABIERTO (status: "open")
  │
  ├─→ Precio ≥ TP → CERRAR VENTA → GANANCIA
  │
  ├─→ Precio ≤ SL → CERRAR VENTA → PÉRDIDA
  │
  ├─→ Trailing >3% → SL = breakeven
  │
  ├─→ Trailing >5% → SL = trailing 50%
  │
  └─→ Manual → CERRAR VENTA (user)
      │
      ▼
  TRADE CERRADO (status: "closed")
      │
      ├─ result: "win" (si PnL > 0)
      └─ result: "loss" (si PnL < 0)
```

---

**Para detalles específicos, revisar código fuente y comentarios en archivos.**
