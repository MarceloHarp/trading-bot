import { Router } from 'express';
import { prisma } from '../db/prisma';
import type { BinanceAdapter } from '../exchanges/BinanceAdapter';
import type { StrategyEngine } from '../core/StrategyEngine';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export function buildRoutes(exchange: BinanceAdapter, engine?: StrategyEngine): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    let db = false;
    let binance = false;
    try { await prisma.$queryRaw`SELECT 1`; db = true; } catch { db = false; }
    try { binance = await exchange.ping(); } catch { binance = false; }
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: { db, binance },
      config: {
        symbols: config.bot.symbols,
        timeframes: config.bot.timeframes,
        autoExecute: config.bot.autoExecute,
        claudeValidation: config.bot.claudeValidation,
        maxSignalsPerHour: config.bot.maxSignalsPerHour,
        maxSignalsPerDay: config.bot.maxSignalsPerDay,
      },
    });
  });

  router.get('/candles', async (req, res) => {
    const symbol = String(req.query.symbol ?? 'BTCUSDT');
    const interval = String(req.query.interval ?? '1h');
    const limit = Math.min(1000, Number(req.query.limit ?? 200));
    try {
      const candles = await exchange.getCandles(symbol, interval, limit);
      res.json(candles);
    } catch (err) {
      logger.warn('GET /candles error: ' + (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.get('/signals', async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const signals = await prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(signals);
  });

  router.get('/trades', async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const status = req.query.status as string | undefined;
    const trades = await prisma.trade.findMany({
      where: status ? { status } : undefined,
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
    res.json(trades);
  });

  router.get('/stats', async (_req, res) => {
    const [openTrades, closedTrades] = await Promise.all([
      prisma.trade.count({ where: { status: 'open' } }),
      prisma.trade.findMany({ where: { status: 'closed' } }),
    ]);
    const totalPnl = closedTrades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    const losses = closedTrades.filter((t) => (t.pnl ?? 0) <= 0).length;
    const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;
    const avgPnl = closedTrades.length ? totalPnl / closedTrades.length : 0;
    const signalsTotal = await prisma.signal.count();
    const signalsApproved = await prisma.signal.count({ where: { aiVerdict: 'approved' } });
    const signalsRejected = await prisma.signal.count({ where: { aiVerdict: 'rejected' } });

    res.json({
      trades: { open: openTrades, closed: closedTrades.length, wins, losses, winRate, totalPnl, avgPnl },
      signals: { total: signalsTotal, approved: signalsApproved, rejected: signalsRejected },
      rateLimit: engine ? engine.getRateLimitStats() : null,
    });
  });

  router.get('/balance', async (_req, res) => {
    if (!config.binance.apiKey || !config.binance.apiSecret) {
      return res.status(400).json({ error: 'API keys no configuradas en .env (BINANCE_TESTNET_API_KEY / BINANCE_TESTNET_API_SECRET)' });
    }
    try {
      logger.info('Fetching balance from Binance...');
      const balances = await exchange.getBalance();
      logger.info(`Balance OK: ${balances.length} assets con saldo`);
      res.json(balances);
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`Balance error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/logs', async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const logs = await prisma.engineLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(logs);
  });

  return router;
}
