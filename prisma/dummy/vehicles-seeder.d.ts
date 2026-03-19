import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedVehicles(prisma: PrismaClient, ctx: DummySeedContext): Promise<void>;
