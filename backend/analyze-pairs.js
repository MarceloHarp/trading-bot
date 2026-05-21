// Análisis técnico profundo de BTC/ADA/ETH con todos los indicadores
const axios = require('axios');

async function fetchCandles(symbol, interval, limit = 200) {
  const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
    params: { symbol, interval, limit },
    timeout: 15000,
  });
  return data.map(r => ({
    openTime: Number(r[0]),
    open: parseFloat(r[1]),
    high: parseFloat(r[2]),
    low: parseFloat(r[3]),
    close: parseFloat(r[4]),
    volume: parseFloat(r[5]),
  }));
}

// ---- INDICADORES ----
function sma(arr, p) {
  const out = new Array(arr.length).fill(NaN);
  for (let i = p - 1; i < arr.length; i++) {
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += arr[j];
    out[i] = s / p;
  }
  return out;
}

function ema(arr, p) {
  const out = new Array(arr.length).fill(NaN);
  const k = 2 / (p + 1);
  let prev = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[p - 1] = prev;
  for (let i = p; i < arr.length; i++) {
    prev = arr[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(closes, p = 14) {
  const out = new Array(closes.length).fill(NaN);
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  let aG = g / p, aL = l / p;
  out[p] = aL === 0 ? 100 : 100 - 100 / (1 + aG / aL);
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    aG = (aG * (p - 1) + Math.max(d, 0)) / p;
    aL = (aL * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = aL === 0 ? 100 : 100 - 100 / (1 + aG / aL);
  }
  return out;
}

function atr(candles, p = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const out = new Array(candles.length).fill(NaN);
  let s = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[p] = s;
  for (let i = p; i < trs.length; i++) {
    s = (s * (p - 1) + trs[i]) / p;
    out[i + 1] = s;
  }
  return out;
}

function bollinger(closes, p = 20, mult = 2) {
  const mid = sma(closes, p);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);
  for (let i = p - 1; i < closes.length; i++) {
    let sq = 0;
    for (let j = i - p + 1; j <= i; j++) sq += (closes[j] - mid[i]) ** 2;
    const std = Math.sqrt(sq / p);
    upper[i] = mid[i] + mult * std;
    lower[i] = mid[i] - mult * std;
  }
  return { mid, upper, lower };
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
  const eF = ema(closes, fast);
  const eS = ema(closes, slow);
  const line = closes.map((_, i) => (isNaN(eF[i]) || isNaN(eS[i])) ? NaN : eF[i] - eS[i]);
  const sig = ema(line.filter(v => !isNaN(v)), signal);
  // alinear señal con line
  const offset = line.length - sig.length;
  const sigAligned = new Array(line.length).fill(NaN);
  for (let i = 0; i < sig.length; i++) sigAligned[i + offset] = sig[i];
  const hist = line.map((v, i) => isNaN(v) || isNaN(sigAligned[i]) ? NaN : v - sigAligned[i]);
  return { line, signal: sigAligned, hist };
}

function donchian(candles, p = 20) {
  const upper = new Array(candles.length).fill(NaN);
  const lower = new Array(candles.length).fill(NaN);
  for (let i = p - 1; i < candles.length; i++) {
    let h = -Infinity, l = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      if (candles[j].high > h) h = candles[j].high;
      if (candles[j].low < l) l = candles[j].low;
    }
    upper[i] = h;
    lower[i] = l;
  }
  return { upper, lower };
}

// Fibonacci entre el swing high y low de los últimos N bars
function fibLevels(candles, lookback = 100) {
  const slice = candles.slice(-lookback);
  let hi = -Infinity, lo = Infinity, hiIdx = 0, loIdx = 0;
  slice.forEach((c, i) => {
    if (c.high > hi) { hi = c.high; hiIdx = i; }
    if (c.low < lo) { lo = c.low; loIdx = i; }
  });
  // Direction: if hi is more recent than lo, downtrend retracement; else uptrend
  const downtrend = hiIdx < loIdx;
  const range = hi - lo;
  return {
    hi, lo, range, downtrend,
    levels: {
      '0%': downtrend ? lo : hi,
      '23.6%': downtrend ? lo + range * 0.236 : hi - range * 0.236,
      '38.2%': downtrend ? lo + range * 0.382 : hi - range * 0.382,
      '50%': downtrend ? lo + range * 0.5 : hi - range * 0.5,
      '61.8%': downtrend ? lo + range * 0.618 : hi - range * 0.618,
      '78.6%': downtrend ? lo + range * 0.786 : hi - range * 0.786,
      '100%': downtrend ? hi : lo,
    },
  };
}

function adx(candles, p = 14) {
  const dm14p = [], dm14n = [], tr14 = [];
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    dm14p.push(upMove > downMove && upMove > 0 ? upMove : 0);
    dm14n.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    tr14.push(tr);
  }
  const out = new Array(candles.length).fill(NaN);
  if (dm14p.length < p) return out;
  let sP = dm14p.slice(0, p).reduce((a, b) => a + b, 0);
  let sN = dm14n.slice(0, p).reduce((a, b) => a + b, 0);
  let sT = tr14.slice(0, p).reduce((a, b) => a + b, 0);
  const dxArr = [];
  for (let i = p; i < dm14p.length; i++) {
    sP = sP - sP / p + dm14p[i];
    sN = sN - sN / p + dm14n[i];
    sT = sT - sT / p + tr14[i];
    const pdi = (sP / sT) * 100;
    const ndi = (sN / sT) * 100;
    const dx = Math.abs(pdi - ndi) / (pdi + ndi) * 100;
    dxArr.push(dx);
  }
  if (dxArr.length < p) return out;
  let adx = dxArr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[2 * p] = adx;
  for (let i = p; i < dxArr.length; i++) {
    adx = (adx * (p - 1) + dxArr[i]) / p;
    out[i + p + 1] = adx;
  }
  return out;
}

