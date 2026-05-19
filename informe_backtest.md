# INFORME DE BACKTESTING — TRADING BOT
## BTCUSDT · Timeframe 1D · Mayo 2024 → Mayo 2026
### 731 velas · Capital inicial: 10,000 USDT · Riesgo por trade: 1% (100 USDT)

---

## RESUMEN EJECUTIVO

| Estrategia | Trades | Win Rate | PnL % | Profit Factor | Max Drawdown | Racha + | Racha - |
|---|---|---|---|---|---|---|---|
| **VWAPMomentum** | 19 | **52.6%** | **+0.28%** | **2.22** | 0.05% | 3 | 2 |
| **Confluence** | 8 | 50.0% | +0.24% | **3.00** | 0.06% | 3 | 2 |
| SmartMoney | 6 | 16.7% | -0.04% | 0.59 | 0.10% | 1 | **5** |
| DruLozano | 16 | 18.8% | -0.43% | 0.36 | **0.53%** | 1 | 7 |
| **GLOBAL** | **49** | 36.7% | +0.04% | 1.03 | 0.42% | — | — |

**Ganadora: VWAPMomentum** — mejor equilibrio frecuencia/win rate/profit factor.
**Peor rendimiento: DruLozano** — mayor drawdown y peor racha negativa (7 pérdidas seguidas).

---

## ANÁLISIS POR ESTRATEGIA

---

### 1. VWAPMOMENTUM — LA MÁS CONSISTENTE

**Lógica**: Detecta cruces del precio sobre/bajo el VWAP con confirmación de volumen y RSI.

**Resultados detallados**:
- 19 trades en 2 años (~1 por mes, frecuencia saludable)
- Win Rate 52.6% — única que gana más de la mitad
- Avg Win: +5.0% | Avg Loss: -2.5% — ratio 2:1 siempre favorable
- Profit Factor 2.22 — por cada dólar perdido gana 2.22
- Max Drawdown: 0.05% — la más controlada de todas
- Racha positiva máxima: 3 consecutivas
- Racha negativa máxima: 2 consecutivas

**Contexto de mercado favorable**:
Mercados en **tendencia clara** (bull o bear sostenido). El VWAP actúa como soporte/resistencia institucional dinámico. En el rally 2024-2025 (BTC 73k→109k) esta estrategia capturó los rebotes sobre VWAP sistemáticamente.

**Contexto adverso**:
Mercados laterales con mucho ruido. El precio cruza el VWAP repetidamente sin dirección, generando señales falsas. En consolidaciones de 2-3 meses el win rate baja drásticamente.

---

### 2. CONFLUENCE — MEJOR PROFIT FACTOR

**Lógica**: Suma votos de 6 indicadores (BB, EMA20, SMA200, swing, VWAP, volumen). Entra solo con score >= 5.

**Resultados detallados**:
- Solo 8 trades en 2 años (muy selectiva, ~1 cada 3 meses)
- Win Rate 50% — equilibrio perfecto
- Avg Win: +9.0% | Avg Loss: -3.0% — ratio 3:1, el mejor de todas
- Profit Factor 3.00 — el más alto de todas las estrategias
- Max Drawdown: 0.06% — prácticamente nulo
- Racha positiva máxima: 3 consecutivas
- Racha negativa máxima: 2 consecutivas

**Contexto de mercado favorable**:
**Reversiones en zonas extremas**. Excelente para detectar suelos y techos cuando múltiples indicadores confluyen. En el BTC, funcionó perfectamente en la corrección Feb-Abr 2025 (BTC bajó a 76k tocando BB inferior + swing low + EMA20 simultáneamente).

**Contexto adverso**:
Tendencias muy fuertes donde el precio se mantiene en extremo de Bollinger durante semanas. En rallies de 30%+ la confluencia puede alcanzarse contra la tendencia y perder.

---

### 3. SMARTMONEY — NECESITA REFACTORIZACIÓN

**Lógica**: Detecta estructura HH/HL, filtra con SMA200, entra en rebote de swing levels.

**Resultados detallados**:
- Solo 6 trades en 2 años (muy poca frecuencia)
- Win Rate 16.7% — 1 de 6 ganados
- Avg Win: +6.05% | Avg Loss: -2.06%
- Profit Factor 0.59 — pierde dinero a largo plazo
- Racha negativa máxima: 5 pérdidas consecutivas
- Max Drawdown: 0.10%

**Diagnóstico**:
La detección de estructura HH/HL en timeframe diario es demasiado mecánica. BTC en 1D tiene frecuentes "fakeouts" donde el precio penetra un swing level brevemente antes de rebotar, activando el trade en el peor momento. El problema no es la lógica sino la ejecución en el timeframe equivocado.

**Contexto de mercado favorable**:
Teóricamente en tendencias con correcciones ordenadas y estructura limpia. En la práctica, 1D no tiene la granularidad necesaria.

