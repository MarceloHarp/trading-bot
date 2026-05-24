import { Router } from 'express';
import type { Candle } from '../types';

function sma(values: number[], period: number): number[] {
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

function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let s = 0;
  for (let i = 0; i < period; i++) s += values[i];
  out[period - 1] = s / period;
  for (let i = period; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}

function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: number[] = new Array(values.length).fill(NaN);
  const lower: number[] = new Array(values.length).fill(NaN);
  for (let i = period - 1; i < values.length; i++) {
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - mid[i]) ** 2;
    const std = Math.sqrt(sq / period);
    upper[i] = mid[i] + mult * std;
    lower[i] = mid[i] - mult * std;
  }
  return { mid, upper, lower };
}

function vwapCalc(candles: Candle[], window = 50): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  for (let i = window - 1; i < candles.length; i++) {
    let pv = 0, v = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
      pv += tp * candles[j].volume;
      v += candles[j].volume;
    }
    out[i] = v === 0 ? NaN : pv / v;
  }
  return out;
}

function findSwings(candles: Candle[], lookback = 5) {
  const highs: { time: number; price: number }[] = [];
  const lows: { time: number; price: number }[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isH = true, isL = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isH = false;
      if (candles[j].low <= candles[i].low) isL = false;
    }
    if (isH) highs.push({ time: candles[i].openTime / 1000, price: candles[i].high });
    if (isL) lows.push({ time: candles[i].openTime / 1000, price: candles[i].low });
  }
  return { highs, lows };
}

// Detectar zonas de liquidez: niveles donde el precio toco multiples veces
function liquidityZones(candles: Candle[], tolerance = 0.002) {
  const levels: { price: number; touches: number; type: 'resistance' | 'support' }[] = [];
  
  // Tomar swing highs y lows
  const swings = findSwings(candles, 5);
  
  // Agrupar niveles cercanos
  const allHighs = swings.highs.map(s => s.price);
  const allLows = swings.lows.map(s => s.price);
  
  // Para cada high, contar cuantos otros estan cerca (dentro del tolerance)
  const processedH = new Set<number>();
  for (let i = 0; i < allHighs.length; i++) {
    if (processedH.has(i)) continue;
    const price = allHighs[i];
    let touches = 1;
    for (let j = i + 1; j < allHighs.length; j++) {
      if (Math.abs(allHighs[j] - price) / price < tolerance) {
        touches++;
        processedH.add(j);
      }
    }
    if (touches >= 2) levels.push({ price, touches, type: 'resistance' });
  }
  
  const processedL = new Set<number>();
  for (let i = 0; i < allLows.length; i++) {
    if (processedL.has(i)) continue;
    const price = allLows[i];
    let touches = 1;
    for (let j = i + 1; j < allLows.length; j++) {
      if (Math.abs(allLows[j] - price) / price < tolerance) {
        touches++;
        processedL.add(j);
      }
    }
    if (touches >= 2) levels.push({ price, touches, type: 'support' });
  }
  
  // Ordenar por relevancia (mas touches = mas liquidez)
  return levels.sort((a, b) => b.touches - a.touches).slice(0, 10);
}

export function buildIndicatorsRouter(getCandles: (symbol: string, interval: string, limit: number) => Promise<Candle[]>): Router {
  const router = Router();

  router.get('/indicators', async (req, res) => {
    const symbol = String(req.query.symbol ?? 'BTCUSDT');
    const interval = String(req.query.interval ?? '1h');
    const limit = Math.min(500, Number(req.query.limit ?? 300));

    try {
      // Intentar con Binance real para mas historia; fallback a testnet
      let candles;
      try {
        const axiosLib = require('axios');
        const { data } = await axiosLib.get('https://api.binance.com/api/v3/klines', {
          params: { symbol, interval, limit },
          timeout: 8000,
        });
        candles = (data as unknown[]).map((row: unknown) => {
          const r = row as (number | string)[];
          return { symbol, timeframe: interval, openTime: Number(r[0]), open: parseFloat(r[1] as string), high: parseFloat(r[2] as string), low: parseFloat(r[3] as string), close: parseFloat(r[4] as string), volume: parseFloat(r[5] as string), closeTime: Number(r[6]) };
        });
      } catch {
        candles = await getCandles(symbol, interval, limit);
      }
      if (candles.length < 50) return res.status(400).json({ error: 'Not enough candles' });

      const closes = candles.map(c => c.close);
      const times = candles.map(c => c.openTime / 1000);

      const ema20arr = ema(closes, 20);
      const sma200arr = sma(closes, 200);
      const ma50arr  = sma(closes, 50);
      const ma100arr = sma(closes, 100);
      const ma150arr = sma(closes, 150);
      const toMA = (arr: number[]) => arr.map((v,i) => ({time:times[i],value:v})).filter(p=>!isNaN(p.value));

      const bb = bollinger(closes, 20, 2);
      const vwapArr = vwapCalc(candles, 50);
      const swings = findSwings(candles, 5);
      const zones = liquidityZones(candles, 0.003);

      // Serializar como arrays de {time, value}
      const toSeries = (arr: number[]) =>
        arr.map((v, i) => ({ time: times[i], value: v })).filter(p => !isNaN(p.value));

      res.json({
        ema20: toSeries(ema20arr),
        sma200: toSeries(sma200arr),
        bbUpper: toSeries(bb.upper),
        bbMid: toSeries(bb.mid),
        bbLower: toSeries(bb.lower),
        vwap: toSeries(vwapArr),
        ma50: toMA(ma50arr),
        ma100: toMA(ma100arr),
        ma150: toMA(ma150arr),
        swingHighs: swings.highs.slice(-20),
        swingLows: swings.lows.slice(-20),
        liquidityZones: zones,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
