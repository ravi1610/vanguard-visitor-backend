import type { PrismaClient } from '@prisma/client';
import { createManyBatched } from './helpers';

const UNIT_STATUSES = ['occupied', 'vacant', 'maintenance'] as const;
const UNIT_TYPES = ['1BR', '2BR', '3BR', 'Studio'] as const;

/**
 * Seeds units. Called from main seed.ts (before residents). Creates dummyCount units.
 * Returns unitMap (key = unitNumber "1", "2", ...) for residents and other seeders.
 */
export async function seedUnits(
  prisma: PrismaClient,
  tenantId: string,
  count: number,
): Promise<Record<string, string>> {
  const unitNumbers = Array.from({ length: count }, (_, i) => String(i + 1));
  const data = unitNumbers.map((unitNumber, i) => {
    const building = `Building ${String.fromCharCode(65 + (i % 3))}`;
    const floor = String((i % 10) + 1);
    return {
      id: `seed-unit-${unitNumber}`,
      tenantId,
      unitNumber,
      building,
      floor,
      unitType: UNIT_TYPES[i % UNIT_TYPES.length],
      status: UNIT_STATUSES[i % UNIT_STATUSES.length] as 'occupied' | 'vacant' | 'maintenance',
      notes: i % 7 === 0 ? `Dummy unit ${unitNumber}` : null,
    };
  });

  await createManyBatched((chunk) => prisma.unit.createMany({ data: chunk, skipDuplicates: true }), data);

  const unitMap: Record<string, string> = {};
  for (let i = 0; i < count; i++) unitMap[unitNumbers[i]] = `seed-unit-${unitNumbers[i]}`;
  console.log(`  ${count} units`);
  return unitMap;
}
