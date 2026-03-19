"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedViolations = seedViolations;
const helpers_1 = require("./helpers");
const VIOLATION_TYPES = ['noise', 'parking', 'property_damage', 'unauthorized_modification', 'pet_violation', 'trash', 'other'];
const VIOLATION_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'];
async function seedViolations(prisma, ctx) {
    const { tenantId, residentUsers, unitMap, counts } = ctx;
    const count = counts.violations;
    const unitIds = Object.values(unitMap);
    const data = Array.from({ length: count }, (_, i) => {
        const status = (0, helpers_1.at)(i, VIOLATION_STATUSES);
        return {
            id: `seed-viol-${i + 1}`,
            tenantId,
            userId: (0, helpers_1.at)(i, residentUsers).id,
            unitId: unitIds.length ? (0, helpers_1.at)(i, unitIds) : null,
            title: `Violation ${i + 1}`,
            description: `Dummy violation description ${i + 1}`,
            type: (0, helpers_1.at)(i, VIOLATION_TYPES),
            status,
            fineAmount: i % 4 === 0 ? 50 + i * 10 : null,
            issuedDate: (0, helpers_1.dateOffset)(-(i + 1) * 86400000),
            resolvedDate: status === 'resolved' ? (0, helpers_1.dateOffset)(-i * 86400000) : null,
            notes: null,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.violation.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} violations`);
}
//# sourceMappingURL=violations-seeder.js.map