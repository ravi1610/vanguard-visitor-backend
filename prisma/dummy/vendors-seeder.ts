import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched } from './helpers';

const CATEGORIES = ['Landscaping', 'Cleaning', 'Security', 'Pool Maintenance', 'Electrical', 'Plumbing'];

export async function seedVendors(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts'>,
): Promise<void> {
  const { tenantId, counts } = ctx;
  const count = counts.vendors;

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-vendor-${i + 1}`,
    tenantId,
    name: `Vendor ${i + 1}`,
    contactName: `Contact ${i + 1}`,
    email: `vendor-${i + 1}@dummy.local`,
    phone: `(305) 555-${String(3000 + i).padStart(4, '0')}`,
    category: at(i, CATEGORIES),
    notes: null,
  }));

  await createManyBatched((chunk) => prisma.vendor.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} vendors`);
}
