# 📚 Trading Bot — Aprendizajes Sobre Estrategias

> Documento exhaustivo con todo lo aprendido en el desarrollo y testing de las 5 estrategias del bot.
> Pensado como base de conocimiento para una skill de Claude.
>
> **Última actualización**: 21 Mayo 2026
> **Backtests**: 28 días, 1h, risk 1% por trade.
> **Whitelist operable actual (9 pares)**: ETH, ADA, SOL, BNB, AVAX, LINK, XRP, DOGE, TRX.
> **BTC**: NO se opera — actúa como filtro de régimen macro ("el rey").
> **Modo**: Futuros Perpetuos Testnet (USD-M), leverage 5x, SHORT real habilitado.

---

## 📊 TABLA RESUMEN — Estado Final de las Estrategias

> Backtest 21 Mayo 2026, 9 pares whitelist, 28d. PnL/par = % sobre capital con riesgo 1%.

| Estrategia | Trades | Win Rate | PnL/par | PF | Status |
|---|---|---|---|---|---|
| **VWAPMomentum** | 146 | 41.8% | +0.102% | — | ✅ Winner (mejor PnL) |
| **SmartMoney** | 161 | 31.7% | +0.074% | — | ✅ Winner |
| **MarceMillo v2** | 19 | **52.6%** | +0.019% | alto | ✅ Winner (mejor WR, breakout-retest) |
| **DruLozano** | 118 | 23.7% | -0.03% | 0.9 | ❌ Desactivada |
| **Confluence** | 127 | 22.0% | -0.05% | 0.85 | ❌ Desactivada |

**Las 3 activas corren juntas en los 9 pares → TODOS rentables (0 perdedores).**
Ranking por par: SOL +0.38%, BNB +0.25%, ADA +0.24%, AVAX +0.23%, DOGE +0.20%, TRX +0.18%, XRP +0.14%, LINK +0.09%, ETH +0.07%.

### El gran salto de MarceMillo (esta sesión)
| | Antes (v1 breakout) | Ahora (v2 retest) |
|---|---|---|
| Win Rate | ~31% | **52.6%** |
| PnL/par | -0.001% (breakeven) | +0.019% |
| PnL acumulado 9 pares (suma retornos precio) | **-3.86%** | **+14.76%** |
| Profit Factor | 0.85 | 2.17 |

---

## 🧮 MATEMÁTICA FUNDAMENTAL

### Break-even por R:R

| R:R | Win Rate mínima | Comentario |
|---|---|---|
| 1:1 | 50% | Casi imposible en cripto sin filtros agresivos |
| 2:1 | 33% | Realista para breakouts |
| 3:1 | 25% | Sweet spot para pullbacks |
| **4:1** | **20%** | **Mejor para reversiones tipo SmartMoney** |
| 5:1 | 17% | Solo en mercados muy direccionales |

**Insight clave**: cuanto mayor el R:R, más fácil ser profitable matemáticamente, pero más difícil que el TP se golpee antes que el SL. **No hay almuerzo gratis** — R:R alto implica que cada ganador necesita un movimiento limpio sin retroceso significativo.

### Cómo se calcula el PnL del backtest

```
Por trade:
  Capital en riesgo = equity × riskPct/100  (típicamente 1% del equity)
  PnL_trade = pnlPct_position × Capital_en_riesgo

Donde:
  pnlPct_position = (exitPrice - entryPrice) / entryPrice × 100  (para BUY)
                    (entryPrice - exitPrice) / entryPrice × 100  (para SELL)
```

**Ejemplo concreto SmartMoney**:
- SL = entry − 1% (basado en ATR), TP = entry + 4% (4:1)
- Per WIN: +4% × 1% capital = +0.04% equity
- Per LOSS: -1% × 1% capital = -0.01% equity
- Con 28.9% WR sobre 190 trades: 55 wins × +0.04% + 135 losses × -0.01% ≈ +0.85% total equity

### Sample size mínimo

- **<10 trades**: ruido puro, no concluyente
- **10-30 trades**: tendencia visible pero alta varianza
- **>30 trades**: estadísticamente significativo
- **>100 trades**: medición confiable

Cuando un cambio de filtros baja los trades a <20 en 28 días, **siempre revertir** — el WR alto es ilusión de small sample.

---

## 🎯 ESTRATEGIA POR ESTRATEGIA

