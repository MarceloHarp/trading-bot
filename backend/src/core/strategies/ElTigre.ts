import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';
import { ema, atr, rsi } from '../indicators';

/**
 * "El Tigre" — Swing Pullback en 1D
 * -----------------------------------
 * Busca movimientos grandes (8-20% en precio) tomando el rebote de precio
 * cuando retrocede a la EMA20 o EMA50 en una tendencia establecida.
 *
 * Lógica:
 *  1. Tendencia: EMA20 > EMA50 (uptrend confirmado)
 *  2. Pullback: precio toca o entra brevemente en la zona de EMA20 (±0.5%)
 *              o EMA50 (si EMA20 ya fue superada)
 *  3. Confirmación: vela cierra POR ENCIMA de la EMA con cuerpo alcista
 *  4. RSI en zona de recarga (38–62): no sobrevendido extremo ni sobrecomprado
 *  5. SL: bajo el mínimo de la vela − 0.5·ATR
 *  6. TP: entry + risk × 3.0  (RR 3:1 → captura movimientos de 6-18%)
 *
 * Backtest (exp-tigre2.js P0) — ~3000 días 1D:
 *   ETH: 152t / WR37.5% / PF1.81 / avg +3.48%/trade → con 3x leverage: +$10.4/trade
 *   BNB:  157t / WR35.7% / PF1.54 / avg +2.28%/trade → con 3x leverage: +$6.8/trade
 *   AVAX:  89t / WR33.7% / PF1.40 / avg +2.38%/trade → con 3x leverage: +$7.1/trade
 *   BTC: EXCLUIDO (WR21.5%, perdedor en pullback — demasiado errático)
 *   SOL: EXCLUIDO (WR21.1%, trending muy agresivo — rompe la EMA sin rebotar)
 *
 * ⚠️  SOLO 1D: los pullbacks intraday son ruido. En 1D cada vela de confirmación
 * representa una sesión completa de presión compradora sobre la media móvil.
 */
export class ElTigreStrategy implements Strategy {
  readonly name = 'ElTigre';

  // Backtest muestra BTC y SOL como perdedores en pullback 1D
  private readonly allowedSymbols = new Set(['ETHUSDT', 'BNBUSDT', 'AVAXUSDT']);
  // BNB longs pierden sistemáticamente (6 pérdidas seguidas ene-2025). Solo shorts en BNB.
  private readonly noLongSymbols = new Set(['BNBUSDT']);

  private readonly emaPeriodFast  = 20;
  private readonly emaPeriodSlow  = 50;
  private readonly atrPeriod      = 14;
  private readonly rsiPeriod      = 14;

  // Zona de pullback: el low de la vela debe llegar a no más del 4% bajo la EMA
  private readonly emaTolerancePct = 0.005;  // 0.5% encima de la EMA = "tocando"
  private readonly emaMaxDip       = 0.04;   // la mecha puede ir hasta 4% bajo la EMA

  private readonly rsiLo  = 38;    // zona de recarga (no sobrevendido extremo)
  private readonly rsiHi  = 62;    // zona de recarga (no sobrecomprado)
  private readonly slAtr  = 0.5;   // SL = low − 0.5·ATR
  private readonly rr     = 3.0;   // RR 3:1 → captura movimientos de ~9% con 3x lev
  private readonly minRR  = 2.5;   // mínimo aceptable (si SL es muy ancho)
  private readonly minBody = 0.30; // body ≥ 30% del rango de la vela (no doji)

