const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Obtener los primeros 8 signals ordenados por fecha
  const old = await prisma.signal.findMany({
    orderBy: { createdAt: 'asc' },
    take: 8,
    select: { id: true }
  });
  const ids = old.map(s => s.id);
  console.log('Borrando signals:', ids);

  // Borrar trades asociados primero (FK constraint)
  const t = await prisma.trade.deleteMany({ where: { signalId: { in: ids } } });
  console.log('Trades borrados:', t.count);

  // Borrar signals
  const s = await prisma.signal.deleteMany({ where: { id: { in: ids } } });
  console.log('Signals borrados:', s.count);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
