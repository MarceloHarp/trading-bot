import { prisma } from '../db/prisma';
import type { BinanceAdapter } from '../exchanges/BinanceAdapter';
import { alertTradeClosed } from '../integrations/AlertService';
import type { Signal } from '../types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * OrderExecutor:
 *  - Calcula quantity en base a RISK_PER_TRADE_USDT.
 *  - Si AUTO_EXECUTE=false → solo guarda Trade en estado "open" (paper).
 *  - Si AUTO_EXECUTE=true  → manda orden de mercado a Binance Testnet.
 *  - Después monitorea precio para cerrar al tocar SL/TP.
 */
export class OrderExecutor {
  constructor(private readonly exchange: BinanceAdapter) {}

  async executeSignal(signal: Signal & { signalId: string }) {
    const quoteAmount = config.bot.riskPerTradeUsdt;
    const quantity = quoteAmount / signal.entryPrice;
    // Round a 5 decimales (Binance suele aceptar más; ajustá si tu símbolo difiere)
    const qtyRounded = Math.floor(quantity * 1e5) / 1e5;

    if (qtyRounded <= 0) {
      logger.warn(`Quantity 0 para ${signal.symbol}, skipping`);
      return null;
    }

    let entryPrice = signal.entryPrice;
    let executedQty = qtyRounded;
    let orderId: string | null = null;

    if (config.bot.autoExecute) {
      try {
        const res = await this.exchange.placeMarketOrder(
          signal.symbol,
          signal.direction,
          qtyRounded
        );
        entryPrice = res.price || entryPrice;
        executedQty = res.quantity || qtyRounded;
        orderId = res.id;
        logger.info(
          `Orden ejecutada en Binance: ${signal.direction} ${executedQty} ${signal.symbol} @ ${entryPrice}`
        );
      } catch (err) {
        logger.error(
          `Error ejecutando orden ${signal.symbol}: ${(err as Error).message} — fallback a paper`
        );
      }
    } else {
      logger.info(
        `[PAPER] ${signal.direction} ${qtyRounded} ${signal.symbol} @ ${entryPrice}`
      );
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
      },
    });

    await prisma.signal.update({
      where: { id: signal.signalId },
      data: { status: 'executed' },
    });

    return { trade, orderId };
  }

  /**
   * Revisa todos los trades abiertos y cierra si tocaron SL o TP.
   * Llamar periódicamente desde StrategyEngine o como tarea aparte.
   */
  async monitorOpenTrades(getPrice: (symbol: string) => Promise<number>) {
    const open = await prisma.trade.findMany({ where: { status: 'open' } });
    for (const t of open) {
      let price: number;
      try {
        price = await getPrice(t.symbol);
      } catch (err) {
        logger.warn(`No se pudo obtener precio de ${t.symbol}: ${(err as Error).message}`);
        continue;
      }

      let close: 'target' | 'stop' | null = null;
      if (t.direction === 'BUY') {
        if (price >= t.targetPrice) close = 'target';
        else if (price <= t.stopLoss) close = 'stop';
      } else {
        if (price <= t.targetPrice) close = 'target';
        else if (price >= t.stopLoss) close = 'stop';
      }

      if (!close) continue;

      const pnl =
        t.direction === 'BUY'
          ? (price - t.entryPrice) * t.quantity
          : (t.entryPrice - price) * t.quantity;
      const pnlPercent =
        t.direction === 'BUY'
          ? ((price - t.entryPrice) / t.entryPrice) * 100
          : ((t.entryPrice - price) / t.entryPrice) * 100;

      await prisma.trade.update({
        where: { id: t.id },
        data: {
          exitPrice: price,
          pnl,
          pnlPercent,
          status: 'closed',
          closedReason: close,
          closedAt: new Date(),
        },
      });

      void alertTradeClosed({
        symbol: t.symbol,
        direction: t.direction,
        entryPrice: t.entryPrice,
        exitPrice: price,
        pnl,
        pnlPercent,
        closedReason: close,
      });

      logger.info(
        `Trade ${t.id} cerrado por ${close} | ${t.symbol} ${t.direction} | PnL: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`
      );
    }
  }
}
