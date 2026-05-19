const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
const app = fs.readFileSync(base + '/frontend/src/App.tsx', 'utf8');
console.log(app);
