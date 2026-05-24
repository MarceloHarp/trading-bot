import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { atr, adx, donchian, rsi } from '../indicators';

/**
 * "Saltando del Lambo" — Range / Mean-Reversion
 * ----------------------------------------------
 * Cuando el mercado NO tiene tendencia (ADX bajo) el precio rebota entre
 * un piso (soporte) y un techo (resistencia). Esta estrategia opera ESE
 * rango: vende en el techo, compra en el piso — siempre con confirmación
 * de reversión y SL apenas afuera del rango (si el rango se rompe, salimos
 * rápido con pérdida chica).
 *
 * "Saltar del lambo" = bajarse del auto en el techo (tomar ganancia / short)
 * y volver a subir en el piso (long). El truco: NO operar breakouts —
 * solo rebotes dentro de un rango establecido.
 *
 * Detección de rango:
 *  - ADX < maxADX  → mercado lateral (sin tendencia fuerte)
 *  - ancho del rango (Donchian N) entre minWidth% y maxWidth%
 *  - el precio NO debe haber cerrado fuera del rango (eso sería breakout)
 *
 * LONG (rebote en el piso):
 *  - el low de la vela mete en la zona baja (≤ piso + edgePct·ancho)
 *  - cierra por encima del piso (no lo perdió) y es vela alcista (confirmación)
 *  - RSI en zona de sobreventa (momentum agotado)
 *  - SL: piso − slBufferAtr·ATR   |   TP: centro del rango (mean reversion)
 *
 * SHORT (rechazo en el techo): simétrico.
 *
 * ⏱  SOLO 4h: en 1h el ruido rompe los micro-rangos (backtest 1h = PF 0.5).
 * En 4h los bordes son S/R reales. Backtest ~500d (config V2b, 4h):
 *   BTC 54.2% WR PF 1.54 +8.3% | BNB 69.2% WR PF 2.89 +21.2%.
 * Excluidos: SOL (muy trending, PF ~1.0) y ETH (PF 0.94, perdedor marginal).
 */
export class SaltandoDelLamboStrategy implements Strategy {
  readonly name = 'SaltandoDelLambo';

  // Solo donde el rango es limpio y rentable (backtest 4h). SOL y ETH afuera.
  private readonly allowedSymbols = new Set(['BTCUSDT', 'BNBUSDT']);

  private readonly rangePeriod = 48;     // velas para definir el rango (Donchian)
  private readonly adxPeriod = 14;
  private readonly atrPeriod = 14;
  private readonly rsiPeriod = 14;
  private readonly maxADX = 25;          // ADX < 25 = mercado lateral (sin tendencia)
  private readonly minWidthPct = 0.015;  // rango mínimo 1.5% (si es más chico, las fees lo comen)
  private readonly maxWidthPct = 0.18;   // rango máximo 18% (más que esto = probablemente trending)
  private readonly edgePct = 0.22;       // zona de entrada = 22% exterior del rango
  private readonly slBufferAtr = 1.8;    // SL = borde del rango ± 1.8·ATR (room para el wick)
  private readonly rsiOS = 38;            // sobreventa para LONG
  private readonly rsiOB = 62;            // sobrecompra para SHORT
  private readonly minRR = 0.6;           // mean-reversion: WR alto compensa RR moderado

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (!this.allowedSymbols.has(symbol)) return null;
    if (timeframe !== '4h') return null;   // estrategia exclusiva de 4h
    if (candles.length < this.rangePeriod + this.adxPeriod * 2 + 5) return null;

    const closes = candles.map(c => c.close);
    const atrArr = atr(candles, this.atrPeriod);
    const adxArr = adx(candles, this.adxPeriod);
    const rsiArr = rsi(closes, this.rsiPeriod);
    const don = donchian(candles, this.rangePeriod);

    const i = candles.length - 1;
    const last = candles[i];
    const lastAtr = atrArr[i];
    const lastAdx = adxArr[i];
    const lastRsi = rsiArr[i];

