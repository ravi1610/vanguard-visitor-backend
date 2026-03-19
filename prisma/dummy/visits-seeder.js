"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedVisits = seedVisits;
const helpers_1 = require("./helpers");
const VISIT_STATUSES = ['scheduled', 'checked_in', 'checked_out', 'no_show'];
const PURPOSES = ['Delivery', 'Meeting', 'Repair', 'Package delivery', 'Personal visit', 'Consultation'];
async function seedVisits(prisma, ctx) {
    const { tenantId, residentUsers, adminUserId, visitorIds, counts } = ctx;
    const count = counts.visits;
    const hosts = [...residentUsers.map((u) => u.id), adminUserId];
    const data = Array.from({ length: count }, (_, i) => {
        const status = (0, helpers_1.at)(i, VISIT_STATUSES);
        const base = (0, helpers_1.dateOffset)(-i * 3600000);
        return {
            id: `seed-visit-${i + 1}`,
            tenantId,
            visitorId: (0, helpers_1.at)(i, visitorIds),
            hostUserId: (0, helpers_1.at)(i, hosts),
            purpose: (0, helpers_1.at)(i, PURPOSES),
            status,
            checkInAt: status !== 'scheduled' ? (0, helpers_1.dateOffset)(-(i + 1) * 3600000) : null,
            checkOutAt: status === 'checked_out' ? (0, helpers_1.dateOffset)(-(i + 1) * 3600000 + 1800000) : null,
            scheduledStart: status === 'scheduled' ? (0, helpers_1.dateOffset)((i + 1) * 3600000) : null,
            scheduledEnd: status === 'scheduled' ? (0, helpers_1.dateOffset)((i + 1) * 3600000 + 7200000) : null,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.visit.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} visits`);
}
//# sourceMappingURL=visits-seeder.js.map