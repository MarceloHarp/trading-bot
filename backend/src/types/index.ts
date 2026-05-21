// Tipos compartidos en todo el backend

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
export type Bias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type StrategyName = 'SmartMoney' | 'VWAPMomentum' | 'Confluence' | 'DruLozano' | 'MarceMillo';

export interface Signal {
  symbol: string;
  timeframe: string;
  direction: Direction;
  strategy: StrategyName;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  confidence: number; // 0..1
  reason: string;
  meta?: Record<string, unknown>;
}

export interface AIVerdict {
  approved: boolean;
  comment: string;
}

export interface ExchangeBalance {
  asset: string;
  free: number;
  locked: number;
}

export interface OrderResult {
  id: string;
  symbol: string;
  side: Direction;
  price: number;
  quantity: number;
  status: string;
  raw?: unknown;
}
