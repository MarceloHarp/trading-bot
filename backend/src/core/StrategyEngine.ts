import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../db/prisma';
import { BinanceAdapter } from '../exchanges/BinanceAdapter';
import { claudeAPI } from '../integrations/ClaudeAPI';
import { alertRateLimitReached, alertSignal, alertSignalOffline } from '../integrations/AlertService';
import type { Candle, Signal } from '../types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { OrderExecutor } from './OrderExecutor';
import { ConfluenceStrategy } from './strategies/Confluence';
import { SmartMoneyStrategy } from './strategies/SmartMoney';
import type { Strategy } from './strategies/Strategy';
import { VWAPMomentumStrategy } from './strategies/VWAPMomentum';
import { DruLozanoStrategy } from './strategies/DruLozano';

export class StrategyEngine {
  private readonly strategies: Strategy[];
  private readonly executor: OrderExecutor;
  private running = false;
  private interval: NodeJS.Timeout | null = null;
  private cooldown = new Map<string, number>();
  private readonly cooldownMs = 60 * 60 * 1000;
  private signalTimestamps: number[] = [];
  private rateLimitAlertedHour = false;
  private rateLimitAlertedDay = false;

  constructor(private readonly exchange: BinanceAdapter, private readonly io: SocketIOServer) {
    this.strategies = [new SmartMoneyStrategy(), new VWAPMomentumStrategy(), new ConfluenceStrategy(), new DruLozanoStrategy()];
    this.executor = new OrderExecutor(exchange);
  }

