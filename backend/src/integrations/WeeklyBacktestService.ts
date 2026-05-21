import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { runBacktestForService } from '../routes/backtest';
import { sendWeeklyReport } from './AlertService';

const STRATEGIES = ['Confluence', 'VWAPMomentum', 'SmartMoney', 'DruLozano', 'MarceMillo'];
const INTERVAL = '1h';
const DAYS_BACK = 28;

export class WeeklyBacktestService {
  private timeout: NodeJS.Timeout | null = null;

  start() {
    this.schedule();
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private schedule() {
    const now = new Date();
    // Próximo lunes a las 08:00 local
    const next = new Date(now);
    const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilMonday);
    next.setHours(8, 0, 0, 0);
    const msUntil = next.getTime() - now.getTime();

    logger.info(
      `Backtest semanal programado para ${next.toISOString().split('T')[0]} 08:00 ` +
      `(en ${Math.round(msUntil / 3_600_000)}h)`
    );

    this.timeout = setTimeout(async () => {
      await this.runReport();
      this.schedule();
    }, msUntil);
  }

  /** Ejecuta el reporte manualmente (útil para pruebas o trigger manual). */
  async runReport(): Promise<void> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    logger.info(`Ejecutando backtest semanal | ${startDate} → ${endDate}`);

    const results: Array<{
      symbol: string;
      stats: { global: any; byStrategy: Record<string, any>; candlesCount: number };
    }> = [];

    for (const symbol of config.bot.symbols) {
      try {
        const stats = await runBacktestForService(symbol, INTERVAL, startDate, endDate, STRATEGIES);
        results.push({ symbol, stats });
        logger.info(
          `Backtest semanal ${symbol}: ${stats.global.totalTrades}t | ` +
          `WR:${stats.global.winRate}% | PnL:${stats.global.totalPnlPct}%`
        );
      } catch (err) {
        logger.warn(`Backtest semanal error ${symbol}: ${(err as Error).message}`);
      }
    }

    if (results.length > 0) {
      await sendWeeklyReport(results, startDate, endDate);
      logger.info('Reporte semanal enviado por email');
    }
  }
}
