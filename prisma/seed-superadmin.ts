/**
 * Standalone Superadmin Seeder
 *
 * Creates or promotes a superadmin user on the platform.
 * Safe to run multiple times (idempotent — uses upsert).
 *
 * Usage:
 *   npx tsx prisma/seed-superadmin.ts
 *
 * Environment variables (all optional — sensible defaults for local/dev):
 *   SUPERADMIN_EMAIL         default: admin@vanguardvisitor.com
 *   SUPERADMIN_PASSWORD      default: SuperAdmin123!
 *   SUPERADMIN_FIRST_NAME    default: Super
 *   SUPERADMIN_LAST_NAME     default: Admin
 *   SUPERADMIN_TENANT_SLUG   default: sunset-bay
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const EMAIL = process.env.SUPERADMIN_EMAIL || 'admin@vanguardvisitor.com';
const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
const FIRST_NAME = process.env.SUPERADMIN_FIRST_NAME || 'Super';
const LAST_NAME = process.env.SUPERADMIN_LAST_NAME || 'Admin';
const TENANT_SLUG = process.env.SUPERADMIN_TENANT_SLUG || 'sunset-bay';

async function main() {
  console.log('=== Superadmin Seeder ===');
  console.log(`  Tenant slug: ${TENANT_SLUG}`);
  console.log(`  Email:       ${EMAIL}`);

  // ── Find or create tenant ───────────────────────────────────────
  let tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    const name = TENANT_SLUG
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    tenant = await prisma.tenant.create({
      data: { name, slug: TENANT_SLUG, isActive: true },
    });
    console.log(`  Created tenant: ${tenant.name} (${tenant.slug})`);
  } else {
    console.log(`  Found tenant: ${tenant.name}`);
  }

  // ── Ensure tenant_owner role exists ─────────────────────────────
  let role = await prisma.role.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'tenant_owner' } },
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Tenant Owner',
        key: 'tenant_owner',
        description: 'Full control',
      },
    });
    // Assign all permissions to tenant_owner
    const allPerms = await prisma.permission.findMany({ select: { id: true } });
    if (allPerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: allPerms.map((p) => ({ roleId: role!.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
    console.log('  Created tenant_owner role with all permissions');
  }

  // ── Upsert the superadmin user ──────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: EMAIL } },
    create: {
      tenantId: tenant.id,
      email: EMAIL,
      passwordHash,
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      isActive: true,
      isSuperAdmin: true,
    },
    update: {
      passwordHash,
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      isActive: true,
      isSuperAdmin: true,
    },
  });

  // ── Ensure tenant_owner role is assigned ─────────────────────────
  const existingRole = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    console.log('  Assigned tenant_owner role');
  }

  console.log('');
  console.log('  Superadmin seeded successfully!');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Tenant:   ${tenant.name} (${tenant.slug})`);
  console.log('');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Superadmin seed failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
