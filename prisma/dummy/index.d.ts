import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export type { DummySeedContext, DummySeedCounts } from './context';
export { getDummySeedCounts } from './context';
export { seedUnits } from './units-seeder';
export declare function runDummySeed(prisma: PrismaClient, ctx: DummySeedContext): Promise<void>;
