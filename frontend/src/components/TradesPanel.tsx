import { Archive, ArrowDownUp, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, LineChart, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { apiService } from '../services/api';
import type { Trade, LivePnl } from '../types';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
type SortField = 'time' | 'pnl' | 'symbol' | 'direction';
type SortDir   = 'asc' | 'desc';
type Filter    = 'all' | 'open' | 'closed';
type ArchiveFilter = 'all' | 'win' | 'loss';
type ArchiveSortField = 'date' | 'pnl';

const ARCHIVE_KEY = 'archivedTrades_v2';

function loadArchived(): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')); }
  catch { return new Set<string>(); }
}
function saveArchived(ids: Set<string>) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...ids]));
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

async function deleteTrade(id: string)     { await fetch('/api/trades/' + id, { method: 'DELETE' }); }
async function deleteAllTrades()            { await fetch('/api/trades', { method: 'DELETE' }); }
async function closeTradeManual(id: string) { await fetch('/api/trades/' + id + '/close', { method: 'POST' }); }
async function closeAllOpenTrades()         { await fetch('/api/trades/close-all', { method: 'POST' }); }

/* ─── main component ──────────────────────────────────────────────────────── */
export function TradesPanel({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { trades, refreshAll, setSelectedSignalId } = useStore();

  // sort / filter — main table
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [filter,    setFilter]    = useState<Filter>('all');

  // bulk actions
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [closing,   setClosing]   = useState<string | null>(null);
  const [confirmAll,       setConfirmAll]       = useState(false);
  const [confirmCloseAll,  setConfirmCloseAll]  = useState(false);

  // archive state
  const [archived,      setArchived]      = useState<Set<string>>(loadArchived);
  const [showArchived,  setShowArchived]  = useState(false);
  const [archFilter,    setArchFilter]    = useState<ArchiveFilter>('all');
  const [archSortField, setArchSortField] = useState<ArchiveSortField>('date');
  const [archSortDir,   setArchSortDir]   = useState<SortDir>('desc');

  // live PnL
  const [livePnl, setLivePnl] = useState<Map<string, LivePnl>>(new Map());
  const livePnlRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await apiService.getLivePnl();
        setLivePnl(new Map(data.map(p => [p.id, p])));
      } catch { /* silencioso */ }
    };
    fetchLive();
    livePnlRef.current = setInterval(fetchLive, 10_000);
    return () => { if (livePnlRef.current) clearInterval(livePnlRef.current); };
  }, []);

  /* sort / filter helpers */
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const applySortFilter = (list: Trade[], sf: SortField, sd: SortDir, f: Filter) =>
    [...list]
      .filter(t => {
        if (archived.has(t.id)) return false;       // ocultar archivados del main
        if (f === 'open')   return t.status === 'open';
        if (f === 'closed') return t.status === 'closed';
        return true;
      })
      .sort((a, b) => {
        let va: number | string = 0, vb: number | string = 0;
        if (sf === 'time')      { va = new Date(a.openedAt).getTime(); vb = new Date(b.openedAt).getTime(); }
        else if (sf === 'pnl') { va = a.pnl ?? 0; vb = b.pnl ?? 0; }
        else if (sf === 'symbol')    { va = a.symbol;    vb = b.symbol; }
        else if (sf === 'direction') { va = a.direction; vb = b.direction; }
        if (va < vb) return sd === 'asc' ? -1 : 1;
        if (va > vb) return sd === 'asc' ? 1 : -1;
        return 0;
      });

  const sorted = applySortFilter(trades, sortField, sortDir, filter);

  /* archive helpers */
  const archiveTrades = (ids: Set<string>) => {
    const next = new Set([...archived, ...ids]);
    setArchived(next);
    saveArchived(next);
    setSelected(new Set());
  };

  const unarchive = (id: string) => {
    const next = new Set(archived);
    next.delete(id);
    setArchived(next);
    saveArchived(next);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sorted.length && sorted.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map(t => t.id)));
    }
  };

  /* archived table */
  const archivedTrades = trades
    .filter(t => archived.has(t.id))
    .filter(t => {
      if (archFilter === 'win')  return (t.pnl ?? 0) > 0;
      if (archFilter === 'loss') return (t.pnl ?? 0) <= 0;
      return true;
    })
    .sort((a, b) => {
      const field = archSortField;
      let va: number, vb: number;
      if (field === 'pnl') { va = a.pnl ?? 0; vb = b.pnl ?? 0; }
      else { va = new Date(a.openedAt).getTime(); vb = new Date(b.openedAt).getTime(); }
      if (va < vb) return archSortDir === 'asc' ? -1 : 1;
      if (va > vb) return archSortDir === 'asc' ? 1 : -1;
      return 0;
    });

  /* delete / close */
  const handleDelete    = async (id: string) => { setDeleting(id); await deleteTrade(id); await refreshAll(); setDeleting(null); };
  const handleClose     = async (id: string) => { setClosing(id);  await closeTradeManual(id); await refreshAll(); setClosing(null); };
  const handleDeleteAll = async () => { setConfirmAll(false); await deleteAllTrades(); await refreshAll(); };
  const handleCloseAll  = async () => { setConfirmCloseAll(false); await closeAllOpenTrades(); await refreshAll(); };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className='w-3 h-3 text-gray-600 inline ml-0.5 cursor-pointer' />;
    return sortDir === 'desc'
      ? <ArrowDownUp className='w-3 h-3 text-accent-blue inline ml-0.5 cursor-pointer' />
      : <ArrowUpDown  className='w-3 h-3 text-accent-blue inline ml-0.5 cursor-pointer' />;
  };

  const openCount   = trades.filter(t => !archived.has(t.id) && t.status === 'open').length;
  const closedCount = trades.filter(t => !archived.has(t.id) && t.status === 'closed').length;
  const allActive   = selected.size === sorted.length && sorted.length > 0;

  /* ── Collapsed: solo header ── */
  if (collapsed) {
    return (
      <div className='card'>
        <div className='card-header flex items-center gap-2'>
          <LineChart className='w-4 h-4' />
          <span className='font-semibold'>Trades</span>
          <span className='text-gray-500 text-[11px]'>{trades.length} operaciones</span>
          <button
            onClick={onToggleCollapse}
            title='Expandir Trades'
            className='ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-bg-subtle text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-all'
          >
            <ChevronUp className='w-3.5 h-3.5' /> Expandir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='card flex flex-col h-full overflow-hidden'>
      {/* ── Header ── */}
      <div className='card-header flex items-center gap-2 flex-wrap shrink-0'>
        <LineChart className='w-4 h-4' />
        Trades

        <div className='flex items-center gap-1 ml-2'>
          {(['all', 'open', 'closed'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className='px-2 py-0.5 rounded text-[11px] font-medium border transition-all'
              style={filter === f
                ? { backgroundColor: '#3b82f622', borderColor: '#3b82f6', color: '#93c5fd' }
                : { borderColor: '#374151', color: '#6b7280', backgroundColor: 'transparent' }}>
              {f === 'all' ? `Todo (${sorted.length})` : f === 'open' ? `Abiertos (${openCount})` : `Cerrados (${closedCount})`}
            </button>
          ))}
        </div>

        <div className='ml-auto flex items-center gap-2 flex-wrap'>
          {/* Archive selected */}
          {selected.size > 0 && (
            <button
              onClick={() => archiveTrades(selected)}
              className='flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-500/50 text-purple-400 hover:border-purple-400 hover:text-purple-300 transition-all'>
              <Archive className='w-3 h-3' />
              Archivar ({selected.size})
            </button>
          )}

          {/* Cerrar todas abiertas */}
          {confirmCloseAll ? (
            <div className='flex items-center gap-1'>
              <span className='text-[11px] text-amber-400'>¿Cerrar {openCount}?</span>
              <button onClick={handleCloseAll} className='px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 border border-amber-500/50 text-amber-400'>Sí</button>
              <button onClick={() => setConfirmCloseAll(false)} className='px-2 py-0.5 rounded text-[11px] border border-bg-subtle text-gray-400'>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmCloseAll(true)} disabled={openCount === 0}
              className='flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-500/30 text-amber-400/70 hover:border-amber-500/60 hover:text-amber-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed'>
              <Square className='w-3 h-3' /> Cerrar todo
            </button>
          )}

          {/* Borrar todas */}
          {confirmAll ? (
            <div className='flex items-center gap-1'>
              <span className='text-[11px] text-red-400'>¿Borrar todo?</span>
              <button onClick={handleDeleteAll} className='px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/20 border border-red-500/50 text-red-400'>Sí</button>
              <button onClick={() => setConfirmAll(false)} className='px-2 py-0.5 rounded text-[11px] border border-bg-subtle text-gray-400'>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmAll(true)}
              className='flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-red-500/30 text-red-400/70 hover:border-red-500/60 hover:text-red-400 transition-all'>
              <Trash2 className='w-3 h-3' /> Borrar todo
            </button>
          )}

          <span className='text-gray-500 text-[11px]'>{sorted.length} trades</span>

          {/* Colapsar */}
          <button
            onClick={onToggleCollapse}
            title='Colapsar Trades (agrandar gráfico)'
            className='flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-bg-subtle text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-all'
          >
            <ChevronDown className='w-3.5 h-3.5' />
          </button>
        </div>
      </div>

      {/* ── Main table ── */}
      <div className='flex-1 overflow-y-auto min-h-0'>
        {sorted.length === 0 && (
          <div className='text-sm text-gray-500 text-center py-8'>Sin trades activos</div>
        )}
        {sorted.length > 0 && (
          <table className='w-full text-xs'>
            <thead className='text-gray-500 border-b border-bg-subtle sticky top-0 bg-bg-panel z-10'>
              <tr className='text-left'>
                {/* Checkbox select-all */}
                <th className='py-1.5 pr-1 w-5'>
                  <input
                    type='checkbox'
                    checked={allActive}
                    onChange={toggleSelectAll}
                    className='w-3 h-3 accent-purple-500 cursor-pointer'
                    title='Seleccionar todo'
                  />
                </th>
                <th className='py-1.5 pr-1 w-4'></th>
                <th className='py-1.5 pr-2 whitespace-nowrap cursor-pointer hover:text-gray-300' onClick={() => toggleSort('time')}>
                  Apertura <SortIcon field='time' />
                </th>
                <th className='py-1.5 pr-2'>Cierre</th>
                <th className='py-1.5 pr-2 cursor-pointer hover:text-gray-300' onClick={() => toggleSort('symbol')}>
                  Symbol <SortIcon field='symbol' />
                </th>
                <th className='py-1.5 pr-2 cursor-pointer hover:text-gray-300' onClick={() => toggleSort('direction')}>
                  Dir <SortIcon field='direction' />
                </th>
                <th className='py-1.5 pr-2'>Entry</th>
                <th className='py-1.5 pr-2'>Exit / Actual</th>
                <th className='py-1.5 pr-2 cursor-pointer hover:text-gray-300' onClick={() => toggleSort('pnl')}>
                  PnL <SortIcon field='pnl' />
                </th>
                <th className='py-1.5 pr-2'>Status</th>
                <th className='py-1.5 pr-2 text-center'>Cerrar</th>
              </tr>
            </thead>
            <tbody className='font-mono'>
              {sorted.map(t => (
                <TradeRow
                  key={t.id}
                  trade={t}
                  isSelected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  onDelete={() => handleDelete(t.id)}
                  onClose={() => handleClose(t.id)}
                  onRowClick={() => { if (t.signalId) setSelectedSignalId(t.signalId); }}
                  onArchive={() => archiveTrades(new Set([t.id]))}
                  isDeleting={deleting === t.id}
                  isClosing={closing === t.id}
                  liveData={livePnl.get(t.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Archivados ── */}
      <div className='shrink-0 border-t border-bg-subtle/60'>
        {/* Cabecera archivados */}
        <div className='flex items-center gap-2 px-3 py-2 flex-wrap'>
          <button
            onClick={() => setShowArchived(v => !v)}
            className='flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors'>
            {showArchived
              ? <ChevronDown className='w-3.5 h-3.5 text-purple-400' />
              : <ChevronRight className='w-3.5 h-3.5 text-purple-400' />}
            <Archive className='w-3.5 h-3.5 text-purple-400' />
            <span className='text-purple-400'>Archivados</span>
            <span className='text-gray-600'>({archived.size})</span>
          </button>

          {showArchived && (
            <>
              {/* Filtros */}
              <div className='flex items-center gap-1 ml-2'>
                {(['all', 'win', 'loss'] as ArchiveFilter[]).map(f => (
                  <button key={f} onClick={() => setArchFilter(f)}
                    className='px-2 py-0.5 rounded text-[11px] border transition-all'
                    style={archFilter === f
                      ? { backgroundColor: '#a855f722', borderColor: '#a855f7', color: '#d8b4fe' }
                      : { borderColor: '#374151', color: '#6b7280', backgroundColor: 'transparent' }}>
                    {f === 'all' ? `Todos (${archivedTrades.length})` : f === 'win' ? '🟢 Ganadores' : '🔴 Perdedores'}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className='flex items-center gap-1 ml-1'>
                <button
                  onClick={() => {
                    if (archSortField === 'date') setArchSortDir(d => d === 'desc' ? 'asc' : 'desc');
                    else { setArchSortField('date'); setArchSortDir('desc'); }
                  }}
                  className='flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] border transition-all'
                  style={archSortField === 'date'
                    ? { borderColor: '#6b7280', color: '#d1d5db', backgroundColor: '#374151' }
                    : { borderColor: '#374151', color: '#6b7280', backgroundColor: 'transparent' }}>
                  Fecha {archSortField === 'date' ? (archSortDir === 'desc' ? '↓' : '↑') : ''}
                </button>
                <button
                  onClick={() => {
                    if (archSortField === 'pnl') setArchSortDir(d => d === 'desc' ? 'asc' : 'desc');
                    else { setArchSortField('pnl'); setArchSortDir('desc'); }
                  }}
                  className='flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] border transition-all'
                  style={archSortField === 'pnl'
                    ? { borderColor: '#6b7280', color: '#d1d5db', backgroundColor: '#374151' }
                    : { borderColor: '#374151', color: '#6b7280', backgroundColor: 'transparent' }}>
                  PnL {archSortField === 'pnl' ? (archSortDir === 'desc' ? '↓' : '↑') : ''}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Tabla archivados */}
        {showArchived && (
          <div className='max-h-56 overflow-y-auto'>
            {archivedTrades.length === 0 ? (
              <div className='text-xs text-gray-600 text-center py-4'>Sin trades archivados</div>
            ) : (
              <table className='w-full text-xs'>
                <thead className='text-gray-600 border-b border-bg-subtle/50 sticky top-0 bg-bg-panel z-10'>
                  <tr className='text-left'>
                    <th className='py-1 pr-2 pl-3 whitespace-nowrap'>Apertura</th>
                    <th className='py-1 pr-2'>Cierre</th>
                    <th className='py-1 pr-2'>Symbol</th>
                    <th className='py-1 pr-2'>Dir</th>
                    <th className='py-1 pr-2'>Entry</th>
                    <th className='py-1 pr-2'>Exit</th>
                    <th className='py-1 pr-2'>PnL</th>
                    <th className='py-1 pr-2'>Status</th>
                    <th className='py-1 pr-2 text-center'>Restaurar</th>
                  </tr>
                </thead>
                <tbody className='font-mono'>
                  {archivedTrades.map(t => {
                    const pnl = t.pnl ?? 0;
                    const pnlColor = pnl > 0 ? 'text-accent-green' : pnl < 0 ? 'text-accent-red' : 'text-gray-400';
                    let statusLabel = t.status;
                    if (t.closedReason === 'target') statusLabel = '🎯 target';
                    else if (t.closedReason === 'stop') statusLabel = '🛑 stop';
                    else if (t.closedReason === 'manual') statusLabel = '✋ manual';
                    return (
                      <tr key={t.id} className='border-b border-bg-subtle/30 hover:bg-bg-subtle/20 opacity-70 hover:opacity-100 transition-opacity'>
                        <td className='py-1 pr-2 pl-3 text-gray-500 whitespace-nowrap'>{fmt(t.openedAt)}</td>
                        <td className='py-1 pr-2 text-gray-500 whitespace-nowrap'>{fmt(t.closedAt)}</td>
                        <td className='py-1 pr-2 text-gray-300'>{t.symbol}</td>
                        <td className='py-1 pr-2'>
                          <span className={`pill ${t.direction === 'BUY' ? 'pill-green' : 'pill-red'}`}>{t.direction}</span>
                        </td>
                        <td className='py-1 pr-2 text-gray-400'>{t.entryPrice.toFixed(2)}</td>
                        <td className='py-1 pr-2 text-gray-400'>{t.exitPrice?.toFixed(2) ?? '—'}</td>
                        <td className={`py-1 pr-2 ${pnlColor}`}>
                          {t.pnl !== null && t.pnl !== undefined
                            ? `${pnl > 0 ? '+' : ''}${t.pnl.toFixed(2)} (${t.pnlPercent?.toFixed(1)}%)`
                            : '—'}
                        </td>
                        <td className='py-1 pr-2 text-gray-500 text-[10px]'>{statusLabel}</td>
                        <td className='py-1 pr-2 text-center'>
                          <button
                            onClick={() => unarchive(t.id)}
                            className='flex items-center gap-0.5 mx-auto px-1.5 py-0.5 rounded text-[10px] border border-purple-500/30 text-purple-400/70 hover:border-purple-400 hover:text-purple-300 transition-all'
                            title='Restaurar al panel principal'>
                            <RotateCcw className='w-2.5 h-2.5' />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── TradeRow ────────────────────────────────────────────────────────────── */
function TradeRow({ trade, isSelected, onToggleSelect, onDelete, onClose, onRowClick, onArchive, isDeleting, isClosing, liveData }: {
  trade: Trade;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRowClick: () => void;
  onArchive: () => void;
  isDeleting: boolean;
  isClosing: boolean;
  liveData?: LivePnl;
}) {
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const pnl = trade.pnl ?? 0;
  const pnlColor = pnl > 0 ? 'text-accent-green' : pnl < 0 ? 'text-accent-red' : 'text-gray-400';
  const isOpen = trade.status === 'open';

  let statusPill = 'pill-blue', statusLabel = 'open';
  if (trade.status === 'closed') {
    if (trade.closedReason === 'target')      { statusPill = 'pill-green';  statusLabel = '🎯 target'; }
    else if (trade.closedReason === 'stop')   { statusPill = 'pill-red';    statusLabel = '🛑 stop'; }
    else if (trade.closedReason === 'manual') { statusPill = 'pill-yellow'; statusLabel = '✋ manual'; }
    else { statusPill = 'pill-yellow'; statusLabel = trade.closedReason ?? 'closed'; }
  }

  return (
    <tr
      className={'border-b border-bg-subtle/50 hover:bg-bg-subtle/30 cursor-pointer ' +
        ((isDeleting || isClosing) ? 'opacity-40' : '') +
        (isSelected ? ' bg-purple-500/5' : '')}
      onClick={onRowClick}
      title='Ver signal asociado'
    >
      {/* Checkbox */}
      <td className='py-1.5 pr-1' onClick={e => { e.stopPropagation(); onToggleSelect(); }}>
        <input
          type='checkbox'
          checked={isSelected}
          onChange={onToggleSelect}
          className='w-3 h-3 accent-purple-500 cursor-pointer'
          onClick={e => e.stopPropagation()}
        />
      </td>

      {/* Delete */}
      <td className='py-1.5 pr-1' onClick={e => e.stopPropagation()}>
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
            className='text-gray-600 hover:text-red-400 transition-colors' title='Borrar'>
            <X className='w-3.5 h-3.5' />
          </button>
        )}
      </td>

      <td className='py-1.5 pr-2 text-gray-400 whitespace-nowrap'>{fmt(trade.openedAt)}</td>
      <td className='py-1.5 pr-2 text-gray-400 whitespace-nowrap'>{fmt(trade.closedAt)}</td>
      <td className='py-1.5 pr-2'>{trade.symbol}</td>
      <td className='py-1.5 pr-2'>
        <span className={`pill ${trade.direction === 'BUY' ? 'pill-green' : 'pill-red'}`}>{trade.direction}</span>
      </td>
      <td className='py-1.5 pr-2'>{trade.entryPrice.toFixed(2)}</td>
      <td className='py-1.5 pr-2'>
        {isOpen && liveData
          ? <span className='text-gray-300'>{liveData.currentPrice.toFixed(2)}</span>
          : (trade.exitPrice?.toFixed(2) ?? '—')}
      </td>
      <td className='py-1.5 pr-2'>
        {isOpen && liveData ? (
          <div className='flex flex-col gap-0.5'>
            <span className={liveData.unrealizedPct >= 0 ? 'text-accent-green' : 'text-accent-red'}>
              {liveData.unrealizedPct >= 0 ? '+' : ''}{liveData.unrealizedPct.toFixed(2)}%
              {' '}({liveData.unrealizedUsdt >= 0 ? '+' : ''}{liveData.unrealizedUsdt.toFixed(2)}$)
            </span>
            <span className='text-[10px] text-gray-500'>
              SL {liveData.distToSL != null ? `${liveData.distToSL.toFixed(1)}%` : '—'}
              {' · '}TP {liveData.distToTP != null ? `${liveData.distToTP.toFixed(1)}%` : '—'}
            </span>
          </div>
        ) : (
          <span className={pnlColor}>
            {trade.pnl !== null && trade.pnl !== undefined
              ? `${pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%)`
              : '—'}
          </span>
        )}
      </td>
      <td className='py-1.5 pr-2'>
        <span className={`pill ${statusPill}`}>{statusLabel}</span>
      </td>

      {/* Cerrar / Archive */}
      <td className='py-1.5 pr-2 text-center' onClick={e => e.stopPropagation()}>
        {isOpen ? (
          confirmClose ? (
            <div className='flex items-center justify-center gap-0.5'>
              <button onClick={() => { setConfirmClose(false); onClose(); }}
                className='text-amber-400 text-[10px] font-bold px-1 bg-amber-500/10 rounded'>✓</button>
              <button onClick={() => setConfirmClose(false)} className='text-gray-500'>
                <X className='w-3 h-3' />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmClose(true)}
              className='flex items-center gap-0.5 mx-auto px-1.5 py-0.5 rounded text-[10px] border border-amber-500/30 text-amber-400/70 hover:border-amber-500 hover:text-amber-400 transition-all'
              title='Cerrar al precio actual'>
              <Square className='w-3 h-3' /> Cerrar
            </button>
          )
        ) : (
          <button
            onClick={onArchive}
            className='flex items-center gap-0.5 mx-auto px-1.5 py-0.5 rounded text-[10px] border border-purple-500/20 text-purple-400/50 hover:border-purple-400/60 hover:text-purple-400 transition-all'
            title='Archivar este trade'>
            <Archive className='w-3 h-3' />
          </button>
        )}
      </td>
    </tr>
  );
}
