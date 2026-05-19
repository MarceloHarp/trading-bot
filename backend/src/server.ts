import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { StrategyEngine } from './core/StrategyEngine';
import { prisma } from './db/prisma';
import { BinanceAdapter } from './exchanges/BinanceAdapter';
import { buildRoutes } from './routes/api';
import { backtestRouter } from './routes/backtest';
import { buildIndicatorsRouter } from './routes/indicators';
import { config } from './utils/config';
import { logger } from './utils/logger';

declare global { var __botOffline: boolean; }
global.__botOffline = false;

(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function main() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
  });

  const exchange = new BinanceAdapter();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '10mb' }));

  app.use((req, _res, next) => {
    if (!req.path.startsWith('/socket.io')) logger.debug(req.method + ' ' + req.path);
    next();
  });

  const engine = new StrategyEngine(exchange, io);
  engine.start();

  app.use('/api', buildRoutes(exchange, engine));
  app.use('/api/backtest', backtestRouter);
  app.use('/api', buildIndicatorsRouter((symbol, interval, limit) => exchange.getCandles(symbol, interval, limit)));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  io.on('connection', (socket) => {
    logger.info('Cliente WS conectado: ' + socket.id);
    socket.on('disconnect', () => logger.info('Cliente WS desconectado: ' + socket.id));
  });

  const shutdown = async () => {
    logger.info('Shutdown iniciado...');
    engine.stop();
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