### 1. SmartMoney — Reversión en Estructura HH+HL

**Concepto**: identificar el sesgo del mercado (HH+HL alcista, LH+LL bajista), encontrar swings recientes como soporte/resistencia, entrar cuando el precio testea el nivel y rebota con vela fuerte.

**Timeframes**: 1h primario, 4h confirmación (MTF)

**Reglas finales LONG**:
1. Estructura: `HH y HL` en los últimos 3 swings
2. Macro trend: `close > SMA200`
3. **HTF alignment** (1h): el 4h NO debe tener sesgo opuesto
4. RSI: `< 70` (filtro de sobrecompra extrema solamente)
5. Volumen: `> 0.5× promedio` (filtra velas anémicas, no es pre-filtro)
6. Test soporte: `low.candle.toca uno de los últimos 3 swing lows ± 0.5×ATR`
7. Confirmación: cuerpo de vela `(close-open)/range > 0.35` (no doji)

**Risk management**:
- SL = `support − 0.5×ATR`
- TP = `entry + 4×risk` (4:1 R:R)

**Evolución (lecciones)**:

| Cambio | Resultado | Lección |
|---|---|---|
| Original con TF 1m | -21.08% PnL | **El timeframe 1m es catastrófico** — demasiado ruido |
| Quitar 1m, solo 1h+4h | +0.16% PnL | Confirmación inmediata |
| Agregar MTF 4h confirma 1h | 9 trades, 11% WR | **Over-filtered** — el sample chico engaña |
| RSI 25-60 (muy estrecho) | 9 trades | **El RSI en rangos cripto vive entre 50-70 en uptrend** |
| Relajar RSI a `<70` o `>30` | 18 trades, 55.6% WR | Win rate hermoso pero sample chico → unreliable |
| Bug del backtest: comparar `close` vs `support` | 18 trades | **Bug crítico**: la vela de reversión cierra ARRIBA del soporte. Hay que comparar `candle.low` vs soporte |
| Body ratio >40% en vez de `close > prev.high` | 17 trades | Body ratio es **mucho más flexible**; `close > prev.high` es engulfing total |
| Quitar pre-filtro de volumen `>1.1×` | 190 trades, 28.9% WR | **EL FILTRO DE VOLUMEN ES EL PEOR ASESINO DE TRADES** — corta el 70% antes de empezar |
| Multi-swing check (no solo el más reciente) | mejora WR | El soporte puede ser cualquiera de los 3 últimos swings |

**Insights únicos**:
- Con 4:1 R:R, 28.9% WR es **rentable matemáticamente** (break-even 20%)
- Es la mejor estrategia del portfolio
- HTF (4h) actúa como filtro de régimen — evita short en bull, long en bear

---

### 2. VWAPMomentum — Mean Reversion al VWAP

**Concepto**: identificar cruces del precio sobre el VWAP móvil de 50 períodos, confirmar con RSI no extremo y volumen alto.

**Timeframes**: 1h y 4h

**Reglas LONG**:
1. Precio cruzó por encima del VWAP en la última vela (`prev<VWAP && current>=VWAP`)
2. RSI < 70 (no sobrecomprado)
3. Volumen > 1.2× promedio

**Risk management**:
- SL = `entry × 0.975` (fijo -2.5%)
- TP = `entry × 1.05` (fijo +5%)
- **R:R = 2:1**

**Resultados**: 178t | 37.1% WR | +0.05% per symbol

**Insights únicos**:
- Mejor WR de todas las estrategias (37.1%)
- Solo levemente rentable porque R:R es bajo (2:1)
- **Mejora pendiente**: subir R:R a 3:1 manteniendo WR de 30%+ → +0.15% per symbol estimado
- El stop fijo en % es problemático en cripto: ATR-based mejoraría

---

### 3. Confluence — Score Multi-Indicador (PERDEDORA)

**Concepto**: 6 indicadores votan (BB, EMA20, SMA200, swings, VWAP, volumen). Entra si score ≥5/6.

**Timeframes**: 1h y 4h

**Resultados**: 127t | 22.0% WR | -0.05% per symbol

**Por qué pierde**:
- Los indicadores NO son independientes — todos miran el mismo precio
- Cuando 5 dicen "bullish" es porque el precio ya está alto → entrada tardía
- Score-based no captura la **timing** de la entrada, solo el contexto
- Sin filtros de macro trend ni HTF

