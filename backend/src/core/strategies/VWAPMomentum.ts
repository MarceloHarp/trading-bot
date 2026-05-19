import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { atr, closes, macd, rsi, vwap } from '../indicators';

/**
 * VWAP Momentum
 * ---------------------------------
 * - VWAP como nivel dinámico (precio justo institucional).
 * - Confirmación con RSI (no en extremo) + MACD histograma.
 * - Volumen sobre 1.2x media para validar intención.
 * - SL al 2%, TP al 3% (R:R 1:1.5 con high win rate).
 *
 * Timeframe sugerido: 1h
 */
export class VWAPMomentumStrategy implements Strategy {
  readonly name = 'VWAPMomentum';

  private readonly vwapWindow = 50;
  private readonly rsiPeriod = 14;
  private readonly volMultiplier = 1.2;
  private readonly volWindow = 20;
  private readonly stopPct = 0.025; // fallback
  private readonly atrMult = 1.5; // SL = 1.5 × ATR
  private readonly targetPct = 0.05;

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (candles.length < Math.max(this.vwapWindow, 50)) return null;

    const vwapArr = vwap(candles, this.vwapWindow);
    const lastVwap = vwapArr[vwapArr.length - 1];
    if (Number.isNaN(lastVwap)) return null;

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const closeArr = closes(candles);
    const rsiArr = rsi(closeArr, this.rsiPeriod);
    const macdRes = macd(closeArr);
    const lastRsi = rsiArr[rsiArr.length - 1];
    const lastHist = macdRes.histogram[macdRes.histogram.length - 1];
    const prevHist = macdRes.histogram[macdRes.histogram.length - 2];
    if (Number.isNaN(lastRsi) || Number.isNaN(lastHist) || Number.isNaN(prevHist)) return null;

    // Volumen vs media de últimas N
    const recentVols = candles.slice(-this.volWindow).map((c) => c.volume);
    const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
    if (last.volume < avgVol * this.volMultiplier) return null;

    // BULLISH: precio toca VWAP desde arriba y cierra por encima
    const touchedFromAbove = prev.low <= lastVwap && last.close > lastVwap;
    if (
      touchedFromAbove &&
      lastRsi < 70 &&
      lastRsi > 40 &&
      lastHist > 0 &&
      lastHist > prevHist
    ) {
      const entryPrice = last.close;
      const stopLoss = entryPrice * (1 - this.stopPct);
      const targetPrice = entryPrice * (1 + this.targetPct);
      return {
        symbol,
        timeframe,
        strategy: 'VWAPMomentum',
        direction: 'BUY',
        entryPrice,
        stopLoss,
        targetPrice,
        confidence: 0.75,
        reason: 'Rebote alcista en VWAP con MACD positivo creciente y volumen confirmante',
        meta: { vwap: lastVwap, rsi: lastRsi, macdHist: lastHist, avgVol },
      };
    }

    // BEARISH: precio toca VWAP desde abajo y cierra por debajo
    const touchedFromBelow = prev.high >= lastVwap && last.close < lastVwap;
    if (
      touchedFromBelow &&
      lastRsi > 30 &&
      lastRsi < 60 &&
      lastHist < 0 &&
      lastHist < prevHist
    ) {
      const entryPrice = last.close;
      const stopLoss = entryPrice * (1 + this.stopPct);
      const targetPrice = entryPrice * (1 - this.targetPct);
      return {
        symbol,
        timeframe,
        strategy: 'VWAPMomentum',
        direction: 'SELL',
        entryPrice,
        stopLoss,
        targetPrice,
        confidence: 0.75,
        reason: 'Rechazo bajista en VWAP con MACD negativo decreciente y volumen confirmante',
        meta: { vwap: lastVwap, rsi: lastRsi, macdHist: lastHist, avgVol },
      };
    }

    return null;
  }
}
