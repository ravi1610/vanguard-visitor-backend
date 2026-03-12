import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { DummySeedContext } from './context';
import { at, dateOffset } from './helpers';

const RESIDENT_TYPES = ['owner', 'renter', 'president', 'vice_president', 'treasurer'] as const;

/**
 * Seeds dummy residents. Must run first in runDummySeed so residentUsers is available for other seeders.
 * Returns residentUsers for use in visits, vehicles, etc.
 */
export async function seedResidents(
  prisma: PrismaClient,
  ctx: Pick<DummySeedContext, 'tenantId' | 'unitMap' | 'counts' | 'residentRoleId'>,
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const { tenantId, unitMap, counts, residentRoleId } = ctx;
  const count = counts.residents;
  const unitIds = Object.values(unitMap);
  const defaultPasswordHash = await bcrypt.hash('resident123', 10);

  const residentUsers: { id: string; firstName: string; lastName: string }[] = [];

  for (let i = 0; i < count; i++) {
    const unitId = unitIds.length ? at(i, unitIds) : null;
    const residentType = at(i, RESIDENT_TYPES);
    const email = `resident-${i + 1}@dummy.local`;
    const firstName = 'Resident';
    const lastName = String(i + 1);
    const leaseStart = dateOffset(-(365 + i * 30) * 86400000);
    const leaseEnd = dateOffset((365 - i * 10) * 86400000);

    const u = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        passwordHash: defaultPasswordHash,
        firstName,
        lastName,
        isActive: true,
        residentType,
        unitId,
        phone: `(305) 555-${String(1000 + i).padStart(4, '0')}`,
        mobile: i % 2 === 0 ? `(786) 555-${String(2000 + i).padStart(4, '0')}` : null,
        dateOfBirth: dateOffset(-(25 + (i % 40)) * 365 * 86400000),
        leaseBeginDate: leaseStart,
        leaseEndDate: leaseEnd,
        isBoardMember: i % 10 === 0,
        movingDate: leaseStart,
        userRoles: { create: { roleId: residentRoleId } },
      },
      update: {
        unitId,
        residentType,
        phone: `(305) 555-${String(1000 + i).padStart(4, '0')}`,
        mobile: i % 2 === 0 ? `(786) 555-${String(2000 + i).padStart(4, '0')}` : null,
        leaseBeginDate: leaseStart,
        leaseEndDate: leaseEnd,
        isBoardMember: i % 10 === 0,
      },
    });
    residentUsers.push({ id: u.id, firstName: u.firstName, lastName: u.lastName });
  }

  console.log(`  ${count} residents (password: resident123)`);
  return residentUsers;
}
