"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedComplianceItems = seedComplianceItems;
const helpers_1 = require("./helpers");
const STATUSES = ['pending', 'in_progress', 'completed', 'overdue', 'compliant'];
const CATEGORIES = ['Fire Safety', 'Plumbing', 'Building Safety', 'Health & Safety', 'Insurance'];
async function seedComplianceItems(prisma, ctx) {
    const { tenantId, counts } = ctx;
    const count = counts.compliance;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-comp-${i + 1}`,
        tenantId,
        name: `Compliance Item ${i + 1}`,
        dueDate: (0, helpers_1.dateOffset)((i - count / 2) * 86400000),
        status: (0, helpers_1.at)(i, STATUSES),
        category: (0, helpers_1.at)(i, CATEGORIES),
        notes: i % 3 === 0 ? `Notes for item ${i + 1}` : null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.complianceItem.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} compliance items`);
}
//# sourceMappingURL=compliance-seeder.js.map