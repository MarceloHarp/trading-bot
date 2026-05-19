# INFORME COMPARATIVO — 4 ESTRATEGIAS × 3 TIMEFRAMES
## BTCUSDT · Capital inicial: 10,000 USDT · Riesgo: 1% por trade

| Timeframe | Período | Velas |
|---|---|---|
| **1m** | 12/05/2026 → 19/05/2026 | 10,081 |
| **1h** | 19/05/2025 → 19/05/2026 | ~8,760 |
| **4h** | 19/05/2024 → 19/05/2026 | ~4,380 |

---

## TABLA MAESTRA — TODAS LAS COMBINACIONES

| Estrategia | TF | Trades | Win Rate | PnL % | Profit Factor | Max DD | Avg Win | Avg Loss | Racha + | Racha - |
|---|---|---|---|---|---|---|---|---|---|---|
| Confluence | **1m** | 689 | 0.0% | -18.68% | 0.00 | 18.68% | — | -3.0% | 0 | **166** |
| Confluence | **1h** | 622 | 25.5% | +0.96% | 1.12 | 0.56% | +5.0% | -1.34% | 5 | 14 |
| Confluence | **4h** | 116 | 18.1% | -0.96% | 0.66 | 1.05% | +9.0% | -3.0% | 3 | 15 |
| VWAPMomentum | **1m** | 180 | 23.9% | -1.27% | 0.63 | 1.86% | +5.0% | -2.5% | 3 | 3 |
| VWAPMomentum | **1h** | 622 | 25.7% | +0.24% | — | 0.12% | +5.0% | -2.5% | 5 | 6 |
| VWAPMomentum | **4h** | 135 | 37.0% | **+0.37%** | **1.18** | **0.20%** | +5.0% | -2.5% | 3 | 8 |
| SmartMoney | **1m** | 519 | 1.2% | -0.26% | 0.54 | 0.27% | +5.0% | -0.11% | 0 | 91 |
| SmartMoney | **1h** | 626 | 21.4% | **+2.12%** | **1.46** | **0.48%** | +5.02% | -0.94% | 8 | 38 |
| SmartMoney | **4h** | 173 | 28.9% | +0.91% | 1.50 | 0.38% | +5.42% | -1.47% | 8 | 12 |
| DruLozano | **1m** | 49 | 0.0% | -1.46% | 0.00 | 1.46% | — | -3.0% | 0 | **15** |
| DruLozano | **1h** | 123 | 27.6% | +0.39% | 1.14 | 1.22% | +9.17% | -3.06% | 2 | 15 |
| DruLozano | **4h** | 68 | 19.1% | -0.57% | 0.73 | 0.79% | +12.14% | -3.91% | 2 | 15 |

---

## RESUMEN GLOBAL POR TIMEFRAME

| Timeframe | Total Trades | Win Rate | PnL % | Capital Final | Max DD | Profit Factor |
|---|---|---|---|---|---|---|
| **1m** | 1,437 | 3.4% | **-21.08%** | 7,891 USDT | 21.16% | 0.09 |
| **1h** | 1,371 | 25.7% | **+2.91%** | 10,290 USDT | 2.31% | 1.15 |
| **4h** | 492 | 27.2% | **-0.26%** | 9,974 USDT | 1.10% | 0.97 |

**Conclusión inmediata**: El 1m destruye capital. El 1h es el único timeframe globalmente rentable.

---

## RANKING POR ESTRATEGIA

### 🥇 MEJOR COMBINACIÓN GLOBAL: SmartMoney en 1h
- PnL +2.12% en 1 año, Profit Factor 1.46, racha negativa máxima 38
- La más rentable en términos absolutos

### 🥈 VWAPMomentum en 4h
- Win Rate 37% (el más alto de todas las combinaciones rentables)
- Max Drawdown 0.20% — el más bajo de todos
- Profit Factor 1.18, muy estable

### 🥉 SmartMoney en 4h
- PnL +0.91%, Profit Factor 1.50
- Racha negativa 12 — manejable

### ⚠️ Zona peligrosa: Confluence en 1m
- 689 trades, 0 ganados — catastrófico
- Racha negativa de 166 pérdidas consecutivas
- -18.68% de PnL — la peor combinación de todas

---

## ANÁLISIS POR ESTRATEGIA

---

### CONFLUENCE — Solo funciona en 1h

