const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';

// 1) Patch store — agregar selectedSignalId
let store = fs.readFileSync(base + '/frontend/src/store/index.ts', 'utf8');
if (!store.includes('selectedSignalId')) {
  store = store.replace(
    '  botOffline: boolean;\n  setBotOffline: (v: boolean) => Promise<void>;',
    '  botOffline: boolean;\n  setBotOffline: (v: boolean) => Promise<void>;\n  selectedSignalId: string | null;\n  setSelectedSignalId: (id: string | null) => void;'
  );
  store = store.replace(
    '  botOffline: false,',
    '  botOffline: false,\n  selectedSignalId: null,'
  );
  store = store.replace(
    '  async setBotOffline',
    '  setSelectedSignalId: (id) => set({ selectedSignalId: id }),\n\n  async setBotOffline'
  );
  fs.writeFileSync(base + '/frontend/src/store/index.ts', store, 'utf8');
  console.log('store OK — selectedSignalId agregado');
} else {
  console.log('store — ya tenia selectedSignalId');
}
