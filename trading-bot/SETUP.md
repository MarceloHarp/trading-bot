# 🛠️ SETUP GUIDE — Trading Bot

Guía paso a paso para arrancar el bot en local. **Tiempo estimado: 30-45 min.**

## 0) Prerequisitos

- **Docker Desktop** corriendo → https://docker.com/products/docker-desktop
- **Node.js 18+** → https://nodejs.org/
- **Cuenta Binance Testnet** → https://testnet.binance.vision/ (login con GitHub)
- **API key de Claude** (opcional pero recomendado) → https://console.anthropic.com/

Verificá:
```bash
node --version    # >= 18
docker --version
docker compose version
```

## 1) Crear las API keys

### Binance Testnet
1. Andá a https://testnet.binance.vision/
2. Login con GitHub
3. Click en "Generate HMAC_SHA256 Key"
4. Guardá `API Key` y `Secret Key`
5. (Opcional) Dale faucet de USDT testnet desde el panel

### Claude (opcional)
1. https://console.anthropic.com/ → API Keys
2. Crear key → guardar (empieza con `sk-ant-`)

## 2) Configurar variables de entorno

```bash
cd trading-bot
cp .env.example .env
# Editar .env y rellenar:
#   BINANCE_TESTNET_API_KEY=...
#   BINANCE_TESTNET_API_SECRET=...
#   CLAUDE_API_KEY=sk-ant-...   (o dejar vacío)
```

Para empezar en modo seguro **paper trading** (sin ejecutar órdenes reales en testnet), dejá:
```
AUTO_EXECUTE=false
CLAUDE_VALIDATION=false
```

Cuando todo ande, cambialo a `true`.

## 3) Levantar PostgreSQL

```bash
docker compose up -d
docker ps   # debería aparecer "trading-bot-db" running
```

## 4) Backend

```bash
cd backend

# Copiar .env del padre (Prisma necesita verlo desde acá)
cp ../.env .env

npm install
npx prisma generate
npx prisma db push   # crea las tablas
npm run dev
```

Si todo va bien, ves:
```
🚀 Backend escuchando en http://localhost:3001
StrategyEngine iniciado | symbols=BTCUSDT,ETHUSDT ...
```

Probá:
```bash
curl http://localhost:3001/api/health
```

Debería responder algo como:
```json
{
  "status": "ok",
  "services": { "db": true, "binance": true },
  ...
}
```

## 5) Frontend

En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:3000 → dashboard con gráficos.

## 6) Validación final

- [ ] Gráfico de velas se muestra y actualiza cada 10s
- [ ] El header muestra DB, Binance y WS en verde
- [ ] El backend imprime "Signal ..." en consola cuando una estrategia matchea
- [ ] Los signals aparecen en el panel derecho del dashboard
- [ ] Los trades aparecen en la tabla inferior cuando se ejecutan

## 7) Tuning

En `.env` podés ajustar:

| Variable | Default | Descripción |
|----|----|----|
| `TRADING_SYMBOLS` | `BTCUSDT,ETHUSDT` | Símbolos a vigilar |
| `TRADING_TIMEFRAMES` | `1h,4h` | Timeframes que evalúa cada tick |
| `ENGINE_INTERVAL_MS` | `15000` | Cada cuántos ms corre el engine |
| `RISK_PER_TRADE_USDT` | `100` | Capital por trade en USDT |
| `AUTO_EXECUTE` | `true` | true=manda órdenes a testnet, false=paper |
| `CLAUDE_VALIDATION` | `true` | true=pide veredicto a Claude antes de operar |

## 8) Troubleshooting

**`Binance: false` en /health**
- Revisá que las API keys del .env sean del **testnet**, no de mainnet.
- Algunos países tienen bloqueado el endpoint → probá con VPN.

**`prisma: db push` falla**
- Revisá que docker compose esté corriendo: `docker ps`
- Revisá `DATABASE_URL` en .env

**Frontend muestra todo gris**
- Asegurate que el backend esté en 3001
- Mirá la consola del navegador por errores de CORS

**Claude no valida**
- Revisá que `CLAUDE_API_KEY` empiece con `sk-ant-`
- Si seguís queriendo desactivarlo: `CLAUDE_VALIDATION=false`

## 9) Producción (NO HACER todavía)

Antes de pensar en plata real:
1. Backtest serio con 1+ año de datos
2. 1 mes mínimo en testnet con AUTO_EXECUTE
3. Auditar el OrderExecutor: tamaños, redondeo de quantity, comisiones
4. Implementar trailing stops, max drawdown stop, kill switch
5. Logs persistentes + alertas (Telegram/Slack)
6. Backup y recuperación de estado ante crash
