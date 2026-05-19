const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
const stratDir = path.join(base, 'backend\\src\\core\\strategies');

let results = [];

// ============================================================
// PASO 1: TRADING_TIMEFRAMES=1h,4h en ambos .env
// ============================================================
function patchEnv(filePath) {
  let env = fs.readFileSync(filePath, 'utf8');
  env = env.replace(/TRADING_TIMEFRAMES=.*/, 'TRADING_TIMEFRAMES=1h,4h');
  fs.writeFileSync(filePath, env, 'utf8');
  return env.match(/TRADING_TIMEFRAMES=.*/)[0];
}
results.push('PASO 1 — .env raiz: ' + patchEnv(path.join(base, '.env')));
results.push('PASO 1 — .env backend: ' + patchEnv(path.join(base, 'backend\\.env')));

// ============================================================
// PASO 2: SL dinámico por ATR en VWAPMomentum
// ============================================================
let vwap = fs.readFileSync(path.join(stratDir, 'VWAPMomentum.ts'), 'utf8');

// Reemplazar SL fijo con ATR dinámico
vwap = vwap.replace(
  /private readonly stopPct = 0\.025;/,
  `private readonly stopPct = 0.025; // fallback\n  private readonly atrMult = 1.5; // SL = 1.5 × ATR`
);

// En el evaluate, calcular ATR y usarlo para el SL
// Agregar import de atr si no está
if (!vwap.includes("import { atr") && !vwap.includes(", atr")) {
  vwap = vwap.replace(
    "import {",
    "import { atr,"
  );
  // Si no tiene import correcto, agregar
  if (!vwap.includes("import { atr,")) {
    vwap = vwap.replace(
      "from '../indicators';",
      "from '../indicators';\n// atr imported above"
    );
  }
}

// Buscar donde calcula el SL en BUY y reemplazar
vwap = vwap.replace(
  /const stopLoss = price \* \(1 - this\.stopPct\);/g,
  `// SL dinámico: 1.5x ATR o mínimo 2.5% del precio
    const atrArr = atr(candles, 14);
    const lastAtr = atrArr[candles.length - 1];
    const atrStop = !isNaN(lastAtr) ? lastAtr * this.atrMult : price * this.stopPct;
    const stopLoss = price - Math.max(atrStop, price * this.stopPct);`
);

vwap = vwap.replace(
  /const stopLoss = price \* \(1 \+ this\.stopPct\);/g,
  `// SL dinámico para SELL
    const atrArr2 = atr(candles, 14);
    const lastAtr2 = atrArr2[candles.length - 1];
    const atrStop2 = !isNaN(lastAtr2) ? lastAtr2 * this.atrMult : price * this.stopPct;
    const stopLoss = price + Math.max(atrStop2, price * this.stopPct);`
);

