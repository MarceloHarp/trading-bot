import express, { Router } from 'express';
import { prisma } from '../db/prisma';
import type { IExchangeAdapter } from '../exchanges/IExchangeAdapter';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { sendWeeklyReport } from '../integrations/AlertService';


function parseSignalMeta<T extends { meta: string | null }>(s: T) {
  return { ...s, meta: s.meta ? JSON.parse(s.meta) : null };
}

export function buildRoutes(exchange: IExchangeAdapter): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    let db = false;
    let binance = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    try {
      binance = await exchange.ping();
    } catch {
      binance = false;
    }
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: { db, binance },
      config: {
        symbols: config.bot.symbols,
        timeframes: config.bot.timeframes,
        autoExecute: config.bot.autoExecute,
        claudeValidation: config.bot.claudeValidation,
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
    res.json(signals.map(parseSignalMeta));
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
    const signalsApproved = await prisma.signal.count({
      where: { aiVerdict: 'approved' },
    });
    const signalsRejected = await prisma.signal.count({
      where: { aiVerdict: 'rejected' },
    });

    res.json({
      trades: {
        open: openTrades,
        closed: closedTrades.length,
        wins,
        losses,
        winRate,
        totalPnl,
        avgPnl,
      },
      signals: {
        total: signalsTotal,
        approved: signalsApproved,
        rejected: signalsRejected,
      },
    });
  });

  router.get('/balance', async (_req, res) => {
    try {
      const balances = await exchange.getBalance();
      res.json(balances);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
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

  router.get('/claude-cost', async (_req, res) => {
    const usage = await prisma.claudeUsage.findUnique({ where: { id: 'singleton' } });
    res.json(
      usage ?? {
        id: 'singleton',
        totalCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCostUsd: 0,
        updatedAt: null,
      }
    );
  });

  // DEV: endpoint para escritura remota de archivos
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  const path = require('path');
  router.post('/devwrite', express.json({ limit: '10mb' }), (req: any, res: any) => {
    try {
      const { file, content } = req.body;
      const full = path.resolve(__dirname, '../../../..', file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      res.json({ ok: true, path: full });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}

  // Velas de Binance real (publico) para historial largo en el grafico
  router.get('/candles-public', async (req, res) => {
    const symbol = String(req.query.symbol ?? 'BTCUSDT');
    const interval = String(req.query.interval ?? '1h');
    const limit = Math.min(1000, Number(req.query.limit ?? 500));
    try {
      const axiosLib = require('axios');
      const { data } = await axiosLib.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit },
        timeout: 8000,
      });
      const candles = data.map((r: (number|string)[]) => ({
        symbol, timeframe: interval,
        openTime: Number(r[0]), open: parseFloat(r[1] as string),
        high: parseFloat(r[2] as string), low: parseFloat(r[3] as string),
        close: parseFloat(r[4] as string), volume: parseFloat(r[5] as string),
        closeTime: Number(r[6]),
      }));
      res.json(candles);
    } catch (err) {
      // Fallback a testnet
      try {
        const candles = await exchange.getCandles(symbol, interval, limit);
        res.json(candles);
      } catch (err2) {
        res.status(500).json({ error: (err2 as Error).message });
      }
    }
  });


  // Bot mode: online (ejecuta trades) / offline (solo señales en grafico)
  router.get('/bot-mode', (_req, res) => {
    res.json({ offline: global.__botOffline === true });
  });
  router.post('/bot-mode', (req: any, res: any) => {
    const { offline } = req.body as { offline: boolean };
    global.__botOffline = offline;
    logger.info('Bot mode cambiado: ' + (offline ? 'OFFLINE (solo señales)' : 'ONLINE (ejecuta trades)'));
    res.json({ offline: global.__botOffline === true });
  });



  // Cerrar un trade manualmente al precio actual
  router.post('/trades/:id/close', async (req: any, res: any) => {
    try {
      const trade = await prisma.trade.findUnique({ where: { id: req.params.id } });
      if (!trade || trade.status !== 'open') {
        return res.status(400).json({ error: 'Trade no encontrado o ya cerrado' });
      }
      // Obtener precio actual
      let exitPrice = trade.entryPrice; // fallback
      try {
        exitPrice = await exchange.getPrice(trade.symbol);
      } catch { /* usar entryPrice como fallback */ }

      const pnl = trade.direction === 'BUY'
        ? (exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - exitPrice) * trade.quantity;
      const pnlPercent = trade.direction === 'BUY'
        ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;

      // Si autoExecute, mandar orden de cierre a Binance
      if (process.env.AUTO_EXECUTE === 'true' && !global.__botOffline) {
        try {
          const closeSide = trade.direction === 'BUY' ? 'SELL' : 'BUY';
          await exchange.placeMarketOrder(trade.symbol, closeSide as 'BUY' | 'SELL', trade.quantity);
        } catch (e) {
          logger.warn('Error cerrando en Binance: ' + (e as Error).message);
        }
      }

      const updated = await prisma.trade.update({
        where: { id: req.params.id },
        data: { exitPrice, pnl, pnlPercent, status: 'closed', closedReason: 'manual', closedAt: new Date() },
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Cerrar TODAS las posiciones abiertas manualmente
  router.post('/trades/close-all', async (_req: any, res: any) => {
    try {
      const openTrades = await prisma.trade.findMany({ where: { status: 'open' } });
      let closed = 0;
      for (const trade of openTrades) {
        let exitPrice = trade.entryPrice;
        try { exitPrice = await exchange.getPrice(trade.symbol); } catch { /* noop */ }

        const pnl = trade.direction === 'BUY'
          ? (exitPrice - trade.entryPrice) * trade.quantity
          : (trade.entryPrice - exitPrice) * trade.quantity;
        const pnlPercent = trade.direction === 'BUY'
          ? ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;

        if (process.env.AUTO_EXECUTE === 'true' && !global.__botOffline) {
          try {
            const closeSide = trade.direction === 'BUY' ? 'SELL' : 'BUY';
            await exchange.placeMarketOrder(trade.symbol, closeSide as 'BUY' | 'SELL', trade.quantity);
          } catch { /* noop */ }
        }

        await prisma.trade.update({
          where: { id: trade.id },
          data: { exitPrice, pnl, pnlPercent, status: 'closed', closedReason: 'manual', closedAt: new Date() },
        });
        closed++;
      }
      res.json({ closed });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Borrar un trade individual
  router.delete('/trades/:id', async (req: any, res: any) => {
    try {
      await prisma.trade.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Test de email — envía un email de prueba sin correr el backtest
  router.post('/test-email', async (_req: any, res: any) => {
    try {
      await sendWeeklyReport(
        [{ symbol: 'TEST', stats: { global: { totalTrades: 5, wins: 3, losses: 2, winRate: 60, totalPnlPct: 2.5, maxDrawdown: 1.2, avgWin: 1.8, avgLoss: -0.9, profitFactor: 1.5, finalCapital: 10250, openTrades: 0, equityCurve: [] }, byStrategy: {}, candlesCount: 100 } }],
        new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      res.json({ ok: true, message: 'Email de prueba enviado. Revisá negro.y.gti@gmail.com' });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // PnL en vivo de trades abiertos (precio actual vs entry)
  router.get('/trades/live-pnl', async (_req, res) => {
    try {
      const openTrades = await prisma.trade.findMany({ where: { status: 'open' } });
      const result = await Promise.all(openTrades.map(async (trade) => {
        let currentPrice = trade.entryPrice;
        try { currentPrice = await exchange.getPrice(trade.symbol); } catch { /* fallback entry */ }

        const unrealizedPct = trade.direction === 'BUY'
          ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

        const unrealizedUsdt = trade.direction === 'BUY'
          ? (currentPrice - trade.entryPrice) * trade.quantity
          : (trade.entryPrice - currentPrice) * trade.quantity;

        // Distancia al SL y TP como % del precio actual (negativo = ya cruzado)
        const distToSL = trade.stopLoss != null
          ? trade.direction === 'BUY'
            ? ((trade.stopLoss - currentPrice) / currentPrice) * 100
            : ((currentPrice - trade.stopLoss) / currentPrice) * 100
          : null;
        const distToTP = trade.targetPrice != null
          ? trade.direction === 'BUY'
            ? ((trade.targetPrice - currentPrice) / currentPrice) * 100
            : ((currentPrice - trade.targetPrice) / currentPrice) * 100
          : null;

        return { id: trade.id, symbol: trade.symbol, direction: trade.direction,
          currentPrice, unrealizedPct, unrealizedUsdt, distToSL, distToTP };
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Borrar todos los trades
  router.delete('/trades', async (_req: any, res: any) => {
    try {
      const result = await prisma.trade.deleteMany({});
      res.json({ deleted: result.count });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
