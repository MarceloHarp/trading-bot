import { ArrowDown, ArrowUp, Brain, X } from 'lucide-react';
import type {
  ConfluenceMeta,
  Signal,
  SmartMoneyMeta,
  VWAPMomentumMeta,
} from '../types';

interface Props {
  signal: Signal;
  onClose: () => void;
}

export function SignalDetailModal({ signal, onClose }: Props) {
  const isBuy = signal.direction === 'BUY';
  const risk = Math.abs(signal.entryPrice - signal.stopLoss);
  const reward = Math.abs(signal.targetPrice - signal.entryPrice);
  const rr = risk > 0 ? reward / risk : 0;
  const riskPct = (risk / signal.entryPrice) * 100;
  const rewardPct = (reward / signal.entryPrice) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg bg-bg-card border border-bg-subtle rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-subtle">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`pill flex items-center gap-1 ${isBuy ? 'pill-green' : 'pill-red'}`}
            >
              {isBuy ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {signal.direction}
            </span>
            <span className="font-bold text-base">{signal.symbol}</span>
            <span className="text-gray-400 text-sm">{signal.timeframe}</span>
            <span className="bg-bg-subtle text-gray-300 text-xs px-2 py-0.5 rounded">
              {signal.strategy}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Razón */}
          <Section title="¿Por qué se abrió?">
            <p className="text-sm text-gray-200 leading-relaxed">{signal.reason}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(signal.createdAt).toLocaleString()} ·{' '}
              <span
                className={
                  signal.status === 'executed'
                    ? 'text-accent-green'
                    : signal.status === 'rejected'
                    ? 'text-accent-red'
                    : 'text-yellow-400'
                }
              >
                {signal.status}
              </span>
            </p>
          </Section>

          {/* Indicadores por estrategia */}
          {signal.meta && (
            <Section title="Indicadores utilizados">
              {signal.strategy === 'SmartMoney' && (
                <SmartMoneyIndicators meta={signal.meta as SmartMoneyMeta} signal={signal} />
              )}
              {signal.strategy === 'VWAPMomentum' && (
                <VWAPIndicators meta={signal.meta as VWAPMomentumMeta} signal={signal} />
              )}
              {signal.strategy === 'Confluence' && (
                <ConfluenceIndicators meta={signal.meta as ConfluenceMeta} />
              )}
            </Section>
          )}

          {/* Gestión de riesgo */}
          <Section title="Gestión de riesgo">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <RiskField label="Entry" value={`$${signal.entryPrice.toFixed(2)}`} accent="text-gray-200" />
              <RiskField
                label="Stop Loss"
                value={`$${signal.stopLoss.toFixed(2)}`}
                sub={`-${riskPct.toFixed(2)}%`}
                accent="text-accent-red"
              />
              <RiskField
                label="Take Profit"
                value={`$${signal.targetPrice.toFixed(2)}`}
                sub={`+${rewardPct.toFixed(2)}%`}
                accent="text-accent-green"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                R:R —{' '}
                <span className={rr >= 2 ? 'text-accent-green' : rr >= 1.5 ? 'text-yellow-400' : 'text-accent-red'}>
                  1 : {rr.toFixed(2)}
                </span>
              </span>
              <span className="text-gray-400">
                Confianza —{' '}
                <span className="text-accent-blue">{(signal.confidence * 100).toFixed(0)}%</span>
              </span>
            </div>
            {/* Barra de confianza */}
            <div className="mt-2 h-1.5 bg-bg-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-blue rounded-full transition-all"
                style={{ width: `${signal.confidence * 100}%` }}
              />
            </div>
          </Section>

          {/* Validación Claude */}
          {signal.validatedByAI && (
            <Section title="Validación Claude AI">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-gray-400" />
                <span
                  className={`font-semibold ${
                    signal.aiVerdict === 'approved' ? 'text-accent-green' : 'text-accent-red'
                  }`}
                >
                  {signal.aiVerdict === 'approved' ? '✓ APROBADO' : '✗ RECHAZADO'}
                </span>
              </div>
              {signal.aiComment && (
                <p className="text-xs text-gray-400 leading-relaxed italic">
                  "{signal.aiComment}"
                </p>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Indicadores SmartMoney ───────────────────────────────────────────────────

function SmartMoneyIndicators({ meta, signal }: { meta: SmartMoneyMeta; signal: Signal }) {
  const level = meta.support ?? meta.resistance;
  const isAboveSma = signal.entryPrice > meta.sma200;
  return (
    <div className="space-y-2">
      <IndicatorRow label="Sesgo de estructura">
        <span className={meta.bias === 'BULLISH' ? 'text-accent-green font-semibold' : 'text-accent-red font-semibold'}>
          {meta.bias === 'BULLISH' ? '▲ ALCISTA (HH + HL)' : '▼ BAJISTA (LH + LL)'}
        </span>
      </IndicatorRow>
      {level !== undefined && (
        <IndicatorRow label={meta.support !== undefined ? 'Soporte' : 'Resistencia'}>
          <span className="font-mono">${level.toFixed(2)}</span>
          <span className="text-gray-500 text-xs ml-1">— nivel de precio clave</span>
        </IndicatorRow>
      )}
      <IndicatorRow label="SMA 200">
        <span className="font-mono">${meta.sma200.toFixed(2)}</span>
        <span className={`text-xs ml-2 ${isAboveSma ? 'text-accent-green' : 'text-accent-red'}`}>
          precio {isAboveSma ? 'encima' : 'debajo'} → filtro de tendencia {isAboveSma ? '✓' : '✗'}
        </span>
      </IndicatorRow>
      <IndicatorRow label="ATR (14)">
        <span className="font-mono">${meta.atr.toFixed(2)}</span>
        <span className="text-gray-500 text-xs ml-1">— volatilidad promedio por vela</span>
      </IndicatorRow>
      <Note>
        El precio rebotó en el nivel de {meta.support !== undefined ? 'soporte' : 'resistencia'} con un margen de ±0.5× ATR
        y cerró fuertemente, confirmando la estructura {meta.bias === 'BULLISH' ? 'alcista' : 'bajista'}.
      </Note>
    </div>
  );
}

// ─── Indicadores VWAP Momentum ────────────────────────────────────────────────

function VWAPIndicators({ meta, signal }: { meta: VWAPMomentumMeta; signal: Signal }) {
  const rsiColor = meta.rsi > 70 ? 'text-accent-red' : meta.rsi < 30 ? 'text-accent-red' : 'text-accent-green';
  const histColor = meta.macdHist > 0 ? 'text-accent-green' : 'text-accent-red';
  const volRatio = signal.entryPrice > 0 ? (meta.avgVol * 1.2).toFixed(0) : '—';

  return (
    <div className="space-y-2">
      <IndicatorRow label="VWAP (50 velas)">
        <span className="font-mono">${meta.vwap.toFixed(2)}</span>
        <span className="text-gray-500 text-xs ml-1">— precio justo institucional</span>
      </IndicatorRow>
      <IndicatorRow label="RSI (14)">
        <span className={`font-mono font-semibold ${rsiColor}`}>{meta.rsi.toFixed(1)}</span>
        <span className="text-gray-500 text-xs ml-2">
          {meta.rsi > 70 ? '⚠ sobrecomprado' : meta.rsi < 30 ? '⚠ sobrevendido' : '✓ zona neutra (no extremo)'}
        </span>
      </IndicatorRow>
      <IndicatorRow label="MACD Histograma">
        <span className={`font-mono font-semibold ${histColor}`}>{meta.macdHist.toFixed(4)}</span>
        <span className={`text-xs ml-2 ${histColor}`}>
          {meta.macdHist > 0 ? '▲ momentum alcista creciente' : '▼ momentum bajista creciente'}
        </span>
      </IndicatorRow>
      <IndicatorRow label="Volumen mínimo requerido">
        <span className="font-mono">{Number(volRatio).toLocaleString()}</span>
        <span className="text-green-400 text-xs ml-1">✓ volumen confirmado (1.2× media)</span>
      </IndicatorRow>
      <Note>
        El precio tocó el VWAP y cerró {signal.direction === 'BUY' ? 'por encima' : 'por debajo'} con
        momentum MACD positivo y volumen elevado, confirmando la dirección institucional.
      </Note>
    </div>
  );
}

// ─── Indicadores Confluence ───────────────────────────────────────────────────

const ELEMENT_LABELS: Record<string, string> = {
  'BB-lower': 'Banda Bollinger inferior',
  'BB-upper': 'Banda Bollinger superior',
  'EMA20-support': 'EMA 20 como soporte',
  'EMA20-resistance': 'EMA 20 como resistencia',
  'SMA200-support': 'SMA 200 como soporte',
  'SMA200-resistance': 'SMA 200 como resistencia',
  'swing-low': 'Swing low previo',
  'swing-high': 'Swing high previo',
  'VWAP-support': 'VWAP como soporte',
  'VWAP-resistance': 'VWAP como resistencia',
  'high-vol-bull': 'Volumen alto alcista',
  'high-vol-bear': 'Volumen alto bajista',
};

function ConfluenceIndicators({ meta }: { meta: ConfluenceMeta }) {
  return (
    <div className="space-y-3">
      {/* Score */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Score de confluencia</span>
          <span className="font-bold text-accent-blue text-sm">{meta.score} / 10</span>
        </div>
        <div className="h-2 bg-bg-subtle rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-blue"
            style={{ width: `${(meta.score / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Elementos confluentes */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">Factores activados:</p>
        <div className="flex flex-wrap gap-1.5">
          {meta.elements.map((el) => (
            <span
              key={el}
              className="bg-accent-blue/20 text-accent-blue text-[11px] px-2 py-0.5 rounded border border-accent-blue/30"
            >
              {ELEMENT_LABELS[el] ?? el}
            </span>
          ))}
        </div>
      </div>

      {/* Niveles */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <IndicatorRow label="BB superior"><span className="font-mono">${meta.bb.upper.toFixed(2)}</span></IndicatorRow>
        <IndicatorRow label="BB medio"><span className="font-mono">${meta.bb.mid.toFixed(2)}</span></IndicatorRow>
        <IndicatorRow label="BB inferior"><span className="font-mono">${meta.bb.lower.toFixed(2)}</span></IndicatorRow>
        <IndicatorRow label="EMA 20"><span className="font-mono">${meta.e20.toFixed(2)}</span></IndicatorRow>
        <IndicatorRow label="SMA 200"><span className="font-mono">${meta.s200.toFixed(2)}</span></IndicatorRow>
        <IndicatorRow label="VWAP"><span className="font-mono">${meta.lastVwap.toFixed(2)}</span></IndicatorRow>
      </div>

      <Note>
        La señal requiere score ≥ 5. Cuantos más factores coincidan en el mismo nivel de precio,
        más confiable es la entrada.
      </Note>
    </div>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function IndicatorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1 text-xs">
      <span className="text-gray-500 shrink-0 w-32">{label}:</span>
      <span>{children}</span>
    </div>
  );
}

function RiskField({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-bg-subtle/40 rounded p-2 text-center">
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className={`font-mono font-semibold text-sm ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-gray-500 bg-bg-subtle/30 rounded p-2 leading-relaxed italic mt-1">
      💡 {children}
    </p>
  );
}