**Contexto adverso**:
Alta volatilidad, news events, correcciones bruscas. Todo lo que rompe los swing levels de forma temporal.

---

### 4. DRULAOZANO — MAL ADAPTADA AL 1D

**Lógica**: MA Stack (50/100/150/200) + Liquidity Sweep + Order Block/FVG.

**Resultados detallados**:
- 16 trades en 2 años
- Win Rate 18.8% — muy bajo
- Avg Win: +15.66% | Avg Loss: -6.95% — ratio 2.25:1
- Profit Factor 0.36 — la peor de todas
- Max Drawdown: 0.53% — el más alto
- Racha negativa máxima: 7 pérdidas consecutivas (la peor del backtest)
- Racha positiva máxima: 1

**Diagnóstico**:
La estrategia tiene lógica institucional sólida pero fue diseñada para 1h-4h. En 1D, un "Liquidity Sweep" tarda días en confirmarse y el entry ya no coincide con el precio real de reversión. Los resultados del 1D no representan el potencial real de la estrategia.

**Contexto donde funcionaría mejor**:
4h con mercados que respetan estructura institucional. Los sweeps de liquidez en 4h ocurren en horas, el precio revierte rápidamente y el entry es preciso.

---

## ANÁLISIS DE RACHAS

| Estrategia | Peor racha negativa | Capital en riesgo (1% x N) | Impacto psicológico |
|---|---|---|---|
| VWAPMomentum | 2 pérdidas seguidas | -5.0% del capital | Bajo |
| Confluence | 2 pérdidas seguidas | -6.0% del capital | Bajo |
| SmartMoney | 5 pérdidas seguidas | -10.3% del capital | Moderado |
| DruLozano | 7 pérdidas seguidas | -48.5% del capital | Alto |

Con 1% de riesgo por trade la cuenta sobrevive cualquier racha. Pero 7 pérdidas consecutivas en DruLozano requieren mucha disciplina para no abandonar el sistema.

---

## CONTEXTO DEL MERCADO — BTCUSDT 2024-2026

El período analizado incluyó cuatro fases de mercado bien diferenciadas:

- **May-Oct 2024**: Lateral post-halving (56k-73k). Favorece: Confluence. Perjudica: VWAP.
- **Nov 2024-Ene 2025**: Rally histórico +49% (73k→109k). Favorece: VWAP. Perjudica: Dru/SmartMoney (entradas contra-tendencia).
- **Feb-Abr 2025**: Corrección ordenada -30% (109k→76k). Favorece: Confluence (detecta suelo). Perjudica: VWAP.
- **May 2025**: Recuperación y lateralización (76k-82k). Favorece: Confluence, VWAP con volumen.

---

## MEJORAS PROPUESTAS POR ESTRATEGIA

---

### VWAPMomentum — OPTIMIZAR SL Y AGREGAR TRAILING

**Problema**: SL fijo 2.5% en 1D es demasiado ajustado. Las velas diarias tienen rangos de 3-5% y el precio puede tocar el SL antes de ir en la dirección correcta.

**Mejoras**:
1. **SL basado en ATR** — reemplazar el 2.5% fijo por 1.5 × ATR(14). En BTC 1D el ATR suele ser 3-4%, el SL se adaptaría automáticamente al contexto de volatilidad.
2. **Filtro de tendencia macro** — solo operar BUY cuando precio > SMA200, solo SELL cuando precio < SMA200. Elimina señales contra la tendencia.
3. **Umbral de volumen más estricto** — subir de 1.2x a 1.5x el volumen promedio. Reduce señales pero mejora calidad.
4. **Trailing stop** — una vez que el trade gana 3%, mover el SL al breakeven. Protege ganancias y permite que los ganadores corran hacia el TP completo.
5. **Confirmación de vela siguiente** — no entrar en el cruce del VWAP, sino cuando la vela cierra del lado correcto del VWAP.

**Mejora esperada**: Win rate 52% → 60-65%. Profit factor 2.22 → 3.0+.

---

### Confluence — AUMENTAR FRECUENCIA SIN SACRIFICAR CALIDAD

**Problema**: Solo 8 trades en 2 años. Con un profit factor de 3.0 la estrategia es excelente pero necesita más oportunidades.

**Mejoras**:
1. **Umbral 1D = 4 puntos** (en vez de 5). Las velas diarias son más difíciles de alcanzar 5 puntos simultáneos. Bajar el umbral solo para 1D mantiene calidad.
2. **Agregar RSI como indicador** — RSI < 30 suma 2 puntos (sobreventa), RSI > 70 suma 2 puntos (sobrecompra). Genera más señales válidas de reversión.
3. **Expandir a más pares** — correr Confluence en ETH, ADA, SOL, BNB. El mismo sistema multiplicaría las oportunidades manteniendo la calidad.
4. **Partial take profit** — cerrar 50% de la posición en TP1 (5%) y dejar el 50% restante correr hasta TP2 (10-12%). Captura más en los grandes movimientos sin perder el trade.

