const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

function patchEnv(filePath) {
  let env = fs.readFileSync(filePath, 'utf8');
  env = env.replace(/TRADING_TIMEFRAMES=.*/,'TRADING_TIMEFRAMES=1h,4h');
  fs.writeFileSync(filePath, env, 'utf8');
  const check = env.match(/TRADING_TIMEFRAMES=.*/)[0];
  console.log(path.basename(filePath) + ': ' + check);
}

patchEnv(path.join(base, '.env'));
patchEnv(path.join(base, 'backend/.env'));
