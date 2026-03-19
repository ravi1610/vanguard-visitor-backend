import type { PrismaClient } from '@prisma/client';
import type { DummySeedContext } from './context';
export declare function seedVisits(prisma: PrismaClient, ctx: DummySeedContext & {
    visitorIds: string[];
}): Promise<void>;
