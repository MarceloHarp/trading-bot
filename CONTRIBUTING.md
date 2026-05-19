# Contribuir al Trading Bot

¡Gracias por tu interés en contribuir! Esta guía explica cómo configurar el proyecto para desarrollo.

---

## 📋 Requisitos

- **Node.js** v20+ ([descargar](https://nodejs.org/))
- **Git** ([descargar](https://git-scm.com/))
- **Binance Testnet API Keys** (gratuitos en [testnet.binance.vision](https://testnet.binance.vision))
- **Gmail + contraseña de aplicación** (para alertas por email)

---

## 🚀 Setup Inicial

### 1. Clonar el repositorio

```bash
git clone https://github.com/elkun/trading-bot.git
cd trading-bot
```

### 2. Instalar dependencias

```bash
# Instalar backend
cd backend
npm install
cd ..

# Instalar frontend
npm install
```

### 3. Configurar variables de entorno

```bash
# Crear .env desde el template
cp .env.example .env

# Editar .env con tus credenciales
# - BINANCE_TESTNET_API_KEY
# - BINANCE_TESTNET_API_SECRET
# - ALERT_SMTP_PASS (contraseña de aplicación Gmail)
```

### 4. Inicializar base de datos

```bash
cd backend
npx prisma migrate dev
npx prisma generate
cd ..
```

### 5. Ejecutar en desarrollo

```bash
# Terminal 1: Backend (puerto 3001)
cd backend
npm run dev

# Terminal 2: Frontend (puerto 3000)
npm run dev
```

Acceder a: **http://localhost:3000**

---

## 📁 Estructura de Carpetas

```
trading-bot/
├── backend/                  # API REST + motor de trading
│   ├── src/
│   │   ├── core/           # Lógica de estrategias
│   │   ├── routes/         # Endpoints REST
│   │   ├── exchanges/      # Adapters de exchanges
│   │   └── integrations/   # Email, Telegram, Claude
│   ├── prisma/
│   │   └── schema.prisma   # ORM schema
│   └── package.json
├── frontend/                # React dashboard
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── services/       # API client
│   │   └── store/          # Zustand state
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🔄 Flujo de Desarrollo

### Trabajar en una estrategia nueva

```bash
# 1. Crear archivo en backend/src/core/strategies/MyStrategy.ts
# 2. Exportar en backend/src/core/strategies/index.ts
# 3. Registrar en backend/src/core/StrategyEngine.ts
# 4. Testear en dashboard

# 5. Hacer un commit
git add backend/src/core/strategies/
git commit -m "feat: agregar estrategia MyStrategy con XYZ"
```

### Trabajar en frontend

```bash
# 1. Crear componente en frontend/src/components/
# 2. Importar en App.tsx
# 3. Ver cambios en tiempo real con HMR

# 4. Commit
git add frontend/src/components/
git commit -m "ui: mejorar panel de trades"
```

---

## ✅ Checklist Antes de Hacer Push

- [ ] El código compila sin errores (`npm run build`)
- [ ] Los tests pasan (si existen)
- [ ] Agregaste el `.env` al `.gitignore`
- [ ] El commit sigue el formato: `type: descripción`
- [ ] El backend se levanta sin errores
- [ ] El frontend carga correctamente

---

## 📝 Formato de Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:  Nueva feature o estrategia
fix:   Corrección de bug
docs:  Documentación
style: Formato de código
refactor: Refactoring sin cambiar funcionalidad
test:  Tests
chore: Build, deps, etc.
```

**Ejemplos**:
```
feat: agregar SL dinámico por ATR en VWAPMomentum
fix: trailing stop no se aplicaba correctamente
docs: actualizar README con nuevas mejoras
refactor: simplificar lógica de rate limiting
```

---

## 🐛 Reportar Issues

Abrir issue con:

1. **Título**: Descripción clara del problema
2. **Descripción**: 
   - Qué pasó
   - Qué esperabas que pasara
   - Pasos para reproducir
3. **Environment**:
   - Node version
   - OS
   - Binance Testnet vs Real

---

## 🔍 Testing

### Backtesting

```bash
cd frontend
# Ir a http://localhost:3000 → Backtest tab
# Seleccionar pares, fechas, estrategias
# Click "Correr Backtest"
```

### Paper Trading (Offline)

1. Activar modo offline: Click "⏸ Bot OFF" en header
2. El bot evalúa sin ejecutar órdenes
3. Las alertas llevan etiqueta `[OFFLINE]`

---

## 📊 Monitorear Performance

1. **Dashboard**: http://localhost:3000
2. **Logs backend**: Terminal con `npm run dev`
3. **Network**: DevTools → Network tab
4. **DB**: 
   ```bash
   cd backend
   npx prisma studio
   ```

---

## 🚢 Deployment (Producción)

**Antes de ir a producción CON CAPITAL REAL**:

1. ✅ Auditar todo el código de estrategias
2. ✅ Ejecutar backtest en 2+ años de datos
3. ✅ Testear en testnet 1+ mes sin errores
4. ✅ Implementar logs detallados
5. ✅ Tener plan de rollback
6. ✅ Empezar con capital mínimo (1-5% del total)

**No recomendamos producción sin expertise profesional en trading.**

---

## 📚 Recursos

- **Binance API Docs**: https://binance-docs.github.io/apidocs/
- **Prisma ORM**: https://www.prisma.io/docs/
- **React**: https://react.dev/
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/nodejs-performance-building-fast-and-lean-web-applications/

---

## 💬 Preguntas?

- Issues en GitHub
- Email: negro.y.gti@gmail.com
- Discord: [Link a comunidad si existe]

---

**Happy coding! 🚀**
