import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched } from './helpers';

const SPECIES = ['dog', 'cat', 'bird', 'fish', 'reptile', 'other'] as const;
const BREEDS = ['Mixed', 'Golden Retriever', 'Siamese', 'Parakeet', 'Goldfish'];

export async function seedPets(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'residentUsers'>,
): Promise<void> {
  const { tenantId, counts, residentUsers } = ctx;
  const count = counts.pets;

  const data = Array.from({ length: count }, (_, i) => ({
    id: `seed-pet-${i + 1}`,
    tenantId,
    userId: at(i, residentUsers).id,
    name: `Pet ${i + 1}`,
    species: at(i, SPECIES),
    breed: at(i, BREEDS),
    color: `Color ${(i % 5) + 1}`,
    weight: 10 + (i % 50),
    registrationNumber: `PET-${String(i + 1).padStart(3, '0')}`,
    isServiceAnimal: i % 10 === 0,
    notes: null,
  }));

  await createManyBatched((chunk) => prisma.pet.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} pets`);
}
