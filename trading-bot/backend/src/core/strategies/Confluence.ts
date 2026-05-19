import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { bollinger, closes, ema, findSwings, sma, vwap } from '../indicators';

/**
 * Confluence Zones
 * ---------------------------------
 * Suma "votos" de varios indicadores en el precio actual:
 *  - Banda extrema de Bollinger (volatilidad)
 *  - Confluencia con EMA20
 *  - Confluencia con SMA200 (largo plazo)
 *  - Cerca de un nivel técnico (swing previo)
 *  - VWAP cercano
 *  - Volumen alto
 *
 * Si score >= 5 → setup válido.
 * Dirección según posición vs banda y EMA.
 *
 * Timeframe sugerido: 4h
 */
export class ConfluenceStrategy implements Strategy {
  readonly name = 'Confluence';

  private readonly bbPeriod = 20;
  private readonly emaPeriod = 20;
  private readonly smaPeriod = 200;
  private readonly vwapWindow = 50;
  private readonly volWindow = 20;
  private readonly minScore = 5;
  private readonly slPct = 0.03;
  private readonly tpPct = 0.05;

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (candles.length < this.smaPeriod + 5) return null;

    const closeArr = closes(candles);
    const bb = bollinger(closeArr, this.bbPeriod, 2);
    const ema20 = ema(closeArr, this.emaPeriod);
    const sma200 = sma(closeArr, this.smaPeriod);
    const vwapArr = vwap(candles, this.vwapWindow);
    const swings = findSwings(candles, 5);

    const i = candles.length - 1;
    const price = closeArr[i];
    const bbUpper = bb.upper[i];
    const bbLower = bb.lower[i];
    const bbMid = bb.middle[i];
    const e20 = ema20[i];
    const s200 = sma200[i];
    const lastVwap = vwapArr[i];

    if (
      [bbUpper, bbLower, bbMid, e20, s200, lastVwap].some((v) => Number.isNaN(v))
    ) {
      return null;
    }

    const recentVols = candles.slice(-this.volWindow).map((c) => c.volume);
    const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
    const lastVol = candles[i].volume;

    let scoreBuy = 0;
    let scoreSell = 0;
    const elements: string[] = [];

    // 1) Extremo de Bollinger (peso 2)
    if (price <= bbLower * 1.005) {
      scoreBuy += 2;
      elements.push('BB-lower');
    }
    if (price >= bbUpper * 0.995) {
      scoreSell += 2;
      elements.push('BB-upper');
    }

    // 2) Cerca de EMA20 (peso 2)
    if (Math.abs(price - e20) / price < 0.003) {
      // si el precio viene desde arriba → soporte (buy)
      if (price > e20 * 0.997) {
        scoreBuy += 2;
        elements.push('EMA20-support');
      } else {
        scoreSell += 2;
        elements.push('EMA20-resistance');
      }
    }

    // 3) Cerca de SMA200 (peso 2): nivel macro
    if (Math.abs(price - s200) / price < 0.005) {
      if (price > s200) {
        scoreBuy += 2;
        elements.push('SMA200-support');
      } else {
        scoreSell += 2;
        elements.push('SMA200-resistance');
      }
    }

    // 4) Cerca de un swing previo (peso 2)
    const recentSwings = swings.slice(-10);
    const nearLow = recentSwings.find(
      (s) => s.type === 'low' && Math.abs(price - s.price) / price < 0.005
    );
    const nearHigh = recentSwings.find(
      (s) => s.type === 'high' && Math.abs(price - s.price) / price < 0.005
    );
    if (nearLow) {
      scoreBuy += 2;
      elements.push('swing-low');
    }
    if (nearHigh) {
      scoreSell += 2;
      elements.push('swing-high');
    }

    // 5) Cerca de VWAP (peso 1)
    if (Math.abs(price - lastVwap) / price < 0.004) {
      if (price > lastVwap) {
        scoreBuy += 1;
        elements.push('VWAP-support');
      } else {
        scoreSell += 1;
        elements.push('VWAP-resistance');
      }
    }

    // 6) Volumen alto (peso 1, refuerzo)
    if (lastVol > avgVol * 1.4) {
      if (candles[i].close > candles[i].open) {
        scoreBuy += 1;
        elements.push('high-vol-bull');
      } else {
        scoreSell += 1;
        elements.push('high-vol-bear');
      }
    }

    const useBuy = scoreBuy >= this.minScore && scoreBuy > scoreSell;
    const useSell = scoreSell >= this.minScore && scoreSell > scoreBuy;
    if (!useBuy && !useSell) return null;

    const direction = useBuy ? 'BUY' : 'SELL';
    const score = useBuy ? scoreBuy : scoreSell;
    const entryPrice = price;
    const stopLoss = direction === 'BUY' ? entryPrice * (1 - this.slPct) : entryPrice * (1 + this.slPct);
    const targetPrice = direction === 'BUY' ? entryPrice * (1 + this.tpPct) : entryPrice * (1 - this.tpPct);

    return {
      symbol,
      timeframe,
      strategy: 'Confluence',
      direction,
      entryPrice,
      stopLoss,
      targetPrice,
      confidence: Math.min(0.95, 0.6 + score * 0.05),
      reason: `Confluencia ${score} (${elements.join(', ')})`,
      meta: { score, elements, bb: { upper: bbUpper, mid: bbMid, lower: bbLower }, e20, s200, lastVwap },
    };
  }
}
