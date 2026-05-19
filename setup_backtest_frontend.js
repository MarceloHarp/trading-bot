const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

// ============================================================
// BacktestPage.tsx
// ============================================================
const backtestPage = `import { useState } from 'react';
import { ArrowLeft, Play, TrendingUp, TrendingDown, Target, BarChart3, AlertCircle, Loader2 } from 'lucide-react';

interface BacktestResult {
  symbol: string; interval: string; startDate: string; endDate: string; candles: number;
  global: Stats; byStrategy: Record<string, Stats>;
  trades: TradeLine[];
}

interface Stats {
  totalTrades: number; openTrades: number; wins: number; losses: number;
  winRate: number; totalPnlPct: number; finalCapital: number;
  maxDrawdown: number; avgWin: number; avgLoss: number; profitFactor: number;
  equityCurve: { time: number; value: number }[];
}

interface TradeLine {
  entryTime: number; exitTime: number | null; direction: 'BUY' | 'SELL';
  strategy: string; entryPrice: number; exitPrice: number | null;
  pnlPct: number | null; result: 'win' | 'loss' | 'open';
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT'];
const INTERVALS = ['1h', '4h', '1d'];
const STRATEGIES = ['Confluence', 'VWAPMomentum'];

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-subtle/40 rounded-lg p-3 border border-bg-subtle">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={\`text-xl font-bold font-mono \${color ?? 'text-gray-200'}\`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniEquityCurve({ curve, height = 60 }: { curve: { time: number; value: number }[]; height?: number }) {
  if (curve.length < 2) return null;
  const vals = curve.map(p => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 300; const h = height;
  const pts = curve.map((p, i) => {
    const x = (i / (curve.length - 1)) * w;
    const y = h - ((p.value - min) / range) * h;
    return \`\${x},\${y}\`;
  }).join(' ');
  const isPos = vals[vals.length - 1] >= vals[0];
  const color = isPos ? '#10b981' : '#ef4444';
  const fillPts = \`0,\${h} \${pts} \${w},\${h}\`;
  return (
    <svg viewBox={\`0 0 \${w} \${h}\`} className="w-full" style={{ height }}>
      <polygon points={fillPts} fill={color} fillOpacity="0.1" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function BacktestPage({ onBack }: { onBack: () => void }) {
  const [symbol, setSymbol]       = useState('BTCUSDT');
  const [interval, setInterval]   = useState('1h');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate]     = useState(new Date().toISOString().slice(0, 10));
  const [strategies, setStrategies] = useState<string[]>(['Confluence', 'VWAPMomentum']);
  const [capital, setCapital]     = useState(10000);
  const [riskPct, setRiskPct]     = useState(1);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<BacktestResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'by-strategy' | 'trades'>('global');

  const toggleStrategy = (s: string) => {
    setStrategies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const run = async () => {
    if (strategies.length === 0) { setError('Selecciona al menos una estrategia'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, interval, startDate, endDate, strategies, initialCapital: capital, riskPct }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error en el backtest'); return; }
      setResult(data);
      setActiveTab('global');
    } catch (e) {
      setError('No se pudo conectar al backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-blue" />
            Backtesting
          </h1>
          <p className="text-xs text-gray-500">Simula estrategias sobre datos historicos reales de Binance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Panel de configuracion */}
        <div className="lg:col-span-1 card space-y-4">
          <div className="card-header">Configuracion</div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Par</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full bg-bg-subtle border border-bg-subtle rounded px-2 py-1.5 text-sm text-gray-200">
              {SYMBOLS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Timeframe</label>
            <div className="flex gap-1">
              {INTERVALS.map(i => (
                <button key={i} onClick={() => setInterval(i)}
                  className="flex-1 py-1 rounded text-[11px] font-medium border transition-all"
                  style={interval === i
                    ? { backgroundColor:'#3b82f622', borderColor:'#3b82f6', color:'#93c5fd' }
                    : { borderColor:'#374151', color:'#6b7280', backgroundColor:'transparent' }}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Desde</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-bg-subtle border border-bg-subtle rounded px-2 py-1.5 text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Hasta</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-bg-subtle border border-bg-subtle rounded px-2 py-1.5 text-sm text-gray-200" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Estrategias</label>
            <div className="space-y-1">
              {STRATEGIES.map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={strategies.includes(s)} onChange={() => toggleStrategy(s)}
                    className="accent-blue-500" />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Capital inicial (USDT)</label>
            <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
              className="w-full bg-bg-subtle border border-bg-subtle rounded px-2 py-1.5 text-sm text-gray-200" />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Riesgo por trade (%)</label>
            <input type="number" value={riskPct} min={0.1} max={10} step={0.1}
              onChange={e => setRiskPct(Number(e.target.value))}
              className="w-full bg-bg-subtle border border-bg-subtle rounded px-2 py-1.5 text-sm text-gray-200" />
            <p className="text-[10px] text-gray-600 mt-0.5">
              Con {capital} USDT = {(capital * riskPct / 100).toFixed(0)} USDT por trade
            </p>
          </div>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm transition-all bg-accent-blue/20 border border-accent-blue/50 text-accent-blue hover:bg-accent-blue/30 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Calculando...' : 'Ejecutar backtest'}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Resultados */}
        <div className="lg:col-span-3 space-y-4">
          {!result && !loading && (
            <div className="card flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Configura los parametros y ejecuta el backtest</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="card flex items-center justify-center h-64">
              <div className="text-center text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                <p>Descargando {symbol} {interval}...</p>
                <p className="text-xs text-gray-600 mt-1">Puede tardar unos segundos</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Info header */}
              <div className="card">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-semibold text-lg">{result.symbol}</span>
                    <span className="text-gray-500 ml-2">{result.interval}</span>
                    <span className="text-gray-600 ml-2 text-sm">
                      {result.startDate} → {result.endDate} · {result.candles.toLocaleString()} velas
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(['global', 'by-strategy', 'trades'] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className="px-3 py-1 rounded text-xs font-medium border transition-all"
                        style={activeTab === tab
                          ? { backgroundColor:'#3b82f622', borderColor:'#3b82f6', color:'#93c5fd' }
                          : { borderColor:'#374151', color:'#6b7280', backgroundColor:'transparent' }}>
                        {tab === 'global' ? 'Global' : tab === 'by-strategy' ? 'Por estrategia' : 'Trades'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab Global */}
              {activeTab === 'global' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="PnL Total"
                      value={(result.global.totalPnlPct > 0 ? '+' : '') + result.global.totalPnlPct + '%'}
                      sub={\`\${result.global.finalCapital.toLocaleString()} USDT final\`}
                      color={result.global.totalPnlPct > 0 ? 'text-accent-green' : 'text-accent-red'} />
                    <StatCard label="Win Rate" value={result.global.winRate + '%'}
                      sub={\`\${result.global.wins}W / \${result.global.losses}L\`}
                      color={result.global.winRate >= 50 ? 'text-accent-green' : 'text-accent-red'} />
                    <StatCard label="Max Drawdown" value={result.global.maxDrawdown + '%'}
                      color={result.global.maxDrawdown < 10 ? 'text-accent-green' : result.global.maxDrawdown < 20 ? 'text-accent-yellow' : 'text-accent-red'} />
                    <StatCard label="Profit Factor" value={result.global.profitFactor.toFixed(2)}
                      sub="ratio ganancia/perdida"
                      color={result.global.profitFactor >= 1.5 ? 'text-accent-green' : result.global.profitFactor >= 1 ? 'text-accent-yellow' : 'text-accent-red'} />
                    <StatCard label="Total Trades" value={result.global.totalTrades.toString()}
                      sub={\`\${result.global.openTrades} sin cerrar\`} />
                    <StatCard label="Avg Win" value={'+' + result.global.avgWin + '%'} color="text-accent-green" />
                    <StatCard label="Avg Loss" value={result.global.avgLoss + '%'} color="text-accent-red" />
                    <StatCard label="Riesgo/trade" value={riskPct + '%'}
                      sub={\`\${(capital * riskPct / 100).toFixed(0)} USDT\`} />
                  </div>
                  <div className="card">
                    <div className="card-header mb-2">Equity Curve</div>
                    <MiniEquityCurve curve={result.global.equityCurve} height={120} />
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>{capital.toLocaleString()} USDT</span>
                      <span>{result.global.finalCapital.toLocaleString()} USDT</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Por estrategia */}
              {activeTab === 'by-strategy' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(result.byStrategy).map(([strat, stats]) => (
                    <div key={strat} className="card space-y-3">
                      <div className="card-header">{strat}</div>
                      <MiniEquityCurve curve={stats.equityCurve} height={80} />
                      <div className="grid grid-cols-2 gap-2">
                        <StatCard label="PnL" value={(stats.totalPnlPct > 0 ? '+' : '') + stats.totalPnlPct + '%'}
                          color={stats.totalPnlPct > 0 ? 'text-accent-green' : 'text-accent-red'} />
                        <StatCard label="Win Rate" value={stats.winRate + '%'}
                          sub={\`\${stats.wins}W / \${stats.losses}L\`}
                          color={stats.winRate >= 50 ? 'text-accent-green' : 'text-accent-red'} />
                        <StatCard label="Max DD" value={stats.maxDrawdown + '%'}
                          color={stats.maxDrawdown < 15 ? 'text-accent-green' : 'text-accent-red'} />
                        <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)}
                          color={stats.profitFactor >= 1.5 ? 'text-accent-green' : stats.profitFactor >= 1 ? 'text-accent-yellow' : 'text-accent-red'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Trades */}
              {activeTab === 'trades' && (
                <div className="card">
                  <div className="card-header mb-2">
                    Trades simulados
                    <span className="ml-2 text-gray-500 font-normal text-xs">{result.trades.length} operaciones</span>
                  </div>
                  <div className="overflow-y-auto max-h-96">
                    <table className="w-full text-xs font-mono">
                      <thead className="text-gray-500 border-b border-bg-subtle sticky top-0 bg-bg-panel">
                        <tr className="text-left">
                          <th className="py-1.5 pr-2">Entrada</th>
                          <th className="py-1.5 pr-2">Salida</th>
                          <th className="py-1.5 pr-2">Estrategia</th>
                          <th className="py-1.5 pr-2">Dir</th>
                          <th className="py-1.5 pr-2">Entry</th>
                          <th className="py-1.5 pr-2">Exit</th>
                          <th className="py-1.5 pr-2">PnL %</th>
                          <th className="py-1.5">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t, i) => (
                          <tr key={i} className="border-b border-bg-subtle/40 hover:bg-bg-subtle/20">
                            <td className="py-1 pr-2 text-gray-400">{fmt(t.entryTime)}</td>
                            <td className="py-1 pr-2 text-gray-400">{t.exitTime ? fmt(t.exitTime) : '—'}</td>
                            <td className="py-1 pr-2 text-gray-300">{t.strategy}</td>
                            <td className="py-1 pr-2">
                              <span className={\`pill \${t.direction === 'BUY' ? 'pill-green' : 'pill-red'}\`}>{t.direction}</span>
                            </td>
                            <td className="py-1 pr-2">{t.entryPrice.toFixed(2)}</td>
                            <td className="py-1 pr-2">{t.exitPrice?.toFixed(2) ?? '—'}</td>
                            <td className={\`py-1 pr-2 \${t.pnlPct && t.pnlPct > 0 ? 'text-accent-green' : t.pnlPct && t.pnlPct < 0 ? 'text-accent-red' : 'text-gray-400'}\`}>
                              {t.pnlPct !== null ? (t.pnlPct > 0 ? '+' : '') + t.pnlPct + '%' : '—'}
                            </td>
                            <td className="py-1">
                              <span className={\`pill \${t.result === 'win' ? 'pill-green' : t.result === 'loss' ? 'pill-red' : 'pill-blue'}\`}>
                                {t.result === 'win' ? '✓' : t.result === 'loss' ? '✗' : '...'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path.join(base, 'frontend\\src\\components\\BacktestPage.tsx'), backtestPage, 'utf8');
console.log('BacktestPage.tsx OK — length:', backtestPage.length);

// Patch App.tsx — agregar ruta al backtest
let app = fs.readFileSync(path.join(base, 'frontend\\src\\App.tsx'), 'utf8');
if (!app.includes('BacktestPage')) {
  app = app.replace(
    "import { useStore } from './store';",
    "import { useState } from 'react';\nimport { BacktestPage } from './components/BacktestPage';\nimport { useStore } from './store';"
  );
  // Reemplazar el import de useEffect si ya tiene useState
  app = app.replace("import { useEffect } from 'react';\nimport { useState } from 'react';", "import { useEffect, useState } from 'react';");
  app = app.replace("import { useState } from 'react';\nimport { useEffect } from 'react';", "import { useEffect, useState } from 'react';");

  app = app.replace(
    "export default function App() {",
    `export default function App() {
  const [page, setPage] = useState<'dashboard' | 'backtest'>('dashboard');
  if (page === 'backtest') return <BacktestPage onBack={() => setPage('dashboard')} />;`
  );

  // Agregar boton de backtest en el header area
  app = app.replace(
    "      <Header />",
    `      <Header onBacktest={() => setPage('backtest')} />`
  );

  fs.writeFileSync(path.join(base, 'frontend\\src\\App.tsx'), app, 'utf8');
  console.log('App.tsx OK — BacktestPage integrado');
} else {
  console.log('App.tsx — ya tenia BacktestPage');
}

// Patch Header — agregar boton de backtest
let header = fs.readFileSync(path.join(base, 'frontend\\src\\components\\Header.tsx'), 'utf8');
if (!header.includes('onBacktest') && !header.includes('Backtest')) {
  header = header.replace(
    "export function Header() {",
    "export function Header({ onBacktest }: { onBacktest?: () => void }) {"
  );
  // Agregar boton antes del switch Bot ON/OFF
  header = header.replace(
    "        {/* Switch Bot ON/OFF */}",
    `        {onBacktest && (
          <button onClick={onBacktest}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-accent-blue/30 text-accent-blue/70 hover:border-accent-blue hover:text-accent-blue transition-all mr-2"
            title="Abrir backtesting">
            📊 Backtest
          </button>
        )}
        {/* Switch Bot ON/OFF */}`
  );
  fs.writeFileSync(path.join(base, 'frontend\\src\\components\\Header.tsx'), header, 'utf8');
  console.log('Header.tsx OK — boton Backtest agregado');
} else {
  console.log('Header.tsx — ya tenia backtest o onBacktest');
}

console.log('\n✅ Backtest implementado. El backend recarga solo.');
