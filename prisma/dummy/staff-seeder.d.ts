import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedStaff(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'staffRoleIdByName' | 'staffPositionIdByName' | 'departmentIdByName'>): Promise<void>;
