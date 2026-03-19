"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPets = seedPets;
const helpers_1 = require("./helpers");
const SPECIES = ['dog', 'cat', 'bird', 'fish', 'reptile', 'other'];
const BREEDS = ['Mixed', 'Golden Retriever', 'Siamese', 'Parakeet', 'Goldfish'];
async function seedPets(prisma, ctx) {
    const { tenantId, counts, residentUsers } = ctx;
    const count = counts.pets;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-pet-${i + 1}`,
        tenantId,
        userId: (0, helpers_1.at)(i, residentUsers).id,
        name: `Pet ${i + 1}`,
        species: (0, helpers_1.at)(i, SPECIES),
        breed: (0, helpers_1.at)(i, BREEDS),
        color: `Color ${(i % 5) + 1}`,
        weight: 10 + (i % 50),
        registrationNumber: `PET-${String(i + 1).padStart(3, '0')}`,
        isServiceAnimal: i % 10 === 0,
        notes: null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.pet.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} pets`);
}
//# sourceMappingURL=pets-seeder.js.map