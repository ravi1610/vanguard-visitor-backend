import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const VIOLATION_TYPES = ['noise', 'parking', 'property_damage', 'unauthorized_modification', 'pet_violation', 'trash', 'other'] as const;
const VIOLATION_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;

export async function seedViolations(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const { tenantId, residentUsers, unitMap, counts } = ctx;
  const count = counts.violations;
  const unitIds = Object.values(unitMap);

  const data = Array.from({ length: count }, (_, i) => {
    const status = at(i, VIOLATION_STATUSES);
    return {
      id: `seed-viol-${i + 1}`,
      tenantId,
      userId: at(i, residentUsers).id,
      unitId: unitIds.length ? at(i, unitIds) : null,
      title: `Violation ${i + 1}`,
      description: `Dummy violation description ${i + 1}`,
      type: at(i, VIOLATION_TYPES),
      status,
      fineAmount: i % 4 === 0 ? 50 + i * 10 : null,
      issuedDate: dateOffset(-(i + 1) * 86400000),
      resolvedDate: status === 'resolved' ? dateOffset(-i * 86400000) : null,
      notes: null,
    };
  });

  await createManyBatched((chunk) => prisma.violation.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} violations`);
}
