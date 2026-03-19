"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedBolos = seedBolos;
const helpers_1 = require("./helpers");
const BOLO_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const BOLO_STATUSES = ['active', 'resolved', 'expired'];
async function seedBolos(prisma, ctx) {
    const { tenantId, counts, adminUserId } = ctx;
    const count = counts.bolos;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-bolo-${i + 1}`,
        tenantId,
        personName: `Person ${i + 1}`,
        description: `BOLO description ${i + 1}`,
        priority: (0, helpers_1.at)(i, BOLO_PRIORITIES),
        status: (0, helpers_1.at)(i, BOLO_STATUSES),
        vehicleMake: i % 2 === 0 ? 'Unknown' : null,
        vehicleModel: i % 2 === 0 ? 'Sedan' : null,
        vehicleColor: i % 2 === 0 ? 'Dark' : null,
        licensePlate: i % 3 === 0 ? `FL-XXX${i + 1}` : null,
        createdById: adminUserId,
        expiresAt: (0, helpers_1.dateOffset)(7 * 86400000),
        notes: null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.bolo.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} BOLOs`);
}
//# sourceMappingURL=bolos-seeder.js.map