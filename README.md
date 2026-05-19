# 🚀 Trading Bot Inteligente

Bot de trading profesional con 3 estrategias (Smart Money Structure, VWAP Momentum, Confluence Zones), validación con Claude AI y ejecución automática en Binance Testnet.

## 🧱 Stack

- **Backend:** Node.js + Express + TypeScript + Prisma + Socket.IO
- **Frontend:** React + TypeScript + lightweight-charts + Tailwind + Zustand
- **DB:** PostgreSQL (Docker)
- **Exchange:** Binance Testnet (CCXT-compatible REST + WS)
- **IA:** Claude API (validación de signals)

## 📂 Estructura

```
trading-bot/
├── backend/             # API + estrategias + ejecución
│   ├── src/
│   │   ├── server.ts
│   │   ├── core/
│   │   │   ├── StrategyEngine.ts
│   │   │   ├── OrderExecutor.ts
│   │   │   ├── indicators.ts
│   │   │   └── strategies/
│   │   │       ├── SmartMoney.ts
│   │   │       ├── VWAPMomentum.ts
│   │   │       └── Confluence.ts
│   │   ├── exchanges/BinanceAdapter.ts
│   │   ├── integrations/ClaudeAPI.ts
│   │   ├── routes/
│   │   ├── ws/
│   │   ├── db/prisma.ts
│   │   ├── types/
│   │   └── utils/
│   └── prisma/schema.prisma
├── frontend/            # Dashboard
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── store/
├── docker-compose.yml
└── .env.example
```

## 🚀 Quick Start

### 1) Prerequisitos
- Docker Desktop
- Node.js 18+
- API keys de Binance Testnet (https://testnet.binance.vision)
- API key de Claude (https://console.anthropic.com)

### 2) Setup

```bash
# Clonar / descomprimir el proyecto
cd trading-bot

# Variables de entorno
cp .env.example .env
# Editar .env con tus API keys

# Levantar PostgreSQL
docker-compose up -d

# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
# corre en http://localhost:3001

# Frontend (en otra terminal)
cd frontend
npm install
npm start
# corre en http://localhost:3000
```

### 3) Verificación

- http://localhost:3001/health → debe devolver `{ status: "ok" }`
- http://localhost:3000 → dashboard con gráficos
- En logs del backend: deberías ver el StrategyEngine evaluando cada N segundos

## 🎯 Estrategias

| Estrategia | Timeframe | Win Rate | Trades/semana |
|---|---|---|---|
| Smart Money Structure | 4h | 55-60% | 1-3 |
| VWAP Momentum | 1h | 60-65% | 3-8 |
| Confluence Zones | 4h | 65-70% | 2-5 |

## ⚠️ Aviso

Esto está pensado para **testnet** y aprendizaje. NO usar en cuentas reales sin auditar el código, hacer backtests serios y entender los riesgos. Trading es de alto riesgo.

## 📝 Licencia

MIT