**Si fuera a mejorarse**:
- Cambiar de score a regime detection (trending vs ranging)
- Usar diferentes confirmations por régimen
- Probablemente requiere ML para combinar señales correctamente
- **Apagarla por ahora** (es la peor del portfolio)

---

### 4. DruLozano — Pullback a MA50 (mejor que antes, pero perdedora)

**Concepto**: en una MA Stack alineada (MA50 > MA100 > MA150 > MA200 para bull), esperar pullback hasta MA50 y entrar en el rebote.

**Timeframes**: 1h y 4h

**Reglas LONG**:
1. MA Stack alcista: `price > MA50 > MA100 > MA150 > MA200`
2. Pullback: alguna de las últimas 3 velas tocó MA50 (`low ≤ MA50 + 0.3×ATR`)
3. Bounce: cierre actual > MA50 con cuerpo bullish > 50%

**Risk management**:
- SL = `min(últimas 3 lows) − 0.3×ATR`
- TP = `entry + 3×risk` (3:1)

**Evolución dramática**:

| Versión | Resultado | Por qué |
|---|---|---|
| **v1**: Sweep de swing low | 78t, 6.4% WR | **Counter-trend**: en MA Stack bull, sweep de low = inicio de reversión |
| **v2**: Sweep de zona 3+ toques | 63t, 7.9% WR | Mismo problema conceptual; 3 toques rara vez se encuentran |
| **v3**: Pullback a MA50 | 118t, 23.7% WR | **¡Va con la tendencia!** Soporte dinámico |

**Por qué sigue perdiendo (23.7% < 25% break-even para 3:1)**:
- Tan cerca del break-even que la varianza lo mantiene en rojo
- La MA50 es soporte muy frecuente — muchos falsos pullbacks
- Falta filtro de calidad: solo entrar cuando el pullback es **profundo** (cerca de MA50 con wick claro)

**Mejora pendiente (opción B futura)**:
- Requerir que `low.candle <= MA50` (no solo cerca) → pullback genuino
- Subir body ratio a >60% (vela muy convincente)
- Bajar a R:R 2:1 (break-even 33%) si esos filtros se logran

---

### 5. MarceMillo v2 — Breakout-RETEST de Volatilidad (LA REINA) ✅

**Concepto**: capturar movimientos explosivos cuando una consolidación se rompe — pero **entrar en el RETEST del nivel roto, no en el candle de ruptura.**

**Por qué retest**: entrar en el breakout candle te mete justo cuando el precio ya pegó el envión. Muchos breakouts hacen pullback (fakeout) y te sacan por SL. Esperar que el precio vuelva a tocar el nivel roto y lo confirme como soporte mejora WR y el precio de entrada.

**Timeframes**: 1h primario, 4h alignment

**Reglas LONG (2 fases)**:
1. **BREAKOUT** (vela k, hasta 10 velas atrás):
   - Cierre > Donchian high(20) anterior
   - Cierre > EMA50, vela alcista
   - ADX > **20** (antes 22), Volumen > **1.2×** (antes 1.5×), ATR > 1.1× promedio
2. **RETEST** (vela actual): el pullback toca el nivel roto (`low ≤ level`), pero cierra por encima (el nivel aguanta como soporte) y es vela alcista. Solo dispara el **primer** retest.
3. Entre breakout y retest, el precio no debe perder el nivel ni alejarse >3% sin retestear (`abortPct`).

**Risk management**:
- SL = `nivel_roto − 1.0×ATR` (antes 1.5×ATR sobre entry)
- TP = `entry + 2×risk` (**R:R 2:1**)

**Evolución completa**:

| Versión | Resultado | Lección |
|---|---|---|
| **v1**: SL = `candle.low − 0.5×ATR`, R:R 4:1 | 62t, **1.6% WR**, -0.11% | **Desastre**: las velas breakout tienen ranges enormes → SL queda 3% abajo → TP a 12% es imposible |
| **v1.5**: SL = `entry − 1.5×ATR`, R:R 2:1 | 49t, 26.5% WR, -0.01% | Casi breakeven; el problema seguía siendo entrar en la vela explosiva |
| **v2**: **breakout-RETEST** + ADX 20 + vol 1.2× | 19t, **52.6% WR**, +14.76% acum, PF 2.17 | **¡El retest cambia todo!** Menos trades, mucha mejor calidad |

