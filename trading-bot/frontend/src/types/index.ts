export interface Candle {
  symbol: string;
  timeframe: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Direction = 'BUY' | 'SELL';

export interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: Direction;
  strategy: string;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  confidence: number;
  reason: string;
  meta?: Record<string, unknown> | null;
  validatedByAI: boolean;
  aiVerdict?: string | null;
  aiComment?: string | null;
  status: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  signalId?: string | null;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  exitPrice?: number | null;
  quantity: number;
  stopLoss: number;
  targetPrice: number;
  pnl?: number | null;
  pnlPercent?: number | null;
  status: string;
  closedReason?: string | null;
  openedAt: string;
  closedAt?: string | null;
}

export interface Stats {
  trades: {
    open: number;
    closed: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
  };
  signals: {
    total: number;
    approved: number;
    rejected: number;
  };
  rateLimit: {
    signalsLastHour: number;
    signalsLastDay: number;
    maxPerHour: number;
    maxPerDay: number;
    isLimited: boolean;
  } | null;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
}

export interface Health {
  status: string;
  timestamp: string;
  services: { db: boolean; binance: boolean };
  config: {
    symbols: string[];
    timeframes: string[];
    autoExecute: boolean;
    claudeValidation: boolean;
  };
}
