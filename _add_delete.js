const fs = require('fs');
const base = 'C:\\Users\\elkun\\Documents\\Bot traiding con Claude Code y Pionex\\trading-bot';
let api = fs.readFileSync(base + '/backend/src/routes/api.ts', 'utf8');

const deleteEndpoints = `
  // Borrar un trade individual
  router.delete('/trades/:id', async (req: any, res: any) => {
    try {
      await prisma.trade.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Borrar todos los trades
  router.delete('/trades', async (_req: any, res: any) => {
    try {
      const result = await prisma.trade.deleteMany({});
      res.json({ deleted: result.count });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

`;

if (!api.includes("router.delete('/trades'")) {
  api = api.replace('  return router;', deleteEndpoints + '  return router;');
  fs.writeFileSync(base + '/backend/src/routes/api.ts', api, 'utf8');
  console.log('api.ts OK — DELETE /trades y DELETE /trades/:id agregados');
} else {
  console.log('api.ts — endpoints ya existian');
}
