const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
const files = {
  trades: fs.readFileSync(base + '/frontend/src/components/TradesPanel.tsx', 'utf8'),
};
fs.writeFileSync(base + '/_read_result.json', JSON.stringify(files, null, 2));
console.log('OK');
console.log(files.trades);
