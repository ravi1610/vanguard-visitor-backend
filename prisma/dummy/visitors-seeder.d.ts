import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedVisitors(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'counts'>): Promise<string[]>;
