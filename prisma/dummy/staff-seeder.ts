import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
import { at, createManyBatched, dateOffset } from './helpers';

const ROLES = ['Manager', 'Officer', 'Supervisor', 'Staff'];
const POSITIONS = ['Property Manager', 'Assistant PM', 'Front Desk Admin', 'Security Guard', 'Maintenance Staff', 'Valet'];
const DEPARTMENTS = ['Administration', 'Maintenance', 'Front Desk', 'Security', 'Concierge', 'Valet'];
const BUILDINGS = ['Building A', 'Building B', 'Gate House', 'Lobby', 'Admin Office'];

export async function seedStaff(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'staffRoleIdByName' | 'staffPositionIdByName' | 'departmentIdByName'>,
): Promise<void> {
  const { tenantId, counts, staffRoleIdByName, staffPositionIdByName, departmentIdByName } = ctx;
  const count = counts.staff;

  const data = Array.from({ length: count }, (_, i) => {
    const roleName = at(i, ROLES);
    const positionName = at(i, POSITIONS);
    const deptName = at(i, DEPARTMENTS);
    return {
      id: `seed-staff-${i + 1}`,
      tenantId,
      firstName: 'Staff',
      lastName: String(i + 1),
      email: `staff-${i + 1}@dummy.local`,
      phone: `(305) 555-${String(1000 + i).padStart(4, '0')}`,
      employeeId: `EMP-${String(i + 1).padStart(3, '0')}`,
      assignedBuilding: at(i, BUILDINGS),
      hireDate: dateOffset(-(i + 1) * 30 * 86400000),
      isActive: i % 20 !== 0,
      roleId: staffRoleIdByName[roleName] ?? null,
      positionId: staffPositionIdByName[positionName] ?? null,
      departmentId: departmentIdByName[deptName] ?? null,
    };
  });

  await createManyBatched((chunk) => prisma.staff.createMany({ data: chunk, skipDuplicates: true }), data);
  console.log(`  ${count} staff members`);
}
