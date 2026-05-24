import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../db/prisma';
import type { IExchangeAdapter } from '../exchanges/IExchangeAdapter';
import { claudeAPI } from '../integrations/ClaudeAPI';
import { alertRateLimitReached, alertSignal, alertSignalOffline } from '../integrations/AlertService';
import type { Candle, Signal } from '../types';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ema } from './indicators';
import { OrderExecutor } from './OrderExecutor';
import { ConfluenceStrategy } from './strategies/Confluence';
import { SmartMoneyStrategy } from './strategies/SmartMoney';
import type { Strategy } from './strategies/Strategy';
import { VWAPMomentumStrategy } from './strategies/VWAPMomentum';
import { DruLozanoStrategy } from './strategies/DruLozano';
import { MarceMilloStrategy } from './strategies/MarceMillo';
import { SaltandoDelLamboStrategy } from './strategies/SaltandoDelLambo';
import { GatilloFacilStrategy } from './strategies/GatilloFacil';
import { ElTigreStrategy } from './strategies/ElTigre';

/**
 * Restricciones por estrategia basadas en backtest 1 año (Mayo 2025–2026).
 * allowedTimeframes: TFs donde la estrategia tiene PF > 1 consistentemente.
 * allowedSymbols[tf]: si se especifica, SOLO esos símbolos en ese TF.
 * blockedSymbols[tf]: si se especifica, EXCLUIR esos símbolos en ese TF.
 */
const STRATEGY_CONSTRAINTS: Record<string, {
  allowedTimeframes: string[];
  allowedSymbols?: Record<string, string[]>;
  blockedSymbols?: Record<string, string[]>;
}> = {
  // ElTigre: rentable en 1h/4h todos; en 1d SOLO AVAX+SOL (PF 3.12 y 1.21)
  ElTigre: {
    allowedTimeframes: ['1h', '4h', '1d'],
    allowedSymbols: { '1d': ['AVAXUSDT', 'SOLUSDT'] },
  },
  // GatilloFacil: PF ~1 en 1h (marginal) → solo 4h
  GatilloFacil: {
    allowedTimeframes: ['4h'],
  },
  // MarceMillo: solo SOL 1h (PF 1.33); pierde en 4h y en otros pares
  MarceMillo: {
    allowedTimeframes: ['1h'],
    allowedSymbols: { '1h': ['SOLUSDT'] },
  },
  // SaltandoDelLambo: 1h solo SOL/BNB/BTC (PF>1); 4h todos; 1d sin trades
  SaltandoDelLambo: {
    allowedTimeframes: ['1h', '4h'],
    allowedSymbols: { '1h': ['SOLUSDT', 'BNBUSDT', 'BTCUSDT'] },
  },
  // SmartMoney: el mejor global — 1h y 4h en todos; pierde en 1d
  SmartMoney: {
    allowedTimeframes: ['1h', '4h'],
  },
  // VWAPMomentum: AVAX 1h PF 0.92 (pierde) → bloqueado; 4h todos ok
  VWAPMomentum: {
    allowedTimeframes: ['1h', '4h'],
    blockedSymbols: { '1h': ['AVAXUSDT'] },
  },
};

export class StrategyEngine {
  private readonly strategies: Strategy[];
  private readonly executor: OrderExecutor;
  private running = false;
  private interval: NodeJS.Timeout | null = null;
  private tickRunning = false;           // guard: evita ticks concurrentes
  private cooldown = new Map<string, number>();
  private readonly cooldownMs    = 60 * 60 * 1000;       // 1h para 1h/4h
  private readonly cooldownMs1d  = 24 * 60 * 60 * 1000;  // 24h para 1d
  private signalTimestamps: number[] = [];
  private rateLimitAlertedHour = false;
  private rateLimitAlertedDay = false;
  // Régimen macro definido por BTC ("el rey"). Filtra dirección de señales en alts.
  private marketRegime: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  private readonly nonTradable = new Set(config.bot.nonTradableSymbols);

