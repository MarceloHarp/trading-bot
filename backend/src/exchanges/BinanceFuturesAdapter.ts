import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { Candle, Direction, ExchangeBalance, OrderResult } from '../types';
import type { IExchangeAdapter } from './IExchangeAdapter';

/**
 * Binance USD-M Futures Testnet adapter.
 * Docs: https://binance-docs.github.io/apidocs/futures/en/
 *
 * Base URL testnet: https://testnet.binancefuture.com
 *
 * Endpoints clave:
 *  - GET  /fapi/v1/klines          → velas
 *  - GET  /fapi/v1/ticker/price    → precio
 *  - GET  /fapi/v2/account         → balance (firmado)
 *  - POST /fapi/v1/order           → órdenes (firmado)
 *  - POST /fapi/v1/leverage        → set leverage por símbolo (firmado)
 *
 * Diferencias clave vs Spot:
 *  - Los SHORT son posiciones reales (no requieren tener el activo)
 *  - Al cerrar: placeMarketOrder con el lado opuesto + reduceOnly=true
 *  - El balance está en /fapi/v2/account → availableBalance (USDT)
 *  - Los lots en futuros son en unidades del activo base (igual que spot)
 */
export class BinanceFuturesAdapter implements IExchangeAdapter {
  private readonly rest: AxiosInstance;
  private readonly leverage: number;
  /** Símbolos donde ya se configuró el apalancamiento */
  private readonly leverageSet = new Set<string>();

  constructor(
    private readonly apiKey = config.futures.apiKey,
    private readonly apiSecret = config.futures.apiSecret,
    restUrl = config.futures.restUrl,
    leverage = config.futures.leverage,
  ) {
    this.leverage = leverage;
    this.rest = axios.create({
      baseURL: restUrl,
      timeout: 10_000,
      headers: this.apiKey ? { 'X-MBX-APIKEY': this.apiKey } : {},
    });
    logger.info(`BinanceFuturesAdapter listo | url=${restUrl} | leverage=${leverage}x`);
  }

  /* -------- REST: público -------- */

  async getCandles(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
    const { data } = await this.rest.get('/fapi/v1/klines', {
      params: { symbol, interval, limit },
    });
    return (data as unknown[]).map((row) => {
      const r = row as (number | string)[];
      return {
        symbol,
        timeframe: interval,
        openTime: Number(r[0]),
        open: parseFloat(r[1] as string),
        high: parseFloat(r[2] as string),
        low: parseFloat(r[3] as string),
        close: parseFloat(r[4] as string),
        volume: parseFloat(r[5] as string),
        closeTime: Number(r[6]),
      };
    });
  }

  async getPrice(symbol: string): Promise<number> {
    const { data } = await this.rest.get('/fapi/v1/ticker/price', {
      params: { symbol },
    });
    return parseFloat(data.price);
  }

  async ping(): Promise<boolean> {
    try {
      await this.rest.get('/fapi/v1/ping');
      return true;
    } catch {
      return false;
    }
  }

  /* -------- REST: firmado -------- */

  private sign(query: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(query).digest('hex');
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Binance Futures API keys not configured');
    }
    const timestamp = Date.now();
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
      timestamp: String(timestamp),
      recvWindow: '5000',
    }).toString();
    const signature = this.sign(query);
    const url = `${path}?${query}&signature=${signature}`;
    const { data } = await this.rest.request<T>({ method, url });
    return data;
  }

  async getBalance(): Promise<ExchangeBalance[]> {
    const data = await this.signedRequest<{ availableBalance: string; totalWalletBalance: string }>(
      'GET', '/fapi/v2/account'
    );
    // En futuros solo hay USDT como margen
    return [
      {
        asset: 'USDT',
        free: parseFloat(data.availableBalance),
        locked: parseFloat(data.totalWalletBalance) - parseFloat(data.availableBalance),
      },
    ];
  }

  /**
   * Configura el apalancamiento para un símbolo (solo la primera vez).
   */
  private async ensureLeverage(symbol: string): Promise<void> {
    if (this.leverageSet.has(symbol)) return;
    try {
      await this.signedRequest('POST', '/fapi/v1/leverage', {
        symbol,
        leverage: this.leverage,
      });
      this.leverageSet.add(symbol);
      logger.info(`Leverage ${this.leverage}x configurado para ${symbol}`);
    } catch (err) {
      logger.warn(`No se pudo configurar leverage para ${symbol}: ${(err as Error).message}`);
    }
  }

  async placeMarketOrder(
    symbol: string,
    side: Direction,
    quantity: number,
    reduceOnly = false,
  ): Promise<OrderResult> {
    // Configurar leverage antes de la primera orden en este símbolo
    if (!reduceOnly) await this.ensureLeverage(symbol);

    const params: Record<string, string | number | boolean> = {
      symbol,
      side,
      type: 'MARKET',
      quantity: quantity.toFixed(6),
    };
    if (reduceOnly) params.reduceOnly = 'true';

    const data = await this.signedRequest<{
      orderId: number;
      symbol: string;
      side: Direction;
      executedQty: string;
      cumQuote: string;
      status: string;
      avgPrice?: string;
    }>('POST', '/fapi/v1/order', params);

    const filled = parseFloat(data.executedQty);
    const cumQuote = parseFloat(data.cumQuote ?? '0');
    const avgPrice = filled > 0 && cumQuote > 0 ? cumQuote / filled : 0;

    return {
      id: String(data.orderId),
      symbol: data.symbol,
      side: data.side,
      price: avgPrice,
      quantity: filled,
      status: data.status,
      raw: data,
    };
  }

  /** No-op: el adapter de futuros no usa WebSocket por ahora. */
  closeAll(): void {
    // Futuros no tiene WS streams en esta implementación
  }
}
