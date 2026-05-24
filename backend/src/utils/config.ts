import 'dotenv/config';

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v !== '' ? v : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Invalid number env var: ' + name);
  return n;
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error('Missing env var: ' + name);
  return v;
}

export const config = {
  port: num('PORT', 3001),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),
  database: { url: required('DATABASE_URL') },
  tradingMode: optional('TRADING_MODE', 'spot') as 'spot' | 'futures',
  binance: {
    apiKey: optional('BINANCE_TESTNET_API_KEY', ''),
    apiSecret: optional('BINANCE_TESTNET_API_SECRET', ''),
    restUrl: optional('BINANCE_REST_URL', 'https://testnet.binance.vision'),
    wsUrl: optional('BINANCE_WS_URL', 'wss://stream.testnet.binance.vision'),
  },
  futures: {
    apiKey: optional('BINANCE_FUTURES_API_KEY', ''),
    apiSecret: optional('BINANCE_FUTURES_API_SECRET', ''),
    restUrl: optional('BINANCE_FUTURES_REST_URL', 'https://testnet.binancefuture.com'),
    leverage: num('FUTURES_LEVERAGE', 3),
  },
  claude: {
    apiKey: optional('CLAUDE_API_KEY', ''),
    model: optional('CLAUDE_MODEL', 'claude-sonnet-4-6'),
  },
  bot: {
    symbols: optional('TRADING_SYMBOLS', 'BTCUSDT,ETHUSDT')
      .split(',').map((s) => s.trim()).filter(Boolean),
    timeframes: optional('TRADING_TIMEFRAMES', '1h,4h')
      .split(',').map((s) => s.trim()).filter(Boolean),
    engineIntervalMs: num('ENGINE_INTERVAL_MS', 15000),
    riskPct: num('RISK_PCT', 5),
    riskPerTradeUsdt: num('RISK_PER_TRADE_USDT', 100),
    autoExecute: bool('AUTO_EXECUTE', false),
    claudeValidation: bool('CLAUDE_VALIDATION', false),
    maxSignalsPerHour: num('MAX_SIGNALS_PER_HOUR', 0),
    maxSignalsPerDay: num('MAX_SIGNALS_PER_DAY', 0),
    maxOpenTrades: num('MAX_OPEN_TRADES', 5),
    // BTC es "el rey": define el régimen macro pero no se opera directamente.
    marketRegimeSymbol: optional('MARKET_REGIME_SYMBOL', 'BTCUSDT'),
    nonTradableSymbols: optional('NON_TRADABLE_SYMBOLS', 'BTCUSDT')
      .split(',').map((s) => s.trim()).filter(Boolean),
  },
  alerts: {
    email: {
      enabled: bool('ALERT_EMAIL_ENABLED', false),
      host: optional('ALERT_SMTP_HOST', 'smtp.gmail.com'),
      port: num('ALERT_SMTP_PORT', 587),
      user: optional('ALERT_SMTP_USER', ''),
      pass: optional('ALERT_SMTP_PASS', ''),
      to: optional('ALERT_EMAIL_TO', ''),
    },
    telegram: {
      enabled: bool('ALERT_TELEGRAM_ENABLED', false),
      botToken: optional('ALERT_TELEGRAM_BOT_TOKEN', ''),
      chatId: optional('ALERT_TELEGRAM_CHAT_ID', ''),
    },
  },
};

export type AppConfig = typeof config;
