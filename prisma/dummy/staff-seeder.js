"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedStaff = seedStaff;
const helpers_1 = require("./helpers");
const ROLES = ['Manager', 'Officer', 'Supervisor', 'Staff'];
const POSITIONS = ['Property Manager', 'Assistant PM', 'Front Desk Admin', 'Security Guard', 'Maintenance Staff', 'Valet'];
const DEPARTMENTS = ['Administration', 'Maintenance', 'Front Desk', 'Security', 'Concierge', 'Valet'];
const BUILDINGS = ['Building A', 'Building B', 'Gate House', 'Lobby', 'Admin Office'];
async function seedStaff(prisma, ctx) {
    const { tenantId, counts, staffRoleIdByName, staffPositionIdByName, departmentIdByName } = ctx;
    const count = counts.staff;
    const data = Array.from({ length: count }, (_, i) => {
        const roleName = (0, helpers_1.at)(i, ROLES);
        const positionName = (0, helpers_1.at)(i, POSITIONS);
        const deptName = (0, helpers_1.at)(i, DEPARTMENTS);
        return {
            id: `seed-staff-${i + 1}`,
            tenantId,
            firstName: 'Staff',
            lastName: String(i + 1),
            email: `staff-${i + 1}@dummy.local`,
            phone: `(305) 555-${String(1000 + i).padStart(4, '0')}`,
            employeeId: `EMP-${String(i + 1).padStart(3, '0')}`,
            assignedBuilding: (0, helpers_1.at)(i, BUILDINGS),
            hireDate: (0, helpers_1.dateOffset)(-(i + 1) * 30 * 86400000),
            isActive: i % 20 !== 0,
            roleId: staffRoleIdByName[roleName] ?? null,
            positionId: staffPositionIdByName[positionName] ?? null,
            departmentId: departmentIdByName[deptName] ?? null,
        };
    });
    await (0, helpers_1.createManyBatched)((chunk) => prisma.staff.createMany({ data: chunk, skipDuplicates: true }), data);
    console.log(`  ${count} staff members`);
}
//# sourceMappingURL=staff-seeder.js.map