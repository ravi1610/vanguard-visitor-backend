import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const MAINTENANCE_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const;

export async function seedMaintenance(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const { tenantId, unitMap, adminUserId, counts } = ctx;
  const count = counts.maintenance;
  const unitIds = Object.values(unitMap);

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-maint-${i + 1}`,
    tenantId,
    title: `Maintenance ${i + 1}`,
    description: `Dummy maintenance work order ${i + 1}`,
    status: at(i, MAINTENANCE_STATUSES),
    unitId: unitIds.length ? at(i, unitIds) : null,
    dueDate: dateOffset((i - count / 2) * 86400000 * 7),
    assignedToUserId: i % 3 === 0 ? adminUserId : null,
  }));

  await createManyBatched((chunk) => prisma.maintenance.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} maintenance work orders`);
}