  constructor(private readonly exchange: IExchangeAdapter, private readonly io: SocketIOServer) {
    // Solo las estrategias rentables corren en live.
    // Confluence (-0.05%) y DruLozano (-0.03%) están comentadas — pierden dinero según backtest 28d.
    // Ver ESTRATEGIAS_APRENDIZAJES.md para detalles.
    this.strategies = [
      new SmartMoneyStrategy(),
      new VWAPMomentumStrategy(),
      new MarceMilloStrategy(),
      new SaltandoDelLamboStrategy(),   // range/mean-reversion Donchian, solo 4h (BTC/BNB)
      new GatilloFacilStrategy(),       // BB fade mean-reversion, solo 4h (ETH/BNB/AVAX) — más trades
      new ElTigreStrategy(),            // Swing pullback EMA, solo 1d (ETH/BNB/AVAX) — $10/trade
      // new ConfluenceStrategy(),  // DEACTIVATED: -0.05% PnL, 22.0% WR (28d backtest)
      // new DruLozanoStrategy(),   // DEACTIVATED: -0.03% PnL, 23.7% WR (28d backtest)
    ];
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

  private inCooldown(key: string, timeframe: string): boolean {
    const t = this.cooldown.get(key);
    if (!t) return false;
    // 1D estrategias: cooldown 24h para no disparar la misma condición varias veces al día
    const ms = timeframe === '1d' ? this.cooldownMs1d : this.cooldownMs;
    return Date.now() - t < ms;
  }

  /**
   * Calcula el régimen macro a partir de BTC ("el rey") en 4h.
   * bullish: close > EMA200 y EMA50 > EMA200
   * bearish: close < EMA200 y EMA50 < EMA200
   * neutral: en transición / sin datos suficientes
   */
  private computeRegime(candles4h: Candle[]): 'bullish' | 'bearish' | 'neutral' {
    const closes = candles4h.map((c) => c.close);
    if (closes.length < 200) return 'neutral';
    const ema50 = ema(closes, 50);
    const ema200 = ema(closes, 200);
    const last = closes[closes.length - 1];
    const e50 = ema50[ema50.length - 1];
    const e200 = ema200[ema200.length - 1];
    if ([e50, e200].some((v) => Number.isNaN(v))) return 'neutral';
    if (last > e200 && e50 > e200) return 'bullish';
    if (last < e200 && e50 < e200) return 'bearish';
    return 'neutral';
  }

  private async updateMarketRegime() {
    const sym = config.bot.marketRegimeSymbol;
    if (!sym) return;
    try {
      const c4h = await this.exchange.getCandles(sym, '4h', 300);
      const prev = this.marketRegime;
      this.marketRegime = this.computeRegime(c4h);
      if (prev !== this.marketRegime) {
        logger.info(`👑 Régimen BTC cambió: ${prev} → ${this.marketRegime.toUpperCase()}`);
      }
    } catch (err) {
      logger.warn(`updateMarketRegime error: ${(err as Error).message}`);
    }
  }

  /** El rey manda: bloquea longs si BTC bearish, shorts si BTC bullish. */
  private allowedByRegime(direction: 'BUY' | 'SELL'): boolean {
    if (this.marketRegime === 'bearish' && direction === 'BUY') return false;
    if (this.marketRegime === 'bullish' && direction === 'SELL') return false;
    return true;
  }

  getMarketRegime() {
    return this.marketRegime;
  }

  /**
   * Verifica si una estrategia tiene permiso para correr en un símbolo+timeframe dado.
   * Basado en STRATEGY_CONSTRAINTS arriba, derivado del backtest 1 año.
   */
  private isStrategyAllowed(strategyName: string, symbol: string, timeframe: string): boolean {
    const c = STRATEGY_CONSTRAINTS[strategyName];
    if (!c) return true; // sin restricción → permitir

    // 1) Verificar que el timeframe esté en la lista permitida
    if (!c.allowedTimeframes.includes(timeframe)) return false;

    // 2) Whitelist de símbolos para este TF
    if (c.allowedSymbols?.[timeframe]) {
      if (!c.allowedSymbols[timeframe].includes(symbol)) return false;
    }

    // 3) Blacklist de símbolos para este TF
    if (c.blockedSymbols?.[timeframe]) {
      if (c.blockedSymbols[timeframe].includes(symbol)) return false;
    }

    return true;
  }

  private async tick() {
    if (!this.running) return;
    // Guard: si el tick anterior no terminó, saltear este para evitar señales duplicadas
    if (this.tickRunning) {
      logger.debug('Tick anterior aún corriendo — saltando este ciclo');
      return;
    }
    this.tickRunning = true;
    try {
      await this._tickBody();
    } finally {
      this.tickRunning = false;
    }
  }

  private async _tickBody() {
    try {
      await this.executor.monitorOpenTrades((sym) => this.exchange.getPrice(sym));
    } catch (err) {
      logger.warn('monitorOpenTrades error: ' + (err as Error).message);
    }
    // El rey primero: actualizar régimen macro antes de evaluar alts
    await this.updateMarketRegime();
    for (const symbol of config.bot.symbols) {
      // Fase 1: pre-cargar velas de todos los timeframes para poder pasar HTF a estrategias
      const candleMap = new Map<string, Candle[]>();
      for (const timeframe of config.bot.timeframes) {
        try {
          const candles = await this.exchange.getCandles(symbol, timeframe, 300);
          if (candles.length >= 100) {
            candleMap.set(timeframe, candles);
            this.persistCandles(candles).catch(() => undefined);
          }
        } catch (err) {
          logger.warn(`getCandles fallo ${symbol} ${timeframe}: ${(err as Error).message}`);
        }
      }

      // Fase 2: evaluar estrategias con acceso a candles de todos los TF
      for (const timeframe of config.bot.timeframes) {
        const candles = candleMap.get(timeframe);
        if (!candles) continue;
        for (const strategy of this.strategies) {
          // Filtro por restricciones de backtest (símbolo + timeframe permitidos)
          if (!this.isStrategyAllowed(strategy.name, symbol, timeframe)) continue;
          const key = this.cooldownKey(symbol, timeframe, strategy.name);
          if (this.inCooldown(key, timeframe)) continue;
          if (await this.checkLimits()) continue;
          let signal: Signal | null = null;
          try {
            // SmartMoney y MarceMillo en 1h reciben candles 4h para confirmación HTF
            const needsHTF = (strategy.name === 'SmartMoney' || strategy.name === 'MarceMillo') && timeframe === '1h';
            const htfCandles = needsHTF ? candleMap.get('4h') : undefined;
            signal = strategy.evaluate(symbol, timeframe, candles, htfCandles);
          } catch (err) {
            logger.warn(`Strategy ${strategy.name} error: ${(err as Error).message}`);
            continue;
          }
          if (!signal) continue;

          // BTC ("el rey") se monitorea pero no se opera: emitimos señal/alerta sin ejecutar trade
          if (this.nonTradable.has(symbol)) {
            this.cooldown.set(key, Date.now());
            logger.info(`👑 Señal BTC ${signal.direction} ${signal.timeframe} (solo monitoreo, no se opera) @ ${signal.entryPrice}`);
            this.io.emit('signal', { ...signal, monitorOnly: true });
            if (global.__botOffline) void alertSignalOffline(signal);
            else void alertSignal(signal);
            continue;
          }

          // Filtro de régimen: el rey manda sobre las alts
          if (!this.allowedByRegime(signal.direction)) {
            logger.debug(`Señal ${signal.direction} ${symbol} bloqueada — régimen BTC ${this.marketRegime}`);
            continue;
          }

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
      marketRegime: this.marketRegime,
      regimeSymbol: config.bot.marketRegimeSymbol,
    };
  }
}