"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedVendors = seedVendors;
const helpers_1 = require("./helpers");
const CATEGORIES = ['Landscaping', 'Cleaning', 'Security', 'Pool Maintenance', 'Electrical', 'Plumbing'];
async function seedVendors(prisma, ctx) {
    const { tenantId, counts } = ctx;
    const count = counts.vendors;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-vendor-${i + 1}`,
        tenantId,
        name: `Vendor ${i + 1}`,
        contactName: `Contact ${i + 1}`,
        email: `vendor-${i + 1}@dummy.local`,
        phone: `(305) 555-${String(3000 + i).padStart(4, '0')}`,
        category: (0, helpers_1.at)(i, CATEGORIES),
        notes: null,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.vendor.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} vendors`);
}
//# sourceMappingURL=vendors-seeder.js.map