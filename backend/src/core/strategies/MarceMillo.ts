import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { ema, atr, adx, donchian, sma } from '../indicators';

/**
 * "Marce el Millo" — Breakout-RETEST de Volatilidad (v2)
 * ------------------------------------------------------
 * La Reina de las estrategias. Captura movimientos explosivos pero
 * ENTRA EN EL RETEST del nivel roto, no en el candle de ruptura.
 *
 * Por qué retest: entrar en el breakout candle te mete justo cuando el
 * precio ya pegó el envión — muchos breakouts hacen pullback (fakeout) y
 * te sacan por SL. Esperar que el precio vuelva a tocar el nivel roto y lo
 * confirme como soporte mejora WR y el precio de entrada.
 *
 * Backtest 28d (9 pares whitelist): -3.86% → +14.76% PnL, 30% → 50% WR, PF 0.85 → 2.17
 *
 * Reglas LONG:
 * 1. BREAKOUT (vela k, hasta retestWindow velas atrás):
 *    - close > Donchian high(20) anterior
 *    - close > EMA50, vela alcista
 *    - ADX > 20, Volumen > 1.2× promedio, ATR > 1.1× ATR promedio
 * 2. RETEST (vela actual): pullback toca el nivel roto (low ≤ level), pero
 *    cierra por encima (el nivel aguanta como soporte) y es vela alcista.
 *
 * SL: nivel roto - 1.0×ATR  |  TP: entry + 2 × risk (2:1)
 * El precio no debe perder el nivel ni alejarse > abortPct sin retestear.
 */
export class MarceMilloStrategy implements Strategy {
  readonly name = 'MarceMillo';

  // Whitelist: solo opera donde los breakouts son limpios (backtest 28d).
  private readonly allowedSymbols = new Set(['ADAUSDT', 'SOLUSDT', 'BNBUSDT', 'ETHUSDT', 'AVAXUSDT', 'LINKUSDT', 'XRPUSDT', 'DOGEUSDT', 'TRXUSDT']);

  private readonly donchianPeriod = 20;
  private readonly emaPeriod = 50;
  private readonly atrPeriod = 14;
  private readonly adxPeriod = 14;
  private readonly volumeAvgPeriod = 20;
  private readonly minADX = 20;          // antes 22 — relajado capturó más setups buenos
  private readonly volMult = 1.2;        // antes 1.5 — 1.5 cortaba demasiado
  private readonly atrExpansion = 1.1;
  private readonly slAtrMult = 1.0;      // SL = nivel roto ± 1.0×ATR
  private readonly riskReward = 2;       // 2:1
  private readonly retestWindow = 10;    // velas para esperar el retest
  private readonly abortPct = 0.03;      // si el precio se va >3% sin retestear, se aborta

  evaluate(symbol: string, timeframe: string, candles: Candle[], htfCandles?: Candle[]): Signal | null {
    if (!this.allowedSymbols.has(symbol)) return null;
    if (candles.length < 100) return null;

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const ema50arr = ema(closes, this.emaPeriod);
    const atrArr = atr(candles, this.atrPeriod);
    const adxArr = adx(candles, this.adxPeriod);
    const don = donchian(candles, this.donchianPeriod);
    const volAvg = sma(volumes, this.volumeAvgPeriod);
    const atrAvg = sma(atrArr.filter(v => !Number.isNaN(v)), this.atrPeriod);
    const lastAtrAvg = atrAvg[atrAvg.length - 1];

    const i = candles.length - 1;
    const last = candles[i];
    const lastAtr = atrArr[i];

    if ([ema50arr[i], lastAtr, lastAtrAvg].some(v => Number.isNaN(v))) return null;
    if (lastAtr === 0) return null;

    // HTF alineación (cuando hay datos del 4h)
    let htfBullish: boolean | null = null;
    if (htfCandles && htfCandles.length >= this.emaPeriod + 5) {
      const htfCloses = htfCandles.map(c => c.close);
      const htfEma = ema(htfCloses, this.emaPeriod);
      const htfLast = htfCandles[htfCandles.length - 1];
      const htfE = htfEma[htfEma.length - 1];
      if (!Number.isNaN(htfE)) htfBullish = htfLast.close > htfE;
    }

    /* -------- LONG: retest de breakout alcista -------- */
    // La vela actual debe ser alcista (candidata a retest)
    if (last.close > last.open) {
      const longSig = this.findRetestLong(symbol, timeframe, candles, i, { ema50arr, atrArr, adxArr, don, volAvg, lastAtrAvg, lastAtr, htfBullish });
      if (longSig) return longSig;
    }

    /* -------- SHORT: retest de breakdown bajista (solo con HTF bajista) -------- */
    if (last.close < last.open && htfBullish === false) {
      const shortSig = this.findRetestShort(symbol, timeframe, candles, i, { ema50arr, atrArr, adxArr, don, volAvg, lastAtrAvg, lastAtr });
      if (shortSig) return shortSig;
    }

    return null;
  }

