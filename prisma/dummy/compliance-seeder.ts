import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const STATUSES = ['pending', 'in_progress', 'completed', 'overdue', 'compliant'] as const;
const CATEGORIES = ['Fire Safety', 'Plumbing', 'Building Safety', 'Health & Safety', 'Insurance'];

export async function seedComplianceItems(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts'>,
): Promise<void> {
  const { tenantId, counts } = ctx;
  const count = counts.compliance;
  const categories = await prisma.complianceCategory.findMany({
    where: { name: { in: CATEGORIES as unknown as string[] } },
    select: { id: true, name: true },
  });
  const categoryIdByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-comp-${i + 1}`,
    tenantId,
    name: `Compliance Item ${i + 1}`,
    dueDate: dateOffset((i - count / 2) * 86400000),
    status: at(i, STATUSES),
    categoryId: categoryIdByName[at(i, CATEGORIES)],
    notes: i % 3 === 0 ? `Notes for item ${i + 1}` : null,
  }));

  await createManyBatched((chunk) => prisma.complianceItem.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} compliance items`);
}