**El experimento que lo definió** (variantes probadas sobre 9 pares):

| Variante | Trades | WR | PnL acum | PF |
|---|---|---|---|---|
| V1 actual (breakout) | 30 | 30.0% | -3.86% | 0.85 |
| V4 retest w8 sl1.0 rr2 | 14 | 35.7% | +1.07% | 1.08 |
| V9 retest w8 sl1.0 rr1.5 | 14 | 42.9% | +2.58% | 1.22 |
| **V11 retest w10 vol1.2 adx20 rr2** ⭐ | 18 | **50.0%** | +14.76% | 2.17 |
| V12 retest w10 vol1.3 adx20 rr2.5 | 18 | 44.4% | +16.71% | 2.20 |

Se eligió **V11** (no V12) por mayor WR (50%) y R:R más alcanzable (2:1 vs 2.5:1). El cambio que más movió la aguja: **bajar ADX de 22 a 20** (22 era demasiado estricto y se perdía buenos setups).

**Insights únicos**:
- **El retest es la diferencia entre perder y ganar** en breakouts cripto. Entrar en la ruptura = comprar el techo local.
- **NUNCA usar candle low/high para SL** — el rango de la vela breakout es enorme. SL relativo al nivel roto.
- **Solo el primer retest dispara** — sino se generan trades duplicados del mismo setup.
- Es selectiva (pocos trades) pero de altísima calidad — calidad > cantidad.

**Whitelist (9 pares)**: `ADA, SOL, BNB, ETH, AVAX, LINK, XRP, DOGE, TRX`. El desglose per-par confirmó que el PnL viene de varios pares (SOL, AVAX, TRX con 3-4 trades cada uno, todos PF>2), no de un solo par → no es overfitting.

---

## 👑 BTC COMO FILTRO DE RÉGIMEN ("El Rey")

**Filosofía**: "cuando se mueve el rey, se mueven todas". BTC lidera al mercado cripto — si BTC cae, las alts caen con él (y al revés). En vez de operar BTC (donde el bot pierde: 20.5% WR, -0.15% en backtest), se usa como **filtro macro** para las demás.

**Implementación** (`StrategyEngine`):
1. **BTC no se opera** — está en `NON_TRADABLE_SYMBOLS`. Se siguen cargando sus velas y se emiten señales de monitoreo (alerta + socket), pero NO se ejecuta ningún trade en BTC.
2. **Cada tick calcula el régimen** a partir de BTC en 4h:
   - `bullish`: close > EMA200 **y** EMA50 > EMA200
   - `bearish`: close < EMA200 **y** EMA50 < EMA200
   - `neutral`: en transición
3. **El rey manda sobre las alts**:
   - Régimen `bearish` → bloquea TODAS las señales BUY en alts
   - Régimen `bullish` → bloquea TODAS las señales SELL en alts
   - `neutral` → ambas direcciones permitidas

```typescript
private allowedByRegime(direction: 'BUY' | 'SELL'): boolean {
  if (this.marketRegime === 'bearish' && direction === 'BUY') return false;
  if (this.marketRegime === 'bullish' && direction === 'SELL') return false;
  return true;
}
```

**Config** (`.env`):
```
MARKET_REGIME_SYMBOL=BTCUSDT
NON_TRADABLE_SYMBOLS=BTCUSDT
```

**Insight**: esto convierte una debilidad (BTC opera mal) en una fortaleza (BTC como brújula). Evita pelear contra la corriente macro.

---

## 📈 FUTUROS PERPETUOS (USD-M Testnet)

El bot migró de Spot a **Futuros Perpetuos** para habilitar SHORT real y leverage.

**Arquitectura**:
- `IExchangeAdapter` — interface común. `OrderExecutor` y `StrategyEngine` trabajan contra ella, no contra una implementación concreta.
- `BinanceAdapter` (spot) y `BinanceFuturesAdapter` (futuros) la implementan.
- `TRADING_MODE=futures` en `.env` elige el adapter en `server.ts`.

