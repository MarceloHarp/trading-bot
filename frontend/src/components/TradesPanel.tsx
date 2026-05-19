import { ArrowDownUp, ArrowUpDown, LineChart, Trash2, X, Square } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';
import type { Trade } from '../types';

type SortField = 'time' | 'pnl' | 'symbol' | 'direction';
type SortDir = 'asc' | 'desc';
type Filter = 'all' | 'open' | 'closed';

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}

async function deleteTrade(id: string): Promise<boolean> {
  const res = await fetch('/api/trades/' + id, { method: 'DELETE' });
  return res.ok;
}

async function deleteAllTrades(): Promise<boolean> {
  const res = await fetch('/api/trades', { method: 'DELETE' });
  return res.ok;
}

async function closeTradeManual(id: string): Promise<boolean> {
  const res = await fetch('/api/trades/' + id + '/close', { method: 'POST' });
  return res.ok;
}

async function closeAllOpenTrades(): Promise<boolean> {
  const res = await fetch('/api/trades/close-all', { method: 'POST' });
  return res.ok;
}

export function TradesPanel() {
  const { trades, refreshAll, setSelectedSignalId } = useStore();
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');
  const [filter, setFilter]       = useState<Filter>('all');
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [closing, setClosing]     = useState<string | null>(null);
  const [confirmAll, setConfirmAll]         = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = trades.filter(t => {
    if (filter === 'open')   return t.status === 'open';
    if (filter === 'closed') return t.status === 'closed';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    if (sortField === 'time')        { va = new Date(a.openedAt).getTime(); vb = new Date(b.openedAt).getTime(); }
    else if (sortField === 'pnl')    { va = a.pnl ?? 0; vb = b.pnl ?? 0; }
    else if (sortField === 'symbol') { va = a.symbol; vb = b.symbol; }
    else if (sortField === 'direction') { va = a.direction; vb = b.direction; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleRowClick = (signalId: string | null | undefined) => {
    if (signalId) setSelectedSignalId(signalId);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await deleteTrade(id);
    await refreshAll();
    setDeleting(null);
  };

  const handleClose = async (id: string) => {
    setClosing(id);
    await closeTradeManual(id);
    await refreshAll();
    setClosing(null);
  };

  const handleDeleteAll = async () => {
    setConfirmAll(false);
    await deleteAllTrades();
    await refreshAll();
  };

  const handleCloseAll = async () => {
    setConfirmCloseAll(false);
    await closeAllOpenTrades();
    await refreshAll();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className='w-3 h-3 text-gray-600 inline ml-0.5 cursor-pointer' />;
    return sortDir === 'desc'
      ? <ArrowDownUp className='w-3 h-3 text-accent-blue inline ml-0.5 cursor-pointer' />
      : <ArrowUpDown  className='w-3 h-3 text-accent-blue inline ml-0.5 cursor-pointer' />;
  };

  const openCount   = trades.filter(t => t.status === 'open').length;
  const closedCount = trades.filter(t => t.status === 'closed').length;

  return (
    <div className='card flex flex-col h-full'>
      <div className='card-header flex items-center gap-2 flex-wrap'>
        <LineChart className='w-4 h-4' />
        Trades
        <div className='flex items-center gap-1 ml-2'>
          {(['all','open','closed'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className='px-2 py-0.5 rounded text-[11px] font-medium border transition-all'
              style={filter === f
                ? { backgroundColor:'#3b82f622', borderColor:'#3b82f6', color:'#93c5fd' }
                : { borderColor:'#374151', color:'#6b7280', backgroundColor:'transparent' }}
            >
              {f === 'all' ? `Todo (${trades.length})` : f === 'open' ? `Abiertos (${openCount})` : `Cerrados (${closedCount})`}
            </button>
          ))}
        </div>

        <div className='ml-auto flex items-center gap-2'>
          {/* Cerrar todas las abiertas */}
          {confirmCloseAll ? (
            <div className='flex items-center gap-1'>
              <span className='text-[11px] text-amber-400'>¿Cerrar {openCount} abiertas?</span>
              <button onClick={handleCloseAll}
                className='px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30'>
                Sí
              </button>
              <button onClick={() => setConfirmCloseAll(false)}
                className='px-2 py-0.5 rounded text-[11px] font-medium bg-bg-subtle border border-bg-subtle text-gray-400'>
                No
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmCloseAll(true)}
              disabled={openCount === 0}
              className='flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-500/30 text-amber-400/70 hover:border-amber-500/60 hover:text-amber-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed'>
              <Square className='w-3 h-3' />
              Cerrar todo
            </button>
          )}

          {/* Borrar todas */}
          {confirmAll ? (
            <div className='flex items-center gap-1'>
              <span className='text-[11px] text-red-400'>¿Borrar todo?</span>
              <button onClick={handleDeleteAll}
                className='px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'>
                Sí
              </button>
              <button onClick={() => setConfirmAll(false)}
                className='px-2 py-0.5 rounded text-[11px] font-medium bg-bg-subtle border border-bg-subtle text-gray-400'>
                No
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmAll(true)}
              className='flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-red-500/30 text-red-400/70 hover:border-red-500/60 hover:text-red-400 transition-all'>
              <Trash2 className='w-3 h-3' />
              Borrar todo
            </button>
          )}

          <span className='text-gray-500 text-[11px]'>{sorted.length} trades</span>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto min-h-0'>
        {sorted.length === 0 && (
          <div className='text-sm text-gray-500 text-center py-8'>Sin trades</div>
        )}
        {sorted.length > 0 && (
          <table className='w-full text-xs'>
            <thead className='text-gray-500 border-b border-bg-subtle sticky top-0 bg-bg-panel z-10'>
              <tr className='text-left'>
                <th className='py-1.5 pr-1 w-4'></th>
                <th className='py-1.5 pr-2 whitespace-nowrap'>
                  <span className='cursor-pointer hover:text-gray-300' onClick={() => toggleSort('time')}>
                    Apertura <SortIcon field='time' />
                  </span>
                </th>
                <th className='py-1.5 pr-2'>Cierre</th>
                <th className='py-1.5 pr-2'>
                  <span className='cursor-pointer hover:text-gray-300' onClick={() => toggleSort('symbol')}>
                    Symbol <SortIcon field='symbol' />
                  </span>
                </th>
                <th className='py-1.5 pr-2'>
                  <span className='cursor-pointer hover:text-gray-300' onClick={() => toggleSort('direction')}>
                    Dir <SortIcon field='direction' />
                  </span>
                </th>
                <th className='py-1.5 pr-2'>Entry</th>
                <th className='py-1.5 pr-2'>Exit</th>
                <th className='py-1.5 pr-2'>
                  <span className='cursor-pointer hover:text-gray-300' onClick={() => toggleSort('pnl')}>
                    PnL <SortIcon field='pnl' />
                  </span>
                </th>
                <th className='py-1.5 pr-2'>Status</th>
                <th className='py-1.5 pr-2 text-center'>Cerrar</th>
              </tr>
            </thead>
            <tbody className='font-mono'>
              {sorted.map(t => (
                <TradeRow key={t.id} trade={t}
                  onDelete={() => handleDelete(t.id)}
                  onClose={() => handleClose(t.id)}
                  onRowClick={() => handleRowClick(t.signalId)}
                  isDeleting={deleting === t.id}
                  isClosing={closing === t.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TradeRow({ trade, onDelete, onClose, onRowClick, isDeleting, isClosing }: {
  trade: Trade;
  onDelete: () => void;
  onClose: () => void;
  onRowClick: () => void;
  isDeleting: boolean;
  isClosing: boolean;
}) {
  const [confirmDel, setConfirmDel]     = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const pnl = trade.pnl ?? 0;
  const pnlColor = pnl > 0 ? 'text-accent-green' : pnl < 0 ? 'text-accent-red' : 'text-gray-400';
  const isOpen = trade.status === 'open';

  let statusPill = 'pill-blue';
  let statusLabel = 'open';
  if (trade.status === 'closed') {
    if (trade.closedReason === 'target')      { statusPill = 'pill-green';  statusLabel = '🎯 target'; }
    else if (trade.closedReason === 'stop')   { statusPill = 'pill-red';    statusLabel = '🛑 stop'; }
    else if (trade.closedReason === 'manual') { statusPill = 'pill-yellow'; statusLabel = '✋ manual'; }
    else { statusPill = 'pill-yellow'; statusLabel = trade.closedReason ?? 'closed'; }
  }

  return (
    <tr
      className={'border-b border-bg-subtle/50 hover:bg-bg-subtle/30 cursor-pointer ' + ((isDeleting || isClosing) ? 'opacity-40' : '')}
      onClick={onRowClick}
      title="Ver signal asociado"
    >
      {/* Boton borrar */}
      <td className='py-1.5 pr-1'>
        {confirmDel ? (
          <div className='flex items-center gap-0.5'>
            <button onClick={() => { setConfirmDel(false); onDelete(); }}
              className='text-red-400 hover:text-red-300 text-[10px] font-bold px-1 bg-red-500/10 rounded'>✓</button>
            <button onClick={() => setConfirmDel(false)} className='text-gray-500 hover:text-gray-300'>
              <X className='w-3 h-3' />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)}
            className='text-gray-600 hover:text-red-400 transition-colors'
            title='Borrar este trade'>
            <X className='w-3.5 h-3.5' />
          </button>
        )}
      </td>

      <td className='py-1.5 pr-2 text-gray-400 whitespace-nowrap'>{fmt(trade.openedAt)}</td>
      <td className='py-1.5 pr-2 text-gray-400 whitespace-nowrap'>{fmt(trade.closedAt)}</td>
      <td className='py-1.5 pr-2'>{trade.symbol}</td>
      <td className='py-1.5 pr-2'>
        <span className={`pill ${trade.direction === 'BUY' ? 'pill-green' : 'pill-red'}`}>
          {trade.direction}
        </span>
      </td>
      <td className='py-1.5 pr-2'>{trade.entryPrice.toFixed(2)}</td>
      <td className='py-1.5 pr-2'>{trade.exitPrice?.toFixed(2) ?? '—'}</td>
      <td className={`py-1.5 pr-2 ${pnlColor}`}>
        {trade.pnl !== null && trade.pnl !== undefined
          ? `${pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)`
          : '—'}
      </td>
      <td className='py-1.5 pr-2'>
        <span className={`pill ${statusPill}`}>{statusLabel}</span>
      </td>

      {/* Boton cerrar manualmente */}
      <td className='py-1.5 pr-2 text-center'>
        {!isOpen ? (
          <span className='text-gray-700'>—</span>
        ) : confirmClose ? (
          <div className='flex items-center justify-center gap-0.5'>
            <button onClick={() => { setConfirmClose(false); onClose(); }}
              className='text-amber-400 hover:text-amber-300 text-[10px] font-bold px-1 bg-amber-500/10 rounded'>✓</button>
            <button onClick={() => setConfirmClose(false)} className='text-gray-500 hover:text-gray-300'>
              <X className='w-3 h-3' />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmClose(true)}
            className='flex items-center gap-0.5 mx-auto px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-500/30 text-amber-400/70 hover:border-amber-500 hover:text-amber-400 transition-all'
            title='Cerrar esta posicion al precio actual'>
            <Square className='w-3 h-3' />
            Cerrar
          </button>
        )}
      </td>
    </tr>
  );
}
