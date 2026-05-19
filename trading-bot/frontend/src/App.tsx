import { useEffect } from 'react';
import { BalancePanel } from './components/BalancePanel';
import { Chart } from './components/Chart';
import { Header } from './components/Header';
import { SignalsPanel } from './components/SignalsPanel';
import { StatsPanel } from './components/StatsPanel';
import { TradesPanel } from './components/TradesPanel';
import { useStore } from './store';

export default function App() {
  const refreshAll = useStore((s) => s.refreshAll);
  const initSocket = useStore((s) => s.initSocket);

  useEffect(() => {
    initSocket();
    refreshAll();
    const id = setInterval(refreshAll, 10_000);
    return () => clearInterval(id);
  }, [initSocket, refreshAll]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        <section className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <StatsPanel />
          <Chart />
          <div className="h-72">
            <TradesPanel />
          </div>
        </section>
        <aside className="lg:col-span-1 min-h-0 flex flex-col gap-4">
          <BalancePanel />
          <div className="flex-1 min-h-0">
            <SignalsPanel />
          </div>
        </aside>
      </main>
      <footer className="text-center text-xs text-gray-600 py-2 border-t border-bg-subtle">
        Trading Bot — Testnet · No es asesoramiento financiero
      </footer>
    </div>
  );
}