**Diferencias clave Spot vs Futuros**:
| | Spot | Futuros |
|---|---|---|
| Base URL | testnet.binance.vision | testnet.binancefuture.com |
| Endpoints | `/api/v3/*` | `/fapi/v1/*`, `/fapi/v2/account` |
| SHORT | Imposible (hay que tener el activo) | **Posición real** |
| Cerrar posición | Vender el activo | `reduceOnly=true` lado opuesto |
| Balance | Múltiples assets | USDT (margen), `availableBalance` |
| Leverage | No | `POST /fapi/v1/leverage` (5x default) |

**API key testnet**: usar **System Generated** (botón "Generate Key" en testnet.binancefuture.com). No hay RSA/Ed25519 en testnet. **Es dinero ficticio — cero riesgo real.**

**Cierre seguro**: en futuros, al cerrar se manda la orden opuesta con `reduceOnly=true` para no abrir accidentalmente una posición contraria.

---

## 🧪 INDICADORES DISPONIBLES (en `backend/src/core/indicators.ts`)

| Indicador | Función | Periodo default | Uso |
|---|---|---|---|
| SMA | `sma(values, period)` | — | Tendencia base, filtros |
| EMA | `ema(values, period)` | — | Tendencia más reactiva |
| RSI | `rsi(values, period)` | 14 | Sobrecompra/sobreventa |
| MACD | `macd(values, fast, slow, signal)` | 12/26/9 | Momentum |
| Bollinger | `bollinger(values, period, mult)` | 20/2 | Reversión a la media |
| VWAP | `vwap(candles, window?)` | 50 móvil | Mean reversion, soporte/resistencia |
| ATR | `atr(candles, period)` | 14 | Volatilidad, stops dinámicos |
| findSwings | `findSwings(candles, lookback)` | 5 | Estructura, swing points |
| **Donchian** | `donchian(candles, period)` | 20 | Breakouts, rangos |
| **ADX** | `adx(candles, period)` | 14 | Fuerza de tendencia (NO dirección) |

---

## 🛠️ PATRONES DE ENGINEERING

### Multi-Timeframe (MTF) handling

```typescript
// 1. Modificar Strategy interface
interface Strategy {
  evaluate(symbol, timeframe, candles, htfCandles?: Candle[]): Signal | null;
}

// 2. En StrategyEngine.tick(), pre-cargar TODOS los TF antes de evaluar:
for (const symbol of symbols) {
  const candleMap = new Map<string, Candle[]>();
  for (const tf of timeframes) {
    candleMap.set(tf, await exchange.getCandles(symbol, tf, 300));
  }
  // Luego al evaluar, pasar el HTF si aplica
  const htf = strategy.name === 'SmartMoney' && tf === '1h'
    ? candleMap.get('4h')
    : undefined;
  strategy.evaluate(symbol, tf, candles, htf);
}
```

### Diagnostic scripts para cuellos de botella

Crear un script Node que cuente cuántas señales pasa cada filtro **secuencialmente**:

```javascript
let total=0, passVol=0, passMA=0, passSupport=0, passBody=0, finalSignals=0;
for (let i=200; i<candles.length-1; i++) {
  total++;
  if (!filterVolume(i)) continue;
  passVol++;
  if (!filterMA(i)) continue;
  passMA++;
  // ...
  finalSignals++;
}
```

Este patrón **identifica cuáles filtros son demasiado restrictivos** sin tener que correr el backtest completo cada vez.

### Endpoint de test de email aislado

Para diagnosticar si un problema es "no llega el mail" vs "backtest roto":
```typescript
router.post('/test-email', async (_req, res) => {
  await sendWeeklyReport([mockResult], date, date);
  res.json({ ok: true });
});
```
Aisla la causa raíz.

---

## ❌ BUGS IDENTIFICADOS DURANTE EL DESARROLLO

| Bug | Síntoma | Solución |
|---|---|---|
| `'DruLozano'` no en tipo `StrategyName` | TS compile error | Agregar al union type |
| `buildRoutes(exchange, engine)` con 2 args | TS expecta 1 | Quitar `engine` del call (no se usaba) |
| SmartMoney backtest: `close` vs support | Solo 18 trades | Comparar `candle.low` vs support (igual que estrategia live) |
| MarceMillo SL en `candle.low` | 1.6% WR | Usar `entry − 1.5×ATR` |
| Volumen como **pre-filtro** | -70% velas | Mover a confirmación, threshold 0.5× (no 1.1×) |

---

## 🎓 TOP LESSONS LEARNED (Cross-Strategy)

### Sobre filtros

