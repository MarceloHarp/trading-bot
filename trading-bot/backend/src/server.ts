import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { StrategyEngine } from './core/StrategyEngine';
import { prisma } from './db/prisma';
import { BinanceAdapter } from './exchanges/BinanceAdapter';
import { buildRoutes } from './routes/api';
import { config } from './utils/config';
import { logger } from './utils/logger';

// =============================================================================
// JSON serializer para BigInt (Prisma usa BigInt para openTime/closeTime)
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function main() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
  });

  const exchange = new BinanceAdapter();

  // Middlewares
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Logging mínimo
  app.use((req, _res, next) => {
    if (!req.path.startsWith('/socket.io')) {
      logger.debug(`${req.method} ${req.path}`);
    }
    next();
  });

  // Strategy engine
  const engine = new StrategyEngine(exchange, io);
  engine.start();

  // Rutas API (pasamos engine para exponer stats de rate limit)
  app.use('/api', buildRoutes(exchange, engine));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Socket.IO
  io.on('connection', (socket) => {
    logger.info(`Cliente WS conectado: ${socket.id}`);
    socket.on('disconnect', () => logger.info(`Cliente WS desconectado: ${socket.id}`));
  });

  // Manejo graceful de shutdown
  const shutdown = async () => {
    logger.info('Shutdown iniciado…');
    engine.stop();
    exchange.closeAll();
    await prisma.$disconnect();
    httpServer.close(() => {
      logger.info('HTTP cerrado');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  httpServer.listen(config.port, () => {
    logger.info(`🚀 Backend escuchando en http://localhost:${config.port}`);
    logger.info(`CORS origin: ${config.corsOrigin}`);
  });
}

main().catch((err) => {
  logger.error('Fatal: ' + (err as Error).message);
  process.exit(1);
});
