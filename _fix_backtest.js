const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let bt = fs.readFileSync(base + '/backend/src/routes/backtest.ts', 'utf8');

// Fix 1: findSwings retorna SwingPoint[] con {index, price, type}
// el backtest usaba swings.lows y swings.highs que no existen
bt = bt.replace(
  "const swings = findSwings(candles, 5);",
  `const swingsArr = findSwings(candles, 5);
    const swingLows = swingsArr.filter((s: {type:string}) => s.type === 'low');
    const swingHighs = swingsArr.filter((s: {type:string}) => s.type === 'high');`
);

// Fix 2: referencias a swings.lows y swings.highs
bt = bt.replace(
  "const nearSwingLow = swings.lows.some(s => Math.abs(s.price - price) / price < 0.005);",
  "const nearSwingLow = swingLows.some((s: {price:number}) => Math.abs(s.price - price) / price < 0.005);"
);
bt = bt.replace(
  "const nearSwingHigh = swings.highs.some(s => Math.abs(s.price - price) / price < 0.005);",
  "const nearSwingHigh = swingHighs.some((s: {price:number}) => Math.abs(s.price - price) / price < 0.005);"
);

fs.writeFileSync(base + '/backend/src/routes/backtest.ts', bt, 'utf8');
console.log('backtest.ts OK — findSwings fix aplicado');
console.log('Verificando:');
console.log('  swingsArr:', bt.includes('swingsArr') ? 'SI' : 'NO');
console.log('  swingLows:', bt.includes('swingLows') ? 'SI' : 'NO');
console.log('  swings.lows (viejo):', bt.includes('swings.lows') ? 'TODAVIA' : 'LIMPIO');