1. **El volumen como pre-filtro es el peor enemigo de las estrategias** — corta velas demasiado pronto. Usar como confirmación post-señal.
2. **Multi-timeframe alignment reduce señales pero no necesariamente mejora WR** — útil cuando la estrategia ya tiene buena tasa.
3. **ADX > 22 es buen filtro para breakouts** — separa trending de ranging.
4. **RSI extremo (>70 o <30) filtra exhaución** — rangos intermedios no agregan info.
5. **3+ toques en zonas de liquidez es demasiado restrictivo** en backtests de 28 días — 2+ es práctico.

### Sobre stops

1. **ATR-based SL >>>>>>> %-fijo SL >>>>>>> candle-low SL**
2. **0.3-0.5×ATR sobre el soporte** funciona bien (no muy cerca, no muy lejos)
3. **1.5×ATR como SL fijo** es el sweet spot para breakouts/momentum
4. **Stops basados en el rango de la vela explosiva** = TP imposible

### Sobre el entry

1. **Con-trend > Counter-trend** en cripto (mercado de momentum, no reversión)
2. **Pullback a MA dinámica** > **sweep de swing pasado**
3. **Esperar confirmación de la reversión** (vela con cuerpo) > entrar en el wick
4. **Cierre debe estar del lado correcto** del nivel, no la apertura

### Sobre el R:R

1. **R:R 4:1 con WR 25-30%** es el sweet spot para estrategias de reversión
2. **R:R 2:1 requiere 33%+ WR** — apropiado para breakouts
3. **R:R 1:1 nunca funciona en cripto** — el ruido te mata
4. **NO usar floor minimum** tipo `Math.max(rawTP, entry × 1.05)` — desvirtúa el R:R real

### Sobre los símbolos

1. **No todos los pares responden igual a la misma estrategia**:
   - BTC: noisy en breakouts, bueno en pullbacks/reversiones → mejor como **filtro de régimen** que como par operable
   - ETH: similar a BTC pero menos noisy
   - SOL, ADA, BNB, AVAX: breakouts limpios, los más rentables
   - TRX: pocos trades pero altísimo PF (2.46) — muy selectivo y certero
   - DOGE: sorprendentemente rentable (+0.20%)
   - Perdedores a evitar: DOT (-0.07%), LTC, NEAR (-0.48%)
2. **Filtrar símbolos por estrategia y por whitelist global** es una optimización gratuita
3. **Backtestear pares nuevos antes de agregarlos** — DOGE y TRX entraron por datos, no por intuición

### Sobre breakout-retest (el hallazgo estrella)

1. **Entrar en el candle de ruptura = comprar el techo local.** El retest del nivel roto es donde está el edge.
2. **Esperar el pullback** reduce trades pero dispara el WR (30% → 50%) y el PF (0.85 → 2.17).
3. **Solo el primer retest** debe disparar — sino se duplican trades del mismo setup.
4. **ATR del nivel roto, no del entry** para el SL — más consistente.
5. Un filtro demasiado estricto (ADX 22) puede estar tapando el edge — **probar relajarlo** (ADX 20) capturó los mejores setups.

### Sobre producción vs backtest (trust but verify)

1. **El backtest hace forward-scan** (detecta breakout, busca retest hacia adelante). **Producción hace backward-scan** (en cada vela, mira atrás si es retest de un breakout reciente). **Hay que verificar que generan las mismas señales** antes de confiar.
2. La verificación de equivalencia (`forward ⊆ backward`) atrapó que producción generaba trades extra → se agregó "solo primer retest" para alinear.
3. **Nunca asumir que la estrategia live == backtest** solo porque "es el mismo algoritmo". El scan direction importa.

### Sobre el desarrollo

1. **Diagnostic scripts antes que cambios** — saber DÓNDE se pierden las señales evita debuggear a ciegas
2. **Mantener backtest y live alineados** — bugs aparecen cuando divergen
3. **Sample size matters** — <20 trades en 28d = ruido, no señal
4. **Test endpoints aislados** — separa "infra rota" de "lógica rota"
5. **Documentar evolution** — cada cambio de parámetro es un experimento, registrarlo

---

## 🚀 ROADMAP DE MEJORAS PENDIENTES

