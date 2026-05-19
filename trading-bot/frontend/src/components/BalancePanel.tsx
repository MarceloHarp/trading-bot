import { AlertCircle, Wallet } from 'lucide-react';
import { useStore } from '../store';

export function BalancePanel() {
  const { balances, balanceError } = useStore();

  // ordenamos por monto total (free + locked) desc
  const sorted = [...balances].sort(
    (a, b) => b.free + b.locked - (a.free + a.locked)
  );

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Wallet className="w-4 h-4" />
        Balance Binance Testnet
        {!balanceError && (
          <span className="ml-auto text-gray-500 normal-case font-normal">
            {sorted.length} assets
          </span>
        )}
      </div>

      {balanceError && (
        <div className="bg-accent-red/10 text-accent-red text-xs rounded p-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">No se pudo obtener el balance</div>
            <div className="text-accent-red/80 mt-0.5">{balanceError}</div>
            <div className="text-gray-500 mt-1">
              Revisá BINANCE_TESTNET_API_KEY / SECRET en .env
            </div>
          </div>
        </div>
      )}

      {!balanceError && sorted.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-4">
          Sin assets con balance. Pedí faucet en{' '}
          <a
            href="https://testnet.binance.vision/"
            target="_blank"
            rel="noreferrer"
            className="text-accent-blue underline"
          >
            testnet.binance.vision
          </a>
        </div>
      )}

      {!balanceError && sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 border-b border-bg-subtle">
              <tr className="text-left">
                <th className="py-1 pr-2">Asset</th>
                <th className="py-1 pr-2 text-right">Free</th>
                <th className="py-1 pr-2 text-right">Locked</th>
                <th className="py-1 pr-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {sorted.map((b) => (
                <tr
                  key={b.asset}
                  className="border-b border-bg-subtle/50 hover:bg-bg-subtle/30"
                >
                  <td className="py-1.5 pr-2 font-semibold">{b.asset}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {b.free.toFixed(b.free < 1 ? 6 : 4)}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-gray-500">
                    {b.locked.toFixed(b.locked < 1 ? 6 : 4)}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {(b.free + b.locked).toFixed(b.free + b.locked < 1 ? 6 : 4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
