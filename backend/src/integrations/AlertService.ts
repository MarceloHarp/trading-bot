import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { Signal } from '../types';

async function sendEmail(subject: string, body: string): Promise<void> {
  const cfg = config.alerts.email;
  if (!cfg.enabled || !cfg.user || !cfg.to) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: `"Trading Bot" <${cfg.user}>`,
      to: cfg.to,
      subject,
      text: body,
      html: `<div style="font-family:monospace;background:#0a0e1a;color:#e5e7eb;padding:20px;border-radius:8px">
        <pre style="margin:0;white-space:pre-wrap">${body}</pre>
      </div>`,
    });
    logger.info(`📧 Email enviado: ${subject}`);
  } catch (err) {
    logger.warn(`Email error: ${(err as Error).message}`);
  }
}

async function sendTelegram(message: string): Promise<void> {
  const cfg = config.alerts.telegram;
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;
  try {
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text: message, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const data = await res.json() as { description?: string };
      logger.warn(`Telegram error: ${data.description ?? res.statusText}`);
    } else {
      logger.info(`📱 Telegram enviado`);
    }
  } catch (err) {
    logger.warn(`Telegram error: ${(err as Error).message}`);
  }
}

function formatPrice(p: number): string {
  return p > 100 ? p.toFixed(2) : p.toFixed(4);
}

function calcRR(signal: Signal): string {
  const rr = signal.direction === 'BUY'
    ? (signal.targetPrice - signal.entryPrice) / (signal.entryPrice - signal.stopLoss)
    : (signal.entryPrice - signal.targetPrice) / (signal.stopLoss - signal.entryPrice);
  return rr.toFixed(2);
}

/* ==========================================
 * SEÑAL DETECTADA (bot online — va a operar)
 * ========================================== */
export async function alertSignal(signal: Signal): Promise<void> {
  const dir = signal.direction === 'BUY' ? '🟢 COMPRA (LONG)' : '🔴 VENTA (SHORT)';
  const subject = `[${signal.direction}] ${signal.symbol} ${signal.timeframe} — ${signal.strategy}`;
  const body = [
    `${dir}`,
    `Par:       ${signal.symbol} | ${signal.timeframe} | ${signal.strategy}`,
    ``,
    `Entry:     ${formatPrice(signal.entryPrice)}`,
    `Stop Loss: ${formatPrice(signal.stopLoss)}`,
    `Target:    ${formatPrice(signal.targetPrice)}`,
    `R:R:       1:${calcRR(signal)}`,
    `Confianza: ${(signal.confidence * 100).toFixed(0)}%`,
    ``,
    `Razon: ${signal.reason}`,
    ``,
    `⚡ El bot va a ejecutar esta operacion automaticamente.`,
  ].join('\n');

  await Promise.all([
    sendEmail(subject, body),
    sendTelegram(`<b>${subject}</b>\n\n<code>${body}</code>`),
  ]);
}

/* ==========================================
 * SEÑAL EN MODO OFFLINE (bot pausado)
 * ========================================== */
export async function alertSignalOffline(signal: Signal): Promise<void> {
  const dir = signal.direction === 'BUY' ? '🟢 LONG' : '🔴 SHORT';
  const subject = `👁 [OFFLINE] Señal ${signal.direction} ${signal.symbol} — ${signal.strategy}`;
  const body = [
    `⏸ BOT EN MODO OFFLINE — no se ejecutó la operación`,
    ``,
    `${dir} ${signal.symbol} | ${signal.timeframe} | ${signal.strategy}`,
    ``,
    `Entry:     ${formatPrice(signal.entryPrice)}`,
    `Stop Loss: ${formatPrice(signal.stopLoss)}`,
    `Target:    ${formatPrice(signal.targetPrice)}`,
    `R:R:       1:${calcRR(signal)}`,
    `Confianza: ${(signal.confidence * 100).toFixed(0)}%`,
    ``,
    `Razon: ${signal.reason}`,
    ``,
    `👉 Revisá el grafico para ver la flecha de entrada.`,
    `   Si queres operar, activa el bot o abrí la posicion manualmente.`,
  ].join('\n');

  await Promise.all([
    sendEmail(subject, body),
    sendTelegram(`<b>${subject}</b>\n\n<code>${body}</code>`),
  ]);
}

/* ==========================================
 * TRADE ABIERTO (orden ejecutada en Binance)
 * ========================================== */
export async function alertTradeOpened(params: {
  symbol: string;
  direction: string;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  targetPrice: number;
  strategy: string;
}): Promise<void> {
  const { symbol, direction, entryPrice, quantity, stopLoss, targetPrice, strategy } = params;
  const dir = direction === 'BUY' ? '🟢 COMPRA ejecutada' : '🔴 VENTA ejecutada';
  const capital = (entryPrice * quantity).toFixed(2);
  const subject = `✅ Trade abierto: ${direction} ${symbol} @ ${formatPrice(entryPrice)}`;
  const body = [
    `${dir} en Binance Testnet`,
    ``,
    `Par:       ${symbol}`,
    `Estrategia:${strategy}`,
    `Precio:    ${formatPrice(entryPrice)}`,
    `Cantidad:  ${quantity.toFixed(5)}`,
    `Capital:   ${capital} USDT`,
    `Stop Loss: ${formatPrice(stopLoss)}`,
    `Target:    ${formatPrice(targetPrice)}`,
  ].join('\n');

  await Promise.all([
    sendEmail(subject, body),
    sendTelegram(`<b>${subject}</b>\n\n<code>${body}</code>`),
  ]);
}

/* ==========================================
 * TRADE CERRADO (target o stop loss)
 * ========================================== */
export async function alertTradeClosed(params: {
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  closedReason: string;
}): Promise<void> {
  const { symbol, direction, entryPrice, exitPrice, pnl, pnlPercent, closedReason } = params;
  const isWin = pnl > 0;
  const emoji = closedReason === 'target' ? '🎯' : closedReason === 'stop' ? '🛑' : '📋';
  const result = isWin ? 'GANANCIA' : 'PÉRDIDA';
  const subject = `${emoji} Trade cerrado: ${result} ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDT (${symbol})`;
  const body = [
    `${emoji} Trade cerrado — ${closedReason === 'target' ? 'TARGET ALCANZADO' : closedReason === 'stop' ? 'STOP LOSS' : 'MANUAL'}`,
    ``,
    `Par:       ${symbol} ${direction}`,
    `Entry:     ${formatPrice(entryPrice)}`,
    `Exit:      ${formatPrice(exitPrice)}`,
    ``,
    `PnL:       ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDT`,
    `PnL %:     ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
    `Resultado: ${result}`,
  ].join('\n');

  await Promise.all([
    sendEmail(subject, body),
    sendTelegram(`<b>${subject}</b>\n\n<code>${body}</code>`),
  ]);
}

/* ==========================================
 * RATE LIMIT ALCANZADO
 * ========================================== */
export async function alertRateLimitReached(limit: string): Promise<void> {
  const subject = `⏸ Bot pausado — limite de señales (${limit})`;
  const body = `El bot alcanzo el limite configurado: ${limit}. Se reanuda automaticamente al inicio del proximo periodo.`;
  await Promise.all([sendEmail(subject, body), sendTelegram(body)]);
}
