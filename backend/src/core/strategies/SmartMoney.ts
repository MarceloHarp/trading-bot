import type { Strategy } from './Strategy';
import type { Bias, Candle, Signal } from '../../types';
import { atr, findSwings, rsi, sma } from '../indicators';

export class SmartMoneyStrategy implements Strategy {
  readonly name = 'SmartMoney';

  private readonly swingLookback = 5;
  private readonly trendMA = 200;
  private readonly atrPeriod = 14;
  private readonly riskReward = 4; // 3→4: a 27% WR el EV sube de +0.1 a +0.38 por unidad de riesgo

  evaluate(symbol: string, timeframe: string, candles: Candle[], htfCandles?: Candle[]): Signal | null {
    if (candles.length < this.trendMA + 10) return null;

    const swings = findSwings(candles, this.swingLookback);
    const bias = this.detectBias(swings);
    if (bias === 'NEUTRAL') return null;

    // Multi-timeframe filter: el sesgo del HTF (4h) debe alinearse con el sesgo local
    if (htfCandles && htfCandles.length >= this.trendMA + 10) {
      const htfSwings = findSwings(htfCandles, this.swingLookback);
      const htfBias = this.detectBias(htfSwings);
      if (htfBias !== 'NEUTRAL' && htfBias !== bias) return null;
    }

    // Filtro de tendencia con SMA200
    const closes = candles.map((c) => c.close);
    const sma200 = sma(closes, this.trendMA);
    const lastSma = sma200[sma200.length - 1];
    const lastClose = closes[closes.length - 1];
    if (Number.isNaN(lastSma)) return null;
    if (bias === 'BULLISH' && lastClose < lastSma) return null;
    if (bias === 'BEARISH' && lastClose > lastSma) return null;

    // Filtro RSI: no entrar en zonas de agotamiento extremo
    const rsiArr = rsi(closes, 14);
    const lastRsi = rsiArr[rsiArr.length - 1];
    if (Number.isNaN(lastRsi)) return null;
    if (bias === 'BULLISH' && lastRsi > 70) return null; // sobrecomprado — movimiento agotado
    if (bias === 'BEARISH' && lastRsi < 30) return null; // sobrevendido — movimiento agotado

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const atrArr = atr(candles, this.atrPeriod);
    const lastAtr = atrArr[atrArr.length - 1];
    if (Number.isNaN(lastAtr) || lastAtr === 0) return null;

    // Volumen: la vela de señal no puede ser de las más débiles del mercado
    const volumes = candles.map((c) => c.volume);
    const avgVol = sma(volumes, 20);
    const lastAvgVol = avgVol[avgVol.length - 1];
    if (!Number.isNaN(lastAvgVol) && last.volume < lastAvgVol * 0.5) return null;

    if (bias === 'BULLISH') {
      // último swing low como soporte
      const lows = swings
        .filter((s) => s.type === 'low')
        .slice(-3)
        .map((s) => s.price);
      if (lows.length === 0) return null;
      const support = Math.max(...lows);

      // Tolerancia más ajustada: ±0.3 ATR en vez de ±0.5
      // Probar contra cualquiera de los últimos 3 swing lows (no solo el más reciente)
      const tested = lows.some(lvl => last.low <= lvl + lastAtr * 0.5 && last.low >= lvl - lastAtr * 0.5);
      const candleRange = last.high - last.low;
      const bullishClose = last.close > last.open &&
        (candleRange > 0 ? (last.close - last.open) / candleRange : 0) > 0.35;
      if (!tested || !bullishClose) return null;

      const entryPrice = last.close;
      const stopLoss = support - lastAtr * 0.5;
      const risk = entryPrice - stopLoss;
      if (risk <= 0) return null;
      // Sin piso mínimo de 5% — el target era el bug principal: forzaba R:R de 8-10:1 con SL ajustados
      const targetPrice = entryPrice + risk * this.riskReward;
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
        meta: { bias, support, atr: lastAtr, sma200: lastSma, htfConfirmed: !!htfCandles },
      };
    }

    // BEARISH
    const highs = swings
      .filter((s) => s.type === 'high')
      .slice(-3)
      .map((s) => s.price);
    if (highs.length === 0) return null;
    const resistance = Math.min(...highs);

    const tested = highs.some(lvl => last.high >= lvl - lastAtr * 0.5 && last.high <= lvl + lastAtr * 0.5);
    const candleRangeB = last.high - last.low;
    const bearishClose = last.close < last.open &&
      (candleRangeB > 0 ? (last.open - last.close) / candleRangeB : 0) > 0.35;
    if (!tested || !bearishClose) return null;

    const entryPrice = last.close;
    const stopLoss = resistance + lastAtr * 0.5;
    const risk = stopLoss - entryPrice;
    if (risk <= 0) return null;
    const targetPrice = entryPrice - risk * this.riskReward;
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
      meta: { bias, resistance, atr: lastAtr, sma200: lastSma, htfConfirmed: !!htfCandles },
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
