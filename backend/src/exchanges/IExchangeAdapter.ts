import type { Candle, Direction, ExchangeBalance, OrderResult } from '../types';

/**
 * Interface común para Spot y Futures adapters.
 * OrderExecutor y StrategyEngine trabajan contra esta interface,
 * no contra una implementación concreta.
 */
export interface IExchangeAdapter {
  getCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;
  getPrice(symbol: string): Promise<number>;
  ping(): Promise<boolean>;
  getBalance(): Promise<ExchangeBalance[]>;
  /**
   * @param reduceOnly  Solo aplica en futuros: cierra posición sin abrir una nueva.
   */
  placeMarketOrder(symbol: string, side: Direction, quantity: number, reduceOnly?: boolean): Promise<OrderResult>;
  closeAll(): void;
}
