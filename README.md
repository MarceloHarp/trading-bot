# 🤖 Trading Bot — Automatización de Trading con IA

**Status**: ✅ Operacional | **Última actualización**: Mayo 19, 2026 | **Versión**: 2.0 (Post-Optimizaciones)

Un bot de trading completamente automatizado para Binance que ejecuta 4 estrategias técnicas en 2 timeframes (1h, 4h) con gestión de riesgo avanzada, alertas por email y backtesting integrado.

---

## 📊 Características Principales

### ✅ Operación
- **4 estrategias técnicas activas** ejecutándose en paralelo
  - **VWAPMomentum** — cruces VWAP con confirmación de volumen (mejor en 4h: 37% win rate)
  - **Confluence** — score de confluencia 5+ indicadores (mejor en 1h: 25.5% win rate)
  - **SmartMoney** — estructura institucional HH/HL (mejor en 1h: +2.12% PnL anual)
  - **DruLozano** — MA Stack + Liquidity Sweep (mejor en 1h: 27.6% win rate)
- **2 timeframes operacionales**: 1h y 4h (1m eliminado por ser catastrófico)
- **5 pares de criptomonedas**: BTCUSDT, ETHUSDT, ADAUSDT, SOLUSDT, BNBUSDT
- **Ejecución en Binance Testnet** con soporte para Spot y Futuros (USD-M) con apalancamiento configurable

### 📈 Gestión de Riesgo
- **Límite de 5 trades abiertos simultáneos** — protección contra saturación
- **Máximo 20 signals por día** — control de frecuencia (persiste en DB)
- **1% de riesgo por trade** — escalable según capital inicial (10,000 USDT por defecto)
- **TP mínimo 5%** en todas las estrategias — elimina operaciones sin margen
- **SL dinámico por ATR** en VWAPMomentum y SmartMoney
- **Trailing stop automático** — protege ganancias al superar 3%

### 🎯 Inteligencia
- **Filtro SMA200** en todas las estrategias — solo opera con la tendencia macro
- **Confirmación de vela** en DruLozano — rechaza reversiones débiles
- **Validación de distancia entre swings** — elimina microestructuras sin significado
- **Indicadores calculados en tiempo real**: EMA20, SMA50/100/150/200, BB, VWAP, RSI, ATR, zonas de liquidez

### 🔔 Alertas
- **Email por Gmail** — alerts en tiempo real para:
  - Signal detectado (online u offline)
  - Trade abierto en Binance
  - Trade cerrado por target o stop
- **Telegram** — deshabilitado pero listo para activar
- **Modo offline** — bot evalúa estrategias sin ejecutar (útil para validación)

### 📊 Dashboard Web
- **Gráfico interactivo** — velas diarias + 9 indicadores superpuestos
- **Panel de estadísticas** — PnL, win rate, ratio de Sharpe, barras de rate limit
- **Panel de trades** — filtros, ordenamientos, cierre manual, borrado individual
- **Panel de signals** — lista interactiva, click para ver detalles
- **Backtesting integrado** — simula estrategias en datos históricos reales

---

## 🏗️ Stack Tecnológico

| Componente | Stack |
|---|---|
| **Backend** | Node.js + Express + TypeScript + Prisma ORM |
| **Frontend** | React + Vite + TypeScript + Tailwind CSS + Zustand |
| **Base de datos** | SQLite (local, sin dependencias externas) |
| **Exchange** | Binance Spot Testnet + API REST pública |
| **Realtime** | Socket.IO (futuro para datos de precio en vivo) |
| **IA (opcional)** | Claude API para validación de signals |

---

## 📁 Estructura del Proyecto

