import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedVendors(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'counts'>): Promise<void>;