  evaluate(symbol: string, timeframe: string, candles: Candle[]): Signal | null {
    if (!this.allowedSymbols.has(symbol)) return null;
    if (timeframe !== '1d') return null;
    if (candles.length < this.emaPeriodSlow + this.atrPeriod * 2 + 10) return null;

    const closes = candles.map(c => c.close);
    const e20    = ema(closes, this.emaPeriodFast);
    const e50    = ema(closes, this.emaPeriodSlow);
    const atrArr = atr(candles, this.atrPeriod);
    const rsiArr = rsi(closes, this.rsiPeriod);

    const i    = candles.length - 1;
    const last = candles[i];
    const lastE20  = e20[i];
    const lastE50  = e50[i];
    const lastAtr  = atrArr[i];
    const lastRsi  = rsiArr[i];

    if ([lastE20, lastE50, lastAtr, lastRsi].some(v => Number.isNaN(v))) return null;
    if (lastAtr <= 0) return null;

    const body = Math.abs(last.close - last.open);
    const rng  = Math.max(last.high - last.low, 1e-9);

    /* ──────────── LONG: pullback a EMA en uptrend ──────────── */
    const trendUp = lastE20 > lastE50;

    // Pullback: el low tocó la zona de la EMA20
    const touchedEMA20 = last.low <= lastE20 * (1 + this.emaTolerancePct)
                      && last.low >= lastE20 * (1 - this.emaMaxDip);
    // Alternativa: pullback más profundo hasta EMA50
    const touchedEMA50 = last.low <= lastE50 * (1 + this.emaTolerancePct)
                      && last.low >= lastE50 * (1 - this.emaMaxDip);
    const touched = touchedEMA20 || touchedEMA50;

    // Confirmación: cierra sobre la EMA y es vela alcista con body real
    const emaRef     = touchedEMA50 ? lastE50 : lastE20;
    const closedAbove = last.close > emaRef;
    const bullish     = last.close > last.open;
    const hasBody     = body / rng >= this.minBody;

    // BNB longs pierden sistemáticamente — bloqueados
    const longAllowed = !this.noLongSymbols.has(symbol);

    if (longAllowed && trendUp && touched && closedAbove && bullish && hasBody
        && lastRsi >= this.rsiLo && lastRsi <= this.rsiHi) {
      const entryPrice = last.close;
      const stopLoss   = last.low - lastAtr * this.slAtr;
      const risk       = entryPrice - stopLoss;
      if (risk <= 0) return null;
      const targetPrice = entryPrice + risk * this.rr;
      const rr = (targetPrice - entryPrice) / risk;
      if (rr < this.minRR) return null;

      const emaLabel = touchedEMA50 ? `EMA50(${lastE50.toFixed(2)})` : `EMA20(${lastE20.toFixed(2)})`;
      return {
        symbol, timeframe,
        strategy: 'ElTigre',
        direction: 'BUY',
        entryPrice, stopLoss, targetPrice,
        confidence: 0.72,
        reason: `Pullback a ${emaLabel} rebotado (RSI:${lastRsi.toFixed(0)}) → TP RR3 ${targetPrice.toFixed(2)}`,
        meta: {
          ema20: lastE20, ema50: lastE50,
          atr: lastAtr, rsi: lastRsi,
          rr: Math.round(rr * 100) / 100,
          touchedEMA: touchedEMA50 ? 'EMA50' : 'EMA20',
        },
      };
    }

    /* ──────────── SHORT: pullback a EMA en downtrend ──────────── */
    const trendDn = lastE20 < lastE50;

    const touchedEMA20d = last.high >= lastE20 * (1 - this.emaTolerancePct)
                        && last.high <= lastE20 * (1 + this.emaMaxDip);
    const touchedEMA50d = last.high >= lastE50 * (1 - this.emaTolerancePct)
                        && last.high <= lastE50 * (1 + this.emaMaxDip);
    const touchedD = touchedEMA20d || touchedEMA50d;

    const emaRefD     = touchedEMA50d ? lastE50 : lastE20;
    const closedBelow = last.close < emaRefD;
    const bearish     = last.close < last.open;

    if (trendDn && touchedD && closedBelow && bearish && hasBody
        && lastRsi >= (100 - this.rsiHi) && lastRsi <= (100 - this.rsiLo)) {
      const entryPrice  = last.close;
      const stopLoss    = last.high + lastAtr * this.slAtr;
      const risk        = stopLoss - entryPrice;
      if (risk <= 0) return null;
      const targetPrice = entryPrice - risk * this.rr;
      const rr = (entryPrice - targetPrice) / risk;
      if (rr < this.minRR) return null;

      const emaLabel = touchedEMA50d ? `EMA50(${lastE50.toFixed(2)})` : `EMA20(${lastE20.toFixed(2)})`;
      return {
        symbol, timeframe,
        strategy: 'ElTigre',
        direction: 'SELL',
        entryPrice, stopLoss, targetPrice,
        confidence: 0.72,
        reason: `Rechazo en ${emaLabel} en downtrend (RSI:${lastRsi.toFixed(0)}) → TP RR3 ${targetPrice.toFixed(2)}`,
        meta: {
          ema20: lastE20, ema50: lastE50,
          atr: lastAtr, rsi: lastRsi,
          rr: Math.round(rr * 100) / 100,
          touchedEMA: touchedEMA50d ? 'EMA50' : 'EMA20',
        },
      };
    }

    return null;
  }
}
