import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const CARRIERS = ['UPS', 'USPS', 'FedEx', 'Amazon', 'DHL'];
const PACKAGE_STATUSES = ['received', 'notified', 'picked_up'] as const;
const PACKAGE_SIZES = ['small', 'medium', 'large', 'oversized'] as const;

export async function seedPackages(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const { tenantId, residentUsers, unitMap, adminUserId, counts } = ctx;
  const count = counts.packages;
  const unitIds = Object.values(unitMap);

  const data = Array.from({ length: count }, (_, i) => {
    const resident = at(i, residentUsers);
    const status = at(i, PACKAGE_STATUSES);
    return {
      id: `seed-pkg-${i + 1}`,
      tenantId,
      trackingNumber: `TRK${String(i + 1).padStart(12, '0')}`,
      carrier: at(i, CARRIERS),
      status,
      size: at(i, PACKAGE_SIZES),
      recipientName: `${resident.firstName} ${resident.lastName}`,
      recipientId: resident.id,
      unitId: unitIds.length ? at(i, unitIds) : null,
      storageLocation: `Shelf ${(i % 10) + 1}`,
      isPerishable: i % 7 === 0,
      receivedById: adminUserId,
      pickedUpAt: status === 'picked_up' ? dateOffset(-i * 86400000) : null,
      pickedUpById: status === 'picked_up' ? adminUserId : null,
      notes: null,
    };
  });

  await createManyBatched((chunk) => prisma.package.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} packages`);
}
