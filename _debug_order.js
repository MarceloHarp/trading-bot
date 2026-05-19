const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

// Primero ver el error exacto — agregar logging del body del error en BinanceAdapter
let adapter = fs.readFileSync(base + '/backend/src/exchanges/BinanceAdapter.ts', 'utf8');
console.log('signedRequest tiene logging?', adapter.includes('Binance API') ? 'SI' : 'NO');

// Ver OrderExecutor — como calcula la quantity
let exec = fs.readFileSync(base + '/backend/src/core/OrderExecutor.ts', 'utf8');
const lines = exec.split('\n');
lines.forEach((l,i) => {
  if (l.includes('qty') || l.includes('quantity') || l.includes('Qty') || l.includes('floor') || l.includes('round')) {
    console.log(i+':', l);
  }
});