### Completado (21 Mayo 2026)
- [x] **MarceMillo: breakout-retest pattern** → de -3.86% a +14.76%, WR 52.6% ✅
- [x] **BTC como filtro de régimen** (no operable, manda sobre alts) ✅
- [x] **Futuros Perpetuos** (USD-M testnet, SHORT real, leverage 5x) ✅
- [x] **Whitelist optimizada por backtest**: +DOGE +TRX, −DOT −LTC −NEAR (9 pares, todos rentables) ✅

### Corto plazo
- [ ] Reactivar Confluence con regime detection
- [ ] Mejorar VWAPMomentum: subir R:R a 3:1, SL basado en ATR
- [ ] DruLozano: filtros de pullback más estrictos (low.candle ≤ MA50)
- [ ] Validar SHORT de MarceMillo en backtest (el experimento solo cubrió LONG)
- [ ] Aprovechar el régimen BTC también para SHORTs en futuros cuando es bearish

### Medio plazo
- [ ] Position sizing dinámico basado en confidence + ATR + leverage
- [ ] Trailing stop más sofisticado (basado en SMA o swing recientes)
- [ ] Backtest sobre 90 días (no solo 28) para mayor significancia estadística
- [ ] Integrar indicadores de TradingView (Fibonacci, Ichimoku) vía MCP como confirmación

### Largo plazo
- [ ] **Walk-forward optimization** de parámetros
- [ ] **Combinatoria de estrategias** (multi-strategy portfolio con weights dinámicos)
- [ ] **Machine Learning** para detectar régimen de mercado y switching de estrategias
- [ ] **Sentiment data** (Fear & Greed Index, Funding Rate) como filtro

---

## 📐 ANATOMÍA DE UN BACKTEST CORRECTO

Para validar una estrategia, el backtest debe:

1. **Usar datos reales** de Binance (1000+ velas mínimo)
2. **Período significativo**: 28+ días para 1h, 60+ días para 4h
3. **Múltiples símbolos** (no solo BTC) para evitar overfitting
4. **Simular SL primero** cuando ambos están en la misma vela (worst-case assumption)
5. **Riesgo fijo por trade** (1% de equity típico) — no varía con apalancamiento
6. **Cooldown** entre trades para no super-poblar señales en la misma zona
7. **Reportar**: total trades, WR, PnL%, MaxDD, Profit Factor, distribución por símbolo

**No incluir** en el backtest pero **sí en live**:
- Slippage real
- Fees del exchange
- Latencia de orden

---

## 🔗 REFERENCIAS A ARCHIVOS DEL CÓDIGO

```
backend/src/
├── core/
│   ├── indicators.ts            # Todos los indicadores técnicos
│   ├── StrategyEngine.ts        # Loop principal, MTF, cooldowns, régimen BTC
│   ├── OrderExecutor.ts         # Ejecución + trailing + partial TP + reduceOnly
│   └── strategies/
│       ├── Strategy.ts          # Interface base
│       ├── SmartMoney.ts        # Estrategia 1 (activa)
│       ├── VWAPMomentum.ts      # Estrategia 2 (activa)
│       ├── Confluence.ts        # Estrategia 3 (desactivada)
│       ├── DruLozano.ts         # Estrategia 4 (desactivada)
│       └── MarceMillo.ts        # Estrategia 5 v2 breakout-retest (activa)
├── exchanges/
│   ├── IExchangeAdapter.ts      # Interface común spot/futuros
│   ├── BinanceAdapter.ts        # Spot testnet
│   └── BinanceFuturesAdapter.ts # Futuros USD-M testnet (leverage, reduceOnly)
├── routes/
│   ├── backtest.ts              # Motor de backtest + runXxx() por estrategia
│   └── api.ts                   # REST endpoints
└── integrations/
    ├── AlertService.ts          # Email + Telegram + reporte semanal
    └── WeeklyBacktestService.ts # Cron lunes 08:00

backend/ (scripts de análisis reutilizables)
├── analyze-pairs.js             # Análisis técnico (RSI/BB/ATR/Fibonacci/ADX)
└── batch-backtest.js            # Backtest batch + ranking de pares
```

---

*Generado durante la sesión del 20 Mayo 2026, actualizado el 21 Mayo 2026 (MarceMillo v2 breakout-retest, filtro de régimen BTC, futuros perpetuos, whitelist optimizada) — base de conocimiento para futuras iteraciones del bot y para una potencial skill de Claude orientada a desarrollo de estrategias de trading cripto.*
