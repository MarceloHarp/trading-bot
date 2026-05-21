import type { Candle, Signal } from '../../types';

export interface Strategy {
  readonly name: string;
  /**
   * Evalúa la estrategia con las velas dadas.
   * Devuelve un Signal si hay setup válido, o null si no hay entrada.
   */
  evaluate(symbol: string, timeframe: string, candles: Candle[], htfCandles?: Candle[]): Signal | null;
}
