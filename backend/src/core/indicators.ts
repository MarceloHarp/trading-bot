import type { Candle } from '../types';

/* =========================================================
 * SMA - Simple Moving Average
 * ========================================================= */
export function sma(values: number[], period: number): number[] {
  if (period <= 0) throw new Error('period must be > 0');
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}

/* =========================================================
 * EMA - Exponential Moving Average
 * ========================================================= */
export function ema(values: number[], period: number): number[] {
  if (period <= 0) throw new Error('period must be > 0');
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  // semilla con SMA del primer bloque
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/* =========================================================
 * RSI - Wilder's RSI (14 default)
 * ========================================================= */
export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period + 1) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/* =========================================================
 * MACD - 12/26/9 default
 * ========================================================= */
export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MACDResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    Number.isNaN(emaFast[i]) || Number.isNaN(emaSlow[i])
      ? NaN
      : emaFast[i] - emaSlow[i]
  );
  // Para la signal, calculamos EMA sobre macdLine ignorando los NaN iniciales
  const firstValid = macdLine.findIndex((v) => !Number.isNaN(v));
  const signal: number[] = new Array(values.length).fill(NaN);

  if (firstValid !== -1 && firstValid + signalPeriod <= values.length) {
    const slice = macdLine.slice(firstValid);
    const sigSlice = ema(slice, signalPeriod);
    for (let i = 0; i < sigSlice.length; i++) {
      signal[firstValid + i] = sigSlice[i];
    }
  }
  const histogram = macdLine.map((m, i) =>
    Number.isNaN(m) || Number.isNaN(signal[i]) ? NaN : m - signal[i]
  );
  return { macd: macdLine, signal, histogram };
}

/* =========================================================
 * Bollinger Bands (20, 2 default)
 * ========================================================= */
export interface BollingerResult {
  middle: number[];
  upper: number[];
  lower: number[];
}

export function bollinger(
  values: number[],
  period = 20,
  stdMult = 2
): BollingerResult {
  const middle = sma(values, period);
  const upper: number[] = new Array(values.length).fill(NaN);
  const lower: number[] = new Array(values.length).fill(NaN);

  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (values[j] - middle[i]) ** 2;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdMult * std;
    lower[i] = middle[i] - stdMult * std;
  }
  return { middle, upper, lower };
}

/* =========================================================
 * VWAP - Volume Weighted Average Price (sliding window)
 * ========================================================= */
export function vwap(candles: Candle[], window?: number): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length === 0) return out;

  if (!window) {
    // VWAP acumulado
    let pv = 0;
    let v = 0;
    for (let i = 0; i < candles.length; i++) {
      const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
      pv += tp * candles[i].volume;
      v += candles[i].volume;
      out[i] = v === 0 ? NaN : pv / v;
    }
    return out;
  }

  // VWAP con ventana móvil
  for (let i = window - 1; i < candles.length; i++) {
    let pv = 0;
    let v = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
      pv += tp * candles[j].volume;
      v += candles[j].volume;
    }
    out[i] = v === 0 ? NaN : pv / v;
  }
  return out;
}

/* =========================================================
 * ATR - Average True Range (14 default)
 * ========================================================= */
export function atr(candles: Candle[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
    } else {
      const prevClose = candles[i - 1].close;
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prevClose),
        Math.abs(candles[i].low - prevClose)
      );
      trs.push(tr);
    }
  }
  // RMA / Wilder smoothing
  const out: number[] = new Array(candles.length).fill(NaN);
  if (trs.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += trs[i];
  out[period - 1] = sum / period;

  for (let i = period; i < trs.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + trs[i]) / period;
  }
  return out;
}

/* =========================================================
 * Swing High / Swing Low detection
 * ========================================================= */
export interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

export function findSwings(
  candles: Candle[],
  lookback = 5
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: candles[i].high, type: 'high' });
    if (isLow) swings.push({ index: i, price: candles[i].low, type: 'low' });
  }
  return swings;
}

/* =========================================================
 * Donchian Channels — máximo/mínimo de los últimos N períodos
 * Útil para detectar breakouts del rango de consolidación.
 * ========================================================= */
export interface DonchianResult {
  upper: number[];
  lower: number[];
  middle: number[];
}

export function donchian(candles: Candle[], period = 20): DonchianResult {
  const upper: number[] = new Array(candles.length).fill(NaN);
  const lower: number[] = new Array(candles.length).fill(NaN);
  const middle: number[] = new Array(candles.length).fill(NaN);

  for (let i = period - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > hi) hi = candles[j].high;
      if (candles[j].low < lo) lo = candles[j].low;
    }
    upper[i] = hi;
    lower[i] = lo;
    middle[i] = (hi + lo) / 2;
  }
  return { upper, lower, middle };
}

/* =========================================================
 * ADX — Average Directional Index (Wilder)
 * Mide la FUERZA de la tendencia (no su dirección).
 * ADX > 20-25 = mercado trending, ADX < 20 = ranging/choppy.
 * ========================================================= */
export function adx(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period * 2) return out;

  const tr: number[] = new Array(candles.length).fill(0);
  const plusDM: number[] = new Array(candles.length).fill(0);
  const minusDM: number[] = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
  }

  // Smoothed con Wilder
  let sumTR = 0, sumPlus = 0, sumMinus = 0;
  for (let i = 1; i <= period; i++) {
    sumTR += tr[i]; sumPlus += plusDM[i]; sumMinus += minusDM[i];
  }
  let smTR = sumTR, smPlus = sumPlus, smMinus = sumMinus;

  const dx: number[] = new Array(candles.length).fill(NaN);
  for (let i = period + 1; i < candles.length; i++) {
    smTR = smTR - smTR / period + tr[i];
    smPlus = smPlus - smPlus / period + plusDM[i];
    smMinus = smMinus - smMinus / period + minusDM[i];
    const plusDI = smTR === 0 ? 0 : (smPlus / smTR) * 100;
    const minusDI = smTR === 0 ? 0 : (smMinus / smTR) * 100;
    const denom = plusDI + minusDI;
    dx[i] = denom === 0 ? 0 : (Math.abs(plusDI - minusDI) / denom) * 100;
  }

  // ADX = smoothed DX
  const startIdx = period * 2;
  if (startIdx >= candles.length) return out;
  let adxSum = 0;
  for (let i = period + 1; i <= startIdx; i++) adxSum += dx[i];
  out[startIdx] = adxSum / period;
  for (let i = startIdx + 1; i < candles.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + dx[i]) / period;
  }
  return out;
}

/* =========================================================
 * Helpers
 * ========================================================= */
export function lastNonNaN(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!Number.isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}
