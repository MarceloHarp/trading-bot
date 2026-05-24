import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { StrategyEngine } from './core/StrategyEngine';
import { prisma } from './db/prisma';
import { BinanceAdapter } from './exchanges/BinanceAdapter';
import { BinanceFuturesAdapter } from './exchanges/BinanceFuturesAdapter';
import { buildRoutes } from './routes/api';
import { backtestRouter } from './routes/backtest';
import { buildIndicatorsRouter } from './routes/indicators';
import { WeeklyBacktestService } from './integrations/WeeklyBacktestService';
import { config } from './utils/config';
import { logger } from './utils/logger';

declare global { var __botOffline: boolean; }
global.__botOffline = false;

// Auto-kill cualquier proceso previo que tenga el puerto ocupado (evita EADDRINUSE al reiniciar)
import { execSync } from 'child_process';
try {
  const port = process.env.PORT ?? '3001';
  const out = execSync(`netstat -ano 2>nul | findstr ":${port} "`, { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] });
  const match = out.match(/LISTENING\s+(\d+)/);
  if (match && match[1] !== String(process.pid)) {
    execSync(`taskkill /PID ${match[1]} /F`, { stdio: 'ignore' });
  }
} catch { /* puerto libre, ok */ }

(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function main() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
  });

  const exchange = config.tradingMode === 'futures'
    ? new BinanceFuturesAdapter()
    : new BinanceAdapter();
  logger.info(`Modo trading: ${config.tradingMode.toUpperCase()}`);

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '10mb' }));

  app.use((req, _res, next) => {
    if (!req.path.startsWith('/socket.io')) logger.debug(req.method + ' ' + req.path);
    next();
  });

  const engine = new StrategyEngine(exchange, io);
  engine.start();

  const weeklyBacktest = new WeeklyBacktestService();
  weeklyBacktest.start();

  app.use('/api', buildRoutes(exchange));
  app.use('/api/backtest', backtestRouter);

  // Trigger manual del backtest semanal — espera resultado y reporta errores
  app.post('/api/backtest/run-weekly', async (_req, res: any) => {
    try {
      await weeklyBacktest.runReport();
      res.json({ ok: true, message: 'Backtest semanal completado. Revisá el email.' });
    } catch (err) {
      const msg = (err as Error).message;
      logger.error('Weekly backtest error: ' + msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });
  app.use('/api', buildIndicatorsRouter((symbol, interval, limit) => exchange.getCandles(symbol, interval, limit)));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  io.on('connection', (socket) => {
    logger.info('Cliente WS conectado: ' + socket.id);
    socket.on('disconnect', () => logger.info('Cliente WS desconectado: ' + socket.id));
  });

  const shutdown = async () => {
    logger.info('Shutdown iniciado...');
    engine.stop();
    weeklyBacktest.stop();
    exchange.closeAll();
    await prisma.$disconnect();
    httpServer.close(() => { logger.info('HTTP cerrado'); process.exit(0); });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  httpServer.listen(config.port, () => {
    logger.info('Backend escuchando en http://localhost:' + config.port);
    logger.info('CORS origin: ' + config.corsOrigin);
  });
}

main().catch((err) => { logger.error('Fatal: ' + (err as Error).message); process.exit(1); });
