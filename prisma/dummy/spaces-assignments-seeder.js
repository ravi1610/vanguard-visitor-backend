"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSpacesAndAssignments = seedSpacesAndAssignments;
const helpers_1 = require("./helpers");
const SPACE_TYPES = ['parking', 'desk', 'other'];
async function seedSpacesAndAssignments(prisma, ctx) {
    const { tenantId, residentUsers, counts } = ctx;
    const count = counts.spaces;
    const spacesData = Array.from({ length: count }, (_, i) => ({
        id: `seed-space-${i + 1}`,
        tenantId,
        name: `Space ${i + 1}`,
        type: (0, helpers_1.at)(i, SPACE_TYPES),
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.space.createMany({ data: chunk, skipDuplicates: true }), spacesData);
    const spaceIds = spacesData.map((s) => s.id);
    const assignmentsData = Array.from({ length: count }, (_, i) => ({
        id: `seed-assign-${i + 1}`,
        tenantId,
        spaceId: (0, helpers_1.at)(i, spaceIds),
        assigneeType: 'resident',
        assigneeId: (0, helpers_1.at)(i, residentUsers).id,
        fromDate: (0, helpers_1.dateOffset)(-365 * 86400000),
        toDate: (0, helpers_1.dateOffset)(365 * 86400000),
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.spaceAssignment.createMany({ data: chunk, skipDuplicates: true }), assignmentsData);
    console.log(`  ${count} spaces, ${count} assignments`);
}
//# sourceMappingURL=spaces-assignments-seeder.js.map