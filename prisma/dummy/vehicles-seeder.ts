import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const MAKES = ['Toyota', 'Honda', 'Ford', 'Tesla', 'BMW', 'Chevrolet'];
const MODELS = ['Camry', 'Civic', 'F-150', 'Model 3', 'X5', 'Malibu'];
const COLORS = ['Silver', 'Blue', 'White', 'Black', 'Gray', 'Red'];

export async function seedVehicles(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const { tenantId, residentUsers, unitMap, counts } = ctx;
  const count = counts.vehicles;
  const unitIds = Object.values(unitMap);

  const data = Array.from({ length: count }, (_, i) => {
    const ownerType = (i % 10 === 0 ? 'staff' : 'resident') as 'staff' | 'resident';
    return {
      id: `seed-vehicle-${i + 1}`,
      tenantId,
      plateNumber: `FL-DUM${String(i + 1).padStart(4, '0')}`,
      make: at(i, MAKES),
      model: at(i, MODELS),
      color: at(i, COLORS),
      year: 2020 + (i % 6),
      ownerType,
      ownerId: ownerType === 'resident' ? at(i, residentUsers).id : null,
      unitId: ownerType === 'resident' && unitIds.length ? at(i, unitIds) : null,
      tagId: `TAG-${i + 1}`,
      stickerNumber: `STK-${i + 1}`,
      parkingSpace: `P-${i + 1}`,
      isPrimary: true,
      isRestricted: false,
      expiresAt: i % 5 === 0 ? dateOffset(365 * 86400000) : null,
      notes: ownerType === 'staff' ? 'Staff vehicle' : null,
    };
  });

  await createManyBatched((chunk) => prisma.vehicle.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} vehicles`);
}