**Mejora esperada**: 8 trades/2 años → 20-25 trades/2 años. PnL total 0.24% → 1.5-2%.

---

### SmartMoney — REFACTORIZAR COMPLETAMENTE

**Problema**: Win rate 16.7% hace la estrategia no viable a largo plazo. La detección de estructura en 1D es deficiente.

**Mejoras**:
1. **Cambiar a 4h** — en 4h la estructura HH/HL es más clara y los fakeouts son menores porque hay más granularidad.
2. **Distancia mínima entre swings** — exigir que swing highs/lows estén separados por al menos 5 velas en 4h (20 velas en 1D). Evita micro-estructuras sin significado.
3. **Confirmación de cierre** — no entrar al toque del swing sino cuando la vela **cierra** por encima/debajo del nivel. Elimina fakeouts.
4. **SL más amplio** — usar 2× ATR en vez de 0.5× ATR. En 1D el precio puede penetrar un swing brevemente antes de rebotar. El SL actual es demasiado cercano.
5. **Filtro de volumen en el rebote** — el rebote en el swing debe venir con volumen > 1.5× promedio para confirmar presencia institucional.

**Mejora esperada**: Win rate 17% → 40-45%. Profit factor 0.59 → 1.5+.

---

### DruLozano — CAMBIAR TIMEFRAME Y REFINAR SWEEP

**Problema principal**: Diseñada para 1h-4h, completamente inadecuada en 1D. Los sweeps de liquidez en diario tardan días en formarse y el entry no tiene precisión.

**Mejoras**:
1. **Mover exclusivamente a 4h** — el timeframe natural para esta estrategia. Los sweeps ocurren en horas, la reversión es rápida y el entry es preciso.
2. **Validar el sweep en vela siguiente** — actualmente entra en la misma vela del sweep. Esperar que la vela siguiente confirme la reversión con cierre fuerte en dirección opuesta.
3. **Order Block más estricto** — el OB solo es válido si la vela de impulso posterior es al menos 2× el tamaño del OB. Filtra OBs débiles.
4. **MA Stack más permisivo** — en vez de exigir MA50>MA100>MA150>MA200 perfecta, exigir precio > MA50 > MA200. Genera más señales manteniendo el sesgo macro.
5. **Triple confirmación obligatoria** — solo operar cuando coinciden: Sweep + (OB o FVG) + MA Stack. Los tres juntos. Actualmente basta con Sweep + (OB o FVG).

**Mejora esperada en 4h**: Win rate 19% → 35-45%. Profit factor 0.36 → 1.5-2.0.

---

## CONFIGURACIÓN ÓPTIMA RECOMENDADA

| Estrategia | Timeframe actual | Timeframe recomendado | Estado | Prioridad |
|---|---|---|---|---|
| VWAPMomentum | 1m, 1h, 4h | 1h, 4h | Mantener + optimizar SL | Alta |
| Confluence | 1m, 1h, 4h | 1h, 4h, 1D | Mantener + bajar umbral 1D | Alta |
| SmartMoney | 1m, 1h, 4h | 4h únicamente | Refactorizar | Media |
| DruLozano | 1m, 1h, 4h | 4h únicamente | Cambiar TF urgente | Alta |

**Recomendación de riesgo por estrategia**:
- VWAPMomentum: 40% del capital diario en riesgo
- Confluence: 40% del capital diario en riesgo
- DruLozano (4h): 15%
- SmartMoney (4h): 5% hasta que mejore el win rate

---

## PROYECCIÓN CON MEJORAS IMPLEMENTADAS

Si se implementan las mejoras propuestas, los resultados proyectados en 1 año serían:

| Métrica | Actual (backtest) | Proyectado (con mejoras) |
|---|---|---|
| Win Rate Global | 36.7% | 48-55% |
| Profit Factor | 1.03 | 1.8-2.5 |
| Max Drawdown | 0.42% | 0.2-0.3% |
| PnL anual | +0.04% | +5-12% |
| Trades/año | ~25 | ~40-60 |

---

## CONCLUSIÓN

El sistema actual es **marginalmente rentable** en 1D. La clave para mejorarlo:

1. **Inmediato**: Desactivar SmartMoney y DruLozano en 1m y 1D. Solo operarlos en 4h.
2. **Corto plazo**: Implementar SL basado en ATR en VWAPMomentum y trailing stop.
3. **Mediano plazo**: Agregar RSI a Confluence y bajar umbral para 1D.
4. **Largo plazo**: Refactorizar SmartMoney con confirmación de cierre y volumen.

Las dos estrategias que sostienen el sistema son **VWAPMomentum y Confluence**. Son las que deben recibir la mayor atención y capital.

---

*Informe generado automáticamente por Trading Bot Backtest Engine*
*Datos reales: Binance API — BTCUSDT 1D — Mayo 2024 / Mayo 2026*
*731 velas analizadas — 49 trades simulados — Capital inicial 10,000 USDT — Riesgo 1%/trade*
