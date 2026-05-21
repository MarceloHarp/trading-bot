// Backtest batch de varios pares contra el endpoint local
const axios = require('axios');

// Whitelist operable final (BTC queda como filtro de régimen, no se opera)
const PAIRS = [
  'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT',
  'LINKUSDT', 'XRPUSDT', 'DOGEUSDT', 'TRXUSDT',
];

const BODY = {
  interval: '1h',
  startDate: '2026-04-22',
  endDate: '2026-05-20',
  strategies: ['SmartMoney', 'VWAPMomentum', 'MarceMillo'],
  initialCapital: 10000,
  riskPct: 1,
};

async function run(symbol) {
  try {
    const { data } = await axios.post('http://localhost:3001/api/backtest/run',
      { ...BODY, symbol }, { timeout: 90000 });
    return { symbol, ok: true, g: data.global, byStrat: data.byStrategy };
  } catch (err) {
    return { symbol, ok: false, error: err.response?.data?.error || err.message };
  }
}

(async () => {
  console.log('Corriendo backtests 28d (1h, SmartMoney+VWAP+MarceMillo)...\n');
  const results = [];
  for (const p of PAIRS) {
    process.stdout.write(`  ${p}... `);
    const r = await run(p);
    if (r.ok) {
      console.log(`${r.g.totalTrades}t WR=${r.g.winRate}% PnL=${r.g.totalPnlPct}% PF=${r.g.profitFactor}`);
      results.push(r);
    } else {
      console.log(`ERROR: ${r.error}`);
    }
  }

  // Ranking por PnL
  results.sort((a, b) => b.g.totalPnlPct - a.g.totalPnlPct);
  console.log('\n' + '='.repeat(78));
  console.log('🏆 RANKING POR PnL (28 días)');
  console.log('='.repeat(78));
  console.log('Par'.padEnd(12) + 'Trades'.padEnd(8) + 'WinRate'.padEnd(10) + 'PnL%'.padEnd(10) + 'PF'.padEnd(8) + 'MaxDD%');
  console.log('-'.repeat(78));
  for (const r of results) {
    const g = r.g;
    const flag = g.totalPnlPct > 0 && g.profitFactor >= 1 ? ' ✅' : g.totalPnlPct < 0 ? ' ❌' : ' ⚠️';
    console.log(
      r.symbol.padEnd(12) +
      String(g.totalTrades).padEnd(8) +
      (g.winRate + '%').padEnd(10) +
      ((g.totalPnlPct >= 0 ? '+' : '') + g.totalPnlPct + '%').padEnd(10) +
      String(g.profitFactor).padEnd(8) +
      g.maxDrawdown + '%' + flag
    );
  }

  // Detalle por estrategia (acumulado)
  console.log('\n' + '='.repeat(78));
  console.log('📊 POR ESTRATEGIA (acumulado entre pares ganadores)');
  console.log('='.repeat(78));
  const strats = ['SmartMoney', 'VWAPMomentum', 'MarceMillo'];
  for (const s of strats) {
    let t = 0, w = 0, pnl = 0, cnt = 0;
    for (const r of results) {
      const st = r.byStrat[s];
      if (st && st.totalTrades > 0) { t += st.totalTrades; w += st.wins; pnl += st.totalPnlPct; cnt++; }
    }
    const wr = t ? ((w / t) * 100).toFixed(1) : '0';
    const apnl = cnt ? (pnl / cnt).toFixed(3) : '0';
    console.log(`${s.padEnd(14)} ${t}t | WR=${wr}% | PnL prom/par=${apnl}%`);
  }

  // Whitelist sugerida
  console.log('\n' + '='.repeat(78));
  const winners = results.filter(r => r.g.totalPnlPct > 0 && r.g.profitFactor >= 1);
  console.log('✅ GANADORES (PnL>0 y PF>=1): ' + (winners.map(w => w.symbol).join(', ') || 'ninguno'));
  const losers = results.filter(r => r.g.totalPnlPct < 0);
  console.log('❌ PERDEDORES (PnL<0):        ' + (losers.map(w => w.symbol).join(', ') || 'ninguno'));
})();
