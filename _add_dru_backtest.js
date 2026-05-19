const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let bt = fs.readFileSync(base + '/backend/src/routes/backtest.ts', 'utf8');

// Agregar funcion runDruLozano y SmartMoney al backtest
const druFn = `
function runSmartMoney(candles: Candle[]): { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] {
  const closes = candles.map(c => c.close);
  const sma200arr = sma(closes, 200);
  const atrArr = atr(candles, 14);
  const swingsArr = findSwings(candles, 5);
  const swingHighs = swingsArr.filter((s: {type:string}) => s.type === 'high');
  const swingLows  = swingsArr.filter((s: {type:string}) => s.type === 'low');
  const signals: { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] = [];
  const cooldown = new Map<string, number>();

  for (let i = 210; i < candles.length - 1; i++) {
    const price = closes[i];
    const prevPrice = closes[i - 1];
    if (isNaN(sma200arr[i]) || isNaN(atrArr[i])) continue;
    const aboveMa200 = price > sma200arr[i];
    const recentHighs = swingHighs.filter((s: {index:number}) => s.index < i && s.index >= i - 20);
    const recentLows  = swingLows.filter((s: {index:number}) => s.index < i && s.index >= i - 20);
    const ck = Math.floor(i / 6).toString();

    if (aboveMa200 && recentLows.length >= 2) {
      const lastLow = recentLows[recentLows.length - 1] as {price:number};
      const nearSupport = Math.abs(price - lastLow.price) / price < 0.015;
      if (nearSupport && !cooldown.has('B' + ck)) {
        cooldown.set('B' + ck, i);
        const sl = Math.max(lastLow.price - atrArr[i] * 0.5, price * 0.95);
        const risk = price - sl;
        const tp = Math.max(price + risk * 3, price * 1.05);
        signals.push({ idx: i, direction: 'BUY', entry: price, sl, tp, strategy: 'SmartMoney' });
      }
    }
    if (!aboveMa200 && recentHighs.length >= 2) {
      const lastHigh = recentHighs[recentHighs.length - 1] as {price:number};
      const nearResistance = Math.abs(price - lastHigh.price) / price < 0.015;
      if (nearResistance && !cooldown.has('S' + ck)) {
        cooldown.set('S' + ck, i);
        const sl = Math.min(lastHigh.price + atrArr[i] * 0.5, price * 1.05);
        const risk = sl - price;
        const tp = Math.min(price - risk * 3, price * 0.95);
        signals.push({ idx: i, direction: 'SELL', entry: price, sl, tp, strategy: 'SmartMoney' });
      }
    }
  }
  return signals;
}

function runDruLozano(candles: Candle[]): { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] {
  const closes = candles.map(c => c.close);
  const ma50arr  = sma(closes, 50);
  const ma100arr = sma(closes, 100);
  const ma150arr = sma(closes, 150);
  const ma200arr = sma(closes, 200);
  const atrArr   = atr(candles, 14);
  const swingsArr = findSwings(candles, 5);
  const signals: { idx: number; direction: 'BUY' | 'SELL'; entry: number; sl: number; tp: number; strategy: string }[] = [];
  const cooldown = new Map<string, number>();

  for (let i = 210; i < candles.length - 1; i++) {
    const price = closes[i];
    if ([ma50arr[i], ma100arr[i], ma150arr[i], ma200arr[i], atrArr[i]].some(isNaN)) continue;
    const bullStack = price > ma50arr[i] && ma50arr[i] > ma100arr[i] && ma100arr[i] > ma150arr[i] && ma150arr[i] > ma200arr[i];
    const bearStack = price < ma50arr[i] && ma50arr[i] < ma100arr[i] && ma100arr[i] < ma150arr[i] && ma150arr[i] < ma200arr[i];
    if (!bullStack && !bearStack) continue;

    // Liquidity Sweep: en las ultimas 8 velas, buscar vela que penetro un swing y revirtio
    const recent = candles.slice(Math.max(0, i - 8), i + 1);
    const swingLows  = swingsArr.filter((s: {type:string;index:number}) => s.type === 'low'  && s.index < i - 8);
    const swingHighs = swingsArr.filter((s: {type:string;index:number}) => s.type === 'high' && s.index < i - 8);
    let hasSweep = false;
    let sweepExtreme = price;

    if (bullStack && swingLows.length >= 2) {
      const level = Math.max(...swingLows.slice(-3).map((s: {price:number}) => s.price));
      for (const c of recent.slice(0, -1)) {
        if (c.low < level && c.close > level) { hasSweep = true; sweepExtreme = c.low; break; }
      }
    }
    if (bearStack && swingHighs.length >= 2) {
      const level = Math.min(...swingHighs.slice(-3).map((s: {price:number}) => s.price));
      for (const c of recent.slice(0, -1)) {
        if (c.high > level && c.close < level) { hasSweep = true; sweepExtreme = c.high; break; }
      }
    }
    if (!hasSweep) continue;

    const ck = Math.floor(i / 8).toString();
    if (bullStack && !cooldown.has('B' + ck)) {
      cooldown.set('B' + ck, i);
      const sl = Math.min(sweepExtreme - atrArr[i] * 0.3, price * 0.97);
      const risk = price - sl;
      const tp = Math.max(price + risk * 3, price * 1.05);
      signals.push({ idx: i, direction: 'BUY', entry: price, sl, tp, strategy: 'DruLozano' });
    } else if (bearStack && !cooldown.has('S' + ck)) {
      cooldown.set('S' + ck, i);
      const sl = Math.max(sweepExtreme + atrArr[i] * 0.3, price * 1.03);
      const risk = sl - price;
      const tp = Math.min(price - risk * 3, price * 0.95);
      signals.push({ idx: i, direction: 'SELL', entry: price, sl, tp, strategy: 'DruLozano' });
    }
  }
  return signals;
}
`;

// Insertar las funciones antes del endpoint principal
bt = bt.replace(
  "// ---- Endpoint principal ----",
  druFn + "\n// ---- Endpoint principal ----"
);

// Agregar las estrategias al switch de seleccion
bt = bt.replace(
  "if (strategies.includes('Confluence'))    allSignals.push(...runConfluence(candles));\n    if (strategies.includes('VWAPMomentum')) allSignals.push(...runVWAP(candles));",
  `if (strategies.includes('Confluence'))    allSignals.push(...runConfluence(candles));
    if (strategies.includes('VWAPMomentum')) allSignals.push(...runVWAP(candles));
    if (strategies.includes('SmartMoney'))   allSignals.push(...runSmartMoney(candles));
    if (strategies.includes('DruLozano'))    allSignals.push(...runDruLozano(candles));`
);

fs.writeFileSync(base + '/backend/src/routes/backtest.ts', bt, 'utf8');
console.log('backtest.ts OK — DruLozano y SmartMoney agregados');
console.log('DruLozano:', bt.includes('runDruLozano') ? 'SI' : 'NO');
console.log('SmartMoney:', bt.includes('runSmartMoney') ? 'SI' : 'NO');