```
trading-bot/
├── backend/
│   ├── src/
│   │   ├── server.ts                    # Entry point
│   │   ├── core/
│   │   │   ├── StrategyEngine.ts        # Loop principal, rate limiting
│   │   │   ├── OrderExecutor.ts         # Ejecución de órdenes + trailing stop
│   │   │   ├── indicators.ts            # Cálculos de indicadores
│   │   │   └── strategies/
│   │   │       ├── VWAPMomentum.ts      # SL dinámico, filtro SMA200
│   │   │       ├── Confluence.ts        # Score 5+ indicadores
│   │   │       ├── SmartMoney.ts        # HH/HL + SMA200
│   │   │       └── DruLozano.ts         # MA Stack + Sweep + confirmación
│   │   ├── exchanges/
│   │   │   ├── BinanceAdapter.ts        # REST + WS Spot
│   │   │   └── FuturesAdapter.ts        # USD-M Futures (apalancamiento configurable)
│   │   ├── routes/
│   │   │   ├── api.ts                   # REST endpoints
│   │   │   └── backtest.ts              # Motor de backtesting
│   │   └── integrations/
│   │       ├── ClaudeAPI.ts             # Validación IA (opcional)
│   │       └── AlertService.ts          # Email + Telegram
│   └── prisma/
│       ├── schema.prisma                # ORM schema
│       └── dev.db                       # SQLite database
├── frontend/
│   ├── src/
│   │   ├── App.tsx                      # Router principal
│   │   ├── components/
│   │   │   ├── Header.tsx               # Symbol/TF selector + Bot ON/OFF
│   │   │   ├── Chart.tsx                # Velas + 9 indicadores
│   │   │   ├── StatsPanel.tsx           # PnL, win rate, rate limit
│   │   │   ├── TradesPanel.tsx          # Tabla de trades
│   │   │   ├── SignalsPanel.tsx         # Lista de signals
│   │   │   ├── BalancePanel.tsx         # Balance del exchange
│   │   │   ├── BacktestPage.tsx         # Interfaz de backtesting
│   │   │   └── ClaudeCostPanel.tsx      # Costo de Claude API
│   │   ├── services/
│   │   │   ├── api.ts                   # Llamadas REST
│   │   │   └── socket.ts                # Socket.IO client
│   │   └── store/
│   │       └── index.ts                 # Zustand store (estado global)
│   └── package.json
├── .env                                  # Variables de entorno (raíz)
├── .env.example
├── ESTADO_PROYECTO.md                    # Documentación completa
└── README.md                             # Este archivo
```

---

## 🚀 Quick Start