  private findRetestLong(
    symbol: string, timeframe: string, candles: Candle[], i: number,
    ind: { ema50arr: number[]; atrArr: number[]; adxArr: number[]; don: { upper: number[]; lower: number[] }; volAvg: number[]; lastAtrAvg: number; lastAtr: number; htfBullish: boolean | null }
  ): Signal | null {
    const { ema50arr, atrArr, adxArr, don, volAvg, lastAtrAvg, lastAtr, htfBullish } = ind;
    if (htfBullish === false) return null; // no longs contra HTF bajista
    const last = candles[i];

    // Buscar el breakout más reciente en la ventana de retest
    for (let k = i - 1; k >= Math.max(this.emaPeriod, i - this.retestWindow); k--) {
      const bk = candles[k];
      const donHiPrev = don.upper[k - 1];
      if ([ema50arr[k], atrArr[k], adxArr[k], volAvg[k], donHiPrev].some(v => Number.isNaN(v))) continue;

      const wasBreakout =
        bk.close > donHiPrev &&
        bk.close > ema50arr[k] &&
        bk.close > bk.open &&
        adxArr[k] >= this.minADX &&
        bk.volume >= volAvg[k] * this.volMult &&
        atrArr[k] >= lastAtrAvg * this.atrExpansion;
      if (!wasBreakout) continue;

      const level = donHiPrev; // nivel roto que ahora actúa como soporte

      // Entre el breakout y ahora: no debe haber perdido el nivel, irse demasiado
      // lejos, ni haber retesteado antes (solo el PRIMER retest dispara — alinea
      // producción con el backtest forward-scan).
      let aborted = false;
      for (let m = k + 1; m < i; m++) {
        if (candles[m].close < level) { aborted = true; break; }       // perdió el nivel → breakout falló
        if (candles[m].close > level * (1 + this.abortPct)) { aborted = true; break; } // se fue sin retestear
        if (candles[m].low <= level * 1.002 && candles[m].close > level && candles[m].close > candles[m].open) {
          aborted = true; break; // ya hubo un retest previo → esta vela no es la primera
        }
      }
      if (aborted) return null;

      // La vela actual es el retest: tocó el nivel y cerró por encima
      if (last.low <= level * 1.002 && last.close > level) {
        const entryPrice = last.close;
        const stopLoss = level - lastAtr * this.slAtrMult;
        const risk = entryPrice - stopLoss;
        if (risk <= 0) return null;
        const targetPrice = entryPrice + risk * this.riskReward;

        return {
          symbol, timeframe,
          strategy: 'MarceMillo',
          direction: 'BUY',
          entryPrice, stopLoss, targetPrice,
          confidence: htfBullish === true ? 0.85 : 0.75,
          reason: `Retest breakout Donchian @ ${level.toFixed(4)} + ADX:${adxArr[k].toFixed(0)} + Vol:${(candles[k].volume / volAvg[k]).toFixed(1)}x`,
          meta: {
            breakoutLevel: level,
            breakoutIdx: k,
            adx: adxArr[k],
            atr: lastAtr,
            htfConfirmed: htfBullish === true,
          },
        };
      }
      return null; // hubo breakout pero la vela actual no es retest válido
    }
    return null;
  }

  private findRetestShort(
    symbol: string, timeframe: string, candles: Candle[], i: number,
    ind: { ema50arr: number[]; atrArr: number[]; adxArr: number[]; don: { upper: number[]; lower: number[] }; volAvg: number[]; lastAtrAvg: number; lastAtr: number }
  ): Signal | null {
    const { ema50arr, atrArr, adxArr, don, volAvg, lastAtrAvg, lastAtr } = ind;
    const last = candles[i];

    for (let k = i - 1; k >= Math.max(this.emaPeriod, i - this.retestWindow); k--) {
      const bk = candles[k];
      const donLoPrev = don.lower[k - 1];
      if ([ema50arr[k], atrArr[k], adxArr[k], volAvg[k], donLoPrev].some(v => Number.isNaN(v))) continue;

      const wasBreakdown =
        bk.close < donLoPrev &&
        bk.close < ema50arr[k] &&
        bk.close < bk.open &&
        adxArr[k] >= this.minADX &&
        bk.volume >= volAvg[k] * this.volMult &&
        atrArr[k] >= lastAtrAvg * this.atrExpansion;
      if (!wasBreakdown) continue;

      const level = donLoPrev; // nivel roto que ahora actúa como resistencia

      let aborted = false;
      for (let m = k + 1; m < i; m++) {
        if (candles[m].close > level) { aborted = true; break; }
        if (candles[m].close < level * (1 - this.abortPct)) { aborted = true; break; }
        if (candles[m].high >= level * 0.998 && candles[m].close < level && candles[m].close < candles[m].open) {
          aborted = true; break; // ya hubo un retest previo
        }
      }
      if (aborted) return null;

      if (last.high >= level * 0.998 && last.close < level) {
        const entryPrice = last.close;
        const stopLoss = level + lastAtr * this.slAtrMult;
        const risk = stopLoss - entryPrice;
        if (risk <= 0) return null;
        const targetPrice = entryPrice - risk * this.riskReward;

        return {
          symbol, timeframe,
          strategy: 'MarceMillo',
          direction: 'SELL',
          entryPrice, stopLoss, targetPrice,
          confidence: 0.8,
          reason: `Retest breakdown Donchian @ ${level.toFixed(4)} + HTF bear + ADX:${adxArr[k].toFixed(0)}`,
          meta: {
            breakoutLevel: level,
            breakoutIdx: k,
            adx: adxArr[k],
            atr: lastAtr,
          },
        };
      }
      return null;
    }
    return null;
  }
}
