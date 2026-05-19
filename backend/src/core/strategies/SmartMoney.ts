import type { Strategy } from './Strategy';
import type { Bias, Candle, Signal } from '../../types';
import { atr, findSwings, sma } from '../indicators';

/**
 * Smart Money Structure
 * ---------------------------------
 * - Identifica sesgo por estructura (HH+HL / LH+LL).
 * - Encuentra swings recientes como niveles dinámicos.
 * - Confirma entrada con rechazo de nivel + cierre fuerte.
 * - SL = mínimo/máximo reciente, TP = R:R 2:1.
 *
 * Timeframe sugerido: 4h
 */
export class SmartMoneyStrategy implements Strategy {
  readonly name = 'SmartMoney';

  private readonly swingLookback = 5;
  private readonly trendMA = 200;
  private readonly atrPeriod = 14;
  private readonly riskReward = 3;

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (candles.length < this.trendMA + 10) return null;

    const swings = findSwings(candles, this.swingLookback);
    const bias = this.detectBias(swings);
    if (bias === 'NEUTRAL') return null;

    // Filtro de tendencia con SMA200
    const closes = candles.map((c) => c.close);
    const sma200 = sma(closes, this.trendMA);
    const lastSma = sma200[sma200.length - 1];
    const lastClose = closes[closes.length - 1];
    if (Number.isNaN(lastSma)) return null;
    if (bias === 'BULLISH' && lastClose < lastSma) return null;
    if (bias === 'BEARISH' && lastClose > lastSma) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const atrArr = atr(candles, this.atrPeriod);
    const lastAtr = atrArr[atrArr.length - 1];
    if (Number.isNaN(lastAtr) || lastAtr === 0) return null;

    if (bias === 'BULLISH') {
      // último swing low como soporte
      const lows = swings
        .filter((s) => s.type === 'low')
        .slice(-3)
        .map((s) => s.price);
      if (lows.length === 0) return null;
      const support = Math.max(...lows);

      const tested = last.low <= support + lastAtr * 0.5 && last.low >= support - lastAtr * 0.5;
      const bullishClose = last.close > last.open && last.close > prev.high;
      if (!tested || !bullishClose) return null;

      const entryPrice = last.close;
      const stopLoss = support - lastAtr * 0.5;
      const risk = entryPrice - stopLoss;
      if (risk <= 0) return null;
      const rawTarget = entryPrice + risk * this.riskReward;
        const targetPrice = Math.max(rawTarget, entryPrice * 1.05); // minimo 5%
        return {
        symbol,
        timeframe,
        strategy: 'SmartMoney',
        direction: 'BUY',
        entryPrice,
        stopLoss,
        targetPrice,
        confidence: 0.7,
        reason: 'Estructura alcista (HH+HL), rechazo de soporte y cierre fuerte sobre máxima previa',
        meta: { bias, support, atr: lastAtr, sma200: lastSma },
      };
    }

    // BEARISH
    const highs = swings
      .filter((s) => s.type === 'high')
      .slice(-3)
      .map((s) => s.price);
    if (highs.length === 0) return null;
    const resistance = Math.min(...highs);

    const tested = last.high >= resistance - lastAtr * 0.5 && last.high <= resistance + lastAtr * 0.5;
    const bearishClose = last.close < last.open && last.close < prev.low;
    if (!tested || !bearishClose) return null;

    const entryPrice = last.close;
    const stopLoss = resistance + lastAtr * 0.5;
    const risk = stopLoss - entryPrice;
    if (risk <= 0) return null;
    const rawTarget2 = entryPrice - risk * this.riskReward;
    const targetPrice = Math.min(rawTarget2, entryPrice * 0.95); // minimo 5%
    return {
      symbol,
      timeframe,
      strategy: 'SmartMoney',
      direction: 'SELL',
      entryPrice,
      stopLoss,
      targetPrice,
      confidence: 0.7,
      reason: 'Estructura bajista (LH+LL), rechazo de resistencia y cierre fuerte bajo mínima previa',
      meta: { bias, resistance, atr: lastAtr, sma200: lastSma },
    };
  }

  private detectBias(swings: ReturnType<typeof findSwings>): Bias {
    const highs = swings.filter((s) => s.type === 'high').slice(-3).map((s) => s.price);
    const lows = swings.filter((s) => s.type === 'low').slice(-3).map((s) => s.price);
    if (highs.length < 2 || lows.length < 2) return 'NEUTRAL';

    const hh = highs[highs.length - 1] > highs[highs.length - 2];
    const hl = lows[lows.length - 1] > lows[lows.length - 2];
    const lh = highs[highs.length - 1] < highs[highs.length - 2];
    const ll = lows[lows.length - 1] < lows[lows.length - 2];

    if (hh && hl) return 'BULLISH';
    if (lh && ll) return 'BEARISH';
    return 'NEUTRAL';
  }
}
