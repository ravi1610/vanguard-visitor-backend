import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedResidents(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'unitMap' | 'counts' | 'residentRoleId'>): Promise<{
    id: string;
    firstName: string;
    lastName: string;
}[]>;
