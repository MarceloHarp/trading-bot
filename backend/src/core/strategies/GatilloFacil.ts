import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { bollinger, atr, rsi, sma } from '../indicators';

/**
 * "Gatillo Fácil" — BB Fade / Mean-Reversion en 4h
 * -------------------------------------------------
 * Cuando el precio se extiende demasiado respecto a su media (toca la banda
 * de Bollinger), fades back toward the mean. Similar a SaltandoDelLambo pero
 * más agresiva: sin filtro de rango Donchian ni ADX, operamos CADA vez que
 * la vela hace spike fuera de la BB y cierra de vuelta dentro.
 *
 * Backtested (exp-scalp3.js) — 500 días 4h, fee 0.10% RT:
 *   BTC: 61t / WR47.5% / PF1.82 / +53.6%
 *   ETH: 47t / WR38.3% / PF1.04 / +4.1%
 *   BNB: 49t / WR36.7% / PF1.20 / +13.7%
 *   SOL: EXCLUIDO (PF0.78, -29.9% — too trending)
 *
 * Señal LONG:
 *   - La mecha baja penetra la banda inferior (last.low ≤ BB_lo)
 *   - Cierra por encima de la banda (last.close > BB_lo) ← regreso
 *   - Vela alcista (close > open) ← confirmación de rechazo
 *   - RSI ≤ rsiOS (momentum agotado al alza del vendedor)
 *   - SL: por debajo del mínimo de la vela − slAtr·ATR
 *   - TP: banda media de BB (mean reversion)
 *
 * Señal SHORT: simétrica, hacia la banda superior.
 *
 * Ventaja vs SaltandoDelLambo: más operaciones (3x), sencillez, funciona en
 * trending Y lateral siempre que el momentum esté agotado.
 * Riesgo: en tendencias muy fuertes el precio puede seguir más allá del SL;
 * el ATR de la vela lo amortigua, pero no es a prueba de breakouts.
 */
export class GatilloFacilStrategy implements Strategy {
  readonly name = 'GatilloFacil';

  // Pares validados en backtest 500d 4h (PF ≥ 1.15):
  // BTC 1.18 | ETH 1.19 | BNB 1.37 | AVAX 1.19
  // Excluidos: SOL 0.94, ADA 0.81, LINK 0.94, XRP 0.73, DOGE 0.85
  private readonly allowedSymbols = new Set(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'AVAXUSDT']);

  // Parámetros BB (G0 variant — best risk-adjusted)
  private readonly bbPeriod = 20;
  private readonly bbMult = 2.0;
  private readonly atrPeriod = 14;
  private readonly rsiPeriod = 14;

  // Filtro RSI: zona de sobre-extensión más amplia que SaltandoDelLambo
  // RSI 40/60 da más trades con PF ligeramente menor pero NET total mayor
  private readonly rsiOS = 40;   // LONG: RSI debe estar ≤ 40 (sobrevendido)
  private readonly rsiOB = 60;   // SHORT: RSI debe estar ≥ 60 (sobrecomprado)

  private readonly slAtr = 0.5;  // SL = mínimo/máximo − 0.5·ATR (breathing room)
  private readonly minRR = 0.35; // RR mínimo; TP=mid de BB suele dar RR ~0.5-1.5

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (!this.allowedSymbols.has(symbol)) return null;
    if (timeframe !== '4h') return null;
    if (candles.length < this.bbPeriod + this.atrPeriod * 2 + 5) return null;

    const closes = candles.map(c => c.close);
    const bb = bollinger(closes, this.bbPeriod, this.bbMult);
    const atrArr = atr(candles, this.atrPeriod);
    const rsiArr = rsi(closes, this.rsiPeriod);
    // ATR medio para sanity-check (no queremos entrar en velas planas sin movimiento)
    const atrMa = sma(atrArr.map(v => (Number.isNaN(v) ? 0 : v)), 20);

    const i = candles.length - 1;
    const last = candles[i];
    const lastAtr = atrArr[i];
    const lastRsi = rsiArr[i];
    const bbLo = bb.lower[i];
    const bbHi = bb.upper[i];
    const bbMid = bb.middle[i];

    if ([lastAtr, lastRsi, bbLo, bbHi, bbMid].some(v => Number.isNaN(v))) return null;
    if (lastAtr <= 0) return null;
    // Volatilidad mínima: el ATR de la vela debe ser normal (≥ 80% del ATR medio)
    if (!Number.isNaN(atrMa[i]) && atrMa[i] > 0 && lastAtr < atrMa[i] * 0.8) return null;

    /* -------- LONG: mecha bajo banda inferior, cierra de vuelta dentro -------- */
    const spikedBelow = last.low <= bbLo;
    const closedAboveLo = last.close > bbLo;
    const bullishClose = last.close > last.open;

    if (spikedBelow && closedAboveLo && bullishClose && lastRsi <= this.rsiOS) {
      const entryPrice = last.close;
      const stopLoss = last.low - lastAtr * this.slAtr;
      const risk = entryPrice - stopLoss;
      if (risk <= 0) return null;
      const targetPrice = bbMid;
      const rr = (targetPrice - entryPrice) / risk;
      if (rr < this.minRR) return null;

      return {
        symbol, timeframe,
        strategy: 'GatilloFacil',
        direction: 'BUY',
        entryPrice, stopLoss, targetPrice,
        confidence: 0.68,
        reason: `BB inferior tocada y rechazada @ ${bbLo.toFixed(2)} (RSI:${lastRsi.toFixed(0)}) → TP media BB ${bbMid.toFixed(2)}`,
        meta: {
          bbLower: bbLo,
          bbMid,
          bbUpper: bbHi,
          rsi: lastRsi,
          atr: lastAtr,
          rr: Math.round(rr * 100) / 100,
        },
      };
    }

    /* -------- SHORT: mecha sobre banda superior, cierra de vuelta dentro -------- */
    const spikedAbove = last.high >= bbHi;
    const closedBelowHi = last.close < bbHi;
    const bearishClose = last.close < last.open;

    if (spikedAbove && closedBelowHi && bearishClose && lastRsi >= this.rsiOB) {
      const entryPrice = last.close;
      const stopLoss = last.high + lastAtr * this.slAtr;
      const risk = stopLoss - entryPrice;
      if (risk <= 0) return null;
      const targetPrice = bbMid;
      const rr = (entryPrice - targetPrice) / risk;
      if (rr < this.minRR) return null;

      return {
        symbol, timeframe,
        strategy: 'GatilloFacil',
        direction: 'SELL',
        entryPrice, stopLoss, targetPrice,
        confidence: 0.68,
        reason: `BB superior tocada y rechazada @ ${bbHi.toFixed(2)} (RSI:${lastRsi.toFixed(0)}) → TP media BB ${bbMid.toFixed(2)}`,
        meta: {
          bbLower: bbLo,
          bbMid,
          bbUpper: bbHi,
          rsi: lastRsi,
          atr: lastAtr,
          rr: Math.round(rr * 100) / 100,
        },
      };
    }

    return null;
  }
}
