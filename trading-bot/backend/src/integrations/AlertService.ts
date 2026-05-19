import { config } from '../utils/config';
import { logger } from '../utils/logger';
import type { Signal } from '../types';

// nodemailer se importa dinámicamente para no romper si no está instalado
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
      html: `<pre style="font-family:monospace">${body}</pre>`,
    });
    logger.info(`📧 Email enviado a ${cfg.to}: ${subject}`);
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
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      const data = await res.json() as { description?: string };
      logger.warn(`Telegram error: ${data.description ?? res.statusText}`);
    } else {
      logger.info(`📱 Telegram enviado a chat ${cfg.chatId}`);
    }
  } catch (err) {
    logger.warn(`Telegram error: ${(err as Error).message}`);
  }
}

/* ==============================
 * API pública
 * ============================== */

export async function alertSignal(signal: Signal): Promise<void> {
  const dir = signal.direction === 'BUY' ? '🟢 COMPRA' : '🔴 VENTA';
  const rr =
    signal.direction === 'BUY'
      ? ((signal.targetPrice - signal.entryPrice) / (signal.entryPrice - signal.stopLoss)).toFixed(2)
      : ((signal.entryPrice - signal.targetPrice) / (signal.stopLoss - signal.entryPrice)).toFixed(2);

  const subject = `${dir} Signal — ${signal.symbol} ${signal.timeframe} [${signal.strategy}]`;
  const body = [
    `${dir} ${signal.symbol} — ${signal.timeframe} — ${signal.strategy}`,
    ``,
    `Entry:   ${signal.entryPrice}`,
    `Stop:    ${signal.stopLoss}`,
    `Target:  ${signal.targetPrice}`,
    `R:R:     1:${rr}`,
    `Conf:    ${(signal.confidence * 100).toFixed(0)}%`,
    ``,
    `Razón: ${signal.reason}`,
    ``,
    `⚠️  Esto es paper trading — no es asesoramiento financiero.`,
  ].join('\n');

  await Promise.all([
    sendEmail(subject, body),
    sendTelegram(`<b>${subject}</b>\n\n<code>${body}</code>`),
  ]);
}

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
  const emoji = pnl > 0 ? '✅' : '❌';
  const subject = `${emoji} Trade cerrado — ${symbol} ${direction} | PnL: ${pnl.toFixed(2)} USDT`;
  const body = [
    `${emoji} Trade cerrado: ${symbol} ${direction}`,
    ``,
    `Entry:   ${entryPrice}`,
    `Exit:    ${exitPrice}`,
    `PnL:     ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`,
    `Cierre:  ${closedReason === 'target' ? '🎯 Target alcanzado' : '🛑 Stop loss'}`,
  ].join('\n');

  await Promise.all([
    sendEmail(subject, body),
    sendTelegram(`<b>${subject}</b>\n\n<code>${body}</code>`),
  ]);
}

export async function alertRateLimitReached(limit: string): Promise<void> {
  const subject = `⏸️ Bot pausado — límite de signals alcanzado (${limit})`;
  const body = `El bot pausó la generación de nuevas signals porque alcanzó el límite configurado: ${limit}.\nSe reanuda automáticamente al inicio del próximo período.`;
  await Promise.all([sendEmail(subject, body), sendTelegram(body)]);
}
