import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const SPACE_TYPES = ['parking', 'desk', 'other'] as const;

export async function seedSpacesAndAssignments(
  prisma: PrismaClient,
  ctx: DummySeedContext,
): Promise<void> {
  const { tenantId, residentUsers, counts } = ctx;
  const count = counts.spaces;

  const spacesData = Array.from({ length: count }, (_, i) => ({
    id: `seed-space-${i + 1}`,
    tenantId,
    name: `Space ${i + 1}`,
    type: at(i, SPACE_TYPES),
  }));

  await createManyBatched((chunk) => prisma.space.createMany({ data: chunk, skipDuplicates: true }), spacesData);

  const spaceIds = spacesData.map((s) => s.id);
  const assignmentsData = Array.from({ length: count }, (_, i) => ({
    id: `seed-assign-${i + 1}`,
    tenantId,
    spaceId: at(i, spaceIds),
    assigneeType: 'resident',
    assigneeId: at(i, residentUsers).id,
    fromDate: dateOffset(-365 * 86400000),
    toDate: dateOffset(365 * 86400000),
  }));

  await createManyBatched((chunk) => prisma.spaceAssignment.createMany({ data: chunk, skipDuplicates: true }), assignmentsData);
  console.log(`  ${count} spaces, ${count} assignments`);
}
