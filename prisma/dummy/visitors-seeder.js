"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedVisitors = seedVisitors;
const helpers_1 = require("./helpers");
async function seedVisitors(prisma, ctx) {
    const { tenantId, counts } = ctx;
    const count = counts.visitors;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-visitor-${i + 1}`,
        tenantId,
        firstName: 'Visitor',
        lastName: String(i + 1),
        email: `visitor-${i + 1}@dummy.local`,
        phone: `(305) 555-${String(i + 1).padStart(4, '0')}`,
        company: i % 3 === 0 ? `Company ${i + 1}` : null,
        documentId: `DL-${i + 1}`,
        notes: null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.visitor.createMany({ data: chunk, skipDuplicates: true }), data);
    const visitorIds = data.map((d) => d.id);
    console.log(`  ${count} visitors`);
    return visitorIds;
}
//# sourceMappingURL=visitors-seeder.js.map