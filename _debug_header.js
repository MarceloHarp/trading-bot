const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
const h = fs.readFileSync(base + '/frontend/src/components/Header.tsx', 'utf8');
// Mostrar las lineas que tienen SYMBOL o symbol
const lines = h.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('symbol') || l.includes('BTCUSDT')) {
    console.log(i + ':', l);
  }
});
