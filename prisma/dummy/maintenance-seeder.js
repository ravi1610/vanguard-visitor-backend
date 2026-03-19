"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedMaintenance = seedMaintenance;
const helpers_1 = require("./helpers");
const MAINTENANCE_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];
async function seedMaintenance(prisma, ctx) {
    const { tenantId, unitMap, adminUserId, counts } = ctx;
    const count = counts.maintenance;
    const unitIds = Object.values(unitMap);
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-maint-${i + 1}`,
        tenantId,
        title: `Maintenance ${i + 1}`,
        description: `Dummy maintenance work order ${i + 1}`,
        status: (0, helpers_1.at)(i, MAINTENANCE_STATUSES),
        unitId: unitIds.length ? (0, helpers_1.at)(i, unitIds) : null,
        dueDate: (0, helpers_1.dateOffset)((i - count / 2) * 86400000 * 7),
        assignedToUserId: i % 3 === 0 ? adminUserId : null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.maintenance.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} maintenance work orders`);
}
//# sourceMappingURL=maintenance-seeder.js.map