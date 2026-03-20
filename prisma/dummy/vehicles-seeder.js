"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedVehicles = seedVehicles;
const helpers_1 = require("./helpers");
const MAKES = ['Toyota', 'Honda', 'Ford', 'Tesla', 'BMW', 'Chevrolet'];
const MODELS = ['Camry', 'Civic', 'F-150', 'Model 3', 'X5', 'Malibu'];
const COLORS = ['Silver', 'Blue', 'White', 'Black', 'Gray', 'Red'];
async function seedVehicles(prisma, ctx) {
    const { tenantId, residentUsers, unitMap, counts } = ctx;
    const count = counts.vehicles;
    const unitIds = Object.values(unitMap);
    const data = Array.from({ length: count }, (_, i) => {
        const ownerType = (i % 10 === 0 ? 'staff' : 'resident');
        return {
            id: `seed-vehicle-${i + 1}`,
            tenantId,
            plateNumber: `FL-DUM${String(i + 1).padStart(4, '0')}`,
            make: (0, helpers_1.at)(i, MAKES),
            model: (0, helpers_1.at)(i, MODELS),
            color: (0, helpers_1.at)(i, COLORS),
            year: 2020 + (i % 6),
            ownerType,
            ownerId: ownerType === 'resident' ? (0, helpers_1.at)(i, residentUsers).id : null,
            unitId: ownerType === 'resident' && unitIds.length ? (0, helpers_1.at)(i, unitIds) : null,
            tagId: `TAG-${i + 1}`,
            stickerNumber: `STK-${i + 1}`,
            parkingSpace: `P-${i + 1}`,
            isPrimary: true,
            isRestricted: false,
            expiresAt: i % 5 === 0 ? (0, helpers_1.dateOffset)(365 * 86400000) : null,
            notes: ownerType === 'staff' ? 'Staff vehicle' : null,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.vehicle.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} vehicles`);
}
//# sourceMappingURL=vehicles-seeder.js.map