"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPackages = seedPackages;
const helpers_1 = require("./helpers");
const CARRIERS = ['UPS', 'USPS', 'FedEx', 'Amazon', 'DHL'];
const PACKAGE_STATUSES = ['received', 'notified', 'picked_up'];
const PACKAGE_SIZES = ['small', 'medium', 'large', 'oversized'];
async function seedPackages(prisma, ctx) {
    const { tenantId, residentUsers, unitMap, adminUserId, counts } = ctx;
    const count = counts.packages;
    const unitIds = Object.values(unitMap);
    const data = Array.from({ length: count }, (_, i) => {
        const resident = (0, helpers_1.at)(i, residentUsers);
        const status = (0, helpers_1.at)(i, PACKAGE_STATUSES);
        return {
            id: `seed-pkg-${i + 1}`,
            tenantId,
            trackingNumber: `TRK${String(i + 1).padStart(12, '0')}`,
            carrier: (0, helpers_1.at)(i, CARRIERS),
            status,
            size: (0, helpers_1.at)(i, PACKAGE_SIZES),
            recipientName: `${resident.firstName} ${resident.lastName}`,
            recipientId: resident.id,
            unitId: unitIds.length ? (0, helpers_1.at)(i, unitIds) : null,
            storageLocation: `Shelf ${(i % 10) + 1}`,
            isPerishable: i % 7 === 0,
            receivedById: adminUserId,
            pickedUpAt: status === 'picked_up' ? (0, helpers_1.dateOffset)(-i * 86400000) : null,
            pickedUpById: status === 'picked_up' ? adminUserId : null,
            notes: null,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.package.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} packages`);
}
//# sourceMappingURL=packages-seeder.js.map