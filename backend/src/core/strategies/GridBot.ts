import type { Strategy } from './Strategy';
import type { Candle, Signal } from '../../types';

/**
 * GridBot — Grid trading strategy for ETHUSDT
 * ------------------------------------------------
 * Places buy orders near lower grid levels and sell orders near upper levels.
 * Each level has exactly one open trade at a time.
 * Profit comes from price oscillating between levels.
 *
 * Grid: $1,800 – $2,400 | 12 intervals | $50 spacing
 * Investment: $600 total ($50 margin per level × 12 levels)
 * SL: 2 spacings away | TP: 1 spacing (collects grid profit)
 */
export class GridBotStrategy implements Strategy {
  readonly name = 'GridBot';

  static readonly SYMBOL    = 'ETHUSDT';
  static readonly LOWER     = 1800;
  static readonly UPPER     = 2400;
  static readonly NUM_GRIDS = 12;
  static readonly SPACING   = (2400 - 1800) / 12; // 50
  static readonly LEVELS    = Array.from({ length: 13 }, (_, i) => 1800 + i * 50);
  // Zona activa: precio debe estar dentro de SPACING/2 ($25) del nivel
  // Con spacing $50: cada nivel "posee" ±$25 a su alrededor
  static readonly HALF_SPACING = (2400 - 1800) / 12 / 2; // 25

  evaluate(_symbol: string, _timeframe: string, _candles: Candle[]): Signal | null {
    // GridBot is handled by a dedicated tick in StrategyEngine — this evaluate() is never called
    return null;
  }
}
