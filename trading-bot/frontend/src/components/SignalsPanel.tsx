import { ArrowDown, ArrowUp, Brain, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import type { Signal } from '../types';

export function SignalsPanel() {
  const signals = useStore((s) => s.signals);

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        Signals recientes
        <span className="ml-auto text-gray-500 normal-case font-normal">
          {signals.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {signals.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-8">
            Esperando signals…
          </div>
        )}
        {signals.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const isBuy = signal.direction === 'BUY';
  const rejected = signal.aiVerdict === 'rejected';

  return (
    <div
      className={`rounded border p-2 text-xs ${
        rejected
          ? 'bg-bg-subtle/40 border-bg-subtle opacity-60'
          : 'bg-bg-subtle/60 border-bg-subtle'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className={`pill ${isBuy ? 'pill-green' : 'pill-red'} flex items-center gap-1`}
          >
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
            <span
              className={
                signal.aiVerdict === 'approved' ? 'text-accent-green' : 'text-accent-red'
              }
            >
              {signal.aiVerdict}
            </span>
          </span>
        )}
      </div>
      <div className="mt-1 text-gray-500 truncate" title={signal.reason}>
        {signal.reason}
      </div>
      {signal.aiComment && (
        <div className="text-[10px] mt-1 text-gray-500 italic line-clamp-2">
          Claude: {signal.aiComment}
        </div>
      )}
    </div>
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
