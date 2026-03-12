import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched } from './helpers';

const RELATIONSHIPS = ['spouse', 'parent', 'sibling', 'child', 'friend', 'neighbor', 'other'] as const;

export async function seedEmergencyContacts(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'residentUsers'>,
): Promise<void> {
  const { tenantId, counts, residentUsers } = ctx;
  const count = counts.emergencyContacts;

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-emerg-${i + 1}`,
    tenantId,
    userId: at(i, residentUsers).id,
    name: `Emergency Contact ${i + 1}`,
    relationship: at(i, RELATIONSHIPS),
    phone: `(305) 555-${String(9000 + i).padStart(4, '0')}`,
    email: i % 2 === 0 ? `emergency-${i + 1}@dummy.local` : null,
    isPrimary: i % 5 === 0,
  }));

  await createManyBatched((chunk) => prisma.emergencyContact.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} emergency contacts`);
}
