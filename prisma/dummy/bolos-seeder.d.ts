import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedBolos(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'adminUserId'>): Promise<void>;
