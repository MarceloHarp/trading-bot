import { LineChart } from 'lucide-react';
import { useStore } from '../store';
import type { Trade } from '../types';

export function TradesPanel() {
  const trades = useStore((s) => s.trades);

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header flex items-center gap-2">
        <LineChart className="w-4 h-4" />
        Trades
        <span className="ml-auto text-gray-500 normal-case font-normal">
          {trades.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {trades.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-8">Sin trades aún</div>
        )}
        <table className="w-full text-xs">
          <thead className="text-gray-500 border-b border-bg-subtle">
            <tr className="text-left">
              <th className="py-1 pr-2">Symbol</th>
              <th className="py-1 pr-2">Dir</th>
              <th className="py-1 pr-2">Entry</th>
              <th className="py-1 pr-2">Exit</th>
              <th className="py-1 pr-2">PnL</th>
              <th className="py-1 pr-2">Status</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {trades.map((t) => (
              <TradeRow key={t.id} trade={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const pnl = trade.pnl ?? 0;
  const pnlColor = pnl > 0 ? 'text-accent-green' : pnl < 0 ? 'text-accent-red' : 'text-gray-400';

  return (
    <tr className="border-b border-bg-subtle/50 hover:bg-bg-subtle/30">
      <td className="py-1.5 pr-2">{trade.symbol}</td>
      <td className="py-1.5 pr-2">
        <span
          className={`pill ${trade.direction === 'BUY' ? 'pill-green' : 'pill-red'}`}
        >
          {trade.direction}
        </span>
      </td>
      <td className="py-1.5 pr-2">{trade.entryPrice.toFixed(2)}</td>
      <td className="py-1.5 pr-2">{trade.exitPrice?.toFixed(2) ?? '—'}</td>
      <td className={`py-1.5 pr-2 ${pnlColor}`}>
        {trade.pnl !== null && trade.pnl !== undefined
          ? `${trade.pnl.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)`
          : '—'}
      </td>
      <td className="py-1.5 pr-2">
        <span
          className={`pill ${
            trade.status === 'open'
              ? 'pill-blue'
              : trade.closedReason === 'target'
                ? 'pill-green'
                : 'pill-red'
          }`}
        >
          {trade.status === 'open' ? 'open' : trade.closedReason}
        </span>
      </td>
    </tr>
  );
}
