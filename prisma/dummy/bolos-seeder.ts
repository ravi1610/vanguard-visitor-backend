import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const BOLO_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const BOLO_STATUSES = ['active', 'resolved', 'expired'] as const;

export async function seedBolos(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'adminUserId'>,
): Promise<void> {
  const { tenantId, counts, adminUserId } = ctx;
  const count = counts.bolos;

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-bolo-${i + 1}`,
    tenantId,
    personName: `Person ${i + 1}`,
    description: `BOLO description ${i + 1}`,
    priority: at(i, BOLO_PRIORITIES),
    status: at(i, BOLO_STATUSES),
    vehicleMake: i % 2 === 0 ? 'Unknown' : null,
    vehicleModel: i % 2 === 0 ? 'Sedan' : null,
    vehicleColor: i % 2 === 0 ? 'Dark' : null,
    licensePlate: i % 3 === 0 ? `FL-XXX${i + 1}` : null,
    createdById: adminUserId,
    expiresAt: dateOffset(7 * 86400000),
    notes: null,
  }));

  await createManyBatched((chunk) => prisma.bolo.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} BOLOs`);
}
