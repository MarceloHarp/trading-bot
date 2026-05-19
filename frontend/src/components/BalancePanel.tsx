import { useEffect, useState } from 'react';
import { AlertCircle, Wallet, RefreshCw } from 'lucide-react';
import { useStore } from '../store';

interface Balance { asset: string; free: number; locked: number; }

function getRelevantAssets(symbols: string[]): string[] {
  // Extraer assets base de los símbolos (BTCUSDT -> BTC, ETHUSDT -> ETH)
  const bases = symbols.map(s => s.replace(/USDT$|BUSD$|BTC$|ETH$|BNB$/, ''));
  const quotes = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'ADA'];
  return [...new Set([...quotes, ...bases])].filter(Boolean);
}

export function BalancePanel() {
  const health = useStore((s) => s.health);
  const symbols = health?.config.symbols ?? ['BTCUSDT', 'ETHUSDT'];
  const relevant = getRelevantAssets(symbols);

  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/balance');
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Error al obtener balance');
        setBalances([]);
      } else {
        const data: Balance[] = await res.json();
        // Solo los assets relevantes, en orden
        const filtered = relevant
          .map(asset => data.find(b => b.asset === asset) ?? { asset, free: 0, locked: 0 })
          .filter(b => relevant.includes(b.asset));
        setBalances(filtered);
        setError(null);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch {
      setError('No se pudo conectar al backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [symbols.join(',')]);

  const fmt = (n: number) => n > 1000
    ? n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
    : n < 0.0001 ? n.toFixed(8)
    : n < 1 ? n.toFixed(6)
    : n.toFixed(4);

  return (
    <div className='card'>
      <div className='card-header flex items-center gap-2'>
        <Wallet className='w-4 h-4' />
        Balance Testnet
        <button onClick={load} className='ml-auto text-gray-500 hover:text-gray-300 transition-colors' title='Actualizar'>
          <RefreshCw className={'w-3 h-3' + (loading ? ' animate-spin' : '')} />
        </button>
      </div>

      {error && (
        <div className='bg-red-500/10 text-red-400 text-xs rounded p-2 flex items-start gap-2'>
          <AlertCircle className='w-4 h-4 shrink-0 mt-0.5' />
          <div>
            <div className='font-medium'>Error al obtener balance</div>
            <div className='text-red-400/70 mt-0.5 break-all'>{error}</div>
          </div>
        </div>
      )}

      {!error && (
        <table className='w-full text-xs'>
          <thead className='text-gray-500 border-b border-bg-subtle'>
            <tr className='text-left'>
              <th className='py-1 pr-2'>Asset</th>
              <th className='py-1 pr-2 text-right'>Free</th>
              <th className='py-1 pr-2 text-right'>Locked</th>
            </tr>
          </thead>
          <tbody className='font-mono'>
            {balances.map(b => (
              <tr key={b.asset} className='border-b border-bg-subtle/40 hover:bg-bg-subtle/20'>
                <td className='py-1.5 pr-2 font-semibold'>{b.asset}</td>
                <td className={'py-1.5 pr-2 text-right ' + (b.free > 0 ? 'text-green-400' : 'text-gray-600')}>
                  {fmt(b.free)}
                </td>
                <td className='py-1.5 pr-2 text-right text-gray-500'>
                  {b.locked > 0 ? fmt(b.locked) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {lastUpdate && <div className='text-[10px] text-gray-600 mt-1 text-right'>Act: {lastUpdate}</div>}
    </div>
  );
}