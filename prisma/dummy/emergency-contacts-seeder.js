"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedEmergencyContacts = seedEmergencyContacts;
const helpers_1 = require("./helpers");
const RELATIONSHIPS = ['spouse', 'parent', 'sibling', 'child', 'friend', 'neighbor', 'other'];
async function seedEmergencyContacts(prisma, ctx) {
    const { tenantId, counts, residentUsers } = ctx;
    const count = counts.emergencyContacts;
    const data = Array.from({ length: count }, (_, i) => ({
        id: `seed-emerg-${i + 1}`,
        tenantId,
        userId: (0, helpers_1.at)(i, residentUsers).id,
        name: `Emergency Contact ${i + 1}`,
        relationship: (0, helpers_1.at)(i, RELATIONSHIPS),
        phone: `(305) 555-${String(9000 + i).padStart(4, '0')}`,
        email: i % 2 === 0 ? `emergency-${i + 1}@dummy.local` : null,
        isPrimary: i % 5 === 0,
    }));
    await (0, helpers_1.createManyBatched)((chunk) => prisma.emergencyContact.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} emergency contacts`);
}
//# sourceMappingURL=emergency-contacts-seeder.js.map