const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

// ============================================================
// routes/backtest.ts — motor de backtesting
// ============================================================
const backtestRoute = `import { Router } from 'express';
import axios from 'axios';
import type { Candle } from '../types';
import { sma, ema, atr, findSwings } from '../core/indicators';

const router = Router();

// Descargar hasta N velas encadenando requests de 1000
async function fetchCandles(symbol: string, interval: string, startTime: number, endTime: number): Promise<Candle[]> {
  const all: Candle[] = [];
  let from = startTime;
  while (from < endTime) {
    const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval, startTime: from, endTime, limit: 1000 },
      timeout: 15000,
    });
    if (!data || data.length === 0) break;
    const batch: Candle[] = (data as unknown[]).map((row) => {
      const r = row as (number | string)[];
      return {
        symbol, timeframe: interval,
        openTime: Number(r[0]), open: parseFloat(r[1] as string),
        high: parseFloat(r[2] as string), low: parseFloat(r[3] as string),
        close: parseFloat(r[4] as string), volume: parseFloat(r[5] as string),
        closeTime: Number(r[6]),
      };
    });
    all.push(...batch);
    from = batch[batch.length - 1].closeTime + 1;
    if (batch.length < 1000) break;
  }
  return all;
}

// ---- Indicadores inline para el backtest ----
function bollingerBands(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (closes[j] - mid[i]) ** 2;
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
      pv += tp * candles[j].volume; v += candles[j].volume;
    }
    out[i] = v === 0 ? NaN : pv / v;
  }
  return out;
}

function rsi(closes: number[], period = 14): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return out;
}

// ---- Simulador de trades ----
interface BacktestTrade {
  entryIdx: number;
  entryTime: number;
  entryPrice: number;
  direction: 'BUY' | 'SELL';
  stopLoss: number;
  targetPrice: number;
  exitIdx: number | null;
  exitTime: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  result: 'win' | 'loss' | 'open';
  strategy: string;
}

function simulateTrades(
  candles: Candle[],
  signals: { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[],
  riskPct: number
): BacktestTrade[] {
  const trades: BacktestTrade[] = [];

  for (const sig of signals) {
    const trade: BacktestTrade = {
      entryIdx: sig.idx,
      entryTime: candles[sig.idx].openTime,
      entryPrice: sig.entry,
      direction: sig.direction,
      stopLoss: sig.sl,
      targetPrice: sig.tp,
      exitIdx: null, exitTime: null, exitPrice: null,
      pnlPct: null, result: 'open',
      strategy: sig.strategy,
    };

    // Buscar cierre en velas siguientes
    for (let j = sig.idx + 1; j < candles.length; j++) {
      const c = candles[j];
      let closed = false;

      if (sig.direction === 'BUY') {
        if (c.low <= sig.sl) {
          trade.exitPrice = sig.sl;
          trade.pnlPct = ((sig.sl - sig.entry) / sig.entry) * 100;
          trade.result = 'loss';
          closed = true;
        } else if (c.high >= sig.tp) {
          trade.exitPrice = sig.tp;
          trade.pnlPct = ((sig.tp - sig.entry) / sig.entry) * 100;
          trade.result = 'win';
          closed = true;
        }
      } else {
        if (c.high >= sig.sl) {
          trade.exitPrice = sig.sl;
          trade.pnlPct = ((sig.entry - sig.sl) / sig.entry) * 100;
          trade.result = 'loss';
          closed = true;
        } else if (c.low <= sig.tp) {
          trade.exitPrice = sig.tp;
          trade.pnlPct = ((sig.entry - sig.tp) / sig.entry) * 100;
          trade.result = 'win';
          closed = true;
        }
      }

      if (closed) {
        trade.exitIdx = j;
        trade.exitTime = c.openTime;
        break;
      }
    }

    trades.push(trade);
  }
  return trades;
}

// ---- Estrategias simplificadas para backtest ----
function runConfluence(candles: Candle[]): ReturnType<typeof simulateTrades>[0]['strategy'] extends string ? { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] : never {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const ema20arr = ema(closes, 20);
  const sma200arr = sma(closes, 200);
  const bb = bollingerBands(closes, 20, 2);
  const vwapArr = vwapCalc(candles, 50);
  const swings = findSwings(candles, 5);
  const avgVol = sma(volumes, 20);
  const signals: { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] = [];
  const cooldown = new Map<string, number>();

  for (let i = 210; i < candles.length; i++) {
    const price = closes[i];
    let scoreBull = 0, scoreBear = 0;
    if (!isNaN(bb.lower[i]) && price <= bb.lower[i]) scoreBull += 2;
    if (!isNaN(bb.upper[i]) && price >= bb.upper[i]) scoreBear += 2;
    if (!isNaN(ema20arr[i])) {
      if (price > ema20arr[i] * 0.999) scoreBull++;
      if (price < ema20arr[i] * 1.001) scoreBear++;
    }
    if (!isNaN(sma200arr[i])) {
      if (price > sma200arr[i]) scoreBull++;
      if (price < sma200arr[i]) scoreBear++;
    }
    const nearSwingLow = swings.lows.some(s => Math.abs(s.price - price) / price < 0.005);
    const nearSwingHigh = swings.highs.some(s => Math.abs(s.price - price) / price < 0.005);
    if (nearSwingLow) scoreBull++;
    if (nearSwingHigh) scoreBear++;
    if (!isNaN(vwapArr[i]) && Math.abs(price - vwapArr[i]) / price < 0.005) { scoreBull++; scoreBear++; }
    if (!isNaN(avgVol[i]) && volumes[i] > avgVol[i] * 1.2) { scoreBull++; scoreBear++; }

    const ck = Math.floor(i / 4).toString();
    if (scoreBull >= 5 && (!cooldown.has('B' + ck))) {
      cooldown.set('B' + ck, i);
      const sl = price * 0.97;
      const tp = Math.max(price * 1.05, price + (price - sl) * 3);
      signals.push({ idx: i, direction: 'BUY', entry: price, sl, tp, strategy: 'Confluence' });
    } else if (scoreBear >= 5 && (!cooldown.has('S' + ck))) {
      cooldown.set('S' + ck, i);
      const sl = price * 1.03;
      const tp = Math.min(price * 0.95, price - (sl - price) * 3);
      signals.push({ idx: i, direction: 'SELL', entry: price, sl, tp, strategy: 'Confluence' });
    }
  }
  return signals as any;
}

function runVWAP(candles: Candle[]): { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const vwapArr = vwapCalc(candles, 50);
  const rsiArr = rsi(closes, 14);
  const avgVol = sma(volumes, 20);
  const signals: { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] = [];

  for (let i = 60; i < candles.length - 1; i++) {
    const price = closes[i];
    const prev = closes[i - 1];
    if (isNaN(vwapArr[i]) || isNaN(rsiArr[i]) || isNaN(avgVol[i])) continue;
    const aboveVwap = prev < vwapArr[i] && price >= vwapArr[i];
    const belowVwap = prev > vwapArr[i] && price <= vwapArr[i];
    const highVol = volumes[i] > avgVol[i] * 1.2;

    if (aboveVwap && rsiArr[i] < 70 && highVol) {
      signals.push({ idx: i, direction: 'BUY', entry: price, sl: price * 0.975, tp: price * 1.05, strategy: 'VWAPMomentum' });
    } else if (belowVwap && rsiArr[i] > 30 && highVol) {
      signals.push({ idx: i, direction: 'SELL', entry: price, sl: price * 1.025, tp: price * 0.95, strategy: 'VWAPMomentum' });
    }
  }
  return signals;
}

// ---- Calcular estadisticas ----
function calcStats(trades: BacktestTrade[], initialCapital: number, riskPct: number) {
  const closed = trades.filter(t => t.result !== 'open');
  const wins = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;

  // Equity curve
  let equity = initialCapital;
  let maxEquity = equity;
  let maxDrawdown = 0;
  const equityCurve: { time: number; value: number }[] = [{ time: 0, value: equity }];

  for (const t of closed) {
    const pnl = (t.pnlPct! / 100) * (equity * riskPct / 100);
    equity += pnl;
    if (equity > maxEquity) maxEquity = equity;
    const dd = ((maxEquity - equity) / maxEquity) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    equityCurve.push({ time: t.exitTime!, value: Math.round(equity * 100) / 100 });
  }

  const totalPnlPct = ((equity - initialCapital) / initialCapital) * 100;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnlPct!, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnlPct!, 0) / losses.length : 0;
  const profitFactor = losses.length && avgLoss !== 0 ? Math.abs((wins.length * avgWin) / (losses.length * avgLoss)) : 0;

  return {
    totalTrades: closed.length,
    openTrades: trades.filter(t => t.result === 'open').length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnlPct: Math.round(totalPnlPct * 100) / 100,
    finalCapital: Math.round(equity * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    equityCurve,
  };
}

// ---- Endpoint principal ----
router.post('/run', async (req: any, res: any) => {
  try {
    const {
      symbol = 'BTCUSDT',
      interval = '1h',
      startDate,
      endDate,
      strategies = ['Confluence', 'VWAPMomentum'],
      initialCapital = 10000,
      riskPct = 1,
    } = req.body as {
      symbol: string; interval: string; startDate: string; endDate: string;
      strategies: string[]; initialCapital: number; riskPct: number;
    };

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    if (endTime - startTime > 365 * 24 * 60 * 60 * 1000 * 3) {
      return res.status(400).json({ error: 'Rango maximo 3 anos' });
    }

    console.log(\`Backtest: \${symbol} \${interval} \${startDate} -> \${endDate}\`);
    const candles = await fetchCandles(symbol, interval, startTime, endTime);
    console.log(\`Velas descargadas: \${candles.length}\`);

    if (candles.length < 200) {
      return res.status(400).json({ error: \`Pocas velas (\${candles.length}). Ampliar rango de fechas.\` });
    }

    // Correr estrategias seleccionadas
    let allSignals: { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] = [];

    if (strategies.includes('Confluence'))    allSignals.push(...runConfluence(candles));
    if (strategies.includes('VWAPMomentum')) allSignals.push(...runVWAP(candles));

    // Ordenar por idx
    allSignals.sort((a, b) => a.idx - b.idx);

    // Simular trades
    const trades = simulateTrades(candles, allSignals, riskPct);

    // Stats globales y por estrategia
    const global = calcStats(trades, initialCapital, riskPct);
    const byStrategy: Record<string, ReturnType<typeof calcStats>> = {};
    for (const strat of strategies) {
      const stratTrades = trades.filter(t => t.strategy === strat);
      byStrategy[strat] = calcStats(stratTrades, initialCapital, riskPct);
    }

    // Trades detallados (limitado a 500 para no saturar)
    const tradeDetails = trades.slice(0, 500).map(t => ({
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      direction: t.direction,
      strategy: t.strategy,
      entryPrice: Math.round(t.entryPrice * 100) / 100,
      exitPrice: t.exitPrice ? Math.round(t.exitPrice * 100) / 100 : null,
      pnlPct: t.pnlPct ? Math.round(t.pnlPct * 100) / 100 : null,
      result: t.result,
    }));

    res.json({
      symbol, interval,
      startDate, endDate,
      candles: candles.length,
      global,
      byStrategy,
      trades: tradeDetails,
    });

  } catch (err) {
    console.error('Backtest error:', (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as backtestRouter };
`;

fs.writeFileSync(path.join(base, 'backend\\src\\routes\\backtest.ts'), backtestRoute, 'utf8');
console.log('backtest.ts OK — length:', backtestRoute.length);

// Registrar en server.ts
let server = fs.readFileSync(path.join(base, 'backend\\src\\server.ts'), 'utf8');
if (!server.includes('backtestRouter')) {
  server = server.replace(
    "import { buildRoutes } from './routes/api';",
    "import { buildRoutes } from './routes/api';\nimport { backtestRouter } from './routes/backtest';"
  );
  server = server.replace(
    "app.use('/api', buildIndicatorsRouter",
    "app.use('/api/backtest', backtestRouter);\n  app.use('/api', buildIndicatorsRouter"
  );
  fs.writeFileSync(path.join(base, 'backend\\src\\server.ts'), server, 'utf8');
  console.log('server.ts OK — backtestRouter registrado');
} else {
  console.log('server.ts — ya tenia backtestRouter');
}
