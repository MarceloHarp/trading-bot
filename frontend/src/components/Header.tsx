import { Activity, Bot, ServerCog, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useStore, ALL_STRATEGIES } from '../store';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT', 'LINKUSDT', 'XRPUSDT', 'DOGEUSDT', 'TRXUSDT'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w', '1M'];

export function Header({ onBacktest }: { onBacktest?: () => void }) {
  const { botOffline, setBotOffline } = useStore();
  const { symbol, timeframe, setSymbol, setTimeframe, health, isConnected } = useStore();
  const { activeStrategies, toggleStrategy, setAllStrategies } = useStore();
  const [hoveredStrategy, setHoveredStrategy] = useState<string | null>(null);

  const allActive = activeStrategies.length === ALL_STRATEGIES.length;

  return (
    <header className="border-b border-bg-subtle bg-bg-panel">
      {/* ── Fila principal ── */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-accent-blue" />
          <div>
            <h1 className="text-lg font-semibold">Trading Bot</h1>
            <p className="text-xs text-gray-500">
              {health?.config.autoExecute ? 'Auto execute ON' : 'Paper mode'} ·{' '}
              {health?.config.claudeValidation ? 'Claude validation ON' : 'No AI'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Symbol</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-bg-subtle border border-bg-subtle rounded px-2 py-1 text-sm"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-bg-subtle border border-bg-subtle rounded px-2 py-1 text-sm"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {onBacktest && (
            <button
              onClick={onBacktest}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-accent-blue/30 text-accent-blue/70 hover:border-accent-blue hover:text-accent-blue transition-all mr-2"
              title="Abrir backtesting"
            >
              📊 Backtest
            </button>
          )}

          {/* Switch Bot ON/OFF */}
          <div className="flex items-center gap-2 mr-2">
            <span className={`text-xs font-medium ${botOffline ? 'text-amber-400' : 'text-green-400'}`}>
              {botOffline ? '⏸ Bot OFF' : '▶ Bot ON'}
            </span>
            <button
              onClick={() => setBotOffline(!botOffline)}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
              style={{ backgroundColor: botOffline ? '#92400e' : '#065f46' }}
              title={botOffline ? 'Bot offline — solo muestra señales en el gráfico' : 'Bot online — ejecuta trades automáticamente'}
            >
              <span
                className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                style={{ transform: botOffline ? 'translateX(2px)' : 'translateX(18px)' }}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Indicator label="DB"      ok={!!health?.services.db}      Icon={ServerCog} />
            <Indicator label="Binance" ok={!!health?.services.binance} Icon={Activity} />
            <Indicator label="WS"      ok={isConnected}                Icon={isConnected ? Wifi : WifiOff} />
          </div>
        </div>
      </div>

      {/* ── Barra de estrategias ── */}
      <div className="px-6 py-2 border-t border-bg-subtle/50 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium shrink-0">Estrategias:</span>
        {/* Ordenadas de izq a der: más rentable → menos rentable (orden del array) */}
        {ALL_STRATEGIES.map((strat, idx) => {
          const active = activeStrategies.includes(strat.id);
          const isHovered = hoveredStrategy === strat.id;
          const rank = idx + 1; // posición 1=mejor
          return (
            <div key={strat.id} className="relative">
              <button
                onClick={() => toggleStrategy(strat.id)}
                onMouseEnter={() => setHoveredStrategy(strat.id)}
                onMouseLeave={() => setHoveredStrategy(null)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all select-none ${
                  active
                    ? 'border-transparent text-black'
                    : 'border-gray-700 text-gray-500 bg-transparent hover:border-gray-500'
                }`}
                style={active ? { backgroundColor: strat.color } : {}}
              >
                {/* Rank badge */}
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{
                    backgroundColor: active ? 'rgba(0,0,0,0.25)' : `${strat.color}33`,
                    color: active ? 'rgba(0,0,0,0.7)' : strat.color,
                  }}
                >
                  {rank}
                </span>
                {strat.label}
                {active && <span className="opacity-60 text-[10px]">✓</span>}
              </button>

              {/* Tooltip */}
              {isHovered && (
                <div
                  className="absolute top-full left-0 mt-2 z-50 w-64 rounded-lg border border-bg-subtle shadow-xl p-3 text-xs"
                  style={{ backgroundColor: '#1a1a2e', borderColor: strat.color + '55' }}
                >
                  {/* Header del tooltip */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="font-semibold text-sm" style={{ color: strat.color }}>
                      #{rank} {strat.label}
                    </span>
                    <span className="text-gray-400 text-[10px]">{strat.desc.split('—')[0].trim()}</span>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-2">
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase tracking-wide">Win Rate</span>
                      <span className="font-bold text-white text-sm">{strat.stats.winRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase tracking-wide">Profit Factor</span>
                      <span className="font-bold text-white text-sm">{strat.stats.profitFactor}x</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase tracking-wide">Mejor Timeframe</span>
                      <span
                        className="font-bold text-sm px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: strat.color + '22', color: strat.color }}
                      >
                        {strat.stats.bestTimeframe}
                      </span>
                    </div>
                  </div>

                  {/* Mejores pares */}
                  <div className="mb-2">
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wide mb-1">Mejores Pares</span>
                    <div className="flex flex-col gap-0.5">
                      {strat.stats.bestPairs.map((pair) => (
                        <span key={pair} className="text-gray-300 flex items-center gap-1">
                          <span style={{ color: strat.color }}>›</span> {pair}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Nota */}
                  <div className="pt-1.5 border-t border-white/10">
                    <span className="text-gray-500 italic">{strat.stats.note}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botones Todas / Ninguna */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setAllStrategies(ALL_STRATEGIES.map(s => s.id))}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              allActive ? 'text-gray-600 cursor-default' : 'text-gray-400 hover:text-gray-200'
            }`}
            disabled={allActive}
          >
            Todas
          </button>
          <span className="text-gray-700">|</span>
          <button
            onClick={() => {
              // Deja solo la primera activa (la más rentable)
              setAllStrategies([ALL_STRATEGIES[0].id]);
            }}
            className="px-2 py-0.5 rounded text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
          >
            Solo #1
          </button>
        </div>
      </div>
    </header>
  );
}

function Indicator({
  label, ok, Icon,
}: {
  label: string;
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
}) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={`w-4 h-4 ${ok ? 'text-accent-green' : 'text-accent-red'}`} />
      <span className={ok ? 'text-accent-green' : 'text-accent-red'}>{label}</span>
    </div>
  );
}