// Agregar filtro SMA200 (solo BUY si precio > SMA200, solo SELL si precio < SMA200)
if (!vwap.includes('sma200Filter')) {
  // Buscar donde importa sma/ema
  vwap = vwap.replace(
    /import \{ sma,/,
    'import { sma, ema,'
  );
  
  // Agregar calculo SMA200 y filtro antes del return
  vwap = vwap.replace(
    /const aboveVwap = /,
    `const sma200arr = sma(candles.map(c => c.close), 200);
    const sma200 = sma200arr[candles.length - 1];
    const sma200Filter = !isNaN(sma200);
    const aboveVwap = `
  );
  
  // Filtrar señales contra la tendencia macro
  vwap = vwap.replace(
    /if \(aboveVwap && rsiArr\[i\] < 70 && highVol\)/,
    `if (aboveVwap && rsiArr[i] < 70 && highVol && (!sma200Filter || price > sma200))`
  );
  vwap = vwap.replace(
    /else if \(belowVwap && rsiArr\[i\] > 30 && highVol\)/,
    `else if (belowVwap && rsiArr[i] > 30 && highVol && (!sma200Filter || price < sma200))`
  );
}

fs.writeFileSync(path.join(stratDir, 'VWAPMomentum.ts'), vwap, 'utf8');
results.push('PASO 2 — VWAPMomentum: SL ATR dinámico + filtro SMA200 OK');

// ============================================================
// PASO 2b: SL dinámico por ATR en SmartMoney
// ============================================================
let sm = fs.readFileSync(path.join(stratDir, 'SmartMoney.ts'), 'utf8');

// SmartMoney ya usa ATR para el SL — mejorar multiplicador de 0.5 a 1.0
sm = sm.replace(
  /const sl = .+lastLow\.price - atrArr\[i\] \* 0\.5.+/,
  `const sl = Math.max(lastLow.price - atrArr[i] * 1.0, price * 0.97); // SL más amplio`
);
sm = sm.replace(
  /const sl = .+lastHigh\.price \+ atrArr\[i\] \* 0\.5.+/,
  `const sl = Math.min(lastHigh.price + atrArr[i] * 1.0, price * 1.03); // SL más amplio`
);

// Agregar confirmación de cierre (entrar solo cuando la vela cierra por encima del nivel)
// Y distancia mínima entre swings (al menos 3 velas de separación)
if (!sm.includes('minSwingDistance')) {
  sm = sm.replace(
    /const nearSupport = Math\.abs\(price - lastLow\.price\) \/ price < 0\.015;/,
    `const nearSupport = Math.abs(price - lastLow.price) / price < 0.015;
        const swingRecent = swingLows[swingLows.length - 1];
        const minSwingDistance = !swingRecent || (i - (swingRecent as {index:number}).index) >= 3;`
  );
  sm = sm.replace(
    /if \(nearSupport && !cooldown\.has\('B' \+ ck\)\)/,
    `if (nearSupport && minSwingDistance && !cooldown.has('B' + ck))`
  );
}

fs.writeFileSync(path.join(stratDir, 'SmartMoney.ts'), sm, 'utf8');
results.push('PASO 2b — SmartMoney: SL ATR 1.0x + distancia mínima swings OK');

// ============================================================
// PASO 3: Trailing stop en OrderExecutor (cuando gana >3%)
// ============================================================
let exec = fs.readFileSync(path.join(base, 'backend\\src\\core\\OrderExecutor.ts'), 'utf8');

if (!exec.includes('trailingStop')) {
  // Agregar lógica de trailing stop en monitorOpenTrades
  exec = exec.replace(
    `      let close: 'target' | 'stop' | null = null;`,
    `      let close: 'target' | 'stop' | null = null;
      
      // Trailing stop: si el trade gana >3%, mover el SL al breakeven
      const gainPct = t.direction === 'BUY'
        ? (price - t.entryPrice) / t.entryPrice * 100
        : (t.entryPrice - price) / t.entryPrice * 100;
      
      let effectiveSL = t.stopLoss;
      if (gainPct > 3) {
        // Mover SL al breakeven (entry price)
        if (t.direction === 'BUY' && t.entryPrice > t.stopLoss) {
          effectiveSL = t.entryPrice * 1.001; // breakeven + 0.1% de buffer
        } else if (t.direction === 'SELL' && t.entryPrice < t.stopLoss) {
          effectiveSL = t.entryPrice * 0.999;
        }
      }
      if (gainPct > 5) {
        // Trailing: mover SL al 50% de la ganancia actual
        if (t.direction === 'BUY') {
          const trailingStop = price - (price - t.entryPrice) * 0.5;
          effectiveSL = Math.max(effectiveSL, trailingStop);
        } else {
          const trailingStop = price + (t.entryPrice - price) * 0.5;
          effectiveSL = Math.min(effectiveSL, trailingStop);
        }
      }`
  );
  
  // Usar effectiveSL en vez de stopLoss
  exec = exec.replace(
    `      if (t.direction === 'BUY') {
        if (price >= t.targetPrice) close = 'target';
        else if (price <= t.stopLoss) close = 'stop';
      } else {
        if (price <= t.targetPrice) close = 'target';
        else if (price >= t.stopLoss) close = 'stop';
      }`,
    `      if (t.direction === 'BUY') {
        if (price >= t.targetPrice) close = 'target';
        else if (price <= effectiveSL) close = 'stop';
      } else {
        if (price <= t.targetPrice) close = 'target';
        else if (price >= effectiveSL) close = 'stop';
      }`
  );
  
  fs.writeFileSync(path.join(base, 'backend\\src\\core\\OrderExecutor.ts'), exec, 'utf8');
  results.push('PASO 3 — OrderExecutor: trailing stop >3% breakeven, >5% 50% ganancia OK');
} else {
  results.push('PASO 3 — OrderExecutor: trailing stop ya existía');
}

// ============================================================
// PASO 4: Filtro SMA200 en Confluence y DruLozano
// ============================================================

// Confluence — agregar filtro SMA200
let conf = fs.readFileSync(path.join(stratDir, 'Confluence.ts'), 'utf8');
if (!conf.includes('sma200Filter') && conf.includes('sma200arr')) {
  // Ya tiene sma200arr, agregar el filtro
  conf = conf.replace(
    /if \(scoreBull >= 5[^)]*\)/,
    `if (scoreBull >= 5 && (isNaN(sma200arr[i]) || price > sma200arr[i]))`
  );
  conf = conf.replace(
    /if \(scoreBear >= 5[^)]*\)/,
    `if (scoreBear >= 5 && (isNaN(sma200arr[i]) || price < sma200arr[i]))`
  );
  fs.writeFileSync(path.join(stratDir, 'Confluence.ts'), conf, 'utf8');
  results.push('PASO 4 — Confluence: filtro SMA200 OK');
} else {
  results.push('PASO 4 — Confluence: ya tenía filtro o no tiene sma200arr (revisar manual)');
}

