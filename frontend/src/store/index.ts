import { create } from 'zustand';
import { apiService } from '../services/api';
import { getSocket } from '../services/socket';
import type { ClaudeUsage, Health, Signal, Stats, Trade } from '../types';

interface StoreState {
  symbol: string;
  timeframe: string;
  signals: Signal[];
  trades: Trade[];
  stats: Stats | null;
  health: Health | null;
  claudeUsage: ClaudeUsage | null;
  isConnected: boolean;
  botOffline: boolean;
  setBotOffline: (v: boolean) => Promise<void>;
  selectedSignalId: string | null;
  setSelectedSignalId: (id: string | null) => void;

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
  claudeUsage: null,
  isConnected: false,
  botOffline: false,
  selectedSignalId: null,

  setSymbol: (s) => set({ symbol: s }),
  setTimeframe: (t) => set({ timeframe: t }),

  async refreshAll() {
    try {
      const [signals, trades, stats, health, botModeRes, claudeUsage] = await Promise.all([
        apiService.getSignals(50),
        apiService.getTrades(50),
        apiService.getStats(),
        apiService.getHealth().catch(() => null),
        apiService.getBotMode().catch(() => ({ offline: false })),
        apiService.getClaudeCost().catch(() => null),
      ]);
      set({ signals, trades, stats, health, botOffline: botModeRes?.offline ?? false, claudeUsage });
    } catch (err) {
      console.error('refreshAll error', err);
    }
  },

  setSelectedSignalId: (id) => set({ selectedSignalId: id }),

  async setBotOffline(offline: boolean) {
    try {
      await apiService.setBotMode(offline);
      set({ botOffline: offline });
    } catch(e) { console.error('setBotMode error', e); }
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