| TF | Win Rate | PnL | Profit Factor | Racha - | Veredicto |
|---|---|---|---|---|---|
| 1m | 0.0% | -18.68% | 0.00 | 166 | ❌ CATASTRÓFICO |
| 1h | 25.5% | +0.96% | 1.12 | 14 | ✅ Rentable |
| 4h | 18.1% | -0.96% | 0.66 | 15 | ❌ Pierde |

**Por qué en 1m falla totalmente**: En 1m el precio oscila constantemente entre los indicadores. La BB inferior se toca cada pocos minutos. El score de confluencia 5/6 se alcanza con facilidad pero el contexto no tiene significado estadístico — cualquier ruido dispara la señal. En 1h y superiores, los mismos indicadores tienen peso institucional real.

**Por qué en 4h también pierde**: El timeframe de 4h tiene poca frecuencia de señales con la configuración actual (116 trades en 2 años). Cuando el mercado está en tendencia fuerte, los niveles de BB/EMA son superados sin respetar el score.

**Timeframe óptimo: 1h**. El TP de 5% es alcanzable en horas, el ruido es menor que en 1m y hay suficiente frecuencia de señales.

---

### VWAPMOMENTUM — Mejor en 4h, aceptable en 1h

| TF | Win Rate | PnL | Profit Factor | Racha - | Veredicto |
|---|---|---|---|---|---|
| 1m | 23.9% | -1.27% | 0.63 | 3 | ❌ Pierde |
| 1h | 25.7% | +0.24% | — | 6 | ✅ Marginalmente |
| 4h | **37.0%** | **+0.37%** | **1.18** | 8 | ✅ **MEJOR TF** |

**Por qué en 1m falla**: El VWAP de 50 períodos en 1m representa solo 50 minutos de historia. No tiene significado institucional. Los cruces del precio ocurren decenas de veces por hora sin contexto real.

**Por qué en 4h es superior**: El VWAP de 50 velas de 4h representa ~8 días de precio promedio ponderado por volumen — este es el nivel que realmente siguen los institucionales. Los cruces son menos frecuentes pero mucho más significativos. El win rate de 37% es el más alto de toda la matriz de resultados.

**Timeframe óptimo: 4h**. Win rate 37%, drawdown 0.20% (el más bajo de toda la tabla), rachas manejables.

---

### SMARTMONEY — Sorpresa positiva en 1h

| TF | Win Rate | PnL | Profit Factor | Racha - | Veredicto |
|---|---|---|---|---|---|
| 1m | 1.2% | -0.26% | 0.54 | 91 | ❌ CATASTRÓFICO |
| 1h | **21.4%** | **+2.12%** | **1.46** | 38 | ✅ **MEJOR TF** |
| 4h | 28.9% | +0.91% | 1.50 | 12 | ✅ Rentable |

**Sorpresa**: SmartMoney en 1h es la estrategia más rentable en términos de PnL absoluto (+2.12%), aunque con rachas negativas largas (38 pérdidas seguidas es el mayor riesgo).

**Por qué en 1m es catastrófico**: 519 trades en 1 semana. La estructura HH/HL en 1m es microestructura sin significado — cualquier movimiento de precios de 5 minutos crea un "nuevo máximo/mínimo". Racha negativa de 91 pérdidas.

**Por qué en 1h supera al 4h en PnL**: En 1h hay 626 trades vs 173 en 4h. La mayor frecuencia con un profit factor similar genera más PnL acumulado. Sin embargo, la racha negativa de 38 en 1h es psicológicamente difícil. El 4h tiene rachas más manejables (12) con profit factor similar (1.50).

**Timeframe óptimo**: Depende del perfil de riesgo:
- Si querés más PnL y tolerás rachas largas: **1h**
- Si querés más estabilidad psicológica: **4h**

---

### DRULAOZANO — Inconsistente en todos los timeframes

| TF | Win Rate | PnL | Profit Factor | Racha - | Veredicto |
|---|---|---|---|---|---|
| 1m | 0.0% | -1.46% | 0.00 | **15** | ❌ CATASTRÓFICO |
| 1h | 27.6% | +0.39% | 1.14 | 15 | ✅ Marginalmente |
| 4h | 19.1% | -0.57% | 0.73 | 15 | ❌ Pierde |

**Patrón curioso**: La racha negativa máxima es exactamente 15 en los 3 timeframes. Esto sugiere que el sistema tiene un problema estructural en la detección del Liquidity Sweep que se manifiesta igual independientemente del timeframe.

**El problema real**: La detección del sweep en el backtest busca en las últimas 8 velas. En 1m son 8 minutos, en 1h son 8 horas, en 4h son 32 horas. Ninguno captura el "sweep" como lo haría un trader mirando el gráfico en tiempo real.

