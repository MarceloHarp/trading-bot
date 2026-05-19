const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

// Header — agregar ADAUSDT al selector de symbols
let h = fs.readFileSync(base + '/frontend/src/components/Header.tsx', 'utf8');
h = h.replace(
  "const SYMBOLS = ['BTCUSDT', 'ETHUSDT']",
  "const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT']"
);
h = h.replace(
  "'BTCUSDT','ETHUSDT'",
  "'BTCUSDT','ETHUSDT','ADAUSDT'"
);
h = h.replace(
  '"BTCUSDT","ETHUSDT"',
  '"BTCUSDT","ETHUSDT","ADAUSDT"'
);
fs.writeFileSync(base + '/frontend/src/components/Header.tsx', h, 'utf8');
console.log('Header OK:', h.includes('ADAUSDT') ? 'ADAUSDT agregado' : 'NO encontrado patron');

// BalancePanel — agregar ADA a los assets relevantes
let bp = fs.readFileSync(base + '/frontend/src/components/BalancePanel.tsx', 'utf8');
bp = bp.replace(
  "const quotes = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB'];",
  "const quotes = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'ADA'];"
);
fs.writeFileSync(base + '/frontend/src/components/BalancePanel.tsx', bp, 'utf8');
console.log('BalancePanel OK:', bp.includes("'ADA'") ? 'ADA agregado' : 'NO encontrado');
