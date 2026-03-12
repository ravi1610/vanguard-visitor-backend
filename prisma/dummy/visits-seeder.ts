import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const VISIT_STATUSES = ['scheduled', 'checked_in', 'checked_out', 'no_show'] as const;
const PURPOSES = ['Delivery', 'Meeting', 'Repair', 'Package delivery', 'Personal visit', 'Consultation'];

export async function seedVisits(
  prisma: PrismaClient,
  ctx: DummySeedContext & { visitorIds: string[] },
): Promise<void> {
  const { tenantId, residentUsers, adminUserId, visitorIds, counts } = ctx;
  const count = counts.visits;
  const hosts = [...residentUsers.map((u) => u.id), adminUserId];

  const data = Array.from({ length: count }, (_, i) => {
    const status = at(i, VISIT_STATUSES);
    const base = dateOffset(-i * 3600000);
    return {
      id: `seed-visit-${i + 1}`,
      tenantId,
      visitorId: at(i, visitorIds),
      hostUserId: at(i, hosts),
      purpose: at(i, PURPOSES),
      status,
      checkInAt: status !== 'scheduled' ? dateOffset(-(i + 1) * 3600000) : null,
      checkOutAt: status === 'checked_out' ? dateOffset(-(i + 1) * 3600000 + 1800000) : null,
      scheduledStart: status === 'scheduled' ? dateOffset((i + 1) * 3600000) : null,
      scheduledEnd: status === 'scheduled' ? dateOffset((i + 1) * 3600000 + 7200000) : null,
    };
  });

  await createManyBatched((chunk) => prisma.visit.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} visits`);
}
