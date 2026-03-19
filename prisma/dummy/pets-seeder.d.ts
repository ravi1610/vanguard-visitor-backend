import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedPets(prisma: PrismaClient, ctx: Pick<DummySeedContext, 'tenantId' | 'counts' | 'residentUsers'>): Promise<void>;
