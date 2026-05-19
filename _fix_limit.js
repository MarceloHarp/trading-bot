const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let bt = fs.readFileSync(base + '/backend/src/routes/backtest.ts', 'utf8');
bt = bt.replace('365 * 24 * 60 * 60 * 1000 * 3', '365 * 24 * 60 * 60 * 1000 * 4');
fs.writeFileSync(base + '/backend/src/routes/backtest.ts', bt, 'utf8');
console.log('OK limite 4 anos');
