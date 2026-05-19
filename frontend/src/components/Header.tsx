import { Activity, Bot, ServerCog, Wifi, WifiOff } from 'lucide-react';
import { useStore } from '../store';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w', '1M'];

export function Header({ onBacktest }: { onBacktest?: () => void }) {
  const { botOffline, setBotOffline } = useStore();
  const { symbol, timeframe, setSymbol, setTimeframe, health, isConnected } = useStore();

  return (
    <header className="border-b border-bg-subtle bg-bg-panel px-6 py-3 flex items-center justify-between">
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
              <option key={s} value={s}>
                {s}
              </option>
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
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {onBacktest && (
          <button onClick={onBacktest}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-accent-blue/30 text-accent-blue/70 hover:border-accent-blue hover:text-accent-blue transition-all mr-2"
            title="Abrir backtesting">
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
          <Indicator
            label="DB"
            ok={!!health?.services.db}
            Icon={ServerCog}
          />
          <Indicator
            label="Binance"
            ok={!!health?.services.binance}
            Icon={Activity}
          />
          <Indicator
            label="WS"
            ok={isConnected}
            Icon={isConnected ? Wifi : WifiOff}
          />
        </div>
      </div>
    </header>
  );
}

function Indicator({
  label,
  ok,
  Icon,
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
