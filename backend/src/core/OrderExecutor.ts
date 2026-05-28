import { prisma } from '../db/prisma';
import type { IExchangeAdapter } from '../exchanges/IExchangeAdapter';
import { alertTradeClosed, alertTradeOpened } from '../integrations/AlertService';
import type { Signal } from '../types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class OrderExecutor {
  constructor(private readonly exchange: IExchangeAdapter) {}

  async executeSignal(signal: Signal & { signalId: string }) {
    const quoteAmount = config.bot.riskPerTradeUsdt;
    const quantity = quoteAmount / signal.entryPrice;
    // Precision de cantidad segun par (stepSize de Binance testnet)
    const QTY_PRECISION: Record<string,number> = {
      'BTCUSDT': 5, 'ETHUSDT': 4, 'BNBUSDT': 3,
      'ADAUSDT': 0, 'SOLUSDT': 2, 'XRPUSDT': 0,
      'DOGEUSDT': 0, 'MATICUSDT': 0,
    };
    const decimals = QTY_PRECISION[signal.symbol] ?? 4;
    const factor = Math.pow(10, decimals);
    const qtyRounded = Math.floor(quantity * factor) / factor;
    if (qtyRounded <= 0) { logger.warn('Quantity 0 para ' + signal.symbol); return null; }

    let entryPrice = signal.entryPrice;
    let executedQty = qtyRounded;
    let orderId: string | null = null;

    if (config.bot.autoExecute && !global.__botOffline) {
      try {
        const res = await this.exchange.placeMarketOrder(signal.symbol, signal.direction, qtyRounded);
        entryPrice = res.price || entryPrice;
        executedQty = res.quantity || qtyRounded;
        orderId = res.id;
        logger.info('Orden ejecutada: ' + signal.direction + ' ' + executedQty + ' ' + signal.symbol + ' @ ' + entryPrice);
      } catch (err) {
        logger.error('Error orden ' + signal.symbol + ': ' + (err as Error).message + ' — fallback a paper');
      }
    } else {
      logger.info('[PAPER] ' + signal.direction + ' ' + qtyRounded + ' ' + signal.symbol + ' @ ' + entryPrice);
    }

    const trade = await prisma.trade.create({
      data: {
        signalId: signal.signalId,
        symbol: signal.symbol,
        direction: signal.direction,
        entryPrice,
        quantity: executedQty,
        stopLoss: signal.stopLoss,
        targetPrice: signal.targetPrice,
        status: 'open',
        strategy: signal.strategy ?? null,
      },
    });
    await prisma.signal.update({ where: { id: signal.signalId }, data: { status: 'executed' } });

    // Alerta de trade abierto
    void alertTradeOpened({
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice,
      quantity: executedQty,
      stopLoss: signal.stopLoss,
      targetPrice: signal.targetPrice,
      strategy: signal.strategy,
    });

    return { trade, orderId };
  }

  async monitorOpenTrades(getPrice: (symbol: string) => Promise<number>) {
    const open = await prisma.trade.findMany({ where: { status: 'open' } });
    for (const t of open) {
      let price: number;
      try { price = await getPrice(t.symbol); }
      catch (err) { logger.warn('No precio ' + t.symbol + ': ' + (err as Error).message); continue; }

      let close: 'target' | 'stop' | null = null;
      
      // Partial Take Profit: cerrar 50% en TP1 (5%), dejar 50% en TP2 (10%)
      const gainPctPartial = t.direction === 'BUY'
        ? (price - t.entryPrice) / t.entryPrice * 100
        : (t.entryPrice - price) / t.entryPrice * 100;
      
      // Si ganó 5% y aún no hizo partial close, cerrar la mitad
      if (gainPctPartial >= 5 && !(t as any).partialClosed) {
        try {
          const halfQty = t.quantity / 2;
          if (halfQty > 0) {
            logger.info(`[PARTIAL_TP] ${t.symbol} +5% — cerrando 50% (${halfQty})`);
            // Marcar como partial closed en meta
            await (prisma as any).trade.update({
              where: { id: t.id },
              data: { 
                meta: JSON.stringify({ ...(t as any).meta, partialClosed: true, partialClosePrice: price }),
                targetPrice: t.entryPrice * (t.direction === 'BUY' ? 1.10 : 0.90), // TP2 al 10%
              }
            });
            // Alerta de partial TP
            void alertTradeClosed({
              symbol: t.symbol,
              direction: t.direction,
              entryPrice: t.entryPrice,
              exitPrice: price,
              pnl: halfQty * Math.abs(price - t.entryPrice),
              pnlPercent: gainPctPartial,
              closedReason: 'partial_tp',
            });
          }
        } catch {}
      }

      // Trailing stop: si el trade gana >3%, mover el SL al breakeven
      const gainPct = t.direction === 'BUY'
        ? (price - t.entryPrice) / t.entryPrice * 100
        : (t.entryPrice - price) / t.entryPrice * 100;
      
      let effectiveSL = t.stopLoss;
      if (gainPct > 3) {
        // Mover SL al breakeven (entry price)
        if (t.direction === 'BUY' && t.entryPrice > t.stopLoss) {
          effectiveSL = t.entryPrice * 1.001; // breakeven + 0.1% de buffer
        } else if (t.direction === 'SELL' && t.entryPrice < t.stopLoss) {
          effectiveSL = t.entryPrice * 0.999;
        }
      }
      if (gainPct > 5) {
        // Trailing: mover SL al 50% de la ganancia actual
        if (t.direction === 'BUY') {
          const trailingStop = price - (price - t.entryPrice) * 0.5;
          effectiveSL = Math.max(effectiveSL, trailingStop);
        } else {
          const trailingStop = price + (t.entryPrice - price) * 0.5;
          effectiveSL = Math.min(effectiveSL, trailingStop);
        }
      }
      if (t.direction === 'BUY') {
        if (price >= t.targetPrice) close = 'target';
        else if (price <= effectiveSL) close = 'stop';
      } else {
        if (price <= t.targetPrice) close = 'target';
        else if (price >= effectiveSL) close = 'stop';
      }
      if (!close) continue;

      // Ejecutar orden de cierre en Binance si autoExecute esta activo
      let exitPrice = price;
      if (config.bot.autoExecute && !global.__botOffline) {
        try {
          // Para cerrar un BUY mandamos SELL, para cerrar un SELL mandamos BUY
          const closeSide = t.direction === 'BUY' ? 'SELL' : 'BUY';
          // En futuros: reduceOnly=true para no abrir posición opuesta accidentalmente
          const isFutures = config.tradingMode === 'futures';
          const res = await this.exchange.placeMarketOrder(t.symbol, closeSide, t.quantity, isFutures);
          exitPrice = res.price || price;
          logger.info('Orden cierre ejecutada: ' + closeSide + ' ' + t.quantity + ' ' + t.symbol + ' @ ' + exitPrice + ' (' + close + ')');
        } catch (err) {
          logger.error('Error orden cierre ' + t.symbol + ': ' + (err as Error).message);
          // Igual cerramos en DB con el precio actual
        }
      }

      const pnl = t.direction === 'BUY'
        ? (exitPrice - t.entryPrice) * t.quantity
        : (t.entryPrice - exitPrice) * t.quantity;
      const pnlPercent = t.direction === 'BUY'
        ? ((exitPrice - t.entryPrice) / t.entryPrice) * 100
        : ((t.entryPrice - exitPrice) / t.entryPrice) * 100;

      await prisma.trade.update({
        where: { id: t.id },
        data: { exitPrice, pnl, pnlPercent, status: 'closed', closedReason: close, closedAt: new Date() },
      });

      void alertTradeClosed({
        symbol: t.symbol, direction: t.direction,
        entryPrice: t.entryPrice, exitPrice, pnl, pnlPercent, closedReason: close,
      });

      logger.info(
        'Trade ' + t.id + ' cerrado por ' + close +
        ' | ' + t.symbol + ' ' + t.direction +
        ' | Entry: ' + t.entryPrice +
        ' | Exit: ' + exitPrice +
        ' | PnL: ' + pnl.toFixed(2) + ' USDT (' + pnlPercent.toFixed(2) + '%)'
      );
    }
  }
}