import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db/prisma';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { AIVerdict, Signal } from '../types';

// claude-sonnet-4-6 pricing (USD por token)
const COST_INPUT_PER_TOKEN = 3 / 1_000_000;
const COST_OUTPUT_PER_TOKEN = 15 / 1_000_000;

export class ClaudeAPI {
  private readonly client: Anthropic | null;
  private readonly model: string;
  private requests: number[] = [];

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

  async validateSignal(signal: Signal): Promise<AIVerdict> {
    if (!this.client) {
      return { approved: true, comment: 'Claude no configurado — aprobado por defecto' };
    }

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

      // Trackear uso y costo
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const callCost = inputTokens * COST_INPUT_PER_TOKEN + outputTokens * COST_OUTPUT_PER_TOKEN;
      void this.persistUsage(inputTokens, outputTokens, callCost);

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n')
        .trim();

      const upper = text.toUpperCase();
      const approved = upper.includes('APPROVE') && !upper.includes('REJECT');
      return { approved, comment: text.slice(0, 500) };
    } catch (err) {
      logger.warn(`Claude API error: ${(err as Error).message}`);
      return { approved: true, comment: 'Error consultando Claude — aprobado por defecto' };
    }
  }

  private async persistUsage(inputTokens: number, outputTokens: number, costUsd: number) {
    try {
      const current = await prisma.claudeUsage.findUnique({ where: { id: 'singleton' } });
      await prisma.claudeUsage.upsert({
        where: { id: 'singleton' },
        update: {
          totalCalls: (current?.totalCalls ?? 0) + 1,
          inputTokens: (current?.inputTokens ?? 0) + inputTokens,
          outputTokens: (current?.outputTokens ?? 0) + outputTokens,
          totalCostUsd: (current?.totalCostUsd ?? 0) + costUsd,
        },
        create: {
          id: 'singleton',
          totalCalls: 1,
          inputTokens,
          outputTokens,
          totalCostUsd: costUsd,
        },
      });
    } catch {
      // no romper si falla la persistencia
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
