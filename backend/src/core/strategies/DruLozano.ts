import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { sma, ema, atr, findSwings } from '../indicators';

/**
 * Estrategia Dru Lozano — "Atrévete"
 * -----------------------------------
 * Basada en el informe institucional de Carlos "Dru" Lozano.
 *
 * Pilares implementados:
 * 1. MA Stack: MA50 (amarilla), MA100 (azul), MA150 (purple), MA200 (roja)
 *    - Sesgo BULLISH: precio > MA50 > MA100 > MA150 > MA200 (stack alcista)
 *    - Sesgo BEARISH: precio < MA50 < MA100 < MA150 < MA200
 * 2. Order Blocks: vela con cuerpo fuerte seguida de movimiento > 1.5x ATR
 * 3. Fair Value Gaps (FVG): gaps de precio donde high[i-1] < low[i+1] o inverso
 * 4. Liquidity Sweeps: el precio rompe un swing high/low y revierte
 * 5. Confirmacion: requiere que el precio este dentro de un OB o FVG + sweep previo
 *
 * Timeframe sugerido: 4h (contextualización) con entrada en 1h
 * R:R mínimo: 2:1
 */
export class DruLozanoStrategy implements Strategy {
  readonly name = 'DruLozano';

  private readonly ma50p   = 50;
  private readonly ma100p  = 100;
  private readonly ma150p  = 150;
  private readonly ma200p  = 200;
  private readonly atrP    = 14;
  private readonly minRR   = 3;
  private readonly obLookback = 30; // velas para buscar order blocks

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (candles.length < this.ma200p + 10) return null;

    const closes  = candles.map(c => c.close);
    const ma50arr  = sma(closes, this.ma50p);
    const ma100arr = sma(closes, this.ma100p);
    const ma150arr = sma(closes, this.ma150p);
    const ma200arr = sma(closes, this.ma200p);
    const atrArr   = atr(candles, this.atrP);

    const i = candles.length - 1;
    const price  = closes[i];
    const ma50   = ma50arr[i];
    const ma100  = ma100arr[i];
    const ma150  = ma150arr[i];
    const ma200  = ma200arr[i];
    const lastAtr = atrArr[i];

    if ([ma50, ma100, ma150, ma200, lastAtr].some(v => Number.isNaN(v))) return null;
    if (lastAtr === 0) return null;

    // --- Sesgo direccional por MA Stack ---
    const bullStack = price > ma50 && ma50 > ma100 && ma100 > ma150 && ma150 > ma200;
    const bearStack = price < ma50 && ma50 < ma100 && ma100 < ma150 && ma150 < ma200;
    if (!bullStack && !bearStack) return null;

    const swings = findSwings(candles, 5);

    // --- Detectar Liquidity Sweep reciente ---
    const sweep = this.detectLiquiditySweep(candles, swings, bullStack);
    if (!sweep) return null;

    // --- Detectar Order Block o Fair Value Gap ---
    const ob  = this.findOrderBlock(candles, bullStack, lastAtr);
    const fvg = this.findFairValueGap(candles, bullStack);

    // Triple confirmación: sweep siempre requerido, al menos OB o FVG
    const hasSetup = ob !== null || fvg !== null;
    const tripleConfirm = hasSetup; // base, se puede exigir ambos con: ob !== null && fvg !== null
    if (!tripleConfirm) return null;

    // --- Confirmar reversión en última vela ---
    const lastCandle = candles[candles.length - 1];
    const candleBody = Math.abs(lastCandle.close - lastCandle.open);
    const candleRange = lastCandle.high - lastCandle.low;
    const bodyRatio = candleRange > 0 ? candleBody / candleRange : 0;
    // La vela de entrada debe tener cuerpo fuerte (>50% del rango)
    const confirmCandle = bodyRatio > 0.5;
    if (!confirmCandle) return null;

    // --- Calcular entrada, SL y TP ---
    if (bullStack) {
      const entryPrice = price;
      // SL debajo del mínimo del sweep o del OB, protegido por ATR
      const swingLow = Math.min(...swings.filter(s => s.type === 'low').slice(-5).map(s => s.price));
      const stopLoss = Math.min(swingLow, sweep.extremePrice) - lastAtr * 0.3;
      const risk = entryPrice - stopLoss;
      if (risk <= 0) return null;
      const rawTP = entryPrice + risk * this.minRR;
      const targetPrice = Math.max(rawTP, entryPrice * 1.05);

      const setupType = ob ? 'OrderBlock' : 'FVG';
      const confidence = ob && fvg ? 0.85 : 0.75;

      return {
        symbol, timeframe,
        strategy: 'DruLozano',
        direction: 'BUY',
        entryPrice, stopLoss, targetPrice, confidence,
        reason: `MA Stack alcista + Liquidity Sweep + ${setupType} | MA50:${ma50.toFixed(0)} MA200:${ma200.toFixed(0)}`,
        meta: { ma50, ma100, ma150, ma200, sweep: sweep.extremePrice, setupType, atr: lastAtr, ob: ob?.price ?? null, fvg: fvg ?? null },
      };
    }