    // Rango definido por las velas ANTERIORES (no incluye el spike de la actual)
    const rangeHi = don.upper[i - 1];
    const rangeLo = don.lower[i - 1];

    if ([lastAtr, lastAdx, lastRsi, rangeHi, rangeLo].some(v => Number.isNaN(v))) return null;
    if (lastAtr <= 0) return null;

    // --- Filtro de régimen lateral ---
    if (lastAdx >= this.maxADX) return null;        // hay tendencia → no es rango
    const width = rangeHi - rangeLo;
    const widthPct = width / rangeLo;
    if (widthPct < this.minWidthPct || widthPct > this.maxWidthPct) return null;

    const mid = (rangeHi + rangeLo) / 2;
    const loZone = rangeLo + width * this.edgePct;  // techo de la zona de compra
    const hiZone = rangeHi - width * this.edgePct;  // piso de la zona de venta

    /* -------- LONG: rebote en el piso -------- */
    // El low metió en la zona baja, pero cerró por encima del piso (no lo perdió)
    // y es vela alcista de confirmación + RSI en sobreventa.
    const dippedFloor = last.low <= loZone && last.low >= rangeLo - lastAtr * 0.5;
    const heldFloor = last.close > rangeLo;
    const bullishConfirm = last.close > last.open;
    if (dippedFloor && heldFloor && bullishConfirm && lastRsi <= this.rsiOS) {
      const entryPrice = last.close;
      const stopLoss = rangeLo - lastAtr * this.slBufferAtr;
      const risk = entryPrice - stopLoss;
      if (risk <= 0) return null;
      const targetPrice = mid;                       // mean reversion al centro
      const rr = (targetPrice - entryPrice) / risk;
      if (rr < this.minRR) return null;

      return {
        symbol, timeframe,
        strategy: 'SaltandoDelLambo',
        direction: 'BUY',
        entryPrice, stopLoss, targetPrice,
        confidence: 0.75,
        reason: `Rebote en piso de rango @ ${rangeLo.toFixed(2)} (ADX:${lastAdx.toFixed(0)}, RSI:${lastRsi.toFixed(0)}) → TP centro ${mid.toFixed(2)}`,
        meta: {
          rangeHigh: rangeHi,
          rangeLow: rangeLo,
          rangeMid: mid,
          adx: lastAdx,
          rsi: lastRsi,
          atr: lastAtr,
          rr: Math.round(rr * 100) / 100,
        },
      };
    }

    /* -------- SHORT: rechazo en el techo -------- */
    const spikedCeiling = last.high >= hiZone && last.high <= rangeHi + lastAtr * 0.5;
    const heldCeiling = last.close < rangeHi;
    const bearishConfirm = last.close < last.open;
    if (spikedCeiling && heldCeiling && bearishConfirm && lastRsi >= this.rsiOB) {
      const entryPrice = last.close;
      const stopLoss = rangeHi + lastAtr * this.slBufferAtr;
      const risk = stopLoss - entryPrice;
      if (risk <= 0) return null;
      const targetPrice = mid;
      const rr = (entryPrice - targetPrice) / risk;
      if (rr < this.minRR) return null;

      return {
        symbol, timeframe,
        strategy: 'SaltandoDelLambo',
        direction: 'SELL',
        entryPrice, stopLoss, targetPrice,
        confidence: 0.75,
        reason: `Rechazo en techo de rango @ ${rangeHi.toFixed(2)} (ADX:${lastAdx.toFixed(0)}, RSI:${lastRsi.toFixed(0)}) → TP centro ${mid.toFixed(2)}`,
        meta: {
          rangeHigh: rangeHi,
          rangeLow: rangeLo,
          rangeMid: mid,
          adx: lastAdx,
          rsi: lastRsi,
          atr: lastAtr,
          rr: Math.round(rr * 100) / 100,
        },
      };
    }

    return null;
  }
}
