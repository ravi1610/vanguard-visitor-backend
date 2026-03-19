import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedDocuments(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'adminUserId'>): Promise<void>;
