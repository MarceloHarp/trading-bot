import { Bot, Coins, Hash, Zap } from 'lucide-react';
import { useStore } from '../store';

export function ClaudeCostPanel() {
  const usage = useStore((s) => s.claudeUsage);
  const health = useStore((s) => s.health);

  if (!health?.config.claudeValidation) {
    return (
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Claude API — Costo
        </div>
        <p className="text-xs text-gray-500 px-1">
          Validación deshabilitada (<code>CLAUDE_VALIDATION=false</code>)
        </p>
      </div>
    );
  }

  const cost = usage?.totalCostUsd ?? 0;
  const costColor = cost === 0 ? 'text-gray-400' : cost < 0.5 ? 'text-accent-green' : cost < 2 ? 'text-yellow-400' : 'text-accent-red';

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Bot className="w-4 h-4" />
        Claude API — Costo acumulado
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<Coins className="w-4 h-4" />}
          label="Costo total"
          value={`$${cost.toFixed(4)}`}
          accent={costColor}
        />
        <Metric
          icon={<Hash className="w-4 h-4" />}
          label="Validaciones"
          value={String(usage?.totalCalls ?? 0)}
          accent="text-accent-blue"
        />
        <Metric
          icon={<Zap className="w-4 h-4" />}
          label="Tokens entrada"
          value={(usage?.inputTokens ?? 0).toLocaleString()}
          accent="text-gray-300"
        />
        <Metric
          icon={<Zap className="w-4 h-4" />}
          label="Tokens salida"
          value={(usage?.outputTokens ?? 0).toLocaleString()}
          accent="text-gray-300"
        />
      </div>
      {usage?.updatedAt && (
        <p className="text-xs text-gray-600 mt-2">
          Última llamada: {new Date(usage.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-bg-subtle/40 rounded p-3">
      <div className="text-xs text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-semibold font-mono ${accent}`}>{value}</div>
    </div>
  );
}
