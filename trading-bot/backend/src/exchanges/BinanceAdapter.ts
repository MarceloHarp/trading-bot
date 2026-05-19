import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import WebSocket from 'ws';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { Candle, Direction, ExchangeBalance, OrderResult } from '../types';

/**
 * Binance Spot Testnet adapter.
 * Docs: https://binance-docs.github.io/apidocs/spot/en/
 *
 * Endpoints clave:
 *  - GET  /api/v3/klines     → velas
 *  - GET  /api/v3/ticker/price → precio
 *  - GET  /api/v3/account    → balance (firmado)
 *  - POST /api/v3/order      → órdenes (firmado)
 *
 * WS streams: <symbol>@kline_<interval>
 */
export class BinanceAdapter {
  private readonly rest: AxiosInstance;
  private readonly ws = new Map<string, WebSocket>();

  constructor(
    private readonly apiKey = config.binance.apiKey,
    private readonly apiSecret = config.binance.apiSecret,
    restUrl = config.binance.restUrl,
    private readonly wsUrl = config.binance.wsUrl
  ) {
    this.rest = axios.create({
      baseURL: restUrl,
      timeout: 10_000,
      headers: this.apiKey ? { 'X-MBX-APIKEY': this.apiKey } : {},
    });
  }

  /* -------- REST: público -------- */

  async getCandles(
    symbol: string,
    interval: string,
    limit = 500
  ): Promise<Candle[]> {
    const { data } = await this.rest.get('/api/v3/klines', {
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
    const { data } = await this.rest.get('/api/v3/ticker/price', {
      params: { symbol },
    });
    return parseFloat(data.price);
  }

  async ping(): Promise<boolean> {
    try {
      await this.rest.get('/api/v3/ping');
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
    params: Record<string, string | number> = {}
  ): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Binance API keys not configured');
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
    
    try {
      const { data } = await this.rest.request<T>({ method, url });
      return data;
    } catch (error) {
      const axiosErr = error as { response?: { status: number; data: unknown } };
      if (axiosErr.response) {
        throw new Error(`Binance API ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`);
      }
      throw error;
    }
  }

  async getBalance(): Promise<ExchangeBalance[]> {
    const data = await this.signedRequest<{
      balances: { asset: string; free: string; locked: string }[];
    }>('GET', '/api/v3/account');
    return data.balances
      .map((b) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
      }))
      .filter((b) => b.free > 0 || b.locked > 0);
  }

  async placeMarketOrder(
    symbol: string,
    side: Direction,
    quantity: number
  ): Promise<OrderResult> {
    const params = {
      symbol,
      side,
      type: 'MARKET',
      quantity: quantity.toFixed(6),
    };
    const data = await this.signedRequest<{
      orderId: number;
      symbol: string;
      side: Direction;
      executedQty: string;
      cummulativeQuoteQty: string;
      status: string;
      fills?: { price: string; qty: string }[];
    }>('POST', '/api/v3/order', params);
    const filled = parseFloat(data.executedQty);
    const quote = parseFloat(data.cummulativeQuoteQty);
    const avgPrice = filled > 0 ? quote / filled : 0;
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

  /* -------- WebSocket -------- */

  /**
   * Suscribe a un stream de klines.
   * onClosed se invoca solo cuando la vela se cerró.
   */
  subscribeKlines(
    symbol: string,
    interval: string,
    onClosed: (candle: Candle) => void
  ): void {
    const key = `${symbol.toLowerCase()}@kline_${interval}`;
    if (this.ws.has(key)) return;

    const url = `${this.wsUrl}/ws/${key}`;
    const socket = new WebSocket(url);

    socket.on('open', () => logger.info(`WS open: ${key}`));
    socket.on('error', (err) => logger.warn(`WS error ${key}: ${err.message}`));
    socket.on('close', () => {
      logger.warn(`WS closed ${key}, reconnecting in 5s`);
      this.ws.delete(key);
      setTimeout(() => this.subscribeKlines(symbol, interval, onClosed), 5000);
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const k = msg.k;
        if (!k) return;
        if (!k.x) return; // sólo cuando la vela cerró
        const candle: Candle = {
          symbol,
          timeframe: interval,
          openTime: Number(k.t),
          closeTime: Number(k.T),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        onClosed(candle);
      } catch (e) {
        logger.warn(`WS parse error: ${(e as Error).message}`);
      }
    });

    this.ws.set(key, socket);
  }

  closeAll(): void {
    for (const [key, sock] of this.ws.entries()) {
      try {
        sock.close();
      } catch {
        // noop
      }
      this.ws.delete(key);
    }
  }
}
