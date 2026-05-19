import Anthropic from '@anthropic-ai/sdk';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { AIVerdict, Signal } from '../types';

/**
 * Wrapper sobre la SDK de Anthropic para validar signals.
 * - Rate limit interno básico (no exceder cuota por minuto).
 * - Fallback graceful: si no hay API key o falla, deja pasar el signal
 *   pero registra que no fue validado.
 */
export class ClaudeAPI {
  private readonly client: Anthropic | null;
  private readonly model: string;
  private requests: number[] = []; // timestamps del último minuto

  constructor() {
    this.model = config.claude.model;
    if (config.claude.apiKey && config.claude.apiKey.startsWith('sk-ant')) {
      this.client = new Anthropic({ apiKey: config.claude.apiKey });
    } else {
      this.client = null;
      logger.warn('Claude API key no configurada — validación deshabilitada');
    }
  }

  enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Pide a Claude un veredicto APPROVE / REJECT sobre un signal.
   * Devuelve el veredicto y el comentario.
   */
  async validateSignal(signal: Signal): Promise<AIVerdict> {
    if (!this.client) {
      return { approved: true, comment: 'Claude no configurado — aprobado por defecto' };
    }

    // Rate limit naive: max 30 req/min
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < 60_000);
    if (this.requests.length >= 30) {
      logger.warn('Rate limit de Claude alcanzado, signal aprobado sin validación');
      return { approved: true, comment: 'Skipped: rate limit local' };
    }
    this.requests.push(now);

    const prompt = this.buildPrompt(signal);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n')
        .trim();

      const upper = text.toUpperCase();
      const approved = upper.includes('APPROVE') && !upper.includes('REJECT');
      return {
        approved,
        comment: text.slice(0, 500),
      };
    } catch (err) {
      logger.warn(`Claude API error: ${(err as Error).message}`);
      return { approved: true, comment: 'Error consultando Claude — aprobado por defecto' };
    }
  }

  private buildPrompt(signal: Signal): string {
    const rr =
      signal.direction === 'BUY'
        ? (signal.targetPrice - signal.entryPrice) / (signal.entryPrice - signal.stopLoss)
        : (signal.entryPrice - signal.targetPrice) / (signal.stopLoss - signal.entryPrice);

    return [
      'Sos un analista cuantitativo de trading cripto. Recibis un signal y debes decidir APPROVE o REJECT.',
      '',
      `Símbolo: ${signal.symbol}`,
      `Timeframe: ${signal.timeframe}`,
      `Estrategia: ${signal.strategy}`,
      `Dirección: ${signal.direction}`,
      `Entry: ${signal.entryPrice}`,
      `Stop Loss: ${signal.stopLoss}`,
      `Target: ${signal.targetPrice}`,
      `Risk/Reward: ${rr.toFixed(2)}`,
      `Confianza estrategia: ${(signal.confidence * 100).toFixed(0)}%`,
      `Razón: ${signal.reason}`,
      `Metadata: ${JSON.stringify(signal.meta ?? {})}`,
      '',
      'Reglas:',
      '- RECHAZAR si R:R < 1.2',
      '- RECHAZAR si la confianza < 0.5 y no hay confluencia clara',
      '- APROBAR si la lógica es coherente y la gestión de riesgo es razonable',
      '',
      'Respondé en una línea: "APPROVE: <comentario corto>" o "REJECT: <razón>".',
    ].join('\n');
  }
}

export const claudeAPI = new ClaudeAPI();
