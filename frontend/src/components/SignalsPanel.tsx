import { ArrowDown, ArrowUp, Brain, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Signal } from '../types';
import { SignalDetailModal } from './SignalDetailModal';

export function SignalsPanel() {
  const signals = useStore((s) => s.signals);
  const selectedSignalId = useStore((s) => s.selectedSignalId);
  const setSelectedSignalId = useStore((s) => s.setSelectedSignalId);
  const [modalSignal, setModalSignal] = useState<Signal | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Reordenar: señal seleccionada va primero
  const sorted = selectedSignalId
    ? [
        ...signals.filter(s => s.id === selectedSignalId),
        ...signals.filter(s => s.id !== selectedSignalId),
      ]
    : signals;

  // Scroll al signal seleccionado cuando cambia
  useEffect(() => {
    if (selectedSignalId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedSignalId]);

  return (
    <>
      <div className="card flex flex-col h-full">
        <div className="card-header flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Signals recientes
          {selectedSignalId && (
            <span className="text-[11px] text-accent-blue bg-accent-blue/10 border border-accent-blue/30 px-1.5 py-0.5 rounded ml-1">
              Trade seleccionado
            </span>
          )}
          {selectedSignalId && (
            <button
              onClick={() => setSelectedSignalId(null)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="ml-auto text-gray-500 normal-case font-normal">
            {signals.length}
          </span>
        </div>
        <p className="text-[11px] text-gray-600 px-1 pb-1">
          Clic en una señal para ver los indicadores
        </p>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {signals.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">
              Esperando signals…
            </div>
          )}
          {sorted.map((s) => (
            <div
              key={s.id}
              ref={s.id === selectedSignalId ? highlightRef : null}
            >
              <SignalRow
                signal={s}
                highlighted={s.id === selectedSignalId}
                onClick={() => setModalSignal(s)}
              />
            </div>
          ))}
        </div>
      </div>
      {modalSignal && (
        <SignalDetailModal signal={modalSignal} onClose={() => setModalSignal(null)} />
      )}
    </>
  );
}

function SignalRow({ signal, onClick, highlighted }: {
  signal: Signal;
  onClick: () => void;
  highlighted: boolean;
}) {
  const isBuy = signal.direction === 'BUY';
  const rejected = signal.aiVerdict === 'rejected';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded border p-2 text-xs transition-all hover:border-accent-blue/50 hover:bg-bg-subtle cursor-pointer ${
        highlighted
          ? 'border-accent-blue bg-accent-blue/5 ring-1 ring-accent-blue/30'
          : rejected
          ? 'bg-bg-subtle/40 border-bg-subtle opacity-60'
          : 'bg-bg-subtle/60 border-bg-subtle'
      }`}
    >
      {highlighted && (
        <div className="text-[10px] text-accent-blue mb-1 font-medium">
          ↑ Signal del trade seleccionado
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`pill ${isBuy ? 'pill-green' : 'pill-red'} flex items-center gap-1`}>
            {isBuy ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {signal.direction}
          </span>
          <span className="font-semibold">{signal.symbol}</span>
          <span className="text-gray-500">{signal.timeframe}</span>
        </div>
        <span className="text-gray-400">{signal.strategy}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-gray-400 font-mono text-[11px]">
        <Field label="Entry" value={signal.entryPrice} />
        <Field label="SL" value={signal.stopLoss} />
        <Field label="TP" value={signal.targetPrice} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-gray-500">
          Conf: <span className="text-gray-300">{(signal.confidence * 100).toFixed(0)}%</span>
        </span>
        {signal.validatedByAI && (
          <span className="flex items-center gap-1">
            <Brain className="w-3 h-3" />
            <span className={signal.aiVerdict === 'approved' ? 'text-accent-green' : 'text-accent-red'}>
              {signal.aiVerdict}
            </span>
          </span>
        )}
      </div>
      <div className="mt-1 text-gray-500 truncate" title={signal.reason}>
        {signal.reason}
      </div>
    </button>
  );
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span>{value.toFixed(2)}</span>
    </div>
  );
}