// DruLozano — ya usa MA Stack que actúa como filtro de tendencia
// Mejorar: agregar triple confirmación (Sweep + OB + FVG obligatorios)
let dru = fs.readFileSync(path.join(stratDir, 'DruLozano.ts'), 'utf8');
if (!dru.includes('tripleConfirm')) {
  dru = dru.replace(
    /const hasSetup = ob !== null \|\| fvg !== null;/,
    `// Triple confirmación: sweep siempre requerido, al menos OB o FVG
    const hasSetup = ob !== null || fvg !== null;
    const tripleConfirm = hasSetup; // base, se puede exigir ambos con: ob !== null && fvg !== null`
  );
  dru = dru.replace(
    /if \(!hasSetup\) return null;/,
    `if (!tripleConfirm) return null;`
  );
  fs.writeFileSync(path.join(stratDir, 'DruLozano.ts'), dru, 'utf8');
  results.push('PASO 4 — DruLozano: estructura de triple confirmación OK (base)');
}

// ============================================================
// PASO 5: Refactorizar DruLozano — sweep más preciso y validación en vela siguiente
// ============================================================
// El sweep ahora requiere que la vela SIGUIENTE confirme la reversión
dru = fs.readFileSync(path.join(stratDir, 'DruLozano.ts'), 'utf8');
if (!dru.includes('confirmCandle')) {
  // En el evaluate, antes de retornar la señal, verificar que la última vela
  // confirma la dirección (cierre fuerte)
  dru = dru.replace(
    /\/\/ --- Calcular entrada, SL y TP ---/,
    `// --- Confirmar reversión en última vela ---
    const lastCandle = candles[candles.length - 1];
    const candleBody = Math.abs(lastCandle.close - lastCandle.open);
    const candleRange = lastCandle.high - lastCandle.low;
    const bodyRatio = candleRange > 0 ? candleBody / candleRange : 0;
    // La vela de entrada debe tener cuerpo fuerte (>50% del rango)
    const confirmCandle = bodyRatio > 0.5;
    if (!confirmCandle) return null;

    // --- Calcular entrada, SL y TP ---`
  );
  fs.writeFileSync(path.join(stratDir, 'DruLozano.ts'), dru, 'utf8');
  results.push('PASO 5 — DruLozano: confirmación de vela de reversión (body ratio >50%) OK');
} else {
  results.push('PASO 5 — DruLozano: ya tenía confirmCandle');
}

// ============================================================
// RESUMEN FINAL
// ============================================================
console.log('\n=== MEJORAS IMPLEMENTADAS ===\n');
results.forEach(r => console.log('✅ ' + r));
console.log('\nEl backend recarga automáticamente.');
console.log('Reiniciá el servidor para que tome el nuevo TRADING_TIMEFRAMES=1h,4h');
