const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
const files = {
  signals: fs.readFileSync(base + '/frontend/src/components/SignalsPanel.tsx', 'utf8'),
};
fs.writeFileSync(base + '/_read_result.json', JSON.stringify(files, null, 2));
console.log(files.signals);
