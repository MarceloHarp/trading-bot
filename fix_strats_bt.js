const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
const dest = path.join(base, 'frontend\\src\\components\\BacktestPage.tsx');

let bp = fs.readFileSync(dest, 'utf8');
bp = bp.replace(
  "const STRATEGIES = ['Confluence', 'VWAPMomentum'];",
  "const STRATEGIES = ['Confluence', 'VWAPMomentum', 'SmartMoney', 'DruLozano'];"
);
fs.writeFileSync(dest, bp, 'utf8');
console.log('OK — 4 estrategias:', bp.includes('DruLozano') ? 'DruLozano agregado' : 'FALLO');
