import { useEffect, useRef, useState } from 'react';
import { BacktestPage } from './components/BacktestPage';
import { BalancePanel } from './components/BalancePanel';
import { Chart } from './components/Chart';
import { ClaudeCostPanel } from './components/ClaudeCostPanel';
import { Header } from './components/Header';
import { SignalsPanel } from './components/SignalsPanel';
import { StatsPanel } from './components/StatsPanel';
import { TradesPanel } from './components/TradesPanel';
import { useStore } from './store';

export default function App() {
  const [page, setPage] = useState<'dashboard' | 'backtest'>('dashboard');
  const refreshAll = useStore((s) => s.refreshAll);
  const initSocket = useStore((s) => s.initSocket);

  // ── Resize chart / collapse trades ──────────────────────────────────────
  const [chartHeight, setChartHeight]       = useState(380);
  const [tradesCollapsed, setTradesCollapsed] = useState(false);
  const savedHeightRef = useRef(380);
  const sectionRef     = useRef<HTMLElement>(null);
  const dragRef        = useRef<{ startY: number; startH: number } | null>(null);

  // Mouse handlers para el drag handle
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = e.clientY - dragRef.current.startY;
      setChartHeight(Math.max(150, Math.min(700, dragRef.current.startH + delta)));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  const toggleTradesCollapse = () => {
    if (!tradesCollapsed) {
      savedHeightRef.current = chartHeight;
    } else {
      setChartHeight(savedHeightRef.current);
    }
    setTradesCollapsed(v => !v);
  };

  useEffect(() => {
    initSocket();
    refreshAll();
    const id = setInterval(refreshAll, 10_000);
    return () => clearInterval(id);
  }, [initSocket, refreshAll]);

  if (page === 'backtest') return <BacktestPage onBack={() => setPage('dashboard')} />;

  return (
    // h-screen fija la altura al viewport — ni Trades ni Signals pueden estirar la página
    <div className='h-screen flex flex-col overflow-hidden'>
      <Header onBacktest={() => setPage('backtest')} />

      {/*
        flex-1 + overflow-hidden: main ocupa el espacio restante sin scrollbar de página.
        El grid hace ambas columnas exactamente la misma altura (stretch por defecto).
        Cada columna distribuye su altura internamente con flexbox.
      */}
      <main className='flex-1 overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start lg:items-stretch'>

        {/* Columna izquierda — 2/3 del ancho */}
        <section ref={sectionRef} className='lg:col-span-2 h-full flex flex-col gap-2 overflow-hidden'>
          <div className='shrink-0'>
            <StatsPanel />
          </div>

          {tradesCollapsed ? (
            // ── Modo gráfico expandido: Chart flex-1, se auto-adapta al espacio disponible ──
            <>
              <div className='flex-1 min-h-0'>
                <Chart flexible />
              </div>
              <div className='shrink-0'>
                <TradesPanel collapsed onToggleCollapse={toggleTradesCollapse} />
              </div>
            </>
          ) : (
            // ── Modo normal: Chart con altura draggable, Trades ocupa el resto ──
            <>
              <div className='shrink-0'>
                <Chart height={chartHeight} />
              </div>
              <div
                className='shrink-0 h-3 flex items-center justify-center cursor-ns-resize group select-none'
                onMouseDown={(e) => {
                  dragRef.current = { startY: e.clientY, startH: chartHeight };
                  e.preventDefault();
                }}
                title='Arrastrá para redimensionar el gráfico'
              >
                <div className='w-24 h-1 rounded-full bg-gray-700 group-hover:bg-accent-blue transition-colors' />
              </div>
              <div className='flex-1 min-h-0 overflow-hidden'>
                <TradesPanel onToggleCollapse={toggleTradesCollapse} />
              </div>
            </>
          )}
        </section>

        {/*
          Columna derecha — 1/3 del ancho.
          h-full asegura que tome exactamente la misma altura que la columna izq
          (impuesta por el grid stretch), nunca más.
          SignalsPanel con flex-1 ocupa el espacio sobrante y hace scroll interno.
        */}
        <aside className='lg:col-span-1 h-full flex flex-col gap-4 overflow-hidden'>
          <BalancePanel />
          <ClaudeCostPanel />
          <div className='flex-1 min-h-0 overflow-hidden'>
            <SignalsPanel />
          </div>
        </aside>
      </main>

      <footer className='shrink-0 text-center text-xs text-gray-600 py-2 border-t border-bg-subtle'>
        Trading Bot — Testnet · No es asesoramiento financiero
      </footer>
    </div>
  );
}