**Avg Win excepcional**: En 4h el Avg Win es +12.14% — cuando gana, gana mucho. Pero el win rate del 19.1% no alcanza para ser rentable.

**Timeframe óptimo: 1h** — el único donde es marginalmente rentable. Sin embargo, necesita la mayor cantidad de mejoras de las 4 estrategias.

---

## MAPA DE CALOR — RENTABILIDAD

```
             1m          1h          4h
Confluence   ❌❌❌      ✅          ❌
VWAP         ❌          ✅          ✅✅
SmartMoney   ❌❌❌      ✅✅        ✅
DruLozano    ❌❌❌      ✅          ❌
```

**Zona verde**: 1h es rentable para 3 de 4 estrategias
**Zona naranja**: 4h es rentable para 2 de 4 estrategias
**Zona roja**: 1m es catastrófico para todas las estrategias sin excepción

---

## DIAGNÓSTICO DEL 1M — POR QUÉ FALLA TODO

El 1m tiene resultados catastróficos para las 4 estrategias. Las razones son estructurales:

1. **Ruido > Señal**: En 1m el precio se mueve por microestructura de book de órdenes, no por factores técnicos reales. Los indicadores como BB, EMA, VWAP no tienen peso estadístico.

2. **TP del 5% es demasiado grande para 1m**: Un movimiento del 5% en BTC en 1m es un evento extremo (requeriría un flash crash o pump masivo). El TP raramente se alcanza, el SL sí.

3. **Costo de comisiones**: Con 1,437 trades en 1 semana, las comisiones del 0.1% entrada + 0.1% salida equivalen a 0.2% × 1437 = 287% en comisiones. Literalmente imposible ganar.

4. **Señales degeneradas**: Confluence generó 689 trades y 0 ganados. La lógica del score 5/6 que funciona en 1h se convierte en ruido puro en 1m.

**Recomendación**: **DESACTIVAR el 1m COMPLETAMENTE**. Es el cambio más impactante que se puede hacer.

---

## CONFIGURACIÓN ÓPTIMA RECOMENDADA

Basado en todos los resultados:

| Estrategia | TF Activo | TF Desactivar | Razonamiento |
|---|---|---|---|
| Confluence | **1h** | 1m, 4h | Única combinación rentable |
| VWAPMomentum | **4h** + 1h | 1m | 4h tiene mejor win rate, 1h aporta frecuencia |
| SmartMoney | **4h** | 1m | Mejor balance riesgo/recompensa |
| DruLozano | **1h** | 1m, 4h | Marginalmente rentable en 1h |

**Configuración .env recomendada**:
```env
TRADING_TIMEFRAMES=1h,4h
```
Eliminar el 1m es la mejora más importante.

---

## PROYECCIÓN CON CONFIGURACIÓN OPTIMIZADA

Combinando las estrategias en sus mejores timeframes:

| Estrategia | TF | PnL anual estimado | Trades/año |
|---|---|---|---|
| Confluence | 1h | +0.96% | ~600 |
| VWAPMomentum | 4h | +0.37% (x2 años) | ~70/año |
| SmartMoney | 4h | +0.91% (x2 años) | ~85/año |
| DruLozano | 1h | +0.39% | ~120 |
| **TOTAL** | — | **~+2.63%/año** | **~875/año** |

Con capital de 10,000 USDT y 1% de riesgo = **~263 USDT de ganancia anual estimada** solo con optimizar los timeframes, sin cambiar nada del código de las estrategias.

---

## PRÓXIMOS PASOS PRIORITARIOS

1. **INMEDIATO** — Cambiar `.env`: `TRADING_TIMEFRAMES=1h,4h` (eliminar 1m)
2. **CORTO PLAZO** — Implementar SL dinámico por ATR en VWAPMomentum y SmartMoney
3. **MEDIANO PLAZO** — Agregar trailing stop cuando el trade gana >3%
4. **MEDIANO PLAZO** — Filtro de tendencia macro (SMA200) en todas las estrategias
5. **LARGO PLAZO** — Refactorizar DruLozano con detección de sweep más precisa

---

*Informe generado por Trading Bot Backtest Engine*
*Datos reales: Binance API — BTCUSDT*
*1m: 10,081 velas (1 semana) · 1h: ~8,760 velas (1 año) · 4h: ~4,380 velas (2 años)*
*Capital 10,000 USDT · Riesgo 1%/trade · 3,300 trades simulados totales*