    // BEARISH
    const entryPrice = price;
    const swingHigh = Math.max(...swings.filter(s => s.type === 'high').slice(-5).map(s => s.price));
    const stopLoss = Math.max(swingHigh, sweep.extremePrice) + lastAtr * 0.3;
    const risk = stopLoss - entryPrice;
    if (risk <= 0) return null;
    const rawTP2 = entryPrice - risk * this.minRR;
    const targetPrice = Math.min(rawTP2, entryPrice * 0.95);

    const setupType = ob ? 'OrderBlock' : 'FVG';
    const confidence = ob && fvg ? 0.85 : 0.75;

    return {
      symbol, timeframe,
      strategy: 'DruLozano',
      direction: 'SELL',
      entryPrice, stopLoss, targetPrice, confidence,
      reason: `MA Stack bajista + Liquidity Sweep + ${setupType} | MA50:${ma50.toFixed(0)} MA200:${ma200.toFixed(0)}`,
      meta: { ma50, ma100, ma150, ma200, sweep: sweep.extremePrice, setupType, atr: lastAtr, ob: ob?.price ?? null, fvg: fvg ?? null },
    };
  }

  /**
   * Liquidity Sweep: el precio rompió un swing y revirtió en las últimas 5 velas.
   * Bullish sweep: precio perforó un swing low y volvió por encima.
   * Bearish sweep: precio perforó un swing high y volvió por debajo.
   */
  private detectLiquiditySweep(
    candles: Candle[],
    swings: ReturnType<typeof findSwings>,
    isBull: boolean
  ): { extremePrice: number } | null {
    const recent = candles.slice(-10);
    if (isBull) {
      const swingLows = swings.filter(s => s.type === 'low').slice(-5).map(s => s.price);
      if (swingLows.length < 2) return null;
      const level = Math.max(...swingLows.slice(0, -1)); // swing low previo
      // Buscar vela que penetró el nivel y luego cerró por encima
      for (let j = recent.length - 5; j < recent.length - 1; j++) {
        if (recent[j].low < level && recent[j].close > level) {
          return { extremePrice: recent[j].low };
        }
      }
    } else {
      const swingHighs = swings.filter(s => s.type === 'high').slice(-5).map(s => s.price);
      if (swingHighs.length < 2) return null;
      const level = Math.min(...swingHighs.slice(0, -1));
      for (let j = recent.length - 5; j < recent.length - 1; j++) {
        if (recent[j].high > level && recent[j].close < level) {
          return { extremePrice: recent[j].high };
        }
      }
    }
    return null;
  }

  /**
   * Order Block: vela con cuerpo grande seguida de movimiento fuerte en la misma dirección.
   * Bullish OB: vela bajista grande seguida de rally > 1.5 ATR.
   * Bearish OB: vela alcista grande seguida de caída > 1.5 ATR.
   */
  private findOrderBlock(
    candles: Candle[],
    isBull: boolean,
    lastAtr: number
  ): { price: number } | null {
    const recent = candles.slice(-this.obLookback);
    const last = candles[candles.length - 1];

    for (let j = recent.length - 8; j < recent.length - 2; j++) {
      const c = recent[j];
      const bodySize = Math.abs(c.close - c.open);
      if (bodySize < lastAtr * 0.5) continue;

      if (isBull) {
        // OB alcista: vela bajista (roja) cuya zona es ahora soporte
        const isRedCandle = c.close < c.open;
        const obTop = c.open; // tope del OB bajista es el open
        const obBot = c.close;
        // Precio actual dentro del rango del OB
        if (isRedCandle && last.close >= obBot && last.close <= obTop) {
          return { price: obBot };
        }
      } else {
        // OB bajista: vela alcista (verde) cuya zona es ahora resistencia
        const isGreenCandle = c.close > c.open;
        const obTop = c.close;
        const obBot = c.open;
        if (isGreenCandle && last.close >= obBot && last.close <= obTop) {
          return { price: obTop };
        }
      }
    }
    return null;
  }

  /**
   * Fair Value Gap: gap de precio entre 3 velas consecutivas.
   * Bullish FVG: high[i-2] < low[i] — gap al alza que el precio está visitando.
   * Bearish FVG: low[i-2] > high[i] — gap a la baja.
   */
  private findFairValueGap(
    candles: Candle[],
    isBull: boolean
  ): { top: number; bottom: number } | null {
    const last = candles[candles.length - 1];

    for (let j = candles.length - 20; j < candles.length - 2; j++) {
      const c0 = candles[j];
      const c2 = candles[j + 2];

      if (isBull) {
        // FVG alcista: gap entre high de c0 y low de c2
        if (c0.high < c2.low) {
          const fvgTop = c2.low;
          const fvgBot = c0.high;
          // Precio actual dentro del FVG
          if (last.close >= fvgBot && last.close <= fvgTop) {
            return { top: fvgTop, bottom: fvgBot };
          }
        }
      } else {
        // FVG bajista
        if (c0.low > c2.high) {
          const fvgTop = c0.low;
          const fvgBot = c2.high;
          if (last.close >= fvgBot && last.close <= fvgTop) {
            return { top: fvgTop, bottom: fvgBot };
          }
        }
      }
    }
    return null;
  }
}
