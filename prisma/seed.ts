import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for seed');
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const permissions = [
    'tenant.manage',
    'user.manage',
    'visitor.view',
    'visitor.manage',
    'visit.view',
    'visit.checkin',
    'visit.checkout',
    'visit.view_history',
    'staff.view',
    'staff.manage',
    'vehicles.view',
    'vehicles.manage',
    'spaces.view',
    'spaces.manage',
    'maintenance.view',
    'maintenance.manage',
    'projects.view',
    'projects.manage',
    'calendar.view',
    'calendar.manage',
    'documents.view',
    'documents.manage',
    'compliance.view',
    'compliance.manage',
    'vendors.view',
    'vendors.manage',
    'reports.view',
    'emergencyContacts.view',
    'emergencyContacts.manage',
    'pets.view',
    'pets.manage',
    'violations.view',
    'violations.manage',
    'packages.view',
    'packages.manage',
  ];

  for (const key of permissions) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: key.replace('.', ' ') },
      update: {},
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    create: { name: 'Default Tenant', slug: 'default', isActive: true },
    update: {},
  });

  const role = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'tenant_owner' } },
    create: {
      tenantId: tenant.id,
      name: 'Tenant Owner',
      key: 'tenant_owner',
      description: 'Full control',
    },
    update: {},
  });

  const permIds = await prisma.permission.findMany({ select: { id: true } });
  for (const p of permIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      create: { roleId: role.id, permissionId: p.id },
      update: {},
    });
  }

  const email = 'admin@example.com';
  const passwordHash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    create: {
      tenantId: tenant.id,
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      userRoles: { create: { roleId: role.id } },
    },
    update: {},
    include: { userRoles: { include: { role: true } } },
  });

  // Create resident role with basic permissions
  const residentRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'resident' } },
    create: {
      tenantId: tenant.id,
      name: 'Resident',
      key: 'resident',
      description: 'Community resident',
    },
    update: {},
  });
  const residentPermKeys = ['visitor.view', 'visit.view', 'visit.view_history'];
  for (const key of residentPermKeys) {
    const perm = await prisma.permission.findUnique({ where: { key } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: residentRole.id, permissionId: perm.id } },
        create: { roleId: residentRole.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  // Sample residents with the new fields
  const residents = [
    { email: 'maria.garcia@example.com', firstName: 'Maria', lastName: 'Garcia', residentType: 'owner' as const, unit: '101', phone: '(305) 555-0101', mobile: '(786) 555-0101', dateOfBirth: new Date('1985-03-15'), leaseBeginDate: new Date('2024-01-01'), leaseEndDate: new Date('2026-12-31'), isBoardMember: true, movingDate: new Date('2024-01-15') },
    { email: 'james.wilson@example.com', firstName: 'James', lastName: 'Wilson', residentType: 'renter' as const, unit: '205', mobile: '(786) 555-0205', dateOfBirth: new Date('1990-07-22'), leaseBeginDate: new Date('2025-06-01'), leaseEndDate: new Date('2026-05-31'), movingDate: new Date('2025-06-01') },
    { email: 'sophia.chen@example.com', firstName: 'Sophia', lastName: 'Chen', residentType: 'president' as const, unit: '302', phone: '(305) 555-0302', mobile: '(786) 555-0302', dateOfBirth: new Date('1978-11-08'), isBoardMember: true, leaseBeginDate: new Date('2023-01-01'), leaseEndDate: new Date('2027-12-31') },
    { email: 'robert.johnson@example.com', firstName: 'Robert', lastName: 'Johnson', residentType: 'treasurer' as const, unit: '410', phone: '(305) 555-0410', mobile: '(786) 555-0410', isBoardMember: true, leaseBeginDate: new Date('2024-03-01'), leaseEndDate: new Date('2026-02-28') },
    { email: 'emily.davis@example.com', firstName: 'Emily', lastName: 'Davis', residentType: 'renter' as const, unit: '118', mobile: '(786) 555-0118', dateOfBirth: new Date('1995-01-30'), leaseBeginDate: new Date('2025-09-01'), leaseEndDate: new Date('2026-08-31'), movingDate: new Date('2025-09-01') },
  ];

  for (const r of residents) {
    const hash = await bcrypt.hash('resident123', 10);
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: r.email } },
      create: {
        tenantId: tenant.id,
        email: r.email,
        passwordHash: hash,
        firstName: r.firstName,
        lastName: r.lastName,
        isActive: true,
        residentType: r.residentType,
        unit: r.unit,
        phone: r.phone ?? null,
        mobile: r.mobile ?? null,
        dateOfBirth: r.dateOfBirth ?? null,
        leaseBeginDate: r.leaseBeginDate ?? null,
        leaseEndDate: r.leaseEndDate ?? null,
        isBoardMember: r.isBoardMember ?? false,
        movingDate: r.movingDate ?? null,
        userRoles: { create: { roleId: residentRole.id } },
      },
      update: {},
    });
  }

  console.log('Seed done. Tenant:', tenant.slug, '| Admin:', user.email, '| Password: admin123');
  console.log(`  ${residents.length} sample residents created (password: resident123)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
