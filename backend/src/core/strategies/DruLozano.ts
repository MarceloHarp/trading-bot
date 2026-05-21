import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { sma, atr } from '../indicators';

/**
 * Estrategia Dru Lozano — MA Stack + Pullback a MA50
 * ---------------------------------------------------
 * Lógica corregida: en vez de sweep counter-trend, opera CON la tendencia.
 *
 * 1. MA Stack: precio > MA50 > MA100 > MA150 > MA200 (bull) o inverso (bear)
 * 2. Pullback: el precio retrocede hasta tocar la MA50 (soporte/resistencia dinámico)
 * 3. Bounce: vela de confirmación con cuerpo >50% que cierra de vuelta del lado correcto
 * 4. OB/FVG: confluencia adicional que sube la confianza (no obligatorio)
 *
 * R:R mínimo: 3:1
 */
export class DruLozanoStrategy implements Strategy {
  readonly name = 'DruLozano';

  private readonly ma50p    = 50;
  private readonly ma100p   = 100;
  private readonly ma150p   = 150;
  private readonly ma200p   = 200;
  private readonly atrP     = 14;
  private readonly minRR    = 3;
  private readonly obLookback = 30;

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (candles.length < this.ma200p + 10) return null;

    const closes   = candles.map(c => c.close);
    const ma50arr  = sma(closes, this.ma50p);
    const ma100arr = sma(closes, this.ma100p);
    const ma150arr = sma(closes, this.ma150p);
    const ma200arr = sma(closes, this.ma200p);
    const atrArr   = atr(candles, this.atrP);

    const i       = candles.length - 1;
    const price   = closes[i];
    const ma50    = ma50arr[i];
    const ma100   = ma100arr[i];
    const ma150   = ma150arr[i];
    const ma200   = ma200arr[i];
    const lastAtr = atrArr[i];

    if ([ma50, ma100, ma150, ma200, lastAtr].some(v => Number.isNaN(v))) return null;
    if (lastAtr === 0) return null;

    // MA Stack: tendencia fuerte alineada
    const bullStack = price > ma50 && ma50 > ma100 && ma100 > ma150 && ma150 > ma200;
    const bearStack = price < ma50 && ma50 < ma100 && ma100 < ma150 && ma150 < ma200;
    if (!bullStack && !bearStack) return null;

    const last = candles[i];
    const candleRange = last.high - last.low;
    const bodyRatio = candleRange > 0 ? Math.abs(last.close - last.open) / candleRange : 0;

    if (bullStack) {
      // Pullback: alguna de las últimas 3 velas tocó o perforó la MA50
      const pulledBack = [1, 2, 3].some(offset => {
        const j = i - offset;
        return j >= 0 && candles[j].low <= ma50arr[j] + lastAtr * 0.3;
      });
      if (!pulledBack) return null;

      // Bounce: vela actual cierra por encima de MA50 con cuerpo alcista fuerte
      const bounced = last.close > ma50 && last.close > last.open && bodyRatio > 0.5;
      if (!bounced) return null;

      // Confluencia OB/FVG (opcional — sube confianza)
      const ob  = this.findOrderBlock(candles, true, lastAtr);
      const fvg = this.findFairValueGap(candles, true);

      const entryPrice = price;
      // SL debajo del mínimo de las últimas 3 velas (el pullback completo)
      const recentMin = Math.min(...[0, 1, 2, 3].map(o => candles[i - o]?.low ?? Infinity));
      const stopLoss  = recentMin - lastAtr * 0.3;
      const risk = entryPrice - stopLoss;
      if (risk <= 0) return null;
      const targetPrice = entryPrice + risk * this.minRR;

      const confidence = ob && fvg ? 0.85 : ob || fvg ? 0.75 : 0.65;
      const extras = ob ? '+OB' : fvg ? '+FVG' : '';

      return {
        symbol, timeframe,
        strategy: 'DruLozano',
        direction: 'BUY',
        entryPrice, stopLoss, targetPrice, confidence,
        reason: `MA Stack alcista + Pullback MA50${extras} | MA50:${ma50.toFixed(0)} MA200:${ma200.toFixed(0)}`,
        meta: { ma50, ma100, ma150, ma200, atr: lastAtr, ob: ob?.price ?? null, fvg: fvg ?? null },
      };
    }

    // BEARISH: pullback al alza hasta MA50, rechazo bajista
    const pulledBack = [1, 2, 3].some(offset => {
      const j = i - offset;
      return j >= 0 && candles[j].high >= ma50arr[j] - lastAtr * 0.3;
    });
    if (!pulledBack) return null;

    const bounced = last.close < ma50 && last.close < last.open && bodyRatio > 0.5;
    if (!bounced) return null;

    const ob  = this.findOrderBlock(candles, false, lastAtr);
    const fvg = this.findFairValueGap(candles, false);

    const entryPrice = price;
    const recentMax  = Math.max(...[0, 1, 2, 3].map(o => candles[i - o]?.high ?? -Infinity));
    const stopLoss   = recentMax + lastAtr * 0.3;
    const risk = stopLoss - entryPrice;
    if (risk <= 0) return null;
    const targetPrice = entryPrice - risk * this.minRR;

    const confidence = ob && fvg ? 0.85 : ob || fvg ? 0.75 : 0.65;
    const extras = ob ? '+OB' : fvg ? '+FVG' : '';

    return {
      symbol, timeframe,
      strategy: 'DruLozano',
      direction: 'SELL',
      entryPrice, stopLoss, targetPrice, confidence,
      reason: `MA Stack bajista + Pullback MA50${extras} | MA50:${ma50.toFixed(0)} MA200:${ma200.toFixed(0)}`,
      meta: { ma50, ma100, ma150, ma200, atr: lastAtr, ob: ob?.price ?? null, fvg: fvg ?? null },
    };
  }

  private findOrderBlock(candles: Candle[], isBull: boolean, lastAtr: number): { price: number } | null {
    const recent = candles.slice(-this.obLookback);
    const last   = candles[candles.length - 1];
    for (let j = recent.length - 8; j < recent.length - 2; j++) {
      const c = recent[j];
      if (Math.abs(c.close - c.open) < lastAtr * 0.5) continue;
      if (isBull) {
        if (c.close < c.open && last.close >= c.close && last.close <= c.open)
          return { price: c.close };
      } else {
        if (c.close > c.open && last.close >= c.open && last.close <= c.close)
          return { price: c.close };
      }
    }
    return null;
  }

  private findFairValueGap(candles: Candle[], isBull: boolean): { top: number; bottom: number } | null {
    const last = candles[candles.length - 1];
    for (let j = candles.length - 20; j < candles.length - 2; j++) {
      const c0 = candles[j];
      const c2 = candles[j + 2];
      if (isBull && c0.high < c2.low) {
        if (last.close >= c0.high && last.close <= c2.low)
          return { top: c2.low, bottom: c0.high };
      } else if (!isBull && c0.low > c2.high) {
        if (last.close >= c2.high && last.close <= c0.low)
          return { top: c0.low, bottom: c2.high };
      }
    }
    return null;
  }
}
