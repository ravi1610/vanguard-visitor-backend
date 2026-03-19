"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt = __importStar(require("bcrypt"));
const dummy_1 = require("./dummy");
const url = process.env.DATABASE_URL;
if (!url)
    throw new Error('DATABASE_URL is required for seed');
const adapter = new adapter_pg_1.PrismaPg({ connectionString: url });
const prisma = new client_1.PrismaClient({ adapter });
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
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
        'reports.manage',
        'emergencyContacts.view',
        'emergencyContacts.manage',
        'pets.view',
        'pets.manage',
        'violations.view',
        'violations.manage',
        'packages.view',
        'packages.manage',
        'bolos.view',
        'bolos.manage',
        'units.view',
        'units.manage',
    ];
    await prisma.permission.createMany({
        data: permissions.map((key) => ({ key, description: key.replace('.', ' ') })),
        skipDuplicates: true,
    });
    const seedSuperAdmin = process.env.SEED_SUPERADMIN === 'true';
    const tenantSlug = seedSuperAdmin
        ? (process.env.SUPERADMIN_TENANT_SLUG || 'sunset-bay')
        : 'sunset-bay';
    const tenantName = tenantSlug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || 'Sunset Bay';
    const tenant = await prisma.tenant.upsert({
        where: { slug: tenantSlug },
        create: { name: tenantName, slug: tenantSlug, isActive: true },
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
    await prisma.rolePermission.createMany({
        data: permIds.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
    });
    const email = seedSuperAdmin
        ? (process.env.SUPERADMIN_EMAIL || 'admin@vanguardvisitor.com')
        : 'admin@example.com';
    const password = seedSuperAdmin
        ? (process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!')
        : 'admin123';
    const firstName = seedSuperAdmin
        ? (process.env.SUPERADMIN_FIRST_NAME || 'Super')
        : 'Admin';
    const lastName = seedSuperAdmin
        ? (process.env.SUPERADMIN_LAST_NAME || 'Admin')
        : 'User';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email } },
        create: {
            tenantId: tenant.id,
            email,
            passwordHash,
            firstName,
            lastName,
            isActive: true,
            isSuperAdmin: true,
            userRoles: { create: { roleId: role.id } },
        },
        update: {
            passwordHash,
            firstName,
            lastName,
            isActive: true,
            isSuperAdmin: true,
        },
        include: { userRoles: { include: { role: true } } },
    });
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
    console.log('Seed done. Tenant:', tenant.slug, '| Admin:', user.email, seedSuperAdmin ? '| Password: (from SUPERADMIN_PASSWORD in .env)' : '| Password: admin123');
    const receptionistRole = await prisma.role.upsert({
        where: { tenantId_key: { tenantId: tenant.id, key: 'receptionist' } },
        create: {
            tenantId: tenant.id,
            name: 'Receptionist',
            key: 'receptionist',
            description: 'Front desk / reception staff',
        },
        update: {},
    });
    const receptionistPermKeys = [
        'visitor.view',
        'visitor.manage',
        'visit.view',
        'visit.checkin',
        'visit.checkout',
        'visit.view_history',
        'packages.view',
        'packages.manage',
        'units.view',
    ];
    for (const key of receptionistPermKeys) {
        const perm = await prisma.permission.findUnique({ where: { key } });
        if (perm) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: receptionistRole.id, permissionId: perm.id } },
                create: { roleId: receptionistRole.id, permissionId: perm.id },
                update: {},
            });
        }
    }
    const receptionists = [
        { email: 'receptionist1@sunsetbay.com', firstName: 'Lisa', lastName: 'Park' },
        { email: 'receptionist2@sunsetbay.com', firstName: 'Jennifer', lastName: 'Moore' },
    ];
    for (const r of receptionists) {
        const hash = await bcrypt.hash('receptionist123', 10);
        await prisma.user.upsert({
            where: { tenantId_email: { tenantId: tenant.id, email: r.email } },
            create: {
                tenantId: tenant.id,
                email: r.email,
                passwordHash: hash,
                firstName: r.firstName,
                lastName: r.lastName,
                isActive: true,
                userRoles: { create: { roleId: receptionistRole.id } },
            },
            update: { firstName: r.firstName, lastName: r.lastName, isActive: true },
        });
    }
    console.log(`  ${receptionists.length} receptionists created (password: receptionist123)`);
    const securityRole = await prisma.role.upsert({
        where: { tenantId_key: { tenantId: tenant.id, key: 'security' } },
        create: {
            tenantId: tenant.id,
            name: 'Security',
            key: 'security',
            description: 'Security / gate staff',
        },
        update: {},
    });
    const securityPermKeys = [
        'visitor.view',
        'visit.view',
        'visit.checkin',
        'visit.checkout',
        'visit.view_history',
        'vehicles.view',
        'vehicles.manage',
        'bolos.view',
        'bolos.manage',
        'units.view',
    ];
    for (const key of securityPermKeys) {
        const perm = await prisma.permission.findUnique({ where: { key } });
        if (perm) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: securityRole.id, permissionId: perm.id } },
                create: { roleId: securityRole.id, permissionId: perm.id },
                update: {},
            });
        }
    }
    const securityUsers = [
        { email: 'security1@sunsetbay.com', firstName: 'Carlos', lastName: 'Mendez' },
        { email: 'security2@sunsetbay.com', firstName: 'Diana', lastName: 'Reyes' },
    ];
    for (const s of securityUsers) {
        const hash = await bcrypt.hash('security123', 10);
        await prisma.user.upsert({
            where: { tenantId_email: { tenantId: tenant.id, email: s.email } },
            create: {
                tenantId: tenant.id,
                email: s.email,
                passwordHash: hash,
                firstName: s.firstName,
                lastName: s.lastName,
                isActive: true,
                userRoles: { create: { roleId: securityRole.id } },
            },
            update: { firstName: s.firstName, lastName: s.lastName, isActive: true },
        });
    }
    console.log(`  ${securityUsers.length} security users created (password: security123)`);
    const staffRoleNames = ['Manager', 'Officer', 'Supervisor', 'Staff'];
    const staffRoleIdByName = {};
    for (const name of staffRoleNames) {
        const staffRole = await prisma.staffRole.upsert({
            where: { id: `seed-staffrole-${name.toLowerCase()}` },
            create: { id: `seed-staffrole-${name.toLowerCase()}`, name, isActive: true },
            update: { name, isActive: true },
        });
        staffRoleIdByName[name] = staffRole.id;
    }
    console.log(`  ${staffRoleNames.length} staff roles`);
    const staffPositionNames = [
        'Property Manager',
        'Assistant PM',
        'Front Desk Admin',
        'Front Desk User',
        'Front Gate user',
        'HOA',
        'Maintenance Staff',
        'Maintenance Supervisor',
        'Property Admin',
        'System Administrator',
        'UTG Admin',
        'Valet',
    ];
    const staffPositionIdByName = {};
    for (const name of staffPositionNames) {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const staffPosition = await prisma.staffPosition.upsert({
            where: { id: `seed-staffposition-${slug}` },
            create: { id: `seed-staffposition-${slug}`, name, isActive: true },
            update: { name, isActive: true },
        });
        staffPositionIdByName[name] = staffPosition.id;
    }
    console.log(`  ${staffPositionNames.length} staff positions`);
    const departmentNames = [
        'Administration',
        'Maintenance',
        'Front Desk',
        'Activities',
        'Restaurants',
        'Valet',
        'Concierge',
    ];
    const departmentIdByName = {};
    for (const name of departmentNames) {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const department = await prisma.department.upsert({
            where: { id: `seed-department-${slug}` },
            create: { id: `seed-department-${slug}`, name, isActive: true },
            update: { name, isActive: true },
        });
        departmentIdByName[name] = department.id;
    }
    console.log(`  ${departmentNames.length} departments`);
    if (IS_PRODUCTION) {
        console.log('  Production mode — skipping dummy data.');
        return;
    }
    if (process.env.SEED_DUMMY !== 'true') {
        console.log('  Skipping dummy data (set SEED_DUMMY=true to enable).');
        return;
    }
    console.log('  Seeding dummy data for development...');
    const seedCounts = (0, dummy_1.getDummySeedCounts)();
    const unitMap = await (0, dummy_1.seedUnits)(prisma, tenant.id, seedCounts.units);
    await (0, dummy_1.runDummySeed)(prisma, {
        tenantId: tenant.id,
        counts: seedCounts,
        unitMap,
        residentUsers: [],
        adminUserId: user.id,
        residentRoleId: residentRole.id,
        staffRoleIdByName,
        staffPositionIdByName,
        departmentIdByName,
    });
}
main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map