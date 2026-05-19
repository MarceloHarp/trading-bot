import { create } from 'zustand';
import { apiService } from '../services/api';
import { getSocket } from '../services/socket';
import type { Balance, Health, Signal, Stats, Trade } from '../types';

interface StoreState {
  symbol: string;
  timeframe: string;
  signals: Signal[];
  trades: Trade[];
  stats: Stats | null;
  health: Health | null;
  balances: Balance[];
  balanceError: string | null;
  isConnected: boolean;

  setSymbol: (s: string) => void;
  setTimeframe: (t: string) => void;
  refreshAll: () => Promise<void>;
  initSocket: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  symbol: 'BTCUSDT',
  timeframe: '1h',
  signals: [],
  trades: [],
  stats: null,
  health: null,
  balances: [],
  balanceError: null,
  isConnected: false,

  setSymbol: (s) => set({ symbol: s }),
  setTimeframe: (t) => set({ timeframe: t }),

  async refreshAll() {
    try {
      const [signals, trades, stats, health, balanceRes] = await Promise.all([
        apiService.getSignals(50),
        apiService.getTrades(50),
        apiService.getStats(),
        apiService.getHealth().catch(() => null),
        apiService.getBalance().then(
          (b) => ({ ok: true as const, data: b }),
          (err: Error) => ({ ok: false as const, error: err.message })
        ),
      ]);
      set({
        signals,
        trades,
        stats,
        health,
        balances: balanceRes.ok ? balanceRes.data : [],
        balanceError: balanceRes.ok ? null : balanceRes.error,
      });
    } catch (err) {
      console.error('refreshAll error', err);
    }
  },

  initSocket() {
    const sock = getSocket();
    sock.on('connect', () => set({ isConnected: true }));
    sock.on('disconnect', () => set({ isConnected: false }));
    sock.on('signal', (signal: Signal) => {
      const cur = get().signals;
      set({ signals: [signal, ...cur].slice(0, 100) });
    });
    sock.on('trade', (trade: Trade) => {
      const cur = get().trades;
      set({ trades: [trade, ...cur].slice(0, 100) });
      get().refreshAll();
    });
  },
}));
