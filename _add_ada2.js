const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let h = fs.readFileSync(base + '/frontend/src/components/Header.tsx', 'utf8');
h = h.replace(
  "const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];",
  "const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT'];"
);
fs.writeFileSync(base + '/frontend/src/components/Header.tsx', h, 'utf8');
console.log('OK:', h.includes('ADAUSDT') ? 'ADAUSDT agregado' : 'FALLO');