  start() {
    if (this.running) return;
    this.running = true;
    logger.info(
      `StrategyEngine iniciado | symbols=${config.bot.symbols.join(',')} ` +
      `timeframes=${config.bot.timeframes.join(',')} ` +
      `maxPerHour=${config.bot.maxSignalsPerHour || 'sin limite'} ` +
      `maxPerDay=${config.bot.maxSignalsPerDay || 'sin limite'}`
    );
    this.tick().catch((e) => logger.error('Engine tick error: ' + (e as Error).message));
    this.interval = setInterval(() => {
      this.tick().catch((e) => logger.error('Engine tick error: ' + (e as Error).message));
    }, config.bot.engineIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private purgOldTimestamps() {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.signalTimestamps = this.signalTimestamps.filter((t) => t > dayAgo);
  }

  private signalsLastHour(): number {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return this.signalTimestamps.filter((t) => t > hourAgo).length;
  }

  private signalsLastDay(): number { return this.signalTimestamps.length; }

  private async checkLimits(): Promise<boolean> {
    // 1) Limite de trades abiertos simultaneos
    const maxOpen = config.bot.maxOpenTrades;
    if (maxOpen > 0) {
      const openCount = await prisma.trade.count({ where: { status: 'open' } });
      if (openCount >= maxOpen) {
        logger.debug(`Limite de trades abiertos alcanzado (${openCount}/${maxOpen})`);
        return true;
      }
    }

    // 2) Rate limit por hora (memoria)
    this.purgOldTimestamps();
    const perHour = config.bot.maxSignalsPerHour;
    const perDay = config.bot.maxSignalsPerDay;

    if (perHour > 0 && this.signalsLastHour() >= perHour) {
      if (!this.rateLimitAlertedHour) {
        this.rateLimitAlertedHour = true;
        logger.warn(`Rate limit horario alcanzado (${perHour}/h)`);
        void alertRateLimitReached(`${perHour} signals/hora`);
      }
      return true;
    }

    // 3) Rate limit por dia — consultar la DB para sobrevivir reinicios
    if (perDay > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = await prisma.signal.count({
        where: {
          createdAt: { gte: startOfDay },
          status: { not: 'rejected' },
        },
      });
      if (todayCount >= perDay) {
        if (!this.rateLimitAlertedDay) {
          this.rateLimitAlertedDay = true;
          logger.warn(`Rate limit diario alcanzado (${todayCount}/${perDay})`);
          void alertRateLimitReached(`${perDay} signals/dia`);
        }
        return true;
      }
    }

    if (perHour > 0 && this.signalsLastHour() < perHour) this.rateLimitAlertedHour = false;
    if (perDay > 0) this.rateLimitAlertedDay = false;
    return false;
  }

  private isRateLimited(): boolean {
    // Mantener compatibilidad — el check real es async en checkLimits()
    this.purgOldTimestamps();
    return false;
  }

  private cooldownKey(symbol: string, timeframe: string, strategy: string) {
    return `${symbol}|${timeframe}|${strategy}`;
  }

  private inCooldown(key: string): boolean {
    const t = this.cooldown.get(key);
    if (!t) return false;
    return Date.now() - t < this.cooldownMs;
  }

  private async tick() {
    if (!this.running) return;
    try {
      await this.executor.monitorOpenTrades((sym) => this.exchange.getPrice(sym));
    } catch (err) {
      logger.warn('monitorOpenTrades error: ' + (err as Error).message);
    }
    for (const symbol of config.bot.symbols) {
      for (const timeframe of config.bot.timeframes) {
        let candles: Candle[];
        try {
          candles = await this.exchange.getCandles(symbol, timeframe, 300);
        } catch (err) {
          logger.warn(`getCandles fallo ${symbol} ${timeframe}: ${(err as Error).message}`);
          continue;
        }
        if (candles.length < 100) continue;
        this.persistCandles(candles).catch(() => undefined);
        for (const strategy of this.strategies) {
          if (await this.checkLimits()) continue;
          const key = this.cooldownKey(symbol, timeframe, strategy.name);
          if (this.inCooldown(key)) continue;
          let signal: Signal | null = null;
          try {
            signal = strategy.evaluate(symbol, timeframe, candles);
          } catch (err) {
            logger.warn(`Strategy ${strategy.name} error: ${(err as Error).message}`);
            continue;
          }
          if (!signal) continue;
          this.cooldown.set(key, Date.now());
          await this.handleSignal(signal);
        }
      }
    }
  }

  private async handleSignal(signal: Signal) {
    logger.info(`Signal ${signal.strategy} ${signal.direction} ${signal.symbol} ${signal.timeframe} @ ${signal.entryPrice}`);
    let aiVerdict = { approved: true, comment: '' };
    if (config.bot.claudeValidation && claudeAPI.enabled()) {
      aiVerdict = await claudeAPI.validateSignal(signal);
      logger.info(`Claude verdict: ${aiVerdict.approved ? 'APPROVE' : 'REJECT'} — ${aiVerdict.comment}`);
    }
    const dbSignal = await prisma.signal.create({
      data: {
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        direction: signal.direction,
        strategy: signal.strategy,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        targetPrice: signal.targetPrice,
        confidence: signal.confidence,
        reason: signal.reason,
        meta: signal.meta ? JSON.stringify(signal.meta) : null,
        validatedByAI: config.bot.claudeValidation && claudeAPI.enabled(),
        aiVerdict: aiVerdict.approved ? 'approved' : 'rejected',
        aiComment: aiVerdict.comment,
        status: aiVerdict.approved ? 'new' : 'rejected',
      },
    });
    this.signalTimestamps.push(Date.now());
    this.io.emit('signal', { ...dbSignal });
    // Alerta diferente según modo online/offline
    if (global.__botOffline) {
      void alertSignalOffline(signal);
    } else {
      void alertSignal(signal);
    }
    if (!aiVerdict.approved) {
      logger.warn(`Signal rechazado por Claude: ${signal.symbol} ${signal.strategy}`);
      return;
    }
    try {
      const result = await this.executor.executeSignal({ ...signal, signalId: dbSignal.id });
      if (result) this.io.emit('trade', result.trade);
    } catch (err) {
      logger.error('executeSignal error: ' + (err as Error).message);
    }
  }

  private async persistCandles(candles: Candle[]) {
    const recent = candles.slice(-5);
    for (const c of recent) {
      try {
        await prisma.candle.upsert({
          where: { symbol_timeframe_openTime: { symbol: c.symbol, timeframe: c.timeframe, openTime: BigInt(c.openTime) } },
          update: { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, closeTime: BigInt(c.closeTime) },
          create: { symbol: c.symbol, timeframe: c.timeframe, openTime: BigInt(c.openTime), closeTime: BigInt(c.closeTime), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume },
        });
      } catch { /* ignore */ }
    }
  }

  async getRateLimitStats() {
    this.purgOldTimestamps();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await prisma.signal.count({
      where: { createdAt: { gte: startOfDay }, status: { not: 'rejected' } },
    });
    const openCount = await prisma.trade.count({ where: { status: 'open' } });
    return {
      signalsLastHour: this.signalsLastHour(),
      signalsLastDay: todayCount,
      maxPerHour: config.bot.maxSignalsPerHour,
      maxPerDay: config.bot.maxSignalsPerDay,
      maxOpenTrades: config.bot.maxOpenTrades,
      openTrades: openCount,
      isLimited: await this.checkLimits(),
    };
  }
}