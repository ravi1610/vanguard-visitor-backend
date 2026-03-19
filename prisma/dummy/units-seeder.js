"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedUnits = seedUnits;
const helpers_1 = require("./helpers");
const UNIT_STATUSES = ['occupied', 'vacant', 'maintenance'];
const UNIT_TYPES = ['1BR', '2BR', '3BR', 'Studio'];
async function seedUnits(prisma, tenantId, count) {
    const unitNumbers = Array.from({ length: count }, (_, i) => String(i + 1));
    const data = unitNumbers.map((unitNumber, i) => {
        const building = `Building ${String.fromCharCode(65 + (i % 3))}`;
        const floor = String((i % 10) + 1);
        return {
            id: `seed-unit-${unitNumber}`,
            tenantId,
            unitNumber,
            building,
            floor,
            unitType: UNIT_TYPES[i % UNIT_TYPES.length],
            status: UNIT_STATUSES[i % UNIT_STATUSES.length],
            notes: i % 7 === 0 ? `Dummy unit ${unitNumber}` : null,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.unit.createMany({ data: chunk, skipDuplicates: true }), data);
    const unitMap = {};
    for (let i = 0; i < count; i++)
        unitMap[unitNumbers[i]] = `seed-unit-${unitNumbers[i]}`;
    console.log(`  ${count} units`);
    return unitMap;
}
//# sourceMappingURL=units-seeder.js.map