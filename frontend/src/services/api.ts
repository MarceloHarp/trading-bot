import axios from 'axios';
import type { Candle, ClaudeUsage, Health, Signal, Stats, Trade } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000,
});

export const apiService = {
  async getHealth(): Promise<Health> {
    const { data } = await api.get<Health>('/health');
    return data;
  },
  async getCandles(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
    const { data } = await api.get<Candle[]>('/candles', {
      params: { symbol, interval, limit },
    });
    return data;
  },
  async getSignals(limit = 50): Promise<Signal[]> {
    const { data } = await api.get<Signal[]>('/signals', { params: { limit } });
    return data;
  },
  async getTrades(limit = 50, status?: string): Promise<Trade[]> {
    const { data } = await api.get<Trade[]>('/trades', {
      params: { limit, status },
    });
    return data;
  },
  async getStats(): Promise<Stats> {
    const { data } = await api.get<Stats>('/stats');
    return data;
  },
  async getClaudeCost(): Promise<ClaudeUsage> {
    const { data } = await api.get<ClaudeUsage>('/claude-cost');
    return data;
  },
  async getBotMode(): Promise<{ offline: boolean }> {
    const { data } = await api.get('/bot-mode');
    return data;
  },
  async setBotMode(offline: boolean): Promise<{ offline: boolean }> {
    const { data } = await api.post('/bot-mode', { offline });
    return data;
  },
};
