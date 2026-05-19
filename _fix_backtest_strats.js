const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let bp = fs.readFileSync(base + '/frontend/src/components/BacktestPage.tsx', 'utf8');

// Reemplazar la lista de estrategias
bp = bp.replace(
  "const STRATEGIES = ['Confluence', 'VWAPMomentum'];",
  "const STRATEGIES = ['Confluence', 'VWAPMomentum', 'SmartMoney', 'DruLozano'];"
);

// Reemplazar el estado inicial para incluir solo Dru por defecto
// (se deja igual, el usuario elige)
fs.writeFileSync(base + '/frontend/src/components/BacktestPage.tsx', bp, 'utf8');
console.log('BacktestPage.tsx OK — 4 estrategias');
