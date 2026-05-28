import { Clock, DollarSign, Gauge, Percent, Target, TrendingUp, Zap } from 'lucide-react';
import { useStore } from '../store';

export function StatsPanel() {
  const stats = useStore((s) => s.stats);
  const trades = useStore((s) => s.trades);
  const rl = stats?.rateLimit;

  // GridBot stats
  const gridTrades = trades.filter(t => t.strategy === 'GridBot');
  const gridOpen = gridTrades.filter(t => t.status === 'open').length;
  const gridClosed = gridTrades.filter(t => t.status === 'closed');
  const gridPnl = gridClosed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const gridWins = gridClosed.filter(t => (t.pnl ?? 0) > 0).length;
  const gridWinRate = gridClosed.length > 0 ? (gridWins / gridClosed.length) * 100 : 0;

  return (
    <div className='card'>
      <div className='card-header'>Performance</div>
      <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
        <Stat label='Total PnL' value={(stats?.trades.totalPnl?.toFixed(2) ?? '0.00') + ' USDT'}
          icon={<DollarSign className='w-4 h-4' />} accent={(stats?.trades.totalPnl ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'} />
        <Stat label='Win Rate' value={(stats?.trades.winRate?.toFixed(1) ?? '0') + '%'}
          icon={<Percent className='w-4 h-4' />} accent='text-accent-blue' />
        <Stat label='Trades' value={(stats?.trades.closed ?? 0) + ' cerrados / ' + (stats?.trades.open ?? 0) + ' abiertos'}
          icon={<TrendingUp className='w-4 h-4' />} accent='text-gray-200' />
        <Stat label='Signals' value={(stats?.signals.approved ?? 0) + ' ok / ' + (stats?.signals.rejected ?? 0) + ' rej'}
          icon={<Target className='w-4 h-4' />} accent='text-gray-200' />
        <div className='bg-bg-subtle/40 rounded p-3'>
          <div className='text-xs text-gray-500 flex items-center gap-1 mb-2'>
            <Gauge className='w-4 h-4' />Rate limit
          </div>
          {!rl || (rl.maxPerHour === 0 && rl.maxPerDay === 0) ? (
            <div className='text-sm text-gray-400'>Sin limite</div>
          ) : (
            <div className='space-y-2'>
              <RateBar label='Hora' used={rl.signalsLastHour} max={rl.maxPerHour} />
              {(rl as any).maxOpenTrades > 0 && <RateBar label='Pos.' used={(rl as any).openTrades ?? 0} max={(rl as any).maxOpenTrades} />}
              <RateBar label='Dia' used={rl.signalsLastDay} max={rl.maxPerDay} />
              {rl.isLimited && <div className='text-[10px] text-accent-yellow font-medium'>Bot pausado</div>}
            </div>
          )}
        </div>
      </div>

      {/* ── GridBot section ── */}
      <div className='mt-3 rounded p-3' style={{ backgroundColor: '#92400e18', border: '1px solid #d9770630' }}>
        <div className='flex items-center gap-1.5 mb-2 text-xs font-medium' style={{ color: '#fbbf24' }}>
          <Zap className='w-3.5 h-3.5' />
          GridBot ETHUSDT — $1,800–$2,400 | 12 niveles | $50 spacing
        </div>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
          <div className='rounded p-2' style={{ backgroundColor: '#92400e22' }}>
            <div className='text-[11px] text-amber-600/80'>PnL Grid</div>
            <div className={'text-sm font-semibold font-mono ' + (gridPnl >= 0 ? 'text-accent-green' : 'text-accent-red')}>
              {gridPnl >= 0 ? '+' : ''}{gridPnl.toFixed(2)} USDT
            </div>
          </div>
          <div className='rounded p-2' style={{ backgroundColor: '#92400e22' }}>
            <div className='text-[11px] text-amber-600/80'>Ciclos</div>
            <div className='text-sm font-semibold font-mono text-amber-300'>
              {gridClosed.length} cerrados / {gridOpen} abiertos
            </div>
          </div>
          <div className='rounded p-2' style={{ backgroundColor: '#92400e22' }}>
            <div className='text-[11px] text-amber-600/80'>Win Rate Grid</div>
            <div className='text-sm font-semibold font-mono text-amber-300'>
              {gridWinRate.toFixed(1)}%
            </div>
          </div>
          <div className='rounded p-2' style={{ backgroundColor: '#92400e22' }}>
            <div className='text-[11px] text-amber-600/80'>Niveles activos</div>
            <div className='text-sm font-semibold font-mono text-amber-300'>
              {gridOpen} / 12
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RateBar({ label, used, max }: { label: string; used: number; max: number }) {
  if (max === 0) return <div className='text-[11px] text-gray-500'>{label}: {used} (sin limite)</div>;
  const pct = Math.min(100, (used / max) * 100);
  const color = pct >= 100 ? 'bg-accent-red' : pct >= 75 ? 'bg-accent-yellow' : 'bg-accent-green';
  return (
    <div>
      <div className='text-[11px] text-gray-400 flex justify-between mb-0.5'>
        <span className='flex items-center gap-1'><Clock className='w-3 h-3'/>{label}</span>
        <span className={used >= max ? 'text-accent-red' : 'text-gray-300'}>{used}/{max}</span>
      </div>
      <div className='h-1 bg-bg-subtle rounded-full overflow-hidden'>
        <div className={'h-full ' + color + ' transition-all'} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className='bg-bg-subtle/40 rounded p-3'>
      <div className='text-xs text-gray-500 flex items-center gap-1'>{icon}{label}</div>
      <div className={'text-base font-semibold font-mono ' + accent}>{value}</div>
    </div>
  );
}