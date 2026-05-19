const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

// ============================================================
// 1) BACKEND: agregar endpoint /api/bot-mode al routes/api.ts
// ============================================================
let api = fs.readFileSync(path.join(base, 'backend\\src\\routes\\api.ts'), 'utf8');

const botModeEndpoint = `
  // Bot mode: online (ejecuta trades) / offline (solo señales en grafico)
  router.get('/bot-mode', (_req, res) => {
    res.json({ offline: global.__botOffline === true });
  });
  router.post('/bot-mode', (req: any, res: any) => {
    const { offline } = req.body as { offline: boolean };
    global.__botOffline = offline;
    logger.info('Bot mode cambiado: ' + (offline ? 'OFFLINE (solo señales)' : 'ONLINE (ejecuta trades)'));
    res.json({ offline: global.__botOffline === true });
  });

`;

if (!api.includes('/bot-mode')) {
  api = api.replace('  return router;', botModeEndpoint + '  return router;');
  fs.writeFileSync(path.join(base, 'backend\\src\\routes\\api.ts'), api, 'utf8');
  console.log('api.ts OK — /bot-mode agregado');
} else {
  console.log('api.ts — /bot-mode ya existia');
}

// ============================================================
// 2) BACKEND: modificar OrderExecutor para respetar botOffline
// ============================================================
let exec = fs.readFileSync(path.join(base, 'backend\\src\\core\\OrderExecutor.ts'), 'utf8');

if (!exec.includes('__botOffline')) {
  exec = exec.replace(
    `    if (config.bot.autoExecute) {
      try {
        const res = await this.exchange.placeMarketOrder(signal.symbol, signal.direction, qtyRounded);`,
    `    if (config.bot.autoExecute && !global.__botOffline) {
      try {
        const res = await this.exchange.placeMarketOrder(signal.symbol, signal.direction, qtyRounded);`
  );
  // También el cierre de trades
  exec = exec.replace(
    `      if (config.bot.autoExecute) {
        try {
          const closeSide = t.direction === 'BUY' ? 'SELL' : 'BUY';`,
    `      if (config.bot.autoExecute && !global.__botOffline) {
        try {
          const closeSide = t.direction === 'BUY' ? 'SELL' : 'BUY';`
  );
  fs.writeFileSync(path.join(base, 'backend\\src\\core\\OrderExecutor.ts'), exec, 'utf8');
  console.log('OrderExecutor.ts OK — respeta modo offline');
} else {
  console.log('OrderExecutor.ts — ya tenia modo offline');
}

// ============================================================
// 3) BACKEND: agregar declaracion global en server.ts
// ============================================================
let server = fs.readFileSync(path.join(base, 'backend\\src\\server.ts'), 'utf8');

if (!server.includes('__botOffline')) {
  server = server.replace(
    "(BigInt.prototype as any).toJSON",
    "declare global { var __botOffline: boolean; }\nglobal.__botOffline = false;\n\n(BigInt.prototype as any).toJSON"
  );
  fs.writeFileSync(path.join(base, 'backend\\src\\server.ts'), server, 'utf8');
  console.log('server.ts OK — global __botOffline declarado');
} else {
  console.log('server.ts — ya tenia declaracion');
}

// ============================================================
// 4) FRONTEND: apiService — agregar getBotMode y setBotMode
// ============================================================
let apiSvc = fs.readFileSync(path.join(base, 'frontend\\src\\services\\api.ts'), 'utf8');

if (!apiSvc.includes('bot-mode')) {
  apiSvc = apiSvc.replace(
    '};',
    `  async getBotMode(): Promise<{ offline: boolean }> {
    const { data } = await api.get('/bot-mode');
    return data;
  },
  async setBotMode(offline: boolean): Promise<{ offline: boolean }> {
    const { data } = await api.post('/bot-mode', { offline });
    return data;
  },
};`
  );
  fs.writeFileSync(path.join(base, 'frontend\\src\\services\\api.ts'), apiSvc, 'utf8');
  console.log('api.ts frontend OK — getBotMode/setBotMode agregados');
} else {
  console.log('api.ts frontend — ya tenia bot-mode');
}

// ============================================================
// 5) FRONTEND: store — agregar botOffline state
// ============================================================
let store = fs.readFileSync(path.join(base, 'frontend\\src\\store\\index.ts'), 'utf8');

if (!store.includes('botOffline')) {
  // Agregar al interface
  store = store.replace(
    '  isConnected: boolean;',
    '  isConnected: boolean;\n  botOffline: boolean;\n  setBotOffline: (v: boolean) => Promise<void>;'
  );
  // Agregar al estado inicial
  store = store.replace(
    '  isConnected: false,',
    '  isConnected: false,\n  botOffline: false,'
  );
  // Agregar la funcion setBotOffline
  store = store.replace(
    '  initSocket() {',
    `  async setBotOffline(offline: boolean) {
    try {
      await apiService.setBotMode(offline);
      set({ botOffline: offline });
    } catch(e) { console.error('setBotMode error', e); }
  },

  initSocket() {`
  );
  // Cargar el estado inicial en refreshAll
  store = store.replace(
    'apiService.getHealth().catch(() => null),',
    `apiService.getHealth().catch(() => null),
        apiService.getBotMode().catch(() => ({ offline: false })),`
  );
  store = store.replace(
    'const [signals, trades, stats, health,',
    'const [signals, trades, stats, health, botModeRes,'
  );
  store = store.replace(
    'set({ signals, trades, stats, health,',
    'set({ signals, trades, stats, health, botOffline: botModeRes?.offline ?? false,'
  );
  fs.writeFileSync(path.join(base, 'frontend\\src\\store\\index.ts'), store, 'utf8');
  console.log('store/index.ts OK — botOffline agregado');
} else {
  console.log('store — ya tenia botOffline');
}

console.log('\n✅ Backend listo. Ahora correr: node write_chart_signals.js');