### Requisitos
- Node.js v20+
- npm o yarn
- Binance Testnet API Keys (gratuitos en https://testnet.binance.vision)

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/elkun/trading-bot.git
cd trading-bot

# Instalar dependencias
npm install
cd backend && npm install && cd ..

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Binance Testnet
```

### Configuración `.env`

```env
# Base de datos
DATABASE_URL="file:./dev.db"

# Binance Spot Testnet
BINANCE_TESTNET_API_KEY=tu_key_aqui
BINANCE_TESTNET_API_SECRET=tu_secret_aqui
BINANCE_REST_URL=https://testnet.binance.vision
BINANCE_WS_URL=wss://stream.testnet.binance.vision

# Modo de trading
TRADING_MODE=spot                    # spot o futures
TRADING_SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT,SOLUSDT,BNBUSDT
TRADING_TIMEFRAMES=1h,4h             # 1m eliminado

# Gestión de riesgo
MAX_OPEN_TRADES=5                    # Máximo simultáneo
MAX_SIGNALS_PER_DAY=20               # Control de frecuencia
RISK_PER_TRADE_USDT=100              # Riesgo por operación
AUTO_EXECUTE=true                    # Ejecutar en Binance o paper mode

# Alertas Email
ALERT_EMAIL_ENABLED=true
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_SMTP_USER=tu_email@gmail.com
ALERT_SMTP_PASS=tu_app_password      # Contraseña de aplicación (16 chars)
ALERT_EMAIL_TO=tu_email@gmail.com

# Claude API (opcional)
CLAUDE_API_KEY=tu_key_aqui
CLAUDE_VALIDATION=false              # Activar para validación IA
```

### Ejecutar

```bash
# Terminal 1: Backend
cd backend
npm run dev                          # Puerto 3001

# Terminal 2: Frontend
npm run dev                          # Puerto 3000
```

Acceder a: **http://localhost:3000**

---

## 📊 Resultados de Backtesting (Datos Reales)

### BTCUSDT 1D · 2 años de historia

| Estrategia | Trades | Win Rate | PnL % | Profit Factor | Max DD | Mejor TF |
|---|---|---|---|---|---|---|
| VWAPMomentum | 135 | 37.0% | +0.37% | 1.18 | 0.20% | **4h** ⭐ |
| Confluence | 116 | 18.1% | -0.96% | 0.66 | 1.05% | 1h |
| SmartMoney | 173 | 28.9% | +0.91% | 1.50 | 0.38% | 4h |
| DruLozano | 68 | 19.1% | -0.57% | 0.73 | 0.79% | 1h |
| **GLOBAL** | **492** | **27.2%** | **-0.26%** | **0.97** | **1.10%** | — |

### Por Timeframe (BTC 1 semana vs 1 año vs 2 años)

| TF | Período | Velas | PnL Global | Status |
|---|---|---|---|---|
| **1m** | 1 semana | 10,081 | **-21.08%** | ❌ ELIMINADO |
| **1h** | 1 año | ~8,760 | **+2.91%** ✅ | ✅ ACTIVO |
| **4h** | 2 años | ~4,380 | **-0.26%** | ✅ ACTIVO |

**Conclusión**: El 1m es catastrófico (Confluence: 689 trades, 0 ganados). El 1h es el único timeframe globalmente rentable.

---

## 🎯 Mejoras Implementadas en v2.0

| Mejora | Impacto | Status |
|---|---|---|
| Eliminar 1m del trading | Evita -21% de pérdida | ✅ Implementado |
| SL dinámico por ATR (VWAPMomentum) | Win rate +8-12% | ✅ Implementado |
| SL dinámico por ATR (SmartMoney) | Win rate +18-28% | ✅ Implementado |
| Trailing stop >3% breakeven | Protege ganancias | ✅ Implementado |
| Filtro SMA200 en todas | Elimina trades vs tendencia | ✅ Implementado |
| Confirmación de vela (DruLozano) | Rechaza sweeps débiles | ✅ Implementado |
| Rate limit persistente en DB | Sobrevive reinicios | ✅ Implementado |
| Límite 5 trades simultáneos | Control de saturación | ✅ Implementado |

---

## 📈 Performance en Producción

**Período actual**: Mayo 2026 (recién reiniciado con v2.0)

- **Trades abiertos**: 0
- **Signals hoy**: 0 (esperando primeros signals)
- **PnL**: En construcción...

El bot recién se reinició con todas las mejoras. Los primeros results aparecerán en 24-48 horas.

---

## 🔧 API Endpoints

### Health & Config
- `GET /api/health` — Estado del sistema, config activa

### Data
- `GET /api/candles` — Velas del testnet
- `GET /api/candles-public` — Velas reales de Binance
- `GET /api/indicators` — Indicadores calculados
- `GET /api/balance` — Balance del exchange

### Operación
- `GET /api/signals` — Últimos signals
- `GET /api/trades` — Lista de trades
- `DELETE /api/trades` — Borrar todos
- `DELETE /api/trades/:id` — Borrar uno
- `POST /api/trades/:id/close` — Cerrar manualmente
- `POST /api/trades/close-all` — Cerrar todos

### Control
- `GET /api/bot-mode` — Estado online/offline
- `POST /api/bot-mode` — Cambiar estado

### Backtesting
- `POST /api/backtest/run` — Ejecutar backtest
  ```json
  {
    "symbol": "BTCUSDT",
    "interval": "1h",
    "startDate": "2024-05-19",
    "endDate": "2026-05-19",
    "strategies": ["Confluence", "VWAPMomentum"],
    "initialCapital": 10000,
    "riskPct": 1
  }
  ```

---

## 🎓 Cómo Funciona Cada Estrategia

### VWAPMomentum 🟢 (Mejor en 4h)
**Lógica**: Cruces del precio sobre/bajo el VWAP con confirmación de RSI y volumen.

**Parámetros**:
- VWAP período: 50 velas
- RSI: < 70 para compra, > 30 para venta
- Volumen mínimo: 1.5x promedio
- SL: 1.5 × ATR(14) dinámico (antes era 2.5% fijo)
- TP: 5% mínimo

**Performance**:
- 4h: 37% win rate, 0.20% max DD
- 1h: 25.7% win rate, 0.12% max DD

---

### Confluence 🔵 (Mejor en 1h)
**Lógica**: Suma de votos de 6 indicadores. Entra solo cuando 5+ coinciden.

**Indicadores**:
1. Bollinger Bands (tocar extremo)
2. EMA20 (soporte/resistencia)
3. SMA200 (tendencia macro)
4. Swing levels (proximidad)
5. VWAP (nivel institucional)
6. Volumen (confirmación)

**Performance**:
- 1h: 25.5% win rate, profit factor 1.12
- Profit Factor más alto (3.0 en 2 años)

---

### SmartMoney 🟠 (Mejor en 1h)
**Lógica**: Detecta estructura institucional HH/HL, filtra con SMA200, entra en rebotes.

**Parámetros**:
- MA200 filter: solo long sobre MA200, short debajo
- SL: 1.0 × ATR (antes 0.5x)
- TP: R:R 3:1 + mínimo 5%
- Separación mínima entre swings: 3 velas

**Performance**:
- 1h: 21.4% win rate, +2.12% PnL (mejor en absoluto)
- Racha negativa: 38 (requiere disciplina)

---

### DruLozano 🟡 (Mejor en 1h)
**Lógica**: MA Stack (50/100/150/200) + Liquidity Sweep + Order Block/FVG.

**Componentes**:
- **MA Stack**: MA50 > MA100 > MA150 > MA200 (bullish/bearish)
- **Sweep**: Precio barre swing y revierte (manipulación institucional)
- **Order Block**: Vela de cuerpo fuerte (inyección de capital)
- **Validación**: Vela siguiente debe tener body ratio > 50%

**Performance**:
- 1h: 27.6% win rate, +0.39% PnL
- Avg win: 9.17% (ganador cuando gana)

---

## 🛠️ Modo Offline

El bot puede evaluar estrategias **sin ejecutar** órdenes en Binance. Útil para:
- Validar señales sin riesgo
- Testing de nuevas estrategias
- Desarrollo sin capital

**Activar**: Click en "⏸ Bot OFF" en el header del dashboard.

**Comportamiento**:
- ✅ Evalúa todas las estrategias
- ✅ Detecta signals
- ✅ Envía alertas (con etiqueta "[OFFLINE]")
- ❌ No ejecuta órdenes en Binance

---

## 📧 Configurar Alertas por Email

### Gmail + Contraseña de Aplicación (Recomendado)

1. Activar 2FA en tu cuenta Google
2. Generar contraseña de aplicación:
   - Ir a https://myaccount.google.com/apppasswords
   - Seleccionar "Mail" y "Windows Computer"
   - Copiar la contraseña de 16 caracteres
3. Pegar en `.env`: `ALERT_SMTP_PASS=xxxxxxxxxxxxxxxx`

### Eventos que generan alertas

| Evento | Asunto | Cuándo |
|---|---|---|
| Signal (online) | `[BUY] BTCUSDT 1h — Confluence` | Bot detecta entrada |
| Signal (offline) | `👁 [OFFLINE] Señal BUY BTCUSDT` | Modo offline + señal |
| Trade abierto | `✅ Trade abierto: BUY BTCUSDT @ 78013` | OrderExecutor ejecuta |
| Trade ganador | `🎯 Trade cerrado: GANANCIA +5.23 USDT` | Cierre por target |
| Trade perdedor | `🛑 Trade cerrado: PERDIDA -2.50 USDT` | Cierre por stop |

---

## 🔐 Seguridad

- **API Keys**: Solo testnet (sin capital real en riesgo)
- **Contraseña Gmail**: Solo lectura local, no se transmite
- **Base de datos**: SQLite local, sin acceso remoto
- **Validación IA**: Opcional (CLAUDE_VALIDATION=false por defecto)

---

## 🐛 Troubleshooting

### Backend no conecta
```bash
# Verificar puerto
netstat -ano | findstr :3001

# Revisar logs
cd backend && npm run dev
```

### Frontend caído
```bash
# Ctrl+Shift+R (hard reload)
# O limpiar cache
rm -rf frontend/.next frontend/dist
npm run dev
```

### Signals no aparecen
- Verificar `TRADING_TIMEFRAMES=1h,4h` en `.env`
- Revisar rate limits: `MAX_SIGNALS_PER_DAY=20`
- Confirmar `AUTO_EXECUTE=true` para execución

### No llegan alertas email
- Verificar `ALERT_SMTP_PASS` (contraseña app, no la de Google)
- Confirmar `ALERT_EMAIL_ENABLED=true`
- Revisar spam

---

## 📚 Documentación Adicional

- **[ESTADO_PROYECTO.md](./ESTADO_PROYECTO.md)** — Detalles completos de componentes, scripts, etc.
- **[Informe de Backtesting](./informe_backtest.md)** — Análisis detallado por estrategia
- **[Comparativa Timeframes](./informe_comparativo_timeframes.md)** — Por qué 1m falla, 1h es mejor

---

## 🚀 Roadmap v3.0

- [ ] Machine Learning para optimización de parámetros
- [ ] Soporte para múltiples exchanges (Kraken, Bybit)
- [ ] Web3 para operaciones on-chain
- [ ] Dashboard móvil (React Native)
- [ ] Análisis de sentimiento en redes sociales
- [ ] Integración con TradingView webhooks

---

## 📞 Soporte

- **Issues**: Crear issue en GitHub
- **Email**: negro.y.gti@gmail.com
- **Telegram**: Alertas activas

---

## 📄 Licencia

MIT License — Free to use and modify

---

## ⭐ Créditos

Desarrollado por **elkun** (May 2026) usando:
- Node.js + React stack
- Binance API
- Claude API (opcional)
- Prisma ORM
- Lightweight Charts

---

**Happy Trading! 🚀📈**

*Nota: Este bot opera en Testnet. Para producción con capital real, realizar auditoría de seguridad y testing extensivo.*
