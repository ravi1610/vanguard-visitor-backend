"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const url = process.env.DATABASE_URL;
if (!url)
    throw new Error('DATABASE_URL is required');
const adapter = new adapter_pg_1.PrismaPg({ connectionString: url });
const p = new client_1.PrismaClient({ adapter });
async function main() {
    const allStaff = await p.staff.findMany({ select: { id: true, tenantId: true, firstName: true } });
    console.log('All staff:');
    for (const s of allStaff) {
        console.log(`  ${s.id} -> tenant: ${s.tenantId}, name: ${s.firstName}`);
    }
    const tenants = await p.tenant.findMany({ select: { id: true, name: true, slug: true } });
    console.log('\nTenants:');
    for (const t of tenants) {
        console.log(`  ${t.id} -> ${t.name} (${t.slug})`);
    }
    const users = await p.user.findMany({ where: { email: 'admin@example.com' }, select: { id: true, tenantId: true, email: true } });
    console.log('\nAdmin users:');
    for (const u of users) {
        console.log(`  ${u.id} -> tenant: ${u.tenantId}`);
    }
    await p.$disconnect();
}
main();
//# sourceMappingURL=count-check.js.map