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
exports.seedResidents = seedResidents;
const bcrypt = __importStar(require("bcrypt"));
const helpers_1 = require("./helpers");
const RESIDENT_TYPES = ['owner', 'renter', 'president', 'vice_president', 'treasurer'];
async function seedResidents(prisma, ctx) {
    const { tenantId, unitMap, counts, residentRoleId } = ctx;
    const count = counts.residents;
    const unitIds = Object.values(unitMap);
    const defaultPasswordHash = await bcrypt.hash('resident123', 10);
    const residentUsers = [];
    for (let i = 0; i < count; i++) {
        const unitId = unitIds.length ? (0, helpers_1.at)(i, unitIds) : null;
        const residentType = (0, helpers_1.at)(i, RESIDENT_TYPES);
        const email = `resident-${i + 1}@dummy.local`;
        const firstName = 'Resident';
        const lastName = String(i + 1);
        const leaseStart = (0, helpers_1.dateOffset)(-(365 + i * 30) * 86400000);
        const leaseEnd = (0, helpers_1.dateOffset)((365 - i * 10) * 86400000);
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
                dateOfBirth: (0, helpers_1.dateOffset)(-(25 + (i % 40)) * 365 * 86400000),
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
//# sourceMappingURL=residents-seeder.js.map