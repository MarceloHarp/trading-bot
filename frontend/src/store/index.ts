import { create } from 'zustand';
import { apiService } from '../services/api';
import { getSocket } from '../services/socket';
import type { ClaudeUsage, Health, Signal, Stats, Trade } from '../types';

// Estrategias activas — ordenadas de más a menos rentable según backtest histórico
export const ALL_STRATEGIES = [
  {
    id: 'ElTigre',
    label: 'El Tigre',
    color: '#ef4444',
    desc: 'Swing pullback EMA 1d — ETH/BNB/AVAX (~$10/trade)',
    stats: {
      winRate: 37,
      profitFactor: 1.81,
      bestTimeframe: '1D',
      bestPairs: ['ETHUSDT (WR 37.5%)', 'AVAXUSDT (WR 34.8%)', 'BNBUSDT shorts'],
      note: '+$1,073 en backtest 3 años • avg +3.4%/trade (3x lev)',
    },
  },
  {
    id: 'GatilloFacil',
    label: 'Gatillo Fácil',
    color: '#f59e0b',
    desc: 'BB fade 4h — ETH/BNB/AVAX',
    stats: {
      winRate: 48,
      profitFactor: 1.55,
      bestTimeframe: '4H',
      bestPairs: ['ETHUSDT', 'AVAXUSDT', 'BNBUSDT'],
      note: 'Mean-reversion BB inferior/superior • más trades que ElTigre',
    },
  },
  {
    id: 'MarceMillo',
    label: 'MarceMillo',
    color: '#a855f7',
    desc: 'Momentum 1h — SOL',
    stats: {
      winRate: 45,
      profitFactor: 1.48,
      bestTimeframe: '1H',
      bestPairs: ['SOLUSDT'],
      note: 'Momentum con swing highs/lows + VWAP + ADX filtro',
    },
  },
  {
    id: 'SaltandoDelLambo',
    label: 'Del Lambo',
    color: '#3b82f6',
    desc: 'Rango Donchian 4h — BTC/BNB',
    stats: {
      winRate: 42,
      profitFactor: 1.38,
      bestTimeframe: '4H',
      bestPairs: ['BNBUSDT', 'BTCUSDT (monitoreo)'],
      note: 'Range bounce Donchian • mejor en mercados laterales',
    },
  },
  {
    id: 'SmartMoney',
    label: 'Smart Money',
    color: '#22c55e',
    desc: 'ICT structure 1h/4h',
    stats: {
      winRate: 38,
      profitFactor: 1.22,
      bestTimeframe: '4H',
      bestPairs: ['SOLUSDT', 'ETHUSDT'],
      note: 'Estructura ICT: LH+LL / HL+HH con confirmación HTF',
    },
  },
  {
    id: 'VWAPMomentum',
    label: 'VWAP',
    color: '#06b6d4',
    desc: 'VWAP momentum 1h',
    stats: {
      winRate: 35,
      profitFactor: 1.15,
      bestTimeframe: '1H',
      bestPairs: ['ETHUSDT', 'BTCUSDT (monitoreo)'],
      note: 'Cruce de precio sobre VWAP con volumen • funciona en trending',
    },
  },
];

const STORAGE_KEY = 'activeStrategies_v1';

function loadActiveStrategies(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      // Asegurarse de que son strings válidos
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return ALL_STRATEGIES.map(s => s.id); // por defecto: todas activas
}

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

  activeStrategies: string[];
  toggleStrategy: (id: string) => void;
  setAllStrategies: (ids: string[]) => void;

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
  activeStrategies: loadActiveStrategies(),

  setSymbol: (s) => set({ symbol: s }),
  setTimeframe: (t) => set({ timeframe: t }),

  toggleStrategy: (id) => {
    const cur = get().activeStrategies;
    const next = cur.includes(id) ? cur.filter(s => s !== id) : [...cur, id];
    // Mantener al menos 1 activa
    if (next.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ activeStrategies: next });
  },

  setAllStrategies: (ids) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    set({ activeStrategies: ids });
  },

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
