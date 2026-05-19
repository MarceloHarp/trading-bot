import { prisma } from '../db/prisma';

type Level = 'info' | 'warn' | 'error' | 'debug';

const COLORS: Record<Level, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
};
const RESET = '\x1b[0m';

function fmt(level: Level, msg: string) {
  const ts = new Date().toISOString();
  const color = COLORS[level] ?? '';
  return `${color}[${ts}] [${level.toUpperCase()}]${RESET} ${msg}`;
}

async function persist(level: Level, message: string, context?: unknown) {
  if (level === 'debug') return; // no persistimos debug
  try {
    await prisma.engineLog.create({
      data: {
        level,
        message,
        context: context ? JSON.stringify(context) : undefined,
      },
    });
  } catch {
    // si falla la DB, no rompemos la app
  }
}

export const logger = {
  info(msg: string, ctx?: unknown) {
    console.log(fmt('info', msg), ctx ?? '');
    void persist('info', msg, ctx);
  },
  warn(msg: string, ctx?: unknown) {
    console.warn(fmt('warn', msg), ctx ?? '');
    void persist('warn', msg, ctx);
  },
  error(msg: string, ctx?: unknown) {
    console.error(fmt('error', msg), ctx ?? '');
    void persist('error', msg, ctx);
  },
  debug(msg: string, ctx?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(fmt('debug', msg), ctx ?? '');
    }
  },
};