// ---- ANÁLISIS POR SÍMBOLO ----
async function analyze(symbol) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 ${symbol} — Análisis Técnico Completo`);
  console.log('='.repeat(70));

  const c1h = await fetchCandles(symbol, '1h', 200);
  const c4h = await fetchCandles(symbol, '4h', 100);

  for (const [tf, candles] of [['1h', c1h], ['4h', c4h]]) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const i = candles.length - 1;
    const last = candles[i];
    const prev = candles[i - 1];

    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const ema200 = closes.length >= 200 ? ema(closes, 200) : null;
    const r = rsi(closes, 14);
    const a = atr(candles, 14);
    const bb = bollinger(closes, 20, 2);
    const m = macd(closes);
    const don = donchian(candles, 20);
    const ax = adx(candles, 14);
    const fib = fibLevels(candles, Math.min(100, candles.length));

    const price = last.close;
    const change24h = ((price - candles[Math.max(0, i - 24)].close) / candles[Math.max(0, i - 24)].close) * 100;
    const atrPct = (a[i] / price) * 100;

    // Tendencia
    const trendShort = price > ema20[i] ? 'ALCISTA' : 'BAJISTA';
    const trendMid = price > ema50[i] ? 'ALCISTA' : 'BAJISTA';
    const trendLong = ema200 ? (price > ema200[i] ? 'ALCISTA' : 'BAJISTA') : 'N/A';

    // RSI signal
    const rsiVal = r[i];
    const rsiSig = rsiVal > 70 ? '🔴 SOBRECOMPRA' : rsiVal < 30 ? '🟢 SOBREVENTA' : rsiVal > 50 ? '↗️ Bullish' : '↘️ Bearish';

    // Bollinger position
    const bbWidth = ((bb.upper[i] - bb.lower[i]) / bb.mid[i]) * 100;
    const bbPos = ((price - bb.lower[i]) / (bb.upper[i] - bb.lower[i])) * 100;
    const bbSig = bbPos > 95 ? '🔴 Topa BB-upper' : bbPos < 5 ? '🟢 Topa BB-lower' : bbPos > 50 ? 'arriba-medio' : 'abajo-medio';

    // MACD
    const macdSig = m.hist[i] > 0 && m.hist[i] > m.hist[i - 1] ? '🟢 Bullish ↑' :
                    m.hist[i] > 0 ? '🟢 Bullish' :
                    m.hist[i] < 0 && m.hist[i] < m.hist[i - 1] ? '🔴 Bearish ↓' : '🔴 Bearish';

    // ADX
    const adxVal = ax[i];
    const adxSig = isNaN(adxVal) ? 'N/A' : adxVal > 25 ? `${adxVal.toFixed(0)} 💪 Tendencia fuerte` : `${adxVal.toFixed(0)} 😴 Rango`;

    // Donchian breakout proximity
    const donHi = don.upper[i - 1];
    const donLo = don.lower[i - 1];
    const distToHi = ((donHi - price) / price) * 100;
    const distToLo = ((price - donLo) / price) * 100;

    console.log(`\n  ━━━ ${tf} ━━━`);
    console.log(`  💰 Precio:        ${price.toFixed(4)} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% en 24h)`);
    console.log(`  📈 EMA20:         ${ema20[i].toFixed(4)} (${trendShort} corto)`);
    console.log(`  📈 EMA50:         ${ema50[i].toFixed(4)} (${trendMid} medio)`);
    if (ema200) console.log(`  📈 EMA200:        ${ema200[i].toFixed(4)} (${trendLong} largo)`);
    console.log(`  📊 RSI(14):       ${rsiVal.toFixed(1)} — ${rsiSig}`);
    console.log(`  📊 ATR(14):       ${a[i].toFixed(4)} (${atrPct.toFixed(2)}% del precio)`);
    console.log(`  📊 BB:            mid=${bb.mid[i].toFixed(4)} width=${bbWidth.toFixed(2)}% pos=${bbPos.toFixed(0)}% — ${bbSig}`);
    console.log(`  📊 MACD:          ${m.line[i].toFixed(4)} (signal=${m.signal[i].toFixed(4)}, hist=${m.hist[i].toFixed(4)}) — ${macdSig}`);
    console.log(`  📊 ADX(14):       ${adxSig}`);
    console.log(`  📊 Donchian(20):  hi=${donHi.toFixed(4)} (+${distToHi.toFixed(2)}%) | lo=${donLo.toFixed(4)} (-${distToLo.toFixed(2)}%)`);
    console.log(`  📊 Fibonacci(${Math.min(100, candles.length)} velas):`);
    console.log(`     Tendencia detectada: ${fib.downtrend ? '⬇️ BAJISTA' : '⬆️ ALCISTA'} | hi=${fib.hi.toFixed(4)} lo=${fib.lo.toFixed(4)}`);
    for (const [k, v] of Object.entries(fib.levels)) {
      const dist = ((v - price) / price * 100);
      const marker = Math.abs(dist) < 1 ? ' ⭐ CERCA' : '';
      console.log(`     ${k.padStart(7)} = ${v.toFixed(4)} (${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%)${marker}`);
    }
  }
}

(async () => {
  for (const sym of ['BTCUSDT', 'ADAUSDT', 'ETHUSDT']) {
    try {
      await analyze(sym);
    } catch (err) {
      console.error(`❌ Error con ${sym}: ${err.message}`);
    }
  }
})();
