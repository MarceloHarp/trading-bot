const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let bt = fs.readFileSync(base + '/backend/src/routes/backtest.ts', 'utf8');

// Ver como retorna findSwings
const ind = fs.readFileSync(base + '/backend/src/core/indicators.ts', 'utf8');
const findSwingsMatch = ind.match(/export function findSwings[^}]+}/s);
console.log('findSwings signature:', ind.match(/export function findSwings.*?\{/)?.[0]);

// Ver las primeras lineas de findSwings
const lines = ind.split('\n');
const fsIdx = lines.findIndex(l => l.includes('findSwings'));
if (fsIdx >= 0) {
  console.log('findSwings lines:');
  for (let i = fsIdx; i < Math.min(fsIdx+20, lines.length); i++) {
    console.log(i + ':', lines[i]);
  }
}
